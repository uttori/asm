import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  acquireFileLease,
  durableReplace,
  readSourcePublication,
  sourceExportSha256,
} from "@uttori/asm-disassembler";

import { loadRomModificationProject, modificationOwnedPath } from "./modification-project.js";

/** One retained artifact, measured without following symbolic links. Reasons explain every protected item. */
export interface RetentionItem {
  readonly id: string;
  readonly path: string;
  readonly category: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly modifiedAt: string;
  readonly protected: readonly string[];
  readonly pinned: boolean;
}
/** The scope bounds dependency discovery. External projects must be represented by explicit pins. */
export interface RetentionInventory {
  readonly scope: string;
  readonly items: readonly RetentionItem[];
  readonly totalBytes: number;
  readonly eligibleBytes: number;
  readonly fingerprint: string;
}

/** Hash file content and names, rejecting special files rather than silently pruning their targets.
 * @param {string} file Regular file or directory whose complete descendants are inventoried.
 * @returns {object} Total bytes, content identity and newest modification time.
 */
function treeIdentity(file: string): { bytes: number; sha256: string; modifiedAt: string } {
  const hash = createHash("sha256");
  let bytes = 0;
  let modified = 0;
  const visit = (current: string, relative: string): void => {
    const stat = fs.lstatSync(current);
    modified = Math.max(modified, stat.mtimeMs);
    hash.update(JSON.stringify(relative));
    if (stat.isDirectory()) {
      hash.update("directory");
      for (const name of fs.readdirSync(current).sort()) {
        visit(path.join(current, name), `${relative}/${name}`);
      }
    } else if (stat.isFile()) {
      bytes += stat.size;
      hash.update("file");
      hash.update(sourceExportSha256(fs.readFileSync(current)));
    } else {
      throw new Error(`Retention cannot traverse a symbolic link or special file: ${current}`);
    }
  };
  visit(file, "");
  return { bytes, sha256: hash.digest("hex"), modifiedAt: new Date(modified).toISOString() };
}

/** Read a known small JSON receipt. Corrupt state blocks cleanup instead of looking unreferenced.
 * @param {string} file Expected regular JSON receipt path.
 * @returns {Record<string, unknown>} Parsed receipt; malformed or oversized files throw.
 */
function json(file: string): Record<string, unknown> {
  if (fs.statSync(file).size > 16 * 1024 * 1024) {
    throw new Error(`Retention receipt exceeds 16 MiB: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
}

/** Stable artifact pins use canonical absolute paths so moving a project cannot silently unpin history.
 * @param {string} root Modification directory owning the pin registry.
 * @returns {Record<string, string>} Artifact paths mapped to user-facing pin reasons.
 */
function pins(root: string): Record<string, string> {
  const file = path.join(root, ".retention-pins.json");
  return fs.existsSync(file) ? (json(file) as Record<string, string>) : {};
}

/** Inventory only tool-owned histories. Editable inputs, databases and capture archives are never candidates.
 * @param {object} options Modification manifest defining the project and sibling dependency scope.
 * @returns {RetentionInventory} Read-only inventory and fingerprint required for cleanup.
 */
export function reviewModificationRetention(options: { manifestFile: string }): RetentionInventory {
  const root = path.dirname(path.resolve(options.manifestFile));
  const project = loadRomModificationProject(options.manifestFile);
  const source = path.resolve(root, project.baseline.sourceDirectory);
  const scope = path.dirname(root);
  const pinned = pins(root);
  const references = new Map<string, Set<string>>();
  const romHashes = new Set<string>();
  const projectRoots = new Set<string>();
  const reference = (file: string, reason: string): void => {
    const key = path.resolve(file);
    const values = references.get(key) ?? new Set<string>();
    values.add(reason);
    references.set(key, values);
  };
  const manifestReferences = (file: string, owner = path.dirname(file)): void => {
    projectRoots.add(owner);
    const value = json(file) as {
      baseline?: { snapshotDirectory?: string; sourceDirectory?: string; romFile?: string };
    };
    if (value.baseline?.snapshotDirectory) {
      reference(
        path.resolve(owner, value.baseline.snapshotDirectory),
        `Baseline referenced by ${file}`,
      );
    }
    if (value.baseline?.sourceDirectory) {
      reference(
        path.resolve(owner, value.baseline.sourceDirectory),
        `Source referenced by ${file}`,
      );
    }
    if (value.baseline?.romFile) {
      reference(path.resolve(owner, value.baseline.romFile), `ROM referenced by ${file}`);
    }
  };
  let visited = 0;
  const scan = (directory: string): void => {
    if (++visited > 100000) {
      throw new Error(
        "Retention dependency scan exceeded 100,000 directories; narrow the project layout before cleanup.",
      );
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        continue;
      }
      if (entry.isDirectory()) {
        // Histories are handled separately; traversing retained source/captures would report obsolete dependencies as live.
        if (
          [
            "node_modules",
            ".git",
            "captures",
            "build",
            "inputs",
            "dist",
            "out",
            "graphify-out",
          ].includes(entry.name) ||
          entry.name.startsWith(".")
        ) {
          continue;
        }
        scan(file);
      } else if (entry.name === "modification.json") {
        manifestReferences(file);
      } else if (entry.name === "analysis.json") {
        const value = json(file) as { rom?: { contentSha256?: string } };
        if (value.rom?.contentSha256) {
          romHashes.add(value.rom.contentSha256);
        }
      } else if (entry.name === "rebase-review.json") {
        const value = json(file);
        for (const key of [
          "originalManifest",
          "candidateManifest",
          "baseRom",
          "ownedRom",
          "newRom",
        ]) {
          if (typeof value[key] === "string") {
            reference(value[key], `Rebase review ${file}`);
          }
        }
      }
    }
  };
  scan(scope);
  // Histories may be the only record pinning an older baseline; prune them in a separate reviewed pass first.
  const history = path.join(root, ".history");
  if (fs.existsSync(history)) {
    for (const name of fs.readdirSync(history)) {
      if (name.endsWith(".json")) {
        manifestReferences(path.join(history, name), root);
      }
    }
  }
  const currentFile = path.join(root, "build/current.json");
  if (fs.existsSync(currentFile)) {
    const current = json(currentFile);
    for (const key of ["outputPath", "finalOutput", "debugMapPath", "receiptFile"]) {
      if (typeof current[key] === "string") {
        reference(current[key], "Last successful build");
      }
    }
  }
  const publication = readSourcePublication(source);
  if (publication) {
    for (const file of [publication.previous, publication.candidate]) {
      reference(file, `Current publication recovery (${publication.phase})`);
    }
  }
  // A migration review may pin a superseded build before its destination analysis exists.
  for (const owner of projectRoots) {
    const migrations = modificationOwnedPath(owner, ".metadata-migrations");
    if (!fs.existsSync(migrations)) {
      continue;
    }
    for (const name of fs.readdirSync(migrations)) {
      const directory = modificationOwnedPath(owner, `.metadata-migrations/${name}`);
      const file = path.join(directory, "review.json");
      if (fs.existsSync(file) && !fs.existsSync(path.join(directory, "completed.json"))) {
        const review = json(file);
        if (typeof review.targetRomFile === "string") {
          reference(review.targetRomFile, "Target ROM for an unresolved metadata migration");
        }
      }
    }
  }
  const items: RetentionItem[] = [];
  const add = (file: string, category: string, reasons: string[] = []): void => {
    const absolute = path.resolve(file);
    for (const [dependency, causes] of references) {
      if (dependency === absolute || dependency.startsWith(absolute + path.sep)) {
        reasons.push(...causes);
      }
    }
    const pin = pinned[absolute];
    if (pin) {
      reasons.push(`Pinned: ${pin}`);
    }
    const identity = treeIdentity(absolute);
    items.push({
      id: sourceExportSha256(absolute),
      path: absolute,
      category,
      ...identity,
      protected: [...new Set(reasons)],
      pinned: Boolean(pin),
    });
  };
  const categories = [
    "build",
    ".baselines",
    ".history",
    ".editor-drafts",
    ".source-drafts",
    ".metadata-migrations",
    ".rebase-reviews",
  ];
  let unresolvedDraft = false;
  for (const category of categories) {
    const directory = modificationOwnedPath(root, category);
    if (!fs.existsSync(directory)) {
      continue;
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (category === "build" && entry.name === "current.json") {
        continue;
      }
      if (
        category === ".history"
          ? !entry.isFile() || !entry.name.endsWith(".json")
          : !entry.isDirectory()
      ) {
        continue;
      }
      const file = modificationOwnedPath(root, `${category}/${entry.name}`);
      const reasons: string[] = [];
      if (category === "build") {
        const receipt = path.join(file, "verification.json");
        if (!fs.existsSync(receipt)) {
          reasons.push("Incomplete build needs inspection");
        } else if (romHashes.has(String(json(receipt).outputSha256))) {
          reasons.push("ROM identity is used by an analysis project in this scope");
        }
      }
      if (category === ".editor-drafts" && !fs.existsSync(path.join(file, "saved.json"))) {
        reasons.push("Unresolved editor draft");
        unresolvedDraft = true;
      }
      if (category === ".source-drafts") {
        const state = path.join(file, "import-state.json");
        if (!fs.existsSync(state) || !json(state).complete) {
          reasons.push("Unresolved source draft");
          unresolvedDraft = true;
        }
      }
      if (
        category === ".metadata-migrations" &&
        !fs.existsSync(path.join(file, "completed.json"))
      ) {
        reasons.push("Unresolved metadata migration review");
      }
      if (
        category === ".rebase-reviews" &&
        !fs.existsSync(path.join(root, "rebase-accepted.json"))
      ) {
        reasons.push("Rebase is not accepted");
      }
      add(file, category, reasons);
    }
  }
  // Source publication journals establish ownership of sibling staging folders; names alone are insufficient.
  const publications = path.join(source, "analysis/.editing/publications");
  const generations = new Map<string, string[]>();
  if (fs.existsSync(publications)) {
    for (const name of fs.readdirSync(publications)) {
      if (!name.endsWith(".json")) {
        continue;
      }
      const receipt = json(path.join(publications, name));
      for (const key of ["previousDirectory", "candidateDirectory"]) {
        const file = receipt[key];
        if (typeof file !== "string" || !fs.existsSync(file)) {
          continue;
        }
        if (
          path.dirname(file) !== path.dirname(source) ||
          !path.basename(file).startsWith(`.${path.basename(source)}-`)
        ) {
          throw new Error("Publication journal contains an unexpected retention path.");
        }
        const reasons = generations.get(file) ?? [];
        if (receipt.phase !== "published") {
          reasons.push("Unfinished or failed publication; inspect recovery before cleanup");
        }
        generations.set(file, reasons);
      }
    }
  }
  for (const [file, reasons] of generations) {
    add(file, "source-generation", reasons);
  }
  const drafts = path.join(source, "analysis/.editing/drafts");
  if (fs.existsSync(drafts)) {
    for (const name of fs.readdirSync(drafts)) {
      if (!name.endsWith(".json")) {
        continue;
      }
      const file = path.join(drafts, name);
      const value = json(file).value as { saved?: boolean } | undefined;
      add(file, "metadata-draft", value?.saved ? [] : ["Unresolved metadata draft"]);
    }
  }
  const guarded = items.map((item) =>
    item.category === ".baselines" && unresolvedDraft
      ? { ...item, protected: [...item.protected, "Retained for unresolved source/editor drafts"] }
      : item,
  );
  guarded.sort((a, b) => a.path.localeCompare(b.path));
  const dependencies = [...references]
    .map(([file, reasons]) => [file, [...reasons].sort()])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return {
    scope,
    items: guarded,
    totalBytes: guarded.reduce((n, i) => n + i.bytes, 0),
    eligibleBytes: guarded.filter((i) => !i.protected.length).reduce((n, i) => n + i.bytes, 0),
    fingerprint: sourceExportSha256(
      JSON.stringify({ items: guarded, dependencies, romHashes: [...romHashes].sort(), pinned }),
    ),
  };
}

/** Pin/unpin only a discovered artifact. Pins survive editor restarts and are included in stale-review detection.
 * @param {object} options Discovered artifact ID and optional label; omitted label removes its pin.
 */
export function pinModificationRetention(options: {
  manifestFile: string;
  itemId: string;
  label?: string;
}): void {
  const root = path.dirname(path.resolve(options.manifestFile));
  const lease = acquireFileLease(path.join(root, ".build.lock"));
  try {
    const item = reviewModificationRetention(options).items.find(
      (entry) => entry.id === options.itemId,
    );
    if (!item) {
      throw new Error("Retention item no longer exists.");
    }
    const next = pins(root);
    if (options.label?.trim()) {
      next[item.path] = options.label.trim().slice(0, 200);
    } else {
      delete next[item.path];
    }
    durableReplace(path.join(root, ".retention-pins.json"), JSON.stringify(next, null, 2));
  } finally {
    lease.release();
  }
}

/** Delete exactly the reviewed eligible set. A changed dependency or any changed content rejects the entire request.
 * @param {object} options Exact inventory fingerprint and explicitly selected eligible artifact IDs.
 * @returns {object} Removed artifact/byte counts and durable progress receipt.
 */
export function pruneModificationRetention(options: {
  manifestFile: string;
  fingerprint: string;
  selected: readonly string[];
}): { removed: number; bytes: number; receiptFile: string } {
  const root = path.dirname(path.resolve(options.manifestFile));
  const project = loadRomModificationProject(options.manifestFile);
  const source = path.resolve(root, project.baseline.sourceDirectory);
  const leases: ReturnType<typeof acquireFileLease>[] = [];
  try {
    // Match publisher lock order (metadata before source). Build serialization also excludes editor/migration writes.
    leases.push(acquireFileLease(path.join(root, ".build.lock")));
    leases.push(acquireFileLease(path.join(source, "analysis/.editing/writer.lock")));
    leases.push(acquireFileLease(path.join(source, ".uttori-publication.lock")));
    const inventory = reviewModificationRetention(options);
    if (inventory.fingerprint !== options.fingerprint) {
      throw new Error("Retention review is stale. Refresh storage before cleanup.");
    }
    const selected = new Set(options.selected);
    const items = inventory.items.filter((item) => selected.has(item.id));
    if (
      !selected.size ||
      selected.size !== options.selected.length ||
      items.length !== selected.size ||
      items.some((item) => item.protected.length)
    ) {
      throw new Error("Only reviewed, unprotected retention items can be removed.");
    }
    const receiptFile = path.join(root, ".retention-receipts", `${randomUUID()}.json`);
    const removed: string[] = [];
    const receipt = (phase: string) =>
      durableReplace(
        receiptFile,
        JSON.stringify(
          {
            phase,
            scope: inventory.scope,
            items,
            removed,
            reviewedFingerprint: inventory.fingerprint,
            updatedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    receipt("prepared");
    for (const item of items) {
      // Recheck immediately before each removal; external editors do not participate in our leases.
      if (treeIdentity(item.path).sha256 !== item.sha256) {
        throw new Error(
          `Retained content changed before cleanup: ${item.path}. Partial progress is recorded in ${receiptFile}.`,
        );
      }
      fs.rmSync(item.path, { recursive: true });
      removed.push(item.path);
      receipt("removing");
    }
    receipt("complete");
    return {
      removed: removed.length,
      bytes: items.reduce((sum, item) => sum + item.bytes, 0),
      receiptFile,
    };
  } finally {
    for (const lease of leases.reverse()) {
      lease.release();
    }
  }
}
