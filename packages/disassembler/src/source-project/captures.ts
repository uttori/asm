import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import { acquireFileLease, durableReplace } from "../internal/durable-files.js";
import type { ImportReport } from "../model/project-types.js";
import { sourceContentHash } from "./generation.js";
import { assertSourcePath } from "./git.js";

function errorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return undefined;
}

/** Historical input identity. Its filename and hashes do not imply the archive is still available. */
export interface SourceCaptureArchive {
  readonly name: string;
  readonly sha256: string;
  readonly bytes: number;
  /** Hash of the verified manifest, which binds every companion artifact by its own content hash. */
  readonly companionSha256?: string;
}

/** Canonical importer identity survives archive re-encoding and differs from the archive byte hash. */
export interface SourceCaptureIdentity {
  readonly sha256: string;
  readonly sourceName: string;
  readonly profile: string;
  readonly observedEvents: number;
  readonly droppedEvents: number;
  /** Verified input fingerprints only. Imported evidence must remain available independently of these files. */
  readonly archives: readonly SourceCaptureArchive[];
}

/** Git-tracked import provenance contains identities only, never capture contents or required host paths. */
export interface SourceCaptureCatalog {
  readonly format: "uttori-capture-catalog";
  readonly version: 1;
  readonly romSha256: string;
  readonly captures: readonly SourceCaptureIdentity[];
}

const hashPattern = /^[\da-f]{64}$/;
/** Runtime array check without widening the validated readonly contract to any[]. */
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function observedCount(counts: Readonly<Record<string, number>>, key: string): number | undefined {
  return Object.hasOwn(counts, key) ? counts[key] : undefined;
}
const validHash = (value: unknown): value is string =>
  typeof value === "string" && hashPattern.test(value);
const validCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;

/** Validate names as single portable components; catalog data never selects paths outside a supplied bundle. */
function validName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1024 &&
    !/[\0\n\r/\\]/.test(value) &&
    value !== "." &&
    value !== ".."
  );
}

/** Authoring files and locks stay inside the selected checkout, including through existing ancestors. */
function catalogPath(root: string, name: string): string {
  assertSourcePath(name);
  let current = path.resolve(root);
  for (const component of name.split("/")) {
    current = path.join(current, component);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new Error("Capture catalogs cannot follow symlinks.");
      }
    } catch (error) {
      if (errorCode(error) !== "ENOENT") {
        throw error;
      }
    }
  }
  return current;
}

function assertSourceCaptureCatalog(
  value: unknown,
  romSha256: string,
): asserts value is SourceCaptureCatalog {
  if (!isRecord(value)) {
    throw new Error("Invalid source capture catalog or original-ROM identity.");
  }
  const catalogRom = value.romSha256;
  const captureEntries = value.captures;
  if (
    value.format !== "uttori-capture-catalog" ||
    value.version !== 1 ||
    !validHash(catalogRom) ||
    catalogRom !== romSha256 ||
    !isUnknownArray(captureEntries) ||
    captureEntries.length > 10000
  ) {
    throw new Error("Invalid source capture catalog or original-ROM identity.");
  }
  const identities = new Set<string>();
  const archiveOwners = new Map<string, string>();
  for (const entry of captureEntries) {
    if (!isRecord(entry)) {
      throw new Error("Invalid or duplicate canonical capture identity.");
    }
    const sha256 = entry.sha256;
    const sourceName = entry.sourceName;
    const profile = entry.profile;
    const observedEvents = entry.observedEvents;
    const droppedEvents = entry.droppedEvents;
    const archiveEntries = entry.archives;
    if (
      !validHash(sha256) ||
      identities.has(sha256) ||
      !validName(sourceName) ||
      typeof profile !== "string" ||
      profile === "" ||
      profile.length > 128 ||
      !validCount(observedEvents) ||
      !validCount(droppedEvents) ||
      !isUnknownArray(archiveEntries) ||
      archiveEntries.length > 32
    ) {
      throw new Error("Invalid or duplicate canonical capture identity.");
    }
    identities.add(sha256);
    const archiveIds = new Set<string>();
    for (const archiveEntry of archiveEntries) {
      if (!isRecord(archiveEntry)) {
        throw new Error("Invalid or duplicate capture archive binding.");
      }
      const name = archiveEntry.name;
      const archiveSha = archiveEntry.sha256;
      const bytes = archiveEntry.bytes;
      const companion = archiveEntry.companionSha256;
      if (
        !validName(name) ||
        !validHash(archiveSha) ||
        !validCount(bytes) ||
        bytes === 0 ||
        (companion !== undefined && !validHash(companion)) ||
        archiveIds.has(archiveSha)
      ) {
        throw new Error("Invalid or duplicate capture archive binding.");
      }
      const owner = archiveOwners.get(archiveSha);
      if (owner && owner !== sha256) {
        throw new Error("One archive is bound to conflicting canonical capture identities.");
      }
      archiveOwners.set(archiveSha, sha256);
      archiveIds.add(archiveSha);
    }
  }
}

/** Validate before trusting a catalog from a branch, clone or external private-input bundle. */
export function parseSourceCaptureCatalog(value: unknown, romSha256: string): SourceCaptureCatalog {
  assertSourceCaptureCatalog(value, romSha256);
  return value;
}

/** Catalog absence is explicit during first import or extraction; malformed existing data never resets. */
export function readSourceCaptureCatalog(
  root: string,
  name: string,
  romSha256: string,
): {
  readonly catalog: SourceCaptureCatalog;
  readonly fileSha256?: string;
} {
  const file = catalogPath(root, name);
  let bytes: Buffer;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 * 1024) {
      throw new Error("Capture catalog must be a regular file within its 8 MiB budget.");
    }
    bytes = fs.readFileSync(file);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") {
      throw error;
    }
    return { catalog: { format: "uttori-capture-catalog", version: 1, romSha256, captures: [] } };
  }
  return {
    catalog: parseSourceCaptureCatalog(JSON.parse(bytes.toString("utf8")), romSha256),
    fileSha256: sourceContentHash(bytes),
  };
}

/** Extract durable import identities without changing or materializing normalized runtime evidence. */
export function reconcileSourceCaptureCatalog(
  catalog: SourceCaptureCatalog,
  reports: readonly ImportReport[],
  binding?: { readonly sourceSha256: string; readonly archive: SourceCaptureArchive },
): SourceCaptureCatalog {
  const captures = new Map(catalog.captures.map((capture) => [capture.sha256, capture]));
  for (const report of reports) {
    if (
      !["uttori-asm-instruction-trace", "uttori-asm-bus-trace", "uttori-nes-ppu-evidence"].includes(
        report.format,
      )
    ) {
      continue;
    }
    // Reports can retain a historical absolute source name. Only its portable basename is published.
    const sourceName = report.sourceName.split(/[/\\]/).at(-1)!;
    const capture: SourceCaptureIdentity = {
      sha256: report.sourceSha256,
      sourceName,
      profile: report.indexProfile ?? "full",
      observedEvents:
        observedCount(report.imported, "graphicsEvents") ??
        observedCount(report.imported, "busEvents") ??
        observedCount(report.imported, "executionEvents") ??
        0,
      droppedEvents:
        report.unsupported.find((entry) => entry.field === "instruction-addresses")?.count ?? 0,
      archives: captures.get(report.sourceSha256)?.archives ?? [],
    };
    const previous = captures.get(capture.sha256);
    if (previous && canonicalJson({ ...previous, sourceName }) !== canonicalJson(capture)) {
      throw new Error(
        `Retained capture provenance differs from the Git catalog: ${capture.sha256}`,
      );
    }
    captures.set(capture.sha256, previous ?? capture);
  }
  if (binding) {
    const capture = captures.get(binding.sourceSha256);
    if (!capture) {
      throw new Error("Cannot catalog an archive before a successful evidence import.");
    }
    const prior = capture.archives.find((archive) => archive.sha256 === binding.archive.sha256);
    // A filename is only a discovery hint. Renaming an identical archive must remain idempotent,
    // while changed size or companion identity still requires explicit reconciliation.
    if (prior && canonicalJson(prior) !== canonicalJson({ ...binding.archive, name: prior.name })) {
      throw new Error(
        "An existing archive binding changed; reconcile its companion identity explicitly.",
      );
    }
    if (!prior) {
      captures.set(capture.sha256, {
        ...capture,
        archives: [...capture.archives, binding.archive].toSorted((a, b) =>
          a.sha256.localeCompare(b.sha256),
        ),
      });
    }
  }
  return parseSourceCaptureCatalog(
    {
      ...catalog,
      captures: [...captures.values()].toSorted((a, b) => a.sha256.localeCompare(b.sha256)),
    },
    catalog.romSha256,
  );
}

/** Save only against the read snapshot; evidence imports and Git-file writes are separate durable operations. */
export function writeSourceCaptureCatalog(
  root: string,
  name: string,
  catalog: SourceCaptureCatalog,
  expectedSha256?: string,
): void {
  parseSourceCaptureCatalog(catalog, catalog.romSha256);
  const file = catalogPath(root, name);
  const lock = catalogPath(root, ".uttori-local/capture-catalog.lock");
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const lease = acquireFileLease(lock);
  try {
    const current = readSourceCaptureCatalog(root, name, catalog.romSha256);
    if (current.fileSha256 !== expectedSha256) {
      throw new Error(
        "Capture catalog changed during import. Refresh its inventory before committing.",
      );
    }
    const bytes = JSON.stringify(catalog, null, 2) + "\n";
    if (Buffer.byteLength(bytes) > 8 * 1024 * 1024) {
      throw new Error("Capture catalog exceeds its 8 MiB budget.");
    }
    if (sourceContentHash(bytes) !== current.fileSha256) {
      durableReplace(file, bytes);
    }
  } finally {
    lease.release();
  }
}

/** Streamed source archives have no default policy ceiling beyond exact JavaScript byte accounting. */
export const DEFAULT_SOURCE_CAPTURE_MAX_BYTES = Number.MAX_SAFE_INTEGER;

/** Stream archive identity with cancellation and an optional per-archive ceiling. Companion artifacts are separately verified by the importer. */
export async function fingerprintSourceCapture(
  file: string,
  signal?: AbortSignal,
  maxBytes = DEFAULT_SOURCE_CAPTURE_MAX_BYTES,
): Promise<SourceCaptureArchive> {
  signal?.throwIfAborted();
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("Capture byte budget must be a positive safe integer.");
  }
  const before = fs.lstatSync(file, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.size <= 0n) {
    throw new Error("Capture archive must be a nonempty regular file.");
  }
  if (before.size > BigInt(maxBytes)) {
    throw new Error(
      `Capture archive '${file}' is ${(Number(before.size) / 1024 ** 3).toFixed(2)} GiB and exceeds the project's byte budget of ${(maxBytes / 1024 ** 3).toFixed(2)} GiB (${maxBytes} bytes). Increase limits.captureBytes in .uttori/project.json to import this archive.`,
    );
  }
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of fs.createReadStream(file, { signal })) {
    if (!Buffer.isBuffer(chunk)) {
      throw new Error("Capture archive read failed.");
    }
    hash.update(chunk);
    bytes += chunk.length;
    if (bytes > maxBytes) {
      throw new Error("Capture archive grew beyond the project's byte budget.");
    }
  }
  const after = fs.lstatSync(file, { bigint: true });
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.mtimeNs !== after.mtimeNs ||
    before.ctimeNs !== after.ctimeNs ||
    before.size !== after.size ||
    BigInt(bytes) !== before.size
  ) {
    throw new Error("Capture archive changed while hashing.");
  }
  const manifestFile = `${file}.context/manifest.json`;
  let companionSha256: string | undefined;
  try {
    const stat = fs.lstatSync(manifestFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1048576) {
      throw new Error("Invalid capture companion manifest.");
    }
    companionSha256 = sourceContentHash(fs.readFileSync(manifestFile));
  } catch (error) {
    if (errorCode(error) !== "ENOENT") {
      throw error;
    }
  }
  return {
    name: path.basename(file),
    sha256: hash.digest("hex"),
    bytes,
    ...(companionSha256 ? { companionSha256 } : {}),
  };
}
