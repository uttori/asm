import type { RuntimeBusAccess } from "./runtime-bus-types.js";

/** Native channel snapshot, without inferring the CPU writes that configured it. */
export interface RuntimeTransferConfiguration {
  /** Mode bits 0–2; fixed/decrement bits 3/4; indirect bit 6; B-to-A direction bit 7. */
  readonly dmap: number;
  /** B-bus base port offset in [0, 255], before transfer-mode offsets. */
  readonly bbad: number;
  /** Bank-local 16-bit A-bus source address. */
  readonly a1t: number;
  /** A-bus source bank in [0, 255]. */
  readonly a1b: number;
  /** DMA byte count (zero means 65,536), or the shared HDMA indirect address. */
  readonly das: number;
  /** HDMA indirect bank in [0, 255]. */
  readonly dasb: number;
  /** Bank-local 16-bit HDMA table address. */
  readonly a2a: number;
  /** Raw HDMA line counter and repeat flag. */
  readonly ntlr: number;
  /** Bits 0–3: DMA enabled, HDMA enabled, HDMA completed, HDMA do-transfer. */
  readonly flags: number;
}
/** Marker for a DMA channel run or an HDMA payload burst, interleaved with actual bus accesses. */
export interface RuntimeTransferBoundary extends Pick<
  RuntimeBusAccess,
  "sequence" | "ordinal" | "cycle" | "pc" | "context" | "hcounter" | "vcounter"
> {
  readonly kind: "transfer";
  /** Begin event sequence, or zero on an end whose begin was outside this capture session. */
  readonly transferId: string;
  readonly boundary: "begin" | "complete" | "interrupted";
  readonly actor: "dma" | "hdma";
  readonly channel: number;
  /** Attempted byte slots, including suppressed bus operations; zero on begin markers. */
  readonly transferred: number;
  readonly configuration: RuntimeTransferConfiguration;
}
export type RuntimeTransferStatus =
  | "complete"
  | "interrupted"
  | "leading-partial"
  | "trailing-partial"
  | "both-partial";

/** One observed window; a missing marker remains explicit rather than implying a full transfer. */
export interface RuntimeTransferWindow {
  readonly actor: "dma" | "hdma";
  readonly channel: number;
  readonly status: RuntimeTransferStatus;
  readonly begin?: RuntimeTransferBoundary;
  readonly end?: RuntimeTransferBoundary;
  readonly reads: number;
  readonly writes: number;
}
/** At most sixteen actor/channel totals. Attempted slots include only runs with both markers. */
export interface RuntimeTransferActivity {
  readonly actor: "dma" | "hdma";
  readonly channel: number;
  complete: number;
  interrupted: number;
  leadingPartial: number;
  trailingPartial: number;
  bothPartial: number;
  attemptedSlots: number;
  reads: number;
  writes: number;
}
/** All windows contribute to totals; only the first 64 finished windows are materialized for display. */
export interface RuntimeTransferSummary {
  readonly activity: readonly RuntimeTransferActivity[];
  readonly windows: readonly RuntimeTransferWindow[];
  readonly omittedWindows: number;
}

/** Normalize boundary fields for deterministic hashing; common event ordering is validated by the importer.
 * @param {RuntimeTransferBoundary} marker Untrusted marker from a transport-neutral source.
 * @returns {RuntimeTransferBoundary} Canonical marker; inconsistent counts/configuration throw.
 */
export const validateRuntimeTransferBoundary = (
  marker: RuntimeTransferBoundary,
): RuntimeTransferBoundary => {
  const { configuration: c } = marker;
  if (
    !c ||
    !["dma", "hdma"].includes(marker.actor) ||
    !Number.isInteger(marker.channel) ||
    marker.channel < 0 ||
    marker.channel > 7 ||
    !["begin", "complete", "interrupted"].includes(marker.boundary) ||
    typeof marker.transferId !== "string" ||
    !/^(0|[1-9]\d{0,19})$/.test(marker.transferId) ||
    BigInt(marker.transferId) > 0xffffffffffffffffn ||
    !Number.isInteger(marker.pc) ||
    marker.pc < 0 ||
    marker.pc > 0xffffff ||
    !["unattributed", "instruction", "interrupt", "wait", "stop"].includes(marker.context) ||
    !Number.isInteger(marker.transferred) ||
    marker.transferred < 0 ||
    marker.transferred > 65536
  )
    throw new Error("Invalid transfer boundary attribution or count.");
  for (const field of ["dmap", "bbad", "a1b", "dasb", "ntlr"] as const)
    if (!Number.isInteger(c[field]) || c[field] < 0 || c[field] > 255)
      throw new Error("Invalid transfer byte register.");
  for (const field of ["a1t", "das", "a2a"] as const)
    if (!Number.isInteger(c[field]) || c[field] < 0 || c[field] > 65535)
      throw new Error("Invalid transfer word register.");
  if (!Number.isInteger(c.flags) || c.flags < 0 || c.flags > 15)
    throw new Error("Invalid transfer channel flags.");
  if (marker.boundary === "begin") {
    if (marker.transferId !== marker.sequence || marker.transferred !== 0)
      throw new Error("Invalid transfer begin identity.");
  } else if (BigInt(marker.transferId) >= BigInt(marker.sequence) || marker.transferred < 1)
    throw new Error("Invalid transfer end identity.");
  if (marker.actor === "hdma" && (marker.boundary === "interrupted" || marker.transferred > 4))
    throw new Error("Invalid HDMA payload-burst boundary.");
  return {
    kind: "transfer",
    sequence: marker.sequence,
    ordinal: marker.ordinal,
    cycle: marker.cycle,
    transferId: marker.transferId,
    pc: marker.pc,
    boundary: marker.boundary,
    actor: marker.actor,
    channel: marker.channel,
    context: marker.context,
    hcounter: marker.hcounter,
    vcounter: marker.vcounter,
    transferred: marker.transferred,
    configuration: {
      dmap: c.dmap,
      bbad: c.bbad,
      a1t: c.a1t,
      a1b: c.a1b,
      das: c.das,
      dasb: c.dasb,
      a2a: c.a2a,
      ntlr: c.ntlr,
      flags: c.flags,
    },
  };
};

/** Correlate explicit boundaries with payload accesses using at most sixteen open windows.
 * @returns {object} Streaming accumulator; finish preserves partial windows at capture edges.
 */
export const createRuntimeTransferAccumulator = () => {
  const open = new Map<
    string,
    {
      actor: "dma" | "hdma";
      channel: number;
      begin?: RuntimeTransferBoundary;
      reads: number;
      writes: number;
    }
  >();
  const activity = new Map<string, RuntimeTransferActivity>();
  const windows: RuntimeTransferWindow[] = [];
  let omittedWindows = 0;
  /** Retain all aggregate counts while bounding the report's example list.
   * @param {RuntimeTransferWindow} window Closed or explicitly partial observed window.
   */
  const retain = (window: RuntimeTransferWindow): void => {
    const key = `${window.actor}:${window.channel}`;
    let group = activity.get(key);
    if (!group) {
      group = {
        actor: window.actor,
        channel: window.channel,
        complete: 0,
        interrupted: 0,
        leadingPartial: 0,
        trailingPartial: 0,
        bothPartial: 0,
        attemptedSlots: 0,
        reads: 0,
        writes: 0,
      };
      activity.set(key, group);
    }
    const fields = {
      complete: "complete",
      interrupted: "interrupted",
      "leading-partial": "leadingPartial",
      "trailing-partial": "trailingPartial",
      "both-partial": "bothPartial",
    } as const;
    group[fields[window.status]]++;
    group.reads += window.reads;
    group.writes += window.writes;
    if (window.begin && window.end) group.attemptedSlots += window.end.transferred;
    if (!Number.isSafeInteger(group.attemptedSlots))
      throw new Error("Transfer slot total exceeds the safe integer range.");
    if (windows.length < 64) windows.push(window);
    else omittedWindows++;
  };
  return {
    /** Attach only DMA/HDMA payload events; table/pointer fetches remain separate bus evidence.
     * @param {RuntimeBusAccess | RuntimeTransferBoundary} event Already validated ordered event.
     */
    push: (event: RuntimeBusAccess | RuntimeTransferBoundary): void => {
      if (event.actor === "cpu") return;
      const marker = "kind" in event;
      if (!marker && event.phase !== "dma" && event.phase !== "hdma-transfer") return;
      const key = `${event.actor}:${event.channel}`;
      let current = open.get(key);
      if (marker && event.boundary === "begin") {
        if (current) throw new Error("Transfer began before the previous channel window ended.");
        open.set(key, {
          actor: event.actor,
          channel: event.channel,
          begin: event,
          reads: 0,
          writes: 0,
        });
        return;
      }
      if (!current) {
        current = { actor: event.actor, channel: event.channel!, reads: 0, writes: 0 };
        open.set(key, current);
      }
      if (!marker) {
        if (event.direction === "read") current.reads++;
        else current.writes++;
        const maximum = event.actor === "dma" ? 65536 : 4;
        if (current.reads > maximum || current.writes > maximum)
          throw new Error("Transfer window exceeds the native payload bound.");
        return;
      }
      const expectedId = current.begin?.transferId ?? "0";
      if (event.transferId !== expectedId)
        throw new Error("Transfer end does not match its observed begin.");
      if (current.reads > event.transferred || current.writes > event.transferred)
        throw new Error("Transfer contains more observed accesses than attempted byte slots.");
      if (current.begin) {
        // In this SNES scope, A-bus register suppression and B-bus WRAM conflict
        // suppression cannot both apply to one slot. At least one access survives.
        if (current.reads + current.writes < event.transferred)
          throw new Error("Transfer is missing bus accesses inside its observed boundaries.");
        const configuration = current.begin.configuration;
        let expected = configuration.das || 65536;
        if (event.actor === "hdma") expected = [1, 2, 2, 4, 4, 4, 2, 4][configuration.dmap & 7];
        if (
          (event.boundary === "complete" && event.transferred !== expected) ||
          event.transferred > expected
        )
          throw new Error("Transfer completion disagrees with its starting configuration.");
      }
      let status: RuntimeTransferStatus = "leading-partial";
      if (current.begin) status = event.boundary === "complete" ? "complete" : "interrupted";
      retain({ ...current, end: event, status });
      open.delete(key);
    },
    /** Close remaining windows without claiming completion or an attempted slot count.
     * @returns {RuntimeTransferSummary} Bounded report with exact lifetime window counts.
     */
    finish: (): RuntimeTransferSummary => {
      for (const current of open.values())
        retain({ ...current, status: current.begin ? "trailing-partial" : "both-partial" });
      open.clear();
      return {
        activity: [...activity.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, value]) => value),
        windows,
        omittedWindows,
      };
    },
  };
};
