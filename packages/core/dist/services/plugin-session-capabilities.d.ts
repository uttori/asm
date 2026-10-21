import type { Assembler } from "../assembler.js";
import type { PluginSessionCapabilities } from "../plugin/session-capabilities.js";
/** Creates a closed capability surface. Every access checks the synchronous borrow, including nested methods. */
export declare function createPluginSessionCapabilities(session: Assembler, assertBorrowed: () => void): PluginSessionCapabilities;
//# sourceMappingURL=plugin-session-capabilities.d.ts.map