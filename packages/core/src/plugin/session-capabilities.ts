import type { ArchitectureEncoder } from "../architecture-types.js";
import type { ExpressionNode } from "../ir/expression-node.js";
import type { LabelEntry } from "../services/symbol-scope-service.js";

/**
 * Borrowed synchronous target capabilities. Valid only while a directive factory, handler,
 * or lifecycle hook runs; retaining the object does not extend its lifetime.
 * Addresses are target logical byte addresses; output offsets are zero-based image bytes.
 * Host-owned services, assembly entry points, registries and disposal are intentionally absent.
 */
export interface PluginSessionCapabilities {
  /** Versioned optional object-production capabilities, borrowed for the same synchronous callback. */
  readonly module?: {
    /** Module object-production API version carried in borrowed snapshots. */
    readonly apiVersion: 1;
    /** Active module identity string for relocatable object emission. */
    readonly id: string;
    /** Select or create a relocatable section for subsequent object writes. */
    selectSection(options: import("../relocatable.js").AssemblySectionOptions): void;
    /** Declare an import or export symbol in the active module. */
    declare(name: string, visibility: "import" | "export"): void;
    /** Mark an existing label binding as exported from the module. */
    exportSymbol(name: string): void;
    /** Compile a typed expression into a link-time relocatable form. */
    compile(expression: ExpressionNode): import("../ir/link-expression.js").LinkExpression;
    /** Write a relocatable expression at the current section cursor with explicit width. */
    write(expression: ExpressionNode, width: 1 | 2 | 3 | 4, endianness?: "little" | "big"): void;
    /** Reserve uninitialized bytes in the active section. */
    reserve(count: number, fill?: number): void;
    /** Align the section cursor to a boundary with optional fill. */
    align(boundary: number, fill?: number): void;
  };
  /** Frozen target options validated for the active target contribution. */
  readonly targetOptions: Readonly<Record<string, unknown>>;
  /** Active architecture name for encoder and directive behavior. */
  readonly arch: string;
  /** One-based source line for the directive or hook being executed. */
  readonly currentLine: number;
  /** Whether finalize hooks may run during this borrowed callback. */
  readonly canFinalize: boolean;
  /** Whether the session pass is collecting definitions without final emission. */
  readonly isDefinitionCollectionStage: boolean;
  /** Independent copy of the base image; edits cannot change host input. */
  readonly baseImage: Uint8Array;
  /** Writable namespace prefix applied to newly defined symbols. */
  currentNamespace: string;
  /** Logical assembly address for the current write cursor. */
  currentTargetAddress: number;
  /** Base address paired with the logical cursor for mapping. */
  currentTargetBaseAddress: number;
  /** Section start logical address for relative operations. */
  currentTargetStartAddress: number;
  /** Section start base address for metadata and mapping. */
  currentTargetBaseStartAddress: number;
  /** Number of bytes emitted in the current stage. */
  bytes: number;
  /** Fill byte used when expanding or aligning output buffers. */
  outputFillByte: number;
  /**
   * Live output during the borrowed callback. Reacquire typed views after growing writes.
   * A replacement is copied into session ownership and retains its array/fixed-view behavior.
   */
  outputBytes: number[] | Uint8Array;
  /** Mutable set of names promoted to session-global visibility. */
  readonly globalSymbols: {
    /** Promote a name to session-global visibility for ca65-style imports. */
    add(name: string): void;
  };
  /** Label table shared with the hosting assembly session. */
  readonly labelTable: {
    /** Look up a label entry by its storage key. */
    get(name: string): LabelEntry | undefined;
    /** Store or replace a label entry under its storage key. */
    set(name: string, value: LabelEntry): void;
  };
  /** Numeric evaluation entry point for plugin directive hooks. */
  readonly operandResolver: {
    /** Evaluate an expression to a numeric value for directive handlers. */
    getnum(expression: string | ExpressionNode): number;
  };
  /** Logical address to output offset mapping for patch-style writes. */
  readonly outputWriter: {
    /** Map a logical address to a zero-based output image offset. */
    toOutputOffset(address: number): number;
    /** Map an output offset back to a logical address. */
    fromOutputOffset(offset: number): number;
  };
  /** Data directive helpers bound to the active character table and stage. */
  readonly directiveRuntime: {
    /** Parse and emit a legacy string-based data directive. */
    handleDataDirective(type: string, values: string[]): void;
    /** Execute already parsed data with the session's current character table and stage policy. */
    executeDataStatement(statement: import("../ir/statement-node.js").NumericDataStatement): void;
  };
  /** Host file reader used for include-style plugin operations. */
  readonly includeSource: {
    /** Read included file bytes or text through the host VFS. */
    readFile(path: string, encoding?: BufferEncoding): Uint8Array | string;
  };
  /** Label definition and qualification helpers for plugin hooks. */
  readonly symbolScope: {
    /** Resolve a label to its numeric value, optionally requiring a static binding. */
    getLabelValue(name: string, requireStatic: boolean): number;
    /** Apply file-local and namespace qualification rules to a symbol name. */
    qualifySymbolName(name: string): string;
    /** Define or update a label binding with macro and hierarchy metadata. */
    setLabel(
      name: string,
      value?: number,
      isStatic?: boolean,
      isMacroLabel?: boolean,
      isGlobal?: boolean,
      modifiesHierarchy?: boolean,
    ): void;
  };
  /** Resolve the active architecture record, including its encoder when registered. */
  resolveActiveArchitecture(): { name: string; definition?: { encoder: ArchitectureEncoder } };
  /** Switch the active CPU architecture, optionally recording a source alias. */
  selectArchitecture(architecture: string, sourceAlias?: string): void;
  /** Expand define references in a source string for plugin hooks. */
  resolvedefines(expression: string): string;
  /** Evaluate an assertion expression, returning undefined when evaluation is deferred. */
  evaluateAssertion(expression: string | ExpressionNode): boolean | undefined;
  /** Move logical and output cursors to an absolute target address. */
  setWritePosition(address: number): void;
  /** Advance the logical cursor by a byte count without emitting data. */
  step(bytes: number): void;
  /** Emit one byte at the current write cursor. */
  write1(value: number): void;
  /** Emit a 16-bit little-endian value at the current cursor. */
  write2(value: number): void;
  /** Emit a 24-bit value at the current cursor. */
  write3(value: number): void;
  /** Patch an output byte interval without advancing the logical cursor. */
  writeOutputBytes(offset: number, value: number, length?: number): void;
  /** Grow the output buffer to at least the requested size using a fill byte. */
  expandOutput(size: number, fillByte: number): void;
}
