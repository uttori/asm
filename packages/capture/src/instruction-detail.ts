/** Bytes and state captured at execution time for the address at the same batch index. */
export interface CaptureInstructionDetail {
  /** Opcode and operand bytes fetched for the instruction. */
  readonly bytes: readonly number[];
  /** Target-owned scalar state keyed by register or mapper field name. */
  readonly state: Readonly<Record<string, string | number | boolean>>;
  /** Count of bus accesses dropped when the recorder exceeded its retention budget. */
  readonly droppedMemoryAccesses?: number;
  /** Optional ordered bus observations tied to the same instruction index. */
  readonly memoryAccesses?: readonly {
    /** Address-space identifier for the access. */
    readonly addressSpace: string;
    /** Logical address within the space. */
    readonly address: number;
    /** Bus operation kind. */
    readonly access: "read" | "write" | "fetch";
    /** Access width in bytes. */
    readonly width: number;
    /** Data value when the recorder captured one. */
    readonly value?: number;
    /** Initiator when the recorder attributed the access. */
    readonly actor?: "cpu" | "dma" | "hdma";
    /** HDMA channel index when actor is HDMA. */
    readonly channel?: number;
  }[];
}
