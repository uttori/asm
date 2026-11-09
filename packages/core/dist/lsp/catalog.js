import { directiveCatalog, } from "./directive-catalog.js";
/**
 * Returns the instruction catalog for an architecture.
 * @param architecture The architecture name.
 * @param [provider] Optional extension catalog provider.
 * @returns The instruction descriptors.
 */
export function getInstructionCatalog(architecture, provider) {
    return provider?.getInstructionCatalog(architecture) ?? [];
}
/**
 * Looks up an instruction descriptor by mnemonic (case-insensitive).
 * @param mnemonic The mnemonic to find.
 * @param architecture The active architecture name.
 * @param [provider] Optional extension catalog provider.
 * @returns The descriptor, if known.
 */
/** WeakMap cache of pre-built mnemonic maps per instruction catalog array reference. */
const instructionCatalogMapCache = new WeakMap();
/** Builds or reuses a mnemonic map for one instruction catalog array. */
function getInstructionCatalogMap(catalog) {
    let map = instructionCatalogMapCache.get(catalog);
    if (!map) {
        map = new Map(catalog.map((d) => [d.mnemonic, d]));
        instructionCatalogMapCache.set(catalog, map);
    }
    return map;
}
/** Case-insensitive mnemonic lookup against the active architecture catalog. */
export function findInstruction(mnemonic, architecture, provider) {
    const upper = mnemonic.toUpperCase();
    return getInstructionCatalogMap(getInstructionCatalog(architecture, provider)).get(upper);
}
/**
 * Finds a directive in an explicitly active descriptor catalog.
 * @param keyword The directive keyword.
 * @param directives Active directive descriptors.
 * @param [directivePrefixes] Prefixes accepted by the active syntax profile.
 * @returns The matching active directive.
 */
/** WeakMap cache of pre-built keyword maps per catalog array reference. */
const directiveCatalogMapCache = new WeakMap();
/** Builds or reuses a lowercase keyword map for one directive catalog array. */
function getDirectiveCatalogMap(directives) {
    let map = directiveCatalogMapCache.get(directives);
    if (!map) {
        map = new Map(directives.map((d) => [d.keyword.toLowerCase(), d]));
        directiveCatalogMapCache.set(directives, map);
    }
    return map;
}
/** Resolves a directive keyword against an active catalog and syntax prefixes. */
export function findDirectiveInCatalog(keyword, directives = directiveCatalog, directivePrefixes = ["@"]) {
    let canonical = keyword.toLowerCase();
    for (const prefix of directivePrefixes) {
        if (canonical.startsWith(prefix)) {
            canonical = canonical.slice(prefix.length);
            break;
        }
    }
    return getDirectiveCatalogMap(directives).get(canonical);
}
/**
 * Resolves a nested directive operand under the cursor (`bankcross` or `full`
 * in `check bankcross full`). The first token must be a catalogued directive.
 * @param lineText The current source line.
 * @param word The identifier under the cursor.
 * @param directives Active directive descriptors.
 * @param [directivePrefixes] Prefixes accepted by the active syntax profile.
 * @returns The operand docs, if this token is a known operand.
 */
export function findDirectiveOperand(lineText, word, directives = directiveCatalog, directivePrefixes = ["@"]) {
    const trimmed = (lineText.split(";")[0] ?? lineText).trim();
    if (!trimmed) {
        return undefined;
    }
    const tokens = trimmed
        .split(/[\s,]+/)
        .map((token) => token.replace(/^["'`]+|["'`]+$/g, ""))
        .filter(Boolean);
    if (tokens.length < 2) {
        return undefined;
    }
    const directive = findDirectiveInCatalog(tokens[0], directives, directivePrefixes);
    if (!directive?.operands) {
        return undefined;
    }
    const target = word.toLowerCase();
    let current = directive.operands;
    for (let index = 1; index < tokens.length && current; index++) {
        const token = tokens[index].toLowerCase();
        const match = current.find((operand) => operand.keyword.toLowerCase() === token);
        if (!match) {
            continue;
        }
        // oxlint-disable-next-line security/detect-possible-timing-attacks
        if (token === target) {
            return match;
        }
        current = match.operands;
    }
    return undefined;
}
/**
 * Renders an instruction descriptor as Markdown hover documentation.
 * @param descriptor The instruction descriptor.
 * @returns The Markdown documentation.
 */
export function renderInstructionDocs(descriptor) {
    const lines = [];
    lines.push(`**${descriptor.mnemonic}** - instruction`);
    if (descriptor.summary) {
        lines.push("", descriptor.summary);
    }
    if (descriptor.modes.length > 0) {
        lines.push("", "Addressing modes:");
        for (const mode of descriptor.modes) {
            const opcode = mode.opcode === undefined
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
 * @param descriptor The directive or operand descriptor.
 * @returns The Markdown documentation.
 */
export function renderDirectiveDocs(descriptor) {
    return [
        `**${descriptor.keyword}** - directive`,
        "",
        descriptor.summary,
        "",
        `\`${descriptor.syntax}\``,
    ].join("\n");
}
/**
 * Renders an expression-function descriptor as Markdown hover documentation.
 * @param descriptor The expression function descriptor.
 * @returns The Markdown documentation.
 */
export function renderExpressionFunctionDocs(descriptor) {
    const parameters = descriptor.signature.parameters.join(", ");
    return [
        `**${descriptor.name}** - expression function`,
        "",
        descriptor.summary,
        "",
        `\`${descriptor.name}(${parameters})\``,
    ].join("\n");
}
/**
 * Builds the combined completion entries for an architecture.
 * @param architecture The active architecture name.
 * @param [provider] Optional extension catalog provider.
 * @param [directives] Active directive descriptors.
 * @param [expressionFunctions] Active expression functions.
 * @returns The completion entries.
 */
export function buildCompletionEntries(architecture, provider, directives = directiveCatalog, expressionFunctions = []) {
    const entries = [];
    for (const instruction of getInstructionCatalog(architecture, provider)) {
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
//# sourceMappingURL=catalog.js.map