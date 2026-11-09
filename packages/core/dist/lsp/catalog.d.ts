import type { InstructionDescriptor } from "../architecture-types.js";
import type { ExpressionFunctionDescriptor } from "../plugin/contracts.js";
import { type DirectiveDescriptor, type DirectiveDocs } from "./directive-catalog.js";
import type { InstructionCatalogProvider } from "./instruction-catalog.js";
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
 * @param architecture The architecture name.
 * @param [provider] Optional extension catalog provider.
 * @returns The instruction descriptors.
 */
export declare function getInstructionCatalog(architecture: string, provider?: InstructionCatalogProvider): readonly InstructionDescriptor[];
/** Case-insensitive mnemonic lookup against the active architecture catalog. */
export declare function findInstruction(mnemonic: string, architecture: string, provider?: InstructionCatalogProvider): InstructionDescriptor | undefined;
/** Resolves a directive keyword against an active catalog and syntax prefixes. */
export declare function findDirectiveInCatalog(keyword: string, directives?: readonly DirectiveDescriptor[], directivePrefixes?: readonly string[]): DirectiveDescriptor | undefined;
/**
 * Resolves a nested directive operand under the cursor (`bankcross` or `full`
 * in `check bankcross full`). The first token must be a catalogued directive.
 * @param lineText The current source line.
 * @param word The identifier under the cursor.
 * @param directives Active directive descriptors.
 * @param [directivePrefixes] Prefixes accepted by the active syntax profile.
 * @returns The operand docs, if this token is a known operand.
 */
export declare function findDirectiveOperand(lineText: string, word: string, directives?: readonly DirectiveDescriptor[], directivePrefixes?: readonly string[]): DirectiveDocs | undefined;
/**
 * Renders an instruction descriptor as Markdown hover documentation.
 * @param descriptor The instruction descriptor.
 * @returns The Markdown documentation.
 */
export declare function renderInstructionDocs(descriptor: InstructionDescriptor): string;
/**
 * Renders a directive descriptor as Markdown hover documentation.
 * @param descriptor The directive or operand descriptor.
 * @returns The Markdown documentation.
 */
export declare function renderDirectiveDocs(descriptor: DirectiveDocs): string;
/**
 * Renders an expression-function descriptor as Markdown hover documentation.
 * @param descriptor The expression function descriptor.
 * @returns The Markdown documentation.
 */
export declare function renderExpressionFunctionDocs(descriptor: ExpressionFunctionDescriptor): string;
/**
 * Builds the combined completion entries for an architecture.
 * @param architecture The active architecture name.
 * @param [provider] Optional extension catalog provider.
 * @param [directives] Active directive descriptors.
 * @param [expressionFunctions] Active expression functions.
 * @returns The completion entries.
 */
export declare function buildCompletionEntries(architecture: string, provider?: InstructionCatalogProvider, directives?: readonly DirectiveDescriptor[], expressionFunctions?: readonly ExpressionFunctionDescriptor[]): CatalogEntry[];
//# sourceMappingURL=catalog.d.ts.map