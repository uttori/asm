import type { ExpressionNode } from "./expression-node.js";
import { type SyntaxGrammar, type SyntaxParseInput, type SyntaxValue } from "./source-syntax.js";
/** Runtime guards validate transported syntax before a session receives it. */
export type SyntaxGuard<T> = (value: unknown) => value is T;
/** Accepts any string syntax payload field. */
export declare const syntaxString: SyntaxGuard<string>;
/** Accepts finite numeric syntax payload fields. */
export declare const syntaxNumber: SyntaxGuard<number>;
/** Accepts boolean syntax payload fields. */
export declare const syntaxBoolean: SyntaxGuard<boolean>;
/** Builds a guard that accepts only one exact literal value. */
export declare function syntaxLiteral<const T extends string | number | boolean>(literal: T): SyntaxGuard<T>;
/** Builds a guard that validates every array element with an element guard. */
export declare function syntaxArray<T>(guard: SyntaxGuard<T>): SyntaxGuard<T[]>;
/** Builds a guard that accepts undefined or a value passing the inner guard. */
export declare function syntaxOptional<T>(guard: SyntaxGuard<T>): SyntaxGuard<T | undefined>;
/** Extracts the accepted value type from a syntax guard. */
type Guarded<G> = G extends SyntaxGuard<infer T> ? T : never;
/** Narrow unknown objects before checking fields; transport validation separately rejects host objects. */
export declare function syntaxObject(value: unknown): value is Record<string, unknown>;
/** Reject unknown fields as well as wrong types, so versioned payloads cannot silently lose meaning. */
export declare function syntaxRecord<S extends Record<string, SyntaxGuard<unknown>>>(shape: S): SyntaxGuard<{
    [K in keyof S]: Guarded<S[K]>;
}>;
/** Builds a guard that succeeds when any member guard accepts the value. */
export declare function syntaxUnion<T extends readonly SyntaxGuard<unknown>[]>(...guards: T): SyntaxGuard<Guarded<T[number]>>;
/** UTF-16 offsets are nonnegative; a physical line is optional for detached fragments. */
export declare const syntaxSpan: SyntaxGuard<{
    start: number;
    end: number;
    line: number | undefined;
    columnStart: number | undefined;
    columnEnd: number | undefined;
}>;
/** Validate expression children recursively; raw public adapters are never portable execution syntax. */
export declare const syntaxExpression: SyntaxGuard<ExpressionNode>;
/** Build the same portable parse/validate contract for core directives and plugin contributions. */
export declare function syntaxCodec<T>(version: string, parse: (input: SyntaxParseInput) => T, guard: SyntaxGuard<T>): SyntaxGrammar & {
    read(payload: SyntaxValue): T;
};
/** Borrowed lexical data. Runtime freezing also covers nested fields of legacy mutable AST types. */
export type ImmutableSyntax<T> = Readonly<T>;
/**
 * Explicit read-only codec for built-ins. Guards must be pure and executors must not mutate payloads.
 * Mutable plugins keep syntaxCodec; transported values still require bounded copying and validation.
 */
export declare function immutableSyntaxCodec<T>(version: string, parse: (input: SyntaxParseInput) => T, guard: SyntaxGuard<T>): SyntaxGrammar & {
    read(payload: SyntaxValue): ImmutableSyntax<T>;
};
export {};
//# sourceMappingURL=syntax-codec.d.ts.map