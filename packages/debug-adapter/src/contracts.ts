import type {
  CaptureInstructionDetail,
  CaptureRequestV2,
  CaptureResultV2,
} from "@uttori/asm-capture";
/** Current emulator-neutral debugger backend protocol. */
export const DEBUG_BACKEND_PROTOCOL_VERSION = 1 as const;

/** Architecture-qualified address that cannot be confused with another processor's address. */
export interface DebugAddress {
  /** Processor or ISA identifier naming the owning architecture. */
  readonly architecture: string;
  /** Logical memory or I/O space within that architecture. */
  readonly addressSpace: string;
  /** Nonnegative integer in the named space. Equal numbers in different spaces are unrelated. */
  readonly address: number;
  /** Physical output offset when the logical address is a mirror of ROM content. */
  readonly outputOffset?: number;
}

/** Operations that may be supported globally or for one architecture. */
export interface DebugExecutionCapabilities {
  /** Whether execution may be paused while stopped inspection is supported. */
  readonly pause: boolean;
  /** Whether any step granularity is available. */
  readonly step: boolean;
  /** Exact supported step semantics; empty when stepping is unavailable. */
  readonly stepKinds: readonly DebugStepKind[];
  /** Whether register reads are available for stopped frames. */
  readonly registers: boolean;
  /** Whether bounded memory reads are available while stopped. */
  readonly memory: boolean;
  /** Whether stack frames may be enumerated for a thread. */
  readonly stackFrames: boolean;
  /** Whether execute breakpoints may be installed. */
  readonly breakpoints: boolean;
  /** Whether virtual disassembly is available for mapped addresses. */
  readonly disassemble: boolean;
}

/** One address space accepted by `readMemory`, including its observable-read guarantee. */
export interface DebugMemorySpaceCapabilities {
  /** Address space identifier accepted by memory reads. */
  readonly addressSpace: string;
  /** True when reads do not advance emulation or trigger side effects. */
  readonly sideEffectFree: boolean;
}

/** Bounded pull-based instruction tracing available for one architecture. */
export interface DebugTraceCapabilities {
  /** Address spaces whose instruction PCs may be captured. */
  readonly addressSpaces: readonly string[];
  /** Maximum instruction addresses retained by the producer before oldest-first loss. */
  readonly maxBufferedEvents: number;
  /** Maximum instruction addresses returned by one pull. */
  readonly maxBatchEvents: number;
  /** Whether execution-time bytes/state and bus accesses are available; false means PC-only. */
  readonly instructionDetails: boolean;
}

/** Explicit operations and address spaces available for one emulated processor architecture. */
export interface DebugArchitectureCapabilities extends DebugExecutionCapabilities {
  /** Architecture identifier matching thread and address fields. */
  readonly architecture: string;
  /** Address spaces referenced by this architecture's PCs and memory. */
  readonly addressSpaces: readonly string[];
  /** Readable spaces. Address spaces omitted here must be rejected by `readMemory`. */
  readonly memorySpaces: readonly DebugMemorySpaceCapabilities[];
  /** `null` explicitly reports that this architecture cannot capture instruction traces. */
  readonly trace: DebugTraceCapabilities | null;
}

/** Backend capabilities negotiated independently of DAP capabilities. */
export interface DebugBackendCapabilities extends DebugExecutionCapabilities {
  /** Whether disconnect may retain a sidecar and later reconnect without reset. */
  readonly reconnect: boolean;
  /** Per-architecture capability overrides and address-space declarations. */
  readonly architectures: readonly DebugArchitectureCapabilities[];
}

/** One emulated execution thread or processor. */
export interface DebugThread {
  /** Stable thread identifier used by pause, continue, and step requests. */
  readonly id: number;
  /** Human-readable label shown in the debugger UI. */
  readonly name: string;
  /** Architecture owning this thread's registers and address spaces. */
  readonly architecture: string;
}

/** One stack frame with an architecture-qualified program counter. */
export interface DebugStackFrame {
  /** Frame identifier used for register and expression evaluation. */
  readonly id: number;
  /** Thread that owns this frame. */
  readonly threadId: number;
  /** Display name, often a symbol or synthetic label. */
  readonly name: string;
  /** Stopped program counter for this frame. */
  readonly pc: DebugAddress;
  /** True when the backend can expose only the current PC, not an unwound call stack. */
  readonly currentOnly?: boolean;
}

/** Register value represented losslessly as an unsigned hexadecimal string. */
export interface DebugRegister {
  /** Register name as reported by the backend. */
  readonly name: string;
  /** Unsigned hexadecimal magnitude without a radix prefix. */
  readonly value: string;
  /** Width in bits for masking and display. */
  readonly bits: number;
  /** Optional grouping hint for UI layout. */
  readonly group?: string;
}

/** Result of a memory read, including bytes unavailable from the backend. */
export interface DebugMemoryRead {
  /** Address of the first returned byte. */
  readonly address: DebugAddress;
  /** Successfully read bytes in ascending address order. */
  readonly bytes: Uint8Array;
  /** Count of requested bytes the backend could not supply. */
  readonly unreadableBytes: number;
}

/** Backend breakpoint verification result. */
export interface DebugBreakpoint {
  /** Backend-assigned breakpoint identifier. */
  readonly id: number;
  /** Installed or attempted address. */
  readonly address: DebugAddress;
  /** Whether the breakpoint is active at the requested location. */
  readonly verified: boolean;
  /** Optional failure or relocation explanation when verification fails. */
  readonly message?: string;
}

/** One instruction returned for a virtual disassembly source. */
export interface DebugInstruction {
  /** Address of the first instruction byte. */
  readonly address: DebugAddress;
  /** Raw opcode and operand bytes when available. */
  readonly bytes: readonly number[];
  /** Mnemonic text suitable for display. */
  readonly text: string;
  /** Optional symbol name covering this address. */
  readonly symbol?: string;
}

/** Selects one architecture-qualified instruction stream for an explicit recording session. */
export interface DebugTraceStartOptions {
  /** PC-only versus full instruction-detail capture. */
  readonly detail?: "pc" | "full";
  /** Architecture whose instruction stream is recorded. */
  readonly architecture: string;
  /** Address space whose PCs are traced. */
  readonly addressSpace: string;
}

/** Execution-time instruction evidence shared with offline capture consumers. */
export type DebugTraceInstructionDetail = CaptureInstructionDetail;

/** Destructive producer pull. Sequence gaps and cumulative loss remain visible to the recorder. */
export interface DebugTraceBatch {
  /** Per-instruction detail aligned with `addresses` when instruction details are enabled. */
  readonly details?: readonly DebugTraceInstructionDetail[];
  /** Bus accesses that could not be attributed to a specific instruction in this batch. */
  readonly unattributedMemoryAccesses?: number;
  /** Architecture that produced this batch. */
  readonly architecture: string;
  /** Address space of every address in the batch. */
  readonly addressSpace: string;
  /** Sequence of the first returned address, or the next producer sequence when empty. */
  readonly sequenceStart: number;
  /** Ordered instruction PCs pulled from the producer buffer. */
  readonly addresses: readonly number[];
  /** Cumulative oldest-first events discarded by the producer during this recording. */
  readonly droppedEvents: number;
  /** Whether the producer is still recording after this pull. */
  readonly active: boolean;
}

/** Why execution stopped at a replay or live backend boundary. */
export type DebugStopReason = "entry" | "pause" | "step" | "breakpoint" | "exception";

/** Events emitted by every backend implementation. */
export type DebugBackendEvent =
  | { readonly type: "stopped"; readonly reason: DebugStopReason; readonly threadId: number }
  | { readonly type: "continued"; readonly threadId: number; readonly allThreads: boolean }
  | { readonly type: "terminated"; readonly restart: boolean }
  | { readonly type: "breakpoint"; readonly breakpoint: DebugBreakpoint }
  | {
      readonly type: "output";
      readonly category: "console" | "stdout" | "stderr";
      readonly text: string;
    };

/** Options common to initial attachment and reconnect. */
export interface DebugBackendConnectOptions {
  /** Reset execution to the first state. Reconnects may opt out. */
  readonly reset?: boolean;
}

/** Step granularity requested by a protocol adapter. */
export type DebugStepKind = "instruction" | "over" | "in" | "out";

/** Disposable event subscription without a dependency on editor APIs. */
export interface DebugSubscription {
  /** Releases the listener and stops further delivery. */
  dispose(): void;
}

/**
 * Versioned contract implemented by replay and live emulator integrations.
 * No emulator- or editor-specific type may cross this boundary.
 */
export interface DebugBackend {
  /** Optional versioned, acknowledged capture transport. Unsupported requests fail. */
  capture?(request: CaptureRequestV2): Promise<CaptureResultV2>;
  /** Negotiated backend protocol revision. */
  readonly protocolVersion: typeof DEBUG_BACKEND_PROTOCOL_VERSION;
  /** Capability surface advertised before connect. */
  readonly capabilities: DebugBackendCapabilities;
  /** Attach before execution or inspection. reset defaults to true, including on reconnect. */
  connect(options?: DebugBackendConnectOptions): Promise<void>;
  /** Detach and terminate by default. Pass terminate: false to retain a sidecar for reconnect. */
  disconnect(options?: { readonly terminate?: boolean }): Promise<void>;
  /** Pause one thread or all threads when threadId is omitted. */
  pause(threadId?: number): Promise<void>;
  /** Resume one thread or all threads when threadId is omitted. */
  continue(threadId?: number): Promise<void>;
  /** Advance execution by the requested step kind on one thread. */
  step(threadId: number, kind: DebugStepKind): Promise<void>;
  /** List active emulated threads. */
  threads(): Promise<readonly DebugThread[]>;
  /** Return stack frames for a stopped thread. */
  stackFrames(threadId: number): Promise<readonly DebugStackFrame[]>;
  /** Return registers visible at a stopped frame. */
  registers(frameId: number): Promise<readonly DebugRegister[]>;
  /** Read a bounded byte count from an explicitly readable space while stopped. Does not run the CPU. */
  readMemory(address: DebugAddress, count: number): Promise<DebugMemoryRead>;
  /** Replace the complete execute-breakpoint set. Empty input clears it. Inspect each verification result. */
  setBreakpoints(addresses: readonly DebugAddress[]): Promise<readonly DebugBreakpoint[]>;
  /** Disassemble up to count instructions beginning at address. */
  disassemble(address: DebugAddress, count: number): Promise<readonly DebugInstruction[]>;
  /** Starts a new explicit trace recording and discards any prior buffered trace. */
  startTrace(options: DebugTraceStartOptions): Promise<void>;
  /** Destructively pulls at most `maxEvents` ordered instruction addresses. */
  readTrace(maxEvents: number): Promise<DebugTraceBatch>;
  /** Stops capture without discarding events that have not yet been pulled. */
  stopTrace(): Promise<void>;
  /** Subscribe before connect to observe entry events. Dispose the subscription and do not throw in listeners. */
  onEvent(listener: (event: DebugBackendEvent) => void): DebugSubscription;
}
