import { assertLinkRecipe } from "@uttori/asm-core/linker";

export {
  readAssemblyBuildManifest,
  type AssemblyBuildManifest,
} from "@uttori/asm-plugin-loader-node/build-configuration";

/** Shared CLI/worker request. Assembly never changes mode implicitly based on source text or file suffix. */
export type AssemblyBuildOperation = {
  readonly directory: string;
} & (
  | {
      readonly action: "assemble-object";
      readonly source: string;
      readonly output: string;
      readonly module: string;
      readonly sourceAdapter?: "asar" | "ca65";
      readonly config?: string;
    }
  | { readonly action: "library"; readonly objects: readonly string[]; readonly output: string }
  | {
      readonly action: "link" | "build-linked";
      readonly manifest: string;
      /** Host-selected parent configuration must still match the bytes that chose this manifest. */
      readonly selection?: { readonly file: string; readonly sha256: string };
    }
);

/** Small artifact receipt; the output itself is serialized and can be consumed in a different process. */
export interface AssemblyArtifactResult {
  readonly kind: "object" | "library";
  readonly outputFile: string;
  readonly sha256: string;
  readonly bytes: number;
  /** Replaceable source/target layout suggested by this module; payload ownership remains in the object. */
  readonly linkRecipe?: import("@uttori/asm-core").AssemblyLinkRecipe;
}

/** Editor-compatible artifact pair plus retained linker reports. Every path belongs to one immutable set. */
export interface AssemblyLinkedResult {
  readonly kind: "linked";
  readonly outputFile: string;
  readonly debugMapFile: string;
  readonly symbolsFile: string;
  readonly allocationFile: string;
  readonly recipeFile?: string;
  readonly inputSha256: string;
  readonly outputSha256: string;
  readonly debugMapFingerprint: string;
  readonly outputSize: number;
  readonly target: string;
  readonly architecture: string;
  readonly outputChanged: boolean;
  readonly debugMapChanged: boolean;
  /** Exact saved inputs used by the host, including manifest, recipe, configuration and serialized inputs. */
  readonly inputs: readonly { readonly path: string; readonly sha256: string }[];
}

export type AssemblyBuildResult = AssemblyArtifactResult | AssemblyLinkedResult;

/** Authenticate the small worker receipt before an editor can launch the returned ROM. */
function assertBuildResult(value: unknown): asserts value is AssemblyBuildResult {
  if (!isRecord(value) || !isText(value.outputFile)) {
    throw new Error("Invalid assembly build receipt.");
  }
  if (value.kind === "object" || value.kind === "library") {
    if (value.linkRecipe !== undefined) {
      assertLinkRecipe(value.linkRecipe);
    }
    if (
      typeof value.bytes === "number" &&
      Number.isSafeInteger(value.bytes) &&
      value.bytes >= 0 &&
      isHash(value.sha256)
    ) {
      return;
    }
  } else if (value.kind === "linked") {
    const strings = ["debugMapFile", "symbolsFile", "allocationFile", "target", "architecture"];
    if (
      strings.every((key) => isText(value[key])) &&
      (value.recipeFile === undefined || isText(value.recipeFile)) &&
      [value.inputSha256, value.outputSha256, value.debugMapFingerprint].every(isHash) &&
      typeof value.outputSize === "number" &&
      Number.isSafeInteger(value.outputSize) &&
      value.outputSize > 0 &&
      typeof value.outputChanged === "boolean" &&
      typeof value.debugMapChanged === "boolean" &&
      Array.isArray(value.inputs) &&
      value.inputs.length <= 65536 &&
      value.inputs.every(
        (input: unknown) => isRecord(input) && isText(input.path) && isHash(input.sha256),
      )
    ) {
      return;
    }
  }
  throw new Error("Invalid assembly build receipt.");
}

/** Return a validated receipt without retaining mutable data owned by an IPC caller. */
export function readAssemblyBuildResult(value: unknown): AssemblyBuildResult {
  assertBuildResult(value);
  return structuredClone(value);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && !value.includes("\0");
const isHash = (value: unknown): value is string =>
  typeof value === "string" && /^[\da-f]{64}$/.test(value);
const isPaths = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.length <= 65536 && value.every(isText);

/** Fail closed at the process boundary; misspelled fields must never silently discard build policy. */
function assertBuildOperation(value: unknown): asserts value is AssemblyBuildOperation {
  if (!isRecord(value) || !isText(value.directory)) {
    throw new Error("Assembly operation requires a working directory.");
  }
  let allowed: readonly string[];
  if (value.action === "assemble-object") {
    allowed = ["source", "output", "module", "config", "sourceAdapter"];
    if (![value.source, value.output, value.module].every(isText)) {
      throw new Error("Object assembly requires source, output and a stable module ID.");
    }
    if (value.config !== undefined && !isText(value.config)) {
      throw new Error("Object configuration must be a path.");
    }
    if (
      value.sourceAdapter !== undefined &&
      value.sourceAdapter !== "asar" &&
      value.sourceAdapter !== "ca65"
    ) {
      throw new Error("Unsupported object sourceAdapter.");
    }
  } else if (value.action === "library") {
    allowed = ["objects", "output"];
    if (!isPaths(value.objects) || value.objects.length === 0 || !isText(value.output)) {
      throw new Error("Library creation requires output and one or more object paths.");
    }
  } else if (value.action === "link" || value.action === "build-linked") {
    allowed = ["manifest", "selection"];
    if (!isText(value.manifest)) {
      throw new Error("Link/build requires a build manifest path.");
    }
    if (
      value.selection !== undefined &&
      (!isRecord(value.selection) ||
        !isText(value.selection.file) ||
        !isHash(value.selection.sha256) ||
        Object.keys(value.selection).some((key) => key !== "file" && key !== "sha256"))
    ) {
      throw new Error("Invalid build selection snapshot.");
    }
  } else {
    throw new Error("Unknown assembly build action.");
  }
  for (const key of Object.keys(value)) {
    if (!["action", "directory", ...allowed].includes(key)) {
      throw new Error(`Assembly ${value.action} does not accept ${key}.`);
    }
  }
}

/** Copy the validated request so subsequent caller edits cannot change an asynchronous build. */
export function readAssemblyBuildOperation(value: unknown): AssemblyBuildOperation {
  assertBuildOperation(value);
  return structuredClone(value);
}
