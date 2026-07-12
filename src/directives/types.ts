import type { OperandResolver } from "../operand-resolver.js";
import type { NormalizedCommand } from "../ir/normalized-command.js";
import type { RomWriterService } from "../services/rom-writer-service.js";
import type { StructEngine } from "../services/struct-engine.js";
import type { SymbolScopeService } from "../services/symbol-scope-service.js";
import type { AssemblerServices } from "../assembler-internals.js";
import { ArchitectureRegistry } from "../architecture-registry.js";
import type { SpcblockData } from "../assembler.js";
import { ExpressionNode } from "../ir/expression-node.js";
import type { AssemblyFileProvider } from "../file-provider.js";

export interface DirectiveAddressCapability {
  recordCurrentAddress(): void;
  setWritePosition(address: number): void;
  currentTargetAddress: number;
  currentTargetBaseAddress: number;
  currentTargetStartAddress: number;
  currentTargetBaseStartAddress: number;
  pushBaseStack: number[];
}

export interface DirectiveExpressionCapability {
  evaluateRangeExpression(expression: string | ExpressionNode): number;
  resolvedefines(input: string): string;
  operandResolver: OperandResolver;
  structEngine: StructEngine;
  symbolScope: SymbolScopeService;
}

export interface DirectiveNamespaceCapability {
  namespaceStack: string[];
  namespaceNestingPath: string[];
  namespaceNestingEnabled: boolean;
  currentNamespace: string;
}

export interface DirectiveIncludeCapability {
  readFile(filename: string): Uint8Array | string;
  fileProvider: AssemblyFileProvider;
  currentFile: string;
  includedFiles: Map<string, { included: boolean; guarded: boolean }>;
  assemblefile(filename: string, isMacro: boolean): void;
  handleInclude(kind: string, filename: string, once: boolean): void;
}

export interface DirectiveTableCapability {
  tableStack: Map<string, number>[];
  characterMappings: Map<string, number>;
  currentTable: string | null;
}

export interface DirectiveRomCapability {
  targetRom: Uint8Array;
  romdata: number[] | Uint8Array;
  defaultFreespaceByte: number;
  activeFreespaceStartPc: number | null;
  activeFreespaceContentStartPc: number | null;
  fillbyte: number[];
  padbyte: number[];
  padUnit: number;
  currentTargetAddress: number;
  currentTargetBaseAddress: number;
  currentTargetStartAddress: number;
  currentTargetBaseStartAddress: number;
  mapper: string;
  checksumFixEnabled: boolean;
  sa1banks: number[];
  romWriter: RomWriterService;
  pushBaseStack: number[];
  expandRom(size: number, fillbyte: number): void;
  handleOrg(args: string[]): void;
  handleDataDirective(keyword: string, args: string[]): void;
  write1(value: number): void;
  write2(value: number): void;
  write3(value: number): void;
  write4(value: number): void;
}

export interface DirectiveSpcCapability {
  inSpcblock: boolean;
  spcInlineCompatMode: boolean;
  spcblockData: SpcblockData | null;
  handleSpcblock(words: string[]): void;
  handleEndSpcblock(words: string[]): void;
}

export interface DirectiveArchitectureCapability {
  architectureRegistry: ArchitectureRegistry;
  arch: string;
}

export interface DirectiveAssemblerCapability {
  services: AssemblerServices;
  defines: Map<string, string>;
  readFunctionsEnabled: boolean;
  bankCrossCheckMode: "off" | "full" | "half";
  optimizeDirectPage: boolean;
  handlePushPC(): void;
  handlePullPC(): void;
}

export interface AssemblySession
  extends DirectiveAddressCapability,
    DirectiveExpressionCapability,
    DirectiveNamespaceCapability,
    DirectiveIncludeCapability,
    DirectiveTableCapability,
    DirectiveRomCapability,
    DirectiveSpcCapability,
    DirectiveArchitectureCapability,
    DirectiveAssemblerCapability {
}

export interface DirectiveContext {
  session: AssemblySession;
  operandResolver: OperandResolver;
}

export type DirectiveHandler = (
  ctx: DirectiveContext,
  words: string[],
  raw: string,
  command?: NormalizedCommand,
) => void;
