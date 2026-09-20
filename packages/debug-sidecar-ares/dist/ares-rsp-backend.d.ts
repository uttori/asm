import { type DebugAddress, type DebugBackend, type DebugBackendConnectOptions, type DebugBackendEvent, type DebugBreakpoint, type DebugInstruction, type DebugMemoryRead, type DebugRegister, type DebugStackFrame, type DebugStepKind, type DebugSubscription, type DebugThread, type DebugTraceBatch, type DebugTraceStartOptions, type CaptureRequestV2, type CaptureResultV2 } from "@uttori/asm-debug-adapter";
import type { GdbRspClient, GdbRspStop } from "./gdb-rsp-client.js";
import { ARES_RSP_CAPABILITIES } from "./profile.js";
export * from "./profile.js";
/** RSP operations consumed by the ares backend, abstracted for deterministic tests. */
export interface AresGdbRspClient {
    readonly closed: boolean;
    start(): Promise<void>;
    request(command: string): Promise<string>;
    requestStop(command: string): Promise<string>;
    continue(): Promise<void>;
    step(): Promise<void>;
    interrupt(): Promise<void>;
    close(): Promise<void>;
    onStop(listener: (event: GdbRspStop) => void): DebugSubscription;
    onClose(listener: (error: Error) => void): DebugSubscription;
}
/** Process/session hooks supplied by the sidecar executable. */
export interface AresRspBackendOptions {
    readonly createClient: (options: DebugBackendConnectOptions) => AresGdbRspClient | GdbRspClient | Promise<AresGdbRspClient | GdbRspClient>;
    readonly terminate?: () => Promise<void>;
    readonly stopTimeoutMs?: number;
    /** Set only by the manifest-verified local process host. Binds file provenance
     * and prevents native paths from being sent to an arbitrary remote RSP server. */
    readonly nativeFileIdentity?: {
        readonly romSha256: string;
        readonly executableSha256: string;
        readonly producerRevision?: string;
    };
}
/** 65816 `DebugBackend` implemented over the maintained ares fork's private RSP channel. */
export declare class AresRspDebugBackend implements DebugBackend {
    #private;
    readonly protocolVersion: 1;
    get capabilities(): typeof ARES_RSP_CAPABILITIES;
    /** @param {AresRspBackendOptions} options RSP client/process lifecycle hooks. */
    constructor(options: AresRspBackendOptions);
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
    readMemory(address: DebugAddress, count: number): Promise<DebugMemoryRead>;
    /** @inheritdoc */
    setBreakpoints(addresses: readonly DebugAddress[]): Promise<readonly DebugBreakpoint[]>;
    /** @inheritdoc */
    disassemble(address: DebugAddress, count: number): Promise<readonly DebugInstruction[]>;
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
//# sourceMappingURL=ares-rsp-backend.d.ts.map