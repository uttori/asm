import { linkConstant, linkInteger, type LinkExpression } from "../ir/link-expression.js";
import type { AssemblyStageName } from "../plugin/contracts.js";
import type {
  AssemblyFixup,
  AssemblyModule,
  AssemblyModuleRange,
  AssemblyModuleSymbol,
  AssemblySectionOptions,
  RelocatableSource,
  RelocationEncoding,
  SectionPosition,
} from "../relocatable.js";

/** Mutable section state belongs to exactly one assembly pass. */
interface SectionState extends Required<AssemblySectionOptions> {
  size: number;
  cursor: number;
  bytes: number[];
}

/** Owns in-memory section/symbol/fixup production; it performs no placement or object-file serialization. */
export class ModuleAssembly {
  /** Mutable section byte cursors keyed by section name. */
  readonly sections = new Map<string, SectionState>();
  /** Module symbol table including imports, exports, and locals. */
  readonly symbols = new Map<string, AssemblyModuleSymbol>();
  /** Pending relocation sites recorded during emission. */
  readonly fixups: AssemblyFixup[] = [];
  /** Source ranges mapped to section offsets for debug metadata. */
  readonly ranges: AssemblyModuleRange[] = [];
  /** Typed field metadata attached to emitted data. */
  readonly fields: import("../relocatable.js").AssemblyModuleField[] = [];
  /** Asset emission records linked to module output. */
  readonly assets: import("../relocatable.js").AssemblyModuleAsset[] = [];
  /** Instruction metadata captured for link-time validation. */
  readonly instructions: import("../relocatable.js").AssemblyModuleInstruction[] = [];
  private readonly definitions = new Map<string, RelocatableSource>();
  private readonly exports = new Set<string>();
  private readonly imports = new Set<string>();
  private readonly references = new Set<string>();
  private sectionName = ".text";
  private stage: AssemblyStageName = "collectDefinitions";
  private complete = false;
  /** Only numeric probes borrow this cursor; emitted extents always use the active section cursor. */
  private previewOffset?: number;
  /** Probing compound syntax must not introduce dependencies on register names or failed parses. */
  private trackReferences = true;

  constructor(
    readonly id: string,
    readonly defaultAddressSpace: string,
  ) {
    if (!id.trim()) {
      throw new Error("Relocatable assembly requires a stable, nonempty module identity.");
    }
  }

  /** Each pass replays section sizes; previous symbol definitions remain available to forward references. */
  beginStage(stage: AssemblyStageName): void {
    this.stage = stage;
    this.complete = false;
    this.sections.clear();
    this.definitions.clear();
    this.exports.clear();
    this.imports.clear();
    this.references.clear();
    this.fixups.length = 0;
    this.ranges.length = 0;
    this.fields.length = 0;
    this.assets.length = 0;
    this.instructions.length = 0;
    if (stage === "collectDefinitions") {
      this.symbols.clear();
    }
    this.selectSection({ name: ".text" });
  }

  /** Reopening a section resumes its byte cursor; conflicting declarations fail before mutation. */
  selectSection(options: AssemblySectionOptions): number {
    if (!options.name.trim()) {
      throw new Error("Section name must not be empty.");
    }
    const existing = this.sections.get(options.name);
    const kind = options.kind ?? existing?.kind ?? "code";
    const alignment = options.alignment ?? existing?.alignment ?? 1;
    const addressSpace = options.addressSpace ?? existing?.addressSpace ?? this.defaultAddressSpace;
    if (!Number.isSafeInteger(alignment) || alignment <= 0) {
      throw new Error("Section alignment must be a positive byte count.");
    }
    if (
      existing &&
      (existing.kind !== kind ||
        existing.alignment !== alignment ||
        existing.addressSpace !== addressSpace)
    ) {
      throw new Error(`Conflicting section declaration: ${options.name}`);
    }
    if (!existing) {
      this.sections.set(options.name, {
        name: options.name,
        kind,
        alignment,
        addressSpace,
        cursor: 0,
        size: 0,
        bytes: [],
      });
    }
    this.sectionName = options.name;
    return this.current.cursor;
  }

  private get current(): SectionState {
    const section = this.sections.get(this.sectionName);
    if (!section) {
      throw new Error("Module assembly has no active section.");
    }
    return section;
  }

  /** A detached byte position; numeric offsets never masquerade as final processor addresses. */
  position(offset = this.previewOffset ?? this.current.cursor): SectionPosition {
    return { section: this.sectionName, offset };
  }

  /** Kind of the currently selected section. */
  get sectionKind(): AssemblySectionOptions["kind"] {
    return this.current.kind;
  }

  /** Local padding is only meaningful when the linker also aligns the section's starting address. */
  requireAlignment(alignment: number): number {
    linkInteger(alignment);
    if (alignment < 1) {
      throw new Error("Section alignment must be positive.");
    }
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const combined = linkInteger(
      (this.current.alignment / gcd(this.current.alignment, alignment)) * alignment,
    );
    if (combined > 0x1000000) {
      throw new Error("Section alignment exceeds the assembly limit.");
    }
    this.sections.set(this.sectionName, { ...this.current, alignment: combined });
    return (alignment - (this.current.cursor % alignment)) % alignment;
  }

  /** Builds a link expression pointing at the current module section offset. */
  location(offset = this.position().offset): LinkExpression {
    return { kind: "section", module: this.id, ...this.position(offset) };
  }

  /** Numeric compatibility probes may advance a temporary cursor without touching section extents, bytes or fixups. */
  withPreviewCursor<T>(operation: (advance: (bytes: number) => void) => T): T {
    const previous = this.previewOffset;
    this.previewOffset = this.position().offset;
    try {
      return operation((bytes) => {
        this.previewOffset = (this.previewOffset ?? this.current.cursor) + bytes;
      });
    } finally {
      this.previewOffset = previous;
    }
  }

  /** Reserve bytes without using mapper bank-wrap arithmetic. BSS stores only its extent. */
  advance(count: number): number {
    linkInteger(count);
    if (count < 0 || this.current.cursor + count > 0x1000000) {
      throw new Error("Section extent exceeds the 16 MiB assembly limit.");
    }
    this.current.cursor += count;
    this.current.size = Math.max(this.current.size, this.current.cursor);
    return this.current.cursor;
  }

  /** Restore a saved source-layout cursor without inventing bytes or allowing a seek beyond an existing extent. */
  seek(offset: number): number {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > this.current.size) {
      throw new Error("Saved module cursor is outside its section extent.");
    }
    this.current.cursor = offset;
    return offset;
  }

  /** Payload writes cannot initialize BSS, and only final emission retains bytes. */
  write(value: number): void {
    if (this.current.kind === "bss") {
      throw new Error(`Cannot emit initialized bytes in BSS section '${this.sectionName}'.`);
    }
    if (this.stage === "emitProgram") {
      this.current.bytes[this.current.cursor] = value & 255;
    }
  }

  /** A symbol definition retains its owning section even when two sections use the same offset. */
  define(name: string, value: number, isStatic: boolean, source: RelocatableSource): void {
    this.defineExpression(name, isStatic ? linkConstant(value) : this.location(value), source);
  }

  /** Aliases retain unresolved external and cross-section dependencies without guessed addresses. */
  defineExpression(name: string, value: LinkExpression, source: RelocatableSource): void {
    const previous = this.definitions.get(name);
    if (previous && (previous.file !== source.file || previous.line !== source.line)) {
      throw new Error(`Duplicate module symbol '${name}'.`);
    }
    const imported = this.symbols.get(name);
    if (imported?.visibility === "import") {
      throw new Error(`Imported symbol '${name}' is also defined in this module.`);
    }
    this.definitions.set(name, source);
    this.symbols.set(name, {
      name,
      visibility: this.exports.has(name) ? "export" : "local",
      value,
      source,
    });
  }

  /** True when the symbol received a definition during the active stage. */
  isDefinedThisStage(name: string): boolean {
    return this.definitions.has(name);
  }

  /** Imports use external names; exports may precede their definitions. */
  declare(name: string, visibility: "import" | "export", source: RelocatableSource): void {
    if (!name.trim()) {
      throw new Error("Import/export requires a symbol name.");
    }
    const existing = this.symbols.get(name);
    if (visibility === "import") {
      if (existing?.value) {
        throw new Error(`Defined symbol '${name}' cannot be imported.`);
      }
      this.symbols.set(name, { name, visibility, source });
      this.imports.add(name);
      return;
    }
    this.exports.add(name);
    if (existing?.visibility === "import") {
      throw new Error(`Imported symbol '${name}' cannot be exported by the same module.`);
    }
    this.symbols.set(name, { ...existing, name, visibility, source });
  }

  /** Constants fold immediately; imported and not-yet-defined names remain explicit references. */
  reference(name: string): LinkExpression {
    if (this.trackReferences) {
      this.references.add(name);
    }
    const symbol = this.symbols.get(name);
    if (symbol?.value) {
      return symbol.value;
    }
    if (symbol?.visibility === "import") {
      return { kind: "symbol", name };
    }
    return { kind: "symbol", name, module: this.id };
  }

  /** Classifiers may probe register/compound syntax as an expression; failed probes must not declare symbol dependencies. */
  probe<T>(operation: () => T): T {
    const previous = this.trackReferences;
    this.trackReferences = false;
    try {
      return operation();
    } finally {
      this.trackReferences = previous;
    }
  }

  /** Record a field independently of placeholder bytes. Target semantics remain explicit for the linker. */
  field(
    expression: LinkExpression,
    encoding: RelocationEncoding,
    source: RelocatableSource,
  ): number[] {
    if (![1, 2, 3, 4].includes(encoding.width)) {
      throw new Error("Relocation field width must be 1..4 bytes.");
    }
    for (const check of encoding.checks ?? []) {
      if (check.expression.kind !== "constant") {
        continue;
      }
      const value = check.expression.value;
      if (
        (check.minimum !== undefined && value < check.minimum) ||
        (check.maximum !== undefined && value > check.maximum) ||
        (check.alignment && value % check.alignment !== 0)
      ) {
        throw new Error(`Relocation input ${value} violates its range/alignment contract.`);
      }
    }
    // An authored literal already fitting the field is a raw operand, not a guessed bus address.
    // Larger bank/direct-page addresses remain typed fixups for target policy to validate later.
    const rawConstant =
      expression.kind === "constant" &&
      expression.value >= -(2 ** (encoding.width * 8 - 1)) &&
      expression.value < 2 ** (encoding.width * 8);
    if (
      expression.kind === "constant" &&
      encoding.kind !== "relative" &&
      (!encoding.kind || encoding.kind === "absolute" || rawConstant)
    ) {
      const value = expression.value;
      if (
        encoding.constraint === "powerOfTwo" &&
        (value <= 0 || (BigInt(value) & (BigInt(value) - 1n)) !== 0n)
      ) {
        throw new Error("Relocation value must be a power of two.");
      }
      const capacity = 2 ** (encoding.width * 8);
      const minimum = encoding.minimum ?? -capacity / 2;
      const defaultMaximum = encoding.signed ? capacity / 2 - 1 : capacity - 1;
      const maximum = encoding.maximum ?? defaultMaximum;
      if (
        !encoding.truncate &&
        (value < minimum ||
          value > maximum ||
          (encoding.alignment && value % encoding.alignment !== 0))
      ) {
        throw new Error(`Value ${value} does not fit its declared ${encoding.width}-byte field.`);
      }
      const unsigned = BigInt(value);
      const result = Array.from({ length: encoding.width }, (_, index) =>
        Number((unsigned >> BigInt(index * 8)) & 255n),
      );
      if (encoding.endianness === "big") {
        result.reverse();
      }
      return result;
    }
    if (this.stage === "emitProgram") {
      this.fixups.push({ ...this.position(), expression, encoding, source });
    }
    return Array.from({ length: encoding.width }, () => 0);
  }

  /** Coalesce adjacent bytes from the same occurrence without merging across sections or architectures. */
  recordRange(
    source: RelocatableSource,
    kind: AssemblyModuleRange["kind"],
    size: number,
    offset: number,
  ): void {
    if (this.stage !== "emitProgram" || size === 0) {
      return;
    }
    const previous = this.ranges.at(-1);
    if (
      previous &&
      previous.section === this.sectionName &&
      previous.offset + previous.size === offset &&
      previous.kind === kind &&
      previous.source.file === source.file &&
      previous.source.line === source.line &&
      previous.source.architecture === source.architecture
    ) {
      this.ranges[this.ranges.length - 1] = { ...previous, size: previous.size + size };
    } else {
      this.ranges.push({ ...this.position(offset), size, source, kind });
    }
  }

  /** A failed or incomplete pass can never expose a module as a successful object producer result. */
  finish(): void {
    if (this.stage !== "emitProgram") {
      return;
    }
    for (const name of this.exports) {
      if (!this.definitions.has(name)) {
        throw new Error(`Exported symbol '${name}' is not defined.`);
      }
    }
    // Prior-pass definitions support forward references, but cannot authenticate a declaration
    // omitted by the final selected conditional/macro path.
    for (const name of this.references) {
      if (!this.definitions.has(name) && !this.imports.has(name)) {
        throw new Error(
          `Undefined module symbol '${name}'; declare an import for an external symbol.`,
        );
      }
    }
    for (const name of this.symbols.keys()) {
      if (!this.definitions.has(name) && !this.imports.has(name) && !this.exports.has(name)) {
        this.symbols.delete(name);
      }
    }
    const check = (expression: LinkExpression): void => {
      if (
        expression.kind === "symbol" &&
        expression.module === this.id &&
        !this.symbols.get(expression.name)?.value
      ) {
        throw new Error(
          `Undefined module symbol '${expression.name}'; declare an import for an external symbol.`,
        );
      }
      if (expression.kind === "unary") {
        check(expression.argument);
      }
      if (expression.kind === "binary") {
        check(expression.left);
        check(expression.right);
      }
    };
    for (const fixup of this.fixups) {
      check(fixup.expression);
      for (const constraint of fixup.encoding.checks ?? []) {
        check(constraint.expression);
      }
    }
    for (const symbol of this.symbols.values()) {
      if (symbol.value) {
        check(symbol.value);
      }
    }
    this.complete = true;
  }

  /** Copy payload storage so subsequent assembly or caller mutation cannot alter a retained result. */
  snapshot(
    target: string,
    targetOptions: AssemblyModule["targetOptions"],
    dependencies: AssemblyModule["dependencies"],
  ): AssemblyModule {
    if (!this.complete) {
      throw new Error("Relocatable assembly has not completed successfully.");
    }
    return structuredClone({
      id: this.id,
      target,
      targetOptions,
      dependencies,
      symbols: [...this.symbols.values()],
      fixups: this.fixups,
      ranges: this.ranges,
      fields: this.fields,
      assets: this.assets,
      instructions: this.instructions,
      sections: [...this.sections.values()]
        .filter((section) => section.size || section.name !== ".text")
        .map(({ cursor: _cursor, bytes, ...section }) =>
          Object.assign(section, {
            bytes:
              section.kind === "bss"
                ? new Uint8Array()
                : Uint8Array.from({ length: section.size }, (_, index) => bytes[index] ?? 0),
          }),
        ),
    });
  }
}
