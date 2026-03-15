import type { MacroDefinition } from "../assembler.js";
import { setCommandKind, type NormalizedCommand } from "../ir/normalized-command.js";

export type MacroLabelEntry = {
  value: number;
  isStatic: boolean;
  isMacroLabel?: boolean;
  macroInstance?: number;
  modifiesHierarchy?: boolean;
};

export type MacroConditionalEntry = {
  cond: boolean;
};

export interface MacroEngineHost {
  pass: number;
  currentFile: string;
  snespos: number;
  collectingLoop: boolean;
  condStack: MacroConditionalEntry[];
  defines: Map<string, string>;
  labelTable: Map<string, MacroLabelEntry>;
  inMacroDefinition: boolean;
  currentMacroName: string;
  currentMacroParams: string[];
  currentMacroBody: NormalizedCommand[];
  currentVariadicCount: number | undefined;
  currentVariadicArgs: string[];
  macros: Map<string, MacroDefinition>;
  macroLabelInstance: number;
  inMacroExpansion: boolean;
  currentParentLabel: string;
  currentParentIsGlobal: boolean;
  resolvedefines(input: string): string;
  processNestedCommand(command: string): void;
  setLabel(label: string, value?: number, isStatic?: boolean, isMacroLabel?: boolean, isGlobal?: boolean, modifiesHierarchy?: boolean): void;
  handleRelativeLabel(label: string): number;
  getLabelValue(label: string, requireStatic: boolean): number;
  findNextLabel(label: string, currentAddressOverride?: number): number;
  findPreviousLabel(label: string, currentAddressOverride?: number): number;
  evaluateMath(input: string): number;
}

export class MacroEngine {
  constructor(readonly host: MacroEngineHost) {}

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
        if (this.host.pass === 0) {
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
            sourceFile: this.host.currentFile,
          };

          if (this.host.macros.has(macroDef.name)) {
            throw new Error(`Macro '${macroDef.name}' is already defined.`);
          }

          this.host.macros.set(macroDef.name, macroDef);
        }

        this.host.inMacroDefinition = false;
        this.host.currentMacroName = "";
        this.host.currentMacroParams = [];
        this.host.currentMacroBody = [];
        setCommandKind(commandNode, "macroDefinitionOrInvoke");
        return true;
      }

      if (this.host.pass === 0) {
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
      this.host.currentMacroParams = paramsStr ? paramsStr.split(",").map((entry) => entry.trim()) : [];
      this.host.inMacroDefinition = true;
      this.host.currentMacroBody = [];
      setCommandKind(commandNode, "macroDefinitionOrInvoke");
      return true;
    }

    if (keyword.startsWith("%")) {
      const parsedInvocation = commandNode.parsed.macroInvocation;
      const invocation = parsedInvocation
        ? (parsedInvocation.args.length > 0
          ? `${parsedInvocation.name}(${parsedInvocation.args.join(", ")})`
          : parsedInvocation.name)
        : words.join(" ").substring(1);
      this.callMacro(invocation);
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
              (key === `${macroLabelPrefix}+` || key.endsWith("_+") || key === `:pos_${currentMacroInstance}_1`) &&
              info.value > this.host.snespos
            ) {
              if (nextAddr === null || info.value < nextAddr) {
                nextAddr = info.value;
              }
            }
          }

          if (nextAddr === null) {
            nextAddr = this.host.findNextLabel("?+");
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
              (key === `${macroLabelPrefix}-` || key.endsWith("_-") || key === `:neg_${currentMacroInstance}_1`) &&
              info.value < this.host.snespos
            ) {
              if (prevAddr === null || info.value > prevAddr) {
                prevAddr = info.value;
              }
            }
          }

          if (prevAddr === null) {
            prevAddr = this.host.findPreviousLabel("?-");
          }

          modifiedCommand = modifiedCommand.replace(/\?-/g, `$${prevAddr.toString(16)}`);
        }
      }
    }

    if (modifiedCommand.includes("?")) {
      modifiedCommand = modifiedCommand.replace(/(?<!\w)(\?[\w+.\-]+_[\w+.\-]+)(?!:)/g, (match: string, labelRef: string) => {
        if (modifiedCommand.trim().startsWith(match) && (modifiedCommand.includes(":") || modifiedCommand.includes("="))) {
          return match;
        }

        try {
          const labelValue = this.host.getLabelValue(labelRef, false);
          return `$${labelValue.toString(16)}`;
        } catch (error) {
          if (this.host.pass === 0) {
            return "$0000";
          }
          throw error;
        }
      });

      modifiedCommand = modifiedCommand.replace(/(?<!\w)(\?[\w+.\-]+)(?!:)/g, (match: string, labelRef: string) => {
        if (modifiedCommand.trim().startsWith(match) && (modifiedCommand.includes(":") || modifiedCommand.includes("="))) {
          return match;
        }

        try {
          const labelValue = this.host.getLabelValue(labelRef, false);
          return `$${labelValue.toString(16)}`;
        } catch (error) {
          if (this.host.pass === 0) {
            return "$0000";
          }
          throw error;
        }
      });
    }

    return modifiedCommand;
  }

  /**
   * Calls a macro.
   * @param {string} invocation The invocation to call.
   */
  callMacro(invocation: string): void {
    this.host.macroLabelInstance++;

    const previousMacroExpansionState = this.host.inMacroExpansion;
    const previousVariadicCount = this.host.currentVariadicCount;
    const previousVariadicArgs = this.host.currentVariadicArgs;
    const previousMacroName = this.host.currentMacroName;
    const previousParentLabel = this.host.currentParentLabel;
    const previousParentIsGlobal = this.host.currentParentIsGlobal;

    this.host.inMacroExpansion = true;

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
        const expandedLine = this.expandMacroLine(lineNode.command, fixedArgs, variadicArgs, variadicCount);
        this.processMacroLine(expandedLine);
      }
    } finally {
      this.host.currentMacroName = previousMacroName;
      this.host.currentParentLabel = previousParentLabel;
      this.host.currentParentIsGlobal = previousParentIsGlobal;
      this.host.currentVariadicCount = previousVariadicCount;
      this.host.currentVariadicArgs = previousVariadicArgs;
      this.host.inMacroExpansion = previousMacroExpansionState;
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
  expandMacroLine(line: string, fixedArgs: Map<string, string>, variadicArgs: string[], variadicCount: number): string {
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
            return this.host.resolvedefines(fixedArgs.get(paramName) ?? "");
          }
          return match;
        });
        expandedValue = expandedValue.replace(/<(?:\.{3}|…)\[([^\]]+)]>/g, (match: string, expr: string) => {
          if (this.host.collectingLoop) {
            return match;
          }

          const processedExpr = expr.replace(/!(\w+)/g, (defMatch: string, defName: string) => {
            if (this.host.defines.has(defName)) {
              return this.host.defines.get(defName) ?? defMatch;
            }
            return defMatch;
          });

          const resolvedExpr = this.host.resolvedefines(processedExpr);
          let index = this.host.evaluateMath(resolvedExpr);
          if (Number.isNaN(index)) {
            throw new Error(`Invalid variadic index expression: ${expr} (resolved to ${resolvedExpr})`);
          }

          index = Math.floor(index);
          if (index < 0 || index >= variadicCount) {
            throw new Error(`Variadic index ${index} out of range (0..${variadicCount - 1}).`);
          }

          return variadicArgs[index];
        });
        expandedValue = expandedValue.replace(/sizeof\((?:\.{3}|…)\)/g, variadicCount.toString());

        return `!${varName} ${operator} ${expandedValue}`;
      }
    }

    if (line.match(/^\s*[#?][\w+.\-]+:/) || line.match(/^\s*[#?][\w+.\-]+\s*=/)) {
      return line;
    }

    let expanded = line;
    expanded = expanded.replace(/<!(\w+)>/g, resolveDeprecatedBangAngle);
    expanded = expanded.replace(/<(\w+)>/g, (match: string, paramName: string) => {
      if (fixedArgs.has(paramName)) {
        return this.host.resolvedefines(fixedArgs.get(paramName) ?? "");
      }
      return match;
    });

    const currentCond = this.host.condStack.length === 0 ? true : this.host.condStack.every((entry) => entry.cond);
    if (!currentCond) {
      return expanded;
    }

    expanded = expanded.replace(/<(?:\.{3}|…)\[([^\]]+)]>/g, (match: string, expr: string) => {
      if (this.host.collectingLoop) {
        return match;
      }

      const processedExpr = expr.replace(/!(\w+)/g, (defMatch: string, defName: string) => {
        if (this.host.defines.has(defName)) {
          return this.host.defines.get(defName) ?? defMatch;
        }
        return defMatch;
      });

      const resolvedExpr = this.host.resolvedefines(processedExpr);
      let index = this.host.evaluateMath(resolvedExpr);
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
      let index = this.host.evaluateMath(resolvedExpr);
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
    if (/^\s*[#?][\w+.\-]+:/.test(line)) {
      if (line.trim().startsWith("?+:") || line.trim().startsWith("?-:")) {
        const labelChar = line.trim();
        const remainder = line.trim().substring(3).trim();
        this.host.handleRelativeLabel(labelChar);
        if (remainder) {
          this.host.processNestedCommand(remainder);
        }
        return;
      }

      const match = line.match(/^\s*([#?][\w+.\-]+):/);
      if (match) {
        const labelName = match[1];
        const remainder = line.substring(match[0].length).trim();
        this.host.setLabel(labelName, undefined, false, true);
        if (remainder) {
          this.host.processNestedCommand(remainder);
        }
        return;
      }
    }

    if (/^\s*\?[\w+.\-]+ *=/.test(line)) {
      const match = line.match(/^\s*(\?[\w+.\-]+) *=\s*(.*)/);
      if (match) {
        const labelName = match[1];
        const expression = match[2].trim();
        const value = this.host.evaluateMath(expression);
        this.host.setLabel(labelName, value, true, true);
        return;
      }
    }

    this.host.processNestedCommand(line);
  }
}
