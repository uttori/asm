import type { LinkExpression } from "../ir/link-expression.js";
import type { AssemblyModule } from "../relocatable.js";
/** Bound expression depth and node count before recursive linking; arbitrary object tags are never executable. */
export declare function assertLinkExpression(value: unknown, depth?: number, budget?: {
    nodes: number;
}): asserts value is LinkExpression;
/** Validate all externally supplied records, cross-section extents, and non-overlapping fixup ownership. */
export declare function assertAssemblyModule(input: unknown): asserts input is AssemblyModule;
//# sourceMappingURL=validation.d.ts.map