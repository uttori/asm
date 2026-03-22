/* eslint-disable jsdoc/no-undefined-types */
import fs from "node:fs"
import path from "node:path"
import { Arch65816 } from "./Arch65816.js";
import { ArchSPC700 } from "./ArchSPC700.js"
import { ArchSuperFX } from "./ArchSuperFX.js";
import type { AssemblerServices, CursorAddressFacade } from "./assembler-internals.js";
import type { ArchitectureContext, ExpressionHost, LoweredInstruction, Spc700Context, SuperFXContext } from "./architecture-types.js";
import { shouldEndifCloseInnermostWhile } from "./compatibility/asar-compatibility-profile.js";

import { AddressToLineMapping } from "./addr2line.js";
import type { AssemblerTraceCommandEvent, AssemblerTraceListener, AssemblerTraceWriteEvent } from "./debug-tracing.js";
import type {
  ConditionalBranch,
  ConditionalBranchNode,
  ExecutableNode,
  IncludeNode,
  LoopNode,
  MacroDefinitionNode,
} from "./ir/assembly-tree.js";
import {
  isReferenceExpressionNode,
  parseExpressionNode,
  renderExpressionNode,
  renderReferenceExpressionNode,
  type ExpressionNode,
  type ReferenceExpressionNode,
} from "./ir/expression-node.js";
import { createNormalizedCommand, type NormalizedCommand } from "./ir/normalized-command.js";
import { MathCore } from "./mathcore.js";
import { CRC32 } from "./crc32.js";
import { OperandResolver } from "./operand-resolver.js";
import { createArchitectureRegistry, type ArchitectureDefinition, type ArchitectureRegistry } from "./architecture-registry.js";
import { createDirectiveRegistry, type DirectiveRegistry } from "./directives/registry.js";
import type { AssemblySession } from "./directives/types.js";
import { CommandPipelineService, type CommandPipelineHost } from "./services/command-pipeline-service.js";
import { DefineEngine, type DefineHost } from "./services/define-engine.js";
import { FrontEndCommandService, type FrontEndCommandHost } from "./services/front-end-command-service.js";
import { MacroEngine, type MacroEngineHost } from "./services/macro-engine.js";
import { PreDispatchPipelineService, type PreDispatchPipelineHost } from "./services/pre-dispatch-pipeline-service.js";
import { RomWriterService, type RomWriterHost } from "./services/rom-writer-service.js";
import { StructEngine, type StructHost } from "./services/struct-engine.js";
import { SymbolScopeService, type SymbolScopeHost } from "./services/symbol-scope-service.js";
import {
  getDefineVariable,
  isBareLabelReference,
  preprocessBlockCommands,
  splitCommandIntoWords,
  splitInlineCommands,
  splitRespectingFunctions,
} from "./services/command-text-service.js";

let debug = (..._) => {};
/* c8 ignore next */
// if (process.env.UTTORI_DATA_DEBUG || true) {
try { const { default: d } = await import("debug"); debug = d("Assembler"); } catch {}
// }

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

export type LoopBlock = LoopNode;
type RuntimeConditionalNode = ConditionalBranchNode;
export type RuntimeNode = NormalizedCommand | LoopNode | RuntimeConditionalNode;
export type AssemblyStageName = "collectDefinitions" | "resolveLayout" | "emitProgram";
export type ProgramModel = {
  sourceFile: string;
  startLine: number;
  nodes: RuntimeNode[];
};
export type StageExecutionMode = "layout" | "emit";
export type StageExecutionCapabilities = {
  instructionMode: StageExecutionMode;
  canEmitBytes: boolean;
  canFinalize: boolean;
  enforceResolvedLabels: boolean;
  isDefinitionCollectionStage: boolean;
};
export type StageCursorState = {
  currentTargetAddress: number;
  currentTargetBaseAddress: number;
  currentTargetStartAddress: number;
  currentTargetBaseStartAddress: number;
  bytes: number;
};
export type StageSymbolState = {
  labelTable: Map<string, LabelEntry>;
  forwardLabels: { [depth: number]: { addr: number; macroInstance?: number }[] };
  backwardLabels: { [depth: number]: { addr: number; macroInstance?: number }[] };
  currentParentLabel: string;
  currentParentIsGlobal: boolean;
  currentGlobalParentLabel: string;
  labelParents: Map<string, string | null>;
};
export type StageControlState = {
  condStack: { type: "if" | "while"; cond: boolean; start?: number; expr?: string; branchTaken?: boolean; conditionStr?: string }[];
  namespaceStack: string[];
  currentNamespace: string;
  namespaceNestingEnabled: boolean;
  namespaceNestingPath: string[];
  loopStack: LoopBlock[];
  currentLoop: LoopBlock | null;
  collectingLoop: boolean;
  loopNestingLevel: number;
  inMacroExpansion: boolean;
  macroLabelInstance: number;
};
export type StageWriteState = {
  inSpcblock: boolean;
  spcblockData: SpcblockData | null;
  spcInlineCompatMode: boolean;
  activeFreespaceStartPc: number | null;
  activeFreespaceContentStartPc: number | null;
};
export type StageExecutionState = {
  stage: AssemblyStageName;
  pass: 0 | 1 | 2;
  capabilities: StageExecutionCapabilities;
  cursor: StageCursorState;
  symbols: StageSymbolState;
  control: StageControlState;
  writeState: StageWriteState;
  loweredCommandCache: WeakMap<NormalizedCommand, LoweredCommand>;
};

type LoweredDirective = {
  kind: "directive";
  keyword: string;
  words: string[];
  source: NormalizedCommand["source"];
};

type LoweredCommand = LoweredDirective | LoweredInstruction;
// Source context stack used to associate low-level byte writes with the
// currently executing normalized command, even when directives recurse.
type TraceCommandContext = Pick<AssemblerTraceCommandEvent, "file" | "line" | "raw" | "normalized">;

export type WhileTracker = {
  iswhile: boolean;
  startline: number;
  cond: boolean;
  is_for: boolean;
  for_variable?: string;
  /** Internal representation of the variable to avoid collisions */
  for_internal_variable?: string;
  for_start?: number;
  for_end?: number;
  for_cur?: number;
};

export type LabelEntry = {
  value: number;
  isStatic: boolean;
  isMacroLabel?: boolean;
  /** Tracks which macro instance this label belongs to */
  macroInstance?: number;
  /** Whether this label affects the sublabel hierarchy */
  modifiesHierarchy?: boolean;
};

// Represents a structure definition.
export interface StructDefinition {
  name: string;
  /** The SNES start address for the struct. */
  base: number;
  /** Running offset as member commands are processed. */
  offset: number;
  /** Final size (after alignment, etc.) */
  size: number;
  /** Mapping from member name (without the leading dot) to its offset. */
  labels: Map<string, number>;
  /** Optional alignment (if specified in endstruct). */
  align?: number;
  /** If this struct extends a parent. */
  parent?: string;
  /** For parent structs, the maximum extension size. */
  extensionSize?: number;
}

export type PushPcStackEntry = {
  currentTargetAddress: number;
  currentTargetStartAddress: number;
  currentTargetBaseAddress: number;
  currentTargetBaseStartAddress: number;
}

export type SpcblockType = "nspc" | "custom";

export type SpcblockData = {
  destination: number;
  type: SpcblockType;
  sizeAddress: number;
  executeAddress: number | null;
  namespaceBackup: string;
};

export interface IncludedFileInfo {
  /** Whether the file has been included */
  included: boolean;
  /** Whether the file has been guarded with includeonce */
  guarded: boolean;
}

export class Assembler implements AssemblySession {
  /** The current target address. `snespos` */
  public currentTargetAddress: number = 0;
  /** The current target base address. `realsnespos` */
  public currentTargetBaseAddress: number = 0;
  /** The current target start address. `startpos` */
  public currentTargetStartAddress: number = 0;
  /** The current target base start address. `realstartpos` */
  public currentTargetBaseStartAddress: number = 0;
  public bytes: number = 0;

  public pushBaseStack: number[] = [];

  /** Possible values: lorom, hirom, exlorom, exhirom, sa1rom, sfxrom, bigsa1rom, norom */
  public mapper: string = "lorom";
  /** Disabled after `norom` to match Asar checksum behavior. */
  public checksumFixEnabled: boolean = true;
  /** Header checksum algorithm mode: "asar" (default) or "simple". */
  public checksumMode: "asar" | "simple" = "asar";
  /** Bank crossing policy controlled by `check bankcross ...`. */
  public bankCrossCheckMode: "off" | "full" | "half" = "off";
  /** Read* functions are enabled when patch-style title check is active. */
  public readFunctionsEnabled: boolean = false;
  /** Controls direct-page shortening for 65816 when no explicit length is given. */
  public optimizeDirectPage: boolean = false;
  public sa1banks: number[] = [0 << 20, 1 << 20, -1, -1, 2 << 20, 3 << 20, -1, -1];
  /** Placeholder for ROM */
  public romdata: number[] | Uint8Array = [];
  public defaultFreespaceByte: number = 0x00;
  public activeFreespaceStartPc: number | null = null;
  public activeFreespaceContentStartPc: number | null = null;

  public pass: number = 0;
  public numif: number = 0;
  public numtrue: number = 0;
  public whileStatus: WhileTracker[] = [];
  public condStack: { type: "if" | "while"; cond: boolean; start?: number; expr?: string; branchTaken?: boolean; conditionStr?: string }[] = [];

  public namespaceStack: string[] = [];
  public currentNamespace: string = "";
  public namespaceNestingEnabled: boolean = false;
  public namespaceNestingPath: string[] = [];

  // Current macro tracking
  public inMacroDefinition: boolean = false;
  public currentMacroName: string = "";
  public currentMacroParams: string[] = [];
  public currentMacroBody: NormalizedCommand[] = [];
  public currentVariadicCount: number | undefined = undefined;
  public currentVariadicArgs: string[] = [];

  public macros: Map<string, MacroDefinition> = new Map();

  public mathCore: MathCore;
  public operandResolver: OperandResolver;

  public moreonlinecond: boolean = true;
  public addressToLineMapping: AddressToLineMapping = new AddressToLineMapping();
  public currentFile: string = "";
  public currentLine: number = 0;
  /** Optional sink for structured tracing used by tests and ad-hoc debug scripts. */
  public traceListener: AssemblerTraceListener | null = null;
  /** Active command contexts so nested byte writes inherit the right source line. */
  public traceCommandStack: TraceCommandContext[] = [];

  public defines: Map<string, string> = new Map();

  // Character mapping support
  public characterMappings: Map<string, number> = new Map();
  public currentTable: string | null = null;
  public tableStack: Map<string, number>[] = [];

  public inFunctionDefinition: boolean = false;
  public functionDefinitionLines: string[] = [];

  public arch65816: Arch65816;
  public archSPC700: ArchSPC700;
  public archSuperFX: ArchSuperFX;

  // Add a new property for architecture in the class:
  public arch: string = "65816";

  public pushpcStack: PushPcStackEntry[] = [];
  public pushpcnum: number = 0;

  public labelTable: Map<string, LabelEntry> = new Map();

  /** Track multiple `+` labels */
  public forwardLabels: { [depth: number]: { addr: number; macroInstance?: number }[] } = {};
  /** Track multiple `-` labels */
  public backwardLabels: { [depth: number]: { addr: number; macroInstance?: number }[] } = {};

  public padUnit: number = 1;
  public padbyte: number[] = []

  public structs: Map<string, StructDefinition> = new Map();
  public currentStruct: StructDefinition | null = null;
  public savedPCStack: number[] = [];

  /** Initialize fill pattern */
  public fillbyte: number[] = [0,0,0,0, 0,0,0,0, 0,0,0,0];

  public targetRom: Uint8Array;

  // Add a static property to hold our CRC table.
  public static crcTable: number[] | null = null;

  public includedFiles: Map<string, IncludedFileInfo> = new Map();
  public includeStack: string[] = [];
  public includePaths: string[] = ["./"];

  public commandBuffer: string = "";  // Class-wide buffer for command concatenation

  // Replace the existing loop tracking with a more structured approach
  public loopStack: LoopBlock[] = []; // Stack of active loop blocks being built
  public currentLoop: LoopBlock | null = null; // Reference to the loop block currently being constructed
  public collectingLoop: boolean = false; // Flag to indicate we're collecting loop commands
  public loopNestingLevel: number = 0; // Current nesting level for loops

  public macroLabelInstance: number = 0; // Tracks the current macro instance
  public inMacroExpansion: boolean = false; // Flag to track if we're inside a macro expansion

  public currentParentLabel: string = "";  // Track the most recent parent label
  public currentParentIsGlobal: boolean = false;  // Track if the parent label is global
  public currentGlobalParentLabel: string = "";  // Track the active top-level parent for single-dot labels
  public labelParents: Map<string, string | null> = new Map();  // Track explicit label ancestry without relying on underscores

  public inSpcblock: boolean = false;
  public spcblockData: SpcblockData | null = null;
  public spcInlineCompatMode: boolean = false;
  public requireStaticLabelLookup: boolean = false;
  readonly passProgramCache: Map<string, RuntimeNode[]> = new Map();
  readonly directiveRegistry: DirectiveRegistry;
  readonly architectureRegistry: ArchitectureRegistry;
  readonly cursorAddress: CursorAddressFacade;
  public readonly services: AssemblerServices;
  public readonly stageExecutionStates: Map<AssemblyStageName, StageExecutionState> = new Map();
  activeStageExecutionState: StageExecutionState | null = null;

  get commandPipelineService(): CommandPipelineService {
    return this.services.commandPipelineService;
  }

  get defineEngine(): DefineEngine {
    return this.services.defineEngine;
  }

  get frontEndCommandService(): FrontEndCommandService {
    return this.services.frontEndCommandService;
  }

  get macroEngine(): MacroEngine {
    return this.services.macroEngine;
  }

  get preDispatchPipelineService(): PreDispatchPipelineService {
    return this.services.preDispatchPipelineService;
  }

  get symbolScope(): SymbolScopeService {
    return this.services.symbolScope;
  }

  get romWriter(): RomWriterService {
    return this.services.romWriter;
  }

  get structEngine(): StructEngine {
    return this.services.structEngine;
  }

  // Core assembler wrapper helpers

  get currentAddress(): number {
    return this.currentTargetAddress;
  }

  recordCurrentAddress(): void {
    this.addAddressToLine(this.currentTargetBaseAddress & 0xFFFFFF);
  }

  setWritePosition(address: number): void {
    this.currentTargetAddress = address;
    this.currentTargetBaseAddress = address;
    this.currentTargetStartAddress = address;
    this.currentTargetBaseStartAddress = address;
    if (this.activeStageExecutionState) {
      this.activeStageExecutionState.cursor.currentTargetAddress = address;
      this.activeStageExecutionState.cursor.currentTargetBaseAddress = address;
      this.activeStageExecutionState.cursor.currentTargetStartAddress = address;
      this.activeStageExecutionState.cursor.currentTargetBaseStartAddress = address;
    }
  }

  syncWriteStarts(): void {
    this.currentTargetStartAddress = this.currentTargetAddress;
    this.currentTargetBaseStartAddress = this.currentTargetBaseAddress;
  }

  incrementBytesWritten(num: number): void {
    this.bytes += num;
  }

  /**
   * Installs or clears the structured trace listener.
   * @param {AssemblerTraceListener | null} listener The listener to receive trace events.
   */
  setTraceListener(listener: AssemblerTraceListener | null): void {
    this.traceListener = listener;
  }

  loadTestRomData(): void {
    const testRomSize = 512 * 1024;
    if (!this.targetRom || this.targetRom.length === 0) {
      return;
    }

    for (let i = 0; i < Math.min(testRomSize, this.targetRom.length); i++) {
      this.romdata[i] = this.targetRom[i];
    }
  }

  // Shared adapter infrastructure

  createCursorAddressFacade(): CursorAddressFacade {
    return {
      recordCurrentAddress: () => this.recordCurrentAddress(),
      setWritePosition: (address: number) => this.setWritePosition(address),
      syncWriteStarts: () => this.syncWriteStarts(),
      incrementBytesWritten: (num: number) => this.incrementBytesWritten(num),
    };
  }

  // Pre-dispatch and front-end adapters

  createDefineHost(): DefineHost {
    const defineHost: DefineHost = {
      defines: this.defines,
      resolvedefines: (input: string) => this.resolvedefines(input),
      evaluateMath: (input: string) => this.mathCore.math(input),
      processCommand: (command: string) => this.processCommand(command),
    };

    return defineHost;
  }

  createFrontEndCommandHost(): FrontEndCommandHost {
    return Object.create(null, {
      inFunctionDefinition: {
        get: () => this.inFunctionDefinition,
        set: (value: boolean) => {
          this.inFunctionDefinition = value;
        },
        enumerable: true,
      },
      functionDefinitionLines: {
        get: () => this.functionDefinitionLines,
        set: (value: string[]) => {
          this.functionDefinitionLines = value;
        },
        enumerable: true,
      },
      currentParentLabel: {
        get: () => this.currentParentLabel,
        set: (value: string) => {
          this.currentParentLabel = value;
        },
        enumerable: true,
      },
      currentParentIsGlobal: {
        get: () => this.currentParentIsGlobal,
        set: (value: boolean) => {
          this.currentParentIsGlobal = value;
        },
        enumerable: true,
      },
      currentGlobalParentLabel: {
        get: () => this.currentGlobalParentLabel,
        set: (value: string) => {
          this.currentGlobalParentLabel = value;
        },
        enumerable: true,
      },
      labelParents: { get: () => this.labelParents, enumerable: true },
      parseFunctionDefinition: { value: (defLine: string) => this.parseFunctionDefinition(defLine), enumerable: true },
      processCommand: { value: (command: string) => this.processCommand(command), enumerable: true },
      handleRelativeLabel: { value: (label: string) => this.symbolScope.handleRelativeLabel(label), enumerable: true },
      handleLabelDefinition: { value: (labelName: string) => this.symbolScope.handleLabelDefinition(labelName), enumerable: true },
      setLabel: {
        value: (
          label: string,
          value?: number,
          isStatic?: boolean,
          isMacroLabel?: boolean,
          isGlobal?: boolean,
          modifiesHierarchy?: boolean,
        ) => this.symbolScope.setLabel(label, value, isStatic, isMacroLabel, isGlobal, modifiesHierarchy),
        enumerable: true,
      },
      resolvedefines: { value: (input: string) => this.resolvedefines(input), enumerable: true },
      evaluateMath: { value: (input: string) => this.mathCore.math(input), enumerable: true },
      getLabelValue: {
        value: (label: string, requireStatic: boolean) => this.symbolScope.getLabelValue(label, requireStatic),
        enumerable: true,
      },
      recordCurrentAddress: { value: () => this.cursorAddress.recordCurrentAddress(), enumerable: true },
    }) as FrontEndCommandHost;
  }

  createPreDispatchPipelineHost(): PreDispatchPipelineHost {
    return Object.create(null, {
      collectingLoop: { get: () => this.collectingLoop, enumerable: true },
      currentLoop: { get: () => this.currentLoop, enumerable: true },
      inMacroDefinition: { get: () => this.inMacroDefinition, enumerable: true },
      inMacroExpansion: { get: () => this.inMacroExpansion, enumerable: true },
      pass: { get: () => this.pass, enumerable: true },
      condStack: { get: () => this.condStack, enumerable: true },
      moreonlinecond: { get: () => this.moreonlinecond, enumerable: true },
      numtrue: { get: () => this.numtrue, enumerable: true },
      numif: { get: () => this.numif, enumerable: true },
      handleEndIf: { value: () => this.handleEndIf(), enumerable: true },
      handleFor: { value: (args: string[]) => this.handleFor(args), enumerable: true },
      handleWhile: { value: (args: string[]) => this.handleWhile(args), enumerable: true },
      handleEndFor: { value: () => this.handleEndFor(), enumerable: true },
      handleEndWhile: { value: () => this.handleEndWhile(), enumerable: true },
      splitCommandIntoWords: { value: (command: string) => splitCommandIntoWords(command), enumerable: true },
      resolveVariadicPlaceholders: { value: (command: string) => this.macroEngine.resolveVariadicPlaceholders(command), enumerable: true },
      resolvedefines: { value: (input: string) => this.resolvedefines(input), enumerable: true },
      loadTestRomData: { value: () => this.loadTestRomData(), enumerable: true },
      currentFile: { get: () => this.currentFile, enumerable: true },
      currentLine: { get: () => this.currentLine, enumerable: true },
    }) as PreDispatchPipelineHost;
  }

  createCommandPipelineHost(): CommandPipelineHost {
    return Object.create(null, {
      currentFile: { get: () => this.currentFile, enumerable: true },
      currentLine: { get: () => this.currentLine, enumerable: true },
      splitCommandIntoWords: { value: (command: string) => splitCommandIntoWords(command), enumerable: true },
      handleCharacterMapping: { value: (command: NormalizedCommand) => this.handleCharacterMapping(command), enumerable: true },
      recordCurrentAddress: { value: () => this.cursorAddress.recordCurrentAddress(), enumerable: true },
    }) as CommandPipelineHost;
  }

  // Symbol, macro, and struct adapters

  createStructHost(): StructHost {
    return Object.create(null, {
      currentStruct: {
        get: () => this.currentStruct,
        set: (value: StructDefinition | null) => {
          this.currentStruct = value;
        },
        enumerable: true,
      },
      structs: {
        get: () => this.structs,
        enumerable: true,
      },
      operandResolver: {
        get: () => this.operandResolver,
        enumerable: true,
      },
      write1: {
        value: (value: number) => this.write1(value),
        enumerable: true,
      },
      readFile: {
        value: (filename: string) => this.readFile(filename),
        enumerable: true,
      },
      recordCurrentAddress: {
        value: () => this.cursorAddress.recordCurrentAddress(),
        enumerable: true,
      },
      handlePushPC: {
        value: () => this.handlePushPC(),
        enumerable: true,
      },
      handlePullPC: {
        value: () => this.handlePullPC(),
        enumerable: true,
      },
      getLabelValue: {
        value: (label: string, requireStatic: boolean) => this.symbolScope.getLabelValue(label, requireStatic),
        enumerable: true,
      },
      evaluateRangeExpression: {
        value: (expression: string | ExpressionNode) => this.evaluateRangeExpression(expression),
        enumerable: true,
      },
      enterStructDefinition: {
        value: (base: number) => {
          this.savedPCStack.push(this.currentTargetAddress);
          this.cursorAddress.setWritePosition(base);
        },
        enumerable: true,
      },
      restoreStructDefinition: {
        value: () => {
          if (this.savedPCStack.length === 0) {
            return;
          }
          const previousPosition = this.savedPCStack.pop();
          if (previousPosition !== undefined) {
            this.cursorAddress.setWritePosition(previousPosition);
          }
        },
        enumerable: true,
      },
      setWritePosition: {
        value: (address: number) => this.cursorAddress.setWritePosition(address),
        enumerable: true,
      },
    }) as StructHost;
  }

  createMacroEngineHost(): MacroEngineHost {
    return Object.create(null, {
      pass: { get: () => this.pass, enumerable: true },
      currentFile: { get: () => this.currentFile, enumerable: true },
      currentTargetAddress: { get: () => this.currentTargetAddress, enumerable: true },
      collectingLoop: { get: () => this.collectingLoop, enumerable: true },
      condStack: { get: () => this.condStack, enumerable: true },
      defines: { get: () => this.defines, enumerable: true },
      labelTable: { get: () => this.labelTable, enumerable: true },
      inMacroDefinition: {
        get: () => this.inMacroDefinition,
        set: (value: boolean) => {
          this.inMacroDefinition = value;
        },
        enumerable: true,
      },
      currentMacroName: {
        get: () => this.currentMacroName,
        set: (value: string) => {
          this.currentMacroName = value;
        },
        enumerable: true,
      },
      currentMacroParams: {
        get: () => this.currentMacroParams,
        set: (value: string[]) => {
          this.currentMacroParams = value;
        },
        enumerable: true,
      },
      currentMacroBody: {
        get: () => this.currentMacroBody,
        set: (value: NormalizedCommand[]) => {
          this.currentMacroBody = value;
        },
        enumerable: true,
      },
      currentVariadicCount: {
        get: () => this.currentVariadicCount,
        set: (value: number | undefined) => {
          this.currentVariadicCount = value;
        },
        enumerable: true,
      },
      currentVariadicArgs: {
        get: () => this.currentVariadicArgs,
        set: (value: string[]) => {
          this.currentVariadicArgs = value;
        },
        enumerable: true,
      },
      macros: { get: () => this.macros, enumerable: true },
      macroLabelInstance: {
        get: () => this.macroLabelInstance,
        set: (value: number) => {
          this.macroLabelInstance = value;
        },
        enumerable: true,
      },
      inMacroExpansion: {
        get: () => this.inMacroExpansion,
        set: (value: boolean) => {
          this.inMacroExpansion = value;
        },
        enumerable: true,
      },
      currentParentLabel: {
        get: () => this.currentParentLabel,
        set: (value: string) => {
          this.currentParentLabel = value;
        },
        enumerable: true,
      },
      currentParentIsGlobal: {
        get: () => this.currentParentIsGlobal,
        set: (value: boolean) => {
          this.currentParentIsGlobal = value;
        },
        enumerable: true,
      },
      currentGlobalParentLabel: {
        get: () => this.currentGlobalParentLabel,
        set: (value: string) => {
          this.currentGlobalParentLabel = value;
        },
        enumerable: true,
      },
      labelParents: { get: () => this.labelParents, enumerable: true },
      currentLine: { get: () => this.currentLine, enumerable: true },
      splitCommandIntoWords: { value: (command: string) => splitCommandIntoWords(command), enumerable: true },
      normalizeCommand: { value: (command: string) => this.preDispatchPipelineService.normalizeCommand(command), enumerable: true },
      resolvedefines: { value: (input: string) => this.resolvedefines(input), enumerable: true },
      processCommand: { value: (command: string) => this.processCommand(command), enumerable: true },
      processNestedNormalizedCommand: { value: (command: NormalizedCommand) => this.processNormalizedCommand(command), enumerable: true },
      setLabel: {
        value: (
          label: string,
          value?: number,
          isStatic?: boolean,
          isMacroLabel?: boolean,
          isGlobal?: boolean,
          modifiesHierarchy?: boolean,
        ) => this.symbolScope.setLabel(label, value, isStatic, isMacroLabel, isGlobal, modifiesHierarchy),
        enumerable: true,
      },
      handleRelativeLabel: { value: (label: string) => this.symbolScope.handleRelativeLabel(label), enumerable: true },
      getLabelValue: { value: (label: string, requireStatic: boolean) => this.symbolScope.getLabelValue(label, requireStatic), enumerable: true },
      findNextLabel: { value: (label: string, currentAddressOverride?: number) => this.symbolScope.findNextLabel(label, currentAddressOverride), enumerable: true },
      findPreviousLabel: { value: (label: string, currentAddressOverride?: number) => this.symbolScope.findPreviousLabel(label, currentAddressOverride), enumerable: true },
      evaluateMath: { value: (input: string) => this.mathCore.math(input), enumerable: true },
    }) as MacroEngineHost;
  }

  createSymbolScopeHost(): SymbolScopeHost {
    return Object.create(null, {
      mode: { get: () => this.getActiveStageCapabilities().instructionMode, enumerable: true },
      enforceResolvedLabels: { get: () => this.getActiveStageCapabilities().enforceResolvedLabels, enumerable: true },
      isDefinitionCollectionStage: { get: () => this.getActiveStageCapabilities().isDefinitionCollectionStage, enumerable: true },
      currentTargetAddress: {
        get: () => this.currentTargetAddress,
        set: (value: number) => {
          this.currentTargetAddress = value;
          if (this.activeStageExecutionState) {
            this.activeStageExecutionState.cursor.currentTargetAddress = value;
          }
        },
        enumerable: true,
      },
      currentNamespace: {
        get: () => this.activeStageExecutionState?.control.currentNamespace ?? this.currentNamespace,
        set: (value: string) => {
          this.currentNamespace = value;
          if (this.activeStageExecutionState) {
            this.activeStageExecutionState.control.currentNamespace = value;
          }
        },
        enumerable: true,
      },
      namespaceNestingEnabled: { get: () => this.activeStageExecutionState?.control.namespaceNestingEnabled ?? this.namespaceNestingEnabled, enumerable: true },
      namespaceNestingPath: { get: () => this.activeStageExecutionState?.control.namespaceNestingPath ?? this.namespaceNestingPath, enumerable: true },
      inMacroExpansion: { get: () => this.activeStageExecutionState?.control.inMacroExpansion ?? this.inMacroExpansion, enumerable: true },
      macroLabelInstance: { get: () => this.activeStageExecutionState?.control.macroLabelInstance ?? this.macroLabelInstance, enumerable: true },
      labelTable: { get: () => this.activeStageExecutionState?.symbols.labelTable ?? this.labelTable, enumerable: true },
      forwardLabels: { get: () => this.activeStageExecutionState?.symbols.forwardLabels ?? this.forwardLabels, enumerable: true },
      backwardLabels: { get: () => this.activeStageExecutionState?.symbols.backwardLabels ?? this.backwardLabels, enumerable: true },
      currentParentLabel: {
        get: () => this.activeStageExecutionState?.symbols.currentParentLabel ?? this.currentParentLabel,
        set: (value: string) => {
          this.currentParentLabel = value;
          if (this.activeStageExecutionState) {
            this.activeStageExecutionState.symbols.currentParentLabel = value;
          }
        },
        enumerable: true,
      },
      currentParentIsGlobal: {
        get: () => this.activeStageExecutionState?.symbols.currentParentIsGlobal ?? this.currentParentIsGlobal,
        set: (value: boolean) => {
          this.currentParentIsGlobal = value;
          if (this.activeStageExecutionState) {
            this.activeStageExecutionState.symbols.currentParentIsGlobal = value;
          }
        },
        enumerable: true,
      },
      currentGlobalParentLabel: {
        get: () => this.activeStageExecutionState?.symbols.currentGlobalParentLabel ?? this.currentGlobalParentLabel,
        set: (value: string) => {
          this.currentGlobalParentLabel = value;
          if (this.activeStageExecutionState) {
            this.activeStageExecutionState.symbols.currentGlobalParentLabel = value;
          }
        },
        enumerable: true,
      },
      labelParents: { get: () => this.activeStageExecutionState?.symbols.labelParents ?? this.labelParents, enumerable: true },
      structs: { get: () => this.structs, enumerable: true },
    }) as SymbolScopeHost;
  }

  // Address-space and ROM adapters

  createRomWriterHost(): RomWriterHost {
    return Object.create(null, {
      currentTargetAddress: {
        get: () => this.activeStageExecutionState?.cursor.currentTargetAddress ?? this.currentTargetAddress,
        set: (value: number) => {
          this.currentTargetAddress = value;
          if (this.activeStageExecutionState) {
            this.activeStageExecutionState.cursor.currentTargetAddress = value;
          }
        },
        enumerable: true,
      },
      currentTargetBaseAddress: {
        get: () => this.activeStageExecutionState?.cursor.currentTargetBaseAddress ?? this.currentTargetBaseAddress,
        set: (value: number) => {
          this.currentTargetBaseAddress = value;
          if (this.activeStageExecutionState) {
            this.activeStageExecutionState.cursor.currentTargetBaseAddress = value;
          }
        },
        enumerable: true,
      },
      arch: { get: () => this.resolveActiveArchitecture().name, enumerable: true },
      mode: { get: () => this.getActiveStageCapabilities().instructionMode, enumerable: true },
      canEmitBytes: { get: () => this.getActiveStageCapabilities().canEmitBytes, enumerable: true },
      canFinalize: { get: () => this.getActiveStageCapabilities().canFinalize, enumerable: true },
      mapper: { get: () => this.mapper, enumerable: true },
      sa1banks: { get: () => this.sa1banks, enumerable: true },
      romdata: { get: () => this.romdata, enumerable: true },
      defaultFreespaceByte: { get: () => this.defaultFreespaceByte, enumerable: true },
      bankCrossCheckMode: { get: () => this.bankCrossCheckMode, enumerable: true },
      spcInlineCompatMode: { get: () => this.activeStageExecutionState?.writeState.spcInlineCompatMode ?? this.spcInlineCompatMode, enumerable: true },
      inSpcblock: { get: () => this.activeStageExecutionState?.writeState.inSpcblock ?? this.inSpcblock, enumerable: true },
      activeFreespaceStartPc: { get: () => this.activeStageExecutionState?.writeState.activeFreespaceStartPc ?? this.activeFreespaceStartPc, enumerable: true },
      activeFreespaceContentStartPc: { get: () => this.activeStageExecutionState?.writeState.activeFreespaceContentStartPc ?? this.activeFreespaceContentStartPc, enumerable: true },
      checksumFixEnabled: { get: () => this.checksumFixEnabled, enumerable: true },
      fillRomData: { value: (start: number, value: number, length: number) => this.fillRomData(start, value, length), enumerable: true },
      writeDataBytes: { value: (start: number, value: number, length?: number) => this.writeDataBytes(start, value, length), enumerable: true },
      updateHeaderAndCRC32: { value: () => this.updateHeaderAndCRC32(), enumerable: true },
      handleEndSpcblock: { value: (words: string[]) => this.handleEndSpcblock(words), enumerable: true },
      setWritePosition: { value: (address: number) => this.cursorAddress.setWritePosition(address), enumerable: true },
      syncWriteStarts: { value: () => this.cursorAddress.syncWriteStarts(), enumerable: true },
      incrementBytesWritten: { value: (num: number) => this.cursorAddress.incrementBytesWritten(num), enumerable: true },
      traceWrite: {
        value: (event: Omit<AssemblerTraceWriteEvent, "type">) => {
          // Byte writes happen below the command dispatcher, so recover the
          // most specific source context from the active command stack.
          const source = this.traceCommandStack[this.traceCommandStack.length - 1];
          this.traceListener?.({
            type: "write",
            ...event,
            file: source?.file ?? this.currentFile,
            line: source?.line ?? this.currentLine,
            raw: source?.raw ?? "",
            normalized: source?.normalized ?? "",
          });
        },
        enumerable: true,
      },
    }) as RomWriterHost;
  }

  // Service assembly

  createServices(): AssemblerServices {
    const defineEngine = new DefineEngine(this.createDefineHost());
    const frontEndCommandService = new FrontEndCommandService(this.createFrontEndCommandHost());
    const symbolScope = new SymbolScopeService(this.createSymbolScopeHost());
    const romWriter = new RomWriterService(this.createRomWriterHost());
    const macroEngine = new MacroEngine(this.createMacroEngineHost());
    const preDispatchPipelineService = new PreDispatchPipelineService(this.createPreDispatchPipelineHost());
    const structEngine = new StructEngine(this.createStructHost());
    const commandPipelineService = new CommandPipelineService(
      this.createCommandPipelineHost(),
      frontEndCommandService,
      macroEngine,
      defineEngine,
      structEngine,
      preDispatchPipelineService,
    );

    return {
      commandPipelineService,
      defineEngine,
      frontEndCommandService,
      macroEngine,
      preDispatchPipelineService,
      romWriter,
      structEngine,
      symbolScope,
    };
  }

  constructor(targetRom?: number[] | Uint8Array) {
    this.targetRom = targetRom ? Uint8Array.from(targetRom) : new Uint8Array();
    this.cursorAddress = this.createCursorAddressFacade();
    this.services = this.createServices();
    this.operandResolver = new OperandResolver({
      resolveDefines: (input) => this.resolvedefines(input),
      resolveStructLabel: (input) => this.structEngine.resolveStructLabel(input),
      resolveLabel: (input, requireStatic) => this.symbolScope.getLabelValue(input, requireStatic),
      hasLabel: (input) => this.symbolScope.hasLabelInScope(input),
      evaluateMath: (input) => this.mathCore.math(input),
      shouldDeferExpressionEvaluation: () => !this.getActiveStageCapabilities().enforceResolvedLabels,
      getCurrentAddress: () => this.currentTargetAddress,
      requireStaticLabelLookup: () => this.requireStaticLabelLookup,
    });
    this.arch65816 = new Arch65816(this.create65816Context());
    this.archSPC700 = new ArchSPC700(this.createSPC700Context());
    this.archSuperFX = new ArchSuperFX(this.createSuperFXContext());
    this.architectureRegistry = createArchitectureRegistry(
      this.arch65816,
      this.archSPC700,
      this.archSuperFX,
    );
    this.mathCore = new MathCore();
    this.mathCore.host = this.expressionHost;
    this.directiveRegistry = createDirectiveRegistry(this, this.operandResolver);
  }

  /**
   * Sets ROM header checksum calculation mode.
   * @param {"asar" | "simple"} mode The checksum mode to use.
   */
  setChecksumMode(mode: "asar" | "simple"): void {
    this.checksumMode = mode;
  }

  readLittleEndian(bytes: Uint8Array, pos: number, width: number): number | undefined {
    if (!Number.isInteger(pos) || pos < 0 || pos + width > bytes.length) {
      return undefined;
    }
    let out = 0;
    for (let i = 0; i < width; i++) {
      out |= (bytes[pos + i] ?? 0) << (8 * i);
    }
    return out >>> 0;
  }

  resolveReadablePath(filename: string): string | undefined {
    if (path.isAbsolute(filename)) {
      return fs.existsSync(filename) ? filename : undefined;
    }
    const candidates = [
      path.resolve(path.dirname(this.currentFile || "."), filename),
      path.resolve(process.cwd(), filename),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate));
  }

  resolveExpressionHostLabel(identifier: string): number | string {
    const parsed = parseExpressionNode(identifier.trim());
    if (isReferenceExpressionNode(parsed)) {
      return this.resolveReferenceLabelValue(parsed, this.requireStaticLabelLookup);
    }
    return this.symbolScope.getLabelValue(identifier, this.requireStaticLabelLookup);
  }

  getExpressionObjectSize(identifier: string, baseOnly = false): number {
    if (baseOnly && (identifier === "..." || identifier === "…")) {
      if (this.inMacroExpansion && this.currentVariadicCount !== undefined) {
        return this.currentVariadicCount;
      }
      if (this.inMacroDefinition) {
        return 0;
      }
      return 0;
    }
    return this.getObjectSize(identifier, baseOnly);
  }

  lookupDefineValue(varName: string): string | undefined {
    const defineValue = this.defines.get(varName);
    if (defineValue !== undefined) {
      return defineValue;
    }

    for (let i = this.whileStatus.length - 1; i >= 0; i--) {
      const loop = this.whileStatus[i];
      if (loop.is_for && loop.for_variable === varName) {
        return loop.for_cur.toString();
      }
    }

    return undefined;
  }

  canReadTargetRom(position: number, size: number): number {
    const pos = Math.trunc(position);
    const num = Math.trunc(size);
    const sourceLength = (this.targetRom && this.targetRom.length > 0) ? this.targetRom.length : this.romdata.length;
    return (Number.isInteger(pos) && Number.isInteger(num) && pos >= 0 && num >= 0 && pos + num <= sourceLength) ? 1 : 0;
  }

  readTargetRom(position: number, size: number, defaultValue?: number): number {
    const pos = Math.trunc(position);
    if (!this.readFunctionsEnabled && defaultValue === undefined) {
      throw new Error(`Esnes_address_out_of_bounds: SNES address ${pos.toString(16).toUpperCase().padStart(6, "0")} in read function out of bounds.`);
    }
    const pcPos = this.romWriter.convertTargetAddressToRomOffset(pos);
    const source = (this.targetRom && this.targetRom.length > 0) ? this.targetRom : this.romdata;
    const romBytes = Uint8Array.from(source);
    const value = pcPos < 0 ? undefined : this.readLittleEndian(romBytes, pcPos, size);
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`read${size} out of bounds at ${pos}`);
    }
    return value;
  }

  canReadExpressionFile(filename: string, position: number, size: number): number {
    const pos = Math.trunc(position);
    const resolvedPath = this.resolveReadablePath(filename);
    if (!resolvedPath) {
      return 0;
    }
    const fileSize = fs.statSync(resolvedPath).size;
    return (Number.isInteger(pos) && pos >= 0 && pos + size <= fileSize) ? 1 : 0;
  }

  readExpressionFile(filename: string, position: number, size: number, defaultValue?: number): number {
    const pos = Math.trunc(position);
    const resolvedPath = this.resolveReadablePath(filename);
    if (!resolvedPath) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Could not read file: ${filename}`);
    }
    const fileBytes = fs.readFileSync(resolvedPath);
    const value = this.readLittleEndian(fileBytes, pos, size);
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`readfile${size} out of bounds at ${pos}`);
    }
    return value;
  }

  create65816Context(): ArchitectureContext {
    const context = {
      operandResolver: this.operandResolver,
      write1: (value: number) => this.write1(value),
      write2: (value: number) => this.write2(value),
      write3: (value: number) => this.write3(value),
      emitByte: (value: number) => this.emitByte(value),
      emitWord: (value: number) => this.emitWord(value),
      emitLong: (value: number) => this.emitLong(value),
      findNextLabel: (reference: string, fromAddress: number) => this.symbolScope.findNextLabel(reference, fromAddress),
      findPreviousLabel: (reference: string, fromAddress: number) => this.symbolScope.findPreviousLabel(reference, fromAddress),
    };
    return Object.defineProperties(context, {
      mode: { get: () => this.getActiveStageCapabilities().instructionMode },
      enforceResolvedLabels: { get: () => this.getActiveStageCapabilities().enforceResolvedLabels },
      currentTargetAddress: { get: () => this.currentTargetAddress },
      optimizeDirectPage: { get: () => this.optimizeDirectPage },
    }) as unknown as ArchitectureContext;
  }

  createSPC700Context(): Spc700Context {
    const context = {
      operandResolver: this.operandResolver,
      write1: (value: number) => this.write1(value),
      write2: (value: number) => this.write2(value),
      findNextLabel: (reference: string, fromAddress: number) => this.symbolScope.findNextLabel(reference, fromAddress),
      findPreviousLabel: (reference: string, fromAddress: number) => this.symbolScope.findPreviousLabel(reference, fromAddress),
    };
    return Object.defineProperties(context, {
      mode: { get: () => this.getActiveStageCapabilities().instructionMode },
      enforceResolvedLabels: { get: () => this.getActiveStageCapabilities().enforceResolvedLabels },
      currentTargetAddress: { get: () => this.currentTargetAddress },
    }) as unknown as Spc700Context;
  }

  createSuperFXContext(): SuperFXContext {
    const context = {
      operandResolver: this.operandResolver,
      write1: (value: number) => this.write1(value),
      write2: (value: number) => this.write2(value),
    };
    return Object.defineProperties(context, {
      currentTargetAddress: { get: () => this.currentTargetAddress },
    }) as unknown as SuperFXContext;
  }

  readonly expressionHost: ExpressionHost = {
    resolveLabel: (identifier) => this.resolveExpressionHostLabel(identifier),
    convertSnesToPc: (address) => this.romWriter.convertTargetAddressToRomOffset(address),
    convertPcToSnes: (offset) => this.romWriter.pctosnes(offset),
    getCurrentAddress: () => this.currentTargetAddress,
    getCurrentBaseAddress: () => this.currentTargetBaseAddress,
    isDefined: (identifier) => {
      if (this.defines.has(identifier)) return 1;
      if (this.structs.has(identifier)) return 1;
      return this.symbolScope.hasLabelInScope(identifier) ? 1 : 0;
    },
    getObjectSize: (identifier, baseOnly) => this.getExpressionObjectSize(identifier, baseOnly),
    getFileSize: (filename) => {
      const resolvedPath = this.resolveReadablePath(filename);
      if (!resolvedPath) {
        throw new Error(`Could not get filesize for '${filename}'`);
      }
      return fs.statSync(resolvedPath).size;
    },
    getFileStatus: (filename) => {
      const resolvedPath = this.resolveReadablePath(filename);
      if (!resolvedPath) {
        return 1;
      }
      try {
        fs.accessSync(resolvedPath, fs.constants.R_OK);
        return 0;
      } catch {
        return 2;
      }
    },
    canReadFile: (filename, position, size) => this.canReadExpressionFile(filename, position, size),
    readFile: (filename, position, size, defaultValue) => this.readExpressionFile(filename, position, size, defaultValue),
    canReadRom: (position, size) => this.canReadTargetRom(position, size),
    readRom: (position, size, defaultValue) => this.readTargetRom(position, size, defaultValue),
  };

  /**
   * Advances memory position while handling bank crossing.
   * @param {number} num The number of bytes to advance.
   */
  step(num: number): void {
    this.romWriter.step(num);
  }

  /**
   * Writes a single byte to ROM.
   * @param {number} num - The byte to write.
   */
  write1_65816(num: number): void {
    this.romWriter.write1_65816(num);
  }

  /**
   * Fills a section of ROM data with a value.
   * @param {number} start The starting address.
   * @param {number} value The value to fill with.
   * @param {number} length The length of the section to fill.
   */
  fillRomData(start: number, value: number, length: number): void {
    debug("fillRomData", start, value, length);
    for (let i = 0; i < length; i++) {
      this.romdata[start + i] = value & 0xFF;
    }
  }

  getActiveStageCapabilities(): StageExecutionCapabilities {
    if (this.activeStageExecutionState) {
      return this.activeStageExecutionState.capabilities;
    }
    return {
      instructionMode: this.pass === 0 ? "layout" : "emit",
      canEmitBytes: this.pass >= 2,
      canFinalize: true,
      enforceResolvedLabels: this.pass >= 2,
      isDefinitionCollectionStage: this.pass === 0,
    };
  }

  layoutInstruction(input: string[] | LoweredInstruction): boolean {
    const words = Array.isArray(input) ? input : input.words;
    if (words.length === 0) {
      return true;
    }
    const architecture = this.resolveActiveArchitecture();
    if (!architecture.definition) {
      return true;
    }
    const size = Array.isArray(input)
      ? architecture.definition.encoder.estimateSize(words)
      : (architecture.definition.encoder.estimateInstruction?.(input) ?? architecture.definition.encoder.estimateSize(words));
    this.step(size);
    return true;
  }

  emitInstruction(input: string[] | LoweredInstruction): boolean {
    const words = Array.isArray(input) ? input : input.words;
    if (words.length === 0) {
      return true;
    }
    const architecture = this.resolveActiveArchitecture();
    if (!architecture.definition) {
      return true;
    }
    const encoded = Array.isArray(input)
      ? architecture.definition.encoder.encode(words)
      : (architecture.definition.encoder.encodeInstruction?.(input) ?? architecture.definition.encoder.encode(words));
    if (!encoded) {
      if (architecture.name === "superfx") {
        return false;
      }
      throw new Error(`Unknown instruction: ${words[0]}`);
    }
    return true;
  }

  /**
   * Picks the appropriate instruction handler based on architecture.
   * @param {string[] | LoweredInstruction} input The instruction to pick.
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  asblock_pick(input: string[] | LoweredInstruction): boolean {
    debug("asblock_pick", Array.isArray(input) ? input : input.words);
    debug("asblock_pick arch", this.arch);
    let instructionExecutionMode = this.pass === 0 ? "layout" : "emit"
    if (this.activeStageExecutionState) {
      instructionExecutionMode = this.activeStageExecutionState.capabilities.instructionMode;
    }
    if (instructionExecutionMode === "layout") {
      return this.layoutInstruction(input);
    }
    return this.emitInstruction(input);
  }

  resolveActiveArchitecture(): { name: string; definition?: ArchitectureDefinition } {
    if (this.inSpcblock || this.arch === "spc700") {
      return {
        name: "spc700",
        definition: this.architectureRegistry.getDefinition("spc700"),
      };
    }
    const normalized = this.arch.toLowerCase();
    const canonical = this.architectureRegistry.getCanonicalName(normalized);
    const name = canonical ?? normalized;
    return {
      name,
      definition: this.architectureRegistry.getDefinition(name),
    };
  }

  classifyOperandForActiveArchitecture(operand: string) {
    const architecture = this.resolveActiveArchitecture();
    if (!architecture.definition) {
      return this.operandResolver.lowerOperand(operand);
    }
    return architecture.definition.classifyOperand(this.operandResolver, operand);
  }

  /**
   * Writes 1, 2, 3, or 4 bytes to ROM.
   * @param {number} num - The byte to write.
   */
  write1(num: number): void {
    this.romWriter.write1(num);
  }

  emitByte(num: number): void {
    this.write1(num);
  }

  write2(num: number): void {
    this.romWriter.write2(num);
  }

  emitWord(num: number): void {
    this.write2(num);
  }

  write3(num: number): void {
    this.romWriter.write3(num);
  }

  emitLong(num: number): void {
    this.write3(num);
  }

  write4(num: number): void {
    this.romWriter.write4(num);
  }

  /**
   * Reads 1, 2, or 3 bytes from ROM.
   * @param {number} insnespos - The SNES address to read from.
   * @returns {number} The byte read from ROM.
   */
  read1(insnespos: number): number {
    const addr = this.romWriter.convertTargetAddressToRomOffset(insnespos);
    if (addr < 0 || addr + 1 > this.romdata.length) {
      return -1;
    }
    return this.romdata[addr];
  }

  read2(insnespos: number): number {
    const addr = this.romWriter.convertTargetAddressToRomOffset(insnespos);
    if (addr < 0 || addr + 2 > this.romdata.length) {
      return -1;
    }
    return this.romdata[addr] | (this.romdata[addr + 1] << 8);
  }

  read3(insnespos: number): number {
    const addr = this.romWriter.convertTargetAddressToRomOffset(insnespos);
    if (addr < 0 || addr + 3 > this.romdata.length) {
      return -1;
    }
    return this.romdata[addr] | (this.romdata[addr + 1] << 8) | (this.romdata[addr + 2] << 16);
  }

  assembleblock(block: string): void {
    // debug('assembleblock', block);
    if (!block.trim()) {
      return;
    }

    const processedCommands = this.preprocessBlockCommands(block);
    block = processedCommands.join("\n");

    const words = block.trim().split(/\s+/);
    if (words.length === 0) {
      debug("assembler assembleblock no words", { words });
      return;
    }

    const splitCommands = splitInlineCommands(processedCommands);
    if (block.includes("\n")) {
      const nodes = this.getOrBuildPassProgram(splitCommands, this.currentFile, this.currentLine);
      this.executeNodeStream(nodes);
      return;
    }

    for (const command of splitCommands) {
      this.processCommand(command.trim());
    }
  }

  preprocessBlockCommands(block: string): string[] {
    const processed = preprocessBlockCommands(block, this.commandBuffer);
    this.commandBuffer = processed.commandBuffer;
    return processed.commands;
  }

  /**
   * Processes a single command from `assembleblock`.
   * @param {string} command - The command to process.
   */
  processCommand(command: string): void {
    debug("processCommand", { command }, this.currentTargetAddress, "/", this.currentTargetAddress.toString(16), `pass ${this.pass}`);
    if (command.trim() === "") {
      return;
    }

    command = this.commandPipelineService.rewriteRawCommand(command);

    if (this.commandPipelineService.interceptRawCommand(command)) {
      return;
    }

    const state = this.commandPipelineService.create(command);
    if (!state) {
      return;
    }

    this.processNormalizedCommand(state, false);
  }

  processNormalizedCommand(state: NormalizedCommand, rewriteRaw: boolean = true): void {
    // Treat incoming commands as immutable execution inputs. Downstream pipeline
    // stages still mutate `kind/words`, so run them against a per-dispatch clone
    // instead of mutating cached pass-program nodes.
    let workingState = createNormalizedCommand(
      state.source.raw,
      state.source.normalized,
      [...state.words],
      state.source.file,
      state.source.line,
    );

    // Preserve legacy fixture bootstrap behavior in tree/normalized execution:
    // `;`+ means "seed assembler ROM with target ROM bytes" before reads/writes.
    if (workingState.source.raw.trim().startsWith(";`+")) {
      this.loadTestRomData();
      return;
    }

    if (workingState.command.trim() === "") {
      return;
    }

    if (rewriteRaw) {
      const rewrittenRaw = this.commandPipelineService.rewriteRawCommand(workingState.source.raw);
      const rewrittenNormalized = this.preDispatchPipelineService.normalizeCommand(rewrittenRaw);
      const rewrittenWords = splitCommandIntoWords(rewrittenNormalized);
      if (rewrittenRaw !== workingState.source.raw || rewrittenNormalized !== workingState.command) {
        workingState = createNormalizedCommand(
          rewrittenRaw,
          rewrittenNormalized,
          rewrittenWords,
          workingState.source.file,
          workingState.source.line,
        );
      }
    }

    const preprocessResult = this.commandPipelineService.preprocess(workingState);
    if (preprocessResult === "skipped_for_condition") {
      debug(`processCommand ❎ Skipping command "${workingState.command}" because condition is false.`);
      return;
    }
    if (preprocessResult === "handled") {
      return;
    }

    // Capture the starting PC (before processing this command)
    const startPC = this.currentTargetBaseAddress & 0xFFFFFF;

    if (!this.commandPipelineService.prepareForDispatch(workingState)) {
      return;
    }

    const traceContext: TraceCommandContext = {
      file: workingState.source.file,
      line: workingState.source.line,
      raw: workingState.source.raw,
      normalized: workingState.command,
    };

    this.traceListener?.({
      type: "command-start",
      pass: this.pass,
      arch: this.arch,
      ...traceContext,
      snesAddress: startPC,
      pcAddress: this.romWriter.convertTargetAddressToRomOffset(startPC),
    });

    // Nested directives can emit additional writes while this command is still
    // active, so keep the current source context on a stack until dispatch ends.
    this.traceCommandStack.push(traceContext);
    try {
      const lowered = this.lowerNodeWithStageCache(workingState);
      this.dispatchLoweredNode(lowered);
    } finally {
      this.traceCommandStack.pop();
    }

    // Determine how many bytes were written in this command.
    const commandSize = (this.currentTargetBaseAddress & 0xFFFFFF) - startPC;
    debug("processCommand bytes written", commandSize)

    const endPC = this.currentTargetBaseAddress & 0xFFFFFF;
    this.traceListener?.({
      type: "command-end",
      pass: this.pass,
      arch: this.arch,
      ...traceContext,
      snesAddress: startPC,
      pcAddress: this.romWriter.convertTargetAddressToRomOffset(startPC),
      endSnesAddress: endPC,
      endPcAddress: this.romWriter.convertTargetAddressToRomOffset(endPC),
      bytesWritten: commandSize,
    });

    this.addAddressToLine(this.currentTargetBaseAddress & 0xFFFFFF);
  }

  lowerNodeWithStageCache(command: NormalizedCommand): LoweredCommand {
    const activeStage = this.activeStageExecutionState;
    if (!activeStage) {
      return this.lowerNode(command);
    }
    const cached = activeStage.loweredCommandCache.get(command);
    if (cached) {
      return cached;
    }
    const lowered = this.lowerNode(command);
    activeStage.loweredCommandCache.set(command, lowered);
    return lowered;
  }

  dispatchLoweredNode(lowered: LoweredCommand): void {
    if (lowered.kind === "directive") {
      const handledDirective = this.directiveRegistry.dispatch(
        lowered.keyword,
        lowered.words,
        lowered.source.raw,
      );
      if (!handledDirective && lowered.keyword) {
        debug("💥 assembler dispatchLoweredNode unknown directive", lowered.keyword);
      }
      return;
    }

    const wasOpcode = this.asblock_pick(lowered);
    if (!wasOpcode) {
      debug("💥 assembler dispatchLoweredNode unknown operation", lowered.mnemonic);
    }
  }

  handleSpcblock(words: string[]): void {
    if (words.length < 2) {
      throw new Error("spcblock requires at least a destination address.");
    }
    if (words.length > 4) {
      throw new Error("spcblock has too many arguments.");
    }
    if (this.inSpcblock) {
      throw new Error("Nested spcblock directives are not supported.");
    }

    const destination = this.operandResolver.getnum(this.resolvedefines(words[1]));
    if ((destination & ~0xFFFF) !== 0) {
      throw new Error(`spcblock destination must be 16-bit, got: ${words[1]}`);
    }

    let type: SpcblockType = "nspc";
    if (words.length === 3) {
      const kind = words[2].toLowerCase();
      if (kind === "nspc") {
        type = "nspc";
      } else if (kind === "custom") {
        throw new Error("Custom spcblock mode requires a macro and is not implemented.");
      } else {
        throw new Error(`Unknown spcblock type: ${words[2]}`);
      }
    } else if (words.length === 4) {
      const kind = words[2].toLowerCase();
      if (kind !== "custom") {
        throw new Error(`Unexpected spcblock argument for type: ${words[2]}`);
      }
      throw new Error("Custom spcblock mode is not implemented.");
    }

    if (type !== "nspc") {
      throw new Error("Custom spcblock mode is not implemented.");
    }

    const sizeAddress = this.currentTargetBaseAddress;
    this.write2(0x0000);
    this.write2(destination);
    this.currentTargetAddress = destination;
    this.currentTargetStartAddress = destination;
    this.spcblockData = {
      destination,
      type,
      sizeAddress,
      executeAddress: null,
      namespaceBackup: this.currentNamespace,
    };

    this.currentNamespace = `:SPCBLOCK:_${this.currentNamespace}`;
    this.inSpcblock = true;
  }

  handleEndSpcblock(words: string[]): void {
    if (!this.inSpcblock || !this.spcblockData) {
      throw new Error("endspcblock used without an active spcblock.");
    }

    if (this.spcblockData.type !== "nspc") {
      throw new Error("Custom spcblock mode is not implemented.");
    }

    if (this.pass === 2) {
      const sizePc = this.romWriter.convertTargetAddressToRomOffset(this.spcblockData.sizeAddress & 0xFFFFFF);
      if (sizePc < 0) {
        throw new Error("spcblock size address does not map to ROM.");
      }
      const blockSize = (this.currentTargetAddress - this.spcblockData.destination) & 0xFFFF;
      this.writeDataBytes(sizePc, blockSize & 0xFF, 1);
      this.writeDataBytes(sizePc + 1, (blockSize >> 8) & 0xFF, 1);
    }

    if (words.length === 3) {
      if (words[1].toLowerCase() !== "execute") {
        throw new Error(`Invalid endspcblock argument: ${words[1]}`);
      }
      this.write2(0x0000);
      this.write2(this.operandResolver.getnum(this.resolvedefines(words[2])) & 0xFFFF);
    } else if (words.length !== 1) {
      throw new Error("Unknown endspcblock format.");
    } else if (this.spcblockData.executeAddress !== null) {
      this.write2(0x0000);
      this.write2(this.spcblockData.executeAddress & 0xFFFF);
    }

    this.currentNamespace = this.spcblockData.namespaceBackup;
    this.spcblockData = null;
    this.inSpcblock = false;
  }

  /**
   * Parses a function definition of the form:
   *   function name(param1, param2...) = expression
   * Possibly spanning multiple lines joined by backslashes.
   * @param {string} defLine - The function definition line.
   */
  parseFunctionDefinition(defLine: string): void {
    debug("parseFunctionDefinition", defLine)
    // Set the string to parse in mathCore
    this.mathCore.str = defLine;
    // Call the parseFunctionDefinition method without arguments
    this.mathCore.parseFunctionDefinition();
  }

  /**
   * Handles `for` loops.
   * @param {string[]} condition - The condition for the loop.
   */
  handleFor(condition: string[]): void {
    if (this.pass === 0) return; // Skip in pass 0

    // Build the original for statement to pass to the new method
    const forStatement = `for ${condition.join(" ")}`;
    this.beginLoopCollection("for", forStatement);
  }

  /**
   * Handles the end of a `for` loop.
   */
  handleEndFor(): void {
    if (this.pass === 0) return; // Skip in pass 0

    this.endLoopCollection("for");
  }

  /**
   * Adds a mapping of the current address to the source line number.
   * @param {number} address The SNES address to add to the mapping.
   */
  addAddressToLine(address: number): void {
    // if (this.pass === 2) {
    this.addressToLineMapping.includeMapping(this.currentFile, this.currentLine + 1, address);
    // }
  }

  /**
   * Handles `if` statements.
   * @param {string[]} condition The condition for the if statement.
   */
  handleIf(condition: string[]): void {
    debug("handleIf", condition)
    const conditionStr = condition.join(" ");
    this.requireStaticLabelLookup = true;
    let conditionResult: boolean;
    try {
      conditionResult = this.evaluateExpression(conditionStr);
    } finally {
      this.requireStaticLabelLookup = false;
    }
    // Push an "if" entry with an additional flag to indicate if this branch was taken
    this.condStack.push({
      type: "if",
      cond: conditionResult,
      branchTaken: conditionResult, // Track if this or any subsequent branch was taken
      conditionStr,
    });
    debug("handleIf added to condStack", this.condStack);
    // Update the global flag (all conditions must be true to run commands).
    this.moreonlinecond = this.condStack.every(entry => entry.cond);
  }

  /**
   * Handles `elseif` statements.
   * @param {string[]} condition The condition for the elseif statement.
   */
  handleElseIf(condition: string[]): void {
    debug("handleElseIf", condition)
    // Ensure we are inside an if block.
    if (this.condStack.length === 0 || this.condStack[this.condStack.length - 1].type !== "if") {
      debug("handleElseIf misplaced elseif", this.condStack);
      throw new Error("Misplaced elseif");
    }

    // Get the current conditional context
    const current = this.condStack[this.condStack.length - 1];

    // If any previous branch in this if-block was already taken,
    // or if the current condition is false, set cond to false
    if (current.branchTaken) {
      debug("handleElseIf previous branch taken, skipping", current);
      // A previous branch was already taken, so this elseif should be skipped
      current.cond = false;
    } else {
      debug("handleElseIf no previous branch taken, evaluating condition", current);
      // No branch taken yet, evaluate this condition
      const conditionStr = condition.join(" ");
      this.requireStaticLabelLookup = true;
      let conditionResult: boolean;
      try {
        conditionResult = this.evaluateExpression(conditionStr);
      } finally {
        this.requireStaticLabelLookup = false;
      }
      current.cond = conditionResult;
      current.conditionStr = conditionStr;
      // current.type = "elseif";

      // If this condition is true, mark that a branch has been taken
      if (conditionResult) {
        current.branchTaken = true;
      }
    }

    this.moreonlinecond = this.condStack.every(entry => entry.cond);
  }

  /**
   * Handles `else` statements.
   */
  handleElse(): void {
    debug("handleElse")
    if (this.condStack.length === 0 || this.condStack[this.condStack.length - 1].type !== "if") {
      throw new Error("Misplaced else");
    }

    // Get the current conditional context
    const current = this.condStack[this.condStack.length - 1];

    // Only enter the else block if no previous branch was taken
    if (current.branchTaken) {
      current.cond = false;
    } else {
      current.cond = true;
      current.branchTaken = true;
    }

    this.moreonlinecond = this.condStack.every(entry => entry.cond);
  }

  /**
   * Handles the end of an `if` statement (or `while`, since asar uses endif for both).
   */
  handleEndIf(): void {
    debug("handleEndIf")
    if (this.condStack.length === 0) {
      throw new Error("Misplaced endif");
    }
    const top = this.condStack[this.condStack.length - 1];
    if (top.type !== "if" && top.type !== "while") {
      throw new Error("Misplaced endif");
    }
    this.condStack.pop();
    if (top.type === "while" && top.cond) {
      this.endLoopCollection("while");
    }
    this.moreonlinecond = this.condStack.every(entry => entry.cond);
  }

  /**
   * Handles `while` loops.
   * @param {string[]} condition - The condition for the loop.
   */
  handleWhile(condition: string[]): void {
    // Determine whether this while is in an active branch.
    // If the parent condition is false, we still push a stack frame so `endif` balances,
    // but we do not collect/execute the loop body.
    const parentCond = this.condStack.length === 0 ? true : this.condStack.every(entry => entry.cond);

    // Push while onto condStack so endif can pop it (asar uses endif for both if and while).
    this.condStack.push({
      type: "while",
      cond: parentCond,
    });

    if (this.pass === 0 || !parentCond) return; // Skip collection when inactive or on pass 0

    // Build the original while statement to pass to the new method
    const whileStatement = `while ${condition.join(" ")}`;
    this.beginLoopCollection("while", whileStatement);
  }

  /**
   * Handles the end of a `while` loop.
   */
  handleEndWhile(): void {
    if (this.pass === 0) return; // Skip in pass 0

    this.endLoopCollection("while");
  }

  /**
   * Handles `org` directive to set SNES memory location.
   * @param {string[]} params - The parameters for the org directive.
   */
  handleOrg(params: string[]): void {
    debug("handleOrg", params);
    if (params.length !== 1) {
      throw new Error("ORG requires a single address parameter.");
    }

    const addressStr = params[0].trim();
    let addr = 0;
    // Support both `$` (hex) and standard decimal
    if (addressStr.startsWith("$")) {
        addr = parseInt(addressStr.substring(1), 16);
    } else {
        addr = parseInt(addressStr, 10);
    }
    debug("handleOrg addr", addr , addr.toString(16));
    if (isNaN(addr) || addr < 0 || addr > 0xFFFFFF) {
      throw new Error(`Invalid ORG address: ${params[0]}`);
    }

    this.setWritePosition(addr);
  }

  /**
   * Handles `db`, `dw`, `dl`, `dd` directives for defining data.
   * @param {string} type - The type of data directive.
   * @param {string[]} params - The parameters for the data directive.
   */
  handleDataDirective(type: string, params: string[]): void {
    debug("handleDataDirective", type, params);
    if (!Array.isArray(params) || params.length === 0) {
      throw new Error(`${type.toUpperCase()} directive requires at least one parameter.`);
    }

    // Support for SNASM-style data directives.
    if (type.toLowerCase() === "dc.b") {
      type = "db";
    } else if (type.toLowerCase() === "dc.w") {
      type = "dw";
    } else if (type.toLowerCase() === "dc.l") {
      type = "dl";
    }

    const lengthMap: { [key: string]: number } = {
      "db": 1,
      "dw": 2,
      "dl": 3,
      "dd": 4,
    };

    const len = lengthMap[type.toLowerCase()];
    if (!len) {
      throw new Error(`Invalid data directive: ${type}`);
    }

    if (this.pass === 0) {
      debug("handleDataDirective pass 0, estimating");
      const pendingValues = [...splitRespectingFunctions(params.join(" "))];
      let estimatedItems = 0;
      while (pendingValues.length > 0) {
        let value = (pendingValues.shift() ?? "").trim();
        if (!value) {
          continue;
        }

        if (value.startsWith('"') || value.startsWith("'")) {
          const unquoted = value.slice(1, -1);
          try {
            estimatedItems += this.defineEngine.resolveDefinesInStringLiteral(unquoted).length;
          } catch {
            estimatedItems += unquoted.length;
          }
          continue;
        }

        if (value.startsWith("#")) {
          value = value.substring(1);
        }

        let resolved = value;
        let previousResolved = "";
        try {
          while (resolved !== previousResolved) {
            previousResolved = resolved;
            resolved = this.resolvedefines(resolved);
          }
        } catch {
          // Pass 0 only needs byte counts, so unresolved symbols still consume one item.
        }

        const expandedValues = splitRespectingFunctions(resolved);
        if (expandedValues.length > 1) {
          pendingValues.unshift(...expandedValues);
          continue;
        }

        estimatedItems += 1;
      }

      this.step(estimatedItems * len);
      this.addAddressToLine(this.currentTargetBaseAddress & 0xFFFFFF);
      return;
    }

    // Split by comma while respecting function calls
    const values = splitRespectingFunctions(params.join(" "));

    const pendingValues = [...values];
    while (pendingValues.length > 0) {
      let value = (pendingValues.shift() ?? "").trim();
      if (value.startsWith('"') || value.startsWith("'")) {
        debug("handleDataDirective string literals", value);
        // Handle string literals
        const unquoted = value.slice(1, -1);
        const expandedString = this.defineEngine.resolveDefinesInStringLiteral(unquoted);
        debug("handleDataDirective string literal unquoted", unquoted);
        debug("handleDataDirective string literal expanded", expandedString);
        // Use character mapping for each character
        const mappedChars = this.processStringWithMapping(expandedString);
        for (const charValue of mappedChars) {
          this.writeDataByLength(len, charValue);
        }
      } else {
        debug("handleDataDirective numeric values", value);
        // Handle numeric values
        if (value.startsWith("#")) {
          debug("Warning: # before numbers in db/dw/... is deprecated. Remove the #.");
          value = value.substring(1);
        }

        // First resolve any defines in the expression so that tokens like "FillCount" are replaced.
        // Recursively resolve defines until no more changes occur
        let resolved = value;
        let previousResolved = "";
        while (resolved !== previousResolved) {
          previousResolved = resolved;
          resolved = this.resolvedefines(resolved);
        }
        debug("handleDataDirective recursively resolved defines", resolved);

        // A define used as a db/dw parameter may expand to multiple comma-separated values.
        // Re-queue each expanded token so it is processed like native directive arguments.
        const expandedValues = splitRespectingFunctions(resolved);
        if (expandedValues.length > 1) {
          pendingValues.unshift(...expandedValues);
          continue;
        }

        // Check if this is a struct reference (e.g., "sprite.x_pos")
        let num: number;
        try {
          const structValue = this.structEngine.resolveStructLabel(resolved);
          debug("handleDataDirective struct reference", { resolved, structValue });
          if (typeof structValue === "number" && !Number.isNaN(structValue)) {
            num = structValue;
            debug("handleDataDirective using struct value", num);
            this.writeDataByLength(len, num);
            continue;
          }
        } catch (error) {
          debug("handleDataDirective struct resolution failed, trying math evaluation", resolved);
          // If struct resolution fails, evaluate using the standard numeric resolver.
          num = this.operandResolver.getnum(resolved);
        }
        if (Number.isNaN(num)) {
          // As a fallback, try to look up a label (this assumes it's a static label).
          num = this.symbolScope.getLabelValue(resolved, true);
        }
        debug("handleDataDirective numeric num", num);

        if (Number.isNaN(num)) {
          debug("handleDataDirective unable to determine value:", num)
          throw new Error("Unable to determine value:")
        }
        this.writeDataByLength(len, num);
      }
    }

    this.addAddressToLine(this.currentTargetBaseAddress & 0xFFFFFF);
  }

  /**
   * Writes data of the specified length.
   * @param {number} len The length of the data to write.
   * @param {number} value The value to write.
   */
  writeDataByLength(len: number, value: number): void {
    debug("writeDataByLength", { len, value });
    // TODO Why is len a string here sometimes?
    if (typeof len !== "number") {
      len = Number.parseInt(len, 10);
      if (Number.isNaN(len)) {
        throw new Error("writeDataByLength: len is NaN");
      }
    }
    debug("writeDataByLength", { len: len.toString(16), value: value.toString(16) });
    switch (len) {
      case 1:
        this.write1(value);
        break;
      case 2:
        this.write2(value);
        break;
      case 3:
        this.write3(value);
        break;
      case 4:
        this.write4(value);
        break;
      default:
        throw new Error(`Unsupported data length ${len}`);
    }
  }

  /**
   * Pushes the current namespace.
   */
  handlePushNamespace(): void {
    debug("handlePushNamespace")
    this.namespaceStack.push(this.currentNamespace);
    if (this.namespaceNestingEnabled) {
      // Also save the nesting path
      this.namespaceStack.push(JSON.stringify(this.namespaceNestingPath));
    }
  }

  /**
   * Restores the previous namespace.
   */
  handlePullNamespace(): void {
    debug("handlePullNamespace");
    if (this.namespaceStack.length === 0) {
      throw new Error("pullns without pushns");
    }
    if (this.namespaceNestingEnabled) {
      // Restore the nesting path first
      const pathJson = this.namespaceStack.pop();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.namespaceNestingPath = JSON.parse(pathJson);
    }
    this.currentNamespace = this.namespaceStack.pop();
  }
  /**
   * Handles `namespace` definitions.
   * @param {string[]} params - The parameters for the namespace directive.
   */
  handleNamespace(params: string[]): void {
    debug("handleNamespace", params);

    // Handle namespace nesting directive
    if (params.length >= 2 && params[0].toLowerCase() === "nested") {
      const action = params[1].toLowerCase();
      if (action === "on") {
        this.namespaceNestingEnabled = true;
        return;
      } else if (action === "off") {
        this.namespaceNestingEnabled = false;
        this.namespaceNestingPath = [];
        this.currentNamespace = "";
        return;
      }
    }

    if (params.length === 0) {
      debug("handleNamespace empty, resetting namespace");
      if (this.namespaceNestingEnabled) {
        this.namespaceNestingPath = [];
      }
      this.currentNamespace = "";
      return;
    }

    if (params.length === 1 && params[0].toLowerCase() === "off") {
      debug("handleNamespace disable", this.currentNamespace);
      if (this.namespaceNestingEnabled) {
        // Pop the last namespace from the path
        this.namespaceNestingPath.pop();
        // Reconstruct the current namespace from the remaining path
        this.currentNamespace = this.namespaceNestingPath.join("_");
      } else {
        this.currentNamespace = "";
      }
      return;
    } else if (params.length === 1) {
      debug("handleNamespace enable", params[0]);
      if (this.namespaceNestingEnabled) {
        this.namespaceNestingPath.push(params[0]);
        this.currentNamespace = this.namespaceNestingPath.join("_");
      } else {
        this.currentNamespace = params[0];
      }
      return;
    }

    const action = params[1].toLowerCase();
    if (action === "off") {
      debug("handleNamespace disable action", params[0]);
      if (this.namespaceNestingEnabled) {
        this.namespaceNestingPath.pop();
        this.currentNamespace = this.namespaceNestingPath.join("_");
      } else {
        this.currentNamespace = "";
      }
    } else {
      debug("handleNamespace enable action", params[0]);
      if (this.namespaceNestingEnabled) {
        this.namespaceNestingPath.push(params[0]);
        this.currentNamespace = this.namespaceNestingPath.join("_");
      } else {
        this.currentNamespace = params[0];
      }
    }
  }

  /**
   * Pushes the current PC onto the pushpcStack.
   */
  handlePushPC(): void {
    debug("handlePushPC")
    if (this.pushpcnum >= 256) {
      throw new Error("PushPC stack overflow.");
    }

    this.pushpcStack.push({
        currentTargetAddress: this.currentTargetAddress,
        currentTargetStartAddress: this.currentTargetStartAddress,
        currentTargetBaseAddress: this.currentTargetBaseAddress,
        currentTargetBaseStartAddress: this.currentTargetBaseStartAddress,
    });

    this.pushpcnum++;
  }

  /**
   * Restores the previous PC.
   */
  handlePullPC(): void {
    debug("handlePullPC");
    if (this.pushpcnum === 0) {
      throw new Error("PullPC without PushPC.");
    }

    const state = this.pushpcStack.pop();
    this.currentTargetAddress = state.currentTargetAddress;
    this.currentTargetStartAddress = state.currentTargetStartAddress;
    this.currentTargetBaseAddress = state.currentTargetBaseAddress;
    this.currentTargetBaseStartAddress = state.currentTargetBaseStartAddress;

    this.pushpcnum--;
  }

  /**
   * Evaluates a range expression and returns the result.
   * @param {string} expr The expression to evaluate.
   * @returns {number} The result of the expression.
   */
  evaluateRangeExpression(expr: string | ExpressionNode): number {
    debug("assemlber evaluateRangeExpression", expr)
    const resolvedExpr = this.resolveExpressionInput(expr);
    if (isReferenceExpressionNode(resolvedExpr)) {
      return this.evaluateReferenceExpressionNode(resolvedExpr, true);
    }
    // Try evaluating the expression numerically.
    try {
      const result = this.mathCore.math(resolvedExpr);
      // Range bounds such as `(000 * 32)` legitimately evaluate to zero, so
      // treat any numeric result as valid instead of falling through to label
      // lookup on falsy `0`.
      if (!Number.isNaN(result)) {
        return result;
      }
    } catch (error) {}
    // If that fails, assume it's a static label.
    // (Pass 'true' to require that the label be static.)
    return this.symbolScope.getLabelValue(renderExpressionNode(resolvedExpr), true);
  }

  /**
   * Sets the paths to search for included files.
   * @param {string[]} paths The paths to search for included files.
   */
  setIncludePaths(paths: string[]): void {
    this.includePaths = paths;
  }

  /**
   * Evaluates an expression for conditionals (if, while).
   * @param {string} expression - The expression to evaluate.
   * @returns {boolean} True if the expression is true, false otherwise.
   */
  evaluateExpression(expression: string | ExpressionNode): boolean {
    debug("evaluateExpression", expression)
    let resolvedExpr: ExpressionNode | undefined;
    let result: number;
    try {
      // Resolve inside the guarded block so failures from define/label/static checks
      // are reported with the same contextual wrapper as math failures.
      resolvedExpr = this.resolveExpressionInput(expression);
      debug("evaluateExpression resolvedExpr", resolvedExpr)
      result = isReferenceExpressionNode(resolvedExpr)
        ? this.evaluateReferenceExpressionNode(resolvedExpr)
        : this.mathCore.math(resolvedExpr);
    } catch (e) {
      const originalExpr = typeof expression === "string" ? expression : renderExpressionNode(expression);
      const resolvedText = resolvedExpr ? renderExpressionNode(resolvedExpr) : "<unresolved>";
      throw new Error(`Error evaluating expression "${originalExpr}" (resolved to "${resolvedText}"): ${e}`);
    }
    // In our assembler, a condition is true if the result is nonzero.
    debug("evaluateExpression result", result, "=>", result !== 0)
    return result !== 0;
  }

  /**
   * Parses string input into an expression node and resolves nested references/defines.
   * @param {string | ExpressionNode} expression The expression source or parsed node.
   * @returns {ExpressionNode} The resolved expression tree.
   */
  resolveExpressionInput(expression: string | ExpressionNode): ExpressionNode {
    const parsed = typeof expression === "string" ? parseExpressionNode(expression.trim()) : expression;
    return this.resolveExpressionNode(parsed);
  }

  /**
   * Recursively resolves define references and nested reference-expression nodes.
   * @param {ExpressionNode} expression The expression node to resolve.
   * @returns {ExpressionNode} The resolved expression node.
   */
  resolveExpressionNode(expression: ExpressionNode): ExpressionNode {
    if (isReferenceExpressionNode(expression)) {
      return this.resolveReferenceExpressionNode(expression);
    }

    switch (expression.type) {
      case "binary":
        return {
          ...expression,
          left: this.resolveExpressionNode(expression.left),
          right: this.resolveExpressionNode(expression.right),
        };
      case "unary":
        return {
          ...expression,
          argument: this.resolveExpressionNode(expression.argument),
        };
      case "range":
        return {
          ...expression,
          start: this.resolveExpressionNode(expression.start),
          end: this.resolveExpressionNode(expression.end),
        };
      case "call":
        return {
          ...expression,
          arguments: expression.arguments.map((argument) => this.resolveExpressionNode(argument)),
        };
      case "raw":
        if (/(^|[^!<=>])![\w{]/.test(expression.value)) {
          return this.resolveExpressionInput(this.resolvedefines(expression.value));
        }
        return expression;
      default:
        return expression;
    }
  }

  /**
   * Resolves reference-style expressions such as identifiers, define references,
   * member access, and indexed access into either simpler reference nodes or
   * raw/math expressions when defines collapse them further.
   * @param {ReferenceExpressionNode} expression The reference expression to resolve.
   * @returns {ExpressionNode} The resolved expression tree.
   */
  resolveReferenceExpressionNode(expression: ReferenceExpressionNode): ExpressionNode {
    switch (expression.type) {
      case "identifier":
        return expression;
      case "defineReference": {
        const defineName = expression.braced
          ? this.resolvedefines(expression.content ?? "")
          : (expression.name ?? "");
        const value = this.lookupDefineValue(defineName);
        if (value === undefined) {
          throw new Error(`Define '${defineName}' not found.`);
        }
        return this.resolveExpressionInput(value);
      }
      case "member": {
        const object = this.resolveReferenceExpressionNode(expression.object);
        if (!isReferenceExpressionNode(object)) {
          const expandedReference = this.tryResolveExpandedReferenceExpression(expression);
          if (expandedReference) {
            return expandedReference;
          }
          return { type: "raw", value: `${renderExpressionNode(object)}.${expression.property.name}` };
        }
        return {
          ...expression,
          object,
        };
      }
      case "index": {
        const object = this.resolveReferenceExpressionNode(expression.object);
        const index = this.resolveExpressionNode(expression.index);
        if (!isReferenceExpressionNode(object)) {
          const expandedReference = this.tryResolveExpandedReferenceExpression(expression);
          if (expandedReference) {
            return expandedReference;
          }
          return { type: "raw", value: `${renderExpressionNode(object)}[${renderExpressionNode(index)}]` };
        }
        return {
          ...expression,
          object,
          index,
        };
      }
      default:
        return expression;
    }
  }

  /**
   * Resolves a reference expression all the way to a numeric value.
   * @param {ReferenceExpressionNode} expression The reference expression to evaluate.
   * @param {boolean} [requireStatic] Whether labels must be static.
   * @returns {number} The numeric value of the reference.
   */
  evaluateReferenceExpressionNode(expression: ReferenceExpressionNode, requireStatic = false): number {
    const resolved = this.resolveReferenceLabelValue(expression, requireStatic);
    if (typeof resolved === "number") {
      return resolved;
    }
    throw new Error(`Reference '${resolved}' did not resolve to a numeric value.`);
  }

  /**
   * Resolves a reference expression to either a numeric value or a normalized
   * label/struct lookup target, depending on how far the expression collapses.
   * @param {ReferenceExpressionNode} expression The reference expression to resolve.
   * @param {boolean} [requireStatic] Whether labels must be static.
   * @returns {number | string} The resolved numeric value.
   */
  resolveReferenceLabelValue(expression: ReferenceExpressionNode, requireStatic = false): number | string {
    const resolved = this.resolveReferenceExpressionNode(expression);
    if (!isReferenceExpressionNode(resolved)) {
      return this.mathCore.math(resolved);
    }

    return this.resolveNormalizedReferenceLabelValue(this.renderResolvedReferenceExpression(resolved), requireStatic);
  }

  /**
   * Resolves an already-normalized reference string as either a struct member/base
   * or a plain label lookup.
   * @param {string} normalizedReference The normalized reference text.
   * @param {boolean} [requireStatic] Whether labels must be static.
   * @returns {number} The resolved numeric address/value.
   */
  resolveNormalizedReferenceLabelValue(normalizedReference: string, requireStatic = false): number {
    // Dotted and indexed references may name either a struct member or a plain
    // label. Try the struct path first, then fall back to standard label lookup.
    if (normalizedReference.includes(".") || normalizedReference.includes("[")) {
      try {
        return this.structEngine.resolveStructLabel(normalizedReference);
      } catch {
        // Fall back to normal label lookup.
      }
    }
    if (this.structs.has(normalizedReference)) {
      return this.structEngine.resolveStructLabel(normalizedReference);
    }
    return this.symbolScope.getLabelValue(normalizedReference, requireStatic);
  }

  /**
   * Renders an index expression for a normalized reference string.
   * @param {ExpressionNode} indexExpression The index expression to render.
   * @returns {string} The rendered numeric or source-like index text.
   */
  resolveReferenceIndexText(indexExpression: ExpressionNode): string {
    const resolvedIndex = this.resolveExpressionNode(indexExpression);
    try {
      return this.mathCore.math(resolvedIndex).toString();
    } catch {
      return renderExpressionNode(resolvedIndex);
    }
  }

  /**
   * Renders a reference expression after resolving any nested index expressions.
   * @param {ReferenceExpressionNode} expression The reference expression to render.
   * @returns {string} The normalized reference text.
   */
  renderResolvedReferenceExpression(expression: ReferenceExpressionNode): string {
    return renderReferenceExpressionNode(expression, {
      renderIndex: (indexExpression) => this.resolveReferenceIndexText(indexExpression),
    });
  }

  /**
   * Re-runs `resolvedefines()` across a rendered reference expression and reparses
   * it only when define expansion materially changes the text.
   * @param {ReferenceExpressionNode} expression The reference expression to expand.
   * @returns {ExpressionNode | undefined} The reparsed expression, if expansion changed it.
   */
  tryResolveExpandedReferenceExpression(expression: ReferenceExpressionNode): ExpressionNode | undefined {
    const renderedReference = this.renderResolvedReferenceExpression(expression);
    const expandedReference = this.resolvedefines(renderedReference);
    if (expandedReference === renderedReference) {
      return undefined;
    }
    return this.resolveExpressionInput(expandedReference);
  }

  /**
   * Resolves standalone relative-label tokens used in define contexts.
   * @param {string} input The token to resolve.
   * @returns {string | undefined} The resolved address string, if applicable.
   */
  tryResolveRelativeLabelToken(input: string): string | undefined {
    if (input !== "+" && input !== "-" && input !== "?+" && input !== "?-") {
      return undefined;
    }

    debug(`resolvedefines handling relative label: ${input}`);
    try {
      switch (input) {
        case "+":
          return `$${this.symbolScope.findNextLabel("+").toString(16)}`;
        case "-":
          return `$${this.symbolScope.findPreviousLabel("-").toString(16)}`;
        case "?+":
          return `$${this.symbolScope.findNextLabel("?+").toString(16)}`;
        case "?-":
          return `$${this.symbolScope.findPreviousLabel("?-").toString(16)}`;
        default:
          return undefined;
      }
    } catch (error) {
      if (this.pass < 2) {
        debug(`resolvedefines pass ${this.pass} < 2, returning placeholder`);
        return "$0000";
      }
      debug(`resolvedefines failed to resolve relative label ${input}: ${error instanceof Error ? error.message : ""} on pass ${this.pass}`);
      throw error;
    }
  }

  /**
   * Resolves direct `!name` define references that are not assignments.
   * @param {string} input The token to resolve.
   * @returns {string | undefined} The resolved define value, if applicable.
   */
  tryResolveDirectDefineReference(input: string): string | undefined {
    if (!input.startsWith("!") || input.includes(" ") || input.includes("=") || input.includes("{")) {
      return undefined;
    }

    debug("resolvedefines direct variable reference", input);
    const varName = input.substring(1);
    return this.lookupDefineValue(varName);
  }

  /**
   * Resolves macro-label references such as `?label` or `#+?label`.
   * @param {string} input The token to resolve.
   * @returns {string | undefined} The resolved macro-label value, if applicable.
   */
  tryResolveMacroLabelReference(input: string): string | undefined {
    const prefixMatch = input.match(/^(#\?|\?|#\?\.|\?\+|\?-)(.*)/);
    if (!prefixMatch) {
      return undefined;
    }

    const prefix = prefixMatch[1];
    const labelName = prefixMatch[2];
    debug("resolvedefines macro label found with prefix", { prefix, labelName });
    return this.symbolScope.getLabelValue(labelName, false).toString();
  }

  /**
   * Resolves bare label-like tokens before the generic character-by-character
   * define scanner runs.
   * @param {string} input The token to resolve.
   * @returns {string | undefined} The resolved label value, if applicable.
   */
  tryResolveBareLabelReference(input: string): string | undefined {
    if (!isBareLabelReference(input)) {
      return undefined;
    }

    // Expressions like `.zone_n-.zone_max` must stay intact so later arithmetic
    // can evaluate both sides instead of collapsing to the first local label.
    debug("resolvedefines checking if input is a label reference", input);
    try {
      const labelValue = this.symbolScope.getLabelValue(input, false);
      debug("resolvedefines labelValue", labelValue);
      return labelValue.toString();
    } catch (error) {
      debug("resolvedefines not a label, continuing", error);
      return undefined;
    }
  }

  /**
   * Resolves all define replacements in a given string.
   * @param {string} input The string to resolve defines in.
   * @returns {string} The string with defines resolved.
   */
  resolvedefines(input: string): string {
    debug("resolvedefines", { input });
    if (!input) {
      debug("resolvedefines input is empty, returning empty string");
      return "";
    }
    // debug("resolvedefines defines", this.defines);
    let result = "";
    let index = 0;

    const resolvedRelativeLabel = this.tryResolveRelativeLabelToken(input);
    if (resolvedRelativeLabel !== undefined) {
      return resolvedRelativeLabel;
    }

    // Special case for expressions with != operator
    // This prevents issues with != being misinterpreted as a define
    if (input.includes("!=")) {
      debug("resolvedefines != operator found in", input);
      // Process each part of the expression separately
      const parts = input.split("!=");
      const resolvedParts = parts.map(part => this.resolvedefines(part.trim()));
      return resolvedParts.join("!=");
    }

    if ((input.startsWith("sizeof(") || input.startsWith("objectsize(")) && input.endsWith(")")) {
      debug("resolvedefines sizeof found, skipping", input);
      return input;
    }

    const resolvedDirectDefine = this.tryResolveDirectDefineReference(input);
    if (resolvedDirectDefine !== undefined) {
      return resolvedDirectDefine;
    }

    const resolvedMacroLabel = this.tryResolveMacroLabelReference(input);
    if (resolvedMacroLabel !== undefined) {
      return resolvedMacroLabel;
    }

    const resolvedBareLabel = this.tryResolveBareLabelReference(input);
    if (resolvedBareLabel !== undefined) {
      return resolvedBareLabel;
    }

    // Process any explicit !defines
    while (index < input.length) {
      const char = input[index];

      if (char === "\\" && input[index + 1] === "\\") {
        debug("resolvedefines double slash", input);
        result += "\\";
        index += 2;
      } else if (char === "\\" && input[index + 1] === "!") {
        debug("resolvedefines \\!define", input);
        result += "!";
        index += 2;
      } else if (char === "!") {
        debug("resolvedefines !define", input);
        let defineName = "";
        index++; // skip the !
        if (input[index] === "{") {
          index++;
          let unprocessedName = "";
          let braces = 1;
          while (index < input.length) {
            if (input[index] === "{") braces++;
            if (input[index] === "}") braces--;
            if (braces === 0) break;
            unprocessedName += input[index++];
          }
          if (braces !== 0) throw new Error("Error: Mismatched braces in define name.");
          index++; // skip the closing }
          defineName = this.resolvedefines(unprocessedName);
          debug("resolvedefines !define defineName", defineName);
        } else {
          // Handle regular define (no braces)
          while (index < input.length && /\w/.test(input[index])) {
            defineName += input[index++];
          }
          debug("resolvedefines !define defineName", defineName);
        }

        // Look up the variable using our helper function
        const value = this.lookupDefineValue(defineName);

        if (value === undefined) {
          throw new Error(`Define '${defineName}' not found.`);
        } else {
          result += value;
        }
      } else {
        result += char;
        index++;
      }
    }

    debug("resolvedefines result =", { result });
    return result;
  }

  /**
   * Sets the current pass of assembly.
   * @param {number} pass - The pass number to set.
   */
  setPass(pass: number): void {
    debug("🏁 setPass", pass);
    this.pass = pass;
    if (this.activeStageExecutionState) {
      this.activeStageExecutionState.pass = pass as 0 | 1 | 2;
    }
    switch (pass) {
      case 1:
        // Rebuild relative-label tables from pass 1 sizing only.
        this.forwardLabels = {};
        this.backwardLabels = {};
        break;
      default:
        break;
    }
    // Reset the macro macroLabelInstance
    this.macroLabelInstance = null;

    // Reset guarded status for all files when starting a new pass
    // This ensures files with includeonce are processed in each pass
    for (const [filePath, fileInfo] of this.includedFiles.entries()) {
      fileInfo.guarded = false;
      this.includedFiles.set(filePath, fileInfo);
    }

    // Reset the in macro flag
    this.inMacroExpansion = false;

    // Reset the in loop flag
    this.collectingLoop = false;
    this.currentLoop = null;

    // Reset the condition stack
    this.condStack = [];
    this.inSpcblock = false;
    this.spcblockData = null;
    this.spcInlineCompatMode = false;
  }

  /**
   * Completes the current pass, performing any necessary cleanup.
   */
  finishPass(): void {
    this.romWriter.finishPass();
    if (this.pass === 2) {
      this.passProgramCache.clear();
    }
  }

  /**
   * Sets the current file being processed.
   * @param {string} filename - The filename to set.
   */
  setCurrentFile(filename: string): void {
    debug("setCurrentFile", filename);
    this.currentFile = filename;
    this.currentLine = 0;
  }

  /**
   * Sets the current line number.
   * @param {number} line - The line number to set.
   */
  setCurrentLine(line: number): void {
    // debug('setCurrentLine', line);
    this.currentLine = line;
  }

  getStageDescriptor(stage: AssemblyStageName): Pick<StageExecutionState, "stage" | "pass" | "capabilities"> {
    if (stage === "collectDefinitions") {
      return {
        stage,
        pass: 0,
        capabilities: {
          instructionMode: "layout",
          canEmitBytes: false,
          canFinalize: false,
          enforceResolvedLabels: false,
          isDefinitionCollectionStage: true,
        },
      };
    }
    if (stage === "resolveLayout") {
      return {
        stage,
        pass: 1,
        capabilities: {
          instructionMode: "emit",
          canEmitBytes: false,
          canFinalize: false,
          enforceResolvedLabels: false,
          isDefinitionCollectionStage: false,
        },
      };
    }
    return {
      stage,
      pass: 2,
      capabilities: {
        instructionMode: "emit",
        canEmitBytes: true,
        canFinalize: true,
        enforceResolvedLabels: true,
        isDefinitionCollectionStage: false,
      },
    };
  }

  cloneRelativeLabels(source: { [depth: number]: { addr: number; macroInstance?: number }[] }): { [depth: number]: { addr: number; macroInstance?: number }[] } {
    const clone: { [depth: number]: { addr: number; macroInstance?: number }[] } = {};
    for (const [depth, entries] of Object.entries(source)) {
      clone[Number(depth)] = entries.map((entry) => ({ ...entry }));
    }
    return clone;
  }

  createStageExecutionState(stage: AssemblyStageName): StageExecutionState {
    const descriptor = this.getStageDescriptor(stage);
    const previousStage = stage === "resolveLayout" ? "collectDefinitions" : stage === "emitProgram" ? "resolveLayout" : undefined;
    const seed = previousStage ? this.stageExecutionStates.get(previousStage) : undefined;
    const cursorSeed = seed?.cursor ?? {
      currentTargetAddress: this.currentTargetAddress,
      currentTargetBaseAddress: this.currentTargetBaseAddress,
      currentTargetStartAddress: this.currentTargetStartAddress,
      currentTargetBaseStartAddress: this.currentTargetBaseStartAddress,
      bytes: this.bytes,
    };
    const symbolSeed = seed?.symbols ?? {
      labelTable: this.labelTable,
      forwardLabels: this.forwardLabels,
      backwardLabels: this.backwardLabels,
      currentParentLabel: this.currentParentLabel,
      currentParentIsGlobal: this.currentParentIsGlobal,
      currentGlobalParentLabel: this.currentGlobalParentLabel,
      labelParents: this.labelParents,
    };
    const controlSeed = seed?.control ?? {
      condStack: this.condStack,
      namespaceStack: this.namespaceStack,
      currentNamespace: this.currentNamespace,
      namespaceNestingEnabled: this.namespaceNestingEnabled,
      namespaceNestingPath: this.namespaceNestingPath,
      loopStack: this.loopStack,
      currentLoop: this.currentLoop,
      collectingLoop: this.collectingLoop,
      loopNestingLevel: this.loopNestingLevel,
      inMacroExpansion: this.inMacroExpansion,
      macroLabelInstance: this.macroLabelInstance,
    };
    const writeSeed = seed?.writeState ?? {
      inSpcblock: this.inSpcblock,
      spcblockData: this.spcblockData,
      spcInlineCompatMode: this.spcInlineCompatMode,
      activeFreespaceStartPc: this.activeFreespaceStartPc,
      activeFreespaceContentStartPc: this.activeFreespaceContentStartPc,
    };

    return {
      ...descriptor,
      cursor: { ...cursorSeed },
      symbols: {
        labelTable: new Map(Array.from(symbolSeed.labelTable.entries()).map(([key, value]) => [key, { ...value }])),
        forwardLabels: this.cloneRelativeLabels(symbolSeed.forwardLabels),
        backwardLabels: this.cloneRelativeLabels(symbolSeed.backwardLabels),
        currentParentLabel: symbolSeed.currentParentLabel,
        currentParentIsGlobal: symbolSeed.currentParentIsGlobal,
        currentGlobalParentLabel: symbolSeed.currentGlobalParentLabel,
        labelParents: new Map(symbolSeed.labelParents),
      },
      control: {
        condStack: controlSeed.condStack.map((entry) => ({ ...entry })),
        namespaceStack: [...controlSeed.namespaceStack],
        currentNamespace: controlSeed.currentNamespace,
        namespaceNestingEnabled: controlSeed.namespaceNestingEnabled,
        namespaceNestingPath: [...controlSeed.namespaceNestingPath],
        loopStack: [...controlSeed.loopStack],
        currentLoop: controlSeed.currentLoop,
        collectingLoop: controlSeed.collectingLoop,
        loopNestingLevel: controlSeed.loopNestingLevel,
        inMacroExpansion: controlSeed.inMacroExpansion,
        macroLabelInstance: controlSeed.macroLabelInstance,
      },
      writeState: {
        inSpcblock: writeSeed.inSpcblock,
        spcblockData: writeSeed.spcblockData ? { ...writeSeed.spcblockData } : null,
        spcInlineCompatMode: writeSeed.spcInlineCompatMode,
        activeFreespaceStartPc: writeSeed.activeFreespaceStartPc,
        activeFreespaceContentStartPc: writeSeed.activeFreespaceContentStartPc,
      },
      loweredCommandCache: new WeakMap<NormalizedCommand, LoweredCommand>(),
    };
  }

  applyStageExecutionState(stageState: StageExecutionState): void {
    this.pass = stageState.pass;
    this.currentTargetAddress = stageState.cursor.currentTargetAddress;
    this.currentTargetBaseAddress = stageState.cursor.currentTargetBaseAddress;
    this.currentTargetStartAddress = stageState.cursor.currentTargetStartAddress;
    this.currentTargetBaseStartAddress = stageState.cursor.currentTargetBaseStartAddress;
    this.bytes = stageState.cursor.bytes;
    this.labelTable = stageState.symbols.labelTable;
    this.forwardLabels = stageState.symbols.forwardLabels;
    this.backwardLabels = stageState.symbols.backwardLabels;
    this.currentParentLabel = stageState.symbols.currentParentLabel;
    this.currentParentIsGlobal = stageState.symbols.currentParentIsGlobal;
    this.currentGlobalParentLabel = stageState.symbols.currentGlobalParentLabel;
    this.labelParents = stageState.symbols.labelParents;
    this.condStack = stageState.control.condStack;
    this.namespaceStack = stageState.control.namespaceStack;
    this.currentNamespace = stageState.control.currentNamespace;
    this.namespaceNestingEnabled = stageState.control.namespaceNestingEnabled;
    this.namespaceNestingPath = stageState.control.namespaceNestingPath;
    this.loopStack = stageState.control.loopStack;
    this.currentLoop = stageState.control.currentLoop;
    this.collectingLoop = stageState.control.collectingLoop;
    this.loopNestingLevel = stageState.control.loopNestingLevel;
    this.inMacroExpansion = stageState.control.inMacroExpansion;
    this.macroLabelInstance = stageState.control.macroLabelInstance;
    this.inSpcblock = stageState.writeState.inSpcblock;
    this.spcblockData = stageState.writeState.spcblockData;
    this.spcInlineCompatMode = stageState.writeState.spcInlineCompatMode;
    this.activeFreespaceStartPc = stageState.writeState.activeFreespaceStartPc;
    this.activeFreespaceContentStartPc = stageState.writeState.activeFreespaceContentStartPc;
  }

  captureStageExecutionState(stageState: StageExecutionState): void {
    stageState.cursor = {
      currentTargetAddress: this.currentTargetAddress,
      currentTargetBaseAddress: this.currentTargetBaseAddress,
      currentTargetStartAddress: this.currentTargetStartAddress,
      currentTargetBaseStartAddress: this.currentTargetBaseStartAddress,
      bytes: this.bytes,
    };
    stageState.symbols = {
      labelTable: this.labelTable,
      forwardLabels: this.forwardLabels,
      backwardLabels: this.backwardLabels,
      currentParentLabel: this.currentParentLabel,
      currentParentIsGlobal: this.currentParentIsGlobal,
      currentGlobalParentLabel: this.currentGlobalParentLabel,
      labelParents: this.labelParents,
    };
    stageState.control = {
      condStack: this.condStack,
      namespaceStack: this.namespaceStack,
      currentNamespace: this.currentNamespace,
      namespaceNestingEnabled: this.namespaceNestingEnabled,
      namespaceNestingPath: this.namespaceNestingPath,
      loopStack: this.loopStack,
      currentLoop: this.currentLoop,
      collectingLoop: this.collectingLoop,
      loopNestingLevel: this.loopNestingLevel,
      inMacroExpansion: this.inMacroExpansion,
      macroLabelInstance: this.macroLabelInstance,
    };
    stageState.writeState = {
      inSpcblock: this.inSpcblock,
      spcblockData: this.spcblockData,
      spcInlineCompatMode: this.spcInlineCompatMode,
      activeFreespaceStartPc: this.activeFreespaceStartPc,
      activeFreespaceContentStartPc: this.activeFreespaceContentStartPc,
    };
  }

  getOrCreateStageExecutionState(stage: AssemblyStageName): StageExecutionState {
    const existing = this.stageExecutionStates.get(stage);
    if (existing) {
      return existing;
    }
    const created = this.createStageExecutionState(stage);
    this.stageExecutionStates.set(stage, created);
    return created;
  }

  buildProgramModel(source: string, sourceFile = this.currentFile, startLine = 0): ProgramModel {
    const commands = splitInlineCommands(this.preprocessBlockCommands(source));
    const nodes = this.getOrBuildPassProgram(commands, sourceFile, startLine);
    return {
      sourceFile,
      startLine,
      nodes,
    };
  }

  runStage(stage: AssemblyStageName, program: ProgramModel): StageExecutionState {
    if (stage === "collectDefinitions") {
      this.stageExecutionStates.clear();
      this.activeStageExecutionState = null;
    }
    const stageState = this.getOrCreateStageExecutionState(stage);
    this.activeStageExecutionState = stageState;
    this.applyStageExecutionState(stageState);
    this.setCurrentFile(program.sourceFile);
    this.setPass(stageState.pass);
    this.executeNodeStream(program.nodes);
    this.finishPass();
    this.captureStageExecutionState(stageState);
    return stageState;
  }

  assembleProgram(program: ProgramModel): void {
    this.runStage("collectDefinitions", program);
    this.runStage("resolveLayout", program);
    this.runStage("emitProgram", program);
  }

  assembleSource(source: string, sourceFile = this.currentFile, startLine = 0): ProgramModel {
    const program = this.buildProgramModel(source, sourceFile, startLine);
    this.assembleProgram(program);
    return program;
  }

  /**
   * Writes a block of data to ROM.
   * @param {number} start The starting address of the block to write.
   * @param {number} value The byte value to write.
   * @param {number} [length] The length of the block to write.
   */
  writeDataBytes(start: number, value: number, length: number = 1): void {
    debug("writeDataBytes", { start, value, length });
    if (typeof start !== "number" || typeof value !== "number" || typeof length !== "number") {
      throw new Error("writeDataBytes requires a number for start, value, and length");
    }
    if (value > 0xFF) {
      debug("writeDataBytes 💥 value must be less than 0xFF", value);
    }
    debug("writeDataBytes before this.romdata.length", this.romdata.length, "/", this.romdata.length.toString(16));
    for (let i = 0; i < length; i++) {
      this.romdata[start + i] = value & 0xFF;
    }
    debug("writeDataBytes after this.romdata.length", this.romdata.length, "/", this.romdata.length.toString(16));
  }

  /**
   * Expands ROM size and fills it with a specified byte.
   * @param {number} newSize The new size of the ROM.
   * @param {number} fsByte The byte value to fill the ROM with.
   */
  expandRom(newSize: number, fsByte: number): void {
    debug("expandRom", { newSize, fsByte });
    if (typeof newSize !== "number" || typeof fsByte !== "number") {
      throw new Error("expandRom requires a number for newSize and fsByte");
    }
    if (newSize > this.romdata.length) {
      this.writeDataBytes(this.romdata.length, fsByte, newSize - this.romdata.length);
    } else {
      debug("expandRom newSize <= this.romdata.length, no expansion needed");
    }
  }

  /**
   * Gets the size of a struct or extension.
   * @param {string} identifier The identifier of the struct or extension.
   * @param {boolean} [baseOnly] If true, returns only the base size without extensions.
   * @returns {number} The size of the struct or extension.
   * @throws {Error} If the struct or extension doesn't exist.
   */
  getObjectSize(identifier: string, baseOnly: boolean = false): number {
    return this.symbolScope.getObjectSize(identifier, baseOnly);
  }

  /**
   * Updates the header checksum (16-bit) and CRC32.
   * For LoROM, the header is at 0x7FC0; for HiROM (and exhirom) at 0xFFC0.
   */
  updateHeaderAndCRC32(): void {
    debug("updateHeaderAndCRC32");
    let headerOffset: number;
    // TODO: Validate header offset for other mappers.
    if (this.mapper === "lorom" || this.mapper === "sa1rom" || this.mapper === "bigsa1rom") {
      headerOffset = 0x7FC0;
    } else if (this.mapper === "hirom" || this.mapper === "exhirom") {
      headerOffset = 0xFFC0;
    } else {
      // For other mappers default to 0xFFC0 (same as HiROM)
      headerOffset = 0xFFC0;
    }
    debug("updateHeaderAndCRC32 headerOffset", headerOffset)

    if (this.romdata.length < headerOffset + 0x20) {
      debug("ROM too small for header update.");
      return;
    }

    // Set complement to 0xFFFF
    this.romdata[headerOffset + 0x1C] = 0xFF;
    this.romdata[headerOffset + 0x1D] = 0xFF;
    // Set checksum to 0x0000
    this.romdata[headerOffset + 0x1E] = 0x00;
    this.romdata[headerOffset + 0x1F] = 0x00;

    // Calculate the 16-bit checksum.
    // - "simple": plain 16-bit sum over ROM bytes
    // - "asar": Asar-compatible handling for non power-of-two ROM sizes
    //   by repeating tail contribution to emulate mirrored mapping.
    const romLength = this.romdata.length;
    let checksum = 0;

    if (this.checksumMode === "simple") {
      for (let i = 0; i < romLength; i++) {
        checksum += this.romdata[i] & 0xFF;
      }
    } else {
      const isPowerOfTwo = romLength > 0 && (romLength & (romLength - 1)) === 0;
      if (isPowerOfTwo) {
        for (let i = 0; i < romLength; i++) {
          checksum += this.romdata[i] & 0xFF;
        }
      } else {
        let bitround = 1;
        while (bitround < romLength) {
          bitround <<= 1;
        }
        const firstPart = bitround >> 1;
        const secondPart = romLength - firstPart;
        const repeatCount = Math.floor(firstPart / secondPart);

        let secondPartSum = 0;
        for (let i = 0; i < firstPart; i++) {
          checksum += this.romdata[i] & 0xFF;
        }
        for (let i = firstPart; i < romLength; i++) {
          secondPartSum += this.romdata[i] & 0xFF;
        }
        checksum += secondPartSum * repeatCount;
      }
    }
    checksum &= 0xFFFF;
    const complement = (~checksum) & 0xFFFF;

    // In a SNES header the checksum complement is typically stored at offset 0x1C
    // and the checksum at offset 0x1E (relative to the header base).
    this.romdata[headerOffset + 0x1C] = complement & 0xFF;
    this.romdata[headerOffset + 0x1D] = (complement >> 8) & 0xFF;
    this.romdata[headerOffset + 0x1E] = checksum & 0xFF;
    this.romdata[headerOffset + 0x1F] = (checksum >> 8) & 0xFF;

    // Now compute the CRC32 of the entire ROM.
    const crc32 = CRC32.compute(this.romdata);
    debug(`Header updated: Checksum = 0x${checksum.toString(16).toUpperCase()}, Complement = 0x${complement.toString(16).toUpperCase()}, CRC32 = 0x${crc32.toString(16).toUpperCase()}`);
  }

  /**
   * Returns the compiled binary output.
   * @returns {Uint8Array} The compiled binary output.
   */
  getBinaryOutput = (): Uint8Array => {
    return new Uint8Array(this.romdata.slice(0, this.romdata.length));
  }

  /**
   * Reads a file and returns its contents as a Uint8Array or string.
   * @param {string} filePath The path to the file to read.
   * @param {BufferEncoding} [encoding] Optional encoding. If provided, returns a string.
   * @returns {Uint8Array | string} The contents of the file as a Uint8Array or string.
   * @throws {Error} If the file is not found or cannot be read.
   */
  readFile(filePath: string, encoding?: BufferEncoding): Uint8Array | string {
    debug("readFile", filePath, encoding)
    try {
      // Get the directory to resolve from
      let resolveDir: string;

      // Check if we're in a macro expansion and should use the macro's source directory
      if (this.inMacroExpansion && this.currentMacroName) {
        const macroDef = this.macros.get(this.currentMacroName);

        // If the macro has a source file, use its directory, otherwise fall back to current
        if (macroDef?.sourceFile) {
          resolveDir = path.dirname(macroDef.sourceFile);
          debug("readFile using macro source directory:", resolveDir);
        } else {
          resolveDir = this.currentFile ? path.dirname(this.currentFile) : process.cwd();
        }
      } else {
        // Normal file operations - use current file directory
        resolveDir = this.currentFile ? path.dirname(this.currentFile) : process.cwd();
      }

      // Resolve the full path relative to the resolve directory
      const fullPath = path.resolve(resolveDir, filePath);
      debug("readFile:", fullPath);

      if (encoding) {
        // Return as string if encoding is provided
        return fs.readFileSync(fullPath, encoding);
      } else {
        // Return as Uint8Array if no encoding
        const buffer = fs.readFileSync(fullPath);
        return new Uint8Array(buffer);
      }
    } catch (error: unknown) {
      debug("Error reading file:", error);
      throw new Error(`Error reading file: ${filePath}`);
    }
  }

  /**
   * Resolves the path of an included file.
   * @param {string} filename The filename to resolve.
   * @returns {string} The resolved path.
   * @throws {Error} If the file is not found.
   */
  resolveIncludePath = (filename: string): string => {
    debug("resolveIncludePath", filename);
    if (filename == null || filename === undefined) {
      throw new Error("Invalid or missing filename");
    }
    // Strip quotes if present
    if ((filename && filename.startsWith('"') && filename.endsWith('"')) ||
        (filename.startsWith("'") && filename.endsWith("'")) ||
        (filename.startsWith("`") && filename.endsWith("`"))) {
      filename = filename.slice(1, -1);
    }

    // If absolute path, try directly
    if (path.isAbsolute(filename)) {
      debug("resolveIncludePath absolute", filename);
      if (fs.existsSync(filename)) {
        return filename;
      }
    }

    // Try relative to current file
    const currentDir = path.dirname(this.currentFile);
    let tryPath = path.resolve(currentDir, filename);
    debug("resolveIncludePath tryPath", tryPath);
    if (fs.existsSync(tryPath)) {
      return tryPath;
    }

    // Try include paths
    for (const includePath of this.includePaths) {
      tryPath = path.resolve(includePath, filename);
      if (fs.existsSync(tryPath)) {
        return tryPath;
      }
    }

    throw new Error(`Could not find file: ${filename}`);
  }

  /**
   * Handles the include command, adding the current file to the guarded set if once is true.
   * @param {string} command The command to handle.
   * @param {string} filename The filename to include.
   * @param {boolean} once Whether the file should be included once.
   * @throws {Error} If the file is included again while command ===.
   */
  handleInclude = (command: string, filename?: string, once = false): void => {
    debug("handleInclude", command, filename, once);

    if (filename == null || filename === undefined) {
      this.includedFiles.set(undefined as unknown as string, { included: true, guarded: false });
      this.assemblefile(undefined as unknown as string, true);
      return;
    }

    // Mark file as included
    const resolvedPath = this.resolveIncludePath(filename);
    if (!this.includedFiles.has(resolvedPath)) {
      this.includedFiles.set(resolvedPath, { included: true, guarded: false });
    }

    this.assemblefile(filename, true);

    // Add current file to guarded set if once is true
    if (once) {
      debug("handleInclude once", this.currentFile);
      const fileInfo = this.includedFiles.get(this.currentFile) || { included: true, guarded: false };
      fileInfo.guarded = true;
      this.includedFiles.set(this.currentFile, fileInfo);
    }
  }

  /**
   * Assembles a file, handling include guards and recursion limits.
   * @param {string} filename The filename to assemble.
   * @param {boolean} isInclude Whether the file is being included.
   * @throws {Error} If the recursion limit is exceeded or the file is included again.
   */
  assemblefile = (filename: string, isInclude: boolean): void => {
    debug("assemblefile", filename, isInclude);

    const resolvedPath = this.resolveIncludePath(filename);

    // Check for include guards
    const fileInfo = this.includedFiles.get(resolvedPath);
    if (fileInfo?.guarded) {
      debug("assemblefile include guard hit, skipping");
      return;
    }

    // Check for recursion limit
    if (this.includeStack.length >= 512) {
      throw new Error("Recursion limit exceeded (512 levels)");
    }

    // Fail immediately on include cycles so callers get one stable error
    // instead of hundreds of nested "Failed to assemble include" wrappers.
    if (resolvedPath === this.currentFile || this.includeStack.includes(resolvedPath)) {
      throw new Error(`Recursive include detected for '${resolvedPath}'`);
    }

    // Save current state
    const previousFile = this.currentFile;
    this.includeStack.push(previousFile);

    // Includes now execute through the typed pass-program path so include
    // semantics match top-level tree execution. Surface failures to callers so
    // broken includes cannot silently zero-fill large ROM regions.
    try {
      // TODO: Use readFile instead of fs.readFileSync
      const content = fs.readFileSync(resolvedPath, "utf8");
      this.currentFile = resolvedPath;

      // Mark this file as included
      if (!this.includedFiles.has(resolvedPath)) {
        this.includedFiles.set(resolvedPath, { included: true, guarded: false });
      } else {
        const info = this.includedFiles.get(resolvedPath);
        info.included = true;
        this.includedFiles.set(resolvedPath, info);
      }

      const includeNode = this.createIncludeNode(resolvedPath, content);
      for (const node of includeNode.commands) {
        this.executeNode(node);
      }
    } catch (error) {
      debug("assemblefile error 💥", error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to assemble include '${resolvedPath}': ${message}`);
    } finally {
      // Restore state
      this.currentFile = this.includeStack.pop() || "";
    }
  }

  /**
   * Handles character mapping like `"A" = 0x42` and assigns the value to the character in `characterMappings`.
   * @param {NormalizedCommand | string[]} command The normalized command node or legacy words tuple.
   * @throws {Error} If the format is incorrect.
   */
  handleCharacterMapping(command: NormalizedCommand | string[]): void {
    const words = Array.isArray(command) ? command : command.words;
    debug("handleCharacterMapping", words);
    if (words.length !== 3) {
      throw new Error("Character mapping requires format: 'char' = value");
    }
    const char = words[0].replace(/["']/g, "");
    const value = this.operandResolver.getnum(words[2]);
    this.characterMappings.set(char, value);
  }

  /**
   * Processes a string and maps characters to their corresponding values in `characterMappings`.
   * If a character is not found in `characterMappings`, its charCode is used instead.
   * @param {string} input The string to process.
   * @returns {number[]} An array of numbers representing the mapped characters.
   */
  processStringWithMapping(input: string): number[] {
    return Array.from(input).map(char => this.characterMappings.get(char) ?? char.charCodeAt(0));
  }

  /**
   * Begins the collection of loop commands.
   * @param {string} type The type of loop to begin ("for" or "while").
   * @param {string} command The command to begin the loop with.
   */
  beginLoopCollection(type: "for" | "while", command: string): void {
    debug("beginLoopCollection", type, command);
    // Normalize inline loops through the typed node parser/executor path.
    if (type === "for" && command.includes(":")) {
      const inlineCommands = command.split(":").map((entry) => entry.trim()).filter(Boolean);
      const inlineNodes = this.parseCommandStreamToNodes(inlineCommands, this.currentFile, this.currentLine);
      if (this.collectingLoop && this.currentLoop) {
        for (const node of inlineNodes) {
          this.currentLoop.commands.push(node);
        }
      } else {
        this.executeNodeStream(inlineNodes);
      }
      return;
    }

    // Regular non-inline loop
    const header = this.createLoopCommandNode(command);
    // Create a new loop block
    const newLoop: LoopBlock = {
      type,
      header,
      conditionNode: type === "while" ? header.parsed.condition?.expression : header.parsed.forLoop?.range,
      rangeNode: header.parsed.forLoop?.range,
      startExpression: header.parsed.forLoop?.start,
      endExpression: header.parsed.forLoop?.end,
      variable: header.parsed.forLoop?.variable,
      commands: [],
      startLine: this.currentLine
    };

    // Extract variable name for for loops
    if (type === "for") {
      debug("beginLoopCollection for loop", command);
      if (newLoop.startExpression && newLoop.endExpression) {
        debug("beginLoopCollection for loop parsed", newLoop);

        // Pre-parse start and end (optional, can be done during execution)
        try {
          const startExpr = renderExpressionNode(newLoop.startExpression);
          const endExpr = renderExpressionNode(newLoop.endExpression);
          debug("beginLoopCollection for loop start", startExpr);
          debug("beginLoopCollection for loop end", endExpr);

          // Check if expressions are simple numeric values
          if (/^-?\d+$/.test(startExpr)) {
            newLoop.start = Number.parseInt(startExpr, 10);
          } else {
            newLoop.start = this.operandResolver.getnum(this.resolvedefines(startExpr));
          }

          if (/^-?\d+$/.test(endExpr)) {
            newLoop.end = Number.parseInt(endExpr, 10);
          } else {
            newLoop.end = this.operandResolver.getnum(this.resolvedefines(endExpr));
          }
        } catch (e) {
          /* c8 ignore next 3 */
          // We'll parse these again during execution, so errors here are non-fatal
          debug("Could not pre-parse for loop range:", e);
        }
      }
    }

    // If we're already collecting a loop, nest this one inside the current one
    if (this.collectingLoop && this.currentLoop) {
      this.currentLoop.commands.push(newLoop);
      this.loopStack.push(this.currentLoop);
    }

    this.currentLoop = newLoop;
    this.collectingLoop = true;
    this.loopNestingLevel++;
  }

  /**
   * Ends the collection of loop commands and executes the loop.
   * @param {string} type The type of loop to end ("for" or "while").
   */
  endLoopCollection(type: "for" | "while"): void {
    if (!this.collectingLoop || !this.currentLoop) {
      debug(`endLoopCollection unexpected end${type} without matching ${type}`);
      return;
    }

    if (this.currentLoop.type !== type) {
      debug(`endLoopCollection mismatched loop types: expected end${this.currentLoop.type}, got end${type}`);
      return;
    }

    // Set the end line for this loop block
    this.currentLoop.endLine = this.currentLine;

    // If we have a parent loop in the stack, pop back to it
    if (this.loopStack.length > 0) {
      // Save a reference to the finished loop before switching to parent
      // No need to store it since we'll reference it from the parent's commands
      this.currentLoop = this.loopStack.pop() || null;

      // We don't execute the nested loop right away - it will be executed
      // when its parent loop is executed
    } else {
      // No parent loop - execute this complete loop
      const loopToExecute = this.currentLoop;
      this.currentLoop = null;
      this.collectingLoop = false;

      // Execute the complete top-level loop
      this.executeLoopBlock(loopToExecute);
    }

    this.loopNestingLevel--;
  }

  /**
   * Executes a complete loop block with all its nested commands.
   * @param {LoopBlock} loopBlock The loop block to execute.
   */
  executeLoopBlock(loopBlock: LoopBlock): void {
    debug("executeLoopBlock", loopBlock);
    if (loopBlock.type === "for") {
      this.executeForLoop(loopBlock);
    } else if (loopBlock.type === "while") {
      this.executeWhileLoop(loopBlock);
    }
  }

  /**
   * Executes a for loop block.
   * @param {LoopBlock} forBlock The for loop block to execute.
   */
  executeForLoop(forBlock: LoopBlock): void {
    debug("executeForLoop", forBlock);
    const parsedForLoop = forBlock.header?.parsed.forLoop;
    const variable = forBlock.variable ?? parsedForLoop?.variable;
    let start: number | undefined = forBlock.start;
    let end: number | undefined = forBlock.end;

    const startExpression = forBlock.startExpression ?? parsedForLoop?.start;
    const endExpression = forBlock.endExpression ?? parsedForLoop?.end;
    if (startExpression && endExpression) {
      const startExpr = renderExpressionNode(startExpression);
      const endExpr = renderExpressionNode(endExpression);
      const startDefinesResolved = /^-?\d+$/.test(startExpr) ? startExpr : this.resolvedefines(startExpr);
      const endDefinesResolved = /^-?\d+$/.test(endExpr) ? endExpr : this.resolvedefines(endExpr);
      start = this.operandResolver.getnum(startDefinesResolved);
      end = this.operandResolver.getnum(endDefinesResolved);
    }

    if (!variable || start === undefined || end === undefined) {
      debug("executeForLoop missing loop semantics:", forBlock);
      return;
    }

    // Save the original variable value before we modify it
    const originalValue = this.defines.get(variable);

    // Only process the loop if start < end
    if (start < end) {
      // Loop through the range and process commands for each iteration
      for (let i = start; i < end; i++) {
        // Set our loop counter directly in defines map
        this.defines.set(variable, i.toString());

        // Process each command in the loop body
        for (const cmd of forBlock.commands) {
          this.executeNode(cmd);
        }
      }
    }

    // Restore the original variable value or delete if it didn't exist
    if (originalValue !== undefined) {
      this.defines.set(variable, originalValue);
    } else {
      this.defines.delete(variable);
    }
  }

  /**
   * Executes a while loop block.
   * @param {LoopBlock} whileBlock The while loop block to execute.
   */
  executeWhileLoop(whileBlock: LoopBlock): void {
    debug("executeWhileLoop", whileBlock);
    const conditionNode = whileBlock.conditionNode ?? whileBlock.header?.parsed.condition?.expression;
    if (!conditionNode) {
      debug("executeWhileLoop missing condition expression", whileBlock);
      return;
    }

    let iteration = 0;
    const MAX_ITERATIONS = 10000; // Safety limit to prevent infinite loops

    // Track variables modified in the loop body
    const loopVars = new Set<string>();
    const originalValues = new Map<string, string | undefined>();

    // Continue looping as long as the condition evaluates to true
    while (this.evaluateExpression(conditionNode) && iteration < MAX_ITERATIONS) {
      // Process each command in the loop body
      for (const cmd of whileBlock.commands) {
        let defineTarget: string | null = null;
        if ("source" in cmd && cmd.kind === "defineCommand") {
          defineTarget = getDefineVariable(cmd.command);
        }
        if (defineTarget && !loopVars.has(defineTarget)) {
          loopVars.add(defineTarget);
          originalValues.set(defineTarget, this.defines.get(defineTarget));
        }
        this.executeNode(cmd);
      }

      iteration++;
    }

    if (iteration >= MAX_ITERATIONS) {
      debug("executeWhileLoop while loop exceeded maximum iteration limit. Possible infinite loop detected.");
    }

    // Restore original variable values
    for (const [varName, value] of originalValues.entries()) {
      if (value !== undefined) {
        debug(`executeWhileLoop setting ${varName} to ${value}`);
        this.defines.set(varName, value);
      } else {
        debug(`executeWhileLoop delete entry for ${varName}`);
        this.defines.delete(varName);
      }
    }
  }

  createLoopCommandNode(command: string, sourceFile = this.currentFile, sourceLine = this.currentLine): NormalizedCommand {
    const normalized = this.preDispatchPipelineService.normalizeCommand(command);
    const words = splitCommandIntoWords(normalized);
    return createNormalizedCommand(command, normalized, words, sourceFile, sourceLine);
  }

  lowerNode(command: NormalizedCommand): LoweredCommand {
    const keyword = command.keyword.toLowerCase();

    if (this.directiveRegistry.has(keyword)) {
      let directiveWords = command.words;
      if (command.parsed.includeTarget) {
        directiveWords = [command.parsed.includeTarget.directive, command.parsed.includeTarget.target];
      } else if (keyword === "incbin" && command.parsed.directiveArgs?.args?.length) {
        directiveWords = [keyword, ...command.parsed.directiveArgs.args];
      }

      return {
        kind: "directive",
        keyword,
        words: directiveWords,
        source: command.source,
      };
    }

    const architecture = this.resolveActiveArchitecture();
    const isaLoweredInstruction = architecture.definition?.encoder.lowerInstructionFromCommand?.(command);
    if (isaLoweredInstruction) {
      return isaLoweredInstruction;
    }

    const parsedOperands = command.parsed.opcodeOperands;
    const mnemonic = parsedOperands?.mnemonic ?? command.keyword;
    const operandText = parsedOperands?.operandText ?? command.words.slice(1).join(" ");
    const operands = parsedOperands?.operands ?? (operandText ? [operandText] : []);
    const loweredOperands = operands.map((operand) => this.classifyOperandForActiveArchitecture(operand));
    const loweredOperand = this.classifyOperandForActiveArchitecture(operandText);

    return {
      kind: "instruction",
      mnemonic,
      operandText,
      operands,
      loweredOperands,
      loweredOperand,
      words: command.words,
      sourceFile: command.source.file,
      sourceLine: command.source.line,
      sourceRaw: command.source.raw,
    };
  }

  executeNode(node: ExecutableNode): void {
    if ("source" in node) {
      this.processNormalizedCommand(node);
      return;
    }

    if (node.type === "for" || node.type === "while") {
      this.executeLoopBlock(node);
      return;
    }

    if (node.type === "if") {
      this.executeConditionalNode(node);
      return;
    }
  }

  executeNodeStream(nodes: RuntimeNode[]): void {
    for (const node of nodes) {
      this.executeNode(node);
    }
  }

  executeConditionalNode(node: RuntimeConditionalNode): void {
    for (const branch of node.branches) {
      if (branch.kind === "else") {
        for (const child of branch.commands) {
          this.executeNode(child);
        }
        return;
      }
      if (!branch.conditionNode) {
        continue;
      }
      let branchConditionMatched = false;
      this.requireStaticLabelLookup = true;
      try {
        // Match legacy `if` / `elseif` behavior: condition labels must resolve as
        // static and any failure should be wrapped by evaluateExpression.
        branchConditionMatched = this.evaluateExpression(branch.conditionNode);
      } finally {
        this.requireStaticLabelLookup = false;
      }
      if (branchConditionMatched) {
        for (const child of branch.commands) {
          this.executeNode(child);
        }
        return;
      }
    }
  }

  parseCommandStreamToNodes(commands: string[], sourceFile = this.currentFile, startLine = this.currentLine): RuntimeNode[] {
    const roots: RuntimeNode[] = [];
    const loopStack: LoopNode[] = [];
    const ifStack: RuntimeConditionalNode[] = [];
    const branchStack: ConditionalBranch[] = [];
    let inMacroDefinition = false;

    const pushToCurrent = (node: RuntimeNode): void => {
      const currentBranch = branchStack[branchStack.length - 1];
      const currentLoop = loopStack[loopStack.length - 1];
      if (currentBranch && currentLoop) {
        // Route to the most recently opened container so loop bodies nested in
        // conditionals (and vice-versa) keep their intended structure.
        if (currentLoop.startLine >= currentBranch.startLine) {
          currentLoop.commands.push(node);
        } else {
          currentBranch.commands.push(node);
        }
        return;
      }
      if (currentBranch) {
        currentBranch.commands.push(node);
        return;
      }
      if (currentLoop) {
        currentLoop.commands.push(node);
        return;
      }
      roots.push(node);
    };

    for (let index = 0; index < commands.length; index++) {
      const rawCommand = commands[index];
      const command = this.createLoopCommandNode(rawCommand, sourceFile, startLine + index);
      const keyword = command.keyword.toLowerCase();

      if (keyword === "macro") {
        // Macro bodies are consumed later by macro-definition handling. Keep the
        // raw command stream intact here so body semantics are deferred until
        // expansion time, matching legacy line-by-line behavior.
        inMacroDefinition = true;
        pushToCurrent(command);
        continue;
      }

      if (inMacroDefinition) {
        pushToCurrent(command);
        if (keyword === "endmacro") {
          inMacroDefinition = false;
        }
        continue;
      }

      if (keyword === "for" || keyword === "while") {
        const loopNode: LoopNode = {
          type: keyword,
          header: command,
          conditionNode: keyword === "while" ? command.parsed.condition?.expression : command.parsed.forLoop?.range,
          variable: command.parsed.forLoop?.variable,
          rangeNode: command.parsed.forLoop?.range,
          startExpression: command.parsed.forLoop?.start,
          endExpression: command.parsed.forLoop?.end,
          commands: [],
          startLine: command.source.line,
        };
        pushToCurrent(loopNode);
        loopStack.push(loopNode);
        continue;
      }

      if (keyword === "endfor" || keyword === "endwhile") {
        const loopNode = loopStack.pop();
        if (loopNode) {
          loopNode.endLine = command.source.line;
        }
        continue;
      }

      if (keyword === "if") {
        const branch: ConditionalBranch = {
          kind: "if",
          header: command,
          conditionNode: command.parsed.condition?.expression,
          commands: [],
          startLine: command.source.line,
        };
        const conditionalNode: RuntimeConditionalNode = {
          type: "if",
          header: command,
          branches: [branch],
          startLine: command.source.line,
        };
        pushToCurrent(conditionalNode);
        ifStack.push(conditionalNode);
        branchStack.push(branch);
        continue;
      }

      if (keyword === "elseif" || keyword === "else") {
        const currentIf = ifStack[ifStack.length - 1];
        if (!currentIf) {
          pushToCurrent(command);
          continue;
        }
        if (branchStack.length > 0) {
          const closedBranch = branchStack.pop();
          if (closedBranch) {
            closedBranch.endLine = command.source.line;
          }
        }
        const branch: ConditionalBranch = {
          kind: keyword,
          header: command,
          conditionNode: keyword === "elseif" ? command.parsed.condition?.expression : undefined,
          commands: [],
          startLine: command.source.line,
        };
        currentIf.branches.push(branch);
        branchStack.push(branch);
        continue;
      }

      if (keyword === "endif") {
        const currentIf = ifStack[ifStack.length - 1];
        const currentLoop = loopStack[loopStack.length - 1];
        const whileIsInnermost = shouldEndifCloseInnermostWhile(
          currentLoop?.type,
          currentLoop?.startLine,
          currentIf?.startLine,
        );

        // Asar-compatible quirk: `endif` can terminate either an `if` chain or a
        // `while` block. Resolve ambiguity by closing the most recently opened
        // structural block so tree parsing mirrors line-by-line behavior.
        if (whileIsInnermost) {
          const loopNode = loopStack.pop();
          if (loopNode) {
            loopNode.endLine = command.source.line;
          }
          continue;
        }

        if (branchStack.length > 0) {
          const closedBranch = branchStack.pop();
          if (closedBranch) {
            closedBranch.endLine = command.source.line;
          }
        }
        if (currentIf) {
          ifStack.pop();
          currentIf.endLine = command.source.line;
        }
        continue;
      }

      pushToCurrent(command);
    }

    return roots;
  }

  getOrBuildPassProgram(commands: string[], sourceFile = this.currentFile, startLine = this.currentLine): RuntimeNode[] {
    const cacheKey = `${sourceFile}::${startLine}::${commands.join("\n")}`;
    const cached = this.passProgramCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const nodes = this.parseCommandStreamToNodes(commands, sourceFile, startLine);
    this.passProgramCache.set(cacheKey, nodes);
    return nodes;
  }

  getMacroDefinitionNode(name: string): MacroDefinitionNode | undefined {
    const macro = this.macros.get(name);
    if (!macro) {
      return undefined;
    }
    const body: ExecutableNode[] = macro.body.map((entry) => entry);
    return {
      type: "macroDefinition",
      name: macro.name,
      params: [...macro.params],
      variadic: macro.variadic,
      body,
      sourceFile: macro.sourceFile,
    };
  }

  createIncludeNode(file: string, source: string): IncludeNode {
    const commands = splitInlineCommands(this.preprocessBlockCommands(source));
    const nodes = this.getOrBuildPassProgram(commands, file, 0);
    return {
      type: "include",
      file,
      commands: nodes,
    };
  }
}

