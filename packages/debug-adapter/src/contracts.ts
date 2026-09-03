/** Current emulator-neutral debugger backend protocol. */
export const DEBUG_BACKEND_PROTOCOL_VERSION = 1 as const;

/** Architecture-qualified address that cannot be confused with another processor's address. */
export interface DebugAddress {
  readonly architecture: string;
  readonly addressSpace: string;
  readonly address: number;
  /** Physical output offset when the logical address is a mirror of ROM content. */
  readonly outputOffset?: number;
}

/** Backend capabilities negotiated independently of DAP capabilities. */
export interface DebugBackendCapabilities {
  readonly pause: boolean;
  readonly step: boolean;
  readonly registers: boolean;
  readonly memory: boolean;
  readonly stackFrames: boolean;
  readonly breakpoints: boolean;
  readonly disassemble: boolean;
  readonly reconnect: boolean;
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
  readonly protocolVersion: typeof DEBUG_BACKEND_PROTOCOL_VERSION;
  readonly capabilities: DebugBackendCapabilities;
  connect(options?: DebugBackendConnectOptions): Promise<void>;
  disconnect(options?: { readonly terminate?: boolean }): Promise<void>;
  pause(threadId?: number): Promise<void>;
  continue(threadId?: number): Promise<void>;
  step(threadId: number, kind: DebugStepKind): Promise<void>;
  threads(): Promise<readonly DebugThread[]>;
  stackFrames(threadId: number): Promise<readonly DebugStackFrame[]>;
  registers(frameId: number): Promise<readonly DebugRegister[]>;
  readMemory(address: DebugAddress, count: number): Promise<DebugMemoryRead>;
  setBreakpoints(addresses: readonly DebugAddress[]): Promise<readonly DebugBreakpoint[]>;
  disassemble(address: DebugAddress, count: number): Promise<readonly DebugInstruction[]>;
  onEvent(listener: (event: DebugBackendEvent) => void): DebugSubscription;
}
