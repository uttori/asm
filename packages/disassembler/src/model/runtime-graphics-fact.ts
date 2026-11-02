/**
 * A producer-verified graphics port operation. Timing stays in the immutable capture archive.
 * Physical CPU offsets use the domain named by offsetStateField in instruction snapshots
 * (NES prg0 excludes both header and trainer). They are never inferred from a bus PC.
 */
export interface RuntimeGraphicsFact {
  /** Bus address space of the accessed graphics port. */
  readonly addressSpace: string;
  /** Port address within addressSpace. */
  readonly address: number;
  /** Bus PC of the accessing instruction; never used to infer a physical offset. */
  readonly pc: number;
  /** Producer-named bus actor that performed the access. */
  readonly actor: string;
  /** Whether the access came from ordinary execution, an interrupt, or an unknown source. */
  readonly context: "instruction" | "interrupt" | "unattributed";
  /** Port access direction; only writes may carry an effect. */
  readonly direction: "read" | "write";
  /** Byte transferred through the port (0-255). */
  readonly value: number;
  /** Physical CPU offset of the instruction in the named snapshot domain, or null when unmapped. */
  readonly cpuMapping: {
    readonly offsetStateField: string;
    readonly physicalOffset: number;
  } | null;
  /** Actual storage effects; blocked writes have no byte destinations. */
  readonly effect: {
    readonly target: string;
    readonly outcome: "written" | "blocked";
    readonly bytes: readonly { readonly offset: number; readonly value: number }[];
  } | null;
}

/**
 * Accept only non-null, non-array objects.
 * @param value Candidate value.
 * @returns Whether value is a plain record.
 */
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/**
 * Accept non-negative safe integers.
 * @param value Candidate value.
 * @returns Whether value is an unsigned integer.
 */
const unsigned = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
/**
 * Accept identifiers of 1-64 characters starting with a letter.
 * @param value Candidate value.
 * @returns Whether value is a valid producer name.
 */
const name = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z][\w.-]{0,63}$/.test(value);

/** Validate target-neutral storage facts at every import and decode boundary. */
export function isRuntimeGraphicsFact(value: unknown): value is RuntimeGraphicsFact {
  if (
    !record(value) ||
    !name(value.addressSpace) ||
    !unsigned(value.address) ||
    !unsigned(value.pc) ||
    !name(value.actor) ||
    (value.context !== "instruction" &&
      value.context !== "interrupt" &&
      value.context !== "unattributed") ||
    (value.direction !== "read" && value.direction !== "write") ||
    !unsigned(value.value) ||
    value.value > 255
  ) {
    return false;
  }
  if (
    value.cpuMapping !== null &&
    (!record(value.cpuMapping) ||
      !name(value.cpuMapping.offsetStateField) ||
      !unsigned(value.cpuMapping.physicalOffset))
  ) {
    return false;
  }
  if (value.effect === null) {
    return true;
  }
  const effect = value.effect;
  if (
    !record(effect) ||
    !name(effect.target) ||
    value.direction !== "write" ||
    !Array.isArray(effect.bytes) ||
    effect.bytes.length > 16
  ) {
    return false;
  }
  if (effect.outcome === "blocked") {
    return effect.bytes.length === 0;
  }
  return (
    effect.outcome === "written" &&
    effect.bytes.length > 0 &&
    effect.bytes.every(
      (byte: unknown) =>
        record(byte) && unsigned(byte.offset) && unsigned(byte.value) && byte.value <= 255,
    )
  );
}
