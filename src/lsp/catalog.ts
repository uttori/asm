import type { InstructionDescriptor } from "../architecture-types.js";
import { getCatalogForArchitecture } from "./instruction-catalog.js";
import { directiveCatalog, findDirective, type DirectiveDescriptor } from "./directive-catalog.js";

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
export function getInstructionCatalog(architecture: string): InstructionDescriptor[] {
  return getCatalogForArchitecture(architecture);
}

/**
 * Looks up an instruction descriptor by mnemonic (case-insensitive).
 * @param {string} mnemonic The mnemonic to find.
 * @param {string} architecture The active architecture name.
 * @returns {InstructionDescriptor | undefined} The descriptor, if known.
 */
export function findInstruction(
  mnemonic: string,
  architecture: string,
): InstructionDescriptor | undefined {
  const upper = mnemonic.toUpperCase();
  return getCatalogForArchitecture(architecture).find((entry) => entry.mnemonic === upper);
}

/**
 * Re-exports the directive lookup so providers depend on a single module.
 * @param {string} keyword The directive keyword.
 * @returns {DirectiveDescriptor | undefined} The descriptor, if known.
 */
export function findDirectiveEntry(keyword: string): DirectiveDescriptor | undefined {
  return findDirective(keyword);
}

/**
 * Renders an instruction descriptor as Markdown hover documentation.
 * @param {InstructionDescriptor} descriptor The instruction descriptor.
 * @returns {string} The Markdown documentation.
 */
export function renderInstructionDocs(descriptor: InstructionDescriptor): string {
  const lines: string[] = [];
  lines.push(`**${descriptor.mnemonic}** — instruction`);
  if (descriptor.summary) {
    lines.push("", descriptor.summary);
  }
  if (descriptor.modes.length > 0) {
    lines.push("", "Addressing modes:");
    for (const mode of descriptor.modes) {
      const opcode =
        mode.opcode === undefined
          ? ""
          : ` \`$${mode.opcode.toString(16).padStart(2, "0").toUpperCase()}\``;
      const size = mode.size === undefined ? "" : ` (${mode.size} bytes)`;
      const example = mode.syntax
        ? ` \`${descriptor.mnemonic} ${mode.syntax}\``
        : ` \`${descriptor.mnemonic}\``;
      lines.push(`- ${mode.mode}:${example}${opcode}${size}`);
    }
  }
  return lines.join("\n");
}

/**
 * Renders a directive descriptor as Markdown hover documentation.
 * @param {DirectiveDescriptor} descriptor The directive descriptor.
 * @returns {string} The Markdown documentation.
 */
export function renderDirectiveDocs(descriptor: DirectiveDescriptor): string {
  return [
    `**${descriptor.keyword}** — directive`,
    "",
    descriptor.summary,
    "",
    `\`${descriptor.syntax}\``,
  ].join("\n");
}

/**
 * Builds the combined completion entries for an architecture.
 * @param {string} architecture The active architecture name.
 * @returns {CatalogEntry[]} The completion entries.
 */
export function buildCompletionEntries(architecture: string): CatalogEntry[] {
  const entries: CatalogEntry[] = [];

  for (const instruction of getCatalogForArchitecture(architecture)) {
    entries.push({
      label: instruction.mnemonic,
      kind: "instruction",
      detail: instruction.summary ?? "instruction",
      documentation: renderInstructionDocs(instruction),
    });
  }

  for (const directive of directiveCatalog) {
    entries.push({
      label: directive.keyword,
      kind: "directive",
      detail: directive.summary,
      documentation: renderDirectiveDocs(directive),
    });
  }

  return entries;
}
