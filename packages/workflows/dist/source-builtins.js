import { nesSourceTarget } from "@uttori/asm-plugin-65xx/disassembler";
import { snesSourceTarget } from "@uttori/asm-plugin-snes/disassembler";
/** Executable defaults; the dispatcher accepts a host-owned descriptor registry. */
export const builtinSourceTargets = [
    snesSourceTarget,
    nesSourceTarget,
];
//# sourceMappingURL=source-builtins.js.map