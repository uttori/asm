/**
 * A bank-qualified location in the original image. Omitted fields are unconstrained.
 * fileOffset is headerless and anchors the record's address/start, not a live source location.
 * State keys are target-defined mapper registers; unknown runtime values never match a constraint.
 */
export interface ResearchMapping {
  /** Headerless original-image byte offset of the record anchor; undefined matches any offset. */
  readonly fileOffset?: number;
  /** Mapper register constraints (1-64 keys, non-negative integers or flags); undefined matches any state. */
  readonly state?: Readonly<Record<string, number | boolean>>;
}

/**
 * Accept only non-null, non-array objects.
 * @param value Candidate value.
 * @returns Whether value is a plain record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reject empty selectors and misspelled envelope fields instead of silently broadening a decision. */
export function isResearchMapping(value: unknown): value is ResearchMapping {
  if (!isRecord(value)) {
    return false;
  }
  const record = value;
  if (Object.keys(record).some((key) => key !== "fileOffset" && key !== "state")) {
    return false;
  }
  if (
    record.fileOffset !== undefined &&
    !(Number.isSafeInteger(record.fileOffset) && Number(record.fileOffset) >= 0)
  ) {
    return false;
  }
  let fields = 0;
  if (record.state !== undefined) {
    if (typeof record.state !== "object" || record.state === null || Array.isArray(record.state)) {
      return false;
    }
    const entries = Object.entries(record.state);
    if (entries.length === 0 || entries.length > 64) {
      return false;
    }
    for (const [key, entry] of entries) {
      if (
        !/^[A-Za-z][\w.]{0,63}$/.test(key) ||
        (typeof entry !== "boolean" && !(Number.isSafeInteger(entry) && Number(entry) >= 0))
      ) {
        return false;
      }
    }
    fields = entries.length;
  }
  return record.fileOffset !== undefined || fields > 0;
}

/** Match all supplied constraints. delta advances an interval's physical anchor with its CPU address. */
export function matchesResearchMapping(
  mapping: ResearchMapping | undefined,
  location: { readonly fileOffset?: number; readonly state?: Readonly<Record<string, unknown>> },
  delta = 0,
): boolean {
  if (!mapping) {
    return true;
  }
  if (mapping.fileOffset !== undefined && location.fileOffset !== mapping.fileOffset + delta) {
    return false;
  }
  return Object.entries(mapping.state ?? {}).every(
    ([key, value]) => location.state?.[key] === value,
  );
}
