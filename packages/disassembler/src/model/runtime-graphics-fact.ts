/** A producer-verified graphics port operation. Timing stays in the immutable capture archive.
 * Physical CPU offsets use the domain named by offsetStateField in instruction snapshots
 * (NES prg0 excludes both header and trainer). They are never inferred from a bus PC.
 */
export interface RuntimeGraphicsFact {
  readonly addressSpace: string;
  readonly address: number;
  readonly pc: number;
  readonly actor: string;
  readonly context: "instruction" | "interrupt" | "unattributed";
  readonly direction: "read" | "write";
  readonly value: number;
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

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const unsigned = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
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
