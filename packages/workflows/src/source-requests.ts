import type { SourceResearchRequest } from "./source-research.js";

/** Physical-code selection is bounded and never implies a temporal join between capture streams. */
export interface SourceGraphicsQuery {
  /** Capture archive identity anchoring the graphics query. */
  readonly captureSha256: string;
  /** Optional CPU program counter within the capture address space. */
  readonly pc?: number;
  /** Optional physical ROM offset when querying by file position. */
  readonly physicalOffset?: number;
  /** Maximum number of graphics records to return. */
  readonly limit?: number;
}

/** Actions without arguments accept only the shared request context. */
type NoRequestFields = object;

/** Action-specific fields cannot accidentally accompany an unrelated mutation. */
export interface SourceRequestMap {
  /** Initialize a source project from an original ROM image. */
  init: { readonly rom: string; readonly dizRawFile?: string; readonly mapper?: string };
  /** Report generation or workspace status for an optional candidate commit. */
  status: { readonly candidate?: string };
  /** Migrate working assembly toward linked builds. */
  prepare: { readonly assembly?: "linked" };
  /** Preview a generation commit without applying it. */
  preview: { readonly candidate: string };
  /** Apply a previewed generation commit to the working tree. */
  apply: { readonly candidate: string };
  /** Complete a multi-step operation with an optional status message. */
  finish: { readonly message?: string };
  /** Abort the current long-running source operation. */
  abort: NoRequestFields;
  /** Discard a generation candidate without applying it. */
  discard: { readonly candidate: string };
  /** Remove transient generation artifacts from the workspace. */
  clean: NoRequestFields;
  /** Build the current source tree without applying regeneration. */
  build: NoRequestFields;
  /** Refresh disassembly indexes for the working tree. */
  index: NoRequestFields;
  /** Run static analysis passes on the working tree. */
  analyze: NoRequestFields;
  /** Rebuild research catalogs from saved inputs. */
  catalog: NoRequestFields;
  /** Query graphics evidence tied to an imported capture. */
  graphics: { readonly graphicsQuery?: SourceGraphicsQuery };
  /** Relocate a declared object within the source layout. */
  relocate: { readonly objectId: string };
  /** Expand a declared object by an explicit byte capacity. */
  expand: { readonly expansionSize: number };
  /** Apply a bounded research edit proposal. */
  research: { readonly research?: SourceResearchRequest };
  /** Import one or more capture archives into the project. */
  import: { readonly recoverPartial?: boolean } & (
    | { readonly capture: string; readonly captures?: never }
    | { readonly captures: readonly string[]; readonly capture?: never }
  );
}

/** Known source workflow action names keyed by request map entries. */
export type SourceAction = keyof SourceRequestMap;
/** Union of all action-specific request field names for excess-property checking. */
type RequestFields = { [Action in SourceAction]: keyof SourceRequestMap[Action] }[SourceAction];

/** Overlays belong to inspection/proposal operations; saved builds continue to read saved inputs. */
interface SourceRequestContext {
  readonly directory: string;
  readonly signal?: AbortSignal;
  readonly onProgress?: (message: string) => void;
  readonly overlays?: readonly { readonly path: string; readonly bytes: Uint8Array }[];
}

/** The optional-never fields preserve narrowing while rejecting unrelated request arguments. */
export type SourceOperation<Action extends SourceAction = SourceAction> = {
  [Key in Action]: SourceRequestContext & { readonly action: Key } & SourceRequestMap[Key] & {
      readonly [Field in Exclude<RequestFields, keyof SourceRequestMap[Key]>]?: never;
    };
}[Action];

/** Only structured request fields are accepted across terminal and worker boundaries. */
const fields: { readonly [Action in SourceAction]: readonly string[] } = {
  init: ["rom", "dizRawFile", "mapper"],
  status: ["candidate"],
  prepare: ["assembly"],
  preview: ["candidate"],
  apply: ["candidate"],
  finish: ["message"],
  abort: [],
  discard: ["candidate"],
  clean: [],
  build: [],
  index: [],
  analyze: [],
  catalog: [],
  graphics: ["graphicsQuery"],
  relocate: ["objectId"],
  expand: ["expansionSize"],
  research: ["research"],
  import: ["capture", "captures", "recoverPartial"],
};

/**
 * Narrow IPC payloads to plain objects before reading action fields.
 * @param value Decoded request root.
 * @returns Whether keyed fields can be read safely.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/**
 * Confirm a string names a registered source workflow action.
 * @param value Candidate action field.
 * @returns Whether the action exists in the request map.
 */
const isAction = (value: unknown): value is SourceAction =>
  typeof value === "string" && Object.hasOwn(fields, value);
/**
 * Reject empty or NUL-terminated path and identity strings.
 * @param value Candidate string field.
 * @returns Whether the string is safe for filesystem use.
 */
const isText = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && !value.includes("\0");

/** Validate transport shape here; research values receive their complete domain validation before any edit is proposed. */
function assertRequest(value: unknown): asserts value is SourceOperation {
  if (!isRecord(value) || !isAction(value.action) || !isText(value.directory)) {
    throw new Error("Source operation requires a known action and project directory.");
  }
  const allowed = new Set([
    "action",
    "directory",
    "signal",
    "onProgress",
    "overlays",
    ...fields[value.action],
  ]);
  for (const [key, field] of Object.entries(value)) {
    if (field !== undefined && !allowed.has(key)) {
      throw new Error(`Source ${value.action} does not accept ${key}.`);
    }
  }
  for (const key of [
    "rom",
    "dizRawFile",
    "mapper",
    "candidate",
    "message",
    "capture",
    "objectId",
  ]) {
    if (value[key] !== undefined && !isText(value[key])) {
      throw new Error(`Invalid source ${key}.`);
    }
  }
  if (value.signal !== undefined && !(value.signal instanceof AbortSignal)) {
    throw new Error("Invalid source cancellation signal.");
  }
  if (value.onProgress !== undefined && typeof value.onProgress !== "function") {
    throw new Error("Invalid source progress callback.");
  }
  if (
    value.overlays !== undefined &&
    (!Array.isArray(value.overlays) ||
      value.overlays.length > 65536 ||
      !value.overlays.every(
        (item: unknown) => isRecord(item) && isText(item.path) && item.bytes instanceof Uint8Array,
      ))
  ) {
    throw new Error("Invalid source overlays.");
  }
  if (value.assembly !== undefined && value.assembly !== "linked") {
    throw new Error("Source preparation supports only explicit linked migration.");
  }
  if (value.action === "init" && !isText(value.rom)) {
    throw new Error("Initialization requires an original ROM path.");
  }
  if (["preview", "apply", "discard"].includes(value.action) && !isText(value.candidate)) {
    throw new Error("Source operation requires a generation commit.");
  }
  if (value.action === "relocate" && !isText(value.objectId)) {
    throw new Error("Relocation requires a declared object ID.");
  }
  if (
    value.action === "expand" &&
    (typeof value.expansionSize !== "number" ||
      !Number.isSafeInteger(value.expansionSize) ||
      value.expansionSize < 1)
  ) {
    throw new Error("Expansion requires an explicit capacity in bytes.");
  }
  if (value.action === "import") {
    if (value.recoverPartial !== undefined && typeof value.recoverPartial !== "boolean") {
      throw new Error("Invalid partial capture recovery selection.");
    }
    const single = isText(value.capture);
    const batch =
      Array.isArray(value.captures) &&
      value.captures.length > 0 &&
      value.captures.length <= 65536 &&
      value.captures.every(isText);
    if (
      single === batch ||
      (value.capture !== undefined && !single) ||
      (value.captures !== undefined && !batch)
    ) {
      throw new Error("Import requires one archive or one nonempty capture queue, exclusively.");
    }
  }
  if (value.graphicsQuery !== undefined) {
    const query = value.graphicsQuery;
    if (!isRecord(query) || !isText(query.captureSha256)) {
      throw new Error("Invalid source graphics selection.");
    }
    for (const key of ["pc", "physicalOffset", "limit"]) {
      if (
        query[key] !== undefined &&
        (typeof query[key] !== "number" || !Number.isSafeInteger(query[key]) || query[key] < 0)
      ) {
        throw new Error(`Invalid graphics ${key}.`);
      }
    }
  }
  if (value.research !== undefined) {
    const request = value.research;
    if (
      !isRecord(request) ||
      (request.kind !== undefined && request.kind !== "symbols" && request.kind !== "analysis") ||
      (request.symbolId !== undefined && !isText(request.symbolId))
    ) {
      throw new Error("Invalid research request.");
    }
    const change = request.change;
    if (change !== undefined) {
      if (!isRecord(change)) {
        throw new Error("Invalid research change.");
      }
      if (request.kind === "analysis") {
        if (
          !isText(change.expectedDocumentSha256) ||
          !["annotations", "analysis"].includes(String(change.collection))
        ) {
          throw new Error("Invalid research analysis identity.");
        }
        if (change.kind === "remove") {
          if (!isText(change.id)) {
            throw new Error("Research removal requires a record ID.");
          }
        } else if (
          change.kind !== "put" ||
          !isText(change.path) ||
          !isText(change.reason) ||
          !isRecord(change.value)
        ) {
          throw new Error("Invalid research analysis edit.");
        }
      } else if (change.kind === "aliases") {
        if (!Array.isArray(change.aliases) || !change.aliases.every(isText)) {
          throw new Error("Invalid research aliases.");
        }
      } else if (change.kind === "suppression") {
        if (typeof change.suppressed !== "boolean") {
          throw new Error("Invalid research suppression.");
        }
      } else if (change.kind !== "entry-point" || typeof change.enabled !== "boolean") {
        throw new Error("Invalid research symbol edit.");
      }
    }
  }
}

/** Parse commands and IPC before opening a project; the returned union keeps action/arguments paired. */
export function readSourceOperation(value: unknown): SourceOperation {
  assertRequest(value);
  return value;
}
