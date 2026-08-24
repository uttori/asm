import type { AssemblyStageName } from "./plugin/contracts.js";

/**
 * Per-byte write emitted after the logical address has been mapped to output.
 */
export type AssemblerTraceWriteEvent = {
  type: "write";
  stage: AssemblyStageName;
  arch: string;
  file: string;
  line: number;
  raw: string;
  normalized: string;
  logicalAddress: number;
  outputOffset: number;
  value: number;
};

/**
 * High-level command lifecycle emitted around `processNormalizedCommand()`.
 * `command-start` captures the entry address, while `command-end` records the
 * final address span and total bytes written.
 */
export type AssemblerTraceCommandEvent = {
  type: "command-start" | "command-end";
  stage: AssemblyStageName;
  arch: string;
  file: string;
  line: number;
  raw: string;
  normalized: string;
  logicalAddress: number;
  outputOffset: number;
  endLogicalAddress?: number;
  endOutputOffset?: number;
  bytesWritten?: number;
};

export type AssemblerTraceEvent = AssemblerTraceWriteEvent | AssemblerTraceCommandEvent;

export type AssemblerTraceListener = (event: AssemblerTraceEvent) => void;

export type TraceCollectorOptions = {
  /** Inclusive logical address range filter. */
  startAddress?: number;
  endAddress?: number;
  /** Substring match against the source file path. */
  fileIncludes?: string[];
  /** Restrict to a subset of event kinds. */
  eventTypes?: AssemblerTraceEvent["type"][];
  /** Restrict to a specific assembler stage. */
  stage?: AssemblyStageName;
  /** Restrict to a specific architecture label (for example `65816` or `spc700`). */
  arch?: string;
};

const toHex = (value: number, width: number): string =>
  value.toString(16).toUpperCase().padStart(width, "0");

/**
 * Returns `true` when an event overlaps the requested inclusive logical address range.
 * Command-end events use their full start/end span so range filters can catch
 * commands that write through the target window instead of only landing exactly on it.
 * @param {AssemblerTraceEvent} event The trace event to test.
 * @param {number} [startAddress] The inclusive range start.
 * @param {number} [endAddress] The inclusive range end.
 * @returns {boolean} `true` when the event touches the requested range.
 */
function eventTouchesRange(
  event: AssemblerTraceEvent,
  startAddress?: number,
  endAddress?: number,
): boolean {
  if (startAddress === undefined && endAddress === undefined) {
    return true;
  }

  const rangeStart = startAddress ?? Number.MIN_SAFE_INTEGER;
  const rangeEnd = endAddress ?? Number.MAX_SAFE_INTEGER;
  const eventStart = event.logicalAddress;
  const eventEnd =
    event.type === "command-end" && event.endLogicalAddress !== undefined
      ? event.endLogicalAddress
      : event.logicalAddress;
  return eventStart <= rangeEnd && eventEnd >= rangeStart;
}

/**
 * Applies all collector filters to a trace event.
 * @param {AssemblerTraceEvent} event The trace event to test.
 * @param {TraceCollectorOptions} options The collector filter options.
 * @returns {boolean} `true` when the event matches every configured filter.
 */
function matchesCollectorOptions(
  event: AssemblerTraceEvent,
  options: TraceCollectorOptions,
): boolean {
  if (!eventTouchesRange(event, options.startAddress, options.endAddress)) {
    return false;
  }
  if (options.stage !== undefined && event.stage !== options.stage) {
    return false;
  }
  if (options.arch !== undefined && event.arch !== options.arch) {
    return false;
  }
  if (options.eventTypes && !options.eventTypes.includes(event.type)) {
    return false;
  }
  if (
    options.fileIncludes &&
    options.fileIncludes.length > 0 &&
    !options.fileIncludes.some((filePart) => event.file.includes(filePart))
  ) {
    return false;
  }
  return true;
}

/**
 * Creates an in-memory listener that can be attached with
 * `assembler.setTraceListener(...)` during debugging scripts or tests.
 * @param {TraceCollectorOptions} options - The options for the trace collector.
 * @returns {{ events: AssemblerTraceEvent[]; listener: AssemblerTraceListener; clear(): void }} The trace collector.
 * @example
 * const collector = createTraceCollector({
 *   startAddress: 0x808000,
 *   endAddress: 0x808000,
 *   eventTypes: ["write", "command-start", "command-end"],
 * });
 * assembler.setTraceListener(collector.listener);
 */
export function createTraceCollector(options: TraceCollectorOptions = {}): {
  events: AssemblerTraceEvent[];
  listener: AssemblerTraceListener;
  clear(): void;
} {
  const events: AssemblerTraceEvent[] = [];
  return {
    events,
    listener: (event: AssemblerTraceEvent) => {
      if (matchesCollectorOptions(event, options)) {
        events.push({ ...event });
      }
    },
    clear: () => {
      events.length = 0;
    },
  };
}

/**
 * Formats a trace event as a single log-friendly line for ad-hoc debugging.
 * @param {AssemblerTraceEvent} event - The trace event to format.
 * @returns {string} The formatted trace event.
 */
export function formatTraceEvent(event: AssemblerTraceEvent): string {
  if (event.type === "write") {
    return [
      `stage=${event.stage}`,
      `arch=${event.arch}`,
      `addr=$${toHex(event.logicalAddress, 6)}`,
      `offset=$${toHex(event.outputOffset >>> 0, 6)}`,
      `value=$${toHex(event.value & 0xff, 2)}`,
      `${event.file}:${event.line}`,
      event.raw,
    ].join(" ");
  }

  const suffix =
    event.type === "command-end"
      ? ` end=$${toHex((event.endLogicalAddress ?? event.logicalAddress) & 0xffffff, 6)} bytes=${event.bytesWritten ?? 0}`
      : "";
  return [
    `stage=${event.stage}`,
    `arch=${event.arch}`,
    event.type,
    `addr=$${toHex(event.logicalAddress & 0xffffff, 6)}`,
    `${event.file}:${event.line}`,
    event.raw + suffix,
  ].join(" ");
}
