import type { AssemblerPlugin } from "@uttori/asm-core/plugin";
import somPlugin from "@uttori/asm-game-secret-of-mana";
import plugin65xx from "@uttori/asm-plugin-65xx";
import snesPlugin, { SNES_TARGET_ID } from "@uttori/asm-plugin-snes";

/** Protocol and indexing processes activate the same explicit host contributions. */
export const bundledProjectOptions = {
  bundledPlugins: new Map<string, AssemblerPlugin>([
    ["@uttori/asm-game-secret-of-mana", somPlugin],
    ["@uttori/asm-plugin-snes", snesPlugin],
    ["@uttori/asm-plugin-65xx", plugin65xx],
  ]),
  activateBundledPlugins: true,
  defaults: {
    plugins: [{ module: "@uttori/asm-plugin-snes" }],
    target: SNES_TARGET_ID,
    includePaths: ["./"],
  },
};
