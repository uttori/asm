export type ConditionalEntry = {
  cond: boolean;
};

export type LoopBlock = {
  type: "for" | "while";
  commands: (string | LoopBlock)[];
};

export type PreDispatchPipelineHost = {
  collectingLoop: boolean;
  currentLoop: LoopBlock | null;
  inMacroDefinition: boolean;
  inMacroExpansion: boolean;
  pass: number;
  condStack: ConditionalEntry[];
  moreonlinecond: boolean;
  numtrue: number;
  numif: number;
  handleEndIf(): void;
  handleFor(args: string[]): void;
  handleWhile(args: string[]): void;
  handleEndFor(): void;
  handleEndWhile(): void;
  removeInlineComment(line: string): string;
  splitCommandIntoWords(command: string): string[];
  resolveVariadicPlaceholders(command: string): string;
  resolvedefines(input: string): string;
  loadTestRomData(): void;
};

export class PreDispatchPipelineService {
  private readonly conditionDirectives = new Set(["if", "elseif", "else", "endif", "while", "endwhile", "for", "endfor"]);

  constructor(private readonly host: PreDispatchPipelineHost) {}

  interceptRawCommand(command: string): boolean {
    if (this.host.collectingLoop && this.host.currentLoop?.type === "while" && command.trim().toLowerCase().startsWith("endif")) {
      this.host.handleEndIf();
      return true;
    }

    if (this.host.collectingLoop && !command.match(/^\s*(for|while|endfor|endwhile)/i)) {
      this.host.currentLoop?.commands.push(command);
      return true;
    }

    if (!this.host.inMacroDefinition) {
      if (command.match(/^\s*for\s+/i)) {
        const loopWords = this.host.splitCommandIntoWords(this.host.removeInlineComment(command));
        this.host.handleFor(loopWords.slice(1));
        return true;
      }

      if (command.match(/^\s*while\s+/i)) {
        const loopWords = this.host.splitCommandIntoWords(this.host.removeInlineComment(command));
        this.host.handleWhile(loopWords.slice(1));
        return true;
      }

      if (command.match(/^\s*endfor/i)) {
        this.host.handleEndFor();
        return true;
      }

      if (command.match(/^\s*endwhile/i)) {
        this.host.handleEndWhile();
        return true;
      }
    }

    if (command.trim().startsWith(";`+")) {
      this.host.loadTestRomData();
      return true;
    }

    return false;
  }

  normalizeCommand(command: string): string {
    let normalized = this.host.removeInlineComment(command);

    if (this.host.inMacroExpansion && this.host.pass !== 0 && (normalized.includes("...") || normalized.includes("…"))) {
      const currentCond = this.host.condStack.length === 0 ? true : this.host.condStack.every((entry) => entry.cond);
      if (currentCond) {
        normalized = this.host.resolveVariadicPlaceholders(normalized);
      }
    }

    return normalized;
  }

  shouldSkipForCondition(keyword: string): boolean {
    const currentCond = this.host.condStack.length === 0 ? true : this.host.condStack.every((entry) => entry.cond);
    return !currentCond && !this.conditionDirectives.has(keyword);
  }

  shouldSkipForInlineCondition(keyword: string): boolean {
    return !this.host.moreonlinecond && !["elseif", "else", "endif", "endwhile"].includes(keyword.toLowerCase());
  }

  resolveElseIfWords(keyword: string, command: string, words: string[]): string[] {
    if (keyword.toLowerCase() !== "elseif" || this.host.numtrue + 1 !== this.host.numif) {
      return words;
    }

    const resolved = this.host.resolvedefines(command);
    return resolved.trim().split(/\s+/);
  }
}
