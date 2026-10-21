import { parseCommandOperation } from "../ir/command-operation.js";
import { parseDefineTemplate, bindDefineTemplate, } from "../ir/define-template.js";
import { setCommandKind } from "../ir/normalized-command.js";
import { sourceFragment, fragmentText, sliceSourceFragment, bindSourceFragment, } from "../ir/source-fragment.js";
export class DefineEngine {
    host;
    /** Value identity remains in defines; metadata is refreshed when a declaration executes. */
    origins = new Map();
    syntaxCache = new Map();
    /** Release snapshot-owned syntax while retaining live declaration values. */
    clearSyntaxCache() {
        this.syntaxCache.clear();
        this.origins.clear();
    }
    template(text, escapes = "basic") {
        const key = `${escapes}:${text}`;
        let template = this.syntaxCache.get(key);
        if (!template) {
            template = parseDefineTemplate(text, escapes);
            this.syntaxCache.set(key, template);
        }
        return template;
    }
    /** Bind one define phase; dynamic names may themselves be attributed generated fragments. */
    resolveFragment(fragment) {
        const text = fragmentText(fragment);
        if (!text.includes("!") && !text.includes("\\")) {
            return fragment;
        }
        return bindDefineTemplate(this.template(text), fragment, (part) => {
            let name = part.name;
            if (part.braced) {
                const nameFragment = sliceSourceFragment(fragment, part.start + 2, part.end - 1);
                name = this.host.resolveDefineFragment
                    ? fragmentText(this.host.resolveDefineFragment(nameFragment))
                    : this.host.resolvedefines(part.name);
            }
            const value = this.host.lookupDefineValue
                ? this.host.lookupDefineValue(name)
                : this.host.defines.get(name);
            if (value === undefined) {
                throw new Error(`Define '${name}' not found.`);
            }
            const origin = this.origins.get(name);
            return sourceFragment(value, origin ? [origin] : []);
        });
    }
    /** Attribute a generated statement to its invoking define rather than reparsing an anonymous string. */
    dispatch(fragment) {
        this.host.processSourceFragment(fragment);
    }
    constructor(host) {
        this.host = host;
    }
    isPureMathExpression(value) {
        // oxlint-disable-next-line security/detect-unsafe-regex -- Anchors bound the complete token grammar.
        return /^\s*(?:\$[\dA-Fa-f]+|%[01]+|\d+|[&()*+/<>^|-]|\s)+$/.test(value);
    }
    /**
     * Handles a define command.
     * @param {NormalizedCommand} commandNode The command node to handle.
     * @returns {boolean} `true` if the command was handled, `false` otherwise.
     */
    handleCommand(commandNode) {
        const operation = commandNode.parsed.operation;
        if (!operation ||
            !["defineAssignment", "undef", "defineExpansion", "invalid"].includes(operation.kind)) {
            return false;
        }
        if (operation.kind === "defineAssignment" ||
            operation.kind === "undef" ||
            operation.kind === "defineExpansion" ||
            operation.kind === "invalid") {
            this.executeOperation(operation, commandNode.source);
            setCommandKind(commandNode, "defineCommand");
            return true;
        }
        return false;
    }
    /**
     * Handles a define command.
     * @param {string} command The command to handle.
     * @example
     * !identifier = value // Basic assignment
     * !identifier += value // Append to existing value
     * !identifier := value // Resolve defines in the value
     * !identifier #= value // Evaluate as math expression
     * !identifier ?= value // Only assign if not already defined
     * undef identifier // Remove a define
     * undef "identifier" // Remove a define
     */
    handleDefineCommand(command, source) {
        const operation = parseCommandOperation(command);
        if (!operation ||
            (operation.kind !== "defineAssignment" &&
                operation.kind !== "undef" &&
                operation.kind !== "invalid")) {
            throw new Error(`Invalid define syntax: ${command}`);
        }
        this.executeOperation(operation, source);
    }
    /** Apply a parsed declaration or expand a source-valued define in the current scope. */
    executeOperation(operation, source) {
        if (operation.kind === "invalid") {
            throw new Error(operation.message);
        }
        if (operation.kind === "undef") {
            this.host.defines.delete(operation.name);
            this.origins.delete(operation.name);
            return;
        }
        if (operation.kind === "defineAssignment") {
            const name = operation.dynamic ? this.processNestedDefines(operation.name) : operation.name;
            this.applyDefineOperation(name, operation.operator, operation.value, source);
            return;
        }
        if (operation.dynamic) {
            this.dispatch(this.resolveFragment(sourceFragment(`!${operation.name}`, source ? [source] : [])));
            return;
        }
        const value = this.host.defines.get(operation.name);
        if (value === undefined) {
            throw new Error(`Error: Define '${operation.name}' not found.`);
        }
        const origins = source ? [source] : [];
        const declaration = this.origins.get(operation.name);
        if (declaration) {
            origins.push(declaration);
        }
        this.dispatch(sourceFragment(value, origins));
    }
    /**
     * Resolves nested defines in a string.
     * @param {string} content The content to process.
     * @returns {string} The processed content with nested defines resolved.
     */
    processNestedDefines(content) {
        if (!content.includes("!")) {
            return content;
        }
        let prevResult = "";
        let result = content;
        let iterations = 0;
        const maxIterations = 10;
        while (prevResult !== result && iterations < maxIterations) {
            iterations++;
            prevResult = result;
            result = this.resolveOneLevelOfDefines(result);
        }
        return result;
    }
    /**
     * Resolves one level of defines in a string.
     * @param {string} content The content to process.
     * @returns {string} The processed content with one level of defines resolved.
     */
    resolveOneLevelOfDefines(content) {
        const template = this.template(content, "none");
        let selected;
        const visit = (parts) => {
            for (const part of parts) {
                if (part.kind === "error") {
                    throw new Error(`Mismatched braces in content: ${content}`);
                }
                if (part.kind === "define" && part.braced) {
                    selected = part;
                    visit(part.children);
                }
            }
        };
        visit(template.parts);
        if (!selected) {
            return this.resolveRegularDefines(content);
        }
        const value = this.host.defines.get(selected.name) ?? selected.name;
        return fragmentText(bindSourceFragment(sourceFragment(content), [
            { start: selected.start, end: selected.end, value: sourceFragment(value) },
        ]));
    }
    /**
     * Resolves regular defines in a string.
     * @param {string} content The content to process.
     * @returns {string} The processed content with regular defines resolved.
     */
    resolveRegularDefines(content) {
        return fragmentText(this.resolveRegularFragment(sourceFragment(content)));
    }
    /** Bind only unbraced defines, preserving string/resource grammar and physical contributors. */
    resolveRegularFragment(fragment) {
        const template = this.template(fragmentText(fragment), "none");
        const regular = {
            ...template,
            parts: template.parts.filter((part) => part.kind === "define" && !part.braced),
        };
        return bindDefineTemplate(regular, fragment, (part) => {
            const value = this.host.defines.get(part.name);
            if (value === undefined) {
                throw new Error(`Define '${part.name}' not found.`);
            }
            const origin = this.origins.get(part.name);
            return sourceFragment(value, origin ? [origin] : []);
        });
    }
    /**
     * Resolves defines in a string literal.
     * @param {string} content The content to process.
     * @returns {string} The processed content with defines in string literal resolved.
     */
    resolveDefinesInStringLiteral(content) {
        const template = this.template(content, "string");
        // String-literal binding resolves ordinary defines only; braced syntax retains its spelling.
        const regular = {
            ...template,
            parts: template.parts.filter((part) => part.kind === "escape" || (part.kind === "define" && !part.braced)),
        };
        return fragmentText(bindDefineTemplate(regular, sourceFragment(content), (part) => {
            const value = this.host.defines.get(part.name);
            if (value === undefined) {
                throw new Error(`Define '${part.name}' not found.`);
            }
            return sourceFragment(value);
        }));
    }
    /**
     * Processes a value with braced defines.
     * @param {string} value The value to process.
     * @returns {string} The processed value with braced defines resolved.
     */
    processValueWithBracedDefines(value) {
        const template = this.template(value, "none");
        const braced = {
            ...template,
            parts: template.parts.filter((part) => part.kind === "error" || (part.kind === "define" && part.braced)),
        };
        return fragmentText(bindDefineTemplate(braced, sourceFragment(value), (part) => sourceFragment(`!{${this.processNestedDefines(part.name)}}`), `Mismatched braces in value: ${value}`));
    }
    /**
     * Applies a define operation.
     * @param {string} identifier The identifier to apply the operation to.
     * @param {string} operator The operator to apply.
     * @param {string} initialValue The initial value to apply the operation to.
     */
    applyDefineOperation(identifier, operator, initialValue, source) {
        let value = initialValue;
        if (value.includes("!{")) {
            if (!value.includes("FF") && !value.includes("$")) {
                value = this.processNestedDefines(value);
            }
            else {
                value = this.processValueWithBracedDefines(value);
            }
        }
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
        }
        if (operator === ":=") {
            value = this.host.resolvedefines(value);
        }
        if (operator === "#=") {
            value = this.host.resolvedefines(value);
            const result = this.host.mathCore.math(value);
            if (Number.isNaN(result)) {
                throw new Error(`Math evaluation failed in define "#=" for expression: ${value}`);
            }
            value = result.toString();
        }
        if (operator === "?=" && this.host.defines.has(identifier)) {
            return;
        }
        if (operator === "+=") {
            value = (this.host.defines.get(identifier) ?? "") + value;
        }
        if (operator !== "#=" &&
            (value.includes("+") ||
                value.includes("-") ||
                value.includes("*") ||
                value.includes("/") ||
                value.includes("&") ||
                value.includes("|") ||
                value.includes("^") ||
                value.includes("<<") ||
                value.includes(">>") ||
                value.includes("("))) {
            try {
                const resolvedValue = this.host.resolvedefines(value);
                // Keep symbolic expressions such as `$004E+task` intact so member/index
                // suffixes can bind to the surviving struct token later (`!task_offset.stack_id`).
                if (this.isPureMathExpression(resolvedValue)) {
                    const result = this.host.mathCore.math(resolvedValue);
                    if (!Number.isNaN(result)) {
                        value = `$${result.toString(16).toUpperCase()}`;
                    }
                }
            }
            catch { }
        }
        this.host.defines.set(identifier, value);
        if (source) {
            this.origins.set(identifier, {
                file: source.file,
                line: source.line,
                span: source.span,
                text: source.text ?? source.raw,
            });
        }
        this.host.recordSymbolDefinition("define", identifier, {
            value,
            containerName: this.host.currentNamespace || undefined,
        });
    }
    /**
     * Applies an `undef` operation.
     * @param {string} command The normalized undef command.
     */
    applyUndefOperation(command) {
        this.handleDefineCommand(command);
    }
}
//# sourceMappingURL=define-engine.js.map