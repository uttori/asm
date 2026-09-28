import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  analysisProjectRevision,
  applyMetadataEdit,
  canonicalJson,
  commitAnalysisProjectSelectedEdit,
  durableReplace,
  loadSourceExportManifest,
  loadSourceOwnership,
  sourceExportSha256,
  type AnalysisMetadataEditRecord,
  type AnalysisProjectSnapshot,
  type AnalysisProjectRevision,
  type EditableMetadataRecord,
  type MetadataEditRequest,
  type MetadataShard,
  type SqliteAnalysisStore,
} from "@uttori/asm-disassembler";
import {
  loadSnesStructMap,
  snesSourceLabelNames,
  validateSnesRamMap,
  validateSnesStructMap,
  planSnesStructRomFields,
  createSnesAddressContext,
  snesRomAddressSpace,
  type SnesMapper,
} from "@uttori/asm-plugin-snes";

import {
  coordinateEdit,
  editOperations,
  metadataDrafts,
  saveMetadataDraft,
} from "./edit-coordinator.js";

/** Serializable worker protocol. Commit repeats preview validation against the same revision. */
export interface MetadataWorkerInput {
  readonly action:
    | "draft-save"
    | "draft-list"
    | "operation-history"
    | "list"
    | "preview"
    | "commit"
    | "map-read"
    | "map-preview"
    | "map-commit"
    | "map-history"
    | "map-restore"
    | "map-restore-preview";
  /** Stable preview identity, retained across transport errors and retries. */
  readonly operationId?: string;
  readonly draft?: { readonly id: string; readonly value: unknown };
  readonly sourceDirectory?: string;
  readonly revision?: AnalysisProjectRevision;
  readonly request?: MetadataEditRequest;
  readonly shard?: MetadataShard;
  readonly query?: string;
  readonly offset?: number;
  readonly selectedId?: string;
  /** Cursor/coverage ROM offset for selecting existing metadata, including mirrored CPU anchors. */
  readonly outputStart?: number;
  readonly source?: { readonly file: string; readonly sha256: string };
  readonly map?: {
    readonly name: "ram-map.json" | "struct-map.json";
    readonly beforeSha256: string;
    readonly text: string;
  };
  readonly receiptId?: string;
}

/** A bounded metadata page. Runtime/CFG details never cross into the webview. */
export interface MetadataPage {
  readonly revision: AnalysisProjectRevision;
  readonly records: readonly EditableMetadataRecord[];
  readonly total: number;
  readonly selected?: EditableMetadataRecord;
  readonly history: readonly Pick<
    AnalysisMetadataEditRecord,
    "id" | "sequence" | "description" | "restores"
  >[];
  readonly addressSpaces: readonly { readonly id: string; readonly name: string }[];
}

/** Exact file receipt, written before publication so interrupted saves remain recoverable. */
export interface MetadataMapReceipt {
  readonly format: "uttori-metadata-map-edit";
  readonly id: string;
  readonly romSha256: string;
  readonly sourceDirectory: string;
  readonly createdAt: string;
  readonly name: "ram-map.json" | "struct-map.json";
  readonly before: string | null;
  readonly after: string | null;
  readonly beforeSha256: string;
  readonly afterSha256: string;
}

/**
 * Read editable collections without CFG variants or capture history. Receipts preserve prior facts.
 * @param {SqliteAnalysisStore} store Worker-owned connection inside a transaction.
 * @returns {AnalysisProjectSnapshot} Validated raw metadata for optimistic edits.
 */
export const metadataSnapshot = (store: SqliteAnalysisStore): AnalysisProjectSnapshot => {
  const manifest = store.manifest();
  const shards = {
    labels: store.loadTable("labels"),
    comments: store.loadTable("comments"),
    annotations: store.loadTable("annotations"),
    analysis: store.analysisByKinds(["function", "target-override", "target-set", "metadata-edit"]),
    regions: [],
    runtime: [],
    imports: [],
    evidence: store.loadTable("evidence"),
  };
  store.validateView(shards);
  return { manifest, shards, revision: analysisProjectRevision(manifest) };
};

/**
 * Validate against the same namespace and mapper bounds as export, before publishing any metadata.
 * @param {AnalysisProjectSnapshot} snapshot Current project or a prepared replacement.
 * @param {string} directory Associated source-export root.
 * @param {MetadataWorkerInput["map"]} [candidate] Optional unpublished input text to validate.
 * @returns {ReadonlySet<string>} Exported names, including qualified fields, for reference checks.
 */
export const validateMetadataInputs = (
  snapshot: AnalysisProjectSnapshot,
  directory: string,
  candidate?: MetadataWorkerInput["map"],
): ReadonlySet<string> => {
  const manifest = loadSourceExportManifest(directory);
  if (
    manifest.target !== snapshot.manifest.target ||
    manifest.mapper !== snapshot.manifest.mapping.mapper ||
    manifest.rom.contentSha256 !== snapshot.manifest.rom.contentSha256
  ) {
    throw new Error("The source export does not belong to this analysis project and ROM.");
  }
  // The exporter loader creates a missing RAM map. Preview must stay read-only, so validate
  // existing bytes directly and treat a missing optional input as an empty map.
  const ramFile = path.join(directory, "ram-map.json");
  let ramText = emptyMap("ram-map.json");
  if (fs.existsSync(ramFile)) {
    ramText = fs.readFileSync(ramFile, "utf8");
  }
  if (candidate?.name === "ram-map.json") {
    ramText = candidate.text;
  }
  const ram = validateSnesRamMap(JSON.parse(ramText));
  const structs =
    candidate?.name === "struct-map.json"
      ? validateSnesStructMap(JSON.parse(candidate.text))
      : loadSnesStructMap(directory);
  const mapper = snapshot.manifest.mapping.mapper as SnesMapper;
  const names = snesSourceLabelNames(snapshot.shards, mapper, snapshot.manifest.rom.contentSize, [
    ...ram.map(({ name }) => name),
    ...(structs?.structures.map(({ id }) => id) ?? []),
    ...(structs?.bindings.map(({ name }) => name) ?? []),
    ...(structs?.constants?.map(({ name }) => name) ?? []),
  ]);
  planSnesStructRomFields(
    structs ? { ...structs, sourceBytes: new Uint8Array() } : undefined,
    snapshot.manifest.rom.contentSize,
    (offset) => snesRomAddressSpace.fromOutputOffset(offset, createSnesAddressContext(mapper)),
  );
  const symbols = new Set([...names.values(), ...ram.map(({ name }) => name)]);
  for (const layout of structs?.structures ?? []) {
    symbols.add(layout.id);
    for (const field of layout.fields) {
      symbols.add(`${layout.id}.${field.name}`);
    }
  }
  for (const binding of structs?.bindings ?? []) {
    symbols.add(binding.name);
    for (const field of binding.structure.fields) {
      symbols.add(`${binding.name}.${field.name}`);
    }
  }
  for (const constant of structs?.constants ?? []) {
    symbols.add(constant.name);
  }
  const context = createSnesAddressContext(mapper);
  const offset = (space: string, address: number): number => {
    if (space === "rom.file") {
      return address;
    }
    return space === "snes.cpu" ? snesRomAddressSpace.toOutputOffset(address, context) : -1;
  };
  const namedOffsets = new Set(
    snapshot.shards.labels.map((label) => offset(label.addressSpace, label.address)),
  );
  for (const record of snapshot.shards.analysis) {
    if (record.kind !== "function") {
      continue;
    }
    const fileOffset = offset(record.addressSpace, record.address);
    if (
      fileOffset < 0 ||
      fileOffset >= snapshot.manifest.rom.contentSize ||
      namedOffsets.has(fileOffset)
    ) {
      continue;
    }
    namedOffsets.add(fileOffset);
    symbols.add(`Fn_${record.address.toString(16).toUpperCase().padStart(6, "0")}`);
  }
  return symbols;
};

/**
 * Find external text references that regeneration cannot rewrite. Conservative token matching may
 * include comments; the preview names each file so callers can review instead of losing a symbol.
 * @param {string} directory Export root containing generated files and optional owned assembly.
 * @param {readonly string[]} symbols Names being removed or renamed.
 * @returns {readonly string[]} User-owned files with a matching identifier.
 */
const ownedReferences = (directory: string, symbols: readonly string[]): readonly string[] => {
  if (!symbols.length) {
    return [];
  }
  const generated = new Set(
    loadSourceExportManifest(directory).files.map(({ path: file }) => file),
  );
  const matches: string[] = [];
  let visited = 0;
  const visit = (folder: string): void => {
    for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
      if (++visited > 20000) {
        throw new Error(
          "Reference review exceeded 20,000 entries. Narrow the source tree before changing names.",
        );
      }
      if (item.isSymbolicLink()) {
        continue;
      }
      const file = path.join(folder, item.name);
      if (item.isDirectory()) {
        if (
          !["analysis", "build", "assets", "node_modules", ".git", ".vscode", ".editing"].includes(
            item.name,
          )
        ) {
          visit(file);
        }
      } else if (
        /\.(asm|s|inc)$/i.test(item.name) &&
        !generated.has(path.relative(directory, file).split(path.sep).join("/"))
      ) {
        if (fs.statSync(file).size > 4 * 1024 * 1024) {
          throw new Error(`Reference review requires a smaller source file: ${file}`);
        }
        const tokens = new Set(
          fs
            .readFileSync(file, "utf8")
            .replace(/\[[^\n\r\]]*]/g, "")
            .toLowerCase()
            .match(/[_a-z][\w.]*/g) ?? [],
        );
        for (const token of [...tokens]) {
          tokens.add(token.split(".")[0]);
        }
        if (symbols.some((name) => tokens.has(name.toLowerCase()))) {
          matches.push(file);
        }
      }
    }
  };
  visit(directory);
  return matches;
};

/**
 * List, preview, or commit native metadata. Preparation is pure and commits recheck revisions,
 * source bytes, names, and external references. Save success means metadata saved, not regenerated.
 * @param {SqliteAnalysisStore} store Worker-owned project connection.
 * @param {string} directory Native analysis directory.
 * @param {MetadataWorkerInput} input User intent and captured identities.
 * @returns {unknown} Bounded page, review receipt, or committed revision.
 */
export const processMetadata = (
  store: SqliteAnalysisStore,
  directory: string,
  input: MetadataWorkerInput,
): unknown => {
  if (input.action === "draft-save") {
    if (!input.draft) {
      throw new Error("Missing draft.");
    }
    saveMetadataDraft(directory, input.draft.id, input.draft.value);
    return { saved: true };
  }
  if (input.action === "draft-list") {
    return metadataDrafts(directory);
  }
  if (input.action === "operation-history") {
    return editOperations(directory)
      .slice(0, 100)
      .map(({ id, createdAt, phase, effect, result, error }) => ({
        id,
        createdAt,
        phase,
        effect,
        receipt: result?.receipt,
        error,
      }));
  }
  if (["commit", "map-commit", "map-restore"].includes(input.action)) {
    return coordinateEdit(store, directory, input, () => {
      if (input.action === "commit") {
        return processMetadataUncoordinated(store, directory, input);
      }
      // A map save must also exclude legacy SQLite writers after checking its native revision.
      return store.transaction(() => processMapMetadata(metadataSnapshot(store), directory, input));
    });
  }
  return processMetadataUncoordinated(store, directory, input);
};

/** Execute one intent while the shared coordinator owns writes; previews remain read-only.
 * @param {SqliteAnalysisStore} store Worker connection.
 * @param {string} directory Native project root.
 * @param {MetadataWorkerInput} input Validated protocol request.
 * @returns {unknown} Preview or saved outcome.
 */
const processMetadataUncoordinated = (
  store: SqliteAnalysisStore,
  directory: string,
  input: MetadataWorkerInput,
): unknown => {
  const snapshot = store.transaction(() => metadataSnapshot(store), false);
  if (input.action.startsWith("map-")) {
    return processMapMetadata(snapshot, directory, input);
  }
  if (input.action === "list") {
    const shard = input.shard ?? "labels";
    if (!["labels", "comments", "annotations", "analysis"].includes(shard)) {
      throw new Error("Choose an editable metadata collection.");
    }
    const records = (snapshot.shards[shard] as readonly EditableMetadataRecord[]).filter(
      (record) =>
        shard !== "analysis" ||
        ("kind" in record && ["target-override", "target-set"].includes(record.kind)),
    );
    const query = (input.query ?? "").toLowerCase();
    const filtered = records.filter((record) =>
      canonicalJson(record).toLowerCase().includes(query),
    );
    const offset = Math.max(0, Math.trunc(input.offset ?? 0));
    const context = createSnesAddressContext(snapshot.manifest.mapping.mapper as SnesMapper);
    let selected = input.selectedId ? records.find(({ id }) => id === input.selectedId) : undefined;
    if (!selected && input.outputStart !== undefined) {
      selected = records.find((record) => {
        if ("start" in record) {
          return (
            record.addressSpace === "rom.file" &&
            record.start <= input.outputStart! &&
            record.end > input.outputStart!
          );
        }
        if (!("address" in record)) {
          return false;
        }
        let at = record.address;
        if (record.addressSpace === "snes.cpu") {
          at = snesRomAddressSpace.toOutputOffset(at, context);
        } else if (record.addressSpace !== "rom.file") {
          return false;
        }
        return at === input.outputStart;
      });
    }
    return {
      revision: snapshot.revision,
      records: filtered.slice(offset, offset + 100),
      total: filtered.length,
      selected,
      history: snapshot.shards.analysis
        .filter((record): record is AnalysisMetadataEditRecord => record.kind === "metadata-edit")
        .sort((a, b) => b.sequence - a.sequence)
        .slice(0, 100)
        .map(({ id, sequence, description, restores }) => ({
          id,
          sequence,
          description,
          restores,
        })),
      addressSpaces: snapshot.manifest.addressSpaces.map(({ id, name }) => ({ id, name })),
    } satisfies MetadataPage;
  }
  if (canonicalJson(input.revision) !== canonicalJson(snapshot.revision)) {
    throw new Error(
      "Metadata changed while this draft was open. Your draft is retained; reload and review it against the current records.",
    );
  }
  if (
    input.source &&
    sourceExportSha256(fs.readFileSync(input.source.file)) !== input.source.sha256
  ) {
    throw new Error(
      "Source changed after this editor opened. Preserve the draft and inspect the current source again.",
    );
  }
  if (!input.request) {
    throw new Error("Choose a metadata operation to preview.");
  }
  const applied = applyMetadataEdit(snapshot, input.request);
  const sourceDirectory = input.sourceDirectory ?? path.dirname(directory);
  const beforeNames = validateMetadataInputs(snapshot, sourceDirectory);
  const afterNames = validateMetadataInputs(
    { ...snapshot, shards: applied.project.shards },
    sourceDirectory,
  );
  const changed = [...beforeNames].filter((name) => !afterNames.has(name));
  const references = ownedReferences(sourceDirectory, changed);
  if (references.length) {
    throw new Error(
      `Update user-owned references before changing these names:\n${references.join("\n")}`,
    );
  }
  if (input.action === "preview") {
    return {
      receipt: applied.receipt,
      symbols: {
        removed: changed,
        added: [...afterNames].filter((name) => !beforeNames.has(name)),
      },
      revision: snapshot.revision,
      status: "Ready to save metadata; source regeneration will remain pending.",
    };
  }
  if (input.action !== "commit") {
    throw new Error("Unknown metadata action.");
  }
  const committed = commitAnalysisProjectSelectedEdit(directory, snapshot, applied.project);
  return {
    receipt: applied.receipt,
    revision: committed.revision,
    status: "Metadata saved; regeneration pending.",
  };
};

/**
 * Publish a single reviewed map with exact-byte receipts. A prepared receipt plus current file
 * hashes is sufficient to distinguish committed, unapplied, and conflicted interrupted writes.
 * @param {AnalysisProjectSnapshot} snapshot Authoritative analysis identity for map validation.
 * @param {string} directory Analysis directory in which receipts are retained.
 * @param {MetadataWorkerInput} input Map intent; only the two user-owned map basenames are accepted.
 * @returns {unknown} Current input, receipt list, preview, or saved receipt.
 */
const processMapMetadata = (
  snapshot: AnalysisProjectSnapshot,
  directory: string,
  input: MetadataWorkerInput,
): unknown => {
  const sourceDirectory = path.resolve(input.sourceDirectory ?? path.dirname(directory));
  const historyDirectory = path.join(directory, "metadata-map-history");
  const read = (file: string): string | null => {
    if (!fs.existsSync(file)) {
      return null;
    }
    if (fs.statSync(file).size > 4 * 1024 * 1024) {
      throw new Error("Map editing is limited to 4 MiB inputs.");
    }
    const bytes = fs.readFileSync(file);
    const text = bytes.toString("utf8");
    // Receipts promise exact input bytes. Do not normalize invalid UTF-8 through replacement
    // characters; that would make an inverse silently lose the original file content.
    if (!Buffer.from(text, "utf8").equals(bytes)) {
      throw new Error(
        "The map is not valid UTF-8. Preserve and repair its raw bytes before editing metadata.",
      );
    }
    return text;
  };
  const fingerprint = (text: string | null): string =>
    text === null ? "missing" : sourceExportSha256(text);
  const readReceipt = (id: string): MetadataMapReceipt => {
    if (!/^[\w-]+$/.test(id)) {
      throw new Error("Choose a map receipt.");
    }
    const receipt = JSON.parse(
      fs.readFileSync(path.join(historyDirectory, `${id}.json`), "utf8"),
    ) as MetadataMapReceipt;
    if (
      receipt.format !== "uttori-metadata-map-edit" ||
      receipt.id !== id ||
      !["ram-map.json", "struct-map.json"].includes(receipt.name) ||
      receipt.romSha256 !== snapshot.manifest.rom.contentSha256 ||
      receipt.sourceDirectory !== sourceDirectory ||
      fingerprint(receipt.before) !== receipt.beforeSha256 ||
      fingerprint(receipt.after) !== receipt.afterSha256
    ) {
      throw new Error("This receipt is invalid or belongs to a different map or ROM.");
    }
    return receipt;
  };
  if (input.action === "map-history") {
    if (!fs.existsSync(historyDirectory)) {
      return [];
    }
    return fs
      .readdirSync(historyDirectory)
      .filter((name) => name.endsWith(".json"))
      .map((name) => readReceipt(name.slice(0, -5)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100)
      .map((receipt) => {
        const current = fingerprint(read(path.join(sourceDirectory, receipt.name)));
        let status = "conflict";
        if (current === receipt.afterSha256) {
          status = "applied";
        } else if (current === receipt.beforeSha256) {
          status = "not applied or restored";
        }
        return { id: receipt.id, name: receipt.name, status, createdAt: receipt.createdAt };
      });
  }
  let candidate = input.map;
  let remove = false;
  if (input.action === "map-restore" || input.action === "map-restore-preview") {
    const receipt = readReceipt(input.receiptId ?? "");
    remove = receipt.before === null;
    candidate = {
      name: receipt.name,
      beforeSha256: receipt.afterSha256,
      text: receipt.before ?? emptyMap(receipt.name),
    };
  }
  if (!candidate || !["ram-map.json", "struct-map.json"].includes(candidate.name)) {
    throw new Error("Choose a RAM or structure map.");
  }
  const file = path.join(sourceDirectory, candidate.name);
  const before = read(file);
  const beforeSha256 = fingerprint(before);
  if (input.action === "map-read") {
    return {
      name: candidate.name,
      text: before ?? emptyMap(candidate.name),
      sha256: beforeSha256,
      revision: snapshot.revision,
    };
  }
  if (candidate.beforeSha256 !== beforeSha256) {
    throw new Error(
      "This map changed after the draft was opened. The draft is retained; compare with the current file before saving.",
    );
  }
  if (input.revision && canonicalJson(input.revision) !== canonicalJson(snapshot.revision)) {
    throw new Error(
      "Analysis changed since the map preview. Reload metadata and review the retained draft.",
    );
  }
  if (Buffer.byteLength(candidate.text, "utf8") > 4 * 1024 * 1024) {
    throw new Error("Map edits are limited to 4 MiB.");
  }
  const afterNames = validateMetadataInputs(snapshot, sourceDirectory, candidate);
  let beforeNames: ReadonlySet<string>;
  let baselineWarning: string | undefined;
  try {
    beforeNames = validateMetadataInputs(snapshot, sourceDirectory);
  } catch (error) {
    // An invalid external JSON edit must remain repairable. Only a verified exported ownership
    // map can substitute for its unreadable namespace; never silently skip reference checks.
    const manifest = loadSourceExportManifest(sourceDirectory);
    const ownership = loadSourceOwnership({
      directory: sourceDirectory,
      manifest,
      relative: manifest.ownershipFile ?? "",
    });
    if (!ownership) {
      throw error;
    }
    beforeNames = new Set(
      ownership.entries.flatMap((entry) => (entry.symbol ? [entry.symbol] : [])),
    );
    baselineWarning =
      "The saved input is invalid. Reference checks use the verified generated namespace. The receipt retains the invalid original bytes.";
  }
  const references = ownedReferences(
    sourceDirectory,
    [...beforeNames].filter((name) => !afterNames.has(name)),
  );
  if (references.length) {
    throw new Error(
      `Update user-owned references before changing map names:\n${references.join("\n")}`,
    );
  }
  const receipt: MetadataMapReceipt = {
    format: "uttori-metadata-map-edit",
    id: input.operationId ?? randomUUID(),
    createdAt: new Date().toISOString(),
    romSha256: snapshot.manifest.rom.contentSha256,
    sourceDirectory,
    name: candidate.name,
    before,
    after: remove ? null : candidate.text,
    beforeSha256,
    afterSha256: remove ? "missing" : sourceExportSha256(candidate.text),
  };
  if (beforeSha256 === receipt.afterSha256) {
    throw new Error("The map has no changes to save.");
  }
  if (input.action === "map-preview" || input.action === "map-restore-preview") {
    return {
      receipt,
      symbols: {
        removed: [...beforeNames].filter((name) => !afterNames.has(name)),
        added: [...afterNames].filter((name) => !beforeNames.has(name)),
      },
      warning: baselineWarning,
      status: "Validated input change; regeneration pending after save.",
    };
  }
  if (!["map-commit", "map-restore"].includes(input.action)) {
    throw new Error("Unknown map action.");
  }
  fs.mkdirSync(historyDirectory, { recursive: true });
  if (!/^[\dA-Za-z-]{1,100}$/.test(receipt.id)) {
    throw new Error("Invalid map operation identity.");
  }
  if (fingerprint(read(file)) !== beforeSha256) {
    throw new Error("Map changed before publication. Reload it and review the retained draft.");
  }
  // The project lease coordinates JSON and SQLite operations. Persist exact versions before
  // exposing the input; the operation journal reconciles interruption against these hashes.
  durableReplace(
    path.join(historyDirectory, `${receipt.id}.json`),
    JSON.stringify(receipt, null, 2) + "\n",
  );
  if (receipt.after === null) {
    fs.unlinkSync(file);
  } else {
    durableReplace(file, receipt.after);
  }
  return {
    receiptId: receipt.id,
    receipt,
    sha256: receipt.afterSha256,
    status: "Map saved; regeneration pending.",
  };
};

/**
 * Optional maps start from an empty schema-valid draft without writing an input until Save.
 * @param {"ram-map.json" | "struct-map.json"} name Supported user-owned input basename.
 * @returns {string} Editable default document.
 */
const emptyMap = (name: "ram-map.json" | "struct-map.json"): string =>
  JSON.stringify(
    name === "ram-map.json"
      ? { format: "uttori-asm-snes-ram-map", schemaVersion: 1, variables: [] }
      : {
          format: "uttori-asm-snes-struct-map",
          schemaVersion: 1,
          structures: [],
          bindings: [],
          constants: [],
        },
    null,
    2,
  ) + "\n";
