import * as path from "node:path";

import type { EmulatorRuntimeBinding } from "./debug.js";

/**
 * Reuses an unambiguous explicit live launch for the Run/Debug build commands.
 * Saved picker bindings still take precedence. Runtime verification occurs at launch.
 * @param {readonly unknown[]} configurations Workspace launch configurations.
 * @param {string} root Owning workspace folder.
 * @returns {EmulatorRuntimeBinding | undefined} One complete runtime, or no implicit selection.
 */
export const runtimeBindingFromLaunch = (
  configurations: readonly unknown[],
  root: string,
): EmulatorRuntimeBinding | undefined => {
  const bindings = new Map<string, EmulatorRuntimeBinding>();
  for (const configuration of configurations) {
    if (!configuration || typeof configuration !== "object") continue;
    const config = configuration as Record<string, unknown>;
    if (
      config.type !== "uttori-asm" ||
      config.request !== "launch" ||
      (config.backend !== "ares" && config.backend !== "mesence")
    )
      continue;
    const resolve = (value: unknown): string | undefined => {
      if (typeof value !== "string" || !value.trim()) return undefined;
      const expanded = value.replaceAll("${workspaceFolder}", root);
      return expanded.includes("${") ? undefined : path.resolve(root, expanded);
    };
    const runtimeManifest = resolve(config.runtimeManifest);
    const emulator = resolve(config.emulator);
    const runtimeDirectory = resolve(config.runtimeDirectory);
    if (!runtimeManifest || !emulator || !runtimeDirectory) continue;
    const binding: EmulatorRuntimeBinding = {
      backend: config.backend,
      runtimeManifest,
      emulator,
      runtimeDirectory,
      ...(typeof config.aresSystem === "string" ? { aresSystem: config.aresSystem } : {}),
      ...(typeof config.fastBoot === "boolean" ? { fastBoot: config.fastBoot } : {}),
    };
    bindings.set(JSON.stringify(binding), binding);
  }
  return bindings.size === 1 ? [...bindings.values()][0] : undefined;
};
