import { renderExpressionNode, type ExpressionNode } from "../ir/expression-node.js";
import { setCommandKind, setCommandWords, type NormalizedCommand } from "../ir/normalized-command.js";

export type FrontEndCommandHost = {
  inFunctionDefinition: boolean;
  functionDefinitionLines: string[];
  currentParentLabel: string;
  currentParentIsGlobal: boolean;
  currentGlobalParentLabel: string;
  parseFunctionDefinition(defLine: string): void;
  processCommand(command: string): void;
  handleRelativeLabel(label: string): number;
  handleLabelDefinition(labelName: string): void;
  setLabel(label: string, value?: number, isStatic?: boolean, isMacroLabel?: boolean, isGlobal?: boolean, modifiesHierarchy?: boolean): void;
  resolvedefines(input: string): string;
  evaluateMath(input: string | ExpressionNode): number;
  getLabelValue(label: string, requireStatic: boolean): number;
  recordCurrentAddress(): void;
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
    const isRelativeLabelDefinition = /^\++:?$/.test(keyword) || /^-+:?$/.test(keyword);
    if (!isRelativeLabelDefinition) {
      return false;
    }

    const relativeLabel = keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
    this.host.handleRelativeLabel(relativeLabel);
    this.host.recordCurrentAddress();
    command.labelName = relativeLabel;
    setCommandKind(command, "labelDefinition");
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

    this.host.setLabel(cleanName, undefined, false, false, true, !modifiesHierarchy);

    if (!modifiesHierarchy) {
      this.host.currentParentLabel = cleanName;
      this.host.currentParentIsGlobal = true;
      this.host.currentGlobalParentLabel = cleanName;
    }

    if (payload.length > 1) {
      this.host.processCommand(payload.slice(1).join(" "));
    }

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

    // Preserve current behavior exactly: once the first token qualifies as a label,
    // keep consuming tokens until the command is exhausted.
    while (remainingWords.length > 0 && (keyword.endsWith(":") || keyword.startsWith("."))) {
      const labelName = keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
      this.host.handleLabelDefinition(labelName);
      remainingWords.shift();
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
    if (words.length !== 3 || words[1] !== "=") {
      return false;
    }

    const assignment = command.parsed.assignment;
    const labelName = assignment?.target ?? keyword;
    const expr = assignment ? renderExpressionNode(assignment.expression) : words[2];
    const resolvedExpr = this.host.resolvedefines(expr);
    let value = this.host.evaluateMath(assignment?.expression ?? resolvedExpr);

    if (Number.isNaN(value)) {
      value = this.host.getLabelValue(resolvedExpr, true);
    }

    this.host.setLabel(labelName, value, true);
    this.host.recordCurrentAddress();
    command.assignmentTarget = labelName;
    setCommandKind(command, "staticAssignment");
    return true;
  }
}
