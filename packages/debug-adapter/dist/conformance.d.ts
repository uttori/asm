import { type DebugAddress, type DebugBackend, type DebugExecutionCapabilities, type DebugMemorySpaceCapabilities } from "./contracts.js";
/** Frozen contract revision shared by replay and live-emulator backend tests. */
export declare const DEBUG_BACKEND_CONFORMANCE_VERSION: 1;
/** Stable scenario identifiers. Emulator integrations must not replace them with private suites. */
export declare const DEBUG_BACKEND_CONFORMANCE_SCENARIOS: readonly ["protocol-and-capabilities", "connect-and-inspect", "exact-instruction-step", "continue-to-breakpoint", "reconnect-without-reset", "request-bounds"];
/** One architecture expected from capability negotiation. */
export interface DebugBackendConformanceArchitecture {
    /** Architecture identifier under test. */
    readonly architecture: string;
    /** Address spaces that must be advertised for this architecture. */
    readonly addressSpaces: readonly string[];
    /** Readable memory spaces and side-effect guarantees. */
    readonly memorySpaces: readonly DebugMemorySpaceCapabilities[];
    /** Execution features that must match exactly when present. */
    readonly capabilities: Partial<DebugExecutionCapabilities>;
}
/** Known program state used by every backend conformance run. */
export interface DebugBackendConformanceFixture {
    /** Expected capability entries for every emulated architecture. */
    readonly architectures: readonly DebugBackendConformanceArchitecture[];
    /** Architecture used for primary-thread scenarios. */
    readonly primaryArchitecture: string;
    /** Address space paired with the primary architecture. */
    readonly primaryAddressSpace: string;
    /** PC after connect with reset enabled. */
    readonly initialAddress: DebugAddress;
    /** PC after one instruction step on the primary thread. */
    readonly steppedAddress: DebugAddress;
    /** PC where an execute breakpoint must stop. */
    readonly breakpointAddress: DebugAddress;
    /** Address for the bounded memory read check. */
    readonly memoryAddress: DebugAddress;
    /** Expected bytes returned by the memory read check. */
    readonly memoryBytes: readonly number[];
    /** Register names that must exist on the initial frame. */
    readonly requiredRegisters: readonly string[];
    /** Address disassembled for text verification. */
    readonly disassemblyAddress: DebugAddress;
    /** Expected mnemonic text for disassemblyAddress. */
    readonly disassemblyText: string;
}
/** Inputs for one reusable conformance run. */
export interface DebugBackendConformanceOptions {
    /** Backend identifier recorded in the conformance report. */
    readonly backend: string;
    /** Factory that returns a fresh backend instance per scenario. */
    readonly createBackend: () => DebugBackend | Promise<DebugBackend>;
    /** Frozen addresses and bytes every scenario assumes. */
    readonly fixture: DebugBackendConformanceFixture;
    /** Per-operation timeout in milliseconds. */
    readonly timeoutMs?: number;
}
/** Deterministic result for one conformance scenario. */
export interface DebugBackendConformanceScenarioResult {
    /** Stable scenario identifier from DEBUG_BACKEND_CONFORMANCE_SCENARIOS. */
    readonly id: (typeof DEBUG_BACKEND_CONFORMANCE_SCENARIOS)[number];
    /** Pass or fail for this scenario only. */
    readonly status: "pass" | "fail";
    /** Failure message when status is fail. */
    readonly error?: string;
}
/** Machine-readable result suitable for a backend revision manifest. */
export interface DebugBackendConformanceReport {
    /** Conformance schema revision. */
    readonly version: typeof DEBUG_BACKEND_CONFORMANCE_VERSION;
    /** Backend identifier under test. */
    readonly backend: string;
    /** True only when every scenario passed. */
    readonly passed: boolean;
    /** Ordered scenario outcomes. */
    readonly scenarios: readonly DebugBackendConformanceScenarioResult[];
}
/**
 * Runs the frozen backend contract with fresh instances so scenarios cannot leak emulator state.
 * @param options Backend factory and known fixture state.
 * @returns Deterministic pass/fail report.
 */
export declare const runDebugBackendConformance: (options: DebugBackendConformanceOptions) => Promise<DebugBackendConformanceReport>;
//# sourceMappingURL=conformance.d.ts.map