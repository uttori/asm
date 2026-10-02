import fs from "node:fs";
import path from "node:path";

import type { AssemblySymbolDefinition } from "@uttori/asm-core";
import { validateSnesRamMap, validateSnesStructMap } from "@uttori/asm-plugin-snes";

import { pathToUri } from "./providers.js";
import type { RenameBuffer } from "./research-rename.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNamed(value: unknown): value is { name: string } {
  return isRecord(value) && typeof value.name === "string";
}

function isRamMap(value: unknown): value is { variables: { name: string }[] } {
  return isRecord(value) && Array.isArray(value.variables) && value.variables.every(isNamed);
}

function isStructure(value: unknown): value is { id: string; fields: { name: string }[] } {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.fields) &&
    value.fields.every(isNamed)
  );
}

function isBinding(value: unknown): value is { name: string; structure: string } {
  return isRecord(value) && typeof value.name === "string" && typeof value.structure === "string";
}

function isObservation(value: unknown): value is { target: string } {
  return isRecord(value) && typeof value.target === "string";
}

function isInstructionUse(value: unknown): value is {
  operand?: string;
  memoryOperand?: string;
  observations?: { target: string }[];
} {
  if (!isRecord(value)) {
    return false;
  }
  if (value.operand !== undefined && typeof value.operand !== "string") {
    return false;
  }
  if (value.memoryOperand !== undefined && typeof value.memoryOperand !== "string") {
    return false;
  }
  return (
    value.observations === undefined ||
    (Array.isArray(value.observations) && value.observations.every(isObservation))
  );
}

function isStructMap(value: unknown): value is {
  structures: { id: string; fields: { name: string }[] }[];
  bindings: { name: string; structure: string }[];
  constants?: { name: string }[];
  instructionUses?: {
    operand?: string;
    memoryOperand?: string;
    observations?: { target: string }[];
  }[];
} {
  if (!isRecord(value) || !Array.isArray(value.structures) || !Array.isArray(value.bindings)) {
    return false;
  }
  if (!value.structures.every(isStructure) || !value.bindings.every(isBinding)) {
    return false;
  }
  if (
    value.constants !== undefined &&
    !(Array.isArray(value.constants) && value.constants.every(isNamed))
  ) {
    return false;
  }
  return (
    value.instructionUses === undefined ||
    (Array.isArray(value.instructionUses) && value.instructionUses.every(isInstructionUse))
  );
}

/** A field rename applies to its reusable layout and every addressed instance of that layout. */
export interface RecipeRename {
  readonly path: string;
  readonly before: string;
  readonly after: string;
  readonly version: number | null;
  readonly fieldContainers?: readonly string[];
}

/**
 * Rewrite identifier tokens without rendering an AST, preserving parentheses, formatting and quoted
 * data. Member matching skips balanced array indexes, so Table[Index + 1].field keeps its scope.
 */
export function renameRecipeExpression(
  expression: string,
  oldName: string,
  newName: string,
  containers?: readonly string[],
): string {
  const tokens = [
    ...expression.matchAll(
      /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\$[\dA-Fa-f]+|0[Xx][\dA-Fa-f]+|\d+|[A-Z_a-z]\w*|\S/g,
    ),
  ];
  const edits: number[] = [];
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index][0] !== oldName) {
      continue;
    }
    const member = tokens[index - 1]?.[0] === ".";
    if (!containers) {
      if (!member) {
        edits.push(tokens[index].index);
      }
      continue;
    }
    if (!member) {
      continue;
    }
    let rootIndex = index - 2;
    if (tokens[rootIndex]?.[0] === "]") {
      let depth = 1;
      while (--rootIndex >= 0 && depth > 0) {
        if (tokens[rootIndex][0] === "]") {
          depth++;
        }
        if (tokens[rootIndex][0] === "[") {
          depth--;
        }
      }
    }
    if (containers.includes(tokens[rootIndex]?.[0])) {
      edits.push(tokens[index].index);
    }
  }
  let output = expression;
  for (const offset of edits.toReversed()) {
    output = output.slice(0, offset) + newName + output.slice(offset + oldName.length);
  }
  return output;
}

/** Bounded recipes participate in unsaved F2; symlinked authoring paths cannot escape the source root. */
function readRecipe(root: string, relative: string, buffers: readonly RenameBuffer[]) {
  const file = path.join(root, relative);
  const buffer = buffers.find((item) => item.uri === pathToUri(file));
  if (!buffer && !fs.existsSync(file)) {
    return undefined;
  }
  if (fs.existsSync(file)) {
    const actual = path.relative(fs.realpathSync(root), fs.realpathSync(file));
    if (
      !fs.lstatSync(file).isFile() ||
      actual.startsWith(`..${path.sep}`) ||
      path.isAbsolute(actual)
    ) {
      throw new Error("Rename requires a regular recipe inside the source project.");
    }
    if (fs.statSync(file).size > 8 * 1024 * 1024) {
      throw new Error("Recipe exceeds its rename budget.");
    }
  }
  const before = buffer?.text ?? fs.readFileSync(file, "utf8");
  if (Buffer.byteLength(before) > 8 * 1024 * 1024) {
    throw new Error("Recipe exceeds its rename budget.");
  }
  return { path: file, before, version: buffer?.version ?? null };
}

/** Persist recipe-owned names while leaving byte addresses, sizes, guarded operands and evidence intact. */
export function sourceRecipeRename(
  root: string,
  sourceRoot: string,
  definition: AssemblySymbolDefinition,
  newName: string,
  buffers: readonly RenameBuffer[],
): RecipeRename | undefined {
  const source = path.relative(path.join(root, sourceRoot), definition.location.file);
  if (source === "ram-defines.asm" && definition.kind === "label" && !definition.containerName) {
    const input = readRecipe(root, `${sourceRoot}/ram-map.json`, buffers);
    if (!input) {
      return undefined;
    }
    const map: unknown = JSON.parse(input.before);
    validateSnesRamMap(map);
    if (!isRamMap(map)) {
      throw new Error("RAM map must contain a variables array.");
    }
    const variable = map.variables.find((item) => item.name === definition.name);
    if (!variable) {
      return undefined;
    }
    variable.name = newName;
    validateSnesRamMap(map);
    return { ...input, after: JSON.stringify(map, null, 2) + "\n" };
  }
  // Struct declarations may be moved into an ordinary source include. Exact map ownership, rather
  // than the historical generated filename, identifies their persistent layout or binding.
  if (!["struct", "structMember", "label"].includes(definition.kind)) {
    return undefined;
  }
  if (definition.kind === "label" && source !== "structs.asm") {
    return undefined;
  }
  const input = readRecipe(root, `${sourceRoot}/struct-map.json`, buffers);
  if (!input) {
    return undefined;
  }
  const map: unknown = JSON.parse(input.before);
  const before = validateSnesStructMap(map);
  if (!isStructMap(map)) {
    throw new Error("Struct map requires structures and bindings arrays.");
  }
  let fieldContainers: string[] | undefined;
  if (definition.kind === "structMember") {
    const binding = map.bindings.find((item) => item.name === definition.containerName);
    const layout = map.structures.find(
      (item) => item.id === (binding?.structure ?? definition.containerName),
    );
    const field = layout?.fields.find((item) => item.name === definition.name);
    if (!layout || !field) {
      return undefined;
    }
    field.name = newName;
    fieldContainers = [
      layout.id,
      ...map.bindings.filter((item) => item.structure === layout.id).map((item) => item.name),
    ];
  } else if (definition.kind === "struct") {
    const binding = map.bindings.find((item) => item.name === definition.name);
    const layout = map.structures.find((item) => item.id === definition.name);
    if (binding) {
      binding.name = newName;
    } else if (layout) {
      layout.id = newName;
      for (const item of map.bindings) {
        if (item.structure === definition.name) {
          item.structure = newName;
        }
      }
    } else {
      return undefined;
    }
  } else {
    const constant = map.constants?.find((item) => item.name === definition.name);
    if (!constant) {
      return undefined;
    }
    constant.name = newName;
  }
  const rename = (expression: string) =>
    renameRecipeExpression(expression, definition.name, newName, fieldContainers);
  for (const use of map.instructionUses ?? []) {
    if (use.operand !== undefined) {
      use.operand = rename(use.operand);
    }
    if (use.memoryOperand !== undefined) {
      use.memoryOperand = rename(use.memoryOperand);
    }
    for (const observation of use.observations ?? []) {
      observation.target = rename(observation.target);
    }
  }
  const after = validateSnesStructMap(map);
  const encoded = (value: typeof before) =>
    value.instructionUses?.map((use) => [
      use.address,
      use.expectedBytes,
      use.operand?.value,
      use.memoryOperand?.value,
      use.observations.map((item) => [item.address, item.width, item.access]),
    ]);
  if (JSON.stringify(encoded(before)) !== JSON.stringify(encoded(after))) {
    throw new Error("The recipe rename changed a guarded operand or observed access.");
  }
  return { ...input, fieldContainers, after: JSON.stringify(map, null, 2) + "\n" };
}
