import type { AssemblerPlugin } from "@uttori/asm-core/plugin";
import type { SourceWorkflowHost } from "@uttori/asm-disassembler/source-project";
import type { SourceTargetDescriptor } from "./source-target.js";
export type { SourceWorkflowHost } from "@uttori/asm-disassembler/source-project";
/** Compose bundled plugins at the executable boundary. Registrations override built-ins by module ID. */
export declare function createSourceWorkflowHost(plugins?: Iterable<readonly [string, AssemblerPlugin]>, targets?: readonly SourceTargetDescriptor[]): SourceWorkflowHost;
export declare const defaultSourceHost: SourceWorkflowHost;
export declare function sourceToolchain(plugins: readonly string[]): import("@uttori/asm-plugin-loader-node").ToolchainFingerprint;
//# sourceMappingURL=source-host.d.ts.map