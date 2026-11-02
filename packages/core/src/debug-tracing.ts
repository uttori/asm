import type { AssemblyStageName } from "./plugin/contracts.js";
import type { SourceOrigin } from "./source-provenance.js";

/**
 * Per-byte write emitted after the logical address has been mapped to output.
 */
export type AssemblerTraceWriteEvent = {
  /** Discriminator selecting write versus command lifecycle events. */
  type: "write";
  /** Pipeline stage that performed the emission. */
  stage: AssemblyStageName;
  /** Active architecture name during the write. */
  arch: string;
  /** Source file path for the originating line. */
  file: string;
  /** One-based source line number for the write. */
  line: number;
  /** Unnormalized source text for the command. */
  raw: string;
  /** Normalized command text after preprocessing. */
  normalized: string;
  /** Source expansion chain for this emitted occurrence. */
  origin?: SourceOrigin;
  /** Target logical address before output mapping. */
  logicalAddress: number;
  /** Active target address width. Older callers default to 24-bit formatting. */
  addressWidth?: number;
  /** Zero-based offset in the output image for the written byte. */
  outputOffset: number;
  /** Emitted byte value at the mapped output offset. */
  value: number;
};

/**
 * High-level command lifecycle emitted around `processNormalizedCommand()`.
 * `command-start` captures the entry address, while `command-end` records the
 * final address span and total bytes written.
 */
export type AssemblerTraceCommandEvent = {
  /** Whether this event opens or closes command processing. */
  type: "command-start" | "command-end";
  /** Pipeline stage emitting the lifecycle marker. */
  stage: AssemblyStageName;
  /** Active architecture name for the command. */
  arch: string;
  /** Source file path for the originating line. */
  file: string;
  /** One-based source line number for the command. */
  line: number;
  /** Unnormalized source text for the command. */
  raw: string;
  /** Normalized command text after preprocessing. */
  normalized: string;
  /** Source expansion chain for this emitted occurrence. */
  origin?: SourceOrigin;
  /** Target logical address at command entry or exit. */
  logicalAddress: number;
  /** Active target address width. Older callers default to 24-bit formatting. */
  addressWidth?: number;
  /** Output offset corresponding to the logical address at this lifecycle point. */
  outputOffset: number;
  /** Logical address after the command completes; present on command-end events. */
  endLogicalAddress?: number;
  /** Output offset after the command completes; present on command-end events. */
  endOutputOffset?: number;
  /** Total bytes emitted for the command; present on command-end events. */
  bytesWritten?: number;
};

/** Union of per-byte writes and command lifecycle markers emitted during assembly. */
export type AssemblerTraceEvent = AssemblerTraceWriteEvent | AssemblerTraceCommandEvent;

/** Callback invoked synchronously for each trace event during an instrumented assembly pass. */
export type AssemblerTraceListener = (event: AssemblerTraceEvent) => void;
