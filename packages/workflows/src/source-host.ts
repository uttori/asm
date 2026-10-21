import path from "node:path";

import type { AssemblerPlugin } from "@uttori/asm-core/plugin";
import type { SourceWorkflowHost } from "@uttori/asm-disassembler/source-project";
import plugin65xx from "@uttori/asm-plugin-65xx";
import { loadProjectEnvironment, fingerprintNodeToolchain } from "@uttori/asm-plugin-loader-node";
import snesPlugin from "@uttori/asm-plugin-snes";

import type { SourceTargetDescriptor } from "./source-target.js";
export type { SourceWorkflowHost } from "@uttori/asm-disassembler/source-project";

/** Compose bundled plugins at the executable boundary. Registrations override built-ins by module ID. */
export function createSourceWorkflowHost(
  plugins: Iterable<readonly [string, AssemblerPlugin]> = [],
  targets?: readonly SourceTargetDescriptor[],
): SourceWorkflowHost {
  const bundledPlugins = new Map<string, AssemblerPlugin>([
    ["@uttori/asm-plugin-snes", snesPlugin],
    ["@uttori/asm-plugin-65xx", plugin65xx],
    ...plugins,
  ]);
  return {
    targets,
    fingerprint: sourceToolchain,
    loadEnvironment: (configFile) =>
      loadProjectEnvironment({ cwd: path.dirname(configFile), configFile, bundledPlugins }),
  };
}
export const defaultSourceHost = createSourceWorkflowHost();

/** Build scripts set this only for a self-contained executable; source/declaration imports use packages. */
declare const UTTORI_SOURCE_BUNDLED: boolean | undefined;

export function sourceToolchain(plugins: readonly string[]) {
  if (typeof UTTORI_SOURCE_BUNDLED !== "undefined" && UTTORI_SOURCE_BUNDLED) {
    return fingerprintNodeToolchain(plugins, [import.meta.url]);
  }
  return fingerprintNodeToolchain([import.meta.url, ...plugins]);
}
