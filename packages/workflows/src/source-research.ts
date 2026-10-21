import fs from "node:fs";
import path from "node:path";

import {
  changeResearchSymbol,
  changeResearchAnalysis,
  withAnalysisReadSession,
  readResearchInputs,
  type ProjectLabel,
  type ResearchSymbolChange,
  type AddressSpaceDescriptor,
  type ResearchAnalysisChange,
  type ResearchAnalysisRecord,
} from "@uttori/asm-disassembler";
import {
  sourceProjectLocalInputs,
  sourceContentHash,
  type SourceProject,
} from "@uttori/asm-disassembler/source-project";
import { loadNesRom, nesResearchInputs } from "@uttori/asm-plugin-65xx/disassembler";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item): item is string => typeof item === "string");
}

function isProjectLabel(value: unknown): value is ProjectLabel {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.addressSpace !== "string" ||
    typeof value.address !== "number" ||
    typeof value.name !== "string" ||
    !isStringArray(value.evidence)
  ) {
    return false;
  }
  return (
    (value.sourceName === undefined || typeof value.sourceName === "string") &&
    (value.aliases === undefined || isStringArray(value.aliases)) &&
    (value.suppressed === undefined || typeof value.suppressed === "boolean") &&
    (value.analysisEntryPoint === undefined || typeof value.analysisEntryPoint === "boolean")
  );
}

function isResearchAnalysisRecord(value: unknown): value is ResearchAnalysisRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.addressSpace !== "string" ||
    !isStringArray(value.evidence)
  ) {
    return false;
  }
  if (value.kind === "target-override" || value.kind === "target-set") {
    return (
      Array.isArray(value.targets) &&
      value.targets.every((target): target is number => typeof target === "number") &&
      (value.kind === "target-override" || typeof value.name === "string") &&
      (value.kind === "target-set" || typeof value.address === "number")
    );
  }
  return (
    typeof value.start === "number" &&
    typeof value.end === "number" &&
    typeof value.classification === "string" &&
    typeof value.architecture === "string"
  );
}

/** Omit the selection to list declarations; a selected change returns a proposal without saving it. */
export type SourceResearchRequest =
  | {
      readonly kind?: "symbols";
      readonly symbolId?: string;
      readonly change?: ResearchSymbolChange;
    }
  | { readonly kind: "analysis"; readonly change?: ResearchAnalysisChange };

/** Compact picker/navigation data; original addresses remain valid after source relocation. */
export interface SourceResearchSymbol {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly addressSpace: string;
  readonly address: number;
  readonly aliases: readonly string[];
  readonly suppressed: boolean;
  readonly entryPoint: boolean;
}

/** Exact before/after text supports both terminal review and one native workspace undo operation. */
export type SourceResearchResult =
  | { readonly kind: "symbols"; readonly symbols: readonly SourceResearchSymbol[] }
  | {
      readonly kind: "analysis";
      readonly documents: readonly { readonly path: string; readonly sha256: string }[];
      readonly addressSpaces: readonly AddressSpaceDescriptor[];
      readonly records: readonly {
        readonly path: string;
        readonly collection: "annotations" | "analysis";
        readonly value: ResearchAnalysisRecord;
      }[];
    }
  | {
      readonly kind: "edit";
      readonly path: string;
      readonly beforeSha256: string;
      readonly before: string;
      readonly after: string;
    };

/** Research choices are prepared from saved files plus optional editor buffers, never written to SQLite. */
export function prepareSourceResearch(
  project: SourceProject,
  request: SourceResearchRequest = {},
  buffers: readonly { readonly path: string; readonly bytes: Uint8Array }[] = [],
): SourceResearchResult {
  const overlays = new Map(
    buffers.map((buffer) => [
      buffer.path,
      new TextDecoder("utf-8", { fatal: true }).decode(buffer.bytes),
    ]),
  );
  const snapshot = readResearchInputs(
    project.repository.root,
    project.configuration.researchRoots,
    {
      project: project.configuration.id,
      romSha256: project.configuration.romSha256,
    },
    overlays,
    project.configuration.limits,
  );
  if (request.kind === "analysis") {
    // Read only the compact manifest. This picker must never materialize the captured graph or update its projection.
    const spaces: readonly AddressSpaceDescriptor[] = withAnalysisReadSession(
      sourceProjectLocalInputs(project).evidence,
      ({ manifest }) => {
        if (manifest.rom.contentSha256 !== project.configuration.romSha256) {
          throw new Error("Research evidence belongs to another ROM.");
        }
        return manifest.addressSpaces;
      },
    );
    if (!request.change) {
      const records = snapshot.files.flatMap((file) =>
        file.document.decisions.flatMap((decision) => {
          if (
            (decision.collection !== "annotations" && decision.collection !== "analysis") ||
            !decision.value
          ) {
            return [];
          }
          if (!isResearchAnalysisRecord(decision.value)) {
            throw new Error("Research analysis decision does not match its collection.");
          }
          return [
            {
              path: file.path,
              collection: decision.collection,
              value: decision.value,
            },
          ];
        }),
      );
      if (records.length > 10000) {
        throw new Error(
          "Research picker exceeds 10,000 records. Open the declaration file directly.",
        );
      }
      return {
        kind: "analysis",
        documents: snapshot.files.map((file) => ({ path: file.path, sha256: file.sha256 })),
        addressSpaces: spaces,
        records,
      };
    }
    if (project.configuration.target === "65xx.nes" && request.change.kind === "put") {
      const { cartridge } = loadNesRom(sourceProjectLocalInputs(project).rom);
      const value = request.change.value;
      nesResearchInputs(cartridge, {
        labels: [],
        comments: [],
        regions: [],
        annotations: "classification" in value ? [value] : [],
        analysis: "kind" in value ? [value] : [],
      });
    }
    const edit = changeResearchAnalysis(snapshot, request.change, spaces);
    const before =
      overlays.get(edit.path) ??
      fs.readFileSync(path.join(project.repository.root, edit.path), "utf8");
    if (sourceContentHash(before) !== edit.expectedSha256) {
      throw new Error(
        "Research changed while preparing this edit. Retry with the current declaration.",
      );
    }
    return {
      kind: "edit",
      path: edit.path,
      beforeSha256: edit.expectedSha256,
      before,
      after: JSON.stringify(edit.document, null, 2) + "\n",
    };
  }
  if (!request.symbolId && !request.change) {
    const symbols = snapshot.files.flatMap((file) =>
      file.document.decisions.flatMap((decision) => {
        if (decision.collection !== "labels" || !decision.value) {
          return [];
        }
        if (!isProjectLabel(decision.value)) {
          throw new Error("Research label decision is not a project label.");
        }
        const label = decision.value;
        return [
          {
            id: label.id,
            name: label.sourceName ?? label.name,
            path: file.path,
            addressSpace: label.addressSpace,
            address: label.address,
            aliases: label.aliases ?? [],
            suppressed: label.suppressed ?? false,
            entryPoint: label.analysisEntryPoint !== false,
          },
        ];
      }),
    );
    if (symbols.length > 10000) {
      throw new Error(
        "Research picker exceeds 10,000 symbols. Open the declaration file directly.",
      );
    }
    return { kind: "symbols", symbols };
  }
  if (!request.symbolId || !request.change) {
    throw new Error("Choose a symbol and a research action.");
  }
  const edit = changeResearchSymbol(snapshot, request.symbolId, request.change);
  const before =
    overlays.get(edit.path) ??
    fs.readFileSync(path.join(project.repository.root, edit.path), "utf8");
  if (sourceContentHash(before) !== edit.expectedSha256) {
    throw new Error(
      "Research changed while preparing this edit. Retry with the current declaration.",
    );
  }
  return {
    kind: "edit",
    path: edit.path,
    beforeSha256: edit.expectedSha256,
    before,
    after: JSON.stringify(edit.document, null, 2) + "\n",
  };
}
