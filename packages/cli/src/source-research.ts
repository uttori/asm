import fs from "node:fs";
import path from "node:path";

import {
  changeResearchSymbol,
  changeResearchAnalysis,
  openAnalysisProjectStore,
  sourceProjectLocalInputs,
  readResearchInputs,
  sourceContentHash,
  type ProjectLabel,
  type ResearchSymbolChange,
  type SourceProject,
  type AddressSpaceDescriptor,
  type ResearchAnalysisChange,
  type ResearchAnalysisRecord,
} from "@uttori/asm-disassembler";

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
  );
  if (request.kind === "analysis") {
    // Read only the compact manifest. This picker must never materialize the captured graph or update its projection.
    const store = openAnalysisProjectStore(sourceProjectLocalInputs(project).evidence);
    let spaces: readonly AddressSpaceDescriptor[];
    try {
      const manifest = store.manifest();
      if (manifest.rom.contentSha256 !== project.configuration.romSha256) {
        throw new Error("Research evidence belongs to another ROM.");
      }
      spaces = manifest.addressSpaces;
    } finally {
      store.close();
    }
    if (!request.change) {
      const records = snapshot.files.flatMap((file) =>
        file.document.decisions.flatMap((decision) => {
          if (
            (decision.collection !== "annotations" && decision.collection !== "analysis") ||
            !decision.value
          ) {
            return [];
          }
          return [
            {
              path: file.path,
              collection: decision.collection,
              value: decision.value as ResearchAnalysisRecord,
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
        const label = decision.value as ProjectLabel;
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
