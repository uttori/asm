/** Exact identity required to navigate without collapsing CPU, RAM, or mirrored ROM spaces. */
export interface AnalysisNavigationTarget {
  /** Analysis project directory owning the navigation context. */
  readonly projectDirectory: string;
  /** Analysis target id bound to the manifest. */
  readonly target: string;
  /** Expected ROM content hash for identity matching. */
  readonly romContentSha256: string;
  /** Expected ROM byte length for identity matching. */
  readonly romContentSize: number;
  /** Address space containing the navigation address. */
  readonly addressSpace: string;
  /** Address within the space to open. */
  readonly address: number;
  /** Explicit mirrored ROM offsets when known. */
  readonly outputOffsets: readonly number[];
  /** Architecture hints narrowing disassembly selection. */
  readonly architectureHints: readonly string[];
  /** Evidence record ids associated with the navigation row. */
  readonly recordIds: readonly string[];
}

/**
 * Validate string-array fields on externally supplied navigation arguments without coercing
 * their contents.
 * @param value Untrusted navigation field.
 * @returns Whether every array member is a string.
 */
const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

/**
 * Validate the complete command payload before navigation, including ROM hash, safe nonnegative
 * addresses, and explicit output offsets.
 * @param value Untrusted command argument.
 * @returns Whether the complete qualified navigation shape is valid.
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
 * @param value Raw command argument or containing tree row.
 * @returns Validated target, or undefined for invalid arguments.
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
