import fs from "node:fs";
import path from "node:path";

import { executeSourceOperation } from "@uttori/asm-game-secret-of-mana/source-host";
import { SNES_MAPPERS, type SnesMapper } from "@uttori/asm-plugin-snes/disassembler";
import { readSourceOperation } from "@uttori/asm-workflows/source";
import { type SourceResearchRequest } from "@uttori/asm-workflows/source";

function readJson(file: string): unknown {
  if (fs.statSync(file).size > 8 * 1024 * 1024) {
    throw new Error(`Project contract is too large: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSnesMapper(value: string): value is SnesMapper {
  return SNES_MAPPERS.some((mapper) => mapper === value);
}

const DIRECT_SOURCE_ACTIONS = [
  "status",
  "prepare",
  "preview",
  "apply",
  "finish",
  "abort",
  "discard",
  "clean",
  "build",
  "index",
  "analyze",
  "catalog",
  "relocate",
  "expand",
  "import",
] as const;

type DirectSourceAction = (typeof DIRECT_SOURCE_ACTIONS)[number];

function isDirectSourceAction(value: string): value is DirectSourceAction {
  return DIRECT_SOURCE_ACTIONS.some((action) => action === value);
}

type AnalysisChange = NonNullable<Extract<SourceResearchRequest, { kind: "analysis" }>["change"]>;

function requestedMapper(value: string | undefined): SnesMapper | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isSnesMapper(value)) {
    throw new Error("Unsupported SNES mapper.");
  }
  return value;
}

function readAnalysisChange(file: string): AnalysisChange {
  const value = readJson(file);
  if (!isResearchAnalysisChange(value)) {
    throw new Error("Choose an annotation or indirect-target research action.");
  }
  return value;
}

function isResearchAnalysisChange(value: unknown): value is AnalysisChange {
  if (!isRecord(value) || typeof value.expectedDocumentSha256 !== "string") {
    return false;
  }
  if (value.kind !== "put" && value.kind !== "remove") {
    return false;
  }
  if (value.collection !== "annotations" && value.collection !== "analysis") {
    return false;
  }
  if (value.kind === "remove") {
    return typeof value.id === "string";
  }
  return (
    typeof value.path === "string" &&
    typeof value.reason === "string" &&
    isRecord(value.value) &&
    typeof value.value.id === "string"
  );
}

export const sourceUsage = `uttori-asm source <status|prepare|build|index|analyze|catalog|finish|abort|clean> <project>
uttori-asm source init <new-folder> <original-rom> [--mapper <mapper>] [--dizraw <research.dizraw>]
uttori-asm source <preview|apply|discard> <project> <generation-commit>
uttori-asm source expand <project> <capacity-bytes>
uttori-asm source relocate <project> <object-id>
uttori-asm source import <project> <capture.act2-or-json> [more-captures...] [--recover-partial]
uttori-asm source research <project> [<symbol-id> <aliases|suppress|restore|entry|no-entry> [aliases...]]
uttori-asm source research <project> --analysis [<change.json>]
uttori-asm source graphics <project> [<capture-sha256> [<cpu-pc> [<prg-offset>]]]

Prepare and preview preserve source, staging and Git history. Commit your edits before apply.
Resolve conflicts with Git, stage the result, then finish to validate and commit the merge.`;

/** Assembly hex is accepted without guessing the radix of bare decimal addresses. */
function sourceNumericArgument(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value.replace(/^\$/, "0x"));
}

/** Strict positional CLI adapter; structured service calls carry editor cancellation and buffers. */
export async function runSourceCli(argv: readonly string[]): Promise<number> {
  if (argv.length === 0 || argv.includes("--help")) {
    console.log(sourceUsage);
    return 0;
  }
  const [action, directory, candidate] = argv;
  if (action === "graphics" && directory && argv.length <= 5) {
    try {
      const graphicsQuery = candidate
        ? {
            captureSha256: candidate,
            pc: sourceNumericArgument(argv[3]),
            physicalOffset: sourceNumericArgument(argv[4]),
          }
        : undefined;
      console.log(
        JSON.stringify(await executeSourceOperation({ action, directory, graphicsQuery }), null, 2),
      );
      return 0;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }
  if (action === "research" && directory) {
    try {
      let research: SourceResearchRequest | undefined;
      if (candidate === "--analysis" && argv.length <= 4) {
        research = {
          kind: "analysis",
          change: argv[3] ? readAnalysisChange(path.resolve(argv[3])) : undefined,
        };
      } else if (argv.length > 2) {
        const change = argv[3];
        if (!candidate || !change || (!["aliases"].includes(change) && argv.length !== 4)) {
          throw new Error("Choose a symbol, action and optional aliases.");
        }
        if (change === "aliases") {
          research = { symbolId: candidate, change: { kind: "aliases", aliases: argv.slice(4) } };
        } else if (change === "suppress" || change === "restore") {
          research = {
            symbolId: candidate,
            change: { kind: "suppression", suppressed: change === "suppress" },
          };
        } else if (change === "entry" || change === "no-entry") {
          research = {
            symbolId: candidate,
            change: { kind: "entry-point", enabled: change === "entry" },
          };
        } else {
          throw new Error(`Unknown research action: ${change}`);
        }
      }
      console.log(
        JSON.stringify(await executeSourceOperation({ action, directory, research }), null, 2),
      );
      return 0;
    } catch (error) {
      console.error(
        `Research proposal failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 1;
    }
  }
  if (action === "init" && directory && candidate) {
    try {
      const flags = new Map<string, string>();
      for (let index = 3; index < argv.length; index += 2) {
        const flag = argv[index];
        const value = argv[index + 1];
        if (!["--mapper", "--dizraw"].includes(flag) || !value || flags.has(flag)) {
          throw new Error("Initialization accepts one --mapper and one --dizraw value.");
        }
        flags.set(flag, value);
      }
      const result = await executeSourceOperation({
        action,
        directory,
        rom: candidate,
        mapper: requestedMapper(flags.get("--mapper")),
        dizRawFile: flags.get("--dizraw"),
      });
      console.log(JSON.stringify(result, null, 2));
      return 0;
    } catch (error) {
      console.error(
        `Source initialization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 1;
    }
  }
  let validArity =
    argv.length ===
    (["preview", "apply", "discard", "relocate", "expand"].includes(action) ? 3 : 2);
  if (action === "import") {
    validArity = argv.length >= 3;
  }
  if (!action || !directory || !isDirectSourceAction(action) || !validArity) {
    console.error(sourceUsage);
    return 1;
  }
  try {
    const started = performance.now();
    const importFiles = argv.slice(2).filter((value) => value !== "--recover-partial");
    const result = await executeSourceOperation(
      readSourceOperation({
        action,
        directory,
        candidate: ["preview", "apply", "discard", "status"].includes(action)
          ? candidate
          : undefined,
        capture: action === "import" && importFiles.length === 1 ? importFiles[0] : undefined,
        captures: action === "import" && importFiles.length > 1 ? importFiles : undefined,
        recoverPartial:
          action === "import" && argv.includes("--recover-partial") ? true : undefined,
        onProgress: (message: string) =>
          console.error(`[${((performance.now() - started) / 1000).toFixed(1)}s] ${message}`),
        objectId: action === "relocate" ? candidate : undefined,
        expansionSize: action === "expand" ? Number(candidate) : undefined,
      }),
    );
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    console.error(
      `Source operation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
}
