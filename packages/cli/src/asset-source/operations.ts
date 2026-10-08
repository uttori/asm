import path from "node:path";

import {
  sourceContentHash,
  sourceRepository,
  readSourceFileTransaction,
} from "@uttori/asm-disassembler";

import type { AssetSourceDraft, AssetSourceHost } from "../asset-interchange/contracts.js";
import { recoverAssetInterchange } from "../asset-interchange/maintenance.js";
import { savedAssetSourceHost } from "../asset-interchange/service.js";
import {
  AssetSourceConversionService,
  type AssetSourceConversionRequest,
} from "../asset-source-conversion.js";
import { inspectSourceProject } from "../source.js";
import { rasterSourceConversionAdapter } from "./raster-adapter.js";
import { somSourceConversionAdapter } from "./som-adapter.js";

export * from "../asset-source-conversion.js";
export { somSourceConversionAdapter, rasterSourceConversionAdapter };

/** The editor stages a validated journal before publishing one native WorkspaceEdit; CLI publishes immediately. */
export type AssetSourceOperation =
  | (Omit<AssetSourceConversionRequest, "representation" | "destination"> & {
      readonly action: "asset-source-target";
    })
  | (AssetSourceConversionRequest & {
      readonly action: "asset-convert";
      readonly drafts?: readonly AssetSourceDraft[];
      readonly stageOnly?: boolean;
    })
  | {
      readonly action: "asset-conversion-finish";
      readonly directory: string;
      readonly transaction: string;
      readonly outputSha256: string;
      readonly drafts?: readonly AssetSourceDraft[];
    };

/** Installed defaults are ordinary adapters; embedders can inject additional codecs/adapters into the exported service. */
export function createAssetSourceConversionService(
  host: AssetSourceHost = savedAssetSourceHost,
): AssetSourceConversionService {
  return new AssetSourceConversionService(
    [somSourceConversionAdapter, rasterSourceConversionAdapter],
    host,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
function isDraft(value: unknown): value is AssetSourceDraft {
  return (
    isRecord(value) &&
    typeof value.path === "string" &&
    typeof value.version === "number" &&
    Number.isSafeInteger(value.version) &&
    typeof value.opaque === "boolean"
  );
}
/** Reject malformed IPC or command requests before they can stage source files. */
function readOperation(value: unknown): AssetSourceOperation {
  if (!isRecord(value)) {
    throw new Error("Invalid source conversion request.");
  }
  const input = value;
  if (typeof input.directory !== "string" || !input.directory || input.directory.includes("\0")) {
    throw new Error("Conversion needs a source project directory.");
  }
  let drafts: readonly AssetSourceDraft[] | undefined;
  if (input.drafts !== undefined) {
    if (
      !isUnknownArray(input.drafts) ||
      input.drafts.length > 65536 ||
      !input.drafts.every(isDraft)
    ) {
      throw new Error("Invalid source conversion drafts.");
    }
    drafts = input.drafts;
  }
  if (input.action === "asset-convert" || input.action === "asset-source-target") {
    if (
      typeof input.file !== "string" ||
      !input.file ||
      typeof input.line !== "number" ||
      !Number.isSafeInteger(input.line) ||
      input.line < 1
    ) {
      throw new Error("Conversion needs an assembly file and one-based cursor line.");
    }
    const common = { directory: input.directory, file: input.file, line: input.line };
    if (input.action === "asset-source-target") {
      return { ...common, action: input.action };
    }
    if (
      typeof input.representation !== "string" ||
      !input.representation ||
      (input.destination !== undefined && typeof input.destination !== "string") ||
      (input.stageOnly !== undefined && typeof input.stageOnly !== "boolean")
    ) {
      throw new Error("Invalid conversion representation or destination.");
    }
    return {
      ...common,
      action: input.action,
      representation: input.representation,
      destination: input.destination,
      stageOnly: input.stageOnly,
      drafts,
    };
  }
  if (
    input.action !== "asset-conversion-finish" ||
    typeof input.transaction !== "string" ||
    !/^[\da-f-]{36}$/i.test(input.transaction) ||
    typeof input.outputSha256 !== "string" ||
    !/^[\da-f]{64}$/.test(input.outputSha256)
  ) {
    throw new Error("Invalid staged conversion identity.");
  }
  return {
    action: input.action,
    directory: input.directory,
    transaction: input.transaction,
    outputSha256: input.outputSha256,
    drafts,
  };
}

/** Both hosts use the same current-ROM oracle, relevant-draft safeguards and recoverable file journal. */
export async function executeAssetSourceOperation(
  value: unknown,
  options: {
    readonly signal?: AbortSignal;
    readonly beforePublish?: AssetSourceHost["beforePublish"];
  } = {},
) {
  const operation = readOperation(value);
  const host: AssetSourceHost = {
    ...savedAssetSourceHost,
    beforePublish: options.beforePublish,
    drafts: () => ("drafts" in operation ? (operation.drafts ?? []) : []),
  };
  if (operation.action === "asset-source-target") {
    const service = createAssetSourceConversionService(host);
    const resolved = await service.resolve(operation, options.signal);
    if (!service.adapters.some((adapter) => adapter.supports(resolved.selected))) {
      return undefined;
    }
    return {
      source: resolved.source,
      representation: resolved.current.id,
      representations: service.codecs.representations(),
      file: resolved.build.mapping.fileList[resolved.selected.fileIdx].name,
      line: resolved.selected.line,
    };
  }
  if (operation.action === "asset-convert") {
    return createAssetSourceConversionService(host).convert(operation, {
      signal: options.signal,
      stageOnly: operation.stageOnly,
    });
  }
  const repository = await sourceRepository(operation.directory);
  const journal = readSourceFileTransaction(repository);
  if (!journal || journal.id !== operation.transaction || journal.state === "completed") {
    throw new Error("Staged conversion journal changed; use explicit source recovery.");
  }
  await recoverAssetInterchange(
    operation.directory,
    "after",
    {
      beforePublish: async (paths) => {
        const dirty =
          operation.drafts?.filter((draft) =>
            paths.includes(path.resolve(repository.root, draft.path)),
          ) ?? [];
        if (dirty.length) {
          throw new Error("Save relevant conversion documents before completing publication.");
        }
        await options.beforePublish?.(paths);
      },
    },
    options.signal,
  );
  const build = await inspectSourceProject(operation.directory, undefined, options.signal);
  if (build.diagnostics.length || sourceContentHash(build.output) !== operation.outputSha256) {
    throw new Error(
      "Published conversion does not match the validated ROM; source files remain available for inspection.",
    );
  }
  return {
    transaction: journal.id,
    outputSha256: operation.outputSha256,
    state: "completed" as const,
  };
}
