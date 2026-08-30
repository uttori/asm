import type { MathCore } from "../mathcore.js";
import { setCommandKind, type NormalizedCommand } from "../ir/normalized-command.js";
import type { LabelEntry, SymbolScopeService } from "./symbol-scope-service.js";
import { removeInlineComment } from "./command-text-service.js";
import { incrementInternalCounter } from "../internal-instrumentation.js";
import type { SyntaxProfile } from "../syntax-profile.js";

/** Represents a macro definition. */
export type MacroDefinition = {
  /** The name of the macro. */
  name: string;
  /** Fixed parameter names. */
  params: string[];
  /** Whether the macro has a variable number of parameters. */
  variadic: boolean;
  /** Typed commands captured inside the macro body. */
  body: NormalizedCommand[];
  /** The file where this macro was defined. */
  sourceFile?: string;
};

export type MacroExpansionControlEntry = {
  type: "if" | "while" | "for";
  active: boolean;
  branchTaken?: boolean;
};

export interface MacroEngineHost {
  currentFile: string;
  currentTargetAddress: number;
  defines: Map<string, string>;
  labelTable: Map<string, LabelEntry>;
  inMacroDefinition: boolean;
  currentMacroName: string;
  currentMacroParams: string[];
  currentMacroBody: NormalizedCommand[];
  currentVariadicCount: number | undefined;
  currentVariadicArgs: string[];
  mathCore: MathCore;
  macros: Map<string, MacroDefinition>;
  macroLabelInstance: number;
  inMacroExpansion: boolean;
  currentParentLabel: string;
  currentParentIsGlobal: boolean;
  isDefinitionCollectionStage: boolean;
  syntaxProfile: SyntaxProfile;
  symbolScope: SymbolScopeService;
  evaluateExpression(input: string): boolean;
  resolvedefines(input: string): string;
  processCommand(command: string, preprocessed?: boolean): void;
  applyDefineAssignment(command: string): boolean;
  recordSymbolDefinition(
    kind: "macro",
    name: string,
    options?: { value?: number | string; file?: string; line?: number },
  ): void;
}

export class MacroEngine {
  host: MacroEngineHost;
  macroExpansionControlStack: MacroExpansionControlEntry[] = [];
  pendingMacroSourceFile = "";
  pendingMacroSourceLine = 0;

  constructor(host: MacroEngineHost) {
    this.host = host;
  }

  /**
   * Checks whether the current macro expansion line is in an active branch.
   * @returns {boolean} `true` when the current expansion path is active.
   */
  isMacroExpansionActive(): boolean {
    return this.macroExpansionControlStack.every((entry) => entry.active);
  }

  /**
   * Checks whether the current macro expansion line is inside a deferred loop body.
   * @returns {boolean} `true` when loop-body commands should defer placeholder resolution.
   */
  isMacroExpansionLoopActive(): boolean {
    return this.macroExpansionControlStack.some(
      (entry) => entry.active && (entry.type === "for" || entry.type === "while"),
    );
  }

  /**
   * Evaluates a macro control-flow condition using the assembler expression engine.
   * @param {string} expression The expression text to evaluate.
   * @returns {boolean} The boolean result.
   */
  evaluateMacroControlExpression(expression: string): boolean {
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
  updateMacroExpansionControlState(line: string): void {
    const trimmed = removeInlineComment(line).trim();
    if (!trimmed) {
      return;
    }

    const [keyword, ...rest] = trimmed.split(/\s+/);
    const normalizedKeyword = keyword.toLowerCase();
    const current = this.macroExpansionControlStack[this.macroExpansionControlStack.length - 1];
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

  /**
   * Handles a macro definition command.
   * @param {NormalizedCommand} commandNode The command node to handle.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  handleDefinitionCommand(commandNode: NormalizedCommand): boolean {
    const command = commandNode.command;
    const { keyword, words } = commandNode;
    if (this.host.inMacroDefinition) {
      if (command.trim().toLowerCase() === "endmacro") {
        if (this.host.isDefinitionCollectionStage) {
          let variadic = false;
          if (
            this.host.currentMacroParams.length > 0 &&
            (this.host.currentMacroParams[this.host.currentMacroParams.length - 1] === "..." ||
              this.host.currentMacroParams[this.host.currentMacroParams.length - 1] === "…")
          ) {
            variadic = true;
            this.host.currentMacroParams.pop();
          }

          const macroDef: MacroDefinition = {
            name: this.host.currentMacroName,
            params: this.host.currentMacroParams,
            variadic,
            body: this.host.currentMacroBody,
            sourceFile:
              this.pendingMacroSourceFile ||
              this.host.currentMacroBody[0]?.source.file ||
              this.host.currentFile,
          };

          if (this.host.macros.has(macroDef.name)) {
            throw new Error(`Macro '${macroDef.name}' is already defined.`);
          }

          this.host.macros.set(macroDef.name, macroDef);
          this.host.recordSymbolDefinition("macro", macroDef.name, {
            file: this.pendingMacroSourceFile || macroDef.sourceFile || this.host.currentFile,
            line: this.pendingMacroSourceLine,
          });
        }

        this.host.inMacroDefinition = false;
        this.host.currentMacroName = "";
        this.host.currentMacroParams = [];
        this.host.currentMacroBody = [];
        this.pendingMacroSourceFile = "";
        this.pendingMacroSourceLine = 0;
        setCommandKind(commandNode, "macroDefinitionOrInvoke");
        return true;
      }

      if (this.host.isDefinitionCollectionStage) {
        this.host.currentMacroBody.push(commandNode);
      }
      setCommandKind(commandNode, "macroDefinitionOrInvoke");
      return true;
    }

    if (keyword.toLowerCase() === "macro" || command.trim().toLowerCase().startsWith("macro ")) {
      const match = command.trim().match(/^macro\s+(\w+)\((.*)\)$/i);
      if (!match) {
        throw new Error(`Invalid macro header: ${command.trim()}`);
      }

      this.host.currentMacroName = match[1].trim();
      const paramsStr = match[2].trim();
      this.host.currentMacroParams = paramsStr
        ? paramsStr.split(",").map((entry) => entry.trim())
        : [];
      this.host.inMacroDefinition = true;
      this.host.currentMacroBody = [];
      this.pendingMacroSourceFile = commandNode.source.file || this.host.currentFile;
      this.pendingMacroSourceLine = commandNode.source.line;
      setCommandKind(commandNode, "macroDefinitionOrInvoke");
      return true;
    }

    if (keyword.startsWith("%")) {
      const parsedInvocation = commandNode.parsed.macroInvocation;
      let invocation = words.join(" ").substring(1);
      if (parsedInvocation) {
        invocation = parsedInvocation.name;
        if (parsedInvocation.args.length > 0) {
          invocation = `${parsedInvocation.name}(${parsedInvocation.args.join(", ")})`;
        }
      }
      this.callMacro(invocation);
      setCommandKind(commandNode, "macroDefinitionOrInvoke");
      return true;
    }

    if (this.host.syntaxProfile.bareMacroInvocations && this.host.macros.has(keyword)) {
      const argumentText = command.slice(keyword.length).trim();
      this.callMacro(argumentText ? `${keyword}(${argumentText})` : keyword);
      setCommandKind(commandNode, "macroDefinitionOrInvoke");
      return true;
    }

    return false;
  }

  /**
   * Rewrites macro label references.
   * @param {string} command The command to rewrite.
   * @returns {string} The rewritten command.
   */
  rewriteMacroLabelReferences(command: string): string {
    if (!this.host.inMacroExpansion || (!command.includes("?") && !command.includes("#"))) {
      return command;
    }

    let modifiedCommand = command;

    if (modifiedCommand.includes("?+") || modifiedCommand.includes("?-")) {
      if (modifiedCommand.includes("?+")) {
        const currentMacroInstance = this.host.macroLabelInstance;
        const macroLabelPrefix = `:macro_${currentMacroInstance}_`;
        let nextAddr: number | null = null;

        if (!modifiedCommand.trim().startsWith("?+:")) {
          for (const [key, info] of this.host.labelTable.entries()) {
            if (
              key.startsWith(macroLabelPrefix) &&
              (key === `${macroLabelPrefix}+` ||
                key.endsWith("_+") ||
                key === `:pos_${currentMacroInstance}_1`) &&
              info.value > this.host.currentTargetAddress
            ) {
              if (nextAddr === null || info.value < nextAddr) {
                nextAddr = info.value;
              }
            }
          }

          if (nextAddr === null) {
            nextAddr = this.host.symbolScope.findNextLabel("?+");
          }

          modifiedCommand = modifiedCommand.replace(/\?\+/g, `$${nextAddr.toString(16)}`);
        }
      }

      if (modifiedCommand.includes("?-")) {
        const currentMacroInstance = this.host.macroLabelInstance;
        const macroLabelPrefix = `:macro_${currentMacroInstance}_`;
        let prevAddr: number | null = null;

        if (!modifiedCommand.trim().startsWith("?-:")) {
          for (const [key, info] of this.host.labelTable.entries()) {
            if (
              key.startsWith(macroLabelPrefix) &&
              (key === `${macroLabelPrefix}-` ||
                key.endsWith("_-") ||
                key === `:neg_${currentMacroInstance}_1`) &&
              info.value < this.host.currentTargetAddress
            ) {
              if (prevAddr === null || info.value > prevAddr) {
                prevAddr = info.value;
              }
            }
          }

          if (prevAddr === null) {
            prevAddr = this.host.symbolScope.findPreviousLabel("?-");
          }

          modifiedCommand = modifiedCommand.replace(/\?-/g, `$${prevAddr.toString(16)}`);
        }
      }
    }

    if (modifiedCommand.includes("?")) {
      modifiedCommand = modifiedCommand.replace(
        /(?<!\w)(\?[\w+.-]+_[\w+.-]+)(?!:)/g,
        (match: string, labelRef: string) => {
          if (
            modifiedCommand.trim().startsWith(match) &&
            (modifiedCommand.includes(":") || modifiedCommand.includes("="))
          ) {
            return match;
          }

          try {
            const labelValue = this.host.symbolScope.getLabelValue(labelRef, false);
            return `$${labelValue.toString(16)}`;
          } catch (error) {
            if (this.host.isDefinitionCollectionStage) {
              return "$0000";
            }
            throw error;
          }
        },
      );

      modifiedCommand = modifiedCommand.replace(
        /(?<!\w)(\?[\w+.-]+)(?!:)/g,
        (match: string, labelRef: string) => {
          if (
            modifiedCommand.trim().startsWith(match) &&
            (modifiedCommand.includes(":") || modifiedCommand.includes("="))
          ) {
            return match;
          }

          try {
            const labelValue = this.host.symbolScope.getLabelValue(labelRef, false);
            return `$${labelValue.toString(16)}`;
          } catch (error) {
            if (this.host.isDefinitionCollectionStage) {
              return "$0000";
            }
            throw error;
          }
        },
      );
    }

    return modifiedCommand;
  }

  /**
   * Calls a macro.
   * @param {string} invocation The invocation to call.
   */
  callMacro(invocation: string): void {
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
      const invocationRegex = /^(\w+)\((.*)\)$/;
      const match = invocation.match(invocationRegex);

      if (!match) {
        const macroName = invocation.startsWith("%") ? invocation.substring(1) : invocation;
        const macro = this.host.macros.get(macroName);
        if (!macro) {
          throw new Error(`Error: Macro '${macroName}' not defined.`);
        }

        this.host.currentMacroName = macroName;
        if (macro.sourceFile) {
          this.host.currentFile = macro.sourceFile;
        }
        if (macro.params.length > 0) {
          const fixedArgs = new Map<string, string>();
          for (const param of macro.params) {
            fixedArgs.set(param, "");
          }

          this.host.currentVariadicCount = 0;
          this.host.currentVariadicArgs = [];

          for (const lineNode of macro.body) {
            const expandedLine = this.expandMacroLine(lineNode.command, fixedArgs, [], 0);
            this.processMacroLine(expandedLine);
          }
        } else {
          for (const lineNode of macro.body) {
            this.processMacroLine(lineNode.command);
          }
        }

        return;
      }

      const macroName = match[1];
      const args = match[2].trim();
      const macro = this.host.macros.get(macroName);
      if (!macro) {
        throw new Error(`Error: Macro '${macroName}' not defined.`);
      }

      this.host.currentMacroName = macroName;
      if (macro.sourceFile) {
        this.host.currentFile = macro.sourceFile;
      }

      const argValues: string[] = [];
      let currentArg = "";
      let inQuotes = false;
      let escapeNext = false;

      for (let i = 0; i < args.length; i++) {
        const char = args[i];

        if (escapeNext) {
          currentArg += char;
          escapeNext = false;
          continue;
        }

        if (char === "\\") {
          escapeNext = true;
          continue;
        }

        if (char === '"') {
          if (inQuotes && i + 1 < args.length && args[i + 1] === '"') {
            currentArg += '"';
            i++;
            continue;
          }
          inQuotes = !inQuotes;
          continue;
        }

        if (char === "," && !inQuotes) {
          argValues.push(currentArg.trim());
          currentArg = "";
          continue;
        }

        currentArg += char;
      }

      if (currentArg.length > 0) {
        argValues.push(currentArg.trim());
      }

      const fixedArgs = new Map<string, string>();
      for (let i = 0; i < macro.params.length; i++) {
        fixedArgs.set(macro.params[i], i < argValues.length ? argValues[i] : "");
      }

      const variadicArgs: string[] = [];
      let variadicCount = 0;
      if (macro.variadic && argValues.length > macro.params.length) {
        variadicCount = argValues.length - macro.params.length;
        for (let i = macro.params.length; i < argValues.length; i++) {
          variadicArgs.push(argValues[i]);
        }
      }

      this.host.currentVariadicCount = variadicCount;
      this.host.currentVariadicArgs = variadicArgs;

      for (const lineNode of macro.body) {
        const expandedLine = this.expandMacroLine(
          lineNode.command,
          fixedArgs,
          variadicArgs,
          variadicCount,
        );
        this.processMacroLine(expandedLine);
      }
    } finally {
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

  /**
   * Expands a macro line.
   * @param {string} line The line to expand.
   * @param {Map<string, string>} fixedArgs The fixed arguments.
   * @param {string[]} variadicArgs The variadic arguments.
   * @param {number} variadicCount The variadic count.
   * @returns {string} The expanded line.
   */
  expandMacroLine(
    line: string,
    fixedArgs: Map<string, string>,
    variadicArgs: string[],
    variadicCount: number,
  ): string {
    line = line.replace(/!<(\w+)>/g, (match, paramName: string) => {
      if (!fixedArgs.has(paramName)) {
        return match;
      }
      let name = (fixedArgs.get(paramName) ?? "").trim();
      if (name.startsWith("!")) {
        name = name.slice(1);
      }
      return `!${name}`;
    });

    const substituteParamValue = (raw: string): string => {
      const value = raw.trim();
      if (!value.includes("!")) {
        return value;
      }
      return this.host.resolvedefines(value);
    };

    const resolveDeprecatedBangAngle = (match: string, name: string): string => {
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
      return defineValue !== undefined ? defineValue : match;
    };

    if (line.trim().startsWith("!") && line.includes("=")) {
      const defineMatch = line.trim().match(/^!(\w+)\s*(=|\+=|:=|#=|\?=)\s*(.*)$/);
      if (defineMatch) {
        const varName = defineMatch[1];
        const operator = defineMatch[2];
        const value = defineMatch[3];

        let expandedValue = value;
        expandedValue = expandedValue.replace(/<!(\w+)>/g, resolveDeprecatedBangAngle);
        expandedValue = expandedValue.replace(/<(\w+)>/g, (match: string, paramName: string) => {
          if (fixedArgs.has(paramName)) {
            return substituteParamValue(fixedArgs.get(paramName) ?? "");
          }
          return match;
        });
        expandedValue = expandedValue.replace(
          /<(?:\.{3}|…)\[([^\]]+)]>/g,
          (match: string, expr: string) => {
            if (this.isMacroExpansionLoopActive()) {
              return match;
            }

            const processedExpr = expr.replace(/!(\w+)/g, (defMatch: string, defName: string) => {
              if (this.host.defines.has(defName)) {
                return this.host.defines.get(defName) ?? defMatch;
              }
              return defMatch;
            });

            const resolvedExpr = this.host.resolvedefines(processedExpr);
            let index = this.host.mathCore.math(resolvedExpr);
            if (Number.isNaN(index)) {
              throw new Error(
                `Invalid variadic index expression: ${expr} (resolved to ${resolvedExpr})`,
              );
            }

            index = Math.floor(index);
            if (index < 0 || index >= variadicCount) {
              throw new Error(`Variadic index ${index} out of range (0..${variadicCount - 1}).`);
            }

            return variadicArgs[index];
          },
        );
        expandedValue = expandedValue.replace(/sizeof\((?:\.{3}|…)\)/g, variadicCount.toString());

        return `!${varName} ${operator} ${expandedValue}`;
      }
    }

    if (line.match(/^\s*[#?][\w+.-]+:/) || line.match(/^\s*[#?][\w+.-]+\s*=/)) {
      return line;
    }

    let expanded = line;
    expanded = expanded.replace(/<!(\w+)>/g, resolveDeprecatedBangAngle);
    expanded = expanded.replace(/<(\w+)>/g, (match: string, paramName: string) => {
      if (fixedArgs.has(paramName)) {
        return substituteParamValue(fixedArgs.get(paramName) ?? "");
      }
      return match;
    });
    if (this.host.syntaxProfile.macroParameterPrefix === "\\") {
      expanded = expanded.replace(/\\([A-Z_a-z]\w*)/g, (match: string, paramName: string) => {
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

    expanded = expanded.replace(/<(?:\.{3}|…)\[([^\]]+)]>/g, (match: string, expr: string) => {
      if (this.isMacroExpansionLoopActive()) {
        return match;
      }

      const processedExpr = expr.replace(/!(\w+)/g, (defMatch: string, defName: string) => {
        if (this.host.defines.has(defName)) {
          return this.host.defines.get(defName) ?? defMatch;
        }
        return defMatch;
      });

      const resolvedExpr = this.host.resolvedefines(processedExpr);
      let index = this.host.mathCore.math(resolvedExpr);
      if (Number.isNaN(index)) {
        throw new Error(`Invalid variadic index expression: ${expr} (resolved to ${resolvedExpr})`);
      }

      index = Math.floor(index);
      if (index < 0 || index >= variadicCount) {
        throw new Error(`Variadic index ${index} out of range (0..${variadicCount - 1}).`);
      }

      return variadicArgs[index];
    });

    expanded = expanded.replace(/sizeof\((?:\.{3}|…)\)/g, variadicCount.toString());
    return expanded;
  }

  /**
   * Resolves variadic placeholders.
   * @param {string} command The command to resolve.
   * @returns {string} The resolved command.
   */
  resolveVariadicPlaceholders(command: string): string {
    if (!command.includes("...") && !command.includes("…")) {
      return command;
    }

    const variadicCount = this.host.currentVariadicArgs.length;
    let resolved = command.replace(/sizeof\((?:\.{3}|…)\)/g, variadicCount.toString());
    resolved = resolved.replace(/<(?:\.{3}|…)\[([^\]]+)]>/g, (match: string, expr: string) => {
      const processedExpr = expr.replace(/!(\w+)/g, (defMatch: string, defName: string) => {
        const defineValue = this.host.defines.get(defName);
        return defineValue !== undefined ? defineValue : defMatch;
      });

      const resolvedExpr = this.host.resolvedefines(processedExpr);
      let index = this.host.mathCore.math(resolvedExpr);
      if (Number.isNaN(index)) {
        throw new Error(`Invalid variadic index expression: ${expr} (resolved to ${resolvedExpr})`);
      }

      index = Math.floor(index);
      if (index < 0 || index >= variadicCount) {
        throw new Error(`Variadic index ${index} out of range (0..${variadicCount - 1}).`);
      }

      return this.host.currentVariadicArgs[index];
    });

    return resolved;
  }

  /**
   * Processes a macro line.
   * @param {string} line The line to process.
   */
  processMacroLine(line: string): void {
    incrementInternalCounter("macroLinesProcessed");
    const preprocessedLine = removeInlineComment(line);
    const trimmed = preprocessedLine.trim();
    const commandLine = preprocessedLine === line.trim() ? line : preprocessedLine;
    let keyword = trimmed.toLowerCase();
    const keywordEnd = keyword.search(/\s/);
    if (keywordEnd >= 0) {
      keyword = keyword.slice(0, keywordEnd);
    }
    const isControlDirective =
      keyword === "if" ||
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
          this.host.processCommand(remainder, true);
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
          this.host.processCommand(remainder, true);
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
    // v140features uses `while`…`endif` in macros and those `#=` updates must
    // stay in the loop body.
    const isDefineAssignment = /^!\w+\s*(?:#=|\+=|:=|\?=|=(?!=))/.test(trimmed);
    if (isDefineAssignment && !this.isMacroExpansionLoopActive()) {
      this.host.applyDefineAssignment(commandLine);
    } else {
      this.host.processCommand(commandLine, true);
    }
    this.updateMacroExpansionControlState(trimmed);
  }
}
