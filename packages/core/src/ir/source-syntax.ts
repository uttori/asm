import type { SourceSpan } from "../source-location.js";
import type { ExpressionNode } from "./expression-node.js";
import type { CommandProvenance, NormalizedCommand } from "./normalized-command.js";
import type { LabelStatement, NumericDataStatement } from "./statement-node.js";

/** JSON-safe plugin data. No live state, resolved values, capabilities or callbacks belong here. */
export type SyntaxValue =
  | null
  | boolean
  | number
  | string
  | readonly SyntaxValue[]
  | { readonly [key: string]: SyntaxValue };
/** Exact lexical occurrence; spans use UTF-16 columns and zero-based physical lines. */
export type SyntaxToken = { readonly text: string; readonly span: SourceSpan };
/** A pure parse result; errors become active only if execution reaches this occurrence. */
export type ContributionSyntax = {
  readonly kind: "plugin";
  readonly contributionId: string;
  readonly grammarVersion: string;
} & (
  | { readonly payload: SyntaxValue; readonly error?: never }
  | { readonly error: string; readonly payload?: never }
);

/** Contracts for the later declaration/data/resource migrations; leaves retain source spelling. */
export type DeclarationSyntax = {
  readonly kind: "declaration";
  readonly declaration:
    | "assignment"
    | "define"
    | "function"
    | "macro"
    | "struct"
    | "union"
    | "dataStruct"
    | "namespace"
    | "characterTable";
  readonly name: SyntaxToken;
  readonly parameters: readonly SyntaxToken[];
  readonly body: readonly SourceSyntax[];
  readonly value?: ExpressionNode;
};
export type DataItemSyntax =
  | {
      readonly kind: "expression";
      readonly expression: ExpressionNode;
      readonly spelling: SyntaxToken;
    }
  | { readonly kind: "string"; readonly spelling: SyntaxToken; readonly value: string }
  | {
      readonly kind: "initializer";
      readonly fields: readonly { readonly name?: SyntaxToken; readonly value: DataItemSyntax }[];
    };
export type TemplateSegmentSyntax =
  | { readonly kind: "text"; readonly token: SyntaxToken }
  | {
      readonly kind: "reference";
      readonly reference: "argument" | "define" | "variadic";
      readonly token: SyntaxToken;
      readonly index?: ExpressionNode;
    };

/** Inline data borrows its parent's occurrence instead of duplicating provenance and parsed text. */
export type NumericDataFragment = {
  readonly kind: "numericDataFragment";
  readonly command: string;
  /** Index of the first data token in the containing command; avoids duplicating its token array. */
  readonly wordOffset: number;
  readonly statement: NumericDataStatement;
};

/** Source syntax is immutable and stage-independent; binding owns values and side effects. */
export type SourceSyntax =
  | { readonly kind: "label"; readonly statement: LabelStatement }
  | {
      readonly kind: "sequence";
      readonly declaration: LabelStatement;
      readonly following: NormalizedCommand | NumericDataFragment;
    }
  | { readonly kind: "numericData"; readonly statement: NumericDataStatement }
  | DeclarationSyntax
  | {
      readonly kind: "data";
      readonly width: 1 | 2 | 3 | 4;
      readonly items: readonly DataItemSyntax[];
    }
  | {
      readonly kind: "resource";
      readonly operation: "include" | "binary" | "asset";
      readonly path: SyntaxToken;
      readonly arguments: readonly DataItemSyntax[];
    }
  | { readonly kind: "template"; readonly segments: readonly TemplateSegmentSyntax[] }
  | {
      readonly kind: "invocation";
      readonly name: SyntaxToken;
      readonly arguments: readonly SyntaxToken[];
    }
  | ContributionSyntax;

/** A parser receives detached syntax only, never a session or evaluator. */
export type SyntaxParseInput = {
  /** Preparsed core declaration, when present; copied data with no session bindings. */
  readonly declaration?: import("./declaration-node.js").DeclarationNode;
  readonly keyword: string;
  readonly text: string;
  readonly words: readonly string[];
  readonly source: CommandProvenance;
};
export interface SyntaxGrammar {
  /** Change whenever accepted syntax or payload schema changes; part of cache/worker identity. */
  readonly version: string;
  parse(input: SyntaxParseInput): SyntaxValue;
  /** Validate both fresh results and deserialized payloads before binding/execution. */
  validate(payload: SyntaxValue): boolean;
}

/**
 * Copy a bounded plain JSON tree without invoking accessors or preserving prototypes.
 * Reject cyclic/host objects early so worker snapshots cannot silently change their meaning.
 * Allow up to 1,000,000 values and 128 nesting levels (the root is level zero).
 */
export function copySyntaxValue(value: unknown): SyntaxValue {
  return copySyntaxTree(value, false);
}

/** Only roots copied and recursively frozen here may bypass later defensive copies. */
const immutableRoots = new WeakSet<object>();

/** Detach and freeze a bounded JSON tree; never freeze caller-owned parser or transport objects. */
export function immutableSyntaxValue(value: unknown): SyntaxValue {
  const result = copySyntaxTree(value, true);
  if (result !== null && typeof result === "object") {
    immutableRoots.add(result);
  }
  return result;
}

/** Object.freeze alone cannot prove recursive immutability or prior structural validation. */
export function isImmutableSyntaxValue(value: unknown): value is SyntaxValue {
  return value !== null && typeof value === "object" && immutableRoots.has(value);
}

/** Share validation and allocation limits between mutable plugin snapshots and immutable built-ins. */
function copySyntaxTree(value: unknown, immutable: boolean): SyntaxValue {
  const ancestors = new Set<object>();
  let nodes = 0;
  const copy = (entry: unknown, depth: number): SyntaxValue => {
    // A 64 KiB record initializer needs over 900,000 values once expressions and source
    // spans are included. Bound total allocation independently from recursive stack depth.
    if (++nodes > 1_000_000) {
      throw new Error("Plugin syntax payload exceeds structural limits (1,000,000 values).");
    }
    if (depth > 128) {
      throw new Error("Plugin syntax payload exceeds structural limits (128 nesting levels).");
    }
    if (entry === null || typeof entry === "string" || typeof entry === "boolean") {
      return entry;
    }
    if (typeof entry === "number" && Number.isFinite(entry)) {
      return entry;
    }
    if (typeof entry !== "object") {
      throw new Error("Plugin syntax payload must be plain JSON data.");
    }
    if (ancestors.has(entry)) {
      throw new Error("Plugin syntax payload must be acyclic.");
    }
    const prototype: unknown = Object.getPrototypeOf(entry);
    if (!Array.isArray(entry) && prototype !== Object.prototype && prototype !== null) {
      throw new Error("Plugin syntax payload must have a plain prototype.");
    }
    if (Object.getOwnPropertySymbols(entry).length) {
      throw new Error("Plugin syntax payload cannot contain symbol properties.");
    }
    ancestors.add(entry);
    try {
      const keys = Object.getOwnPropertyNames(entry);
      if (Array.isArray(entry)) {
        const result: SyntaxValue[] = [];
        for (let index = 0; index < entry.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(entry, index);
          if (!descriptor) {
            throw new Error("Plugin syntax arrays must be dense.");
          }
          if (!("value" in descriptor)) {
            throw new Error("Plugin syntax payload cannot contain accessors.");
          }
          result.push(copy(descriptor.value, depth + 1));
        }
        if (keys.length !== entry.length + 1) {
          throw new Error("Plugin syntax arrays cannot have custom properties.");
        }
        return immutable ? Object.freeze(result) : result;
      }
      // Inspect one property at a time instead of allocating a descriptor table,
      // entries and pairs for every AST node. Data properties retain accessor isolation.
      const result: Record<string, SyntaxValue> = {};
      for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(entry, key);
        if (!descriptor || !("value" in descriptor)) {
          throw new Error("Plugin syntax payload cannot contain accessors.");
        }
        const copied = copy(descriptor.value, depth + 1);
        // Check after copying children, which can traverse plugin proxies. An
        // inherited setter or __proto__ must become an own data property; ordinary
        // AST fields can use the cheaper assignment path without descriptor allocation.
        if (Object.hasOwn(Object.prototype, key)) {
          Object.defineProperty(result, key, {
            value: copied,
            enumerable: true,
            writable: true,
            configurable: true,
          });
        } else {
          result[key] = copied;
        }
      }
      return immutable ? Object.freeze(result) : result;
    } finally {
      ancestors.delete(entry);
    }
  };
  return copy(value, 0);
}
