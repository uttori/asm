import type { Assembler } from "@uttori/asm-core";

import type { SnesSessionState } from "../session-state.js";
import { SnesSpcRuntimeService } from "../services/spc-runtime.js";

/**
 * Builds a session-bound SPC-block runtime.
 * A new instance per directive invocation is cheap; it holds no extra state.
 *
 * @param {Assembler} session Host assembler.
 * @param {SnesSessionState} state Mutable SNES session.
 * @returns {SnesSpcRuntimeService} Runtime used by `spcblock` / `endspcblock` / pass finalization.
 */
export const createSpcRuntime = (
  session: Assembler,
  state: SnesSessionState,
): SnesSpcRuntimeService => new SnesSpcRuntimeService(session, state);
