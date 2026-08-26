import { renderExpressionNode } from "../ir/expression-node.js";
import {
  setCommandKind,
  setCommandWords,
  type NormalizedCommand,
} from "../ir/normalized-command.js";
import type { SourceSpan } from "../source-location.js";
import type { MathCore } from "../mathcore.js";
import type { SymbolScopeService } from "./symbol-scope-service.js";

export type FrontEndCommandHost = {
  inFunctionDefinition: boolean;
  functionDefinitionLines: string[];
  currentParentLabel: string;
  currentParentIsGlobal: boolean;
  currentGlobalParentLabel: string;
  mathCore: MathCore;
  symbolScope: SymbolScopeService;
  parseFunctionDefinition(defLine: string): void;
  processCommand(command: string): void;
  resolvedefines(input: string): string;
  recordCurrentAddress(): void;
  recordSymbolDefinition(
    kind: "label" | "function",
    name: string,
    options?: { span?: SourceSpan; value?: number | string; containerName?: string },
  ): void;
  isNamedLabelToken(token: string): boolean;
};

export class FrontEndCommandService {
  constructor(readonly host: FrontEndCommandHost) {}

  /**
   * Continues a function definition.
   * @param {string} command The command to continue.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  continueFunctionDefinition(command: string): boolean {
    if (!this.host.inFunctionDefinition) {
      return false;
    }

    if (command.trimEnd().endsWith("\\")) {
      this.host.functionDefinitionLines.push(command.trimEnd().slice(0, -1));
    } else {
      this.host.functionDefinitionLines.push(command.trim());
      const fullDefinition = this.host.functionDefinitionLines.join(" ");
      this.host.functionDefinitionLines = [];
      this.host.inFunctionDefinition = false;
      this.host.parseFunctionDefinition(fullDefinition);
    }

    return true;
  }

  /**
   * Starts a function definition.
   * @param {NormalizedCommand} command The command to start.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  startFunctionDefinition(command: NormalizedCommand): boolean {
    const functionSource = command.parsed.labelSplit?.trailing ?? command.command;
    if (!functionSource || !functionSource.toLowerCase().startsWith("function")) {
      return false;
    }

    if (functionSource.trimEnd().endsWith("\\")) {
      this.host.inFunctionDefinition = true;
      this.host.functionDefinitionLines.push(functionSource.trimEnd().slice(0, -1));
    } else {
      this.host.parseFunctionDefinition(functionSource.trim());
    }

    setCommandKind(command, "directive");
    return true;
  }

  /**
   * Handles a relative label definition.
   * @param {NormalizedCommand} command The command to handle.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  handleRelativeLabelDefinition(command: NormalizedCommand): boolean {
    const { keyword } = command;
    const isUnnamedLabelDefinition = keyword === ":";
    const isRelativeLabelDefinition =
      isUnnamedLabelDefinition || /^\++:?$/.test(keyword) || /^-+:?$/.test(keyword);
    if (!isRelativeLabelDefinition) {
      return false;
    }

    let relativeLabel = keyword;
    if (isUnnamedLabelDefinition) {
      relativeLabel = ":";
    } else if (keyword.endsWith(":")) {
      relativeLabel = keyword.slice(0, -1);
    }
    if (isUnnamedLabelDefinition) {
      this.host.symbolScope.handleUnnamedLabel();
    } else {
      this.host.symbolScope.handleRelativeLabel(relativeLabel);
    }
    this.host.recordCurrentAddress();
    this.host.recordSymbolDefinition("label", relativeLabel, {
      span: command.source.tokenSpans[0] ?? command.source.normalizedSpan,
    });
    command.labelName = relativeLabel;
    setCommandKind(command, "labelDefinition");
    if (isUnnamedLabelDefinition && command.words.length > 1) {
      this.host.processCommand(command.words.slice(1).join(" "));
    }
    return true;
  }

  /**
   * Handles a global label definition.
   * @param {NormalizedCommand} command The command to handle.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  handleGlobalLabel(command: NormalizedCommand): boolean {
    const { words } = command;
    const directiveArgs = command.parsed.directiveArgs;
    if ((directiveArgs?.name ?? words[0] ?? "").toLowerCase() !== "global") {
      return false;
    }

    const payload = directiveArgs?.args?.join(",").split(/\s+/).filter(Boolean) ?? words.slice(1);
    if (payload.length < 1) {
      throw new Error("global requires a label name");
    }

    const labelDecl = payload[0];
    const modifiesHierarchy = labelDecl.startsWith("#");
    const labelName = modifiesHierarchy ? labelDecl.substring(1) : labelDecl;
    const hasColon = labelName.endsWith(":");
    const cleanName = hasColon ? labelName.slice(0, -1) : labelName;

    this.host.symbolScope.setLabel(cleanName, undefined, false, false, true, !modifiesHierarchy);

    if (!modifiesHierarchy) {
      this.host.currentParentLabel = cleanName;
      this.host.currentParentIsGlobal = true;
      this.host.currentGlobalParentLabel = cleanName;
    }

    if (payload.length > 1) {
      this.host.processCommand(payload.slice(1).join(" "));
    }

    this.host.recordSymbolDefinition("label", cleanName, {
      span: command.source.tokenSpans[0] ?? command.source.normalizedSpan,
    });
    command.labelName = cleanName;
    setCommandKind(command, "labelDefinition");
    return true;
  }

  /**
   * Consumes named label definitions.
   * @param {NormalizedCommand} command The command to consume.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  consumeNamedLabelDefinitions(command: NormalizedCommand): boolean {
    const remainingWords = [...command.words];
    let keyword = remainingWords[0] ?? command.keyword;
    let consumed = false;
    let consumedCount = 0;

    // Preserve current behavior exactly: once the first token qualifies as a label,
    // keep consuming tokens until the command is exhausted.
    while (remainingWords.length > 0 && this.host.isNamedLabelToken(keyword)) {
      const labelName = keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
      this.host.symbolScope.handleLabelDefinition(labelName);
      this.host.recordSymbolDefinition("label", labelName, {
        span:
          command.source.tokenSpans[consumedCount] ??
          command.source.tokenSpans[0] ??
          command.source.normalizedSpan,
      });
      remainingWords.shift();
      consumedCount++;
      keyword = remainingWords[0] ?? "";
      consumed = true;
    }

    setCommandWords(command, remainingWords);
    if (consumed && remainingWords.length === 0) {
      setCommandKind(command, "labelDefinition");
    }
    return remainingWords.length === 0;
  }

  /**
   * Handles a static label assignment.
   * @param {NormalizedCommand} command The command to handle.
   * @returns {boolean} `true` if the command was handled, `false` otherwise.
   */
  handleStaticLabelAssignment(command: NormalizedCommand): boolean {
    const { words, keyword } = command;
    if (words.length !== 3 || (words[1] !== "=" && words[1] !== ":=")) {
      return false;
    }

    const assignment = command.parsed.assignment;
    const labelName = assignment?.target ?? keyword;
    const expr = assignment ? renderExpressionNode(assignment.expression) : words[2];
    const resolvedExpr = this.host.resolvedefines(expr);
    let value = this.host.mathCore.math(assignment?.expression ?? resolvedExpr);

    if (Number.isNaN(value)) {
      value = this.host.symbolScope.getLabelValue(resolvedExpr, true);
    }

    const assignedName = this.host.symbolScope.qualifySymbolName(labelName);
    this.host.symbolScope.setLabel(assignedName, value, true);
    this.host.recordCurrentAddress();
    this.host.recordSymbolDefinition("label", assignedName, {
      span: command.source.tokenSpans[0] ?? command.source.normalizedSpan,
      value,
    });
    command.assignmentTarget = assignedName;
    setCommandKind(command, "staticAssignment");
    return true;
  }
}
