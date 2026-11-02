import { canonicalValue } from "@uttori/asm-core/canonical-json";
import type { DebugMapInstruction, DebugMapRange } from "@uttori/asm-core/debug-map";
import type {
  InstructionAnalysisAnnotation,
  InstructionEffectiveAddressAnnotation,
  InstructionMemoryAccessAnnotation,
  InstructionStateObservationAnnotation,
  InstructionStateTransitionAnnotation,
} from "@uttori/asm-disassembler";

/** Qualified location; an absent count means observations were not requested or unavailable. */
export interface EditorLocation {
  /** Address space id from the debug map. */
  readonly addressSpace: string;
  /** Offset within the address space. */
  readonly address: number;
  /** Whether the location refers to file output rather than CPU space. */
  readonly file: boolean;
  /** Observed execution total when counts were requested. */
  readonly executionCount?: number;
}

/** Facts for one source line in one artifact/project context. Never merge counts across groups. */
export interface LineInformation {
  /** Stable artifact key used when multiple contexts share one line. */
  readonly identity: string;
  /** Human label prefixed when several contexts are shown together. */
  readonly label: string;
  /** Debug-map ranges backing this line. */
  readonly ranges: readonly DebugMapRange[];
  /** Qualified output/CPU locations for template fields. */
  readonly locations: readonly EditorLocation[];
  /** Instructions contributing operand and execution facts. */
  readonly instructions: readonly DebugMapInstruction[];
  /** Emitted ROM bytes when byte placeholders are enabled. */
  readonly bytes?: readonly number[];
  /** Total emitted size when it differs from the byte preview. */
  readonly outputSize?: number;
  /** Analysis annotations supplying state and runtime evidence. */
  readonly annotations?: readonly InstructionAnalysisAnnotation[];
  /** Whether detail queries were truncated for this snapshot. */
  readonly limited?: boolean;
}

/** Provider requirements compiled from selected placeholders, independent of presentation order. */
export interface InformationRequirements {
  /** Execution-count placeholders appear in the selected templates. */
  readonly counts: boolean;
  /** Output-byte placeholders appear in the selected templates. */
  readonly bytes: boolean;
  /** Project or runtime state placeholders appear in the selected templates. */
  readonly state: boolean;
}

/** Discoverable fields. State placeholders additionally accept a single explicit register/field name. */
export const INFORMATION_FIELDS = {
  output_offsets: "File and logical addresses",
  output_offset_file: "Single file offset",
  output_offset_cpu: "Single CPU logical address",
  output_bytes: "Output bytes (up to eight)",
  output_size: "Emitted byte count",
  operand_value: "Single resolved operand",
  operand_values: "Resolved operands with expressions",
  execution_observations: "Qualified execution observations",
  execution_counts: "Execution counts in file / CPU order",
  execution_count_cpu: "Single CPU execution count",
} as const;

/** Parsed templates have no executable expressions; only registered fields are interpolated. */
export type InformationTemplate = readonly (
  | { readonly literal: string }
  | { readonly field: string }
)[];

/** Accept built-in placeholders and explicit project/runtime state field paths. */
const isField = (field: string): boolean =>
  Object.hasOwn(INFORMATION_FIELDS, field) ||
  /^(project_state|runtime_state)\.[A-Za-z]\w*$/.test(field);

/**
 * Parse placeholders once per settings revision. `$${` escapes a literal `${`.
 * @param text Template of at most 2048 characters; invalid fields throw.
 * @returns Literal/field tokens with no executable expressions.
 */
export const compileTemplate = (text: string): InformationTemplate => {
  if (text.length > 2048) {
    throw new Error("Editor information templates must be at most 2048 characters.");
  }
  const parts: ({ literal: string } | { field: string })[] = [];
  let literal = "";
  for (let index = 0; index < text.length;) {
    if (text.startsWith("$${", index)) {
      literal += "${";
      index += 3;
    } else if (text.startsWith("${", index)) {
      if (literal) {
        parts.push({ literal });
      }
      literal = "";
      const end = text.indexOf("}", index + 2);
      if (end < 0) {
        throw new Error("Unclosed editor information placeholder.");
      }
      const field = text.slice(index + 2, end);
      if (!isField(field)) {
        throw new Error(`Unknown editor information field '${field}'.`);
      }
      parts.push({ field });
      index = end + 1;
    } else {
      literal += text[index++];
    }
  }
  if (literal) {
    parts.push({ literal });
  }
  return parts;
};

/**
 * Avoid database/detail/byte work unless the selected surface requires those facts.
 * @param templates Compiled fields for one surface.
 * @returns Minimum provider work needed to render those templates.
 */
export const templateRequirements = (
  templates: readonly InformationTemplate[],
): InformationRequirements => {
  const fields = templates.flatMap((template) =>
    template.flatMap((part) => ("field" in part ? [part.field] : [])),
  );
  return {
    counts: fields.some((field) => field.startsWith("execution_")),
    bytes: fields.includes("output_bytes"),
    state: fields.some(
      (field) => field.startsWith("project_state.") || field.startsWith("runtime_state."),
    ),
  };
};

/**
 * Assembly notation; large and negative values are preserved rather than bitwise truncated.
 * @param value Numeric operand/address in its original domain.
 * @param digits Minimum hexadecimal digit count, default four.
 * @returns Signed assembly hexadecimal without width truncation.
 */
export const informationHex = (value: number, digits = 4): string => {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toString(16).toUpperCase().padStart(digits, "0")}`;
};

/**
 * Reserve the final character for an ellipsis when a complete surface exceeds its budget.
 * @param value Fully joined text.
 * @param maximum Positive character budget including the ellipsis.
 * @returns Text bounded once after composition.
 */
const clip = (value: string, maximum: number): string =>
  value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;

/**
 * Stable order is shared by offsets and compact counts; unknown counts never become zero.
 * @param info One qualified artifact/project context.
 * @returns File locations followed by sorted logical locations.
 */
export const orderedLocations = (info: LineInformation): readonly EditorLocation[] =>
  [...info.locations].toSorted(
    (a, b) =>
      Number(b.file) - Number(a.file) ||
      a.addressSpace.localeCompare(b.addressSpace) ||
      a.address - b.address,
  );

/** Disambiguate address spaces when file and CPU rows share one template line. */
const locationLabel = (location: EditorLocation, locations: readonly EditorLocation[]): string => {
  const spaces = new Set(
    locations.filter((entry) => entry.file === location.file).map((entry) => entry.addressSpace),
  );
  const address = informationHex(location.address);
  return spaces.size > 1 ? `${location.addressSpace}:${address}` : address;
};

/** Narrow structured state values before reading known/unknown envelopes. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Top-level undefined, functions, and symbols have no JSON text. */
function jsonText(value: unknown): string | undefined {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }
  return JSON.stringify(value);
}

/**
 * Render analysis values for overlays, preserving the distinction between absent (∅) and unknown
 * (?) state.
 * Compact fields omit structured values; detailed evidence can retain canonical JSON capped at 60 characters.
 * @param value State value or canonicalizable fallback data.
 * @param [present] Whether the field exists; defaults to true.
 * @param [includeStructures] Retain structured fallback data for detailed evidence; defaults to false.
 * @returns Present scalar text, or an optional bounded structured value.
 */
const stateValue = (
  value: unknown,
  present = true,
  includeStructures = false,
): string | undefined => {
  if (!present) {
    return "∅";
  }
  if (isRecord(value)) {
    if (value.kind === "known" && "value" in value) {
      return stateValue(value.value, true, includeStructures);
    }
    if (value.kind === "unknown") {
      return "?";
    }
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? informationHex(value) : String(value);
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  if (!includeStructures) {
    return undefined;
  }
  const serialized = jsonText(canonicalValue(value)) ?? String(value);
  return serialized.length > 60 ? `${serialized.slice(0, 57)}…` : serialized;
};

/**
 * Resolve a registered field conservatively; scalar shortcuts disappear for ambiguous emissions.
 * @param field Validated placeholder name.
 * @param info Facts for one artifact/project context.
 * @returns Formatted field; undefined suppresses its whole template fragment.
 */
export const informationField = (field: string, info: LineInformation): string | undefined => {
  const locations = orderedLocations(info);
  const file = locations.filter((entry) => entry.file);
  const cpu = locations.filter((entry) => !entry.file);
  switch (field) {
    case "output_offsets":
      return locations.length
        ? locations.map((entry) => locationLabel(entry, locations)).join(" / ")
        : undefined;
    case "output_offset_file":
      return file.length === 1 ? informationHex(file[0].address) : undefined;
    case "output_offset_cpu":
      return cpu.length === 1 ? informationHex(cpu[0].address) : undefined;
    case "output_size":
      return info.outputSize === undefined ? undefined : String(info.outputSize);
    case "output_bytes": {
      if (!info.bytes?.length) {
        return undefined;
      }
      const bytes = info.bytes
        .slice(0, 8)
        .map((value) => value.toString(16).toUpperCase().padStart(2, "0"))
        .join(" ");
      return (info.outputSize ?? info.bytes.length) > 8 ? `${bytes} …` : bytes;
    }
    case "operand_value": {
      if (info.instructions.length !== 1 || info.instructions[0].operands.length !== 1) {
        return undefined;
      }
      return informationHex(info.instructions[0].operands[0].value);
    }
    case "operand_values": {
      const values = info.instructions.flatMap((instruction) =>
        instruction.operands.map(
          (operand) =>
            `${informationHex(instruction.address)}: ${operand.expression}=${informationHex(operand.value)}`,
        ),
      );
      return values.length
        ? values.slice(0, 4).join(" / ") + (values.length > 4 ? " …" : "")
        : undefined;
    }
    case "execution_observations": {
      const known = locations.filter((entry) => entry.executionCount !== undefined);
      return known.length
        ? known
            .map((entry) => `${locationLabel(entry, locations)}: ${entry.executionCount}`)
            .join(" / ")
        : undefined;
    }
    case "execution_counts":
      if (!locations.length || locations.some((entry) => entry.executionCount === undefined)) {
        return undefined;
      }
      return locations.map((entry) => String(entry.executionCount)).join(" / ");
    case "execution_count_cpu":
      return cpu.length === 1 && cpu[0].executionCount !== undefined
        ? String(cpu[0].executionCount)
        : undefined;
    default: {
      const [prefix, name] = field.split(".");
      const source = prefix === "project_state" ? "project" : "runtime";
      const values = new Set<string>();
      for (const annotation of info.annotations ?? []) {
        for (const observation of annotation.stateObservations) {
          if (observation.source !== source || !Object.hasOwn(observation.state, name)) {
            continue;
          }
          const value = stateValue(observation.state[name]);
          if (value !== undefined) {
            values.add(value);
          }
        }
      }
      if (!values.size) {
        return undefined;
      }
      return [...values].slice(0, 4).join(" / ") + (values.size > 4 || info.limited ? " …" : "");
    }
  }
};

/**
 * Missing fields suppress their complete fragment, including literal labels and punctuation.
 * @param template Validated literal/field tokens.
 * @param info Facts from one current snapshot.
 * @returns Interpolated text, or undefined when a required field is missing.
 */
export const renderTemplate = (
  template: InformationTemplate,
  info: LineInformation,
): string | undefined => {
  let text = "";
  for (const part of template) {
    if ("literal" in part) {
      text += part.literal;
    } else {
      const value = informationField(part.field, info);
      if (value === undefined) {
        return undefined;
      }
      text += value;
    }
  }
  return text || undefined;
};

/**
 * Apply one total display budget after grouping, so duplicate records cannot multiply the limit.
 * @param infos Distinct artifact/project contexts for one line.
 * @param templates Selected fragments in display order.
 * @param separator Inserted only between surviving fragments.
 * @param maximum Total positive character budget, including the ellipsis.
 * @returns Bounded presentation with context labels when required.
 */
export const renderInformation = (
  infos: readonly LineInformation[],
  templates: readonly InformationTemplate[],
  separator: string,
  maximum: number,
): string =>
  joinInformation(
    infos.flatMap((info) => {
      const parts = templates
        .map((template) => renderTemplate(template, info))
        .filter((part): part is string => part !== undefined);
      if (!parts.length) {
        return [];
      }
      const prefix = infos.length > 1 ? `${info.label}: ` : "";
      return [`${prefix}${parts.join(separator)}`];
    }),
    " | ",
    maximum,
  );

/**
 * Join surviving fragments and bound the whole surface, including multi-record debugger results.
 * @param parts Already formatted fragments; empty entries are omitted.
 * @param separator Delimiter between nonempty fragments.
 * @param maximum Positive total character budget, including an ellipsis.
 * @returns Bounded display text, or empty text when no fragments survive.
 */
export const joinInformation = (
  parts: readonly string[],
  separator: string,
  maximum: number,
): string => clip(parts.filter(Boolean).join(separator), maximum);

/**
 * Describe an operand address with its symbol, unresolved base, and volatility so a base is
 * never presented as a resolved access.
 * @param address Persisted operand address and resolution evidence.
 * @returns Operand identity with base/volatile qualifiers when applicable.
 */
const effectiveAddressText = (address: InstructionEffectiveAddressAnnotation): string => {
  const resolved = address.address ?? address.baseAddress;
  const identity = [address.symbol, resolved === undefined ? undefined : informationHex(resolved)]
    .filter((value): value is string => value !== undefined)
    .join("@");
  return `EA${address.operandIndex} ${identity || "?"}${address.address === undefined && address.baseAddress !== undefined ? " base" : ""}${address.volatile ? " volatile" : ""}`;
};

/**
 * Format a state change with separate absent-value markers for missing before/after fields.
 * @param transition Before/after state evidence for one processor field.
 * @returns Field transition with explicit missing-value markers.
 */
const transitionText = (transition: InstructionStateTransitionAnnotation): string =>
  `Δ${transition.field} ${stateValue(transition.before, "before" in transition, true)}→${stateValue(transition.after, "after" in transition, true)}`;

/**
 * Render an observed state in stable field order with its evidence source and optional
 * observation count.
 * @param observation State fields, evidence source, and optional occurrence count.
 * @returns Stable field listing with provenance and count.
 */
const stateText = (observation: InstructionStateObservationAnnotation): string => {
  const fields = Object.entries(observation.state)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${stateValue(value, true, true)}`)
    .join(",");
  return `${observation.source} state ${fields || "∅"}${observation.count === undefined ? "" : ` ×${observation.count}`}`;
};

/**
 * Describe a memory access with actor/channel, qualified address, byte width, and count; unknown
 * access modes remain visible as ?.
 * @param access Qualified access evidence with byte width and observation count.
 * @returns Compact actor, access mode, address, value, width, and count.
 */
const accessText = (access: InstructionMemoryAccessAnnotation): string => {
  let mode = "?";
  if (access.access === "read") {
    mode = "R";
  } else if (access.access === "write") {
    mode = "W";
  } else if (access.access === "read-write") {
    mode = "RW";
  }
  let actor = "";
  if (access.actor) {
    actor = access.actor;
    if (access.channel !== undefined) {
      actor += ` channel ${access.channel}`;
    }
    actor += " ";
  }
  const value = access.value === undefined ? "" : `=${informationHex(access.value)}`;
  return `${actor}${mode} ${access.accessedAddressSpace}:${informationHex(access.accessedAddress)}${value} ${access.width}B ×${access.count}`;
};

/**
 * Fixed debugger/navigation evidence presentation, independent of resource-scoped editor templates.
 * Empty means the instruction has no user-facing evidence; full details remain available to the inspector.
 * @param annotation Projected instruction analysis.
 * @param maximumLength Maximum returned character count.
 * @returns Compact target-neutral annotation text.
 */
export const formatInstructionAnnotationSummary = (
  annotation: InstructionAnalysisAnnotation,
  maximumLength = 220,
): string => {
  const parts: string[] = [];
  parts.push(...(annotation.comments ?? []).slice(0, 2).map(({ text }) => text));
  if (annotation.executionCount > 0) {
    parts.push(`▶ ${annotation.executionCount}×`);
  }
  if (annotation.detailsLimited) {
    parts.push("details limited");
  }
  const coverage = annotation.runtimeCoverage.map(({ coverage: kind }) => kind);
  if (coverage.length > 0) {
    parts.push(`coverage ${coverage.join("/")}`);
  }
  parts.push(...annotation.effectiveAddresses.slice(0, 2).map(effectiveAddressText));
  parts.push(...annotation.memoryAccesses.slice(0, 2).map(accessText));
  parts.push(...annotation.stateTransitions.slice(0, 3).map(transitionText));
  if (annotation.stateTransitions.length === 0 && annotation.stateObservations.length > 0) {
    parts.push(stateText(annotation.stateObservations[0]));
  }
  return joinInformation(parts, " · ", Math.max(24, maximumLength));
};

/**
 * Plain-text inspector detail retaining supplied identities and provenance, including preview limits.
 * @param annotation Projected instruction analysis.
 * @returns Multiline target-neutral annotation detail.
 */
export const formatInstructionAnnotationDetails = (
  annotation: InstructionAnalysisAnnotation,
): string => {
  const lines = [
    `${annotation.addressSpace}:${informationHex(annotation.address)}`,
    annotation.outputOffsets.length > 0
      ? `Output offsets: ${annotation.outputOffsets.map((offset) => informationHex(offset)).join(", ")}`
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
    for (const { coverage, count, recordIds } of annotation.runtimeCoverage) {
      lines.push(`  ${coverage} ×${count} (${recordIds.join(", ")})`);
    }
  }
  if (annotation.effectiveAddresses.length > 0) {
    lines.push("Effective addresses:");
    for (const address of annotation.effectiveAddresses) {
      lines.push(`  ${effectiveAddressText(address)} — ${address.explanation}`);
    }
  }
  if (annotation.memoryAccesses.length > 0) {
    lines.push("Runtime memory:");
    for (const access of annotation.memoryAccesses) {
      lines.push(`  ${accessText(access)}`);
    }
  }
  if (annotation.stateTransitions.length > 0) {
    lines.push("Static state transitions:");
    for (const transition of annotation.stateTransitions) {
      lines.push(`  ${transitionText(transition)}`);
    }
  }
  if (annotation.stateObservations.length > 0) {
    lines.push("Known/observed state:");
    for (const observation of annotation.stateObservations) {
      lines.push(`  ${stateText(observation)}`);
    }
  }
  if (annotation.nodeIds.length > 0) {
    lines.push(`CFG nodes: ${annotation.nodeIds.join(", ")}`);
  }
  if (annotation.evidence.length > 0) {
    lines.push(`Evidence: ${annotation.evidence.join(", ")}`);
  }
  return lines.join("\n");
};

/** Inspector choices share the formatter's section contract; only Summary avoids detail queries. */
export const INFORMATION_SECTIONS = [
  "Summary",
  "Project state",
  "Runtime state",
  "State transitions",
  "Memory and effective addresses",
  "Evidence and control flow",
] as const;

/** One lazily requested inspector section, never an arbitrary template or executable expression. */
export type InformationSection = (typeof INFORMATION_SECTIONS)[number];

/**
 * Render one inspector section without mutating its cached facts or exposing unrelated histories.
 * @param info One qualified artifact/project context.
 * @param section Selected detail category; Summary uses only shallow fields.
 * @returns Plain text ready for the controller's pagination and document display.
 */
export const renderInformationSection = (
  info: LineInformation,
  section: InformationSection,
): string => {
  const lines = [info.label, ""];
  if (section === "Summary") {
    for (const field of Object.keys(INFORMATION_FIELDS)) {
      const value = informationField(field, info);
      if (value !== undefined) {
        lines.push(`${field}: ${value}`);
      }
    }
    return lines.join("\n");
  }
  for (const annotation of info.annotations ?? []) {
    // The common identity/count header stays visible; histories belong only to their chosen section.
    const selected: InstructionAnalysisAnnotation = {
      ...annotation,
      stateObservations: [],
      stateTransitions: [],
      memoryAccesses: [],
      effectiveAddresses: [],
      nodeIds: [],
      evidence: [],
      runtimeCoverage: [],
      comments: [],
    };
    let detail = selected;
    switch (section) {
      case "Project state":
      case "Runtime state": {
        const source = section === "Project state" ? "project" : "runtime";
        detail = {
          ...selected,
          stateObservations: annotation.stateObservations.filter(
            (value) => value.source === source,
          ),
        };
        break;
      }
      case "State transitions":
        detail = { ...selected, stateTransitions: annotation.stateTransitions };
        break;
      case "Memory and effective addresses":
        detail = {
          ...selected,
          memoryAccesses: annotation.memoryAccesses,
          effectiveAddresses: annotation.effectiveAddresses,
        };
        break;
      case "Evidence and control flow":
        detail = {
          ...selected,
          nodeIds: annotation.nodeIds,
          evidence: annotation.evidence,
          runtimeCoverage: annotation.runtimeCoverage,
          comments: annotation.comments,
        };
        break;
    }
    lines.push(formatInstructionAnnotationDetails(detail), "");
  }
  return lines.join("\n");
};
