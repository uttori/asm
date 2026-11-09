import type { AssemblerPlugin } from "@uttori/asm-core/plugin";
import type { SourceWorkflowHost } from "@uttori/asm-disassembler/source-project";
import type { SourceTargetDescriptor } from "./source-target.js";
export type { SourceWorkflowHost } from "@uttori/asm-disassembler/source-project";
/** Compose bundled plugins at the executable boundary. Registrations override built-ins by module ID. */
export declare function createSourceWorkflowHost(plugins?: Iterable<readonly [string, AssemblerPlugin]>, targets?: readonly SourceTargetDescriptor[]): SourceWorkflowHost;
/** Default host wiring bundled SNES and 65xx plugins for CLI and editor workers. */
export declare const defaultSourceHost: SourceWorkflowHost;
/**
 * Fingerprint the active Node toolchain and plugin modules for reproducible source builds.
 * @param plugins Resolved plugin module paths participating in the operation.
 * @returns SHA-256 toolchain identity.
 */
export declare function sourceToolchain(plugins: readonly string[]): import("@uttori/asm-plugin-loader-node").ToolchainFingerprint;
//# sourceMappingURL=source-host.d.ts.map