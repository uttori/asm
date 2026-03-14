import { Arch65816 } from "./Arch65816.js";
import { ArchSPC700 } from "./ArchSPC700.js";
import { ArchSuperFX } from "./ArchSuperFX.js";
import type { ArchitectureContext, ExpressionHost, Spc700Context, SuperFXContext } from "./architecture-types.js";
import { AddressToLineMapping } from "./addr2line.js";
import type { LoopNode } from "./ir/assembly-tree.js";
import { type ExpressionNode } from "./ir/expression-node.js";
import type { NormalizedCommand } from "./ir/normalized-command.js";
import { MathCore } from "./mathcore.js";
import { OperandResolver } from "./operand-resolver.js";
import type { AssemblySession } from "./directives/types.js";
/** Represents a macro definition. */
export type MacroDefinition = {
    /** The name of the macro. */
    name: string;
    /** Fixed parameter names. */
    params: string[];
    /** Whether the macro has a variable number of parameters. */
    variadic: boolean;
    /** Lines of code. */
    body: string[];
    /** The file where this macro was defined. */
    sourceFile?: string;
};
export type LoopBlock = LoopNode;
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
    snespos: number;
    startpos: number;
    realsnespos: number;
    realstartpos: number;
};
type SpcblockType = "nspc" | "custom";
type SpcblockData = {
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
export declare class Assembler implements AssemblySession {
    snespos: number;
    realsnespos: number;
    startpos: number;
    realstartpos: number;
    bytes: number;
    pushBaseStack: number[];
    /** Possible values: lorom, hirom, exlorom, exhirom, sa1rom, sfxrom, bigsa1rom, norom */
    mapper: string;
    /** Disabled after `norom` to match Asar checksum behavior. */
    checksumFixEnabled: boolean;
    /** Header checksum algorithm mode: "asar" (default) or "simple". */
    checksumMode: "asar" | "simple";
    /** Bank crossing policy controlled by `check bankcross ...`. */
    bankCrossCheckMode: "off" | "full" | "half";
    /** Read* functions are enabled when patch-style title check is active. */
    readFunctionsEnabled: boolean;
    /** Controls direct-page shortening for 65816 when no explicit length is given. */
    optimizeDirectPage: boolean;
    sa1banks: number[];
    /** Placeholder for ROM */
    romdata: number[] | Uint8Array;
    default_freespacebyte: number;
    activeFreespaceStartPc: number | null;
    activeFreespaceContentStartPc: number | null;
    pass: number;
    numif: number;
    numtrue: number;
    whileStatus: WhileTracker[];
    condStack: {
        type: "if" | "while";
        cond: boolean;
        start?: number;
        expr?: string;
        branchTaken?: boolean;
        conditionStr?: string;
    }[];
    namespaceStack: string[];
    currentNamespace: string;
    namespaceNestingEnabled: boolean;
    namespaceNestingPath: string[];
    inMacroDefinition: boolean;
    currentMacroName: string;
    currentMacroParams: string[];
    currentMacroBody: string[];
    currentVariadicCount: number | undefined;
    currentVariadicArgs: string[];
    macros: Map<string, MacroDefinition>;
    mathCore: MathCore;
    operandResolver: OperandResolver;
    moreonlinecond: boolean;
    addressToLineMapping: AddressToLineMapping;
    currentFile: string;
    currentLine: number;
    defines: Map<string, string>;
    characterMappings: Map<string, number>;
    currentTable: string | null;
    tableStack: Map<string, number>[];
    inFunctionDefinition: boolean;
    functionDefinitionLines: string[];
    arch65816: Arch65816;
    archSPC700: ArchSPC700;
    archSuperFX: ArchSuperFX;
    arch: string;
    pushpcStack: PushPcStackEntry[];
    pushpcnum: number;
    labelTable: Map<string, LabelEntry>;
    /** Track multiple `+` labels */
    forwardLabels: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
        }[];
    };
    /** Track multiple `-` labels */
    backwardLabels: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
        }[];
    };
    padUnit: number;
    padbyte: number[];
    structs: Map<string, StructDefinition>;
    currentStruct: StructDefinition | null;
    savedPCStack: number[];
    /** Initialize fill pattern */
    fillbyte: number[];
    targetRom: number[] | Uint8Array;
    static crcTable: number[] | null;
    includedFiles: Map<string, IncludedFileInfo>;
    includeStack: string[];
    includePaths: string[];
    commandBuffer: string;
    loopStack: LoopBlock[];
    currentLoop: LoopBlock | null;
    collectingLoop: boolean;
    loopNestingLevel: number;
    macroLabelInstance: number;
    inMacroExpansion: boolean;
    currentParentLabel: string;
    currentParentIsGlobal: boolean;
    inSpcblock: boolean;
    spcblockData: SpcblockData | null;
    spcInlineCompatMode: boolean;
    requireStaticLabelLookup: boolean;
    private readonly directiveRegistry;
    private readonly cursorAddress;
    private readonly services;
    private get commandPipelineService();
    private get defineEngine();
    private get frontEndCommandService();
    private get macroEngine();
    private get preDispatchPipelineService();
    private get symbolScope();
    private get romWriter();
    private get structEngine();
    get currentAddress(): number;
    get directPageOptimizationEnabled(): boolean;
    recordCurrentAddress(): void;
    setWritePosition(address: number): void;
    syncWriteStarts(): void;
    incrementBytesWritten(num: number): void;
    processNestedCommand(command: string): void;
    loadTestRomData(): void;
    private createCursorAddressFacade;
    private createDefineHost;
    private createFrontEndCommandHost;
    private createPreDispatchPipelineHost;
    private createCommandPipelineHost;
    private createStructHost;
    private createMacroEngineHost;
    private createSymbolScopeHost;
    private createRomWriterHost;
    private createServices;
    constructor(targetRom?: number[] | Uint8Array);
    /**
     * Sets ROM header checksum calculation mode.
     * @param {"asar" | "simple"} mode The checksum mode to use.
     */
    setChecksumMode(mode: "asar" | "simple"): void;
    readLittleEndian(bytes: Uint8Array, pos: number, width: number): number | undefined;
    resolveReadablePath(filename: string): string | undefined;
    hasLabelInScope(identifier: string): boolean;
    getCurrentTargetAddress(): number;
    getCurrentTargetBaseAddress(): number;
    evaluateMath(input: string): number;
    convertTargetAddressToRomOffset(address: number): number;
    convertRomOffsetToTargetAddress(offset: number): number;
    private resolveExpressionHostLabel;
    getExpressionObjectSize(identifier: string, baseOnly?: boolean): number;
    private lookupDefineValue;
    canReadTargetRom(position: number, size: number): number;
    readTargetRom(position: number, size: number, defaultValue?: number): number;
    canReadExpressionFile(filename: string, position: number, size: number): number;
    readExpressionFile(filename: string, position: number, size: number, defaultValue?: number): number;
    create65816Context(): ArchitectureContext;
    createSPC700Context(): Spc700Context;
    createSuperFXContext(): SuperFXContext;
    readonly expressionHost: ExpressionHost;
    /**
     * Advances memory position while handling bank crossing.
     * @param {number} num The number of bytes to advance.
     */
    step(num: number): void;
    /**
     * Writes a single byte to ROM.
     * @param {number} num - The byte to write.
     */
    write1_65816(num: number): void;
    /**
     * Fills a section of ROM data with a value.
     * @param {number} start The starting address.
     * @param {number} value The value to fill with.
     * @param {number} length The length of the section to fill.
     */
    fillRomData(start: number, value: number, length: number): void;
    /**
     * Picks the appropriate instruction handler based on architecture.
     * @param {string[]} words The words to pick.
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    asblock_pick(words: string[]): boolean;
    private getActiveArchitectureEncoder;
    findNextRelativeLabel(reference: string, fromAddress: number): number;
    findPreviousRelativeLabel(reference: string, fromAddress: number): number;
    /**
     * Writes 1, 2, 3, or 4 bytes to ROM.
     * @param {number} num - The byte to write.
     */
    write1(num: number): void;
    emitByte(num: number): void;
    write2(num: number): void;
    emitWord(num: number): void;
    write3(num: number): void;
    emitLong(num: number): void;
    write4(num: number): void;
    /**
     * Validates `check bankcross` constraints for a multi-byte write.
     * @param {number} length The number of bytes that will be written.
     */
    assertBankCrossAllowed(length: number): void;
    /**
     * Reads 1, 2, or 3 bytes from ROM.
     * @param {number} insnespos - The SNES address to read from.
     * @returns {number} The byte read from ROM.
     */
    read1(insnespos: number): number;
    read2(insnespos: number): number;
    read3(insnespos: number): number;
    assembleblock(block: string): void;
    removeInlineComment(line: string): string;
    /**
     * Processes a single command from `assembleblock`.
     * @param {string} command - The command to process.
     */
    processCommand(command: string): void;
    handlePushBase(): void;
    /**
     * Saves the current character mapping table.
     */
    handlePushTable(): void;
    /**
     * Restores the previously saved character mapping table.
     */
    handlePullTable(): void;
    /**
     * Minimal FREECODE/FREESPACE support used by active tests.
     * Allocates a block at/after current ROM end, emits a placeholder RATS tag, then positions assembly after it.
     * @param {string} type - Directive keyword.
     * @param {string[]} _params - Directive parameters.
     */
    handleFreespace(type: string, _params: string[]): void;
    /**
     * Sets default freespace fill byte.
     * @param {string[]} params - FREESPACEBYTE arguments.
     */
    handleFreespaceByte(params: string[]): void;
    /**
     * Minimal PROT support used by active tests.
     * Emits PROT table with 24-bit addresses and STOP marker.
     * @param {string[]} words - Label list arguments.
     */
    handleProt(words: string[]): void;
    handlePullBase(): void;
    handleSpcblock(words: string[]): void;
    handleEndSpcblock(words: string[]): void;
    handleStartpos(params: string[]): void;
    /**
     * Handles the ARCH command.
     * @param {string[]} words - The words from the ARCH command.
     * @throws {Error} If the ARCH command requires an architecture parameter.
     */
    handleArch(words: string[]): void;
    /**
     * Parses a function definition of the form:
     *   function name(param1, param2...) = expression
     * Possibly spanning multiple lines joined by backslashes.
     * @param {string} defLine - The function definition line.
     */
    parseFunctionDefinition(defLine: string): void;
    /**
     * Expands and calls a macro invocation.
     * The invocation is expected to be in the form:
     *   macroName(arg1, arg2, ...)
     * @param {string} invocation The macro invocation to expand and call.
     */
    callMacro(invocation: string): void;
    /**
     * Expands a macro line by substituting fixed parameters (<param>) and variadic parameters (<...[expr]>),
     * then resolves any remaining defines.
     * @param {string} line The macro line to expand.
     * @param {Map<string, string>} fixedArgs A map of fixed parameters to their values.
     * @param {string[]} variadicArgs An array of variadic arguments.
     * @param {number} variadicCount The number of variadic arguments.
     * @returns {string} The expanded macro line.
     */
    expandMacroLine(line: string, fixedArgs: Map<string, string>, variadicArgs: string[], variadicCount: number): string;
    /**
     * Handles define commands.
     * Example:
     * @example
     * !identifier = value // Basic assignment
     * !identifier += value // Append to existing value
     * !identifier := value // Resolve defines in the value
     * !identifier #= value // Evaluate as math expression
     * !identifier ?= value // Only assign if not already defined
     * @param {string} command The define command to handle.
     */
    handleDefineCommand(command: string): void;
    /**
     * Resolves variadic placeholders in already-expanded macro lines.
     * This is needed for loop bodies where <...[expr]> must be re-evaluated each iteration.
     * @param {string} command The command line to resolve.
     * @returns {string} `command` with variadic placeholders resolved.
     */
    resolveVariadicPlaceholders(command: string): string;
    /**
     * Handles undef commands.
     * Example:
     * @example
     * undef "identifier"
     * undef identifier
     * @param {string[]} params The undef parameters.
     */
    handleUndef(params: string[]): void;
    /**
     * Processes nested defines in a string, properly handling the !{...} syntax
     * by immediately resolving the content inside braces.
     * @param {string} content The content with nested defines to process
     * @returns {string} The resolved identifier
     */
    processNestedDefines(content: string): string;
    /**
     * Helper method to resolve one level of defines in a string.
     * @param {string} content The content to process
     * @returns {string} The processed content with one level of defines resolved
     */
    resolveOneLevelOfDefines(content: string): string;
    /**
     * Helper method to resolve regular !defines (non-braced)
     * @param {string} content The content to process
     * @returns {string} The processed content with regular defines resolved
     */
    resolveRegularDefines(content: string): string;
    /**
     * Resolves !define references inside db string literals, honoring escaped exclamation marks.
     * @param {string} content The unquoted string literal content.
     * @returns {string} The string with defines expanded.
     */
    resolveDefinesInStringLiteral(content: string): string;
    /**
     * Processes a define value string, resolving any !{...} expressions it contains.
     * @param {string} value The value string potentially containing braced defines
     * @returns {string} The processed value with all braced defines resolved
     */
    processValueWithBracedDefines(value: string): string;
    /**
     * Handles `+` and `-` relative labels correctly using SNES memory position.
     * @param {string} label The label to handle.
     * @returns {number} The address of the label.
     */
    handleRelativeLabel(label: string): number;
    /**
     * Finds the next occurrence of a `+` label based on SNES memory position.
     * @param {string} label The label to find.
     * @param currentAddressOverride
     * @returns {number} The address of the next label.
     */
    findNextLabel(label: string, currentAddressOverride?: number): number;
    /**
     * Finds the previous occurrence of a `-` label based on SNES memory position.
     * @param {string} label The label to find.
     * @param currentAddressOverride
     * @returns {number} The address of the previous label.
     */
    findPreviousLabel(label: string, currentAddressOverride?: number): number;
    /**
     * Handles setting a label in the assembler.
     * @param {string} label The label to set.
     * @param {number} value The value to set the label to.
     * @param {boolean} isStatic Whether the label is static.
     * @param {boolean} isMacroLabel Whether this is a macro label.
     * @param {boolean} isGlobal Whether this is a global label.
     * @param {boolean} modifiesHierarchy Whether this label affects the sublabel hierarchy.
     */
    setLabel(label: string, value?: number, isStatic?: boolean, isMacroLabel?: boolean, isGlobal?: boolean, modifiesHierarchy?: boolean): void;
    /**
     * Resolves a compound struct member id (e.g. TestStruct.count, TestStruct[0].count, TestStruct.NewStruct.new).
     * @param compoundId e.g. "TestStruct.count", "TestStruct[0].count", "TestStruct.NewStruct.new"
     * @returns {number} The offset or address (base + index*size + memberOffset for indexed).
     */
    resolveStructMember(compoundId: string): number;
    /**
     * Retrieves the address of a stored label.
     * @param {string} label The label to retrieve the value of.
     * @param {boolean} requireStatic Whether the label must be static.
     * @returns {number} The value of the label.
     */
    getLabelValue(label: string, requireStatic: boolean): number;
    /**
     * Direct label lookup without namespace resolution.
     * @param {string} label The fully qualified label to look up.
     * @param {boolean} requireStatic Whether the label must be static.
     * @returns {number} The label's value.
     */
    getLabelValueDirect(label: string, requireStatic: boolean): number;
    /**
     * Handles `for` loops.
     * @param {string[]} condition - The condition for the loop.
     */
    handleFor(condition: string[]): void;
    /**
     * Handles the end of a `for` loop.
     */
    handleEndFor(): void;
    /**
     * Adds a mapping of the current address to the source line number.
     * @param {number} address The SNES address to add to the mapping.
     */
    addAddressToLine(address: number): void;
    /**
     * Handles `if` statements.
     * @param {string[]} condition The condition for the if statement.
     */
    handleIf(condition: string[]): void;
    /**
     * Handles `elseif` statements.
     * @param {string[]} condition The condition for the elseif statement.
     */
    handleElseIf(condition: string[]): void;
    /**
     * Handles `else` statements.
     */
    handleElse(): void;
    /**
     * Handles the end of an `if` statement (or `while`, since asar uses endif for both).
     */
    handleEndIf(): void;
    /**
     * Handles `while` loops.
     * @param {string[]} condition - The condition for the loop.
     */
    handleWhile(condition: string[]): void;
    /**
     * Handles the end of a `while` loop.
     */
    handleEndWhile(): void;
    /**
     * Handles `org` directive to set SNES memory location.
     * @param {string[]} params - The parameters for the org directive.
     */
    handleOrg(params: string[]): void;
    /**
     * Handles `db`, `dw`, `dl`, `dd` directives for defining data.
     * @param {string} type - The type of data directive.
     * @param {string[]} params - The parameters for the data directive.
     */
    handleDataDirective(type: string, params: string[]): void;
    /**
     * Writes data of the specified length.
     * @param {number} len The length of the data to write.
     * @param {number} value The value to write.
     */
    writeDataByLength(len: number, value: number): void;
    /**
     * Pushes the current namespace.
     */
    handlePushNamespace(): void;
    /**
     * Restores the previous namespace.
     */
    handlePullNamespace(): void;
    /**
     * Handles `namespace` definitions.
     * @param {string[]} params - The parameters for the namespace directive.
     */
    handleNamespace(params: string[]): void;
    /**
     * Pushes the current PC onto the pushpcStack.
     */
    handlePushPC(): void;
    /**
     * Restores the previous PC.
     */
    handlePullPC(): void;
    /**
     * Handles `struct` definitions.
     * @param {string[]} words The parameters for the struct directive.
     */
    handleStruct(words: string[]): void;
    /**
     * Handles the end of a struct definition.
     * @param {string[]} words The parameters for the endstruct directive.
     */
    handleEndStruct(words: string[]): void;
    /**
     * Resolves a struct label reference to its base address.
     * @param {string} labelRef The label reference to resolve.
     * @returns {number} The resolved base address.
     */
    resolveStructLabel(labelRef: string): number;
    /**
     * Evaluates a range expression and returns the result.
     * @param {string} expr The expression to evaluate.
     * @returns {number} The result of the expression.
     */
    evaluateRangeExpression(expr: string | ExpressionNode): number;
    /**
     * Handles the `incbin` directive.
     * @param {string[]} words The words from the `incbin` directive.
     */
    handleIncbin(words: string[]): void;
    /**
     * Sets the paths to search for included files.
     * @param {string[]} paths The paths to search for included files.
     */
    setIncludePaths(paths: string[]): void;
    /**
     * Evaluates an expression for conditionals (if, while).
     * @param {string} expression - The expression to evaluate.
     * @returns {boolean} True if the expression is true, false otherwise.
     */
    evaluateExpression(expression: string | ExpressionNode): boolean;
    private resolveExpressionInput;
    private resolveExpressionNode;
    private resolveReferenceExpressionNode;
    private evaluateReferenceExpressionNode;
    private resolveReferenceLabelValue;
    private normalizeReferenceExpressionNode;
    /**
     * Resolves all define replacements in a given string.
     * @param {string} input The string to resolve defines in.
     * @returns {string} The string with defines resolved.
     */
    resolvedefines(input: string): string;
    /**
     * Sets the current pass of assembly.
     * @param {number} pass - The pass number to set.
     */
    setPass(pass: number): void;
    /**
     * Completes the current pass, performing any necessary cleanup.
     */
    finishPass(): void;
    /**
     * Sets the current file being processed.
     * @param {string} filename - The filename to set.
     */
    setCurrentFile(filename: string): void;
    /**
     * Sets the current line number.
     * @param {number} line - The line number to set.
     */
    setCurrentLine(line: number): void;
    /**
     * Writes a block of data to ROM.
     * @param {number} start The starting address of the block to write.
     * @param {number} value The byte value to write.
     * @param {number} [length] The length of the block to write.
     */
    writeDataBytes(start: number, value: number, length?: number): void;
    /**
     * Expands ROM size and fills it with a specified byte.
     * @param {number} newSize The new size of the ROM.
     * @param {number} fsByte The byte value to fill the ROM with.
     */
    expandRom(newSize: number, fsByte: number): void;
    /**
     * Checks if a given ROM region is empty.
     * @param {number} start - The starting address of the region to check.
     * @param {number} size - The size of the region to check.
     * @param {number} fsByte - The byte value to check for.
     * @returns {boolean} True if the region is empty, false otherwise.
     */
    isBlockEmpty(start: number, size: number, fsByte: number): boolean;
    /**
     * Gets the size of a struct or extension.
     * @param {string} identifier The identifier of the struct or extension.
     * @param {boolean} [baseOnly] If true, returns only the base size without extensions.
     * @returns {number} The size of the struct or extension.
     * @throws {Error} If the struct or extension doesn't exist.
     */
    getObjectSize(identifier: string, baseOnly?: boolean): number;
    /**
     * Updates the header checksum (16-bit) and CRC32.
     * For LoROM, the header is at 0x7FC0; for HiROM (and exhirom) at 0xFFC0.
     */
    updateHeaderAndCRC32(): void;
    /**
     * Returns the compiled binary output.
     * @returns {Uint8Array} The compiled binary output.
     */
    getBinaryOutput: () => Uint8Array;
    /**
     * Reads a file and returns its contents as a Uint8Array or string.
     * @param {string} filePath The path to the file to read.
     * @param {BufferEncoding} [encoding] Optional encoding. If provided, returns a string.
     * @returns {Uint8Array | string} The contents of the file as a Uint8Array or string.
     * @throws {Error} If the file is not found or cannot be read.
     */
    readFile(filePath: string, encoding?: BufferEncoding): Uint8Array | string;
    /**
     * Resolves the path of an included file.
     * @param {string} filename The filename to resolve.
     * @returns {string} The resolved path.
     * @throws {Error} If the file is not found.
     */
    resolveIncludePath: (filename: string) => string;
    /**
     * Handles the include command, adding the current file to the guarded set if once is true.
     * @param {string} command The command to handle.
     * @param {string} filename The filename to include.
     * @param {boolean} once Whether the file should be included once.
     * @throws {Error} If the file is included again while command ===.
     */
    handleInclude: (command: string, filename?: string, once?: boolean) => void;
    /**
     * Assembles a file, handling include guards and recursion limits.
     * @param {string} filename The filename to assemble.
     * @param {boolean} isInclude Whether the file is being included.
     * @throws {Error} If the recursion limit is exceeded or the file is included again.
     */
    assemblefile: (filename: string, isInclude: boolean) => void;
    /**
     * Handles character mapping like `"A" = 0x42` and assigns the value to the character in `characterMappings`.
     * @param {NormalizedCommand | string[]} command The normalized command node or legacy words tuple.
     * @throws {Error} If the format is incorrect.
     */
    handleCharacterMapping(command: NormalizedCommand | string[]): void;
    /**
     * Processes a string and maps characters to their corresponding values in `characterMappings`.
     * If a character is not found in `characterMappings`, its charCode is used instead.
     * @param {string} input The string to process.
     * @returns {number[]} An array of numbers representing the mapped characters.
     */
    processStringWithMapping(input: string): number[];
    /**
     * Splits a command into words, preserving quoted strings.
     * @param {string} command - The command to split.
     * @returns {string[]} - The command split into words.
     */
    splitCommandIntoWords(command: string): string[];
    /**
     * Converts a SNES address to a PC offset.
     * Returns -1 if the address is invalid.
     * @param {number} addr - The SNES address to convert.
     * @returns {number} The PC offset.
     */
    snestopc: (addr: number) => number;
    /**
     * Converts a PC offset to a SNES address.
     * Returns -1 if the address is invalid.
     * @param {number} addr - The PC offset to convert.
     * @returns {number} The SNES address.
     */
    pctosnes: (addr: number) => number;
    /**
     * Ensures the SNES position is valid, and resets it if it's not.
     */
    verifysnespos(): void;
    /**
     * Adjusts memory addresses based on the ROM type.
     * @param {number} inaddr The address to adjust.
     * @param {number} step The number of bytes to step.
     * @returns {number} The adjusted address.
     */
    fixsnespos(inaddr: number, step?: number): number;
    /**
     * Begins the collection of loop commands.
     * @param {string} type The type of loop to begin ("for" or "while").
     * @param {string} command The command to begin the loop with.
     */
    beginLoopCollection(type: "for" | "while", command: string): void;
    /**
     * Ends the collection of loop commands and executes the loop.
     * @param {string} type The type of loop to end ("for" or "while").
     */
    endLoopCollection(type: "for" | "while"): void;
    /**
     * Executes a complete loop block with all its nested commands.
     * @param {LoopBlock} loopBlock The loop block to execute.
     */
    executeLoopBlock(loopBlock: LoopBlock): void;
    /**
     * Executes a for loop block.
     * @param {LoopBlock} forBlock The for loop block to execute.
     */
    executeForLoop(forBlock: LoopBlock): void;
    /**
     * Executes a while loop block.
     * @param {LoopBlock} whileBlock The while loop block to execute.
     */
    executeWhileLoop(whileBlock: LoopBlock): void;
    /**
     * Checks if a line is a define statement.
     * @param {string} line The line to check.
     * @returns {boolean} True if the line is a define statement, false otherwise.
     */
    isDefineStatement(line: string): boolean;
    /**
     * Extracts the variable name from a define statement.
     * @param {string} line The line to extract the variable name from.
     * @returns {string | undefined} The variable name or null if the line is not a define statement.
     */
    getDefineVariable(line: string): string | null;
    /**
     * Process a line from a macro expansion.
     * @param {string} line The line to process from a macro.
     */
    processMacroLine(line: string): void;
    /**
     * Splits a string by commas while respecting function calls and parentheses.
     * @param {string} input - The input string to split.
     * @returns {string[]} Array of split values.
     */
    splitRespectingFunctions(input: string): string[];
    /**
     * Handles a label definition, whether it has a colon or not.
     * @param {string} labelName The label name (without colon).
     */
    handleLabelDefinition(labelName: string): void;
}
export {};
//# sourceMappingURL=assembler.d.ts.map