import type { InstructionDescriptor } from "../architecture-types.js";
import type { InstructionCatalogProvider } from "./instruction-catalog.js";
import { type DirectiveDescriptor, type DirectiveDocs } from "./directive-catalog.js";
import type { ExpressionFunctionDescriptor } from "../plugin/contracts.js";
/**
 * A unified completion-friendly view over instructions and directives.
 */
export type CatalogEntry = {
    /** The label as typed in source. */
    label: string;
    /** Whether this entry is an instruction or a directive/keyword. */
    kind: "instruction" | "directive" | "expression";
    /** A short summary for documentation. */
    detail: string;
    /** Markdown documentation including syntax forms. */
    documentation: string;
};
/**
 * Returns the instruction catalog for an architecture.
 * @param {string} architecture The architecture name.
 * @param {InstructionCatalogProvider} [provider] Optional extension catalog provider.
 * @returns {InstructionDescriptor[]} The instruction descriptors.
 */
export declare function getInstructionCatalog(architecture: string, provider?: InstructionCatalogProvider): readonly InstructionDescriptor[];
export declare function findInstruction(mnemonic: string, architecture: string, provider?: InstructionCatalogProvider): InstructionDescriptor | undefined;
/**
 * Re-exports the directive lookup so providers depend on a single module.
 * @param {string} keyword The directive keyword.
 * @returns {DirectiveDescriptor | undefined} The descriptor, if known.
 */
export declare function findDirectiveEntry(keyword: string): DirectiveDescriptor | undefined;
export declare function findDirectiveInCatalog(keyword: string, directives?: readonly DirectiveDescriptor[], directivePrefixes?: readonly string[]): DirectiveDescriptor | undefined;
/**
 * Resolves a nested directive operand under the cursor (`bankcross` or `full`
 * in `check bankcross full`). The first token must be a catalogued directive.
 * @param {string} lineText The current source line.
 * @param {string} word The identifier under the cursor.
 * @param {readonly DirectiveDescriptor[]} directives Active directive descriptors.
 * @param {readonly string[]} [directivePrefixes] Prefixes accepted by the active syntax profile.
 * @returns {DirectiveDocs | undefined} The operand docs, if this token is a known operand.
 */
export declare function findDirectiveOperand(lineText: string, word: string, directives?: readonly DirectiveDescriptor[], directivePrefixes?: readonly string[]): DirectiveDocs | undefined;
/**
 * Renders an instruction descriptor as Markdown hover documentation.
 * @param {InstructionDescriptor} descriptor The instruction descriptor.
 * @returns {string} The Markdown documentation.
 */
export declare function renderInstructionDocs(descriptor: InstructionDescriptor): string;
/**
 * Renders a directive descriptor as Markdown hover documentation.
 * @param {DirectiveDocs} descriptor The directive or operand descriptor.
 * @returns {string} The Markdown documentation.
 */
export declare function renderDirectiveDocs(descriptor: DirectiveDocs): string;
/**
 * Renders an expression-function descriptor as Markdown hover documentation.
 * @param {ExpressionFunctionDescriptor} descriptor The expression function descriptor.
 * @returns {string} The Markdown documentation.
 */
export declare function renderExpressionFunctionDocs(descriptor: ExpressionFunctionDescriptor): string;
/**
 * Builds the combined completion entries for an architecture.
 * @param {string} architecture The active architecture name.
 * @param {InstructionCatalogProvider} [provider] Optional extension catalog provider.
 * @param {readonly DirectiveDescriptor[]} [directives] Active directive descriptors.
 * @param {readonly ExpressionFunctionDescriptor[]} [expressionFunctions] Active expression functions.
 * @returns {CatalogEntry[]} The completion entries.
 */
export declare function buildCompletionEntries(architecture: string, provider?: InstructionCatalogProvider, directives?: readonly DirectiveDescriptor[], expressionFunctions?: readonly ExpressionFunctionDescriptor[]): CatalogEntry[];
//# sourceMappingURL=catalog.d.ts.map