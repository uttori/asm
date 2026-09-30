/** Exact identity required to navigate without collapsing CPU, RAM, or mirrored ROM spaces. */
export interface AnalysisNavigationTarget {
  readonly projectDirectory: string;
  readonly target: string;
  readonly romContentSha256: string;
  readonly romContentSize: number;
  readonly addressSpace: string;
  readonly address: number;
  readonly outputOffsets: readonly number[];
  readonly architectureHints: readonly string[];
  readonly recordIds: readonly string[];
}

/**
 * Validate string-array fields on externally supplied navigation arguments without coercing
 * their contents.
 * @param {unknown} value Untrusted navigation field.
 * @returns {boolean} Whether every array member is a string.
 */
const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

/**
 * Validate the complete command payload before navigation, including ROM hash, safe nonnegative
 * addresses, and explicit output offsets.
 * @param {unknown} value Untrusted command argument.
 * @returns {boolean} Whether the complete qualified navigation shape is valid.
 */
export const isAnalysisNavigationTarget = (value: unknown): value is AnalysisNavigationTarget => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const target = value as Partial<AnalysisNavigationTarget>;
  return (
    typeof target.projectDirectory === "string" &&
    target.projectDirectory.length > 0 &&
    typeof target.target === "string" &&
    target.target.length > 0 &&
    typeof target.romContentSha256 === "string" &&
    /^[\da-f]{64}$/u.test(target.romContentSha256) &&
    Number.isSafeInteger(target.romContentSize) &&
    target.romContentSize! >= 0 &&
    typeof target.addressSpace === "string" &&
    target.addressSpace.length > 0 &&
    Number.isSafeInteger(target.address) &&
    target.address! >= 0 &&
    Array.isArray(target.outputOffsets) &&
    target.outputOffsets.every((offset) => Number.isSafeInteger(offset) && offset >= 0) &&
    isStringArray(target.architectureHints) &&
    isStringArray(target.recordIds)
  );
};

/**
 * Accept a qualified command payload or a tree row carrying one.
 * @param {unknown} value Raw command argument or containing tree row.
 * @returns {AnalysisNavigationTarget | undefined} Validated target, or undefined for invalid arguments.
 */
export const parseAnalysisNavigationTarget = (
  value: unknown,
): AnalysisNavigationTarget | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  // Tree commands pass raw payloads; context-menu actions can pass the containing row.
  const candidate = "navigationTarget" in value ? value.navigationTarget : value;
  return isAnalysisNavigationTarget(candidate) ? candidate : undefined;
};
