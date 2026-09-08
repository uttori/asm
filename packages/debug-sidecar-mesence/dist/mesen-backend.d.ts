import { type DebugAddress, type DebugBackend, type DebugBackendConnectOptions, type DebugBackendEvent, type DebugBreakpoint, type DebugInstruction, type DebugMemoryRead, type DebugRegister, type DebugStackFrame, type DebugStepKind, type DebugSubscription, type DebugThread, type DebugTraceBatch, type DebugTraceStartOptions } from "@uttori/asm-debug-adapter";
export * from "./profile.js";
/** Small client seam implemented by the framed loopback transport and deterministic tests. */
export interface MesenDebugClient {
    readonly closed: boolean;
    request(method: string, parameters?: Readonly<Record<string, unknown>>): Promise<unknown>;
    close(): Promise<void>;
    onClose(listener: (error?: Error) => void): DebugSubscription;
}
/** Native-client and process hooks owned by the eventual MesenCE sidecar executable. */
export interface MesenDebugBackendOptions {
    readonly createClient: (options: DebugBackendConnectOptions) => MesenDebugClient | Promise<MesenDebugClient>;
    readonly terminate?: () => Promise<void>;
    readonly pollIntervalMs?: number;
}
/** Clean-room translator from the bounded MesenCE debug-server contract to `DebugBackend`. */
export declare class MesenDebugBackend implements DebugBackend {
    #private;
    readonly protocolVersion: 1;
    readonly capabilities: Readonly<import("@uttori/asm-debug-adapter").DebugBackendCapabilities>;
    /** @param {MesenDebugBackendOptions} options Native client and process lifecycle hooks. */
    constructor(options: MesenDebugBackendOptions);
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
    startTrace(_options: DebugTraceStartOptions): Promise<void>;
    /** @inheritdoc */
    readTrace(_maxEvents: number): Promise<DebugTraceBatch>;
    /** @inheritdoc */
    stopTrace(): Promise<void>;
    /** @inheritdoc */
    onEvent(listener: (event: DebugBackendEvent) => void): DebugSubscription;
}
//# sourceMappingURL=mesen-backend.d.ts.map