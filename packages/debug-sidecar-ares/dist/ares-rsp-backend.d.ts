import { type CaptureRequestV2, type CaptureResultV2 } from "@uttori/asm-capture";
import { type DebugAddress, type DebugBackend, type DebugBackendConnectOptions, type DebugBackendEvent, type DebugBreakpoint, type DebugInstruction, type DebugMemoryRead, type DebugRegister, type DebugStackFrame, type DebugStepKind, type DebugSubscription, type DebugThread, type DebugTraceBatch, type DebugTraceStartOptions } from "@uttori/asm-debug-adapter";
import type { GdbRspClient, GdbRspStop } from "./gdb-rsp-client.js";
import { ARES_RSP_CAPABILITIES } from "./profile.js";
export * from "./profile.js";
/** RSP operations consumed by the ares backend, abstracted for deterministic tests. */
export interface AresGdbRspClient {
    /** Whether the RSP session can accept further commands. */
    readonly closed: boolean;
    /** Completes the GDB handshake and enables command traffic. */
    start(): Promise<void>;
    /** Sends one RSP command and returns its response payload. */
    request(command: string): Promise<string>;
    /** Sends a command that may resolve as a stop notification instead of OK. */
    requestStop(command: string): Promise<string>;
    /** Resumes emulated execution until the next stop. */
    continue(): Promise<void>;
    /** Executes one emulated instruction step. */
    step(): Promise<void>;
    /** Sends the out-of-band interrupt byte to break into the emulator. */
    interrupt(): Promise<void>;
    /** Closes the RSP transport and rejects in-flight work. */
    close(): Promise<void>;
    /** Subscribes to asynchronous stop notifications from the stub. */
    onStop(listener: (event: GdbRspStop) => void): DebugSubscription;
    /** Subscribes to terminal transport failure. */
    onClose(listener: (error: Error) => void): DebugSubscription;
}
/** Process/session hooks supplied by the sidecar executable. */
export interface AresRspBackendOptions {
    /** Factory that connects an RSP client when connect runs. */
    readonly createClient: (options: DebugBackendConnectOptions) => AresGdbRspClient | GdbRspClient | Promise<AresGdbRspClient | GdbRspClient>;
    /** Optional hook to tear down the emulator process on disconnect. */
    readonly terminate?: () => Promise<void>;
    /** Wall-clock bound waiting for ares to acknowledge a stop. */
    readonly stopTimeoutMs?: number;
    /** Full-file start of PRG, including the iNES header and optional trainer; defaults to 16. */
    readonly nesPrgFileOffset?: number;
    /**
     * Set only by the manifest-verified local process host. Binds file provenance
     * and prevents native paths from being sent to an arbitrary remote RSP server.
     */
    readonly nativeFileIdentity?: {
        readonly romSha256: string;
        readonly romFileSha256?: string;
        readonly executableSha256: string;
        readonly producerRevision?: string;
    };
}
/** 65816 `DebugBackend` implemented over the maintained ares fork's private RSP channel. */
export declare class AresRspDebugBackend implements DebugBackend {
    #private;
    /** Fixed ares RSP backend protocol revision. */
    readonly protocolVersion: 1;
    /** Negotiated capabilities including NES mode and rich-trace overrides. */
    get capabilities(): typeof ARES_RSP_CAPABILITIES;
    /**
     * Wires RSP client creation and optional process termination hooks.
     * @param options RSP client and process lifecycle hooks.
     */
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
    /** @inheritdoc */
    startTrace(options: DebugTraceStartOptions): Promise<void>;
    /** @inheritdoc */
    readTrace(maxEvents: number): Promise<DebugTraceBatch>;
    /** @inheritdoc */
    stopTrace(): Promise<void>;
    /** @inheritdoc */
    onEvent(listener: (event: DebugBackendEvent) => void): DebugSubscription;
}
//# sourceMappingURL=ares-rsp-backend.d.ts.map