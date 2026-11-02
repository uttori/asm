import fs from "node:fs";
import path from "node:path";

import type { WorkspaceIndex } from "@uttori/asm-core/tooling";
import {
  parseResearchDocument,
  readResearchInputs,
  renameResearchSymbol,
  validateSourceLabelName,
  type ProjectLabel,
} from "@uttori/asm-disassembler";
import { openSourceProject } from "@uttori/asm-disassembler/source-project";
import {
  CreateFile,
  Range,
  TextEdit,
  type Position,
  type WorkspaceEdit,
} from "vscode-languageserver";

import {
  pathToUri,
  uriToPath,
  renameDefinitionFor,
  renameEditsFor,
  renameStructFieldsFor,
} from "./providers.js";
import { renameRecipeExpression, sourceRecipeRename } from "./recipe-rename.js";

/** Read-only editor buffer snapshot. Versions allow the client to reject an edit after concurrent typing. */
export interface RenameBuffer {
  /** Document URI of the open buffer. */
  readonly uri: string;
  /** LSP version the client last reported. */
  readonly version: number;
  /** Full buffer text at that version. */
  readonly text: string;
}

/** JSON objects, including arrays, can carry string fields. Null is not an object here. */
function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** True when the value is an array whose elements still need their own checks. */
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** True when the payload is a project label with identity, address and evidence. */
function isProjectLabel(value: unknown): value is ProjectLabel {
  if (!isJsonObject(value) || !isUnknownArray(value.evidence)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.addressSpace === "string" &&
    typeof value.address === "number" &&
    typeof value.name === "string" &&
    (value.sourceName === undefined || typeof value.sourceName === "string") &&
    (value.suppressed === undefined || typeof value.suppressed === "boolean") &&
    value.evidence.every((entry) => typeof entry === "string")
  );
}

/** True when the payload is a compact generation symbol with identity, address and evidence. */
function isCatalogSymbol(value: unknown): value is SymbolCatalog["symbols"][number] {
  if (!isJsonObject(value) || !isUnknownArray(value.evidence)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.addressSpace === "string" &&
    typeof value.address === "number" &&
    value.evidence.every((entry) => typeof entry === "string")
  );
}

/** True when the payload is a version-1 `uttori-source-symbols` catalog. */
function isSymbolCatalog(value: unknown): value is SymbolCatalog {
  if (!isJsonObject(value) || !isUnknownArray(value.symbols)) {
    return false;
  }
  return (
    value.format === "uttori-source-symbols" &&
    value.version === 1 &&
    typeof value.romSha256 === "string" &&
    value.symbols.every(isCatalogSymbol)
  );
}

/** Compact generation output; original addresses remain stable after source movement. */
interface SymbolCatalog {
  /** Catalog kind. Only this format is rewritten by rename. */
  readonly format: "uttori-source-symbols";
  /** Schema version. Rename rejects any other value. */
  readonly version: 1;
  /** SHA-256 of the original ROM this catalog was generated from. */
  readonly romSha256: string;
  /** Original-address symbols whose names track source movement. */
  readonly symbols: readonly {
    readonly id: string;
    readonly name: string;
    readonly addressSpace: string;
    readonly address: number;
    readonly evidence: readonly string[];
  }[];
}

/** Stop at repository boundaries, including linked-worktree .git files and nested projects. */
function projectRoot(file: string): string | undefined {
  let directory = path.dirname(file);
  while (true) {
    if (fs.existsSync(path.join(directory, ".git"))) {
      return fs.existsSync(path.join(directory, ".uttori/project.json")) ? directory : undefined;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return undefined;
    }
    directory = parent;
  }
}

/** Identify requests needing unsaved research buffers without opening SQLite or assembling source. */
export function researchRenameRootFor(
  index: WorkspaceIndex,
  file: string,
  position: Position,
): string | undefined {
  const definition = renameDefinitionFor(index, file, position);
  return definition &&
    ["label", "struct", "structMember"].includes(definition.kind) &&
    (!definition.containerName || definition.kind === "structMember")
    ? projectRoot(definition.location.file)
    : undefined;
}

/** Full-document JSON replacement is one member of the same undoable workspace edit as source F2. */
function wholeDocument(text: string): Range {
  const lines = text.split("\n");
  return Range.create(0, 0, lines.length - 1, lines.at(-1)!.length);
}

/** Layout anchors follow the same native F2 edit as their source declarations, including unsaved JSON. */
function layoutRenameEdit(
  root: string,
  name: string,
  romSha256: string,
  oldName: string,
  newName: string,
  buffers: readonly RenameBuffer[],
  fieldContainers?: readonly string[],
): NonNullable<WorkspaceEdit["documentChanges"]>[number] | undefined {
  const file = path.join(root, name),
    uri = pathToUri(file);
  const buffer = buffers.find((item) => item.uri === uri);
  if (!buffer && !fs.existsSync(file)) {
    return undefined;
  }
  if (
    fs.existsSync(file) &&
    (!fs.lstatSync(file).isFile() || fs.statSync(file).size > 8 * 1024 * 1024)
  ) {
    throw new Error("Rename requires a bounded regular layout document.");
  }
  const before = buffer?.text ?? fs.readFileSync(file, "utf8");
  if (Buffer.byteLength(before) > 8 * 1024 * 1024) {
    throw new Error("Layout rename exceeds its document budget.");
  }
  const layout: unknown = JSON.parse(before);
  if (
    !isJsonObject(layout) ||
    layout.format !== "uttori-snes-layout" ||
    layout.version !== 1 ||
    layout.romSha256 !== romSha256
  ) {
    throw new Error("Layout does not match the source project's ROM identity.");
  }
  let changed = false;
  for (const collection of ["extents", "objects", "freeSpace", "references"]) {
    const records = layout[collection];
    if (records === undefined) {
      continue;
    }
    if (!isUnknownArray(records)) {
      throw new Error(`Invalid layout collection: ${collection}`);
    }
    for (const record of records) {
      if (!isJsonObject(record)) {
        throw new Error(`Invalid layout record: ${collection}`);
      }
      for (const field of ["startSymbol", "endSymbol"]) {
        if (!fieldContainers && record[field] === oldName) {
          record[field] = newName;
          changed = true;
        }
      }
      if (collection === "references" && typeof record.expression === "string") {
        const renamed = renameRecipeExpression(
          record.expression,
          oldName,
          newName,
          fieldContainers,
        );
        changed ||= renamed !== record.expression;
        record.expression = renamed;
      }
    }
  }
  if (!changed) {
    return undefined;
  }
  return {
    textDocument: { uri, version: buffer?.version ?? null },
    edits: [TextEdit.replace(wholeDocument(before), JSON.stringify(layout, null, 2) + "\n")],
  };
}

/**
 * Combine ordinary source rename with Git research intent. This function never writes files, SQLite,
 * or Git history. Open JSON buffers participate so two F2 operations work without an intervening save.
 */
export async function researchRenameEditsFor(
  index: WorkspaceIndex,
  file: string,
  position: Position,
  newName: string,
  buffers: readonly RenameBuffer[],
): Promise<WorkspaceEdit | null> {
  const ordinary = renameEditsFor(index, file, position, newName);
  const definition = renameDefinitionFor(index, file, position);
  if (
    !ordinary?.changes ||
    !definition ||
    !["label", "struct", "structMember"].includes(definition.kind) ||
    (definition.containerName && definition.kind !== "structMember")
  ) {
    return ordinary;
  }
  const root = projectRoot(definition.location.file);
  if (!root) {
    return ordinary;
  }
  const project = await openSourceProject(root);
  const relativeDefinition = path
    .relative(root, definition.location.file)
    .split(path.sep)
    .join("/");
  const sourceRoot = project.configuration.sourceRoots.find((name) =>
    relativeDefinition.startsWith(`${name}/`),
  );
  if (!sourceRoot) {
    return ordinary;
  }
  const recipe = sourceRecipeRename(root, sourceRoot, definition, newName, buffers);
  if (recipe?.fieldContainers) {
    const related = renameStructFieldsFor(index, definition.name, newName, recipe.fieldContainers);
    for (const [uri, edits] of Object.entries(related.changes ?? {})) {
      const existing = ordinary.changes[uri] ?? [];
      const ranges = new Set(existing.map((edit) => JSON.stringify(edit.range)));
      for (const edit of edits) {
        const key = JSON.stringify(edit.range);
        if (!ranges.has(key)) {
          existing.push(edit);
          ranges.add(key);
        }
      }
      ordinary.changes[uri] = existing;
    }
  }

  const changes: NonNullable<WorkspaceEdit["documentChanges"]> = Object.entries(
    ordinary.changes,
  ).map(([sourceUri, edits]) => ({
    textDocument: {
      uri: sourceUri,
      version: buffers.find((buffer) => buffer.uri === sourceUri)?.version ?? null,
    },
    edits,
  }));
  const layoutEdit = layoutRenameEdit(
    root,
    project.configuration.layout,
    project.configuration.romSha256,
    definition.name,
    newName,
    buffers,
    recipe?.fieldContainers,
  );
  if (layoutEdit) {
    changes.push(layoutEdit);
  }
  if (recipe) {
    changes.push({
      textDocument: { uri: pathToUri(recipe.path), version: recipe.version },
      edits: [TextEdit.replace(wholeDocument(recipe.before), recipe.after)],
    });
  }
  // Layouts, RAM and constants have recipe identities rather than original-ROM label identities.
  if (recipe || definition.kind === "struct" || definition.kind === "structMember") {
    return { documentChanges: changes };
  }
  const catalogPath = path.join(root, sourceRoot, "source-symbols.json");
  if (!fs.existsSync(catalogPath)) {
    throw new Error("Generate the project's symbol identities before renaming research symbols.");
  }
  if (fs.statSync(catalogPath).size > 8 * 1024 * 1024) {
    throw new Error("Symbol identity catalog is too large.");
  }
  const catalog: unknown = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  if (!isSymbolCatalog(catalog) || catalog.romSha256 !== project.configuration.romSha256) {
    throw new Error("Symbol identity catalog does not match this project ROM.");
  }
  const overlays = new Map(
    buffers
      .filter((buffer) => buffer.uri.startsWith("file:"))
      .map((buffer) => [
        path.relative(root, uriToPath(buffer.uri)).split(path.sep).join("/"),
        buffer.text,
      ]),
  );
  const snapshot = readResearchInputs(
    root,
    project.configuration.researchRoots,
    { project: project.configuration.id, romSha256: project.configuration.romSha256 },
    overlays,
    project.configuration.limits,
  );
  const labels = new Map<string, ProjectLabel | null>();
  for (const item of snapshot.decisions) {
    if (item.collection !== "labels") {
      continue;
    }
    if (item.value !== null && !isProjectLabel(item.value)) {
      throw new Error("Research label decision is not a project label.");
    }
    labels.set(item.id, item.value);
  }
  const matches = catalog.symbols.filter((symbol) => {
    const label = labels.get(symbol.id);
    if (label === null || label?.suppressed) {
      return false;
    }
    return (label?.sourceName ?? symbol.name) === definition.name;
  });
  if (matches.length > 1) {
    throw new Error("More than one research identity has this name. Resolve the duplicate first.");
  }
  if (!matches.length) {
    return { documentChanges: changes };
  }
  const symbol = matches[0];
  validateSourceLabelName(newName);
  const edit = renameResearchSymbol(
    snapshot,
    { ...symbol, currentName: definition.name },
    newName,
    `${project.configuration.researchRoots[0]}/symbols.json`,
    index
      .getAllSymbols()
      .filter((item) => item.name !== definition.name)
      .map((item) => item.name),
  );
  parseResearchDocument(edit.document);
  const uri = pathToUri(path.join(root, edit.path));
  const existing = buffers.find((buffer) => buffer.uri === uri);
  const exists = fs.existsSync(path.join(root, edit.path));
  const before =
    existing?.text ?? (exists ? fs.readFileSync(path.join(root, edit.path), "utf8") : "");
  if (!exists && !existing) {
    changes.push(CreateFile.create(uri, { overwrite: false, ignoreIfExists: false }));
  }
  changes.push({
    textDocument: { uri, version: existing?.version ?? null },
    edits: [TextEdit.replace(wholeDocument(before), `${JSON.stringify(edit.document, null, 2)}\n`)],
  });
  return { documentChanges: changes };
}
