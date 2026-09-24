import type { DebugMapInstruction, DebugMapRange } from "@uttori/asm-core/debug-map";
import type { InstructionAnalysisAnnotation } from "@uttori/asm-disassembler";

/** Qualified location; an absent count means observations were not requested or unavailable. */
export interface EditorLocation {
  readonly addressSpace: string;
  readonly address: number;
  readonly file: boolean;
  readonly executionCount?: number;
}

/** Facts for one source line in one artifact/project context. Never merge counts across groups. */
export interface LineInformation {
  readonly identity: string;
  readonly label: string;
  readonly ranges: readonly DebugMapRange[];
  readonly locations: readonly EditorLocation[];
  readonly instructions: readonly DebugMapInstruction[];
  readonly bytes?: readonly number[];
  readonly outputSize?: number;
  readonly annotations?: readonly InstructionAnalysisAnnotation[];
  readonly limited?: boolean;
}

/** Provider requirements compiled from selected placeholders, independent of presentation order. */
export interface InformationRequirements {
  readonly counts: boolean;
  readonly bytes: boolean;
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

const isField = (field: string): boolean =>
  Object.hasOwn(INFORMATION_FIELDS, field) ||
  /^(project_state|runtime_state)\.[A-Za-z]\w*$/.test(field);

/**
 * Parse placeholders once per settings revision. `$${` escapes a literal `${`.
 * @param {string} text Template of at most 2048 characters; invalid fields throw.
 * @returns {InformationTemplate} Literal/field tokens with no executable expressions.
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
 * @param {readonly InformationTemplate[]} templates Compiled fields for one surface.
 * @returns {InformationRequirements} Minimum provider work needed to render those templates.
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
 * @param {number} value Numeric operand/address in its original domain.
 * @param {number} digits Minimum hexadecimal digit count, default four.
 * @returns {string} Signed assembly hexadecimal without width truncation.
 */
export const informationHex = (value: number, digits = 4): string => {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toString(16).toUpperCase().padStart(digits, "0")}`;
};

const clip = (value: string, maximum: number): string =>
  value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;

/**
 * Stable order is shared by offsets and compact counts; unknown counts never become zero.
 * @param {LineInformation} info One qualified artifact/project context.
 * @returns {readonly EditorLocation[]} File locations followed by sorted logical locations.
 */
export const orderedLocations = (info: LineInformation): readonly EditorLocation[] =>
  [...info.locations].sort(
    (a, b) =>
      Number(b.file) - Number(a.file) ||
      a.addressSpace.localeCompare(b.addressSpace) ||
      a.address - b.address,
  );

const locationLabel = (location: EditorLocation, locations: readonly EditorLocation[]): string => {
  const spaces = new Set(
    locations.filter((entry) => entry.file === location.file).map((entry) => entry.addressSpace),
  );
  const address = informationHex(location.address);
  return spaces.size > 1 ? `${location.addressSpace}:${address}` : address;
};

/**
 * One state field can have alternatives. Keep source attribution and unknown/absent distinct.
 * @param {unknown} value Raw project/runtime value or a known/unknown wrapper.
 * @returns {string | undefined} Human-readable value, or undefined for unavailable structures.
 */
const stateValue = (value: unknown): string | undefined => {
  if (typeof value === "number") {
    return informationHex(value);
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.kind === "unknown") {
      return "?";
    }
    if (record.kind === "known") {
      return stateValue(record.value);
    }
  }
  return undefined;
};

/**
 * Resolve a registered field conservatively; scalar shortcuts disappear for ambiguous emissions.
 * @param {string} field Validated placeholder name.
 * @param {LineInformation} info Facts for one artifact/project context.
 * @returns {string | undefined} Formatted field; undefined suppresses its whole template fragment.
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
 * @param {InformationTemplate} template Validated literal/field tokens.
 * @param {LineInformation} info Facts from one current snapshot.
 * @returns {string | undefined} Interpolated text, or undefined when a required field is missing.
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
 * @param {readonly LineInformation[]} infos Distinct artifact/project contexts for one line.
 * @param {readonly InformationTemplate[]} templates Selected fragments in display order.
 * @param {string} separator Inserted only between surviving fragments.
 * @param {number} maximum Total positive character budget, including the ellipsis.
 * @returns {string} Bounded presentation with context labels when required.
 */
export const renderInformation = (
  infos: readonly LineInformation[],
  templates: readonly InformationTemplate[],
  separator: string,
  maximum: number,
): string =>
  clip(
    infos
      .flatMap((info) => {
        const parts = templates
          .map((template) => renderTemplate(template, info))
          .filter((part): part is string => part !== undefined);
        if (!parts.length) {
          return [];
        }
        const prefix = infos.length > 1 ? `${info.label}: ` : "";
        return [`${prefix}${parts.join(separator)}`];
      })
      .join(" | "),
    maximum,
  );
