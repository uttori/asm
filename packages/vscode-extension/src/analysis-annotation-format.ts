/** Compact and detailed target-neutral rendering for instruction analysis annotations. */
import type {
  InstructionAnalysisAnnotation,
  InstructionEffectiveAddressAnnotation,
  InstructionMemoryAccessAnnotation,
  InstructionStateObservationAnnotation,
  InstructionStateTransitionAnnotation,
} from "@uttori/asm-disassembler";
import { canonicalValue } from "@uttori/asm-disassembler/canonical-json";

const hexadecimal = (value: number): string =>
  `$${value.toString(16).toUpperCase().padStart(4, "0")}`;

const valueText = (value: unknown, present = true): string => {
  if (!present) return "∅";
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Readonly<Record<string, unknown>>;
    if (record.kind === "known" && "value" in record) return valueText(record.value);
    if (record.kind === "unknown") return "?";
  }
  if (typeof value === "string") return value;
  if (typeof value === "number")
    return Number.isInteger(value) ? hexadecimal(value) : String(value);
  if (typeof value === "boolean") return String(value);
  const serialized = JSON.stringify(canonicalValue(value)) ?? String(value);
  return serialized.length > 60 ? `${serialized.slice(0, 57)}…` : serialized;
};

const effectiveAddressText = (address: InstructionEffectiveAddressAnnotation): string => {
  const resolved = address.address ?? address.baseAddress;
  const identity = [address.symbol, resolved === undefined ? undefined : hexadecimal(resolved)]
    .filter((value): value is string => value !== undefined)
    .join("@");
  return `EA${address.operandIndex} ${identity || "?"}${address.address === undefined && address.baseAddress !== undefined ? " base" : ""}${address.volatile ? " volatile" : ""}`;
};

const transitionText = (transition: InstructionStateTransitionAnnotation): string =>
  `Δ${transition.field} ${valueText(transition.before, "before" in transition)}→${valueText(transition.after, "after" in transition)}`;

const stateText = (observation: InstructionStateObservationAnnotation): string => {
  const fields = Object.entries(observation.state)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${valueText(value)}`)
    .join(",");
  return `${observation.source} state ${fields || "∅"}${observation.count === undefined ? "" : ` ×${observation.count}`}`;
};

const accessText = (access: InstructionMemoryAccessAnnotation): string => {
  let mode = "?";
  if (access.access === "read") mode = "R";
  else if (access.access === "write") mode = "W";
  else if (access.access === "read-write") mode = "RW";
  return `${access.actor ? `${access.actor}${access.channel === undefined ? "" : ` channel ${access.channel}`} ` : ""}${mode} ${access.accessedAddressSpace}:${hexadecimal(access.accessedAddress)}${access.value === undefined ? "" : `=${hexadecimal(access.value)}`} ${access.width}B ×${access.count}`;
};

const clipped = (value: string, maximum: number): string =>
  value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;

/**
 * One concise decoration suffix; empty means the instruction has no user-facing evidence.
 * @param {InstructionAnalysisAnnotation} annotation Projected instruction analysis.
 * @param {number} maximumLength Maximum returned character count.
 * @returns {string} Compact target-neutral annotation text.
 */
export const formatInstructionAnnotationSummary = (
  annotation: InstructionAnalysisAnnotation,
  maximumLength = 220,
): string => {
  const parts: string[] = [];
  parts.push(...(annotation.comments ?? []).slice(0, 2).map(({ text }) => text));
  if (annotation.executionCount > 0) parts.push(`▶ ${annotation.executionCount}×`);
  if (annotation.detailsLimited) parts.push("details limited");
  const coverage = annotation.runtimeCoverage.map(({ coverage }) => coverage);
  if (coverage.length > 0) parts.push(`coverage ${coverage.join("/")}`);
  parts.push(...annotation.effectiveAddresses.slice(0, 2).map(effectiveAddressText));
  parts.push(...annotation.memoryAccesses.slice(0, 2).map(accessText));
  parts.push(...annotation.stateTransitions.slice(0, 3).map(transitionText));
  if (annotation.stateTransitions.length === 0 && annotation.stateObservations.length > 0) {
    parts.push(stateText(annotation.stateObservations[0]));
  }
  return clipped(parts.join(" · "), Math.max(24, maximumLength));
};

/**
 * Plain-text hover/source detail retaining supplied identities and provenance, including preview limits.
 * @param {InstructionAnalysisAnnotation} annotation Projected instruction analysis.
 * @returns {string} Multiline target-neutral annotation detail.
 */
export const formatInstructionAnnotationDetails = (
  annotation: InstructionAnalysisAnnotation,
): string => {
  const lines = [
    `${annotation.addressSpace}:${hexadecimal(annotation.address)}`,
    annotation.outputOffsets.length > 0
      ? `Output offsets: ${annotation.outputOffsets.map(hexadecimal).join(", ")}`
      : "Output offsets: none persisted",
    `Architectures: ${annotation.architectures.join(", ") || "none persisted"}`,
    `Execution observations: ${annotation.executionCount}`,
    ...(annotation.detailsLimited
      ? [
          "Some detail records are omitted from this preview. Execution totals include all observations.",
        ]
      : []),
    ...(annotation.comments ?? []).map(
      ({ text, evidence }) => `Comment: ${text}\nEvidence: ${evidence.join(", ")}`,
    ),
  ];
  // Retain all supplied preview observations, unlike the clipped summary. Append one line at a time
  // because a single hot instruction can have more observations than V8 allows call arguments.
  if (annotation.runtimeCoverage.length > 0) {
    lines.push("Runtime coverage:");
    for (const { coverage, count, recordIds } of annotation.runtimeCoverage)
      lines.push(`  ${coverage} ×${count} (${recordIds.join(", ")})`);
  }
  if (annotation.effectiveAddresses.length > 0) {
    lines.push("Effective addresses:");
    for (const address of annotation.effectiveAddresses)
      lines.push(`  ${effectiveAddressText(address)} — ${address.explanation}`);
  }
  if (annotation.memoryAccesses.length > 0) {
    lines.push("Runtime memory:");
    for (const access of annotation.memoryAccesses) lines.push(`  ${accessText(access)}`);
  }
  if (annotation.stateTransitions.length > 0) {
    lines.push("Static state transitions:");
    for (const transition of annotation.stateTransitions)
      lines.push(`  ${transitionText(transition)}`);
  }
  if (annotation.stateObservations.length > 0) {
    lines.push("Known/observed state:");
    for (const observation of annotation.stateObservations)
      lines.push(`  ${stateText(observation)}`);
  }
  if (annotation.nodeIds.length > 0) lines.push(`CFG nodes: ${annotation.nodeIds.join(", ")}`);
  if (annotation.evidence.length > 0) lines.push(`Evidence: ${annotation.evidence.join(", ")}`);
  return lines.join("\n");
};
