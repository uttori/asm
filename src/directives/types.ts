import type { OperandResolver } from "../operand-resolver.js";
import type { NormalizedCommand } from "../ir/normalized-command.js";
import type { RomWriterService } from "../services/rom-writer-service.js";
import type { StructEngine } from "../services/struct-engine.js";
import type { SymbolScopeService } from "../services/symbol-scope-service.js";
import type { AssemblerServices } from "../assembler-internals.js";
import { ArchitectureRegistry } from "../architecture-registry.js";
import type { SpcblockData } from "../assembler.js";
import { ExpressionNode } from "../ir/expression-node.js";
import type { DirectiveRuntimeService } from "../services/directive-runtime-service.js";
import type { IncludeSourceService } from "../services/include-source-service.js";
import type { TargetProfile } from "../target-profile.js";

export interface DirectiveAddressCapability {
  targetProfile: TargetProfile;
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
  write1(value: number): void;
  write2(value: number): void;
  write3(value: number): void;
  write4(value: number): void;
}

export interface DirectiveSpcCapability {
  inSpcblock: boolean;
  spcInlineCompatMode: boolean;
  spcblockData: SpcblockData | null;
}

export interface DirectiveArchitectureCapability {
  architectureRegistry: ArchitectureRegistry;
  arch: string;
  targetProfile: TargetProfile;
}

export interface DirectiveAssemblerCapability {
  services: AssemblerServices;
  defines: Map<string, string>;
  readFunctionsEnabled: boolean;
  bankCrossCheckMode: "off" | "full" | "half";
  optimizeDirectPage: boolean;
}

export interface SessionDirectiveContext<Session> {
  session: Session;
}

export interface OperandDirectiveContext<Session> extends SessionDirectiveContext<Session> {
  operandResolver: OperandResolver;
}

export interface RuntimeDirectiveContext {
  runtime: DirectiveRuntimeService;
}

export type NarrowDirectiveHandler<Context> = (
  ctx: Context,
  words: readonly string[],
  raw: string,
  command?: NormalizedCommand,
) => void;

export type TableDirectiveContext = SessionDirectiveContext<DirectiveTableCapability>;

export type NamespaceDirectiveContext = SessionDirectiveContext<
  DirectiveNamespaceCapability & Pick<DirectiveSpcCapability, "inSpcblock">
>;

export type FillPadDirectiveContext = OperandDirectiveContext<
  Pick<
    DirectiveRomCapability,
    "fillbyte" | "padbyte" | "padUnit" | "currentTargetAddress" | "romWriter" | "write1"
  > &
    Pick<DirectiveExpressionCapability, "resolvedefines">
>;

export type FlowControlDirectiveContext = SessionDirectiveContext<
  Pick<DirectiveExpressionCapability, "symbolScope">
>;

export type MapperDirectiveContext = SessionDirectiveContext<
  Pick<DirectiveRomCapability, "mapper" | "checksumFixEnabled" | "sa1banks"> &
    Pick<DirectiveSpcCapability, "inSpcblock">
>;

export type BaseLayoutDirectiveContext = OperandDirectiveContext<
  Pick<
    DirectiveAddressCapability,
    | "currentTargetAddress"
    | "currentTargetBaseAddress"
    | "currentTargetStartAddress"
    | "currentTargetBaseStartAddress"
    | "targetProfile"
  >
>;

export type AddressStackDirectiveContext = SessionDirectiveContext<
  Pick<DirectiveAddressCapability, "currentTargetAddress" | "pushBaseStack">
>;

export type DataDirectiveContext = RuntimeDirectiveContext;
export type SpcDirectiveContext = RuntimeDirectiveContext;

export type OrgDirectiveContext = SessionDirectiveContext<
  Pick<DirectiveSpcCapability, "inSpcblock" | "spcInlineCompatMode">
> &
  RuntimeDirectiveContext;

export type StartposDirectiveContext = OperandDirectiveContext<
  Pick<DirectiveSpcCapability, "inSpcblock" | "spcblockData"> &
    Pick<DirectiveExpressionCapability, "resolvedefines">
>;

export type ArchitectureDirectiveContext = SessionDirectiveContext<
  DirectiveArchitectureCapability &
    Pick<DirectiveSpcCapability, "inSpcblock" | "spcInlineCompatMode">
>;

export type AssemblerPolicyDirectiveContext = SessionDirectiveContext<
  Pick<
    DirectiveAssemblerCapability,
    "readFunctionsEnabled" | "bankCrossCheckMode" | "optimizeDirectPage"
  >
>;

export type IncludeDirectiveContext = OperandDirectiveContext<
  Pick<DirectiveExpressionCapability, "evaluateRangeExpression" | "symbolScope"> &
    Pick<DirectiveAddressCapability, "recordCurrentAddress" | "setWritePosition"> &
    Pick<DirectiveRomCapability, "write1">
> &
  RuntimeDirectiveContext & {
    includeSource: Pick<
      IncludeSourceService,
      "assembleFile" | "guardCurrentFile" | "includeFile" | "readFile"
    >;
  };

export type MemoryDirectiveContext = OperandDirectiveContext<
  Pick<
    DirectiveRomCapability,
    | "targetRom"
    | "romdata"
    | "defaultFreespaceByte"
    | "activeFreespaceStartPc"
    | "activeFreespaceContentStartPc"
    | "currentTargetAddress"
    | "currentTargetBaseAddress"
    | "currentTargetStartAddress"
    | "currentTargetBaseStartAddress"
    | "mapper"
    | "romWriter"
    | "expandRom"
    | "write1"
    | "write3"
  > &
    Pick<DirectiveExpressionCapability, "resolvedefines" | "symbolScope"> &
    Pick<DirectiveSpcCapability, "inSpcblock">
>;

export type StructDirectiveContext = SessionDirectiveContext<
  Pick<DirectiveExpressionCapability, "structEngine">
>;
