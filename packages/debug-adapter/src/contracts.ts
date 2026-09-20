/** Current emulator-neutral debugger backend protocol. */
export const DEBUG_BACKEND_PROTOCOL_VERSION = 1 as const;

import type { CaptureRequestV2, CaptureResultV2 } from "./capture-v2.js";

/** Architecture-qualified address that cannot be confused with another processor's address. */
export interface DebugAddress {
  readonly architecture: string;
  readonly addressSpace: string;
  /** Nonnegative integer in the named space. Equal numbers in different spaces are unrelated. */
  readonly address: number;
  /** Physical output offset when the logical address is a mirror of ROM content. */
  readonly outputOffset?: number;
}

/** Operations that may be supported globally or for one architecture. */
export interface DebugExecutionCapabilities {
  readonly pause: boolean;
  readonly step: boolean;
  /** Exact step semantics. Omitted by protocol-v1 peers means all legacy kinds. */
  readonly stepKinds?: readonly DebugStepKind[];
  readonly registers: boolean;
  readonly memory: boolean;
  readonly stackFrames: boolean;
  readonly breakpoints: boolean;
  readonly disassemble: boolean;
}

/** One address space accepted by `readMemory`, including its observable-read guarantee. */
export interface DebugMemorySpaceCapabilities {
  readonly addressSpace: string;
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
  /** Optional execution-time bytes/state and bus accesses. Absent means PC-only. */
  readonly instructionDetails?: boolean;
}

/** Explicit operations and address spaces available for one emulated processor architecture. */
export interface DebugArchitectureCapabilities extends DebugExecutionCapabilities {
  readonly architecture: string;
  readonly addressSpaces: readonly string[];
  /** Readable spaces. Address spaces omitted here must be rejected by `readMemory`. */
  readonly memorySpaces: readonly DebugMemorySpaceCapabilities[];
  /** `null` explicitly reports that this architecture cannot capture instruction traces. */
  readonly trace: DebugTraceCapabilities | null;
}

/** Backend capabilities negotiated independently of DAP capabilities. */
export interface DebugBackendCapabilities extends DebugExecutionCapabilities {
  readonly reconnect: boolean;
  readonly architectures: readonly DebugArchitectureCapabilities[];
}

/** One emulated execution thread or processor. */
export interface DebugThread {
  readonly id: number;
  readonly name: string;
  readonly architecture: string;
}

/** One stack frame with an architecture-qualified program counter. */
export interface DebugStackFrame {
  readonly id: number;
  readonly threadId: number;
  readonly name: string;
  readonly pc: DebugAddress;
  /** True when the backend can expose only the current PC, not an unwound call stack. */
  readonly currentOnly?: boolean;
}

/** Register value represented losslessly as an unsigned hexadecimal string. */
export interface DebugRegister {
  readonly name: string;
  readonly value: string;
  readonly bits: number;
  readonly group?: string;
}

/** Result of a memory read, including bytes unavailable from the backend. */
export interface DebugMemoryRead {
  readonly address: DebugAddress;
  readonly bytes: Uint8Array;
  readonly unreadableBytes: number;
}

/** Backend breakpoint verification result. */
export interface DebugBreakpoint {
  readonly id: number;
  readonly address: DebugAddress;
  readonly verified: boolean;
  readonly message?: string;
}

/** One instruction returned for a virtual disassembly source. */
export interface DebugInstruction {
  readonly address: DebugAddress;
  readonly bytes: readonly number[];
  readonly text: string;
  readonly symbol?: string;
}

/** Selects one architecture-qualified instruction stream for an explicit recording session. */
export interface DebugTraceStartOptions {
  readonly detail?: "pc" | "full";
  readonly architecture: string;
  readonly addressSpace: string;
}

/** Bytes and state captured at execution time for the address at the same batch index. */
export interface DebugTraceInstructionDetail {
  readonly bytes: readonly number[];
  readonly state: Readonly<Record<string, string | number | boolean>>;
  readonly droppedMemoryAccesses?: number;
  readonly memoryAccesses?: readonly {
    readonly addressSpace: string;
    readonly address: number;
    readonly access: "read" | "write" | "fetch";
    readonly width: number;
    readonly value?: number;
    readonly actor?: "cpu" | "dma" | "hdma";
    readonly channel?: number;
  }[];
}

/** Destructive producer pull. Sequence gaps and cumulative loss remain visible to the recorder. */
export interface DebugTraceBatch {
  readonly details?: readonly DebugTraceInstructionDetail[];
  readonly unattributedMemoryAccesses?: number;
  readonly architecture: string;
  readonly addressSpace: string;
  /** Sequence of the first returned address, or the next producer sequence when empty. */
  readonly sequenceStart: number;
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
  dispose(): void;
}

/**
 * Versioned contract implemented by replay and live emulator integrations.
 * No emulator- or editor-specific type may cross this boundary.
 */
export interface DebugBackend {
  /** Optional versioned, acknowledged capture transport. Unsupported requests fail. */
  capture?(request: CaptureRequestV2): Promise<CaptureResultV2>;
  readonly protocolVersion: typeof DEBUG_BACKEND_PROTOCOL_VERSION;
  readonly capabilities: DebugBackendCapabilities;
  /** Attach before execution or inspection. reset defaults to true, including on reconnect. */
  connect(options?: DebugBackendConnectOptions): Promise<void>;
  /** Detach and terminate by default. Pass terminate: false to retain a sidecar for reconnect. */
  disconnect(options?: { readonly terminate?: boolean }): Promise<void>;
  pause(threadId?: number): Promise<void>;
  continue(threadId?: number): Promise<void>;
  step(threadId: number, kind: DebugStepKind): Promise<void>;
  threads(): Promise<readonly DebugThread[]>;
  stackFrames(threadId: number): Promise<readonly DebugStackFrame[]>;
  registers(frameId: number): Promise<readonly DebugRegister[]>;
  /** Read a bounded byte count from an explicitly readable space while stopped. Does not run the CPU. */
  readMemory(address: DebugAddress, count: number): Promise<DebugMemoryRead>;
  /** Replace the complete execute-breakpoint set. Empty input clears it. Inspect each verification result. */
  setBreakpoints(addresses: readonly DebugAddress[]): Promise<readonly DebugBreakpoint[]>;
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
