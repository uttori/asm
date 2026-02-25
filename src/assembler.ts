/* eslint-disable jsdoc/no-undefined-types */
import fs from "node:fs"
import path from "node:path"
import { Arch65816 } from "./Arch65816.js";
import { ArchSPC700 } from "./ArchSPC700.js"
import { ArchSuperFX } from "./ArchSuperFX.js";

import { AddressToLineMapping } from "./addr2line.js";
import { MathCore } from "./mathcore.js";
import { CRC32 } from "./crc32.js";

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
  /** Lines of code. */
  body: string[];
  /** The file where this macro was defined. */
  sourceFile?: string;
};

export type LoopBlock = {
  type: "for" | "while";
  condition: string;
  variable?: string;
  start?: number;
  end?: number;
  /** Can contain nested loops */
  commands: (string | LoopBlock)[];
  startLine: number;
  endLine?: number;
};

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
  snespos: number;
  startpos: number;
  realsnespos: number;
  realstartpos: number;
}

export interface IncludedFileInfo {
  /** Whether the file has been included */
  included: boolean;
  /** Whether the file has been guarded with includeonce */
  guarded: boolean;
}

export class Assembler {
  public snespos: number = 0;
  public realsnespos: number = 0;
  public startpos: number = 0;
  public realstartpos: number = 0;
  public bytes: number = 0;

  public pushBaseStack: number[] = [];

  /** Possible values: lorom, hirom, exlorom, exhirom, sa1rom, sfxrom, bigsa1rom, norom */
  public mapper: string = "lorom";
  public sa1banks: number[] = [0 << 20, 1 << 20, -1, -1, 2 << 20, 3 << 20, -1, -1];
  /** Placeholder for ROM */
  public romdata: number[] = [];
  public default_freespacebyte: number = 0x00;

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
  public currentMacroBody: string[] = [];
  public currentVariadicCount: number | undefined = undefined;

  public macros: Map<string, MacroDefinition> = new Map();

  public mathCore: MathCore;

  public moreonlinecond: boolean = true;
  public addressToLineMapping: AddressToLineMapping = new AddressToLineMapping();
  public currentFile: string = "";
  public currentLine: number = 0;

  public defines: Map<string, string> = new Map();

  // Character mapping support
  public characterMappings: Map<string, number> = new Map();
  public currentTable: string | null = null;

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

  public targetRom: number[];

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

  constructor(targetRom?: number[]) {
    this.targetRom = targetRom ?? [];
    this.arch65816 = new Arch65816(this);
    this.archSPC700 = new ArchSPC700(this);
    this.archSuperFX = new ArchSuperFX(this);
    this.mathCore = new MathCore();
    this.mathCore.delegate = this.mathCoreDelegate;
  }

  mathCoreDelegate = (operation: string, ...args: (string | number)[]): number | string => {
    debug("mathCoreDelegate", { operation, args })
    const readLittleEndian = (bytes: Uint8Array, pos: number, width: number): number | undefined => {
      if (!Number.isInteger(pos) || pos < 0 || pos + width > bytes.length) {
        return undefined;
      }
      let out = 0;
      for (let i = 0; i < width; i++) {
        out |= (bytes[pos + i] ?? 0) << (8 * i);
      }
      return out >>> 0;
    };
    const resolveReadablePath = (filename: string): string | undefined => {
      if (path.isAbsolute(filename)) {
        return fs.existsSync(filename) ? filename : undefined;
      }
      const candidates = [
        path.resolve(path.dirname(this.currentFile || "."), filename),
        path.resolve(process.cwd(), filename),
      ];
      return candidates.find((p) => fs.existsSync(p));
    };
    switch (operation) {
      case "resolveLabel": {
        const id = args[0] as string;
        // Compound struct member (e.g. TestStruct.count, TestStruct[0].count)
        if (id.includes(".")) {
          try {
            return this.resolveStructMember(id);
          } catch (_e) {
            // Fall through to getLabelValue
          }
        }
        try {
          return this.getLabelValue(id, false);
        } catch (e) {
          // If not found as a label, check if it's defined as a struct.
          if (this.structs.has(id)) {
            // Return the identifier as a string for built-in functions that expect one.
            return id;
          }
          throw e;
        }
      }
      case "snestopc": {
        return this.snestopc(args[0] as number);
      }
      case "pctosnes": {
        return this.pctosnes(args[0] as number);
      }
      case "pc": {
        return this.snespos;
      }
      case "realbase": {
        return this.realsnespos;
      }
      case "defined": {
        try {
          // TODO: This is no longer working as expected.
          this.getLabelValue(args[0] as string, false);
          return 1; // Label exists
        } catch (e) {
          // Check if it's a defined struct
          if (this.structs.has(args[0] as string)) {
            return 1; // Struct exists
          }
          // Not found as a label or struct
          return 0;
        }
      }
      case "sizeof": {
        // Special case: handle variadic arguments in a macro
        if (args[0] === "..." || args[0] === "…") {
          // If we're in a macro expansion, check if we have a specific variadicCount for this macro
          if (this.inMacroExpansion && this.currentVariadicCount !== undefined) {
            return this.currentVariadicCount;
          }

          // If we're in macro definition or have no current variadic count, return 0
          if (this.inMacroDefinition) {
            return 0;
          }

          // During evaluation (not expansion), this is likely the math evaluation
          // on a line like "while !a < sizeof(...)" which happens before
          // any actual arguments are passed. The actual expansion will happen later
          // when the macro is called with real arguments.
          return 0;
        }
        return this.getObjectSize(args[0] as string, true);
      }
      case "objectsize": {
        return this.getObjectSize(args[0] as string);
      }
      case "datasize": {
        return this.getObjectSize(args[0] as string);
      }
      case "filesize": {
        try {
          const stats = fs.statSync(args[0] as string);
          return stats.size;
        } catch (error: unknown) {
          debug(`Could not get filesize for '${args[0]}'`, error);
          throw error;
        }
      }
      case "getfilestatus": {
        try {
          // Check if file exists and is readable
          try {
            fs.accessSync(args[0] as string, fs.constants.R_OK);
            return 0; // File exists and is readable
          } catch (e) {
            return 2; // File exists but can't be read
          }
        } catch (e) {
          return 1; // File doesn't exist
        }
      }
      case "read1":
      case "read2":
      case "read3":
      case "read4":
      {
        const width = Number.parseInt(operation.slice(-1), 10);
        const pos = Math.trunc(args[0] as number);
        const defaultValue = args.length > 1 ? Number(args[1]) : undefined;
        const romBytes = Uint8Array.from(this.romdata);
        const value = readLittleEndian(romBytes, pos, width);
        if (value === undefined) {
          if (defaultValue !== undefined) return defaultValue;
          throw new Error(`${operation} out of bounds at ${pos}`);
        }
        return value;
      }
      case "readfile1":
      case "readfile2":
      case "readfile3":
      case "readfile4":
      {
        const width = Number.parseInt(operation.slice(-1), 10);
        const filename = args[0] as string;
        const pos = Math.trunc(args[1] as number);
        const defaultValue = args.length > 2 ? Number(args[2]) : undefined;
        const resolvedPath = resolveReadablePath(filename);
        if (!resolvedPath) {
          if (defaultValue !== undefined) return defaultValue;
          throw new Error(`Could not read file: ${filename}`);
        }
        const fileBytes = fs.readFileSync(resolvedPath);
        const value = readLittleEndian(fileBytes, pos, width);
        if (value === undefined) {
          if (defaultValue !== undefined) return defaultValue;
          throw new Error(`${operation} out of bounds at ${pos}`);
        }
        return value;
      }
      case "canread":
      {
        const pos = Math.trunc(args[0] as number);
        const num = Math.trunc(args[1] as number);
        return (Number.isInteger(pos) && Number.isInteger(num) && pos >= 0 && num >= 0 && pos + num <= this.romdata.length) ? 1 : 0;
      }
      case "canread1":
      case "canread2":
      case "canread3":
      case "canread4":
      {
        const pos = Math.trunc(args[0] as number);
        const num = Math.trunc(args[1] as number);
        return (Number.isInteger(pos) && Number.isInteger(num) && pos >= 0 && num >= 0 && pos + num <= this.romdata.length) ? 1 : 0;
      }
      case "canreadfile1":
      case "canreadfile2":
      case "canreadfile3":
      case "canreadfile4":
      {
        const width = Number.parseInt(operation.slice(-1), 10);
        const filename = args[0] as string;
        const pos = Math.trunc(args[1] as number);
        const resolvedPath = resolveReadablePath(filename);
        if (!resolvedPath) return 0;
        const size = fs.statSync(resolvedPath).size;
        return (Number.isInteger(pos) && pos >= 0 && pos + width <= size) ? 1 : 0;
      }
      case "canreadfile":
      {
        const filename = args[0] as string;
        const pos = Math.trunc(args[1] as number);
        const num = Math.trunc(args[2] as number);
        const resolvedPath = resolveReadablePath(filename);
        if (!resolvedPath) return 0;
        const size = fs.statSync(resolvedPath).size;
        return (Number.isInteger(pos) && Number.isInteger(num) && pos >= 0 && num >= 0 && pos + num <= size) ? 1 : 0;
      }
      default: {
        throw new Error(`delegate ${operation} not implemented`);
      }
    }
  }

  /**
   * Advances memory position while handling bank crossing.
   * @param {number} num The number of bytes to advance.
   */
  step(num: number): void {
    // debug("step", num);
    if (num === 0) {
      return;
    }
    if (num < 0) {
      throw new Error("step num is negative");
    }
    this.snespos = (this.snespos & 0xff000000) | this.fixsnespos(this.snespos & 0xffffff, num);
    this.realsnespos = (this.realsnespos & 0xff000000) | this.fixsnespos(this.realsnespos & 0xffffff, num);
    this.startpos = this.snespos;
    this.realstartpos = this.realsnespos;
    this.bytes += num;
  }

  /**
   * Writes a single byte to ROM.
   * @param {number} num - The byte to write.
   */
  write1_65816(num: number): void {
    // if (num !== 0x00) {
    // debug("write1_65816", num.toString(16));
    // }
    if (Number.isNaN(num)) {
      throw Error("write1_65816 num is NaN")
    }
    this.verifysnespos();

    // Use fixsnespos to handle bank wrapping for the real SNES position
    const wrappedPos = this.fixsnespos(this.realsnespos & 0xFFFFFF);
    // Preserve the bank byte (high byte) while using the wrapped position
    const bankByte = this.realsnespos & 0xFF000000;
    const newPos = bankByte | wrappedPos;

    const pcpos = this.snestopc(newPos & 0xFFFFFF);
    // debug("write1_65816 pcpos", pcpos.toString(16));

    // debug('write1_65816 this.pass', this.pass);
    if (this.pass === 2) {
      if (pcpos >= this.romdata.length) {
        // debug("write1_65816 pcpos >= romdata.length", pcpos, this.romdata.length);
        if (pcpos - this.romdata.length > 0) {
          this.fillRomData(this.romdata.length, this.default_freespacebyte, pcpos - this.romdata.length);
        }
      }

      this.romdata[pcpos] = num & 0xFF;
      // debug("write1_65816 romdata[pcpos]", pcpos, this.romdata[pcpos].toString(16));
    }

    this.step(1);
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

  /**
   * Picks the appropriate instruction handler based on architecture.
   * @param {string[]} words The words to pick.
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  asblock_pick(words: string[]): boolean {
    debug("asblock_pick", words);
    debug("asblock_pick arch", this.arch);
    if (words.length === 0) {
      return true;
    }

    // In pass 0, we need to still increment the position counter,
    // but we don't need to actually write bytes to ROM
    if (this.pass === 0) {
      // Determine approximate instruction size based on operand
      let size = 1; // Default size for instructions with no operand

      if (words.length > 1) {
        const operand = words.slice(1).join(" ");

        // Handle immediate addressing mode
        if (operand.startsWith("#")) {
          size = 2; // Immediate byte or word (most common)
        }
        // Handle absolute addressing or other multi-byte instructions
        else if (operand.includes("$") || operand.includes(",")) {
          size = 3; // Most instructions with operands are 2-3 bytes
        }
      }

      // Instructions like JSL, JML are typically 4 bytes
      if (["JSL", "JML"].includes(words[0].toUpperCase())) {
        size = 4;
      }

      // Step the counter by our estimated instruction size
      this.step(size);
      return true;
    }

    // For pass > 0, proceed with actual architecture-specific handling
    if (this.arch === "spc700") {
      return this.asblock_spc700(words);
    } else if (this.arch === "superfx") {
      // (Implement superfx handling if needed)
      // For now, fallback to 65816 handling.
      if (this.asblock_superfx(words)) {
        return true;
      }
      return false;
    } else if (this.arch === "65816") {
      if (this.asblock_65816(words)) {
        return true;
      } else {
        return false;
      }
    }
    return true;
  }

  /**
   * Placeholder for architecture-specific instruction handling.
   * @param {string[]} words - The words to pick.
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  asblock_spc700(words: string[]): boolean {
    debug("asblock_spc700", words);
    if (!this.archSPC700.asblock_spc700(words)) {
      throw new Error(`Unknown instruction: ${words[0]}`);
    }
    return true;
  }

  /**
   * SuperFX instruction handler.
   * @param {string[]} words - The words to pick.
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  asblock_superfx(words: string[]): boolean {
    debug("asblock_superfx", words);
    if (!this.archSuperFX.asblock_superfx(words)) {
      throw new Error(`Unknown instruction: ${words[0]}`);
    }
    return true;
  }

  /**
   * 65816 instruction handler.
   * @param {string[]} words - The words to pick.
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  asblock_65816(words: string[]): boolean {
    debug("asblock_65816", words);
    if (!this.arch65816.asblock_65816(words)) {
      throw new Error(`Unknown instruction: ${words[0]}`);
    }
    return true;
  }

  /**
   * Writes 1, 2, 3, or 4 bytes to ROM.
   * @param {number} num - The byte to write.
   */
  write1(num: number): void {
    this.write1_65816(num);
  }

  write2(num: number): void {
    this.write1(num & 0xFF);
    this.write1((num >> 8) & 0xFF);
  }

  write3(num: number): void {
    this.write1(num & 0xFF);
    this.write1((num >> 8) & 0xFF);
    this.write1((num >> 16) & 0xFF);
  }

  write4(num: number): void {
    this.write1(num & 0xFF);
    this.write1((num >> 8) & 0xFF);
    this.write1((num >> 16) & 0xFF);
    this.write1((num >> 24) & 0xFF);
  }

  /**
   * Reads 1, 2, or 3 bytes from ROM.
   * @param {number} insnespos - The SNES address to read from.
   * @returns {number} The byte read from ROM.
   */
  read1(insnespos: number): number {
    const addr = this.snestopc(insnespos);
    if (addr < 0 || addr + 1 > this.romdata.length) {
      return -1;
    }
    return this.romdata[addr];
  }

  read2(insnespos: number): number {
    const addr = this.snestopc(insnespos);
    if (addr < 0 || addr + 2 > this.romdata.length) {
      return -1;
    }
    return this.romdata[addr] | (this.romdata[addr + 1] << 8);
  }

  read3(insnespos: number): number {
    const addr = this.snestopc(insnespos);
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

    const lines = block.split("\n");
    const processedLines: string[] = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Strip any inline comments and trim the line
      line = this.removeInlineComment(line).trim();
      if (!line) continue;

      if (line.endsWith("\\")) {
        debug("processMultiLineOperators line ends with \\", line);
        this.commandBuffer += line.slice(0, -1); // Remove `\` and concatenate
      } else if (line.endsWith(",")) {
        debug("processMultiLineOperators line ends with ,", line);
        this.commandBuffer += line; // Keep `,` in concatenation
      } else {
        processedLines.push(this.commandBuffer + line);
        this.commandBuffer = "";
      }
    }

    // Don't process remaining buffer here - it will be handled in the next call
    // if (this.commandBuffer) processedLines.push(this.commandBuffer);

    block = processedLines.join("\n");

    const words = block.trim().split(/\s+/);
    if (words.length === 0) {
      debug("assembler assembleblock no words", { words });
      return;
    }

    // Handle single-line operator `:`
    const splitCommands = block.split(/\s:\s/);
    for (const command of splitCommands) {
      this.processCommand(command.trim());
    }
  }

  removeInlineComment(line: string): string {
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (!inQuote && ch === ";") {
        return line.substring(0, i).trim();
      }
    }
    return line.trim();
  }

  /**
   * Processes a single command from `assembleblock`.
   * @param {string} command - The command to process.
   */
  processCommand(command: string): void {
    if (command.trim() === "") return;
    debug("processCommand", { command }, this.snespos, "/", this.snespos.toString(16), `pass ${this.pass}`);

    // Inside processCommand method, modify the section that handles macro label references
    // Check for macro label references (?label or #label) in operands
    if (this.inMacroExpansion && (command.includes("?") || command.includes("#"))) {
      debug("processCommand found potential macro label reference", command);

      // Create a modified copy of the command for label substitution
      let modifiedCommand = command;

      // Handle ?+ and ?- special references
      if (modifiedCommand.includes("?+") || modifiedCommand.includes("?-")) {
        debug("processCommand processing ?+ or ?- references:", modifiedCommand);

        // Replace ?+ with the next label address
        if (modifiedCommand.includes("?+")) {
          // For macros, we need to look ahead in the macro body to find the next ?+ label
          // not the global + label
          const currentMacroInstance = this.macroLabelInstance;

          // First check if there's a ?+ label definition coming up in the macro
          const macroLabelPrefix = `:macro_${currentMacroInstance}_`;
          let nextAddr: number | null = null;

          // Check if we're at the label definition itself
          if (modifiedCommand.trim().startsWith("?+:")) {
            // Don't resolve label references in a label definition
            debug("processCommand skipping ?+ resolution in label definition");
          } else {
            // Look for the label in our stored labels
            for (const [key, info] of this.labelTable.entries()) {
              // Check for various possible formats of macro-local + labels
              if (key.startsWith(macroLabelPrefix) && (
                  key === `${macroLabelPrefix}+` ||     // Direct format: :macro_X_+
                  key.endsWith("_+") ||                 // Parent_SubLabel format: :macro_X_Parent_+
                  key === `:pos_${currentMacroInstance}_1` // Encoded format: :pos_X_1 (internal)
                ) && info.value > this.snespos) {
                debug(`processCommand found macro-local + label: ${key} = ${info.value}`);
                if (nextAddr === null || info.value < nextAddr) {
                  nextAddr = info.value;
                }
              }
            }

            // If we couldn't find a macro-specific ?+ label, try the regular + label as fallback
            if (nextAddr === null) {
              debug("processCommand no macro-local + label found, falling back to global + label");
              nextAddr = this.findNextLabel("?+");
            }

            debug("processCommand resolved ?+ to address:", nextAddr);
            modifiedCommand = modifiedCommand.replace(/\?\+/g, "$" + nextAddr.toString(16));
          }
        }

        // Replace ?- with the previous label address
        if (modifiedCommand.includes("?-")) {
          // For macros, we should look for a previous ?- label, not the global - label
          const currentMacroInstance = this.macroLabelInstance;

          // First check if there's a ?- label definition previously in the macro
          const macroLabelPrefix = `:macro_${currentMacroInstance}_`;
          let prevAddr: number | null = null;

          // Check if we're at the label definition itself
          if (modifiedCommand.trim().startsWith("?-:")) {
            // Don't resolve label references in a label definition
            debug("processCommand skipping ?- resolution in label definition");
          } else {
            // Look for the label in our stored labels
            for (const [key, info] of this.labelTable.entries()) {
              // Check for various possible formats of macro-local - labels
              if (key.startsWith(macroLabelPrefix) && (
                  key === `${macroLabelPrefix}-` ||     // Direct format: :macro_X_-
                  key.endsWith("_-") ||                 // Parent_SubLabel format: :macro_X_Parent_-
                  key === `:neg_${currentMacroInstance}_1` // Encoded format: :neg_X_1 (internal)
                ) && info.value < this.snespos) {
                debug(`processCommand found macro-local - label: ${key} = ${info.value}`);
                if (prevAddr === null || info.value > prevAddr) {
                  prevAddr = info.value;
                }
              }
            }

            // If we couldn't find a macro-specific ?- label, try the regular - label as fallback
            if (prevAddr === null) {
              debug("processCommand no macro-local - label found, falling back to global - label");
              prevAddr = this.findPreviousLabel("?-");
            }

            debug("processCommand resolved ?- to address", prevAddr);
            modifiedCommand = modifiedCommand.replace(/\?-/g, "$" + prevAddr.toString(16));
          }
        }

        debug("processCommand after resolving ?+/- references:", modifiedCommand);
      }

      // Handle ?Label references with correct scope
      if (modifiedCommand.includes("?")) {
        debug("processCommand resolving ?Label references in command", modifiedCommand);

        // First, handle Parent_SubLabel pattern (?Parent_SubLabel) which is common in macros
        modifiedCommand = modifiedCommand.replace(/(?<!\w)(\?[\w+.\-]+_[\w+.\-]+)(?!:)/g, (match: string, labelRef: string) => {
          // Skip if this appears to be a label definition, not a reference
          if (modifiedCommand.trim().startsWith(match) && (modifiedCommand.includes(":") || modifiedCommand.includes("="))) {
            return match;
          }

          try {
            // Try to get the label value using our getLabelValue method
            const labelValue = this.getLabelValue(labelRef, false);
            debug(`processCommand resolved Parent_SubLabel ${labelRef} to ${labelValue} (${labelValue.toString(16)})`);
            return "$" + labelValue.toString(16);
          } catch (e: unknown) {
            debug(`processCommand failed to resolve Parent_SubLabel ${labelRef}: ${e instanceof Error ? e.message : ""}`, e);
            // If in pass 0, return a placeholder
            if (this.pass === 0) {
              return "$0000";
            }
            throw e;
          }
        });

        // Then handle regular ?Label references
        modifiedCommand = modifiedCommand.replace(/(?<!\w)(\?[\w+.\-]+)(?!:)/g, (match: string, labelRef: string) => {
          // Skip if this appears to be a label definition, not a reference
          if (modifiedCommand.trim().startsWith(match) &&
              (modifiedCommand.includes(":") || modifiedCommand.includes("="))) {
            return match;
          }

          try {
            // Try to get the label value using our getLabelValue method
            const labelValue = this.getLabelValue(labelRef, false);
            debug(`processCommand resolved ${labelRef} to ${labelValue} (${labelValue.toString(16)})`);
            return "$" + labelValue.toString(16);
          } catch (e) {
            debug(`processCommand failed to resolve ${labelRef} but caught error:`, e);
            // If in pass 0, return a placeholder
            if (this.pass === 0) {
              return "$0000";
            }
            throw e;
          }
        });
      }

      // Update the command if it was modified
      if (modifiedCommand !== command) {
        debug("processCommand modified command with macro label references", modifiedCommand);
        command = modifiedCommand;
      }
    }

    // When collecting a while loop, asar uses "endif" to close the while (not "endwhile")
    if (this.collectingLoop && this.currentLoop?.type === "while" && command.trim().toLowerCase().startsWith("endif")) {
      this.handleEndIf();
      return;
    }

    // If we're in a loop body and not processing an inner loop or endfor, store the command
    if (this.collectingLoop && !command.match(/^\s*(for|while|endfor|endwhile)/i)) {
      debug("processCommand collecting loop command", command);
      // We're inside a loop block - collect the command instead of immediately processing it
      if (this.currentLoop) {
        this.currentLoop.commands.push(command);
      }
      return;
    }

    // Parse loop definitions using directive handlers so stack state stays consistent.
    // Do not intercept loop tokens while defining a macro; those lines must be stored verbatim.
    if (!this.inMacroDefinition) {
      if (command.match(/^\s*for\s+/i)) {
        const loopWords = this.splitCommandIntoWords(this.removeInlineComment(command));
        this.handleFor(loopWords.slice(1));
        return;
      }

      if (command.match(/^\s*while\s+/i)) {
        const loopWords = this.splitCommandIntoWords(this.removeInlineComment(command));
        this.handleWhile(loopWords.slice(1));
        return;
      }

      if (command.match(/^\s*endfor/i)) {
        this.handleEndFor();
        return;
      }

      if (command.match(/^\s*endwhile/i)) {
        this.handleEndWhile();
        return;
      }
    }

    // If we already started a function definition, gather more lines if the last line ended with "\"
    if (this.inFunctionDefinition) {
      // Remove trailing backslash if present
      if (command.trimEnd().endsWith("\\")) {
        this.functionDefinitionLines.push(command.trimEnd().slice(0, -1));
      } else {
        // This is the final line in the function definition
        this.functionDefinitionLines.push(command.trim());
        // Now parse the complete definition
        const fullDefinition = this.functionDefinitionLines.join(" ");
        this.functionDefinitionLines = [];
        this.inFunctionDefinition = false;

        this.parseFunctionDefinition(fullDefinition);
      }
      return;
    }

    // Check for the special test directive comment.
    // The test file is marked by a line that is exactly ";`+"
    if (command.trim().startsWith(";`+")) {
      debug("Test file directive detected; loading target ROM and setting ROM length to 512 KB.");
      const testRomSize = 512 * 1024; // 512 KB
      // If a target ROM data buffer is provided (assume it's stored in this.targetRom)
      if (this.targetRom && this.targetRom.length > 0) {
        // Copy up to testRomSize bytes from targetRom into our romdata array.
        for (let i = 0; i < Math.min(testRomSize, this.targetRom.length); i++) {
          this.romdata[i] = this.targetRom[i];
        }
      }
      // No further processing needed for this line.
        return;
      }

    // First remove any inline comment (ignoring semicolons inside quotes)
    command = this.removeInlineComment(command);

    // Split by whitespace, but preserve quoted strings
    let words = this.splitCommandIntoWords(command);
    if (words.length === 0) return;

    const keyword = words[0];

    // Handle character mappings (both inside and outside tables)
    if (words.length === 3 && words[1] === "=" && (words[0].startsWith("'") || words[0].startsWith('"'))) {
      this.handleCharacterMapping(words);
      return;
    }

    // Function Definition Mode
    if (keyword && keyword.toLowerCase().startsWith("function")) {
      // If it ends with "\" we keep collecting
      if (keyword.endsWith("\\")) {
        this.inFunctionDefinition = true;
        this.functionDefinitionLines.push(keyword.slice(0, -1));
      } else {
        // Single-line definition
        this.parseFunctionDefinition(words.join(" "));
      }
      return;
    }

    // Macro Definition Mode
    if (this.inMacroDefinition) {
      if (command.trim().toLowerCase() === "endmacro") {
        // Finalize macro definition only on pass 0.
        if (this.pass === 0) {
          let variadic = false;
          if (this.currentMacroParams.length > 0 &&
              (this.currentMacroParams[this.currentMacroParams.length - 1] === "..." ||
               this.currentMacroParams[this.currentMacroParams.length - 1] === "…")) {
            variadic = true;
            this.currentMacroParams.pop();
          }
          const macroDef: MacroDefinition = {
            name: this.currentMacroName,
            params: this.currentMacroParams,
            variadic,
            body: this.currentMacroBody,
            sourceFile: this.currentFile  // Store the file where this macro was defined
          };
          if (this.macros.has(macroDef.name)) {
            // If already defined on pass 0, that's an error.
            throw new Error(`Macro '${macroDef.name}' is already defined.`);
          }
          this.macros.set(macroDef.name, macroDef);
          debug(`processCommand defined macro '${macroDef.name}' with params [${macroDef.params.join(", ")}]${variadic ? " (variadic)" : ""}.`);
        }
        // On later passes (or after definition), simply exit macro-definition mode.
        this.inMacroDefinition = false;
        this.currentMacroName = "";
        this.currentMacroParams = [];
        this.currentMacroBody = [];
        return;
      } else {
        // On pass 0, collect macro body lines; on later passes ignore them.
        if (this.pass === 0) {
          this.currentMacroBody.push(command.trim());
        }
        return;
      }
    }

    // Start Macro Definition
    if (command.trim().toLowerCase().startsWith("macro ")) {
      // Expect a header like: macro mov(target, source)
      const headerRegex = /^macro\s+(\w+)\((.*)\)$/i;
      const match = command.trim().match(headerRegex);
      if (!match) {
        throw new Error("Invalid macro header: " + command.trim());
      }
      this.currentMacroName = match[1].trim();
      const paramsStr = match[2].trim();
      this.currentMacroParams = paramsStr ? paramsStr.split(",").map(s => s.trim()) : [];
      this.inMacroDefinition = true;
      debug(`processCommand started macro definition for '${this.currentMacroName}' with params [${this.currentMacroParams.join(", ")}].`);
      return;
    }

    // Define a set of directives that must always be processed (i.e. that update the condition stack)
    const conditionDirectives = new Set([
      "if", "elseif", "else", "endif",
      "while", "endwhile", "for", "endfor"
    ]);

    // Check if we are inside a false conditional block.
    // (If any entry in condStack is false then overall condition is false.)
    const currentCond = this.condStack.length === 0 ? true : this.condStack.every(entry => entry.cond);
    if (!currentCond && !conditionDirectives.has(keyword)) {
      debug(`processCommand ❎ Skipping command "${command}" because condition is false.`);
      return;
    }

    // If the command starts with "!", handle it appropriately
    if (command.trim().startsWith("!")) {
      // Check if it's a define declaration (contains =, +=, :=, etc.)
      if (command.includes("=")) {
        this.handleDefineCommand(command);
        this.addAddressToLine(this.realsnespos & 0xFFFFFF);
      } else {
        // It's a standalone define reference, resolve it and process the result
        const trimmedCommand = command.trim();

        // Check if this is a braced define reference
        if (trimmedCommand.startsWith("!{")) {
          try {
            // Process the entire command using the new method for braced defines
            const processedCommand = this.processValueWithBracedDefines(trimmedCommand);
            debug(`Processing braced define ${trimmedCommand} with processed value: ${processedCommand}`);
            this.processCommand(processedCommand);
          } catch (error) {
            throw new Error(`Error resolving braced define in "${trimmedCommand}": ${error.message}`);
          }
        } else {
          // Standard define reference
          const defineName = trimmedCommand.substring(1); // Remove the !
          if (!this.defines.has(defineName)) {
            throw new Error(`Error: Define '${defineName}' not found.`);
          }

          // Get the define's value and process it as a command
          const defineValue = this.defines.get(defineName);
          debug(`Processing standalone define !${defineName} with value: ${defineValue}`);
          this.processCommand(defineValue);
        }
      }
      return;
    }

    // If command starts with "%" then it's a macro invocation.
    if (keyword.startsWith("%")) {
      const invocation = words.join(" ").substring(1);
      this.callMacro(invocation);
      return;
    }

    // If we're in struct mode, intercept struct member commands.
    if (this.currentStruct) {
      debug("processCommand currentStruct keyword", keyword);
      // A member label starts with a dot.
      if (keyword.startsWith(".")) {
        // Check if this is a label definition or just a label reference
        const hasColon = keyword.endsWith(":");

        // For example: ".PosY:" – remove the colon and the dot
        const labelName = keyword.replace(/:$/, "").substring(1);

        // Record this label's offset within the struct.
        this.currentStruct.labels.set(labelName, this.currentStruct.offset);
        debug(`processCommand struct "${this.currentStruct.name}": defined member "${labelName}" at offset ${this.currentStruct.offset} hasColon=${hasColon}`);

        // A skip command inside a struct adds to the current offset.
        if (words[1]?.toLowerCase() === "skip") {
          if (words.length !== 3) {
            throw new Error(`skip directive in struct requires exactly one parameter: ${words.length}`);
          }
          const skipAmount = this.getnum(words[2]);
          this.currentStruct.offset += skipAmount;
          debug(`processCommand struct "${this.currentStruct.name}": skipAmount ${skipAmount}, offset now ${this.currentStruct.offset}`);
          return;
        } else {
          // IMPORTANT: NEVER increment the offset for:
          // 1. Any label that ends with a colon (organizational labels)
          // 2. Unless it's followed by a skip command
          if (hasColon && words.length === 1) {
            debug(`processCommand struct "${this.currentStruct.name}": not incrementing offset for organizational label "${labelName}"`);
          } else if (!hasColon) {
            // If there's no colon, this is a label used in an expression, not a declaration
            debug(`processCommand struct "${this.currentStruct.name}": not incrementing offset for label reference "${labelName}"`);
          } else {
            // This is a label followed by something other than skip - we should not increment for nested structs
            debug(`processCommand struct "${this.currentStruct.name}": not incrementing offset for struct member "${labelName}" with ${words.length} words`);
          }
          // Do NOT increment the offset for ANY labels inside structs (removed the offset increment)
          // The only way to increase the offset should be with skip directives
        }
      }
      // End the struct
      if (keyword.toLowerCase() === "endstruct") {
        this.handleEndStruct(words);
      }
      // Other commands inside a struct might be allowed.
      // For now, assume only labels and skip commands appear.
      return;
    }

    // Not in struct mode. Process regular commands.
    if (keyword.toLowerCase() === "struct") {
      this.handleStruct(words);
      return;
    }
    if (keyword.toLowerCase() === "endstruct") {
      this.handleEndStruct(words);
      return;
    }

    // New: support for incbin.
    if (keyword.toLowerCase() === "incbin") {
      this.handleIncbin(words);
      return;
    }

    // Handle relative labels (+ and -)
    if ((keyword.startsWith("+") || keyword.startsWith("-")) && keyword.endsWith(":")) {
      this.handleRelativeLabel(keyword);
      // Record mapping and finish.
      this.addAddressToLine(this.realsnespos & 0xFFFFFF);
      return;
    }

    // Handle global label declarations
    if (keyword.toLowerCase() === "global") {
      debug("processCommand global label", words);
      if (words.length < 2) {
        throw new Error("global requires a label name");
      }
      const labelDecl = words[1];
      const modifiesHierarchy = labelDecl.startsWith("#");
      const labelName = modifiesHierarchy ? labelDecl.substring(1) : labelDecl;
      const hasColon = labelName.endsWith(":");
      const cleanName = hasColon ? labelName.slice(0, -1) : labelName;

      // Set the label at the global scope (no namespace prefix)
      this.setLabel(cleanName, undefined, false, false, true, !modifiesHierarchy);

      // If this isn't a #-prefixed global, it becomes the new parent for sublabels
      if (!modifiesHierarchy) {
        this.currentParentLabel = cleanName;
        this.currentParentIsGlobal = true;
      }

      // Process any remaining commands after the label
      if (words.length > 2) {
        this.processCommand(words.slice(2).join(" "));
      }
      return;
    }

    // Handle non-relative (named) labels that use the colon syntax.
    // (Dynamic labels get their value from the current PC.)
    // Check if the first token ends with a colon or starts with a dot.
    while (words.length > 0 && (keyword.endsWith(":") || keyword.startsWith("."))) {
      debug("processCommand non-relative (named) label assignment", words)
      // Remove the colon if present to get the label name.
      const labelName = keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
      this.handleLabelDefinition(labelName);
      // Remove the label token.
      words.shift();
    }
    if (words.length === 0) return;

    // Handle static label assignment
    // Format: LabelName = <expression>
    if (words.length === 3 && words[1] === "=") {
      debug("static label assignment", words)
      const labelName = keyword;
      const expr = words[2];
      // First, resolve any defines in the expression.
      const resolvedExpr = this.resolvedefines(expr);
      // Try to evaluate it as a math expression.
      let value = this.mathCore.math(resolvedExpr);
      // If evaluation fails (i.e. not a numeric literal), try to resolve it as a label.
      if (Number.isNaN(value)) {
        value = this.getLabelValue(resolvedExpr, true);
      }
      // Mark this label as static.
      debug("static label assignment value", value)
      this.setLabel(labelName, value, true);
      // Record mapping and finish.
      this.addAddressToLine(this.realsnespos & 0xFFFFFF);
      return;
    }

    let resolved = "";

    // Capture the starting PC (before processing this command)
    const startPC = this.realsnespos & 0xFFFFFF;

    // Ensure proper condition handling
    if (!this.moreonlinecond && !["elseif", "else", "endif", "endwhile"].includes(keyword.toLowerCase())) {
      return;
    }

    // TODO: inmacro is external and resolvedefines is external
    // RPG Hacker: Fix issue where defines in elseifs weren't resolving correctly
    if (keyword.toLowerCase() === "elseif" && this.numtrue + 1 === this.numif) {
        const tmp =  command; //this.macros.inmacro ? this.macros.replace_macro_args(command) : command;
        resolved = this.resolvedefines(tmp);
        words = resolved.trim().split(/\s+/);
    }

    switch (keyword) {
      case "incsrc": {
        if (words.length !== 2) {
          throw new Error("incsrc requires exactly one filename parameter");
        }
        const filename = words[1];
        this.assemblefile(filename, false);
        break;
      }
      case "include": {
        this.handleInclude("include", words[1], false);
        break;
      }
      case "includeonce": {
        // Mark the current file as guarded (no parameters needed)
        const fileInfo = this.includedFiles.get(this.currentFile) || { included: true, guarded: false };
        fileInfo.guarded = true;
        this.includedFiles.set(this.currentFile, fileInfo);
        break;
      }
      case "fillbyte":
      case "fillword":
      case "filllong":
      case "filldword": {
        debug(`processCommand ${keyword}`, words);
        let len: number;
        if (keyword === "fillbyte") len = 1;
        else if (keyword === "fillword") len = 2;
        else if (keyword === "filllong") len = 3;
        else if (keyword === "filldword") len = 4;
        else throw new Error("Unrecognized fillbyte directive.");

        if (words.length !== 2) {
          throw new Error(`${keyword.toUpperCase()} directive requires exactly one parameter.`);
        }
        const val = this.getnum(this.resolvedefines(words[1]));
        debug(`processCommand ${keyword} value`, val);
        // Optionally warn if a label is used here.
        // Fill our fill pattern array in 12-byte blocks.
        for (let i = 0; i < 12; i += len) {
          let tmpVal = val;
          for (let j = 0; j < len; j++) {
            this.fillbyte[i + j] = tmpVal & 0xFF;
            tmpVal >>>= 8;
          }
        }
        break;
      }
      case "fill": {
        debug("processCommand fill", words);
        // Syntax: fill {number_of_bytes}
        if (words.length !== 2) {
          throw new Error("FILL directive requires exactly one parameter (number of bytes to fill).");
        }
        const count = this.getnum(this.resolvedefines(words[1]));
        for (let i = 0; i < count; i++) {
          this.write1(this.fillbyte[i % 12]);
        }
        // this.addAddressToLine(this.realsnespos & 0xFFFFFF);
        break;
      }
      case "padbyte":
      case "padword":
      case "padlong":
      case "paddword": {
        debug(`${keyword}`, words)
        // Determine the length from the command name.
        let len: number;
        if (keyword === "padbyte") len = 1;
        else if (keyword === "padword") len = 2;
        else if (keyword === "padlong") len = 3;
        else if (keyword === "paddword") len = 4;
        else throw new Error("Unrecognized pad directive.");
        if (words.length !== 2) {
          throw new Error(`${keyword.toUpperCase()} directive requires exactly one parameter.`);
        }
        const val = this.getnum(this.resolvedefines(words[1]));
        debug(`${keyword} val`, val);
        // Save the pad unit (i.e. number of bytes in the pad pattern)
        this.padUnit = len;
        // Fill the first len entries of the pad pattern array.
        for (let i = 0; i < len; i++) {
          this.padbyte[i] = (val >> (8 * i)) & 0xFF;
        }
        break;
      }
      case "pad": {
        debug("pad", words)
        // The pad command writes the pad pattern until the PC reaches a target SNES address.
        let gap: number;
        if (words.length === 1) {
          // Pad to next bank boundary
          const currentBank = (this.snespos & 0xFF0000);
          const bankOffset = (this.snespos & 0xFFFF);
          const nextBank = bankOffset === 0xFFFF ? currentBank + 0x10000 : currentBank + 0x10000 - bankOffset;
          debug("pad next bank", nextBank, "/", nextBank.toString(16));
          words.push("$" + nextBank.toString(16));
          // gap = nextBank - this.snespos;
          gap = nextBank;
        } else if (words.length === 2) {
          // We must convert the target SNES address into a PC offset.
          const targetSNES = this.getnum(words[1]);
          const targetPC = this.snestopc(targetSNES);
          if (targetPC < 0) {
            throw new Error(`Target SNES address ${targetSNES.toString(16)} does not map to ROM.`);
          }
          const currentPC = this.snestopc(this.snespos);
          if (targetPC <= currentPC) {
            debug("pad targetPC <= currentPC, nothing to pad", targetPC, "<=", currentPC)
            // Nothing to pad.
            return;
          }
          gap = targetPC - currentPC;
        }
        debug("pad gap (PC offset):", gap, "/", gap.toString(16));
        // Write the pad pattern using the previously defined padUnit.
        for (let i = 0; i < gap; i++) {
          this.write1(this.padbyte[i % this.padUnit]);
        }
        // this.addAddressToLine(this.realsnespos & 0xFFFFFF);
        break;
      }
      case "base": {
        if (words.length !== 2) {
          throw new Error("BASE directive requires exactly one parameter.");
        }
        const param = words[1].toLowerCase();
        if (param === "off") {
          // Reset base: use the 'real' positions
          this.snespos = this.realsnespos;
          this.startpos = this.realstartpos;
          // Optionally, you might want to log this event:
          debug("BASE turned off. snespos and startpos reset to their real values.");
        } else {
          // Parse the parameter as a number.
          const num = this.getnum(param);
          if (num > 0xFFFFFF) {
            throw new Error(`Invalid base address: ${param}. Must be within 24 bits.`);
          }
          // In ASAR, a forward label isn't allowed here.
          // (If you have a forward label flag, you might check it here.)
          this.snespos = num;
          this.startpos = num;
          debug(`BASE set to ${param} (${num}).`);
        }
        break;
      }
      case "fastrom":
        // Removed but in the tests
        break;
      case "lorom":
        this.mapper = "lorom";
        break;
      case "hirom":
        this.mapper = "hirom";
        break;
      case "exlorom":
        this.mapper = "exlorom";
        break;
      case "exhirom":
        this.mapper = "exhirom";
        break;
      case "sfxrom":
        this.mapper = "sfxrom";
        break;
      case "norom":
        this.mapper = "norom";
        // For norom, you might disable checksum fix:
        // if (!this.force_checksum_fix) this.checksum_fix_enabled = false;
        break;
      case "fullsa1rom":
        this.mapper = "bigsa1rom";
        break;
      case "sa1rom": {
        if (words.length > 1) {
          // Expect a parameter in the form "X,Y,Z,W" where each X is a single digit.
          const parts = words[1].split(",");
          if (parts.length !== 4) {
            throw new Error("Invalid SA1ROM mapper specification. Expected 4 comma-separated values.");
          }
          this.sa1banks = [];
          this.sa1banks[0] = (parseInt(parts[0], 10)) << 20;
          this.sa1banks[1] = (parseInt(parts[1], 10)) << 20;
          this.sa1banks[4] = (parseInt(parts[2], 10)) << 20;
          this.sa1banks[5] = (parseInt(parts[3], 10)) << 20;
        } else {
          // Use default bank values.
          this.sa1banks = [];
          this.sa1banks[0] = 0 << 20;
          this.sa1banks[1] = 1 << 20;
          this.sa1banks[4] = 2 << 20;
          this.sa1banks[5] = 3 << 20;
        }
        this.mapper = "sa1rom";
        break;
      }
        case "+":
        case "-": {
          this.handleRelativeLabel(command);
          break;
        }
        case "if": {
          this.handleIf(words.slice(1));
          break;
        }
        case "elseif": {
          this.handleElseIf(words.slice(1));
          break;
        }
        case "else": {
            this.handleElse();
            break;
        }
        case "endif": {
            this.handleEndIf();
            break;
        }
        case "while":
            this.handleWhile(words.slice(1));
            break;
        case "endwhile":
            this.handleEndWhile();
            break;
        case "for":
          this.handleFor(words.slice(1));
          break;
        case "endfor":
          this.handleEndFor();
          break;
        case "namespace":
          this.handleNamespace(words.slice(1));
          break;
        case "pushns":
          // TODO: Likely not useful and should remove
          this.handlePushNamespace();
          break;
        case "pullns":
          // TODO: Likely not useful and should remove
          this.handlePullNamespace();
          break;
        case "org":
          this.handleOrg(words.slice(1));
          break;
        case "db":
        case "dw":
        case "dl":
        case "dd":
        case "dc.b":
        case "dc.w":
        case "dc.l": {
          this.handleDataDirective(keyword, words.slice(1));
          break;
        }
        case "pushbase": {
          this.handlePushBase();
          break;
        }
        case "pullbase": {
          this.handlePullBase();
          break;
        }
        case "pushpc": {
          this.handlePushPC();
          break;
        }
        case "pullpc": {
          this.handlePullPC();
          break;
        }
        case "arch": {
          this.handleArch(words);
          break;
        }
        case "check":
        case "dpbase":
        case "warnings":
        case "print":
        case "freecode":
        case "freespace":
        case "freedata":
        case "autoclean":
        case "autoclear":
        case "freespacebyte":
        case "prot":
        case "pulltable":
        case "pushtable":
        case "table":
        case "optimize":
        case "includefrom":
        case "asar":
        case "{":
        case "}":
            debug(`${keyword} unsupported`, words.slice(1))
            break;
        default: {
          if (keyword.startsWith(";")) {
            // debug(`handleInstruction comment: ${words.join(" ")}`);
          } else if (keyword === "") {
            // debug(`handleInstruction white space: ${words.join(" ")}`);
          } else {
            const wasOpcode = this.asblock_pick(words);
            if (!wasOpcode) {
              debug("💥 assembler processCommand unknown operation", keyword)
            }
          }
          break;
        }
    }

    // Determine how many bytes were written in this command.
    const commandSize = (this.realsnespos & 0xFFFFFF) - startPC;
    debug("processCommand bytes written", commandSize)

    this.addAddressToLine(this.realsnespos & 0xFFFFFF);
  }

  handlePushBase(): void {
    debug("handlePushBase")
    this.pushBaseStack.push(this.snespos);
  }

  handlePullBase(): void {
    debug("handlePullBase")
    if (this.pushBaseStack.length === 0) {
      throw new Error("No base value to pull.");
    }
    this.snespos = this.pushBaseStack.pop();
  }

  /**
   * Handles the ARCH command.
   * @param {string[]} words - The words from the ARCH command.
   * @throws {Error} If the ARCH command requires an architecture parameter.
   */
  handleArch(words: string[]): void {
    debug("handleArch", words)
    if (!words[1]) {
      throw new Error("ARCH command requires an architecture parameter.")
    }
    const archParam = words[1].toLowerCase();
    if (archParam === "65816") {
      this.arch = "65816";
      // (Reinitialize or update arch65816 if needed)
    } else if (archParam === "spc700" || archParam === "spc700-inline" || archParam === "spc700-raw") {
      this.arch = "spc700";
    } else if (archParam === "superfx") {
      this.arch = "superfx";
    } else {
      throw new Error("Unsupported architecture: " + archParam);
    }
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
   * Expands and calls a macro invocation.
   * The invocation is expected to be in the form:
   *   macroName(arg1, arg2, ...)
   * @param {string} invocation The macro invocation to expand and call.
   */
  callMacro(invocation: string): void {
    debug("callMacro", invocation);

    // Increment the macro instance counter at the start
    this.macroLabelInstance++;
    debug("Incremented macro instance counter to", this.macroLabelInstance);

    // Track if we're in a macro expansion
    const previousMacroExpansionState = this.inMacroExpansion;
    this.inMacroExpansion = true;

    // Save previous variadic count
    const previousVariadicCount = this.currentVariadicCount;
    // Save the previous macro name
    const previousMacroName = this.currentMacroName;

    // Use a regex to extract macro name and arguments.
    const invocationRegex = /^(\w+)\((.*)\)$/;
    const m = invocation.match(invocationRegex);
    debug("callMacro m", m)

    if (!m) {
      // Simple macro without arguments.
      const macroName = invocation.substring(1);
      debug("callMacro macroName", macroName)
      if (!this.macros.has(macroName)) {
        throw new Error(`Error: Macro '${macroName}' not defined.`);
      }

      // Set the current macro name
      this.currentMacroName = macroName;
      const macro = this.macros.get(macroName);

      // Handle the case where a macro has parameters but was called without them.
      if (macro.params.length > 0) {
        debug("callMacro macro.params args", macro.params);
        const fixedArgs = new Map<string, string>();
        for (let i = 0; i < macro.params.length; i++) {
          fixedArgs.set(macro.params[i], "");
        }

        // Set variadic count to 0 since there are no variadic arguments
        this.currentVariadicCount = 0;

        // Expand each line of the macro.
        for (const line of macro.body) {
          const expandedLine = this.expandMacroLine(line, fixedArgs, [], 0);
          debug(`callMacro (${macroName}, no args): ${expandedLine}`);
          // Use processMacroLine instead of assembleblock
          this.processMacroLine(expandedLine);
        }
      } else {
        debug("callMacro macro.body no args", macro.body)
        // No parameters, just process each line.
        for (const line of macro.body) {
          debug(`callMacro (${macroName}, no args): ${line}`);
          // Use processMacroLine instead of assembleblock
          this.processMacroLine(line);
        }
      }
    } else {
      // Macro with arguments.
      const macroName = m[1];
      const args = m[2].trim();
      if (!this.macros.has(macroName)) {
        throw new Error(`Error: Macro '${macroName}' not defined.`);
      }

      // Set the current macro name
      this.currentMacroName = macroName;
      const macro = this.macros.get(macroName);

      // Split the arguments. Handle quoted strings and escaped sequences.
      const argValues: string[] = [];
      let currentArg = "";
      let inQuotes = false;
      let escapeNext = false;

      for (let i = 0; i < args.length; i++) {
        const c = args[i];

        if (escapeNext) {
          currentArg += c;
          escapeNext = false;
          continue;
        }

        if (c === "\\") {
          escapeNext = true;
          continue;
        }

        if (c === '"' && !inQuotes) {
          inQuotes = true;
          continue;
        }

        if (c === '"' && inQuotes) {
          inQuotes = false;
          continue;
        }

        if (c === "," && !inQuotes) {
          argValues.push(currentArg.trim());
          currentArg = "";
          continue;
        }

        currentArg += c;
      }

      if (currentArg.length > 0) {
        argValues.push(currentArg.trim());
      }

      // Create a mapping of argument names to values.
      const fixedArgs = new Map<string, string>();

      for (let i = 0; i < macro.params.length; i++) {
        if (i < argValues.length) {
          fixedArgs.set(macro.params[i], argValues[i]);
        } else {
          fixedArgs.set(macro.params[i], "");
        }
      }

      // Handle variadic arguments if the macro expects them.
      const variadicArgs: string[] = [];
      let variadicCount = 0;

      if (macro.variadic && argValues.length > macro.params.length) {
        variadicCount = argValues.length - macro.params.length;
        for (let i = macro.params.length; i < argValues.length; i++) {
          variadicArgs.push(argValues[i]);
        }
      }

      // Store the variadic count for accessing in sizeof(...)
      this.currentVariadicCount = variadicCount;

      // Expand each line of the macro.
      for (const line of macro.body) {
        const expandedLine = this.expandMacroLine(line, fixedArgs, variadicArgs, variadicCount);
        debug(`callMacro (${macroName}, with args): ${expandedLine}`);
        // Use processMacroLine instead of assembleblock
        this.processMacroLine(expandedLine);
      }
    }

    // Restore the previous macro name
    this.currentMacroName = previousMacroName;

    // Restore the previous variadic count
    this.currentVariadicCount = previousVariadicCount;

    // Restore the previous macro expansion state
    this.inMacroExpansion = previousMacroExpansionState;
  }

  /**
   * Expands a macro line by substituting fixed parameters (<param>) and variadic parameters (<...[expr]>),
   * then resolves any remaining defines.
   * @param {string} line The macro line to expand.
   * @param {Map<string, string>} fixedArgs A map of fixed parameters to their values.
   * @param {string[]} variadicArgs An array of variadic arguments.
   * @param {number} variadicCount The number of variadic arguments.
   * @returns {string} The expanded macro line.
   */
  expandMacroLine(line: string, fixedArgs: Map<string, string>, variadicArgs: string[], variadicCount: number): string {
    debug("expandMacroLine", { line, fixedArgs, variadicArgs, variadicCount });

    // Handle define statements (!a = 0) - don't expand the left side
    if (line.trim().startsWith("!") && line.includes("=")) {
      // Extract the variable name and operator
      const match = line.trim().match(/^!(\w+)\s*(=|\+=|:=|#=|\?=)\s*(.*)$/);
      if (match) {
        const varName = match[1];
        const operator = match[2];
        const value = match[3];

        // Only expand the right side (value) of the assignment
        let expandedValue = value;
        expandedValue = expandedValue.replace(/<(\w+)>/g, (match: string, paramName: string) => {
          if (fixedArgs.has(paramName)) {
            return this.resolvedefines(fixedArgs.get(paramName));
          }
          return match;
        });
        expandedValue = expandedValue.replace(/<(?:\.{3}|…)\[([^\]]+)]>/g, (match: string, expr: string) => {
          // Check for defines in the expression (like !a+1)
          const processedExpr = expr.replace(/!(\w+)/g, (defMatch: string, defName: string) => {
            if (this.defines.has(defName)) {
              return this.defines.get(defName);
            }
            return defMatch;
          });

          // Resolve any remaining defines inside the math expression
          const resolvedExpr = this.resolvedefines(processedExpr);
          let index = this.mathCore.math(resolvedExpr);
          if (isNaN(index)) {
            throw new Error(`Invalid variadic index expression: ${expr} (resolved to ${resolvedExpr})`);
          }
          index = Math.floor(index);
          if (index < 0 || index >= variadicCount) {
            throw new Error(`Variadic index ${index} out of range (0..${variadicCount - 1}).`);
          }
          return variadicArgs[index];
        });
        expandedValue = expandedValue.replace(/sizeof\((?:\.{3}|…)\)/g, variadicCount.toString());

        return `!${varName} ${operator} ${expandedValue}`;
      }
    }

    // First check if this line contains a label definition (ends with :)
    if (line.match(/^\s*[#?][\w+.\-]+:/)) {
      debug("expandMacroLine: found label definition, passing through", line);
      return line;
    }

    // Check if this line contains a label assignment (contains =)
    // This needs to be handled before parameter substitution
    if (line.match(/^\s*[#?][\w+.\-]+\s*=/)) {
      debug("expandMacroLine: found label assignment, passing through", line);
      return line;
    }

    let expanded = line;
    // Replace fixed parameters of the form <param>
    expanded = expanded.replace(/<(\w+)>/g, (match: string, paramName: string) => {
      if (fixedArgs.has(paramName)) {
        // Optionally, run the argument through resolvedefines.
        return this.resolvedefines(fixedArgs.get(paramName));
      }
      return match;
    });

    // Check if we're in a false condition - don't expand variadic parameters
    const currentCond = this.condStack.length === 0 ? true : this.condStack.every(entry => entry.cond);
    if (!currentCond) {
      // If in a false condition, just expand fixed parameters and pass through
      return expanded;
    }

    // Replace variadic parameters of the form <...[{math}]>
    expanded = expanded.replace(/<(?:\.{3}|…)\[([^\]]+)]>/g, (match: string, expr: string) => {
      // Check for defines in the expression (like !a+1)
      const processedExpr = expr.replace(/!(\w+)/g, (defMatch: string, defName: string) => {
        if (this.defines.has(defName)) {
          return this.defines.get(defName);
        }
        return defMatch;
      });

      // Resolve any remaining defines inside the math expression
      const resolvedExpr = this.resolvedefines(processedExpr);
      let index = this.mathCore.math(resolvedExpr);
      if (isNaN(index)) {
        throw new Error(`Invalid variadic index expression: ${expr} (resolved to ${resolvedExpr})`);
      }
      index = Math.floor(index);
      if (index < 0 || index >= variadicCount) {
        throw new Error(`Variadic index ${index} out of range (0..${variadicCount - 1}).`);
      }
      return variadicArgs[index];
    });
    // Replace sizeof(...) with the number of variadic arguments.
    expanded = expanded.replace(/sizeof\((?:\.{3}|…)\)/g, variadicCount.toString());
    // Keep regular !defines for runtime evaluation (important for loop bodies in macros).
    debug("expandMacroLine = ", expanded)
    return expanded;
  }

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
  handleDefineCommand(command: string): void {
    debug("handleDefineCommand", command)
    // Remove the leading "!" and trim.
    const line = command.substring(1).trim();

    // Check if this is a nested define with braces
    if (line.startsWith("{")) {
      // Find the matching closing brace
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

      // Extract the identifier inside braces
      const nestedContent = line.substring(1, closingBraceIndex - 1);
      debug("handleDefineCommand nested content:", nestedContent);

      // Process the nested content recursively to handle nested braces
      const resolvedIdentifier = this.processNestedDefines(nestedContent);
      debug("handleDefineCommand resolved nested identifier:", resolvedIdentifier);

      // Extract the operator and value
      const restOfLine = line.substring(closingBraceIndex).trim();
      const operatorMatch = restOfLine.match(/^\s*(=|\+=|:=|#=|\?=)\s*(.*)$/);

      if (!operatorMatch) {
        throw new Error(`Invalid define syntax after braces: ${command}`);
      }

      const operator = operatorMatch[1];
      let value = operatorMatch[2].trim();

      // Process any braced defines in the value
      if (value.includes("!{") || value.includes("!")) {
        // Need to process defines in the value
        // For simple cases, fully resolve the value
        if (!value.includes("FF") && !value.includes("$")) {
          value = this.processNestedDefines(value);
          debug("handleDefineCommand fully processed value:", value);
        } else {
          // For complex cases, just process braced defines
          value = this.processValueWithBracedDefines(value);
          debug("handleDefineCommand processed value with braced defines:", value);
        }
      }

      // If the value is enclosed in double quotes, remove them.
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }

      // For the ":=" operator, resolve any defines in the value immediately.
      if (operator === ":=") {
        value = this.resolvedefines(value);
      }

      // For the "#=" operator, evaluate the value as a math expression.
      if (operator === "#=") {
        // First resolve any defines inside the expression.
        value = this.resolvedefines(value);
        const result = this.mathCore.math(value);
        /* c8 ignore next 3 */
        if (Number.isNaN(result)) {
          throw new Error(`Math evaluation failed in define "#=" for expression: ${value}`);
        }
        // Convert to string (you may choose your own format, here decimal is used)
        value = result.toString();
      }

      // For the "?=" operator, only assign if not already defined.
      if (operator === "?=") {
        if (this.defines.has(resolvedIdentifier)) {
          return;
        }
      }

      // For the "+=" operator, append to any existing value.
      if (operator === "+=") {
        const existing = this.defines.get(resolvedIdentifier) || "";
        value = existing + value;
      }

      // Check if the value is a math expression that needs to be evaluated
      if (operator !== "#=" && (value.includes("+") || value.includes("-") || value.includes("*") || value.includes("/") ||
          value.includes("&") || value.includes("|") || value.includes("^") ||
          value.includes("<<") || value.includes(">>") || value.includes("("))) {
        try {
          // First resolve any defines inside the expression
          const resolvedValue = this.resolvedefines(value);
          // Then evaluate the math expression
          const result = this.mathCore.math(resolvedValue);
          if (!Number.isNaN(result)) {
            // Only use the result if it's a valid number
            value = "$" + result.toString(16).toUpperCase();
            debug(`handleDefineCommand evaluated math expression in define: ${resolvedValue} = ${value}`);
          }
        } catch (error) {
          /* c8 ignore next 3 */
          // If evaluation fails, keep the original value
          debug(`handleDefineCommand math evaluation skipped for expression: ${value}`);
        }
      }

      // Assign the define.
      this.defines.set(resolvedIdentifier, value);
      debug(`handleDefineCommand define set: !{${nestedContent}} ${operator} ${value} (resolved to !${resolvedIdentifier})`);
      debug("handleDefineCommand defines", this.defines);
      return;
    }

    // Standard define case (no braces in identifier)
    const match = line.match(/^(\w+)\s*(=|\+=|:=|#=|\?=)\s*(.*)$/);
    if (!match) {
      throw new Error(`Invalid define syntax: ${command}`);
    }
    const identifier = match[1];
    const operator = match[2];
    let value = match[3].trim();

    // Process any braced defines in the value
    if (value.includes("!{") || value.includes("!")) {
      // For simple cases like !fourth = !{second}fi!{third}, fully resolve the value
      if (!value.includes("FF") && !value.includes("$")) {
        value = this.processNestedDefines(value);
        debug("handleDefineCommand fully processed value:", value);
      } else {
        // For complex cases, just process braced defines
        value = this.processValueWithBracedDefines(value);
        debug("handleDefineCommand processed value with braced defines:", value);
      }
    }

    // If the value is enclosed in double quotes, remove them.
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }

    // For the ":=" operator, resolve any defines in the value immediately.
    if (operator === ":=") {
      value = this.resolvedefines(value);
    }

    // For the "#=" operator, evaluate the value as a math expression.
    if (operator === "#=") {
      // First resolve any defines inside the expression.
      value = this.resolvedefines(value);
      const result = this.mathCore.math(value);
      /* c8 ignore next 3 */
      if (Number.isNaN(result)) {
        throw new Error(`Math evaluation failed in define "#=" for expression: ${value}`);
      }
      // Convert to string (you may choose your own format, here decimal is used)
      value = result.toString();
    }

    // For the "?=" operator, only assign if not already defined.
    if (operator === "?=") {
      if (this.defines.has(identifier)) {
        return;
      }
    }

    // For the "+=" operator, append to any existing value.
    if (operator === "+=") {
      const existing = this.defines.get(identifier) || "";
      value = existing + value;
    }

    // Check if the value is a math expression that needs to be evaluated
    if (operator !== "#=" && (value.includes("+") || value.includes("-") || value.includes("*") || value.includes("/") ||
        value.includes("&") || value.includes("|") || value.includes("^") ||
        value.includes("<<") || value.includes(">>") || value.includes("("))) {
      try {
        // First resolve any defines inside the expression
        const resolvedValue = this.resolvedefines(value);
        // Then evaluate the math expression
        const result = this.mathCore.math(resolvedValue);
        if (!Number.isNaN(result)) {
          // Only use the result if it's a valid number
          value = "$" + result.toString(16).toUpperCase();
          debug(`handleDefineCommand evaluated math expression in define: ${resolvedValue} = ${value}`);
        }
      } catch (error) {
        /* c8 ignore next 3 */
        // If evaluation fails, keep the original value
        debug(`handleDefineCommand math evaluation skipped for expression: ${value}`);
      }
    }

    // Assign the define.
    this.defines.set(identifier, value);
    debug(`handleDefineCommand define set: !${identifier} ${operator} ${value}`);
    debug("handleDefineCommand defines", this.defines);
  }

  /**
   * Processes nested defines in a string, properly handling the !{...} syntax
   * by immediately resolving the content inside braces.
   * @param {string} content The content with nested defines to process
   * @returns {string} The resolved identifier
   */
  processNestedDefines(content: string): string {
    debug("processNestedDefines input:", content);

    // Check if there are any define markers in the content
    if (!content.includes("!")) {
      debug("processNestedDefines no define markers found, returning as is");
      return content;
    }

    // Process until no more changes occur
    let prevResult = "";
    let result = content;
    let iterations = 0;
    const maxIterations = 10; // Safety limit

    while (prevResult !== result && iterations < maxIterations) {
      debug(`processNestedDefines iteration ${iterations+1} - processing: "${result}"`);
      iterations++;
      prevResult = result;
      result = this.resolveOneLevelOfDefines(result);
      debug(`processNestedDefines iteration ${iterations} result: "${result}"`);
    }

    debug("processNestedDefines final result:", result);
    return result;
  }

  /**
   * Helper method to resolve one level of defines in a string.
   * @param {string} content The content to process
   * @returns {string} The processed content with one level of defines resolved
   */
  resolveOneLevelOfDefines(content: string): string {
    debug("resolveOneLevelOfDefines input:", content);

    // This approach scans the string for !{...} patterns and processes them from the inside out

    // Find all positions of !{
    const openBracePositions = [];
    for (let i = 0; i < content.length - 1; i++) {
      if (content.substring(i, i+2) === "!{") {
        openBracePositions.push(i);
        i++; // Skip the {
      }
    }

    // If no braces found, process regular !defines
    if (openBracePositions.length === 0) {
      return this.resolveRegularDefines(content);
    }

    // Process the rightmost (last) opening brace first - it's guaranteed to be an innermost define
    // or at least closer to an innermost define
    const lastOpenBracePos = openBracePositions[openBracePositions.length - 1];

    // Find its matching closing brace
    let nestLevel = 1;
    let closingBracePos = -1;

    for (let i = lastOpenBracePos + 2; i < content.length; i++) {
      if (i < content.length - 1 && content.substring(i, i+2) === "!{") {
        nestLevel++;
        i++; // Skip the {
      }
      else if (content[i] === "}") {
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

    // Extract the content between braces
    const braceContent = content.substring(lastOpenBracePos + 2, closingBracePos);
    debug(`resolveOneLevelOfDefines extracted braced content: "${braceContent}"`);

    // If this content itself contains braced defines, we need to resolve those first
    if (braceContent.includes("!{")) {
      // Recursively resolve the inner content first
      const resolvedInnerContent = this.resolveOneLevelOfDefines(braceContent);
      debug(`resolveOneLevelOfDefines resolved inner content: "${resolvedInnerContent}"`);

      // Replace just this inner content in the original string
      const updatedContent =
        content.substring(0, lastOpenBracePos + 2) +
        resolvedInnerContent +
        content.substring(closingBracePos);

      debug(`resolveOneLevelOfDefines after resolving inner content: "${updatedContent}"`);
      return updatedContent;
    }

    // If we get here, we have a simple braced content with no inner braces - resolve it
    let replacement = braceContent;
    if (this.defines.has(braceContent)) {
      replacement = this.defines.get(braceContent);
      debug(`resolveOneLevelOfDefines resolved braced define: "${braceContent}" to "${replacement}"`);
    } else {
      debug(`resolveOneLevelOfDefines define not found, using as is: "${braceContent}"`);
    }

    // Replace this one define in the content
    const result =
      content.substring(0, lastOpenBracePos) +
      replacement +
      content.substring(closingBracePos + 1);

    debug(`resolveOneLevelOfDefines after resolving: "${result}"`);
    return result;
  }

  /**
   * Helper method to resolve regular !defines (non-braced)
   * @param {string} content The content to process
   * @returns {string} The processed content with regular defines resolved
   */
  resolveRegularDefines(content: string): string {
    debug(`resolveRegularDefines input: "${content}"`);
    let result = "";
    let index = 0;
    let foundDefine = false;

    while (index < content.length) {
      if (content.substring(index).startsWith("!") &&
          index + 1 < content.length &&
          /\w/.test(content[index + 1])) {
        // Regular define (not braced)
        debug(`resolveRegularDefines found regular define at index ${index}`);
        index++; // Skip !
        let defineName = "";

        while (index < content.length && /\w/.test(content[index])) {
          defineName += content[index++];
        }

        debug(`resolveRegularDefines extracted define name: "${defineName}"`);

        // Look up the define
        if (this.defines.has(defineName)) {
          result += this.defines.get(defineName);
          debug(`resolveRegularDefines resolved regular define: "${defineName}" to "${this.defines.get(defineName)}"`);
          foundDefine = true;
        } else {
          throw new Error(`Define '${defineName}' not found.`);
        }
      } else {
        // Regular character
        result += content[index++];
      }
    }

    if (foundDefine) {
      debug(`resolveRegularDefines after processing: "${result}"`);
      return result;
    }

    // No changes made
    return content;
  }

  /**
   * Processes a define value string, resolving any !{...} expressions it contains.
   * @param {string} value The value string potentially containing braced defines
   * @returns {string} The processed value with all braced defines resolved
   */
  processValueWithBracedDefines(value: string): string {
    debug("processValueWithBracedDefines input:", value);
    let result = "";
    let index = 0;

    while (index < value.length) {
      if (value.substring(index).startsWith("!{")) {
        // Found a braced define reference
        let braceContent = "";
        index += 2; // Skip !{
        let braceLevel = 1;

        // Extract the content between braces
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

        // Skip the closing brace
        index++;

        // Process nested braces in the content recursively
        const resolvedIdentifier = this.processNestedDefines(braceContent);
        debug("processValueWithBracedDefines resolved braced content to identifier:", resolvedIdentifier);

        // Preserve the reference in braced format with the fully resolved identifier
        result += `!{${resolvedIdentifier}}`;
        debug("processValueWithBracedDefines preserving braced reference:", `!{${resolvedIdentifier}}`);
      } else {
        // Regular character
        result += value[index++];
      }
    }

    debug("processValueWithBracedDefines final result:", result);
    return result;
  }

  /**
   * Handles `+` and `-` relative labels correctly using SNES memory position.
   * @param {string} label The label to handle.
   * @returns {number} The address of the label.
   */
  handleRelativeLabel(label: string): number {
    debug("handleRelativeLabel", label);
    debug("handleRelativeLabel this.forwardLabels", this.forwardLabels);
    debug("handleRelativeLabel this.backwardLabels", this.backwardLabels);

    const isPositive = label.includes("+");
    const depth = isPositive ? (label.match(/\+/g) || []).length : (label.match(/-/g) || []).length;
    const snesAddress = this.snespos;

    // Check if this is a macro-local relative label (starts with ?)
    const isMacroLocal = label.startsWith("?");

    if (this.pass === 2) {
      // Search in stored labels
      if (isPositive) {
        if (!this.forwardLabels[depth] || this.forwardLabels[depth].length === 0) {
          throw new Error(`Error: Undefined forward label '${label}'.`);
        }
      } else {
        if (!this.backwardLabels[depth] || this.backwardLabels[depth].length === 0) {
          throw new Error(`Error: Undefined backward label '${label}'.`);
        }
      }
      debug("handleRelativeLabel =", snesAddress);
      return snesAddress;
    }

    // Pass 0: Store labels properly
    if (isPositive) {
      if (!this.forwardLabels[depth]) this.forwardLabels[depth] = [];
      debug(`handleRelativeLabel this.forwardLabels[${depth}] =`, snesAddress, "/", snesAddress.toString(16));
      // Store with macro instance info if it's a macro-local label
      if (isMacroLocal && this.inMacroExpansion) {
        this.forwardLabels[depth].push({ addr: snesAddress, macroInstance: this.macroLabelInstance });
      } else {
        this.forwardLabels[depth].push({ addr: snesAddress });
      }
    } else {
      if (!this.backwardLabels[depth]) this.backwardLabels[depth] = [];
      debug(`handleRelativeLabel this.backwardLabels[${depth}] =`, snesAddress, "/", snesAddress.toString(16));
      // Store with macro instance info if it's a macro-local label
      if (isMacroLocal && this.inMacroExpansion) {
        this.backwardLabels[depth].push({ addr: snesAddress, macroInstance: this.macroLabelInstance });
      } else {
        this.backwardLabels[depth].push({ addr: snesAddress });
      }
    }

    debug("handleRelativeLabel =", snesAddress);
    return snesAddress;
  }

  /**
   * Finds the next occurrence of a `+` label based on SNES memory position.
   * @param {string} label The label to find.
   * @returns {number} The address of the next label.
   */
  findNextLabel(label: string): number {
    debug("findNextLabel", label);
    debug("findNextLabel this.forwardLabels", this.forwardLabels);

    const isPositive = label.includes("+");
    const depth = isPositive ? (label.match(/\+/g) || []).length : (label.match(/-/g) || []).length;
    const currentAddress = this.snespos;
    const isMacroLocal = label.startsWith("?");

    // **Pass 0: Don't resolve labels yet, just track**
    if (this.pass < 2) {
      return 0; // Temporary placeholder value, will be resolved in Pass 2
    }

    // **Pass 2: Resolve properly**
    if (!this.forwardLabels[depth] || this.forwardLabels[depth].length === 0) {
      throw new Error(`Error: No + label '${label}' found after ${currentAddress.toString(16)}.`);
    }

    // **Find the first label that is AFTER the current address**
    const possibleTargets = this.forwardLabels[depth]
      .filter(entry => {
        // For macro-local labels, only consider labels from the current macro instance
        if (isMacroLocal && this.inMacroExpansion) {
          return entry.addr > currentAddress && entry.macroInstance === this.macroLabelInstance;
        }
        // For global labels, only consider non-macro labels
        return entry.addr > currentAddress && !entry.macroInstance;
      })
      .map(entry => entry.addr);

    if (possibleTargets.length === 0) {
      throw new Error(`Error: No + label '${label}' found after ${currentAddress.toString(16)}.`);
    }

    debug("findNextLabel possibleTargets", possibleTargets);
    return Math.min(...possibleTargets); // Return the closest one
  }

  /**
   * Finds the previous occurrence of a `-` label based on SNES memory position.
   * @param {string} label The label to find.
   * @returns {number} The address of the previous label.
   */
  findPreviousLabel(label: string): number {
    debug("findPreviousLabel", label);

    const isPositive = label.includes("+");
    const depth = isPositive ? (label.match(/\+/g) || []).length : (label.match(/-/g) || []).length;
    const currentAddress = this.snespos;
    const isMacroLocal = label.startsWith("?");

    // **Pass 0: Don't resolve labels yet, just track**
    if (this.pass === 0) {
      return 0; // Temporary placeholder, will be resolved in Pass 2
    }

    // **Pass 2: Resolve properly**
    if (!this.backwardLabels[depth] || this.backwardLabels[depth].length === 0) {
      throw new Error(`Error: No - label '${label}' found before ${currentAddress.toString(16)}.`);
    }

    // **Find the first label that is BEFORE the current address**
    const possibleTargets = this.backwardLabels[depth]
      .filter(entry => {
        // For macro-local labels, only consider labels from the current macro instance
        if (isMacroLocal && this.inMacroExpansion) {
          return entry.addr < currentAddress && entry.macroInstance === this.macroLabelInstance;
        }
        // For global labels, only consider non-macro labels
        return entry.addr < currentAddress && !entry.macroInstance;
      })
      .map(entry => entry.addr);

    if (possibleTargets.length === 0) {
        throw new Error(`Error: No - label '${label}' found before ${currentAddress.toString(16)}.`);
    }

    debug("findPreviousLabel possibleTargets", possibleTargets);
    return Math.max(...possibleTargets); // Return the closest one
  }

  /**
   * Handles setting a label in the assembler.
   * @param {string} label The label to set.
   * @param {number} value The value to set the label to.
   * @param {boolean} isStatic Whether the label is static.
   * @param {boolean} isMacroLabel Whether this is a macro label.
   * @param {boolean} isGlobal Whether this is a global label.
   * @param {boolean} modifiesHierarchy Whether this label affects the sublabel hierarchy.
   */
  setLabel(label: string, value?: number, isStatic: boolean = false, isMacroLabel: boolean = false, isGlobal: boolean = false, modifiesHierarchy: boolean = true): void {
    debug("setLabel", { label, value, isStatic, isMacroLabel, isGlobal, modifiesHierarchy });

    let fullLabel = label;
    let directScopeLabel: string | null = null;  // For storing the direct scope version

    // Handle macro label format - they start with ? or #
    if (isMacroLabel && (label.startsWith("?") || label.startsWith("#"))) {
      const prefix = label.charAt(0);
      const labelName = label.substring(1); // Remove the ? or # prefix
      const modifiesHierarchy = prefix !== "#"; // Only non-# labels modify hierarchy

      if (prefix === "?") {
        // Check if this is a sub-label (starts with a dot)
        if (labelName.startsWith(".")) {
          // Store both the direct sub-label and a Parent_SubLabel version for compatibility
          // First, find the most recent ?Label we've set
          let recentMainLabel = "";
          for (const [key, entry] of this.labelTable.entries()) {
            if (entry.isMacroLabel && key.startsWith(`:macro_${this.macroLabelInstance}_`) &&
                !key.includes("_SubLabel_")) {
              // Extract the part after the instance prefix
              const labelPart = key.substring(`:macro_${this.macroLabelInstance}_`.length);
              // Skip if it's a sub-label itself (starts with .)
              if (!labelPart.startsWith(".")) {
                recentMainLabel = labelPart;
              }
            }
          }

          // Store the direct sub-label
          fullLabel = `:macro_${this.macroLabelInstance}_${labelName}`;
          debug("setLabel: creating instance-scoped macro sub-label", fullLabel);

          // If we found a recent main label, also store a Parent_SubLabel version
          if (recentMainLabel) {
            // Store the name without the dot too
            const subLabelWithoutDot = labelName.substring(1); // Remove the leading dot
            const parentChildLabel = `:macro_${this.macroLabelInstance}_${recentMainLabel}_${subLabelWithoutDot}`;
            debug("setLabel: also creating parent-child macro label", parentChildLabel);

            // Set the label table entry for the parent-child reference too
            const subAddr = (value !== undefined) ? value : this.snespos;
            this.labelTable.set(parentChildLabel, {
              value: subAddr,
              isStatic,
              isMacroLabel: true,
              macroInstance: this.macroLabelInstance,
              modifiesHierarchy
            });
          }
        } else {
          // Regular ?Label - scoped to the macro instance
          fullLabel = `:macro_${this.macroLabelInstance}_${labelName}`;
          debug("setLabel: creating instance-scoped macro label", fullLabel);
        }
      } else if (prefix === "#") {
        // #Labels are globally available (still in current namespace)
        fullLabel = this.currentNamespace && !isGlobal ? `${this.currentNamespace}_${labelName}` : labelName;
        debug("setLabel: creating global macro label", fullLabel);
      }
    } else if (!label.includes(":")) {
      // Check if the label already includes the current namespace
      const namespacePrefix = this.namespaceNestingEnabled ?
        this.namespaceNestingPath.join("_") :
        this.currentNamespace;

      if (this.currentNamespace && !isGlobal) {
        // Check if the label already starts with the namespace
        if (!label.startsWith(namespacePrefix + "_")) {
          fullLabel = `${namespacePrefix}_${label}`;

          // When nested namespaces are enabled, also create intermediate labels
          if (this.namespaceNestingEnabled && this.namespaceNestingPath.length > 0 && modifiesHierarchy) {
            // Create intermediate namespace labels

            // 1. Create a label with just the leaf namespace (e.g., Third_Main)
            const leafNamespace = this.namespaceNestingPath[this.namespaceNestingPath.length - 1];
            const leafLabel = `${leafNamespace}_${label}`;

            // Set the address for the current position
            const addr = (value !== undefined) ? value : this.snespos;

            debug(`setLabel creating leaf namespace label ${leafLabel}`);
            this.labelTable.set(leafLabel, {
              value: addr,
              isStatic,
              isMacroLabel,
              macroInstance: isMacroLabel ? this.macroLabelInstance : undefined,
              modifiesHierarchy
            });

            // 2. Create labels for intermediate namespace paths
            for (let i = this.namespaceNestingPath.length - 2; i >= 0; i--) {
              const partialPath = this.namespaceNestingPath.slice(i);
              const partialLabel = `${partialPath.join("_")}_${label}`;

              debug(`setLabel creating intermediate namespace label ${partialLabel}`);
              this.labelTable.set(partialLabel, {
                value: addr,
                isStatic,
                isMacroLabel,
                macroInstance: isMacroLabel ? this.macroLabelInstance : undefined,
                modifiesHierarchy
              });
            }
          }
        }
        // For non-global labels in a namespace, also store the direct scope version
        if (label.includes("_") && !label.startsWith(namespacePrefix + "_")) {
          directScopeLabel = label;
        }
      } else {
        fullLabel = label;
      }
    }

    // If no value was provided, use the current SNES position
    const addr = (value !== undefined) ? value : this.snespos;

    if (this.pass === 0) {
      debug("setLabel pass 0", { fullLabel, directScopeLabel, addr, addrHex: addr.toString(16), isStatic, isMacroLabel, modifiesHierarchy });
      if (this.labelTable.has(fullLabel)) {
        debug(`setLabel ⚠️ Warning: Label '${fullLabel}' redefined.`);
      }
      // Store the full namespaced version
      this.labelTable.set(fullLabel, {
        value: addr,
        isStatic,
        isMacroLabel,
        macroInstance: isMacroLabel ? this.macroLabelInstance : undefined,
        modifiesHierarchy
      });

      // Also store the direct scope version if needed
      if (directScopeLabel) {
        debug(`setLabel also storing direct scope version: ${directScopeLabel}`);
        this.labelTable.set(directScopeLabel, {
          value: addr,
          isStatic,
          isMacroLabel,
          macroInstance: isMacroLabel ? this.macroLabelInstance : undefined,
          modifiesHierarchy: false // Don't modify hierarchy for these
        });
      }
      return; // Exit early for pass 0
    }

    if (this.pass === 2) {
      // Check if this is a non-static label that already exists with a different address
      const existingEntry = this.labelTable.get(fullLabel);
      if (existingEntry) {
        if (existingEntry.isStatic !== isStatic) {
          throw new Error(`Label '${fullLabel}' is not static and cannot be used in conditionals.`);
        }
        if (!isStatic) {
          const existingAddr = existingEntry.value;

          if (existingAddr !== addr) {
            debug("setLabel pass error", { fullLabel, oldAddr: existingAddr, newAddr: addr });

            // Throw error for changed labels between passes only when not a macro label
            if (!isMacroLabel) {
              throw new Error(`Label "${fullLabel}" changed from $${existingAddr.toString(16)} to $${addr.toString(16)}`);
            }
          }
        }
      }
    }

    if (this.pass === 3) {
      throw new Error(`Label '${fullLabel}' used in pass 3.`);
    }

    // Handle the current parent label tracking for sublabels
    if (modifiesHierarchy) {
      // Only update parent if this is a regular label (not a sub-label starting with .)
      if (!label.startsWith(".")) {
        if (!isGlobal) {
          // If this is a namespace label, set the parent with the namespace
          this.currentParentLabel = fullLabel;
          this.currentParentIsGlobal = isGlobal;
          debug(`setLabel updating parent label to "${fullLabel}"`);
        } else {
          // Global labels reset the parent tracking
          this.currentParentLabel = fullLabel;
          this.currentParentIsGlobal = true;
          debug(`setLabel updating parent label to global "${fullLabel}"`);
        }
      }
    }

    debug("setLabel setting", { fullLabel, addr: addr, addrHex: addr.toString(16) });

    // Update the label table with this label
    this.labelTable.set(fullLabel, {
      value: addr,
      isStatic,
      isMacroLabel,
      macroInstance: isMacroLabel ? this.macroLabelInstance : undefined,
      modifiesHierarchy
    });

    // Also set the direct scope version if needed (for better label lookup)
    if (directScopeLabel) {
      this.labelTable.set(directScopeLabel, {
        value: addr,
        isStatic,
        isMacroLabel,
        macroInstance: isMacroLabel ? this.macroLabelInstance : undefined,
        modifiesHierarchy: false // Don't modify hierarchy for these
      });
    }
  }

  /**
   * Resolves a compound struct member id (e.g. TestStruct.count, TestStruct[0].count, TestStruct.NewStruct.new).
   * @param compoundId e.g. "TestStruct.count", "TestStruct[0].count", "TestStruct.NewStruct.new"
   * @returns {number} The offset or address (base + index*size + memberOffset for indexed).
   */
  resolveStructMember(compoundId: string): number {
    // Parse: StructName ( "." ( MemberName | ChildStructName ) | "[" index "]" )* ( "." MemberName )?
    const firstId = compoundId.trim().match(/^([A-Z_a-z]\w*)/)?.[1];
    if (!firstId || !this.structs.has(firstId)) throw new Error(`Struct not found: ${compoundId}`);
    let rest = compoundId.substring(firstId.length).trim();
    let base = 0;
    let currentStruct = this.structs.get(firstId);

    while (rest.length > 0) {
      if (rest.startsWith(".")) {
        rest = rest.substring(1).trim();
        const memberMatch = rest.match(/^([A-Z_a-z]\w*)/);
        if (!memberMatch) throw new Error(`Invalid struct member: ${compoundId}`);
        const memberName = memberMatch[1];
        rest = rest.substring(memberName.length).trim();

        const memberOffset = currentStruct.labels.get(memberName);
        if (memberOffset !== undefined) {
          return base + memberOffset;
        }
        const childStruct = this.structs.get(memberName);
        if (childStruct && childStruct.parent === currentStruct.name) {
          currentStruct = childStruct;
        } else {
          throw new Error(`Struct member not found: ${currentStruct.name}.${memberName}`);
        }
      } else if (rest.startsWith("[")) {
        const bracketEnd = rest.indexOf("]");
        if (bracketEnd === -1) throw new Error(`Unclosed [ in struct ref: ${compoundId}`);
        const indexStr = rest.substring(1, bracketEnd).trim();
        const index = parseInt(indexStr, 10);
        if (isNaN(index) || index < 0) throw new Error(`Invalid struct index: ${indexStr}`);
        rest = rest.substring(bracketEnd + 1).trim();
        base += index * currentStruct.size;
      } else {
        break;
      }
    }

    return base;
  }

  /**
   * Retrieves the address of a stored label.
   * @param {string} label The label to retrieve the value of.
   * @param {boolean} requireStatic Whether the label must be static.
   * @returns {number} The value of the label.
   */
  getLabelValue(label: string, requireStatic: boolean): number {
    debug("getLabelValue", { label, requireStatic });
    debug("getLabelValue labelTable", this.labelTable);

    // Check if it's a macro label reference
    const isMacroLabelRef = label.startsWith("?");

    // For macro label references, try to find the label in the current macro instance
    if (isMacroLabelRef && this.inMacroExpansion) {
      const labelName = label.substring(1); // Remove the ? prefix

      // Check if this is a parent_sublabel reference (contains underscore)
      if (labelName.includes("_")) {
        const [parentPart, subPart] = labelName.split("_", 2);
        debug("getLabelValue: detected parent_sublabel reference", { parentPart, subPart });

        // Look for the combined parent_sublabel reference
        const childLabel = `:macro_${this.macroLabelInstance}_.${subPart}`;
        debug("getLabelValue: looking for macro sublabel", childLabel);

        if (this.labelTable.has(childLabel)) {
          const entry = this.labelTable.get(childLabel);
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
          }
          debug("getLabelValue (macro sublabel) =", entry.value, "/", entry.value.toString(16), entry);
          return entry.value;
        }

        // Look for the combined parent_sublabel reference
        const parentChildLabel = `:macro_${this.macroLabelInstance}_${parentPart}_${subPart}`;
        debug("getLabelValue: looking for macro parent_sublabel", parentChildLabel);

        if (this.labelTable.has(parentChildLabel)) {
          const entry = this.labelTable.get(parentChildLabel);
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
          }
          debug("getLabelValue (macro parent_sublabel) =", entry.value, "/", entry.value.toString(16), entry);
          return entry.value;
        }
      }

      // Try normal macro label reference
      const macroLabel = `:macro_${this.macroLabelInstance}_${labelName}`;
      debug("getLabelValue macro instance label", macroLabel);

      if (this.labelTable.has(macroLabel)) {
        const entry = this.labelTable.get(macroLabel);
        if (requireStatic && !entry.isStatic) {
          throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
        }
        debug("getLabelValue (macro) =", entry.value, "/", entry.value.toString(16));
        return entry.value;
      }

      // Try without the dot - if the label starts with a dot, the dot might be part of the macro label key
      if (labelName.startsWith(".")) {
        const macroLabelNoDot = `:macro_${this.macroLabelInstance}_${labelName}`;
        debug("getLabelValue trying macro instance label without dot prefix", macroLabelNoDot);

        if (this.labelTable.has(macroLabelNoDot)) {
          const entry = this.labelTable.get(macroLabelNoDot);
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static macro label '${label}' used in conditional.`);
          }
          debug("getLabelValue (macro without dot) =", entry.value, "/", entry.value.toString(16));
          return entry.value;
        }
      }
    }

    // If the label already includes a namespace separator, use it directly
    if (label.includes(":") || label.includes("_")) {
      return this.getLabelValueDirect(label, requireStatic);
    }

    // For nested namespaces, try each parent namespace in order
    if (this.namespaceNestingEnabled && this.namespaceNestingPath.length > 0) {
      // Try from most specific to least specific namespace
      for (let i = this.namespaceNestingPath.length; i >= 0; i--) {
        const namespacePath = this.namespaceNestingPath.slice(0, i);
        const namespacePrefix = namespacePath.join("_");
        const fullLabel = namespacePrefix ? `${namespacePrefix}_${label}` : label;

        try {
          return this.getLabelValueDirect(fullLabel, requireStatic);
        } catch (e) {
          // Not found in this namespace, continue to parent
          continue;
        }
      }
    }

    // Fall back to current namespace or global
    return this.getLabelValueDirect(
      this.currentNamespace ? `${this.currentNamespace}_${label}` : label,
      requireStatic
    );
  }

  /**
   * Direct label lookup without namespace resolution.
   * @param {string} label The fully qualified label to look up.
   * @param {boolean} requireStatic Whether the label must be static.
   * @returns {number} The label's value.
   */
  getLabelValueDirect(label: string, requireStatic: boolean): number {
    debug("getLabelValueDirect", { label, requireStatic });

    // Check for underscore separator (e.g., "Main_Sub")
    // This is a special syntax that combines a parent label with a local label
    if (label.includes("_") && !label.includes(":")) {
      const parts = label.split("_");
      if (parts.length === 2) {
        const parentLabel = parts[0];
        const localLabel = "." + parts[1];

        // Try to find the combined label
        const combinedLabel = parentLabel + "_" + localLabel.replace(/^\./, "");
        debug("getLabelValueDirect checking underscore separator", { parentLabel, localLabel, combinedLabel });

        // Check if the combined label exists in the label table
        if (this.labelTable.has(combinedLabel)) {
          const entry = this.labelTable.get(combinedLabel);
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static label '${combinedLabel}' used in conditional.`);
          }
          debug("getLabelValueDirect (combined label) =", entry.value, "/", entry.value.toString(16));
          return entry.value;
        }

        // Check if the local label exists in the label table
        if (this.labelTable.has(localLabel)) {
          const entry = this.labelTable.get(localLabel);
          if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static label '${localLabel}' used in conditional.`);
          }
          debug("getLabelValueDirect (underscore separator) =", entry.value, "/", entry.value.toString(16));
          return entry.value;
        }

        // If not found and in pass 0, return a dummy value
        if (this.pass === 0) {
          debug("getLabelValueDirect (underscore separator not found, pass 0) =", 0);
          return 0;
        }
      }
    }

    if (!this.labelTable.has(label)) {
      // In pass 0, allow forward references by returning a dummy value
      if (this.pass === 0) {
        debug("getLabelValueDirect (pass 0) =", 0);
        return 0;
      }
      throw new Error(`Error: Label '${label}' not found.`);
    }

    const entry = this.labelTable.get(label);
    if (requireStatic && !entry.isStatic) {
      throw new Error(`Error: Non-static label '${label}' used in conditional.`);
    }

    debug("getLabelValueDirect =", entry.value, "/", entry.value.toString(16));
    return entry.value;
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
    const conditionResult = this.evaluateExpression(conditionStr);
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
      const conditionResult = this.evaluateExpression(conditionStr);
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

    this.snespos = addr;
    this.realsnespos = addr;
    this.startpos = addr;
    this.realstartpos = addr;
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

    if (this.pass === 0) {
      debug("handleDataDirective pass 0, skipping");
      this.addAddressToLine(this.realsnespos & 0xFFFFFF);
      return;
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

    // Split by comma while respecting function calls
    const values = this.splitRespectingFunctions(params.join(" "));

    for (let value of values) {
      if (value.startsWith('"') || value.startsWith("'")) {
        debug("handleDataDirective string literals", value);
        // Handle string literals
        const unquoted = value.slice(1, -1);
        debug("handleDataDirective string literal unquoted", unquoted);
        // Use character mapping for each character
        const mappedChars = this.processStringWithMapping(unquoted);
        for (const charValue of mappedChars) {
          this.writeDataByLength(len, charValue);
        }
      } else {
        // TODO we need support for labels, relative labels, and macro labels
        debug("handleDataDirective numeric values", value);
        // Handle numeric values
        if (value.startsWith("#")) {
          console.warn("Warning: # before numbers in db/dw/... is deprecated. Remove the #.");
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

        // Check if this is a struct reference (e.g., "sprite.x_pos")
        let num: number;
        try {
          const structValue = this.resolveStructLabel(resolved);
          debug("handleDataDirective struct reference", { resolved, structValue });
          if (typeof structValue === "number" && !Number.isNaN(structValue)) {
            num = structValue;
            debug("handleDataDirective using struct value", num);
            this.writeDataByLength(len, num);
            continue;
          }
        } catch (error) {
          debug("handleDataDirective struct resolution failed, trying math evaluation", resolved);
          // If struct resolution fails, continue with normal evaluation of the resolved expression
          num = this.mathCore.math(resolved);
        }
        if (Number.isNaN(num)) {
          // As a fallback, try to look up a label (this assumes it's a static label).
          num = this.getLabelValue(resolved, true);
        }
        debug("handleDataDirective numeric num", num);

        if (Number.isNaN(num)) {
          debug("handleDataDirective unable to determine value:", num)
          throw new Error("Unable to determine value:")
        }
        this.writeDataByLength(len, num);
      }
    }

    this.addAddressToLine(this.realsnespos & 0xFFFFFF);
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
        snespos: this.snespos,
        startpos: this.startpos,
        realsnespos: this.realsnespos,
        realstartpos: this.realstartpos,
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
    this.snespos = state.snespos;
    this.startpos = state.startpos;
    this.realsnespos = state.realsnespos;
    this.realstartpos = state.realstartpos;

    this.pushpcnum--;
  }

  /**
   * Handles `struct` definitions.
   * @param {string[]} words The parameters for the struct directive.
   */
  handleStruct(words: string[]): void {
    debug("handleStruct", words)
    // Syntax:
    // struct {identifier}                    (base defaults to $000000)
    // struct {identifier} {snes_address}      OR
    // struct {extension_identifier} extends {parent_identifier}
    if (words.length < 2) {
      throw new Error("Struct definition requires at least two parameters.");
    }
    const structName = words[1];
    let base: number;
    let parent: string | undefined;
    if (words.length === 2) {
      // struct Name with no base – use $000000
      base = 0;
    } else if (words[2].toLowerCase() === "extends") {
      // Format: struct ExtensionName extends ParentName
      if (words.length < 4) {
        throw new Error("Struct extension must specify a parent struct.");
      }
      parent = words[3];
      // Look up the parent struct – it must exist.
      if (!this.structs.has(parent)) {
        throw new Error(`Parent struct '${parent}' not defined.`);
      }
      // For an extension, we use the parent's base.
      base = this.structs.get(parent).base;
    } else {
      // Otherwise, words[2] is the SNES address.
      base = this.getnum(words[2]);
      if (base < 0 || base > 0xFFFFFF) {
        throw new Error(`Invalid SNES address for struct: ${words[2]}`);
      }
    }
    // Save current PC before changing it.
    this.savedPCStack.push(this.snespos);
    // Set the base for the struct.
    this.snespos = base;
    this.startpos = base;
    this.realsnespos = base;
    this.realstartpos = base;
    // Create a new struct definition with an initial offset of zero.
    this.currentStruct = {
      name: structName,
      base,
      offset: 0,
      size: 0, // will be set in endstruct
      labels: new Map(),
      parent,
    };
    debug(`handleStruct entered struct mode: ${structName}, base ${base.toString(16)}` +
      (parent ? `, extending ${parent}` : ""));
  }

  /**
   * Handles the end of a struct definition.
   * @param {string[]} words The parameters for the endstruct directive.
   */
  handleEndStruct(words: string[]): void {
    debug("handleEndStruct", words)
    if (!this.currentStruct) {
      throw new Error("endstruct encountered but not inside a struct definition.");
    }
    // Optionally, words might be: endstruct align {num}
    let align: number | undefined;
    if (words.length >= 2 && words[1].toLowerCase() === "align") {
      if (words.length !== 3) {
        throw new Error("endstruct align requires a single alignment parameter.");
      }
      align = this.getnum(words[2]);
      if (align < 1) {
        throw new Error("Alignment must be at least 1.");
      }
    }
    // Final computed size is the current offset.
    let finalSize = this.currentStruct.offset;
    if (align !== undefined) {
      // Round up to the next multiple of align.
      finalSize = Math.ceil(finalSize / align) * align;
      this.currentStruct.align = align;
    }
    debug("handleEndStruct finalSize", finalSize)
    this.currentStruct.size = finalSize;

    // If this is an extension struct, update the parent's extensionSize.
    if (this.currentStruct.parent) {
      const parentName = this.currentStruct.parent;
      const parentStruct = this.structs.get(parentName);
      const extSize = this.currentStruct.size;
      // If parent's extensionSize is not defined or this extension is larger, update it.
      if (!parentStruct.extensionSize || extSize > parentStruct.extensionSize) {
        parentStruct.extensionSize = extSize;
      }
      // Also register this extension's labels under a combined name.
      this.structs.set(`${parentName}.${this.currentStruct.name}`, this.currentStruct);
      // Register by short name so resolveStructMember can find child struct (e.g. NewStruct when resolving TestStruct.NewStruct.new).
      this.structs.set(this.currentStruct.name, this.currentStruct);
      debug(`handleEndStruct defined extension struct: "${this.currentStruct.name}" extending "${parentName}", size ${finalSize}`);
    } else {
      // Normal (non-extension) struct: store it by its name.
      this.structs.set(this.currentStruct.name, this.currentStruct);
      debug(`handleEndStruct defined struct: "${this.currentStruct.name}", size ${finalSize}`);
    }
    // Restore the previous PC.
    if (this.savedPCStack.length > 0) {
      this.snespos = this.savedPCStack.pop()!;
      this.startpos = this.snespos;
      this.realsnespos = this.snespos;
      this.realstartpos = this.snespos;
    }
    // Clear current struct.
    this.currentStruct = null;
  }

  /**
   * Resolves a struct label reference to its base address.
   * @param {string} labelRef The label reference to resolve.
   * @returns {number} The resolved base address.
   */
  resolveStructLabel(labelRef: string): number {
    debug("resolveStructLabel", labelRef)

    // First check if the reference contains dots that might indicate a parent-extension relationship
    const refParts = labelRef.split(".");
    if (refParts.length === 2 && !labelRef.includes("[")) {
      debug("resolveStructLabel parent.extension reference", refParts)
      // This could be a parent.extension reference
      const parentName = refParts[0];
      const extensionName = refParts[1];

      // Check if parent exists
      if (this.structs.has(parentName)) {
        const parentDef = this.structs.get(parentName);
        // Check if the extension exists as a struct
        if (this.structs.has(labelRef) && this.structs.get(labelRef).parent === parentName) {
          // This is a valid parent.extension reference
          // Return the parent's base address + parent's size
          debug(`resolveStructLabel parent.extension reference: ${parentName}.${extensionName}, base=${parentDef.base}, size=${parentDef.size}`);
          return parentDef.base + parentDef.size;
        }
      }
    }

    // Next, if the entire reference exists in our struct map, assume it's a full struct reference.
    if (this.structs.has(labelRef)) {
      debug("resolveStructLabel found entire reference =", labelRef)
      return this.structs.get(labelRef).base;
    }

    // Example labelRef: "ObjectList.PosY" or "ObjectList[2].PosY"
    // Check if an array index is specified, e.g. "TestStruct.NewStruct[2].new"
    // Otherwise, check if an array index is specified, e.g. "TestStruct[2].member"
    let arrayIndex = 0;
    let candidate = labelRef;
    let extraMember = "";
    const arrayRegex = /^(.*?)\[(\d+)](.*)$/;
    const arrayMatch = candidate.match(arrayRegex);
    if (arrayMatch) {
      candidate = arrayMatch[1];
      arrayIndex = Number.parseInt(arrayMatch[2], 10);
      extraMember = arrayMatch[3];
      if (extraMember.startsWith(".")) {
        extraMember = extraMember.substring(1);
      }
    }

    debug("resolveStructLabel candidate", candidate)
    debug("resolveStructLabel arrayIndex", arrayIndex)
    debug("resolveStructLabel extraMember", extraMember)
    // Split candidate by dot
    const parts = candidate.split(".");
    // Try to find the longest prefix that is a defined struct.
    for (let i = parts.length; i >= 1; i--) {
      const potential = parts.slice(0, i).join(".");
      if (this.structs.has(potential)) {
        const def = this.structs.get(potential);
        // Everything after the prefix (plus any extraMember from an array index) is the member name.
        const memberPart = parts.slice(i).join(".");
        const memberName = memberPart + (extraMember ? (memberPart ? "." : "") + extraMember : "");

        // Calculate the effective struct size, accounting for extensions and alignment
        const baseStructSize = def.size;
        let effectiveSize = baseStructSize;

        // Check if the struct has an alignment that would affect its effective size
        if (def.align) {
          // Adjust to the next multiple of the alignment
          const alignedSize = Math.ceil(baseStructSize / def.align) * def.align;
          debug(`resolveStructLabel struct has alignment: ${def.align}, adjusting size from ${baseStructSize} to ${alignedSize}`);
          effectiveSize = alignedSize;
        }

        // Find the largest extension of this struct
        let maxExtensionSize = 0;
        for (const [_structName, structDef] of this.structs.entries()) {
          if (structDef.parent === potential && structDef.size > maxExtensionSize) {
            maxExtensionSize = structDef.size;
          }
        }

        // If we have extensions, add the largest one's size to our effective size
        if (maxExtensionSize > 0) {
          debug(`resolveStructLabel maxExtensionSize: ${maxExtensionSize}, adding to effectiveSize: ${effectiveSize} -> ${effectiveSize + maxExtensionSize}`);
          effectiveSize += maxExtensionSize;
        }

        // If no member was specified, this is a reference to the struct itself.
        // But we still need to account for array indexing.
        if (memberName.trim() === "") {
          if (arrayIndex > 0) {
            // For array indexing without a member, return base + (index * size)
            const arrayAddress = def.base + (arrayIndex * effectiveSize);
            debug(`resolveStructLabel array indexing without member: ${def.base} + (${arrayIndex} * ${effectiveSize}) = ${arrayAddress}`);
            return arrayAddress;
          } else {
            debug("resolveStructLabel no memberName =", def.base, "/", def.base.toString(16));
            return def.base;
          }
        }

        // Print all struct labels for debugging
        debug("resolveStructLabel struct labels for", potential);
        for (const [key, value] of def.labels.entries()) {
          debug(`  ${key}: ${value}`);
        }

        // When accessing a nested member, we need to parse the member path to get the correct offset
        // For example: for "DMA.size" we need just the offset of "size"
        // and NOT include the sizes of "size_low" and "size_high"
        const memberParts = memberName.split(".");
        const topLevelMember = memberParts[0];

        // Check if the top-level member exists in the struct
        if (!def.labels.has(topLevelMember)) {
          throw new Error(`Member '${topLevelMember}' not defined in struct '${potential}'.`);
        }

        // Get the offset of the top-level member only
        const offset = def.labels.get(topLevelMember);

        // Debug the exact member we're looking up and its offset
        debug(`resolveStructLabel looking up member "${topLevelMember}" with offset ${offset}`);

        let finalAddress: number;

        if (def.parent) {
          debug("resolveStructLabel parent", def.parent);
          const parentDef = this.structs.get(def.parent);
          if (!parentDef) {
            throw new Error(`Parent struct '${def.parent}' not defined for extension '${potential}'.`);
          }

          // Determine parent's aligned size if it has alignment
          let parentSize = parentDef.size;
          if (parentDef.align) {
            parentSize = Math.ceil(parentSize / parentDef.align) * parentDef.align;
            debug(`resolveStructLabel parent has alignment: ${parentDef.align}, adjusted size: ${parentSize}`);
          }

          // For extension struct array members, we need to:
          // 1. Start at the base address
          // 2. Add parent size once (to get to the extension part)
          // 3. For array indexing, multiply index by the extension size only
          // 4. Add offset to the specific member
          if (arrayIndex === 0) {
            // For the first instance, we need to add the parent size to get to the extension
            finalAddress = parentDef.base + parentSize + offset;
            debug(`resolveStructLabel extension struct with no array: ${parentDef.base} + ${parentSize} + ${offset} = ${finalAddress}`);
          } else {
            // For array indexing, use parent size once plus array index * extension size
            finalAddress = parentDef.base + parentSize + (arrayIndex * def.size) + offset;
            debug(`resolveStructLabel extension struct with array: ${parentDef.base} + ${parentSize} + (${arrayIndex} * ${def.size}) + ${offset} = ${finalAddress}`);
          }
        } else {
          // For regular structs, use the aligned struct size for array indexing
          debug("resolveStructLabel no parent finalAddress:", def.base, "+", "(", arrayIndex, "*", effectiveSize, ")" , "+", offset);
          finalAddress = def.base + (arrayIndex * effectiveSize) + offset;
        }
        debug("resolveStructLabel =", finalAddress, "/", finalAddress.toString(16));
        return finalAddress;
      }
    }
    throw new Error(`Struct not defined in reference: ${labelRef}`);
  }

  /**
   * Evaluates a range expression and returns the result.
   * @param {string} expr The expression to evaluate.
   * @returns {number} The result of the expression.
   */
  evaluateRangeExpression(expr: string): number {
    debug("assemlber evaluateRangeExpression", expr)
    expr = expr.trim();
    // Try evaluating the expression numerically.
    try {
      const result = this.mathCore.math(expr);
      if (result && !Number.isNaN(result)) {
        return result;
      }
    } catch (error) {}
    // If that fails, assume it's a static label.
    // (Pass 'true' to require that the label be static.)
    return this.getLabelValue(expr, true);
  }

  /**
   * Handles the `incbin` directive.
   * @param {string[]} words The words from the `incbin` directive.
   */
  handleIncbin(words: string[]): void {
    debug("handleIncbin", words)
    // Check for deprecated target syntax with "->"
    let targetLocationSpecified = false;
    let targetLocation: string | null = null;
    const arrowIndex = words.indexOf("->");
    if (arrowIndex !== -1) {
      targetLocationSpecified = true;
      if (arrowIndex + 1 >= words.length) {
        throw new Error("incbin '->' syntax requires a target location.");
      }
      targetLocation = words[arrowIndex + 1];
      debug("handleIncbin arrow syntax targetLocation", targetLocation)
      // Remove the arrow and target from the tokens
      words = words.slice(0, arrowIndex);
    }

    // Parse filename and range
    const filenameWithRange = words[1];
    debug("handleIncbin filenameWithRange", filenameWithRange);
    let filename: string;
    let rangeStr: string | null = null;
    const colonIndex = filenameWithRange.indexOf(":");
    if (colonIndex !== -1) {
      filename = filenameWithRange.substring(0, colonIndex);
      rangeStr = filenameWithRange.substring(colonIndex + 1);
    } else {
      filename = filenameWithRange;
    }
    // Remove quotes from filename if present
    filename = filename.replace(/^"(.*)"$/, "$1");

    // Read the file
    const fileData: Uint8Array = this.readFile(filename) as Uint8Array;
    if (!fileData) {
      throw new Error(`Failed to read file: ${filename}`);
    }

    // Determine range to copy
    let startOffset = 0;
    let endOffset = fileData.length;
    if (rangeStr) {
      // Use new ".." syntax if present, otherwise try deprecated "-" syntax
      let parts: string[];
      if (rangeStr.indexOf("..") !== -1) {
        parts = rangeStr.split("..");
      } else if (rangeStr.indexOf("-") !== -1) {
        parts = rangeStr.split("-");
      } else {
        throw new Error(`Invalid range specification: ${rangeStr}`);
      }
      if (parts[0] === "" || parts[1] === "") {
        throw new Error(`Invalid range specification: ${rangeStr}`);
      }
      startOffset = this.evaluateRangeExpression(parts[0]);
      endOffset = this.evaluateRangeExpression(parts[1]);
      // A value of 0 for endOffset means "until EOF"
      if (endOffset === 0) {
        endOffset = fileData.length;
      }
    }

    if (startOffset > endOffset || startOffset < 0 || startOffset > fileData.length) {
      throw new Error(`Start offset ${startOffset} out of bounds for file ${filename}`);
    }
    if (endOffset < startOffset || endOffset > fileData.length) {
      throw new Error(`End offset ${endOffset} out of bounds for file ${filename}`);
    }

    const incbinData = fileData.slice(startOffset, endOffset);
    debug(`handleIncbin copying ${incbinData.length} bytes from '${filename}' (offset ${startOffset} to ${endOffset}) at ${this.snespos.toString(16)} (PC: ${this.snestopc(this.realsnespos & 0xFFFFFF).toString(16)})`);

    if (targetLocationSpecified) {
      debug("handleIncbin targetLocation", targetLocation)
      // Save current position
      this.handlePushPC();

      let targetAddress: number;
      // Check if target location starts with $ or is a valid number
      if (/^\$?[\dA-Fa-f]+$/.test(targetLocation)) {
        // Handle as numeric address
        targetAddress = this.getnum(targetLocation);
        debug("handleIncbin targetAddress", targetAddress);

        // Set the position for numeric address
        this.snespos = targetAddress;
        this.realsnespos = targetAddress;
        this.startpos = targetAddress;
        this.realstartpos = targetAddress;
      } else {
        // Handle as label name
        // if (this.pass === 0) {
        //   debug("handleIncbin targetLocation is label, pass 0");
        //   // On pass 0, create a freespace block first
        //   // this.handleFreespace("freespace", ["align"]);
        //   // Now that freespace has set snespos, we can set the label
        //   this.setLabel(targetLocation, this.snespos);

        //   // Don't write data on pass 0
        //   this.handlePullPC();
        //   return;
        // } else {
          // On later passes, look up the label's address
          targetAddress = this.getLabelValue(targetLocation, false);
          debug("handleIncbin targetAddress", targetAddress);
          this.snespos = targetAddress;
          this.realsnespos = targetAddress;
          this.startpos = targetAddress;
          this.realstartpos = targetAddress;
        // }
      }

      // Write the data
      for (const byte of incbinData) {
        this.write1(byte);
      }

      // Restore original position
      this.handlePullPC();
    } else {
      // Normal incbin: write at current position
      for (const byte of incbinData) {
        this.write1(byte);
      }
    }

    this.addAddressToLine(this.realsnespos & 0xFFFFFF);
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
  evaluateExpression(expression: string): boolean {
    debug("evaluateExpression", expression)
    // Only resolve defines if the expression contains define syntax
    const resolvedExpr = expression.includes("!") ? this.resolvedefines(expression) : expression;
    debug("evaluateExpression resolvedExpr", resolvedExpr)
    let result: number;
    try {
      result = this.mathCore.math(resolvedExpr);
    } catch (e) {
      throw new Error(`Error evaluating expression "${expression}" (resolved to "${resolvedExpr}"): ${e}`);
    }
    // In our assembler, a condition is true if the result is nonzero.
    debug("evaluateExpression result", result, "=>", result !== 0)
    debug("evaluateExpression =", result !== 0)
    return result !== 0;
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
    debug("resolvedefines defines", this.defines);
    let result = "";
    let index = 0;

    // Handle special case for relative labels
    if (input === "+" || input === "-" || input === "?+" || input === "?-") {
      debug(`resolvedefines handling relative label: ${input}`);
      try {
        if (input === "+") {
          // Handle standard relative labels
          const address = this.findNextLabel("+");
          debug(`resolvedefines ${input} =`, "$" + address.toString(16));
          return "$" + address.toString(16);
        } else if (input === "-") {
          // Handle standard relative labels
          const address = this.findPreviousLabel("-");
          debug(`resolvedefines ${input} =`, "$" + address.toString(16));
          return "$" + address.toString(16);
        } else if (input === "?+") {
          // Handle macro-specific forward relative label
          const address = this.findNextLabel("?+");
          debug("resolvedefines ?+ =", "$" + address.toString(16));
          return "$" + address.toString(16);
        } else if (input === "?-") {
          // Handle macro-specific backward relative label
          const address = this.findPreviousLabel("?-");
          debug("resolvedefines ?- =", "$" + address.toString(16));
          return "$" + address.toString(16);
        }
      } catch (e) {
        // If in pass 0, return a placeholder
        if (this.pass < 2) {
          debug(`resolvedefines pass ${this.pass} < 2, returning placeholder`);
          return "$0000";
        }
        debug(`resolvedefines failed to resolve relative label ${input}: ${e instanceof Error ? e.message : ""} on pass ${this.pass}`);
        throw e;
      }
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

    // Helper function to look up a variable name with priority for loop variables
    const lookupVariable = (varName: string): string | undefined => {
      debug("resolvedefines lookupVariable", varName);

      // First check if this variable is directly defined
      const defineValue = this.defines.get(varName);
      if (defineValue !== undefined) {
        debug(`resolvedefines found variable ${varName} with value ${defineValue}`);
        return defineValue;
      }

      // Check active loops from innermost to outermost (for backward compatibility)
      for (let i = this.whileStatus.length - 1; i >= 0; i--) {
        const loop = this.whileStatus[i];
        if (loop.is_for && loop.for_variable === varName) {
          debug(`resolvedefines found loop variable ${varName} with value ${loop.for_cur}`);
          return loop.for_cur.toString();
        }
      }

      // Not found - return undefined
      return undefined;
    };

    // Special case for direct variable reference like "!i"
    if (input.startsWith("!") && !input.includes(" ") && !input.includes("=") && !input.includes("{")) {
      debug("resolvedefines direct variable reference", input);
      const varName = input.substring(1);
      const value = lookupVariable(varName);

      if (value !== undefined) {
        return value;
      }
    }

    // Special case for macro labels with prefixes #?, ?, #?., ?., ?+, ?-
    // These should be treated as macro labels and not be resolved as defines
    const prefixMatch = input.match(/^(#\?|\?|#\?\.|\?\+|\?-)(.*)/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      const labelName = prefixMatch[2];
      debug("resolvedefines macro label found with prefix", { prefix, labelName });

      const value = this.getLabelValue(labelName, false);

      if (value !== undefined) {
        return value.toString();
      }
    }

    // Check if this is a label reference before checking defines or structs
    // eslint-disable-next-line security/detect-unsafe-regex
    if (input.match(/^\.+\w+|^\w+(\.\w+)*(\[\d+])?(\.\w+)*$/)) {
      debug("resolvedefines checking if input is a label reference", input);
      try {
        // First try to resolve as a label
        const labelValue = this.getLabelValue(input, false);
        debug("resolvedefines labelValue", labelValue);
        if (labelValue !== undefined) {
          debug(`resolvedefines found label ${input} with value ${labelValue}`);
          return labelValue.toString();
        }
      } catch (e) {
        // Not a label, continue to other checks
        debug("resolvedefines not a label, continuing", e);
      }
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
        const value = lookupVariable(defineName);

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
   * Gets a numeric value from an operand.
   * @param {string} operand The operand to get the numeric value of.
   * @returns {number} The numeric value of the operand.
   */
  getnum(operand: string): number {
    debug("getnum", operand)
    // Remove whitespace
    operand = operand.trim();

    // Check if the operand is a simple numeric string (no math, no labels)
    // This is an optimization to avoid unnecessary processing for simple numbers
    if (/^-?\d+$/.test(operand)) {
      // Simple decimal number
      return parseInt(operand, 10);
    } else if (/^\$[\dA-Fa-f]+$/.test(operand)) {
      // Simple hex number
      return parseInt(operand.substring(1), 16);
    } else if (/^%[01]+$/.test(operand)) {
      // Simple binary number
      return parseInt(operand.substring(1), 2);
    }

    // First, expand any defines.
    operand = this.resolvedefines(operand);

    // If immediate, strip the '#' but keep everything else
    if (operand.startsWith("#")) {
      operand = operand.substring(1).trim();
    }

    // If the operand does not start with a literal indicator,
    // assume it is a label or a struct reference.
    if (!operand.match(/^[\d$%]/)) {
      // If it contains a dot or an opening bracket, treat it as a struct reference.
      if (operand.indexOf(".") !== -1 || operand.indexOf("[") !== -1) {
        try {
          const addr = this.resolveStructLabel(operand);
          debug("getnum (struct resolved) =", addr);
          return addr;
        } catch (e) {
          // Fall back to a normal label lookup.
          const labelValue = this.getLabelValue(operand, false);
          debug("getnum (label resolved) =", labelValue, "/", labelValue.toString(16));
          return labelValue;
        }
      } else if (/^\w+$/.test(operand)) {
        // Otherwise, treat the operand as a label.
        const labelValue = this.getLabelValue(operand, false);
        debug("getnum (label resolved) =", labelValue, "/", labelValue.toString(16));
        return labelValue;
      }
    }

    // Otherwise, assume the operand is a literal math expression.
    const value = this.mathCore.math(operand);
    debug("getnum (literal) =", value, "/", value.toString(16));
    return value;
  }

  /**
   * Sets the current pass of assembly.
   * @param {number} pass - The pass number to set.
   */
  setPass(pass: number): void {
    debug("🏁 setPass", pass);
    this.pass = pass;
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
    this.macroLabelInstance = null;

    // Reset the in loop flag
    this.collectingLoop = false;
    this.currentLoop = null;

    // Reset the condition stack
    this.condStack = [];
  }

  /**
   * Completes the current pass, performing any necessary cleanup.
   */
  finishPass(): void {
    debug("finishPass", { targetRom: this.targetRom });
    // TODO Make an option
    // if (this.targetRom && this.targetRom.length > 0) {
      this.updateHeaderAndCRC32();
      debug("finishPass updateHeaderAndCRC32");
    // }
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
   * Checks if a given ROM region is empty.
   * @param {number} start - The starting address of the region to check.
   * @param {number} size - The size of the region to check.
   * @param {number} fsByte - The byte value to check for.
   * @returns {boolean} True if the region is empty, false otherwise.
   */
  isBlockEmpty(start: number, size: number, fsByte: number): boolean {
    debug("isBlockEmpty", { start, size, fsByte });
    for (let i = 0; i < size; i++) {
      if (this.romdata[start + i] !== fsByte) {
        debug("isBlockEmpty false:", this.romdata[start + i], "!==", fsByte);
        return false;
      }
    }
    return true;
  }

  /**
   * Expands an operand string into its expanded form and determines its expected length.
   * @param {string} operand The operand to expand.
   * @returns {{ expanded: string; length: number }} An object containing the expanded operand and its expected length.
   */
  expandOperand(operand: string): { expanded: string; length: number } {
    debug("expandOperand", operand)
    if (!operand) {
      return { expanded: "", length: 2 };
    }
    let expanded = operand.trim()
    let expectedLength = 2; // Default to 2 bytes for most operands
    let forceTwoBytes = false; // Flag to force 2 bytes for bank operations

    try {
      expanded = this.resolvedefines(expanded);
    } catch (e) {
      debug("expandOperand not a define")
    }
    debug("expandOperand: after resolvedefines:", { expanded });
    try {
      expanded = `$${this.resolveStructLabel(expanded).toString(16).toUpperCase()}`;
    } catch (e) {
      debug("expandOperand not a struct label")
    }
    debug("expandOperand: after resolveStructLabel:", { expanded });

    // Check for bank shorthand operations before any other processing
    if (expanded.includes("<:") || expanded.includes("bank(") || expanded.includes("bankbyte(")) {
      forceTwoBytes = true;
      debug("expandOperand detected bank operation, forcing 2 bytes");
    }

    // Try to resolve label references before processing specific addressing modes
    // This handles cases like "label", "label,x", "[label]", etc.
    expanded = this.tryResolveLabelInOperand(expanded);
    debug("expandOperand: after label resolution:", { expanded });

    // Process the operand based on addressing mode
    if (expanded.startsWith("#")) {
      // Immediate mode
      debug("expandOperand immediate mode or pseudo opcode", expanded);
      const inner = expanded.substring(1).trim();

      // Check for bank operations in the inner expression
      if (inner.includes("<:") || inner.includes("bank(") || inner.includes("bankbyte(")) {
        forceTwoBytes = true;
        debug("expandOperand detected bank operation in immediate mode, forcing 2 bytes");
      }

      // Evaluate the inner expression if it's a hex value or numeric expression
      if (inner.startsWith("$")) {
        expectedLength = this.determineValueLength(inner.substring(1), forceTwoBytes);
      } else {
        try {
          const value = this.getnum(inner);
          expectedLength = this.determineValueLength(value, forceTwoBytes);

          // Format the value as a hex literal and reconstruct immediate operand
          const literal = "$" + value.toString(16).toUpperCase();
          expanded = "#" + literal;
        } catch (e) {
          debug(`Failed to evaluate immediate expression: ${inner}`);
        }
      }
    } else if (expanded.includes(",")) {
      // Indexed addressing mode
      debug("expandOperand indexed mode", expanded);
      if (expanded.startsWith("$")) {
        const hexPart = expanded.substring(1, expanded.indexOf(","));
        expectedLength = this.determineValueLength(hexPart);
      }
    } else if (expanded.startsWith("[") && expanded.endsWith("]")) {
      // Indirect addressing mode
      debug("expandOperand indirect addressing mode", expanded);
      expectedLength = 2;
    } else if (expanded.startsWith("$")) {
      // Direct addressing mode
      debug("expandOperand direct addressing mode", expanded);
      const hexPart = expanded.substring(1);
      expectedLength = this.determineValueLength(hexPart);
    } else {
      // Other modes (likely labels)
      debug("expandOperand other mode", expanded);
      expectedLength = 2; // Default for labels
    }

    // Evaluate math expressions
    if (this.isMathExpression(expanded)) {
      try {
        const resolvedValue = this.resolvedefines(expanded);
        const result = this.mathCore.math(resolvedValue);

        if (!Number.isNaN(result)) {
          expanded = "$" + result.toString(16).toUpperCase();
          expectedLength = this.determineValueLength(result, forceTwoBytes);
          debug(`Evaluated math expression in define: ${resolvedValue} = ${expanded}`);
        }
      } catch (error) {
        debug(`Math evaluation skipped for expression: ${expanded}`);
      }
    }

    // Force 2 bytes if needed
    if (forceTwoBytes) {
      expectedLength = 2;
    }

    debug("expandOperand =", expanded, "length =", expectedLength);
    return { expanded, length: expectedLength };
  }

  /**
   * Determines the expected length based on a numeric value
   * @param {string|number} value The value to check (either hex string or numeric)
   * @param {boolean} [forceTwoBytes] Whether to force 2 bytes
   * @returns {number} The expected length in bytes
   */
  determineValueLength(value: string | number, forceTwoBytes?: boolean): number {
    debug("determineValueLength", value, forceTwoBytes);
    // Validate input
    if (typeof value !== "string" && typeof value !== "number") {
      throw new Error(`Invalid value type for length determination: ${typeof value}`);
    }
    if (Number.isNaN(value)) {
      throw new Error(`Invalid value for length determination: ${value}`);
    }

    if (typeof value === "string" && value.trim() === "") {
      return 1;
    }

    if (forceTwoBytes) {
      return 2;
    }

    // Convert the value to a hex string and handle each case
    let hexString: string;

    if (typeof value === "number") {
      // Convert number to hex string WITHOUT leading zeros
      hexString = value.toString(16).toUpperCase();
    } else if (typeof value === "string") {
      // If already a string, strip any '$' prefix if present
      hexString = value.startsWith("$") ? value.substring(1) : value;
    }

    // Get the length based on number of hex digits (2 hex digits = 1 byte)
    if (hexString.length <= 2) {
      return 1; // 1 byte (zero page)
    } else if (hexString.length <= 4) {
      return 2; // 2 bytes (absolute)
    } else {
      return 3; // 3 bytes (long)
    }
  }

  /**
   * Checks if a string contains math operators
   * @param {string} expression - The expression to check
   * @returns {boolean} True if the expression contains math operators
   */
  isMathExpression(expression: string): boolean {
    if (!expression || typeof expression !== "string") {
      return false;
    }
    return expression.includes("+") ||
           expression.includes("-") ||
           expression.includes("*") ||
           expression.includes("/") ||
           expression.includes("&") ||
           expression.includes("|") ||
           expression.includes("^") ||
           expression.includes("<<") ||
           expression.includes(">>") ||
           expression.includes("(");
  }

  /**
   * Helper method to try resolving labels in different addressing modes
   * @param {string} operand - The operand to process
   * @returns {string} The operand with labels resolved to their values
   */
  tryResolveLabelInOperand(operand: string): string {
    debug("tryResolveLabelInOperand", operand);

    // Handle immediate mode (#label)
    if (operand.startsWith("#")) {
      const inner = operand.substring(1).trim();
      if (!inner.match(/^[\d$%(]/) && !inner.includes(",")) {
        try {
          const labelValue = this.getLabelValue(inner, false);
          if (labelValue !== 0 || this.labelTable.has(inner) || this.labelTable.has(`${this.currentNamespace}_${inner}`)) {
            debug("tryResolveLabelInOperand immediate mode", inner, "labelValue", labelValue, "/", labelValue.toString(16).toUpperCase());
            return "#$" + labelValue.toString(16).toUpperCase();
          }
        } catch (e) {
          debug(`tryResolveLabelInOperand label resolution failed for immediate: ${inner}`);
        }
      }
      return operand;
    }

    // Handle indirect mode ([label])
    if (operand.startsWith("[") && operand.endsWith("]")) {
      const inner = operand.substring(1, operand.length - 1).trim();
      if (!inner.match(/^[\d$%(]/) && !inner.includes(",")) {
        try {
          const labelValue = this.getLabelValue(inner, false);
          if (labelValue !== 0 || this.labelTable.has(inner) || this.labelTable.has(`${this.currentNamespace}_${inner}`)) {
            return "[$" + labelValue.toString(16).toUpperCase() + "]";
          }
        } catch (e) {
          debug(`tryResolveLabelInOperand label resolution failed for indirect: ${inner}`);
        }
      }
      return operand;
    }

    // Handle indexed mode (label,x or label,y or label,s)
    if (operand.includes(",")) {
      const lastCommaIndex = operand.lastIndexOf(",");
      const basePart = operand.substring(0, lastCommaIndex).trim();
      const indexPart = operand.substring(lastCommaIndex).trim(); // Includes the comma

      if (!basePart.match(/^[\d$%(]/)) {
        try {
          const labelValue = this.getLabelValue(basePart, false);
          if (labelValue !== 0 || this.labelTable.has(basePart) || this.labelTable.has(`${this.currentNamespace}_${basePart}`)) {
            return "$" + labelValue.toString(16).toUpperCase() + indexPart;
          }
        } catch (e) {
          debug(`tryResolveLabelInOperand label resolution failed for indexed: ${basePart}`);
        }
      }
      return operand;
    }

    // Handle direct label (no special characters)
    if (!operand.match(/^[\d#$%([]/) && !operand.includes(",")) {
      try {
        const labelValue = this.getLabelValue(operand, false);
        if (labelValue !== 0 || this.labelTable.has(operand) || this.labelTable.has(`${this.currentNamespace}_${operand}`)) {
          return "$" + labelValue.toString(16).toUpperCase();
        }
      } catch (e) {
        debug(`tryResolveLabelInOperand label resolution failed for direct: ${operand}`);
      }
    }

    return operand;
  }

  /**
   * Gets the size of a struct or extension.
   * @param {string} identifier The identifier of the struct or extension.
   * @param {boolean} [baseOnly] If true, returns only the base size without extensions.
   * @returns {number} The size of the struct or extension.
   * @throws {Error} If the struct or extension doesn't exist.
   */
  getObjectSize(identifier: string, baseOnly: boolean = false): number {
    debug("getObjectSize", identifier, baseOnly)
    // For backwards compatibility, remove surrounding quotes.
    if (identifier.startsWith('"') && identifier.endsWith('"')) {
      identifier = identifier.substring(1, identifier.length - 1);
    }
    if (!this.structs.has(identifier)) {
      throw new Error(`Struct '${identifier}' doesn't exist.`);
    }
    const def = this.structs.get(identifier);

    // If baseOnly is true, always return just the base size
    if (baseOnly) {
      debug("getObjectSize (baseOnly) =", def.size)
      return def.size;
    }

    // For non-extended structs, objectsize is the base size plus the extension size (if any).
    // For an extension, objectsize is just its own size.
    let value = 0
    if (!def.parent) {
      value = def.size + (def.extensionSize || 0);
    } else {
      value = def.size;
    }
    debug("getObjectSize =", value)
    return value
  }

  /**
   * Updates the header checksum (16-bit) and CRC32.
   * For LoROM, the header is at 0x7FC0; for HiROM (and exhirom) at 0xFFC0.
   */
  updateHeaderAndCRC32(): void {
    debug("updateHeaderAndCRC32");
    let headerOffset: number;
    // TODO: Validate header offset for other mappers.
    if (this.mapper === "lorom") {
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

    // Calculate the 16-bit checksum (sum of all bytes modulo 0x10000).
    // Exclude the 4 checksum/complement bytes at 0x1C..0x1F so the result is deterministic.
    let checksum = 0;
    const skipStart = headerOffset + 0x1C;
    const skipEnd = headerOffset + 0x20;
    for (let i = 0; i < this.romdata.length; i++) {
      const byte = (i >= skipStart && i < skipEnd) ? 0 : (this.romdata[i] & 0xFF);
      checksum = (checksum + byte) & 0xFFFF;
    }
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

    // Save current state
    const previousFile = this.currentFile;
    this.includeStack.push(previousFile);

    // Read and process the file
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

      // Process the file line by line
      const lines = content.split("\n");
      for (const line of lines) {
        this.processCommand(line);
      }
    } catch (error) {
      debug("assemblefile error 💥", error);
    } finally {
      // Restore state
      this.currentFile = this.includeStack.pop() || "";
    }
  }

  /**
   * Handles character mapping like `"A" = 0x42` and assigns the value to the character in `characterMappings`.
   * @param {string[]} words The processed words to use as key, `=`, value.
   * @throws {Error} If the format is incorrect.
   */
  handleCharacterMapping(words: string[]): void {
    debug("handleCharacterMapping", words);
    if (words.length !== 3) {
      throw new Error("Character mapping requires format: 'char' = value");
    }
    const char = words[0].replace(/["']/g, "");
    const value = this.getnum(words[2]);
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
   * Splits a command into words, preserving quoted strings.
   * @param {string} command - The command to split.
   * @returns {string[]} - The command split into words.
   */
  splitCommandIntoWords(command: string): string[] {
    const words: string[] = [];
    let currentWord = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < command.trim().length; i++) {
      const char = command.trim()[i];

      // Handle quotes
      if ((char === '"' || char === "'") && (i === 0 || command.trim()[i-1] !== "\\")) {
        if (!inQuotes) {
          // Starting a quoted section
          inQuotes = true;
          quoteChar = char;
          currentWord += char;
        } else if (char === quoteChar) {
          // Ending a quoted section
          inQuotes = false;
          currentWord += char;
        } else {
          // Different quote character inside quotes
          currentWord += char;
        }
      } else if (/\s/.test(char) && !inQuotes) {
        // Whitespace outside quotes - end current word
        if (currentWord) {
          words.push(currentWord);
          currentWord = "";
        }
      } else {
        // Regular character
        currentWord += char;
      }
    }

    // Add the last word if there is one
    if (currentWord) {
      words.push(currentWord);
    }

    return words;
  }

  /**
   * Converts a SNES address to a PC offset.
   * Returns -1 if the address is invalid.
   * @param {number} addr - The SNES address to convert.
   * @returns {number} The PC offset.
   */
  snestopc = (addr: number): number => {
    if (addr < 0 || addr > 0xFFFFFF) return -1; // not 24-bit

    if (this.mapper === "lorom") {
      // The low pages ($0000-$7FFF) of banks 70-7D are reserved for SRAM.
      if (
        (addr & 0xFE0000) === 0x7E0000 || // WRAM
        (addr & 0x408000) === 0x000000 || // hardware registers, RAM mirrors, etc.
        (addr & 0x708000) === 0x700000 // SRAM (low parts of banks 70-7D)
      ) {
        return -1;
      }
      addr = ((addr & 0x7F0000) >> 1) | (addr & 0x7FFF);
      return addr;
    }

    if (this.mapper === "hirom") {
      if (
        (addr & 0xFE0000) === 0x7E0000 ||
        (addr & 0x408000) === 0x000000
      ) {
        return -1;
      }
      return addr & 0x3FFFFF;
    }

    if (this.mapper === "exlorom") {
      if (
        (addr & 0xF00000) === 0x700000 ||
        (addr & 0x408000) === 0x000000
      ) {
        return -1;
      }
      if (addr & 0x800000) {
        addr = ((addr & 0x7F0000) >> 1) | (addr & 0x7FFF);
      } else {
        addr = (((addr & 0x7F0000) >> 1) | (addr & 0x7FFF)) + 0x400000;
      }
      return addr;
    }

    if (this.mapper === "exhirom") {
      if (
        (addr & 0xFE0000) === 0x7E0000 ||
        (addr & 0x408000) === 0x000000
      ) {
        return -1;
      }
      if ((addr & 0xC00000) !== 0xC00000) {
        return (addr & 0x3FFFFF) | 0x400000;
      }
      return addr & 0x3FFFFF;
    }

    if (this.mapper === "sfxrom") {
      // Emulate GSU1 – extra ROM data is not supported in SuperFX mode.
      if (
        (addr & 0x600000) === 0x600000 ||
        (addr & 0x408000) === 0x000000 ||
        (addr & 0x800000) === 0x800000
      ) {
        return -1;
      }
      if (addr & 0x400000) {
        return addr & 0x3FFFFF;
      } else {
        return ((addr & 0x7F0000) >> 1) | (addr & 0x7FFF);
      }
    }

    if (this.mapper ===  "sa1rom") {
      if ((addr & 0x408000) === 0x008000) {
        return this.sa1banks[(addr & 0xE00000) >> 21] | ((addr & 0x1F0000) >> 1) | (addr & 0x007FFF);
      }
      if ((addr & 0xC00000) === 0xC00000) {
        return this.sa1banks[((addr & 0x100000) >> 20) | ((addr & 0x200000) >> 19)] | (addr & 0x0FFFFF);
      }
      return -1;
    }

    if (this.mapper === "bigsa1rom") {
      if ((addr & 0xC00000) === 0xC00000) {
        return (addr & 0x3FFFFF) | 0x400000;
      }
      if ((addr & 0xC00000) === 0x000000 || (addr & 0xC00000) === 0x800000) {
        if ((addr & 0x008000) === 0) {
          return -1;
        }
        return ((addr & 0x800000) >> 2) | ((addr & 0x3F0000) >> 1) | (addr & 0x7FFF);
      }
      return -1;
    }

    if (this.mapper === "norom") {
      return addr;
    }

    return -1;
  }

  /**
   * Converts a PC offset to a SNES address.
   * Returns -1 if the address is invalid.
   * @param {number} addr - The PC offset to convert.
   * @returns {number} The SNES address.
   */
  pctosnes = (addr: number): number => {
    if (addr < 0) return -1;

    if (this.mapper === "lorom") {
      if (addr >= 0x400000) return -1;
      addr = (((addr << 1) & 0x7F0000) | (addr & 0x7FFF)) | 0x8000;
      return addr | 0x800000;
    }

    if (this.mapper === "hirom") {
      if (addr >= 0x400000) return -1;
      return addr | 0xC00000;
    }

    if (this.mapper === "exlorom") {
      if (addr >= 0x800000) return -1;
      if (addr & 0x400000) {
        addr -= 0x400000;
        addr = (((addr << 1) & 0x7F0000) | (addr & 0x7FFF)) | 0x8000;
        return addr;
      } else {
        addr = (((addr << 1) & 0x7F0000) | (addr & 0x7FFF)) | 0x8000;
        return addr | 0x800000;
      }
    }

    if (this.mapper === "exhirom") {
      if (addr >= 0x800000) return -1;
      if (addr & 0x400000) return addr;
      return addr | 0xC00000;
    }

    if (this.mapper === "sa1rom") {
      if (addr >= 0x800000) return -1;
      for (let i = 0; i < 8; i++) {
        if (this.sa1banks[i] === (addr & 0x700000)) {
          return 0x008000 | (i << 21) | (((addr & 0x0F8000)) << 1) | (addr & 0x7FFF);
        }
      }
      /* c8 ignore next 2 */
      return -1;
    }

    if (this.mapper === "bigsa1rom") {
      if (addr >= 0x800000) {
        return -1;
      }
      if ((addr & 0x400000) === 0x400000) {
        return addr | 0xC00000;
      }
      if ((addr & 0x600000) === 0x000000) {
        return ((addr << 1) & 0x3F0000) | 0x8000 | (addr & 0x7FFF);
      }
      if ((addr & 0x600000) === 0x200000) {
        return 0x800000 | (((addr << 1) & 0x3F0000)) | 0x8000 | (addr & 0x7FFF);
      }
      /* c8 ignore next 2 */
      return -1;
    }

    if (this.mapper === "sfxrom") {
      if (addr >= 0x200000) return -1;
      return (((addr << 1) & 0x7F0000) | (addr & 0x7FFF)) | 0x8000;
    }

    if (this.mapper === "norom") {
      return addr;
    }
    return -1;
  }

  /**
   * Ensures the SNES position is valid, and resets it if it's not.
   */
  verifysnespos(): void {
    // debug(`verifysnespos: snespos: ${this.snespos.toString(16)} realsnespos: ${this.realsnespos.toString(16)}`);
    if (this.snespos < 0 || this.realsnespos < 0) {
      debug("verifysnespos 💥 missing ORG directive, resetting SNES position");
      this.snespos = 0x008000;
      this.realsnespos = 0x008000;
      this.startpos = 0x008000;
      this.realstartpos = 0x008000;
    }
  }

  /**
   * Adjusts memory addresses based on the ROM type.
   * @param {number} inaddr The address to adjust.
   * @param {number} step The number of bytes to step.
   * @returns {number} The adjusted address.
   */
  fixsnespos(inaddr: number, step: number = 0): number {
    // Calculate the new address after adding the step
    const newAddr = inaddr + step;

    // Check if we're crossing a bank boundary (if the bank number changes)
    if ((inaddr & 0xFF0000) !== (newAddr & 0xFF0000)) {
      switch (this.mapper) {
        case "lorom":
          // Keep the bank byte but wrap the address and add 0x8000
          return (newAddr & 0xFF0000) | ((newAddr & 0xFFFF) + 0x8000);
        case "hirom":
          if ((inaddr & 0x400000) === 0) {
            return (newAddr & 0xFF0000) | ((newAddr & 0xFFFF) + 0x8000);
          }
          return newAddr;
        case "exlorom":
        case "bigsa1rom":
          return this.pctosnes(this.snestopc(inaddr) + step);
        case "exhirom":
          if ((inaddr & 0x400000) === 0) {
            return (newAddr & 0xFF0000) | ((newAddr & 0xFFFF) + 0x8000);
          }
          return newAddr;
        case "sfxrom":
          if ((inaddr & 0x400000) === 0) {
            return (newAddr & 0xFF0000) | ((newAddr & 0xFFFF) + 0x8000);
          }
          return newAddr;
        case "sa1rom":
          if ((inaddr & 0x400000) === 0) {
            return (newAddr & 0xFF0000) | ((newAddr & 0xFFFF) + 0x8000);
          }
          return newAddr;
        case "norom":
          return newAddr;
        default:
          throw new Error(`Unknown mapper type: ${this.mapper}`);
      }
    } else {
      // No bank crossing, just return the new address
      return newAddr;
    }
  }

  /**
   * Begins the collection of loop commands.
   * @param {string} type The type of loop to begin ("for" or "while").
   * @param {string} command The command to begin the loop with.
   */
  beginLoopCollection(type: "for" | "while", command: string): void {
    debug("beginLoopCollection", type, command);
    // Check for inline for loop with colon separators
    if (type === "for" && command.includes(":")) {
      // This is an inline for loop like "for i = 0..5 : db 1 : endfor"
      const parts = command.split(":");
      const forDeclaration = parts[0].trim();
      const forMatch = forDeclaration.match(/^\s*for\s+(\w+)\s*=\s*([^.]+)\.\.([^\s:]+)/i);

      if (forMatch) {
        const variable = forMatch[1];
        const startExpr = forMatch[2].trim();
        const endExpr = forMatch[3].trim();

        // Process the inline for loop directly without collecting
        const start = this.getnum(this.resolvedefines(startExpr));
        const end = this.getnum(this.resolvedefines(endExpr));

        // Save the original variable value before we modify it
        const originalValue = this.defines.get(variable);

        // Execute the inline loop
        if (start < end) {
          for (let i = start; i < end; i++) {
            // Set the variable
            this.defines.set(variable, i.toString());

            // Process each command in the inline for loop
            for (let j = 1; j < parts.length; j++) {
              const cmd = parts[j].trim();
              if (cmd !== "endfor") {
                this.processCommand(cmd);
              }
            }
          }
        }

        // Restore original value
        if (originalValue !== undefined) {
          debug(`beginLoopCollection restoring ${variable} to ${originalValue}`);
          this.defines.set(variable, originalValue);
        } else {
          debug(`beginLoopCollection deleting ${variable}`);
          this.defines.delete(variable);
        }

        return; // Skip the normal loop collection
      }
    }

    // Regular non-inline loop
    // Create a new loop block
    const newLoop: LoopBlock = {
      type,
      condition: command,
      commands: [],
      startLine: this.currentLine
    };

    // Extract variable name for for loops
    if (type === "for") {
      debug("beginLoopCollection for loop", command);
      const forMatch = command.match(/^\s*for\s+(\w+)\s*=\s*([^.]+)\.\.([^\s:]+)/i);
      if (forMatch) {
        debug("beginLoopCollection for loop match", forMatch);
        newLoop.variable = forMatch[1];

        // Pre-parse start and end (optional, can be done during execution)
        try {
          const startExpr = forMatch[2].trim();
          const endExpr = forMatch[3].trim();
          debug("beginLoopCollection for loop start", startExpr);
          debug("beginLoopCollection for loop end", endExpr);

          // Check if expressions are simple numeric values
          if (/^-?\d+$/.test(startExpr)) {
            newLoop.start = Number.parseInt(startExpr, 10);
          } else {
            newLoop.start = this.getnum(this.resolvedefines(startExpr));
          }

          if (/^-?\d+$/.test(endExpr)) {
            newLoop.end = Number.parseInt(endExpr, 10);
          } else {
            newLoop.end = this.getnum(this.resolvedefines(endExpr));
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
    // Parse the for loop condition
    const forMatch = forBlock.condition.match(/^\s*for\s+(\w+)\s*=\s*([^.]+)\.\.([^\s:]+)/i);
    if (!forMatch) {
      debug("executeForLoop invalid for loop syntax:", forBlock.condition);
      return;
    }

    const variable = forBlock.variable || forMatch[1];
    const startExpr = forMatch[2].trim();
    const endExpr = forMatch[3].trim();

    // Evaluate start and end expressions
    // If expressions are already numeric, use them directly, otherwise resolve defines
    const startDefinesResolved = /^-?\d+$/.test(startExpr) ? startExpr : this.resolvedefines(startExpr);
    const endDefinesResolved = /^-?\d+$/.test(endExpr) ? endExpr : this.resolvedefines(endExpr);
    const start = this.getnum(startDefinesResolved);
    const end = this.getnum(endDefinesResolved);

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
          if (typeof cmd === "string") {
            // Process the command with our variable set in the defines map
            this.processCommand(cmd);
          } else {
            // Execute nested loops
            this.executeLoopBlock(cmd);
          }
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
    // Extract the condition expression
    const condMatch = whileBlock.condition.match(/^\s*while\s+(.+)/i);
    if (!condMatch) {
      debug("executeWhileLoop invalid while loop syntax:", whileBlock.condition);
      return;
    }

    const conditionExpr = condMatch[1].trim();
    let iteration = 0;
    const MAX_ITERATIONS = 10000; // Safety limit to prevent infinite loops

    // Track variables modified in the loop body
    const loopVars = new Set<string>();
    const originalValues = new Map<string, string | undefined>();

    // Continue looping as long as the condition evaluates to true
    while (this.evaluateExpression(conditionExpr) && iteration < MAX_ITERATIONS) {
      // Process each command in the loop body
      for (const cmd of whileBlock.commands) {
        if (typeof cmd === "string") {
          // Check if this is a variable definition
          if (this.isDefineStatement(cmd)) {
            const varName = this.getDefineVariable(cmd);
            if (varName && !loopVars.has(varName)) {
              // First time seeing this variable in the loop
              loopVars.add(varName);
              // Save its original value
              originalValues.set(varName, this.defines.get(varName));
            }
          }

          // Process the command
          this.processCommand(cmd);
        } else {
          // Execute nested loops
          this.executeLoopBlock(cmd);
        }
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

  /**
   * Checks if a line is a define statement.
   * @param {string} line The line to check.
   * @returns {boolean} True if the line is a define statement, false otherwise.
   */
  isDefineStatement(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith("!") &&
           !trimmed.startsWith("! ") &&
           trimmed.includes("=");
  }

  /**
   * Extracts the variable name from a define statement.
   * @param {string} line The line to extract the variable name from.
   * @returns {string | undefined} The variable name or null if the line is not a define statement.
   */
  getDefineVariable(line: string): string | null {
    const match = line.trim().match(/^!([A-Z_a-z]\w*)\s*=/);
    return match ? match[1] : undefined;
  }

  /**
   * Process a line from a macro expansion.
   * @param {string} line The line to process from a macro.
   */
  processMacroLine(line: string): void {
    debug("processMacroLine", line);

    // Check for labels that start with ? or # (indicating macro-scoped labels)
    if (/^\s*[#?][\w+.\-]+:/.test(line)) {
      debug("processMacroLine found potential macro label definition", line);

      // Special handling for ?+: and ?-: relative labels
      if (line.trim().startsWith("?+:") || line.trim().startsWith("?-:")) {
        const labelChar = line.trim();
        const remainder = line.trim().substring(3).trim(); // Skip ?+: or ?-:

        debug("processMacroLine found macro relative label", { labelChar, remainder });

        // Handle the relative label using the existing functionality
        this.handleRelativeLabel(labelChar);

        // Process any remaining part of the line
        if (remainder) {
          this.processCommand(remainder);
        }
        return;
      }

      // Extract the label name (preserving the ? or # prefix)
      const match = line.match(/^\s*([#?][\w+.\-]+):/);
      if (match) {
        const labelName = match[1];
        const remainder = line.substring(match[0].length).trim();
        debug("processMacroLine found macro label definition with colon", { labelName, remainder });

        // Set the label (isMacroLabel=true for both ? and # labels)
        this.setLabel(labelName, undefined, false, true);

        // Process the remainder of the line if any
        if (remainder) {
          this.processCommand(remainder);
        }
        return;
      }
    }

    // Handle macro-local variable assignment (e.g., ?varname = expression)
    if (/^\s*\?[\w+.\-]+ *=/.test(line)) {
      const match = line.match(/^\s*(\?[\w+.\-]+) *=\s*(.*)/);
      if (match) {
        const labelName = match[1];
        const expression = match[2].trim();
        debug("processMacroLine found macro variable assignment", { labelName, expression });

        // Evaluate the expression and set the label value
        const value = this.mathCore.math(expression);
        this.setLabel(labelName, value, true, true);
        return;
      }
    }

    // Otherwise, process the line as a regular command
    this.processCommand(line);
  }

  /**
   * Splits a string by commas while respecting function calls and parentheses.
   * @param {string} input - The input string to split.
   * @returns {string[]} Array of split values.
   */
  splitRespectingFunctions(input: string): string[] {
    const result: string[] = [];
    let current = "";
    let parenDepth = 0;
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      // Handle quotes
      if ((char === '"' || char === "'") && (i === 0 || input[i-1] !== "\\")) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
        }
      }

      // Only process special characters if we're not in quotes
      if (!inQuotes) {
        if (char === "(") {
          parenDepth++;
        } else if (char === ")") {
          parenDepth--;
        } else if (char === "," && parenDepth === 0) {
          result.push(current.trim());
          current = "";
          continue;
        }
      }

      current += char;
    }

    if (current) {
      result.push(current.trim());
    }

    return result;
  }

  /**
   * Handles a label definition, whether it has a colon or not.
   * @param {string} labelName - The label name (without colon).
   */
  private handleLabelDefinition(labelName: string): void {
    debug("handleLabelDefinition", labelName);

    // Check if this is a sublabel (starts with one or more dots)
    if (labelName.startsWith(".") || labelName.startsWith("#.")) {
      debug("handleLabelDefinition sublabel", labelName);
      if (!this.currentParentLabel) {
        throw new Error("Sublabel without parent label");
      }

      const isHashLabel = labelName.startsWith("#");
      const modifiesHierarchy = !isHashLabel; // Regular labels and non-# global labels modify hierarchy

      // Count the number of dots to determine nesting level
      let dotCount = 0;
      while (labelName[dotCount] === ".") {
        dotCount++;
      }

      // Get the actual label name without dots
      const subLabelName = labelName.substring(dotCount);
      debug("handleLabelDefinition subLabelName", subLabelName);

      // For single dot, use the immediate parent
      if (dotCount === 1) {
        // Create the direct scope version (Parent_SubLabel)
        const directScopeLabel = this.currentParentLabel + "_" + subLabelName;
        debug("handleLabelDefinition directScopeLabel", directScopeLabel);
        this.setLabel(directScopeLabel, undefined, false, false, this.currentParentIsGlobal, modifiesHierarchy);

        // If we're in a namespace and not a global label, create the namespaced version
        if (this.currentNamespace) {
          // Get the namespace prefix
          const namespacePrefix = this.namespaceNestingEnabled ?
            this.namespaceNestingPath.join("_") :
            this.currentNamespace;

          // Check if the directScopeLabel already includes the namespace
          if (!directScopeLabel.startsWith(namespacePrefix + "_")) {
            // Create the namespaced version by combining namespace prefix with the direct scope label
            const namespacedLabel = namespacePrefix + "_" + directScopeLabel;
            debug("handleLabelDefinition creating namespaced sublabel:", namespacedLabel);
            this.setLabel(namespacedLabel, undefined, false, false, false, modifiesHierarchy);
          }
        }
      } else {
        // For multiple dots, we need to find the most recent label that includes sublabels
        // First, try to find the namespaced version of the current parent
        const namespacePrefix = this.namespaceNestingEnabled ?
          this.namespaceNestingPath.join("_") :
          this.currentNamespace;

        const namespacedParent = this.currentNamespace ?
          `${namespacePrefix}_${this.currentParentLabel}` :
          this.currentParentLabel;

        // Look for all labels that start with our parent to find sublabels
        let fullParentPath = this.currentParentLabel;
        for (const [key, entry] of this.labelTable.entries()) {
          if (entry.modifiesHierarchy && key.includes("_") &&
              (key === namespacedParent || key.startsWith(`${namespacedParent}_`))) {
            // Found a longer matching path that includes sublabels
            const localPart = key.substring(key.indexOf(this.currentParentLabel));
            if (localPart.split("_").length > fullParentPath.split("_").length) {
              fullParentPath = localPart;
            }
          }
        }

        debug("handleLabelDefinition fullParentPath:", fullParentPath);
        const parentParts = fullParentPath.split("_");
        debug("handleLabelDefinition parentParts:", parentParts);

        // For each dot after the first, we need to add the sublabel part
        let relevantParent = parentParts[0];
        for (let i = 1; i < parentParts.length; i++) {
          // For each level of dots, we include one more part of the parent
          if (i < dotCount) {
            relevantParent += "_" + parentParts[i];
          }
        }
        debug("handleLabelDefinition relevantParent:", relevantParent);

        // Create the direct scope version
        const directScopeLabel = relevantParent + "_" + subLabelName;
        debug("handleLabelDefinition directScopeLabel:", directScopeLabel);
        this.setLabel(directScopeLabel, undefined, false, false, this.currentParentIsGlobal, modifiesHierarchy);

        // If we're in a namespace and not a global label, create the namespaced version
        if (this.currentNamespace) {
          // Check if the directScopeLabel already includes the namespace
          if (!directScopeLabel.startsWith(namespacePrefix + "_")) {
            // Create the namespaced version by combining namespace prefix with the direct scope label
            const namespacedLabel = namespacePrefix + "_" + directScopeLabel;
            debug("handleLabelDefinition creating namespaced sublabel", namespacedLabel);
            this.setLabel(namespacedLabel, undefined, false, false, false, modifiesHierarchy);
          }
        }
      }
    } else {
      // Regular label - becomes the new parent for subsequent sublabels
      // Only update currentParentLabel if this label modifies hierarchy
      const isHashLabel = labelName.startsWith("#");
      const modifiesHierarchy = !isHashLabel; // Regular labels and non-# global labels modify hierarchy

      if (modifiesHierarchy) {
        this.currentParentLabel = labelName;
        this.currentParentIsGlobal = false;
      }

      // Create the direct scope version
      this.setLabel(labelName, undefined, false, false, false, modifiesHierarchy);

      // If we're in a namespace, create the namespaced version
      if (this.currentNamespace) {
        // Get the namespace prefix
        const namespacePrefix = this.namespaceNestingEnabled ?
          this.namespaceNestingPath.join("_") :
          this.currentNamespace;

        // Check if the label already includes the namespace
        if (!labelName.startsWith(namespacePrefix + "_")) {
          // Create the namespaced version
          const namespacedLabel = namespacePrefix + "_" + labelName;
          debug("handleLabelDefinition creating namespaced label", namespacedLabel);
          this.setLabel(namespacedLabel, undefined, false, false, false, modifiesHierarchy);
        }
      }
    }
  }
}

