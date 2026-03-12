import type { OperandResolver } from "../operand-resolver.js";

export interface AssemblySession {
  currentFile: string;
  includedFiles: Map<string, { included: boolean; guarded: boolean }>;
  fillbyte: number[];
  padbyte: number[];
  padUnit: number;
  snespos: number;
  realsnespos: number;
  startpos: number;
  realstartpos: number;
  mapper: string;
  checksumFixEnabled: boolean;
  sa1banks: number[];
  inSpcblock: boolean;
  spcInlineCompatMode: boolean;
  readFunctionsEnabled: boolean;
  bankCrossCheckMode: "off" | "full" | "half";
  optimizeDirectPage: boolean;
  operandResolver: OperandResolver;
  resolvedefines(input: string): string;
  assemblefile(filename: string, isMacro: boolean): void;
  handleInclude(kind: string, filename: string, once: boolean): void;
  handleRelativeLabel(label: string): void;
  handleIf(args: string[]): void;
  handleElseIf(args: string[]): void;
  handleElse(): void;
  handleEndIf(): void;
  handleWhile(args: string[]): void;
  handleEndWhile(): void;
  handleFor(args: string[]): void;
  handleEndFor(): void;
  handleNamespace(args: string[]): void;
  handleUndef(args: string[]): void;
  handlePushNamespace(): void;
  handlePullNamespace(): void;
  handleOrg(args: string[]): void;
  handleDataDirective(keyword: string, args: string[]): void;
  handlePushBase(): void;
  handlePullBase(): void;
  handlePushPC(): void;
  handlePullPC(): void;
  handleArch(words: string[]): void;
  handleSpcblock(words: string[]): void;
  handleEndSpcblock(words: string[]): void;
  handleStartpos(args: string[]): void;
  handlePullTable(): void;
  handlePushTable(): void;
  handleFreespace(keyword: string, args: string[]): void;
  handleFreespaceByte(args: string[]): void;
  handleProt(args: string[]): void;
  snestopc(address: number): number;
  write1(value: number): void;
}

export interface DirectiveContext {
  session: AssemblySession;
  operandResolver: OperandResolver;
}

export type DirectiveHandler = (ctx: DirectiveContext, words: string[], raw: string) => void;
