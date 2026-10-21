import { incrementInternalCounter } from "../internal-instrumentation.js";
import { parseCommandOperation } from "../ir/command-operation.js";
import { createMacroLineTemplate, bindNumericMacroTemplate, parseMacroArguments, bindMacroFragment, } from "../ir/macro-template.js";
import { fragmentText, sourceFragment, sliceSourceFragment, bindSourceFragment, } from "../ir/source-fragment.js";
import { removeInlineComment } from "./command-text-service.js";
/** Copy only location fields: retaining a command here would duplicate its entire expansion chain. */
function occurrence(source) {
    return { file: source.file, line: source.line, span: source.span, text: source.raw };
}
export class MacroEngine {
    host;
    macroExpansionControlStack = [];
    /** Weak ownership releases definitions when an assembly snapshot is discarded. */
    templates = new WeakMap();
    constructor(host) {
        this.host = host;
    }
    /**
     * Checks whether the current macro expansion line is in an active branch.
     * @returns {boolean} `true` when the current expansion path is active.
     */
    isMacroExpansionActive() {
        return this.macroExpansionControlStack.every((entry) => entry.active);
    }
    /**
     * Checks whether the current macro expansion line is inside a deferred loop body.
     * @returns {boolean} `true` when loop-body commands should defer placeholder resolution.
     */
    isMacroExpansionLoopActive() {
        return this.macroExpansionControlStack.some((entry) => entry.active && (entry.type === "for" || entry.type === "while"));
    }
    /**
     * Evaluates a macro control-flow condition using the assembler expression engine.
     * @param {string} expression The expression text to evaluate.
     * @returns {boolean} The boolean result.
     */
    evaluateMacroControlExpression(expression) {
        const trimmed = removeInlineComment(expression).trim();
        if (!trimmed) {
            return false;
        }
        return this.host.evaluateExpression(trimmed);
    }
    /**
     * Updates macro expansion control state after dispatching a control-flow line.
     * @param {string} line The fully expanded line text.
     */
    updateMacroExpansionControlState(line) {
        const trimmed = removeInlineComment(line).trim();
        if (!trimmed) {
            return;
        }
        const [keyword, ...rest] = trimmed.split(/\s+/);
        const normalizedKeyword = keyword.toLowerCase();
        const currentIndex = this.macroExpansionControlStack.length - 1;
        const current = currentIndex >= 0 ? this.macroExpansionControlStack[currentIndex] : undefined;
        const parentActive = this.isMacroExpansionActive();
        const enclosingActive = this.macroExpansionControlStack
            .slice(0, -1)
            .every((entry) => entry.active);
        const expression = rest.join(" ").trim();
        switch (normalizedKeyword) {
            case "if": {
                const active = parentActive && this.evaluateMacroControlExpression(expression);
                this.macroExpansionControlStack.push({
                    type: "if",
                    active,
                    branchTaken: active,
                });
                return;
            }
            case "elseif": {
                if (!current || current.type !== "if") {
                    return;
                }
                if (!enclosingActive || current.branchTaken) {
                    current.active = false;
                    return;
                }
                const active = this.evaluateMacroControlExpression(expression);
                current.active = active;
                if (active) {
                    current.branchTaken = true;
                }
                return;
            }
            case "else": {
                if (!current || current.type !== "if") {
                    return;
                }
                current.active = enclosingActive && !current.branchTaken;
                current.branchTaken = true;
                return;
            }
            case "while": {
                const active = parentActive && this.evaluateMacroControlExpression(expression);
                this.macroExpansionControlStack.push({ type: "while", active });
                return;
            }
            case "for": {
                this.macroExpansionControlStack.push({ type: "for", active: parentActive });
                return;
            }
            case "endif": {
                if (current && (current.type === "if" || current.type === "while")) {
                    this.macroExpansionControlStack.pop();
                }
                return;
            }
            case "endwhile": {
                if (current?.type === "while") {
                    this.macroExpansionControlStack.pop();
                }
                return;
            }
            case "endfor": {
                if (current?.type === "for") {
                    this.macroExpansionControlStack.pop();
                }
                return;
            }
            default:
                return;
        }
    }
    /** Install a captured declaration without executing or lowering its template body. */
    installDefinition(header, body, source) {
        if (!this.host.isDefinitionCollectionStage) {
            return;
        }
        if (this.host.macros.has(header.name)) {
            throw new Error(`Macro '${header.name}' is already defined.`);
        }
        const parameters = [...header.parameters];
        const last = parameters.at(-1);
        const variadic = last === "..." || last === "…";
        if (variadic) {
            parameters.pop();
        }
        const definition = {
            name: header.name,
            params: parameters,
            variadic,
            body,
            source,
            sourceFile: source.file || this.host.currentFile,
        };
        this.templates.set(definition, body.map(createMacroLineTemplate));
        this.host.macros.set(header.name, definition);
        this.host.recordSymbolDefinition("macro", header.name, {
            file: definition.sourceFile,
            line: source.line,
        });
    }
    /**
     * Calls a macro.
     * @param {string} invocation The invocation to call.
     */
    callMacro(invocation, source) {
        const operation = parseCommandOperation(invocation.startsWith("%") ? invocation : `%${invocation}`);
        if (operation?.kind !== "macroCall") {
            throw new Error(operation?.kind === "invalid" ? operation.message : "Invalid macro invocation.");
        }
        this.executeInvocation(operation, source);
    }
    /** Bind parsed arguments once; the invocation owns all mutable expansion state. */
    executeInvocation(operation, source) {
        const invocation = source?.raw ?? operation.name;
        incrementInternalCounter("macroExpansions");
        this.host.macroLabelInstance++;
        const previousMacroExpansionState = this.host.inMacroExpansion;
        const previousVariadicCount = this.host.currentVariadicCount;
        const previousVariadicArgs = this.host.currentVariadicArgs;
        const previousMacroName = this.host.currentMacroName;
        const previousParentLabel = this.host.currentParentLabel;
        const previousParentIsGlobal = this.host.currentParentIsGlobal;
        const previousFile = this.host.currentFile;
        const previousMacroExpansionControlStack = this.macroExpansionControlStack.map((entry) => ({
            ...entry,
        }));
        this.host.inMacroExpansion = true;
        this.macroExpansionControlStack = [];
        try {
            if (!operation.parenthesized) {
                const macroName = operation.name;
                const macro = this.host.macros.get(macroName);
                if (!macro) {
                    throw new Error(`Error: Macro '${macroName}' not defined.`);
                }
                this.host.currentMacroName = macroName;
                if (macro.sourceFile) {
                    this.host.currentFile = macro.sourceFile;
                }
                if (macro.params.length > 0) {
                    const fixedArgs = new Map();
                    for (const param of macro.params) {
                        fixedArgs.set(param, "");
                    }
                    this.host.currentVariadicCount = 0;
                    this.host.currentVariadicArgs = [];
                    this.executeMacroBody(macro, fixedArgs, [], 0, source, invocation);
                }
                else {
                    // Bare zero-parameter calls historically inherit the enclosing variadic context.
                    this.executeMacroBody(macro, undefined, [], 0, source, invocation);
                }
                return;
            }
            const macroName = operation.name;
            const macro = this.host.macros.get(macroName);
            if (!macro) {
                throw new Error(`Error: Macro '${macroName}' not defined.`);
            }
            this.host.currentMacroName = macroName;
            if (macro.sourceFile) {
                this.host.currentFile = macro.sourceFile;
            }
            const argValues = operation.arguments;
            const fixedArgs = new Map();
            for (let i = 0; i < macro.params.length; i++) {
                fixedArgs.set(macro.params[i], i < argValues.length ? argValues[i] : "");
            }
            const variadicArgs = [];
            let variadicCount = 0;
            if (macro.variadic && argValues.length > macro.params.length) {
                variadicCount = argValues.length - macro.params.length;
                for (let i = macro.params.length; i < argValues.length; i++) {
                    variadicArgs.push(argValues[i]);
                }
            }
            this.host.currentVariadicCount = variadicCount;
            this.host.currentVariadicArgs = variadicArgs;
            this.executeMacroBody(macro, fixedArgs, variadicArgs, variadicCount, source, invocation);
        }
        finally {
            this.host.currentMacroName = previousMacroName;
            this.host.currentParentLabel = previousParentLabel;
            this.host.currentParentIsGlobal = previousParentIsGlobal;
            this.host.currentVariadicCount = previousVariadicCount;
            this.host.currentVariadicArgs = previousVariadicArgs;
            this.host.inMacroExpansion = previousMacroExpansionState;
            this.host.currentFile = previousFile;
            this.macroExpansionControlStack = previousMacroExpansionControlStack;
        }
    }
    /** Expand one template at a time so define writes and active branches affect the next line. */
    executeMacroBody(macro, fixedArgs, variadicArgs, variadicCount, source, invocationText) {
        let templates = this.templates.get(macro);
        if (!templates) {
            templates = macro.body.map(createMacroLineTemplate);
            this.templates.set(macro, templates);
        }
        const invocation = occurrence(source ?? { file: this.host.currentFile, line: 0 });
        // Use the original argument spelling for ranges, independently of decoding/binding values.
        const sourceText = source?.raw ?? invocationText;
        const open = sourceText.indexOf("(");
        const close = sourceText.lastIndexOf(")");
        let argumentStart = open + 1;
        let argumentText = sourceText.slice(argumentStart, close);
        if (open < 0 || close < open) {
            argumentStart = sourceText.search(/\s/) + 1;
            argumentText = argumentStart > 0 ? sourceText.slice(argumentStart) : "";
        }
        argumentStart += argumentText.length - argumentText.trimStart().length;
        argumentText = argumentText.trim();
        const argumentsOrigin = parseMacroArguments(argumentText).map((argument, index) => ({
            parameter: macro.params[index],
            index,
            text: argument.text,
            location: {
                file: invocation.file,
                line: invocation.line,
                text: sourceText,
                span: {
                    start: argumentStart + argument.start,
                    end: argumentStart + argument.end,
                    line: invocation.line,
                },
            },
        }));
        for (const template of templates) {
            const origin = {
                kind: "macro",
                name: macro.name,
                invocation,
                definition: occurrence(macro.source ?? { file: macro.sourceFile ?? invocation.file, line: 0 }),
                template: occurrence(template.command.source),
                arguments: argumentsOrigin,
                definitionContext: template.command.source.origin,
                parent: source?.origin,
            };
            const execute = () => {
                const body = sourceFragment(template.text, [origin.template]);
                const fragment = fixedArgs
                    ? this.expandMacroFragment(body, fixedArgs, variadicArgs, variadicCount, template, argumentsOrigin)
                    : body;
                const bound = fixedArgs
                    ? bindNumericMacroTemplate(template, fixedArgs, fragment)
                    : undefined;
                this.processMacroFragment(fragment, bound ?? template.command);
            };
            if (this.host.withSourceOrigin) {
                this.host.withSourceOrigin(origin, execute);
            }
            else {
                execute();
            }
        }
    }
    /**
     * Expands a macro line.
     * @param {string} line The line to expand.
     * @param {Map<string, string>} fixedArgs The fixed arguments.
     * @param {string[]} variadicArgs The variadic arguments.
     * @param {number} variadicCount The variadic count.
     * @returns {string} The expanded line.
     */
    expandMacroLine(line, fixedArgs, variadicArgs, variadicCount, template) {
        return fragmentText(this.expandMacroFragment(sourceFragment(line), fixedArgs, variadicArgs, variadicCount, template));
    }
    /** Bind one macro occurrence in phase order while retaining each argument's physical source. */
    expandMacroFragment(line, fixedArgs, variadicArgs, variadicCount, template, argumentsOrigin = []) {
        const replace = (fragment, kind, resolve) => bindMacroFragment(template, fragment, kind, (part) => {
            const value = resolve(part.text, part.payload);
            const origins = argumentsOrigin
                .filter((argument) => argument.parameter === part.payload)
                .map((argument) => argument.location);
            if (typeof value !== "string") {
                return {
                    segments: value.segments.map((segment) => ({
                        text: segment.text,
                        origins: [...origins, ...segment.origins],
                    })),
                };
            }
            return sourceFragment(value, origins);
        });
        const variadicValue = (expr) => {
            const binding = this.resolveVariadicBinding(expr, variadicArgs);
            const argument = argumentsOrigin.at(fixedArgs.size + binding.index);
            return sourceFragment(binding.value, argument ? [argument.location] : []);
        };
        line = replace(line, "defineName", (match, paramName) => {
            if (!fixedArgs.has(paramName)) {
                return match;
            }
            let name = (fixedArgs.get(paramName) ?? "").trim();
            if (name.startsWith("!")) {
                name = name.slice(1);
            }
            return `!${name}`;
        });
        const substituteParamValue = (raw) => {
            const value = raw.trim();
            if (!value.includes("!")) {
                return value;
            }
            return this.host.resolveDefineFragment
                ? this.host.resolveDefineFragment(sourceFragment(value))
                : this.host.resolvedefines(value);
        };
        const resolveDeprecatedBangAngle = (match, name) => {
            if (fixedArgs.has(name)) {
                const fixedValue = fixedArgs.get(name);
                return fixedValue !== undefined ? this.host.resolvedefines(fixedValue) : match;
            }
            if (/^[A-Za-z]$/.test(name)) {
                const index = name.toLowerCase().charCodeAt(0) - 97;
                if (index >= 0 && index < variadicCount) {
                    return variadicArgs[index];
                }
            }
            const defineValue = this.host.defines.get(name);
            return defineValue ?? match;
        };
        const lineText = fragmentText(line);
        if (lineText.trim().startsWith("!") && lineText.includes("=")) {
            const defineMatch = lineText.trim().match(/^!(\w+)\s*(=|\+=|:=|#=|\?=)\s*(.*)$/);
            if (defineMatch) {
                const varName = defineMatch[1];
                const operator = defineMatch[2];
                const value = defineMatch[3];
                const valueStart = lineText.lastIndexOf(value);
                let expandedValue = sliceSourceFragment(line, valueStart, valueStart + value.length);
                expandedValue = replace(expandedValue, "deprecated", resolveDeprecatedBangAngle);
                expandedValue = replace(expandedValue, "named", (match, paramName) => {
                    if (fixedArgs.has(paramName)) {
                        return substituteParamValue(fixedArgs.get(paramName) ?? "");
                    }
                    return match;
                });
                expandedValue = replace(expandedValue, "variadic", (match, expr) => {
                    if (this.isMacroExpansionLoopActive()) {
                        return match;
                    }
                    return variadicValue(expr);
                });
                expandedValue = replace(expandedValue, "count", () => variadicCount.toString());
                const headerOrigins = sliceSourceFragment(line, 0, valueStart).segments.flatMap((part) => part.origins);
                return {
                    segments: [
                        ...sourceFragment(`!${varName} ${operator} `, headerOrigins).segments,
                        ...expandedValue.segments,
                    ],
                };
            }
        }
        if (lineText.match(/^\s*[#?][\w+.-]+:/) || lineText.match(/^\s*[#?][\w+.-]+\s*=/)) {
            return line;
        }
        let expanded = line;
        expanded = replace(expanded, "deprecated", resolveDeprecatedBangAngle);
        expanded = replace(expanded, "named", (match, paramName) => {
            if (fixedArgs.has(paramName)) {
                return substituteParamValue(fixedArgs.get(paramName) ?? "");
            }
            return match;
        });
        if (this.host.syntaxProfile.macroParameterPrefix === "\\") {
            expanded = replace(expanded, "backslash", (match, paramName) => {
                if (fixedArgs.has(paramName)) {
                    return substituteParamValue(fixedArgs.get(paramName) ?? "");
                }
                return match;
            });
        }
        const currentCond = this.isMacroExpansionActive();
        if (!currentCond) {
            return expanded;
        }
        expanded = replace(expanded, "variadic", (match, expr) => {
            if (this.isMacroExpansionLoopActive()) {
                return match;
            }
            return variadicValue(expr);
        });
        expanded = replace(expanded, "count", () => variadicCount.toString());
        return expanded;
    }
    /** One numeric/index contract for eager expansion and loop-time rebinding. */
    /** Return the selected index with its value so provenance never requires evaluating an index twice. */
    resolveVariadicBinding(expr, args) {
        const processedExpr = fragmentText(bindSourceFragment(sourceFragment(expr), Array.from(expr.matchAll(/!(\w+)/g), (match) => ({
            start: match.index,
            end: match.index + match[0].length,
            value: sourceFragment(this.host.defines.get(match[1]) ?? match[0]),
        }))));
        const resolvedExpr = this.host.resolvedefines(processedExpr);
        const value = this.host.mathCore.math(resolvedExpr);
        if (Number.isNaN(value)) {
            throw new Error(`Invalid variadic index expression: ${expr} (resolved to ${resolvedExpr})`);
        }
        const index = Math.floor(value);
        if (index < 0 || index >= args.length) {
            throw new Error(`Variadic index ${index} out of range (0..${args.length - 1}).`);
        }
        return { index, value: args[index] };
    }
    /** Public string adapter for the ordered fragment binder. */
    resolveVariadicPlaceholders(command) {
        return fragmentText(this.resolveVariadicFragment(sourceFragment(command)));
    }
    /** Loop iterations bind count before indexes, after the loop variable/define state is refreshed. */
    resolveVariadicFragment(fragment, argumentsOrigin = []) {
        const text = fragmentText(fragment);
        if (!text.includes("...") && !text.includes("…")) {
            return fragment;
        }
        const args = this.host.currentVariadicArgs;
        fragment = bindMacroFragment(undefined, fragment, "count", () => sourceFragment(String(args.length)));
        return bindMacroFragment(undefined, fragment, "variadic", (part) => {
            const binding = this.resolveVariadicBinding(part.payload, args);
            const argument = argumentsOrigin.filter((origin) => origin.parameter === undefined)[binding.index];
            return sourceFragment(binding.value, argument ? [argument.location] : []);
        });
    }
    /**
     * Processes a macro line.
     * @param {string} line The line to process.
     */
    processMacroLine(line, template) {
        this.processMacroFragment(sourceFragment(line, template ? [occurrence(template.source)] : []), template);
    }
    /** Dispatch attributed fragments, never an anonymous command string, after active-branch selection. */
    processMacroFragment(fragment, template) {
        const line = fragmentText(fragment);
        const dispatch = (text) => {
            const start = line.indexOf(text);
            const selected = start >= 0
                ? sliceSourceFragment(fragment, start, start + text.length)
                : sourceFragment(text, fragment.segments.flatMap((part) => part.origins));
            this.host.processSourceFragment(selected, true, template);
        };
        incrementInternalCounter("macroLinesProcessed");
        const preprocessedLine = removeInlineComment(line);
        const trimmed = preprocessedLine.trim();
        const commandLine = preprocessedLine === line.trim() ? line : preprocessedLine;
        let keyword = trimmed.toLowerCase();
        const keywordEnd = keyword.search(/\s/);
        if (keywordEnd >= 0) {
            keyword = keyword.slice(0, keywordEnd);
        }
        const isControlDirective = keyword === "if" ||
            keyword === "elseif" ||
            keyword === "else" ||
            keyword === "endif" ||
            keyword === "while" ||
            keyword === "endwhile" ||
            keyword === "for" ||
            keyword === "endfor";
        if (!this.isMacroExpansionActive() && !isControlDirective) {
            return;
        }
        if (/^[#?][\w+.-]+:/.test(trimmed)) {
            if (trimmed.startsWith("?+:") || trimmed.startsWith("?-:")) {
                const labelChar = trimmed;
                const remainder = trimmed.substring(3).trim();
                this.host.symbolScope.handleRelativeLabel(labelChar);
                if (remainder) {
                    dispatch(remainder);
                    this.updateMacroExpansionControlState(remainder);
                }
                return;
            }
            const match = trimmed.match(/^([#?][\w+.-]+):/);
            if (match) {
                const labelName = match[1];
                const remainder = trimmed.substring(match[0].length).trim();
                this.host.symbolScope.setLabel(labelName, undefined, false, true);
                if (remainder) {
                    dispatch(remainder);
                    this.updateMacroExpansionControlState(remainder);
                }
                return;
            }
        }
        if (/^\?[\w+.-]+ *=/.test(trimmed)) {
            const match = trimmed.match(/^(\?[\w+.-]+) *=\s*(.*)/);
            if (match) {
                const labelName = match[1];
                const expression = match[2].trim();
                const value = this.host.mathCore.math(expression);
                this.host.symbolScope.setLabel(labelName, value, true, true);
                return;
            }
        }
        // Define assignments inside a macro `if` must take effect before the next
        // expanded `if !TEMP1 == !TRUE`. processCommand would buffer them in the
        // incremental if-tree until endif. Do not eager-apply inside while/for -
        // v140features uses `while`...`endif` in macros and those `#=` updates must
        // stay in the loop body.
        const isDefineAssignment = /^!\w+\s*(?:#=|\+=|:=|\?=|=(?!=))/.test(trimmed);
        if (isDefineAssignment && !this.isMacroExpansionLoopActive()) {
            this.host.applyDefineAssignment(commandLine);
        }
        else {
            dispatch(commandLine);
        }
        this.updateMacroExpansionControlState(trimmed);
    }
}
//# sourceMappingURL=macro-engine.js.map