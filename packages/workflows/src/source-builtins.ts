import type { SourceTargetDescriptor } from "@uttori/asm-disassembler/source-project";
import { nesSourceTarget } from "@uttori/asm-plugin-65xx/disassembler";
import { snesSourceTarget } from "@uttori/asm-plugin-snes/disassembler";
/** Executable defaults; the dispatcher accepts a host-owned descriptor registry. */
export const builtinSourceTargets: readonly SourceTargetDescriptor[] = [
  snesSourceTarget,
  nesSourceTarget,
];
