export type FrontEndCommandHost = {
  inFunctionDefinition: boolean;
  functionDefinitionLines: string[];
  currentParentLabel: string;
  currentParentIsGlobal: boolean;
  parseFunctionDefinition(defLine: string): void;
  processNestedCommand(command: string): void;
  handleRelativeLabel(label: string): number;
  handleLabelDefinition(labelName: string): void;
  setLabel(label: string, value?: number, isStatic?: boolean, isMacroLabel?: boolean, isGlobal?: boolean, modifiesHierarchy?: boolean): void;
  resolvedefines(input: string): string;
  evaluateMath(input: string): number;
  getLabelValue(label: string, requireStatic: boolean): number;
  recordCurrentAddress(): void;
};

export class FrontEndCommandService {
  constructor(private readonly host: FrontEndCommandHost) {}

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

  startFunctionDefinition(keyword: string, words: string[]): boolean {
    if (!keyword || !keyword.toLowerCase().startsWith("function")) {
      return false;
    }

    if (keyword.endsWith("\\")) {
      this.host.inFunctionDefinition = true;
      this.host.functionDefinitionLines.push(keyword.slice(0, -1));
    } else {
      this.host.parseFunctionDefinition(words.join(" "));
    }

    return true;
  }

  handleRelativeLabelDefinition(keyword: string): boolean {
    const isRelativeLabelDefinition = /^\++:?$/.test(keyword) || /^-+:?$/.test(keyword);
    if (!isRelativeLabelDefinition) {
      return false;
    }

    const relativeLabel = keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
    this.host.handleRelativeLabel(relativeLabel);
    this.host.recordCurrentAddress();
    return true;
  }

  handleGlobalLabel(words: string[]): boolean {
    if ((words[0] ?? "").toLowerCase() !== "global") {
      return false;
    }

    if (words.length < 2) {
      throw new Error("global requires a label name");
    }

    const labelDecl = words[1];
    const modifiesHierarchy = labelDecl.startsWith("#");
    const labelName = modifiesHierarchy ? labelDecl.substring(1) : labelDecl;
    const hasColon = labelName.endsWith(":");
    const cleanName = hasColon ? labelName.slice(0, -1) : labelName;

    this.host.setLabel(cleanName, undefined, false, false, true, !modifiesHierarchy);

    if (!modifiesHierarchy) {
      this.host.currentParentLabel = cleanName;
      this.host.currentParentIsGlobal = true;
    }

    if (words.length > 2) {
      this.host.processNestedCommand(words.slice(2).join(" "));
    }

    return true;
  }

  consumeNamedLabelDefinitions(words: string[], keyword: string): string[] {
    const remainingWords = [...words];

    // Preserve current behavior exactly: once the first token qualifies as a label,
    // keep consuming tokens until the command is exhausted.
    while (remainingWords.length > 0 && (keyword.endsWith(":") || keyword.startsWith("."))) {
      const labelName = keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
      this.host.handleLabelDefinition(labelName);
      remainingWords.shift();
    }

    return remainingWords;
  }

  handleStaticLabelAssignment(words: string[], keyword: string): boolean {
    if (words.length !== 3 || words[1] !== "=") {
      return false;
    }

    const labelName = keyword;
    const expr = words[2];
    const resolvedExpr = this.host.resolvedefines(expr);
    let value = this.host.evaluateMath(resolvedExpr);

    if (Number.isNaN(value)) {
      value = this.host.getLabelValue(resolvedExpr, true);
    }

    this.host.setLabel(labelName, value, true);
    this.host.recordCurrentAddress();
    return true;
  }
}
