import type {
  RuntimePPUSummary,
  RuntimeBusProjectImportResult,
  RuntimeGraphicsSummary,
  RuntimeTransferSummary,
} from "@uttori/asm-disassembler";

/** Show register-derived byte candidates separately from captured bus facts and native boundaries.
 * @param {RuntimeGraphicsSummary} summary Bounded interpretation of ordered PPU port accesses.
 * @returns {string[]} Markdown with explicit unknown/latch states and physical-memory limitations.
 */
const graphicsReport = (summary: RuntimeGraphicsSummary): string[] => {
  const hex = (value: number, width = 2): string =>
    `$${value.toString(16).toUpperCase().padStart(width, "0")}`;
  return [
    "## Graphics port destinations",
    "",
    "These are register-derived destination candidates, not verified graphics memory updates. Rendering can suppress VRAM writes or redirect CGRAM/OAM accesses. VRAM addresses are 17-bit byte offsets before the physical 64/128 KiB mask; CGRAM/OAM use byte offsets with OAM high-table mirrors folded.",
    "",
    "State starts unknown. Reads advance port pointers and shared flip-flops. OAM addresses require observed forced blank followed by an address-register write; an INIDISP write invalidates that pointer because it can reset internally. Addressed writes can still contain an unknown previously latched byte.",
    "",
    "| Actor/channel | Target | Port writes | Addressed | Latch only | Unknown | Byte candidates | Known data bytes |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...summary.activity.map(
      (group) =>
        `| ${group.actor.toUpperCase()}/${group.channel ?? "—"} | ${group.target.toUpperCase()} | ${group.portWrites} | ${group.addressed} | ${group.latched} | ${group.unknown} | ${group.byteTargets} | ${group.knownValueTargets} |`,
    ),
    "",
    "| Event | Actor/channel | Port = value | Target | Status | Forced blank | Byte address = value (data event) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...summary.writes.map((write) => {
      const bytes = write.bytes
        .map(
          (byte) =>
            `${hex(byte.address, 5)} = ${byte.value === null ? "unknown" : hex(byte.value)} (event ${byte.sourceSequence ?? "unknown"})`,
        )
        .join(", ");
      let blank = "unknown";
      if (write.forcedBlank !== null) {
        blank = write.forcedBlank ? "yes" : "no";
      }
      return `| ${write.sequence} | ${write.actor.toUpperCase()}/${write.channel ?? "—"} | ${hex(write.port, 4)} = ${hex(write.value)} | ${write.target.toUpperCase()} | ${write.reason ?? write.status} | ${blank} | ${bytes || "—"} |`;
    }),
    "",
    `${summary.omittedWrites} additional port writes omitted; all contribute to the totals. Data events identify the writes supplying each byte, which may precede the completing write or belong to another actor. They do not identify an A-bus source or setup instruction.`,
    "",
    `Interpretation: ${summary.model}. This view is recomputed from ordered accesses and requires the source capture to reproduce. The project retains bus facts and transfer totals, not this graphics view.`,
    "",
  ];
};

/** Render explicit boundaries; bounded examples never substitute for aggregate totals.
 * @param {RuntimeTransferSummary} summary Native-boundary correlation with partial windows preserved.
 * @returns {string[]} Markdown lines including raw starting configuration and completion evidence.
 */
const transferReport = (summary: RuntimeTransferSummary): string[] => {
  const hex = (value: number, width = 2): string =>
    `$${value.toString(16).toUpperCase().padStart(width, "0")}`;
  return [
    "## Transfer boundaries",
    "",
    "DMA rows describe channel runs; HDMA rows describe payload bursts, not whole frames or tables. Attempted byte slots include suppressed operations and count only windows with both markers.",
    "",
    "| Actor | Channel | Complete | Interrupted | Missing begin | Missing end | Both missing | Attempted slots | Reads | Writes |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...summary.activity.map(
      (group) =>
        `| ${group.actor.toUpperCase()} | ${group.channel} | ${group.complete} | ${group.interrupted} | ${group.leadingPartial} | ${group.trailingPartial} | ${group.bothPartial} | ${group.attemptedSlots} | ${group.reads} | ${group.writes} |`,
    ),
    "",
    "## Observed transfer windows",
    "",
    "Starting channel registers are native snapshots. They do not identify setup code or internal VRAM/CGRAM/OAM destinations. Missing starts remain unknown even when an end snapshot exists in the archive.",
    "",
    "| Actor/channel | Status | Begin/end event | Begin/end clock | DMAP | BBAD | A1B:A1T | DAS / indirect | DASB | A2A | NTLR | Slots | Reads/writes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |",
    ...summary.windows.map((window) => {
      const c = window.begin?.configuration;
      const config = c
        ? [
            hex(c.dmap),
            hex(c.bbad),
            `${hex(c.a1b)}:${hex(c.a1t, 4)}`,
            hex(c.das, 4),
            hex(c.dasb),
            hex(c.a2a, 4),
            hex(c.ntlr),
          ]
        : Array<string>(7).fill("unknown");
      return `| ${window.actor.toUpperCase()}/${window.channel} | ${window.status} | ${window.begin?.sequence ?? "?"}/${window.end?.sequence ?? "?"} | ${window.begin?.cycle ?? "?"}/${window.end?.cycle ?? "?"} | ${config.join(" | ")} | ${window.begin && window.end ? window.end.transferred : "?"} | ${window.reads}/${window.writes} |`;
    }),
    "",
    `${summary.omittedWindows} additional windows omitted from this bounded view; all contribute to the totals. Full marker/configuration history requires the archive.`,
    "",
  ];
};

/** Render the bounded channel/phase summary without assigning unsupported transfer or code ownership.
 * @param {RuntimeBusProjectImportResult} result Validated and committed bus capture activity.
 * @returns {string} Markdown report, including the retained aggregate/raw-history distinction.
 */
export const renderBusTraceReport = (result: RuntimeBusProjectImportResult): string => {
  const { summary } = result;
  const elapsed =
    summary.firstCycle === null || summary.lastCycle === null
      ? "No accesses"
      : `${BigInt(summary.lastCycle) - BigInt(summary.firstCycle)} master clocks`;
  const rows = summary.activity.map(
    (group) =>
      `| ${group.actor.toUpperCase()} | ${group.channel ?? "—"} | ${group.phase} | ${group.reads} | ${group.writes} | ${group.unowned} | ${group.firstSequence}–${group.lastSequence} | ${group.firstCycle}–${group.lastCycle} |`,
  );
  const warnings = [...result.report.warnings, ...result.warnings].map((warning) => `- ${warning}`);
  return [
    "# CPU / DMA / HDMA bus activity",
    "",
    `- Observed byte accesses: ${result.observedEvents}`,
    `- Dropped accesses: ${result.droppedEvents}`,
    `- Distinct access variants: ${result.report.imported.busRecords ?? 0}`,
    `- Newly added records: ${result.added.runtime}`,
    `- Capture already present: ${result.changed ? "no" : "yes"}`,
    `- First-to-last recorded event span: ${elapsed}`,
    `- Clock frequency: ${summary.clock.numerator}/${summary.clock.denominator} Hz`,
    "",
    "Each count is one observed byte read or write. A transfer may contribute both; these are not transfer counts.",
    "",
    "## Channel and phase activity",
    "",
    "| Actor | Channel | Phase | Reads | Writes | Unowned | First–last event | First–last clock |",
    "| --- | --- | --- | ---: | ---: | ---: | --- | --- |",
    ...rows,
    ...(rows.length ? [] : ["| — | — | No accesses | 0 | 0 | 0 | — | — |"]),
    "",
    "## CPU context",
    "",
    ...Object.entries(summary.contexts).map(([context, count]) => `- ${context}: ${count}`),
    "",
    "Unowned accesses retain their observed PC but do not establish that an instruction executed there. The first/last columns bound observed activity, not complete DMA or HDMA transfers.",
    "",
    "## Retained evidence",
    "",
    ...warnings,
    "",
    ...(summary.transfers ? transferReport(summary.transfers) : []),
    ...(summary.ppu ? ppuReport(summary.ppu) : []),
    ...(summary.graphics ? graphicsReport(summary.graphics) : []),
  ].join("\n");
};

/** Render native decisions with ordered byte writes; examples are bounded while totals are exact.
 * @param {RuntimePPUSummary} summary Validated producer effects.
 * @returns {string[]} Markdown lines explaining physical writes and capture limits.
 */
const ppuReport = (summary: RuntimePPUSummary): string[] => {
  const hex = (value: number): string => `$${value.toString(16).toUpperCase()}`;
  return [
    "## Verified PPU writes",
    "",
    `${summary.portWrites} data-port writes: ${summary.written} wrote memory, ${summary.blocked} were blocked, ${summary.latched} only updated a latch. ${summary.byteWrites} physical byte writes; ${summary.renderingRestricted} decisions used rendering restrictions.`,
    "",
    "Destinations and values come from the selected ares PPU after its rendering restrictions, address mirroring and data masking. These are emulator write operations, including writes of an unchanged value. Repeated destinations retain write order. A completing access may commit a previously latched byte; this does not identify that byte's source instruction or A-bus read.",
    "",
    "| Event | Actor/channel | Port | Target | Outcome | PPU | Forced blank | Rendering restriction | PPU H/V | Byte address = value, in order |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...summary.writes.map((write) => {
      const p = write.ppu;
      const bytes = p.bytes.map((byte) => `${hex(byte.address)} = ${hex(byte.value)}`).join(", ");
      return `| ${write.sequence} | ${write.actor.toUpperCase()}/${write.channel ?? "—"} | ${hex(write.port)} | ${p.target.toUpperCase()} | ${p.outcome} | ${p.implementation} | ${p.forcedBlank ? "yes" : "no"} | ${p.renderingRestricted ? "yes" : "no"} | ${p.hcounter}/${p.vcounter} | ${bytes || "—"} |`;
    }),
    "",
    `${summary.omittedWrites} additional effects omitted from this view. The project retains physical write variants and totals; event order and raster history require the source capture.`,
    "",
  ];
};
