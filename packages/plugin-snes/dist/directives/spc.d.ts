import type { PluginSessionCapabilities } from "@uttori/asm-core/plugin";
import { SnesSpcRuntimeService } from "../services/spc-runtime.js";
import type { SnesSessionState } from "../session-state.js";
/**
 * Builds a session-bound SPC-block runtime.
 * A new instance per directive invocation is cheap. It holds no extra state.
 *
 * @param {PluginSessionCapabilities} session Host assembler.
 * @param {SnesSessionState} state Mutable SNES session.
 * @returns {SnesSpcRuntimeService} Runtime used by `spcblock` / `endspcblock` / pass finalization.
 */
export declare const createSpcRuntime: (session: PluginSessionCapabilities, state: SnesSessionState) => SnesSpcRuntimeService;
//# sourceMappingURL=spc.d.ts.map