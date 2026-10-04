import fs from "node:fs/promises";
import path from "node:path";

import { sourceContentHash, parseSourceProject } from "@uttori/asm-disassembler";

/** Saved byte identity; consumed assembly dependencies come from the worker's build receipt. */
export interface SavedBuildInput {
  /** Portable path relative to the selected source repository. */
  readonly path: string;
  /** SHA-256 of the saved bytes consumed by the build. */
  readonly sha256: string;
}

/** Pin the configuration files read outside the assembler before starting the background build. */
export async function captureBuildControls(root: string): Promise<readonly SavedBuildInput[]> {
  // The tree's cached configuration can lag a terminal edit. Pin and parse the same saved
  // manifest bytes so the worker's newly selected layout/configuration cannot escape validation.
  const projectBytes = await fs.readFile(path.join(root, ".uttori/project.json"));
  const configuration = parseSourceProject(JSON.parse(projectBytes.toString("utf8")));
  const files = [
    configuration.layout,
    configuration.buildConfig,
    path.posix.join(path.posix.dirname(configuration.buildConfig), "source-raw.json"),
  ];
  const controls = await Promise.all(
    files.map(async (file) => ({
      path: file,
      sha256: sourceContentHash(await fs.readFile(path.resolve(root, file))),
    })),
  );
  return [{ path: ".uttori/project.json", sha256: sourceContentHash(projectBytes) }, ...controls];
}

/** Compare actual bytes, including deletion. Bounded parallel reads avoid opening every asset at once. */
export async function changedBuildInputs(
  root: string,
  inputs: readonly SavedBuildInput[],
): Promise<string[]> {
  const changed: string[] = [];
  for (let start = 0; start < inputs.length; start += 8) {
    const results = await Promise.all(
      inputs.slice(start, start + 8).map(async (input) => {
        try {
          return (
            sourceContentHash(await fs.readFile(path.resolve(root, input.path))) !== input.sha256
          );
        } catch (error) {
          // Deleting or moving a consumed file invalidates launch just like editing its bytes.
          if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            return true;
          }
          throw error;
        }
      }),
    );
    for (const [index, different] of results.entries()) {
      if (different) {
        changed.push(inputs[start + index].path);
      }
    }
  }
  return [...new Set(changed)].toSorted();
}
