import { SnesSpcRuntimeService } from "../services/spc-runtime.js";
/**
 * Builds a session-bound SPC-block runtime.
 * A new instance per directive invocation is cheap. It holds no extra state.
 *
 * @param {PluginSessionCapabilities} session Host assembler.
 * @param {SnesSessionState} state Mutable SNES session.
 * @returns {SnesSpcRuntimeService} Runtime used by `spcblock` / `endspcblock` / pass finalization.
 */
export const createSpcRuntime = (session, state) => new SnesSpcRuntimeService(session, state);
//# sourceMappingURL=spc.js.map