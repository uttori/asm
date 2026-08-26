import type { InstructionDescriptor } from "../architecture-types.js";
import {
  getCatalogForArchitecture,
  type InstructionCatalogProvider,
} from "./instruction-catalog.js";
import { directiveCatalog, findDirective, type DirectiveDescriptor } from "./directive-catalog.js";
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
export function getInstructionCatalog(
  architecture: string,
  provider?: InstructionCatalogProvider,
): InstructionDescriptor[] {
  return getCatalogForArchitecture(architecture, provider);
}

/**
 * Looks up an instruction descriptor by mnemonic (case-insensitive).
 * @param {string} mnemonic The mnemonic to find.
 * @param {string} architecture The active architecture name.
 * @param {InstructionCatalogProvider} [provider] Optional extension catalog provider.
 * @returns {InstructionDescriptor | undefined} The descriptor, if known.
 */
export function findInstruction(
  mnemonic: string,
  architecture: string,
  provider?: InstructionCatalogProvider,
): InstructionDescriptor | undefined {
  const upper = mnemonic.toUpperCase();
  return getCatalogForArchitecture(architecture, provider).find(
    (entry) => entry.mnemonic === upper,
  );
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
 * Finds a directive in an explicitly active descriptor catalog.
 * @param {string} keyword The directive keyword.
 * @param {readonly DirectiveDescriptor[]} directives Active directive descriptors.
 * @param {readonly string[]} [directivePrefixes] Prefixes accepted by the active syntax profile.
 * @returns {DirectiveDescriptor | undefined} The matching active directive.
 */
export function findDirectiveInCatalog(
  keyword: string,
  directives: readonly DirectiveDescriptor[] = directiveCatalog,
  directivePrefixes: readonly string[] = ["@"],
): DirectiveDescriptor | undefined {
  let canonical = keyword.toLowerCase();
  for (const prefix of directivePrefixes) {
    if (canonical.startsWith(prefix)) {
      canonical = canonical.slice(prefix.length);
      break;
    }
  }
  return directives.find((directive) => directive.keyword.toLowerCase() === canonical);
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
 * Renders an expression-function descriptor as Markdown hover documentation.
 * @param {ExpressionFunctionDescriptor} descriptor The expression function descriptor.
 * @returns {string} The Markdown documentation.
 */
export function renderExpressionFunctionDocs(descriptor: ExpressionFunctionDescriptor): string {
  const parameters = descriptor.signature.parameters.join(", ");
  return [
    `**${descriptor.name}** — expression function`,
    "",
    descriptor.summary,
    "",
    `\`${descriptor.name}(${parameters})\``,
  ].join("\n");
}

/**
 * Builds the combined completion entries for an architecture.
 * @param {string} architecture The active architecture name.
 * @param {InstructionCatalogProvider} [provider] Optional extension catalog provider.
 * @param {readonly DirectiveDescriptor[]} [directives] Active directive descriptors.
 * @param {readonly ExpressionFunctionDescriptor[]} [expressionFunctions] Active expression functions.
 * @returns {CatalogEntry[]} The completion entries.
 */
export function buildCompletionEntries(
  architecture: string,
  provider?: InstructionCatalogProvider,
  directives: readonly DirectiveDescriptor[] = directiveCatalog,
  expressionFunctions: readonly ExpressionFunctionDescriptor[] = [],
): CatalogEntry[] {
  const entries: CatalogEntry[] = [];

  for (const instruction of getCatalogForArchitecture(architecture, provider)) {
    entries.push({
      label: instruction.mnemonic,
      kind: "instruction",
      detail: instruction.summary ?? "instruction",
      documentation: renderInstructionDocs(instruction),
    });
  }

  for (const directive of directives) {
    entries.push({
      label: directive.keyword,
      kind: "directive",
      detail: directive.summary,
      documentation: renderDirectiveDocs(directive),
    });
  }

  for (const expressionFunction of expressionFunctions) {
    entries.push({
      label: expressionFunction.name,
      kind: "expression",
      detail: expressionFunction.summary,
      documentation: renderExpressionFunctionDocs(expressionFunction),
    });
    for (const alias of expressionFunction.aliases) {
      entries.push({
        label: alias,
        kind: "expression",
        detail: expressionFunction.summary,
        documentation: renderExpressionFunctionDocs({ ...expressionFunction, name: alias }),
      });
    }
  }

  return entries;
}
