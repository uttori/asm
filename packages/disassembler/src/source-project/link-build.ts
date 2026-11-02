import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { AssemblyLinkRecipe } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { validateDebugMap } from "@uttori/asm-core/debug-map";
import {
  artifactHash,
  assertLinkRecipe,
  linkObjects,
  type LinkOptions,
  type LinkResult,
} from "@uttori/asm-core/linker";

import { acquireFileLease, durableReplace, syncDirectory } from "../internal/durable-files.js";

/** Paths select one immutable artifact set. Consumers open current.json once and use only these paths. */
export interface LinkedBuildReceipt {
  readonly format: "uttori-linked-build-v1";
  readonly inputSha256: string;
  readonly outputFile: string;
  readonly debugMapFile: string;
  readonly symbolsFile: string;
  readonly allocationFile: string;
  /** Present when the publishing host supplies the resolved recipe for source-free relinking. */
  readonly recipeFile?: string;
  readonly hashes: Readonly<Record<string, string>>;
}

/** A composed Node driver reads only serialized object/archive/recipe inputs, never the original source/asset paths. */
export function buildLinkedObjects(
  options: LinkOptions & {
    readonly directory: string;
    readonly outputName?: string;
    /** Original complete container supplied only for pristine-generation verification. */
    readonly original?: Uint8Array;
  },
): LinkedBuildReceipt {
  const result = linkObjects(options);
  if (
    options.original &&
    (options.original.length !== result.output.length ||
      !options.original.every((byte, index) => byte === result.output[index]))
  ) {
    throw new Error("Linked ROM differs from the original container; no artifacts were published.");
  }
  return publishLinkedBuild(
    result,
    options.directory,
    options.outputName ?? "program.rom",
    options.signal,
    options.recipe,
  );
}

/** Publish all artifacts as one renamed directory, then durably switch the pointer; failures preserve the selected build. */
export function publishLinkedBuild(
  result: LinkResult,
  directory: string,
  outputName = "program.rom",
  signal?: AbortSignal,
  recipe?: AssemblyLinkRecipe,
): LinkedBuildReceipt {
  signal?.throwIfAborted();
  if (
    !/^[\w.-]+$/.test(outputName) ||
    outputName === "." ||
    outputName === ".." ||
    outputName === "build.json"
  ) {
    throw new Error("Linked output name must be a plain filename.");
  }
  if (
    !/^[\da-f]{64}$/.test(result.inputSha256) ||
    validateDebugMap(result.debugMap, result.output).length
  ) {
    throw new Error("Linked artifacts must have a valid input identity and matching debug map.");
  }
  const root = path.resolve(directory);
  const build = path.join(root, result.inputSha256);
  const artifacts = new Map<string, string | Uint8Array>([
    [outputName, result.output],
    [`${outputName}.debug.json`, canonicalJson(result.debugMap)],
    [`${outputName}.symbols.json`, canonicalJson({ symbols: result.symbols })],
    [
      `${outputName}.link.json`,
      canonicalJson({
        allocations: result.allocations,
        regions: result.regions,
        selectedMembers: result.selectedMembers,
        dependencies: result.dependencies,
      }),
    ],
  ]);
  if (recipe) {
    assertLinkRecipe(recipe);
    artifacts.set(`${outputName}.recipe.json`, canonicalJson(recipe));
  }
  const hashes = Object.fromEntries(
    [...artifacts].map(([name, bytes]) => [name, artifactHash(bytes)]),
  );
  const receipt: LinkedBuildReceipt = {
    format: "uttori-linked-build-v1",
    inputSha256: result.inputSha256,
    outputFile: path.join(build, outputName),
    debugMapFile: path.join(build, `${outputName}.debug.json`),
    symbolsFile: path.join(build, `${outputName}.symbols.json`),
    allocationFile: path.join(build, `${outputName}.link.json`),
    ...(recipe ? { recipeFile: path.join(build, `${outputName}.recipe.json`) } : {}),
    hashes,
  };
  const lease = acquireFileLease(path.join(root, "link-publication.lock"));
  const temporary = path.join(root, `${result.inputSha256}.${randomUUID()}.tmp`);
  try {
    if (fs.existsSync(build)) {
      // An existing content identity is immutable; validate it instead of overwriting a retained result.
      if (
        !fs.lstatSync(build).isDirectory() ||
        fs.readFileSync(path.join(build, "build.json"), "utf8") !== canonicalJson(receipt)
      ) {
        throw new Error("Existing linked build does not match its input identity.");
      }
      for (const [name, hash] of Object.entries(hashes)) {
        const file = path.join(build, name);
        if (!fs.lstatSync(file).isFile() || artifactHash(fs.readFileSync(file)) !== hash) {
          throw new Error("Existing linked artifact is corrupt.");
        }
      }
    } else {
      fs.mkdirSync(temporary);
      for (const [name, bytes] of artifacts) {
        signal?.throwIfAborted();
        durableReplace(path.join(temporary, name), bytes);
      }
      durableReplace(path.join(temporary, "build.json"), canonicalJson(receipt));
      signal?.throwIfAborted();
      fs.renameSync(temporary, build);
      syncDirectory(root);
    }
    signal?.throwIfAborted();
    durableReplace(path.join(root, "current.json"), canonicalJson(receipt));
    return receipt;
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
    lease.release();
  }
}
