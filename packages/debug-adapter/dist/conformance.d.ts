import { type DebugAddress, type DebugBackend, type DebugExecutionCapabilities, type DebugMemorySpaceCapabilities } from "./contracts.js";
/** Frozen contract revision shared by replay and live-emulator backend tests. */
export declare const DEBUG_BACKEND_CONFORMANCE_VERSION: 1;
/** Stable scenario identifiers; emulator integrations must not replace them with private suites. */
export declare const DEBUG_BACKEND_CONFORMANCE_SCENARIOS: readonly ["protocol-and-capabilities", "connect-and-inspect", "exact-instruction-step", "continue-to-breakpoint", "reconnect-without-reset", "request-bounds"];
/** One architecture expected from capability negotiation. */
export interface DebugBackendConformanceArchitecture {
    readonly architecture: string;
    readonly addressSpaces: readonly string[];
    readonly memorySpaces: readonly DebugMemorySpaceCapabilities[];
    readonly capabilities: Partial<DebugExecutionCapabilities>;
}
/** Known program state used by every backend conformance run. */
export interface DebugBackendConformanceFixture {
    readonly architectures: readonly DebugBackendConformanceArchitecture[];
    readonly primaryArchitecture: string;
    readonly primaryAddressSpace: string;
    readonly initialAddress: DebugAddress;
    readonly steppedAddress: DebugAddress;
    readonly breakpointAddress: DebugAddress;
    readonly memoryAddress: DebugAddress;
    readonly memoryBytes: readonly number[];
    readonly requiredRegisters: readonly string[];
    readonly disassemblyAddress: DebugAddress;
    readonly disassemblyText: string;
}
/** Inputs for one reusable conformance run. */
export interface DebugBackendConformanceOptions {
    readonly backend: string;
    readonly createBackend: () => DebugBackend | Promise<DebugBackend>;
    readonly fixture: DebugBackendConformanceFixture;
    readonly timeoutMs?: number;
}
/** Deterministic result for one conformance scenario. */
export interface DebugBackendConformanceScenarioResult {
    readonly id: (typeof DEBUG_BACKEND_CONFORMANCE_SCENARIOS)[number];
    readonly status: "pass" | "fail";
    readonly error?: string;
}
/** Machine-readable result suitable for a backend revision manifest. */
export interface DebugBackendConformanceReport {
    readonly version: typeof DEBUG_BACKEND_CONFORMANCE_VERSION;
    readonly backend: string;
    readonly passed: boolean;
    readonly scenarios: readonly DebugBackendConformanceScenarioResult[];
}
/**
 * Runs the frozen backend contract with fresh instances so scenarios cannot leak emulator state.
 * @param {DebugBackendConformanceOptions} options Backend factory and known fixture state.
 * @returns {Promise<DebugBackendConformanceReport>} Deterministic pass/fail report.
 */
export declare const runDebugBackendConformance: (options: DebugBackendConformanceOptions) => Promise<DebugBackendConformanceReport>;
//# sourceMappingURL=conformance.d.ts.map