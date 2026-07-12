import type { InstructionDescriptor } from "../architecture-types.js";
import { type DirectiveDescriptor } from "./directive-catalog.js";
/**
 * A unified completion-friendly view over instructions and directives.
 */
export type CatalogEntry = {
    /** The label as typed in source. */
    label: string;
    /** Whether this entry is an instruction or a directive/keyword. */
    kind: "instruction" | "directive";
    /** A short summary for documentation. */
    detail: string;
    /** Markdown documentation including syntax forms. */
    documentation: string;
};
/**
 * Returns the instruction catalog for an architecture.
 * @param {string} architecture The architecture name.
 * @returns {InstructionDescriptor[]} The instruction descriptors.
 */
export declare function getInstructionCatalog(architecture: string): InstructionDescriptor[];
/**
 * Looks up an instruction descriptor by mnemonic (case-insensitive).
 * @param {string} mnemonic The mnemonic to find.
 * @param {string} architecture The active architecture name.
 * @returns {InstructionDescriptor | undefined} The descriptor, if known.
 */
export declare function findInstruction(mnemonic: string, architecture: string): InstructionDescriptor | undefined;
/**
 * Re-exports the directive lookup so providers depend on a single module.
 * @param {string} keyword The directive keyword.
 * @returns {DirectiveDescriptor | undefined} The descriptor, if known.
 */
export declare function findDirectiveEntry(keyword: string): DirectiveDescriptor | undefined;
/**
 * Renders an instruction descriptor as Markdown hover documentation.
 * @param {InstructionDescriptor} descriptor The instruction descriptor.
 * @returns {string} The Markdown documentation.
 */
export declare function renderInstructionDocs(descriptor: InstructionDescriptor): string;
/**
 * Renders a directive descriptor as Markdown hover documentation.
 * @param {DirectiveDescriptor} descriptor The directive descriptor.
 * @returns {string} The Markdown documentation.
 */
export declare function renderDirectiveDocs(descriptor: DirectiveDescriptor): string;
/**
 * Builds the combined completion entries for an architecture.
 * @param {string} architecture The active architecture name.
 * @returns {CatalogEntry[]} The completion entries.
 */
export declare function buildCompletionEntries(architecture: string): CatalogEntry[];
//# sourceMappingURL=catalog.d.ts.map