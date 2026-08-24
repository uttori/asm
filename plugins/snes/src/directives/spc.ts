import type { Assembler } from "@uttori/asm-core";

import type { SnesSessionState } from "../session-state.js";
import { SnesSpcRuntimeService } from "../services/spc-runtime.js";

export const createSpcRuntime = (
  session: Assembler,
  state: SnesSessionState,
): SnesSpcRuntimeService => new SnesSpcRuntimeService(session, state);
