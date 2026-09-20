import { type DebugAddress, type DebugBackend, type DebugBackendCapabilities, type DebugBackendConnectOptions, type DebugBackendEvent, type DebugBreakpoint, type DebugInstruction, type DebugMemoryRead, type DebugRegister, type DebugStackFrame, type DebugStepKind, type DebugSubscription, type DebugThread, type DebugTraceBatch, type DebugTraceStartOptions } from "./contracts.js";
import { DebugSidecarClient } from "./sidecar-client.js";
/** Construction settings for one typed sidecar-backed debugger. */
export interface SidecarDebugBackendOptions {
    /** Expected backend ID returned by initialize. Other backend identities are rejected. */
    readonly backend: string;
    /** Exact expected capability profile, checked before any execution requests are accepted. */
    readonly capabilities: DebugBackendCapabilities;
    /** Creates a fresh owned client initially and after a crash or terminating disconnect. */
    readonly createClient: () => DebugSidecarClient | Promise<DebugSidecarClient>;
}
/** Typed `DebugBackend` implementation over the authenticated sidecar client. */
export declare class SidecarDebugBackend implements DebugBackend {
    #private;
    readonly protocolVersion: 1;
    get capabilities(): DebugBackendCapabilities;
    /**
     * Creates a backend with capabilities declared before DAP initialization and verified on connect.
     * @param {SidecarDebugBackendOptions} options Sidecar identity, capability manifest, and factory.
     */
    constructor(options: SidecarDebugBackendOptions);
    /** @inheritdoc */
    connect(options?: DebugBackendConnectOptions): Promise<void>;
    /** @inheritdoc */
    disconnect(options?: {
        readonly terminate?: boolean;
    }): Promise<void>;
    /** @inheritdoc */
    pause(threadId?: number): Promise<void>;
    /** @inheritdoc */
    continue(threadId?: number): Promise<void>;
    /** @inheritdoc */
    step(threadId: number, kind: DebugStepKind): Promise<void>;
    /** @inheritdoc */
    threads(): Promise<readonly DebugThread[]>;
    /** @inheritdoc */
    stackFrames(threadId: number): Promise<readonly DebugStackFrame[]>;
    /** @inheritdoc */
    registers(frameId: number): Promise<readonly DebugRegister[]>;
    /** @inheritdoc */
    readMemory(requestedAddress: DebugAddress, count: number): Promise<DebugMemoryRead>;
    /** @inheritdoc */
    setBreakpoints(addresses: readonly DebugAddress[]): Promise<readonly DebugBreakpoint[]>;
    /** @inheritdoc */
    disassemble(requestedAddress: DebugAddress, count: number): Promise<readonly DebugInstruction[]>;
    /** @inheritdoc */
    capture(request: CaptureRequestV2): Promise<CaptureResultV2>;
    startTrace(options: DebugTraceStartOptions): Promise<void>;
    /** @inheritdoc */
    readTrace(maxEvents: number): Promise<DebugTraceBatch>;
    /** @inheritdoc */
    stopTrace(): Promise<void>;
    /** @inheritdoc */
    onEvent(listener: (event: DebugBackendEvent) => void): DebugSubscription;
}
import { type CaptureRequestV2, type CaptureResultV2 } from "./capture-v2.js";
//# sourceMappingURL=sidecar-backend.d.ts.map