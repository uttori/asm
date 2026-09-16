import { SnesSpcRuntimeService } from "../services/spc-runtime.js";
/**
 * Builds a session-bound SPC-block runtime.
 * A new instance per directive invocation is cheap; it holds no extra state.
 *
 * @param {Assembler} session Host assembler.
 * @param {SnesSessionState} state Mutable SNES session.
 * @returns {SnesSpcRuntimeService} Runtime used by `spcblock` / `endspcblock` / pass finalization.
 */
export const createSpcRuntime = (session, state) => new SnesSpcRuntimeService(session, state);
//# sourceMappingURL=spc.js.map