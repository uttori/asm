import fs from "node:fs";
import path from "node:path";

import { isOpenStructInitializer, removeInlineComment } from "@uttori/asm-core";
import { assertSourcePath, sourceContentHash } from "@uttori/asm-disassembler";

import {
  inspectSnesSource,
  type InspectSnesSourceOptions,
  type SnesSourceInspection,
} from "../source-build.js";
import type { SnesFixedExtent, SnesInstructionStateContract } from "./check.js";
import { expandedPristineRom, expansionHeaderOffset } from "./expansion.js";
import {
  planSnesRelocation,
  type SnesFreeSpace,
  type SnesMovableObject,
  type SnesRelocationReference,
  type SnesRelocationPlan,
} from "./relocate.js";

/** A source block retains its original file position so later native merges still see its body. */
export interface SnesSourceObject extends SnesMovableObject {
  readonly file: string;
  readonly startSymbol: string;
  readonly endSymbol: string;
  /** Optional addressed dataStruct declaration. Its original research map remains unchanged. */
  readonly structure?: { readonly file: string; readonly recordSize: number };
}

/** A reviewed raw storage pool has explicit source boundaries, never inferred from unused trace coverage. */
export interface SnesSourceFreeSpace extends SnesFreeSpace {
  readonly file: string;
  readonly startSymbol: string;
  readonly endSymbol: string;
}

/** One exact expression on the emitted field's source line, disambiguated by its declared ROM offset. */
export interface SnesSourceReference extends SnesRelocationReference {
  readonly expression: string;
}

/** Reviewable ordinary text edits. The host must check every before hash or document version before applying. */
export interface SnesSourceRelocation {
  readonly plan: SnesRelocationPlan;
  readonly object: SnesSourceObject;
  readonly references: readonly SnesSourceReference[];
  /** The host applies these layout changes with the source edits in the same review. */
  readonly extents: readonly SnesFixedExtent[];
  readonly states: readonly SnesInstructionStateContract[];
  readonly edits: readonly {
    readonly path: string;
    readonly beforeSha256: string;
    readonly before: string;
    readonly after: string;
  }[];
  readonly outputSha256: string;
}

const hex = (value: number): string => `$${value.toString(16).toUpperCase()}`;

/** Match a unique explicit global source boundary, including a typed table's opening directive. */
function boundary(lines: readonly string[], symbol: string, table = false): number {
  if (!/^[A-Z_a-z][\w.]*$/.test(symbol)) {
    throw new Error(`Unsupported source boundary: ${symbol}`);
  }
  const matches = lines.flatMap((line, index) => {
    const text = line.trim();
    return text === `${symbol}:` || (table && text === `dataStructs ${symbol}`) ? [index] : [];
  });
  if (matches.length !== 1) {
    throw new Error(`Relocation needs one explicit source boundary for ${symbol}.`);
  }
  return matches[0];
}

/** Split only UTF-8 source; preserve the original newline convention when producing reviewable edits. */
function sourceLines(bytes: Uint8Array): { lines: string[]; newline: string; text: string } {
  // Preserve a BOM as source content so compare-and-swap hashes still describe the original bytes.
  const text = new TextDecoder("utf8", { fatal: true, ignoreBOM: true }).decode(bytes);
  return { lines: text.split(/\r?\n/), newline: text.includes("\r\n") ? "\r\n" : "\n", text };
}

/** Original raw slices preserve retired bytes without a base-ROM patch layer or another asset copy. */
function rawLines(
  options: InspectSnesSourceOptions,
  file: string,
  start: number,
  end: number,
): string[] {
  if (!options.rawBlocks) {
    throw new Error("Source relocation requires the stable original raw-block contract.");
  }
  const { directory, original, blockSize } = options.rawBlocks;
  const lines: string[] = [];
  for (let offset = start; offset < end;) {
    if (offset >= original.length) {
      if (!options.expansion || end > options.expectedSize) {
        throw new Error("Raw storage beyond the original ROM requires declared expansion.");
      }
      lines.push(`  fillbyte ${hex(options.expansion.fillByte)}`, `  fill ${hex(end - offset)}`);
      break;
    }
    const block = Math.floor(offset / blockSize) * blockSize;
    const through = Math.min(end, block + blockSize);
    const name = path.join(directory, `${block.toString(16).padStart(6, "0")}.bin`);
    const bytes = fs.readFileSync(path.resolve(options.root, name));
    if (
      !Buffer.from(bytes.subarray(offset - block, through - block)).equals(
        Buffer.from(original.subarray(offset, through)),
      )
    ) {
      throw new Error("Retired or free raw bytes contain edits. Reconcile them before relocation.");
    }
    const relative = path.relative(path.dirname(file), name).split(path.sep).join("/");
    if (/[\n\r"]/.test(relative)) {
      throw new Error("Raw include path cannot be represented in assembly.");
    }
    lines.push(`  incbin "${relative}":${hex(offset - block)}..${hex(through - block)}`);
    offset = through;
  }
  return lines;
}

/** Require a one-to-one source line for a declared field; repeated macro/loop emissions need a richer contract. */
function referenceLine(
  inspection: SnesSourceInspection,
  reference: SnesSourceReference,
): { file: string; line: number } {
  const owners = inspection.mapping.ranges.filter(
    (range) =>
      range.outputStart !== undefined &&
      range.outputStart <= reference.offset &&
      range.outputEnd! >= reference.offset + reference.expected.length,
  );
  if (owners.length !== 1) {
    throw new Error(`Reference ${reference.id} has no unique source emission.`);
  }
  const owner = owners[0];
  if (
    inspection.mapping.ranges.filter(
      (range) => range.fileIdx === owner.fileIdx && range.line === owner.line,
    ).length !== 1
  ) {
    throw new Error(`Reference ${reference.id} comes from repeated source emission.`);
  }
  return { file: inspection.mapping.fileList[owner.fileIdx].name, line: owner.line - 1 };
}

/** Locate an exact encoded typed field inside its whole source row; ordinary references stay single-line. */
function referenceStatement(
  inspection: SnesSourceInspection,
  reference: SnesSourceReference,
): { file: string; statement: string } {
  const owner = referenceLine(inspection, reference);
  const source = sourceLines(inspection.snapshots.get(owner.file)!);
  const fields = inspection.mapping.structFields.filter(
    (field) => field.outputOffset === reference.offset && field.size === reference.expected.length,
  );
  if (!fields.length) {
    return { file: owner.file, statement: source.lines[owner.line] };
  }
  if (
    fields.length !== 1 ||
    fields[0].expression.replace(/\s/g, "") !== reference.expression.replace(/\s/g, "")
  ) {
    throw new Error(
      `Reference ${reference.id} does not identify one exact typed field expression.`,
    );
  }
  const lines = [source.lines[owner.line]];
  let parsed = removeInlineComment(lines[0]);
  // Reuse the assembler's brace grammar, with a bounded scan. Repeated row/macro instances were
  // rejected by referenceLine; field metadata proves which emitted scalar this expression owns.
  while (isOpenStructInitializer(parsed)) {
    if (lines.length >= 4096 || owner.line + lines.length >= source.lines.length) {
      throw new Error(`Reference ${reference.id} has no bounded complete initializer.`);
    }
    const line = source.lines[owner.line + lines.length];
    lines.push(line);
    parsed += " " + removeInlineComment(line);
  }
  if (parsed.split(reference.expression).length !== 2) {
    throw new Error(
      `Reference ${reference.id} needs one unambiguous expression inside its typed row.`,
    );
  }
  return { file: owner.file, statement: lines.join(source.newline) };
}

/** Use symbolic source expressions so future generated calls naturally follow the current placement. */
function referenceExpression(reference: SnesSourceReference, object: SnesSourceObject): string {
  if (reference.encoding.startsWith("length")) {
    return `(${object.endSymbol} - ${object.startSymbol})`;
  }
  if (reference.encoding.startsWith("count")) {
    return `((${object.endSymbol} - ${object.startSymbol}) / ${reference.unitSize})`;
  }
  let expression = object.startSymbol;
  if (reference.addend) {
    expression = `(${expression} + ${reference.addend})`;
  }
  if (reference.encoding === "bank16" || reference.encoding === "low16") {
    return `(${expression} & $FFFF)`;
  }
  if (reference.encoding === "bank8") {
    return `((${expression} >> 16) & $FF)`;
  }
  // Branch mnemonics perform their own displacement encoding; source expressions name the target.
  return expression;
}

/**
 * Plan and assemble an ordinary source transformation over explicit object/pool boundaries.
 * No filesystem write occurs. Unknown emissions, incomplete references, stale fields, bank limits
 * and unrelated byte changes fail before any edit can be applied by a CLI or WorkspaceEdit host.
 */
export function prepareSnesSourceRelocation(options: {
  readonly build: InspectSnesSourceOptions;
  readonly objects: readonly SnesSourceObject[];
  readonly freeSpace: readonly SnesSourceFreeSpace[];
  readonly references: readonly SnesSourceReference[];
  readonly objectId: string;
  /** Optional explicit destination, including the object's original extent after shrinking it. */
  readonly destination?: number;
  readonly logicalAddress: (offset: number) => number;
}): SnesSourceRelocation {
  const object = options.objects.find((item) => item.id === options.objectId);
  if (!object || !/^[\w.:-]+$/.test(object.id)) {
    throw new Error("Select one declared source object.");
  }
  if (options.build.originalContent) {
    throw new Error("Relocation applies to editable source, never pure generation.");
  }
  const raw = options.build.rawBlocks;
  if (!raw || !Number.isSafeInteger(raw.blockSize) || raw.blockSize <= 0 || raw.blockSize > 65536) {
    throw new Error("Relocation needs a valid stable raw-block contract.");
  }
  assertSourcePath(raw.directory);
  if (
    ![object.start, object.length, object.originalStart, object.originalEnd].every(
      Number.isSafeInteger,
    ) ||
    object.start < 0 ||
    object.length <= 0 ||
    object.start + object.length > options.build.expectedSize ||
    object.originalStart < 0 ||
    object.originalEnd <= object.originalStart ||
    object.originalEnd > raw.original.length
  ) {
    throw new Error("Source object extents must fit their original and current ROMs.");
  }
  if (object.kind === "code") {
    const entry = options.build.states?.find((state) => state.offset === object.start);
    if (!entry || [entry.e, entry.m, entry.x].some((flag) => typeof flag !== "boolean")) {
      throw new Error("Movable code requires explicit E/M/X entry assumptions.");
    }
  }
  const root = path.resolve(options.build.root);
  const files = new Map<string, ReturnType<typeof sourceLines>>();
  const overlays = new Map(options.build.overlays);
  const read = (name: string) => {
    assertSourcePath(name);
    let ancestor = root;
    for (const component of name.split("/")) {
      ancestor = path.join(ancestor, component);
      if (fs.lstatSync(ancestor).isSymbolicLink()) {
        throw new Error("Relocation source cannot follow symlinks.");
      }
    }
    let file = files.get(name);
    if (!file) {
      file = sourceLines(overlays.get(name) ?? fs.readFileSync(path.join(root, name)));
      files.set(name, file);
    }
    return file;
  };
  const save = (name: string, lines: string[]) => {
    const file = read(name);
    file.lines = lines;
    overlays.set(name, Buffer.from(lines.join(file.newline)));
  };
  const objectFile = read(object.file);
  const start = boundary(objectFile.lines, object.startSymbol, Boolean(object.structure));
  const end = boundary(objectFile.lines, object.endSymbol);
  if (end <= start) {
    throw new Error("Object source boundaries are reversed.");
  }
  const beginMarker = `; @uttori-placement ${object.id} begin`;
  const endMarker = `; @uttori-placement ${object.id} end`;
  const oldBegin = objectFile.lines.indexOf(beginMarker);
  const oldEnd = objectFile.lines.indexOf(endMarker);
  const missingBegin = oldBegin < 0;
  const missingEnd = oldEnd < 0;
  if (
    missingBegin !== missingEnd ||
    objectFile.lines.filter((line) => line === beginMarker).length > 1 ||
    objectFile.lines.filter((line) => line === endMarker).length > 1 ||
    (oldBegin >= 0 && (oldBegin >= start || oldEnd <= end))
  ) {
    throw new Error(
      "Placement source boundaries were edited; reconcile the declared object before moving it.",
    );
  }
  const beforeIndex = oldBegin >= 0 ? oldBegin : start;
  const afterIndex = oldEnd >= 0 ? oldEnd + 1 : end + 1;
  const prefix = objectFile.lines.slice(0, beforeIndex);
  const body = objectFile.lines.slice(start, end + 1);
  const suffix = objectFile.lines.slice(afterIndex);
  const writeObject = (destination: number, restore: boolean) => {
    const lines = [beginMarker, `org ${hex(options.logicalAddress(destination))}`, ...body];
    if (restore) {
      lines.push(
        `org ${hex(options.logicalAddress(object.originalStart))}`,
        ...rawLines(options.build, object.file, object.originalStart, object.originalEnd),
      );
    }
    if (
      !restore &&
      destination === object.originalStart &&
      movedLength !== undefined &&
      movedLength < object.originalEnd - object.originalStart
    ) {
      lines.push(
        ...rawLines(
          options.build,
          object.file,
          object.originalStart + movedLength,
          object.originalEnd,
        ),
      );
    }
    lines.push(`org ${hex(options.logicalAddress(object.originalEnd))}`, endMarker);
    save(object.file, [...prefix, ...lines, ...suffix]);
  };
  let movedLength: number | undefined;
  const writeStructure = (destination: number, count: number) => {
    if (!object.structure) {
      return;
    }
    const definition = read(object.structure.file);
    const declarations = definition.lines.flatMap((line, index) =>
      line.trim().startsWith(`struct ${object.startSymbol} `) ? [index] : [],
    );
    const declaration = declarations[0];
    const finish = definition.lines.findIndex(
      (line, index) => index > declaration && /^endstruct\b/.test(line.trim()),
    );
    if (
      declarations.length !== 1 ||
      finish < 0 ||
      !/^endstruct count \d+ firstindex 0$/.test(definition.lines[finish].trim())
    ) {
      throw new Error("Typed relocation requires one plain addressed array with firstindex 0.");
    }
    const lines = [...definition.lines];
    lines[declaration] = `struct ${object.startSymbol} ${hex(options.logicalAddress(destination))}`;
    lines[finish] = `endstruct count ${count} firstindex 0`;
    save(object.structure.file, lines);
  };
  if (object.structure) {
    if (object.structure.file === object.file) {
      throw new Error(
        "Keep an addressed table's declaration in a separate struct include before relocating it.",
      );
    }
    if (
      !Number.isSafeInteger(object.structure.recordSize) ||
      object.structure.recordSize <= 0 ||
      object.structure.recordSize > object.bankSize
    ) {
      throw new Error("Typed relocation requires a bounded positive record size.");
    }
    // Permit added source rows during measurement only. The final declaration gets the actual
    // complete record count, so out-of-range references cannot survive the accepted assembly.
    writeStructure(object.start, Math.floor(object.bankSize / object.structure.recordSize));
  }
  // Reset the following source to its original address while measuring growth. This provisional
  // image can contain overlaps and is never a build; it prevents an inserted word shifting a bank.
  writeObject(object.start, object.start !== object.originalStart);
  const inspected = inspectSnesSource({
    ...options.build,
    // A growing object may already cross its old bank. Measure with linear PC semantics;
    // only the final reassembly, with ordinary throwing validation restored, may be accepted.
    targetOptions: { ...options.build.targetOptions, onBankCrossing: () => undefined },
    placements: undefined,
    overlays,
    resolveSymbols: [
      object.startSymbol,
      object.endSymbol,
      ...(object.structure ? [`${object.startSymbol}[1]`] : []),
    ],
  });
  const encodedLength =
    inspected.symbols.get(object.endSymbol)! - inspected.symbols.get(object.startSymbol)!;
  movedLength = encodedLength;
  if (
    object.structure &&
    (inspected.symbols.get(`${object.startSymbol}[1]`)! -
      inspected.symbols.get(object.startSymbol)! !==
      object.structure.recordSize ||
      encodedLength % object.structure.recordSize !== 0)
  ) {
    throw new Error("Typed relocation requires complete records matching its declared stride.");
  }
  for (const pool of options.freeSpace) {
    if (
      inspected.symbols.get(pool.startSymbol) !== options.logicalAddress(pool.start) ||
      inspected.symbols.get(pool.endSymbol) !== options.logicalAddress(pool.end)
    ) {
      throw new Error(
        `Free pool ${pool.id} source boundaries differ from its declared ROM extent.`,
      );
    }
  }
  const measuredReferences = options.references.map((reference) => {
    if (
      reference.target !== object.id ||
      reference.expression !== referenceExpression(reference, object)
    ) {
      return reference;
    }
    // Length/count expressions already reflect a newly edited body during the provisional build.
    // The final byte check still proves their exact encoding; do not mistake that derived change
    // for a stale numeric pointer. Source-line matching below guards the symbolic declaration.
    return {
      ...reference,
      expected: [
        ...inspected.output.subarray(
          reference.offset,
          reference.offset + reference.expected.length,
        ),
      ],
    };
  });
  const plan = planSnesRelocation({
    original: expandedPristineRom(
      raw.original,
      options.build.expectedSize,
      options.build.expansion,
    ),
    current: inspected.output,
    objects: options.objects,
    freeSpace: options.freeSpace,
    references: measuredReferences,
    objectId: object.id,
    encodedLength,
    destination: options.destination,
    logicalAddress: options.logicalAddress,
  });
  const moved = { ...object, start: plan.destination, length: encodedLength };
  if (
    object.kind === "code" &&
    Math.floor(options.logicalAddress(plan.destination) / 0x10000) !==
      Math.floor(options.logicalAddress(object.originalStart) / 0x10000)
  ) {
    throw new Error("Source code relocation currently preserves the original program bank.");
  }
  writeObject(plan.destination, plan.destination !== object.originalStart);
  if (object.structure) {
    writeStructure(plan.destination, encodedLength / object.structure.recordSize);
  }
  const placements = options.objects.map((item) => (item.id === object.id ? moved : item));
  for (const pool of options.freeSpace) {
    const file = read(pool.file);
    const first = boundary(file.lines, pool.startSymbol);
    const last = boundary(file.lines, pool.endSymbol);
    if (
      first >= last ||
      file.lines.slice(first + 1, last).some((line) => {
        const text = line.trim();
        return (
          text &&
          !text.startsWith(";") &&
          !/^incbin\s+"[^\n\r"]+":\$[\dA-Fa-f]+\.\.\$[\dA-Fa-f]+$/.test(text) &&
          !/^(?:fillbyte|fill)\s+\$[\dA-Fa-f]+$/.test(text) &&
          !/^org\s+\$[\dA-Fa-f]+$/.test(text)
        );
      })
    ) {
      throw new Error(`Free pool ${pool.id} contains source beyond raw storage declarations.`);
    }
    const allocated = placements
      .filter((item) => item.start >= pool.start && item.start < pool.end)
      .sort((a, b) => a.start - b.start);
    const lines = file.lines.slice(first + 1, last).filter((line) => line.trim().startsWith(";"));
    let cursor = pool.start;
    for (const item of allocated) {
      if (item.start < cursor || item.start + item.length > pool.end) {
        throw new Error(`Allocation crosses or overlaps free pool ${pool.id}.`);
      }
      lines.push(...rawLines(options.build, pool.file, cursor, item.start));
      cursor = item.start + item.length;
      lines.push(`org ${hex(options.logicalAddress(cursor))}`);
    }
    lines.push(...rawLines(options.build, pool.file, cursor, pool.end));
    save(pool.file, [...file.lines.slice(0, first + 1), ...lines, ...file.lines.slice(last)]);
  }
  const statementRepairs = new Map<
    string,
    Map<string, { start: number; end: number; text: string }[]>
  >();
  const references = options.references.map((reference) => {
    if (reference.target !== object.id) {
      return reference;
    }
    const owner = referenceStatement(inspected, reference);
    const name = path.relative(root, owner.file).split(path.sep).join("/");
    // Locate against the inspected snapshot first, then find the identical statement after insertions.
    const statement = owner.statement;
    const file = read(name);
    const text = file.lines.join(file.newline);
    if (
      text.split(statement).length !== 2 ||
      !reference.expression ||
      statement.split(reference.expression).length !== 2
    ) {
      throw new Error(
        `Reference ${reference.id} needs one explicit expression on a unique source statement.`,
      );
    }
    const expression = referenceExpression(reference, moved);
    const statements =
      statementRepairs.get(name) ??
      new Map<string, { start: number; end: number; text: string }[]>();
    const repairs = statements.get(statement) ?? [];
    const start = statement.indexOf(reference.expression);
    repairs.push({ start, end: start + reference.expression.length, text: expression });
    statements.set(statement, repairs);
    statementRepairs.set(name, statements);
    return {
      ...reference,
      expression,
      expected: plan.repairs.find((repair) => repair.id === reference.id)!.after,
    };
  });
  // Several encoded fields can share one multiline initializer. Resolve all ranges against its
  // original snapshot, then replace right-to-left so newly inserted expressions cannot match later edits.
  for (const [name, statements] of statementRepairs) {
    const file = read(name);
    let text = file.lines.join(file.newline);
    for (const [statement, repairs] of statements) {
      let after = statement;
      let right = statement.length;
      for (const repair of repairs.sort((a, b) => b.start - a.start)) {
        if (repair.end > right) {
          throw new Error("Reference expressions overlap inside one source statement.");
        }
        after = after.slice(0, repair.start) + repair.text + after.slice(repair.end);
        right = repair.start;
      }
      text = text.replace(statement, after);
    }
    save(name, text.split(/\r?\n/));
  }
  const extents = (options.build.extents ?? []).map((extent) =>
    extent.id === object.id ? { ...extent, size: encodedLength } : extent,
  );
  const states = (options.build.states ?? []).map((state) =>
    state.offset >= object.start && state.offset < object.start + object.length
      ? { ...state, offset: plan.destination + state.offset - object.start }
      : state,
  );
  const final = inspectSnesSource({
    ...options.build,
    placements: { objects: placements, references, logicalAddress: options.logicalAddress },
    overlays,
    extents,
    states,
    resolveSymbols: [object.startSymbol, object.endSymbol],
  });
  if (final.diagnostics.length) {
    throw new Error(final.diagnostics.map((item) => `${item.code}: ${item.message}`).join("\n"));
  }
  const allowed = [
    [object.start, object.start + object.length],
    [object.originalStart, object.originalEnd],
    [plan.destination, plan.destination + encodedLength],
    ...plan.repairs.map((repair) => [repair.offset, repair.offset + repair.after.length]),
  ];
  if (options.build.expansion) {
    const header = expansionHeaderOffset(options.build.expansion);
    // Finalization updates these four derived bytes after reference and asset changes.
    // The independent expansion check above proves their values before permitting this difference.
    allowed.push([header + 0x1c, header + 0x20]);
  }
  for (let offset = 0; offset < final.output.length; offset++) {
    if (
      final.output[offset] !== inspected.output[offset] &&
      !allowed.some(([start, end]) => offset >= start && offset < end)
    ) {
      throw new Error(
        `Relocation changes undeclared bytes at ${hex(offset)}. Add the missing reference or reconcile source placement.`,
      );
    }
  }
  for (const repair of plan.repairs) {
    if (!repair.after.every((byte, index) => final.output[repair.offset + index] === byte)) {
      throw new Error(
        `Source reference repair did not encode the declared destination: ${repair.id}`,
      );
    }
  }
  return {
    plan,
    object: moved,
    references,
    extents,
    states,
    outputSha256: sourceContentHash(final.output),
    edits: [...files.entries()]
      .flatMap(([name, file]) => {
        const after = file.lines.join(file.newline);
        return after === file.text
          ? []
          : [{ path: name, beforeSha256: sourceContentHash(file.text), before: file.text, after }];
      })
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
}
