import { setCommandKind, type NormalizedCommand } from "../ir/normalized-command.js";

export type DefineHost = {
  defines: Map<string, string>;
  resolvedefines(input: string): string;
  evaluateMath(input: string): number;
  processNestedCommand(command: string): void;
};

export class DefineEngine {
  constructor(private readonly host: DefineHost) {}

  handleCommand(commandNode: NormalizedCommand): boolean {
    const command = commandNode.command;
    if (!command.trim().startsWith("!")) {
      return false;
    }

    if (command.includes("=")) {
      this.handleDefineCommand(command);
      setCommandKind(commandNode, "defineCommand");
      return true;
    }

    const trimmedCommand = command.trim();
    if (trimmedCommand.startsWith("!{")) {
      const processedCommand = this.processValueWithBracedDefines(trimmedCommand);
      this.host.processNestedCommand(processedCommand);
      setCommandKind(commandNode, "defineCommand");
      return true;
    }

    const defineName = trimmedCommand.substring(1);
    if (!this.host.defines.has(defineName)) {
      throw new Error(`Error: Define '${defineName}' not found.`);
    }

    this.host.processNestedCommand(this.host.defines.get(defineName) ?? "");
    setCommandKind(commandNode, "defineCommand");
    return true;
  }

  handleDefineCommand(command: string): void {
    const line = command.substring(1).trim();

    if (line.startsWith("{")) {
      let braceLevel = 1;
      let closingBraceIndex = 1;

      while (braceLevel > 0 && closingBraceIndex < line.length) {
        if (line[closingBraceIndex] === "{") braceLevel++;
        if (line[closingBraceIndex] === "}") braceLevel--;
        closingBraceIndex++;
      }

      if (braceLevel !== 0) {
        throw new Error(`Mismatched braces in define: ${command}`);
      }

      const nestedContent = line.substring(1, closingBraceIndex - 1);
      const resolvedIdentifier = this.processNestedDefines(nestedContent);
      const restOfLine = line.substring(closingBraceIndex).trim();
      const operatorMatch = restOfLine.match(/^\s*(=|\+=|:=|#=|\?=)\s*(.*)$/);

      if (!operatorMatch) {
        throw new Error(`Invalid define syntax after braces: ${command}`);
      }

      this.applyDefineOperation(resolvedIdentifier, operatorMatch[1], operatorMatch[2].trim());
      return;
    }

    const match = line.match(/^(\w+)\s*(=|\+=|:=|#=|\?=)\s*(.*)$/);
    if (!match) {
      throw new Error(`Invalid define syntax: ${command}`);
    }

    this.applyDefineOperation(match[1], match[2], match[3].trim());
  }

  processNestedDefines(content: string): string {
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

  resolveOneLevelOfDefines(content: string): string {
    const openBracePositions = [];
    for (let i = 0; i < content.length - 1; i++) {
      if (content.substring(i, i + 2) === "!{") {
        openBracePositions.push(i);
        i++;
      }
    }

    if (openBracePositions.length === 0) {
      return this.resolveRegularDefines(content);
    }

    const lastOpenBracePos = openBracePositions[openBracePositions.length - 1];
    let nestLevel = 1;
    let closingBracePos = -1;

    for (let i = lastOpenBracePos + 2; i < content.length; i++) {
      if (i < content.length - 1 && content.substring(i, i + 2) === "!{") {
        nestLevel++;
        i++;
      } else if (content[i] === "}") {
        nestLevel--;
        if (nestLevel === 0) {
          closingBracePos = i;
          break;
        }
      }
    }

    if (closingBracePos === -1) {
      throw new Error(`Mismatched braces in content: ${content}`);
    }

    const braceContent = content.substring(lastOpenBracePos + 2, closingBracePos);
    if (braceContent.includes("!{")) {
      const resolvedInnerContent = this.resolveOneLevelOfDefines(braceContent);
      return content.substring(0, lastOpenBracePos + 2) + resolvedInnerContent + content.substring(closingBracePos);
    }

    const replacement = this.host.defines.has(braceContent) ? this.host.defines.get(braceContent) ?? braceContent : braceContent;
    return content.substring(0, lastOpenBracePos) + replacement + content.substring(closingBracePos + 1);
  }

  resolveRegularDefines(content: string): string {
    let result = "";
    let index = 0;
    let foundDefine = false;

    while (index < content.length) {
      if (content.substring(index).startsWith("!") && index + 1 < content.length && /\w/.test(content[index + 1])) {
        index++;
        let defineName = "";

        while (index < content.length && /\w/.test(content[index])) {
          defineName += content[index++];
        }

        if (this.host.defines.has(defineName)) {
          result += this.host.defines.get(defineName);
          foundDefine = true;
        } else {
          throw new Error(`Define '${defineName}' not found.`);
        }
      } else {
        result += content[index++];
      }
    }

    return foundDefine ? result : content;
  }

  resolveDefinesInStringLiteral(content: string): string {
    let result = "";
    let index = 0;

    while (index < content.length) {
      const char = content[index];

      if (char === "\\") {
        const next = content[index + 1];
        if (next === undefined) {
          result += "\\";
          index++;
          continue;
        }
        if (next === "!") {
          result += "!";
          index += 2;
          while (index < content.length && /\w/.test(content[index])) {
            result += content[index];
            index++;
          }
          continue;
        }
        if (next === "\\") {
          result += "\\";
          index += 2;
          continue;
        }
        result += next;
        index += 2;
        continue;
      }

      if (char === "!" && index + 1 < content.length && /\w/.test(content[index + 1])) {
        index++;
        let defineName = "";
        while (index < content.length && /\w/.test(content[index])) {
          defineName += content[index];
          index++;
        }
        if (!this.host.defines.has(defineName)) {
          throw new Error(`Define '${defineName}' not found.`);
        }
        result += this.host.defines.get(defineName);
        continue;
      }

      result += char;
      index++;
    }

    return result;
  }

  processValueWithBracedDefines(value: string): string {
    let result = "";
    let index = 0;

    while (index < value.length) {
      if (value.substring(index).startsWith("!{")) {
        let braceContent = "";
        index += 2;
        let braceLevel = 1;

        while (index < value.length && braceLevel > 0) {
          if (value[index] === "{") braceLevel++;
          else if (value[index] === "}") braceLevel--;

          if (braceLevel === 0) break;
          braceContent += value[index];
          index++;
        }

        if (braceLevel !== 0) {
          throw new Error(`Mismatched braces in value: ${value}`);
        }

        index++;
        const resolvedIdentifier = this.processNestedDefines(braceContent);
        result += `!{${resolvedIdentifier}}`;
      } else {
        result += value[index++];
      }
    }

    return result;
  }

  private applyDefineOperation(identifier: string, operator: string, initialValue: string): void {
    let value = initialValue;

    if (value.includes("!{")) {
      if (!value.includes("FF") && !value.includes("$")) {
        value = this.processNestedDefines(value);
      } else {
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
      const result = this.host.evaluateMath(value);
      if (Number.isNaN(result)) {
        throw new Error(`Math evaluation failed in define "#=" for expression: ${value}`);
      }
      value = result.toString();
    }

    if (operator === "?=" && this.host.defines.has(identifier)) {
      return;
    }

    if (operator === "+=") {
      value = (this.host.defines.get(identifier) || "") + value;
    }

    if (
      operator !== "#=" &&
      (value.includes("+") || value.includes("-") || value.includes("*") || value.includes("/") ||
        value.includes("&") || value.includes("|") || value.includes("^") ||
        value.includes("<<") || value.includes(">>") || value.includes("("))
    ) {
      try {
        const resolvedValue = this.host.resolvedefines(value);
        const result = this.host.evaluateMath(resolvedValue);
        if (!Number.isNaN(result)) {
          value = `$${result.toString(16).toUpperCase()}`;
        }
      } catch {}
    }

    this.host.defines.set(identifier, value);
  }
}
