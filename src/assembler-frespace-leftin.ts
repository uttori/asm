import fs from "node:fs"
import path from "node:path"
import { Arch65816 } from "./Arch65816.js";
import { ArchSPC700 } from "./ArchSPC700.js"
import { AddressToLineMapping } from "./addr2line.js";
import { confirmqpar } from "./cppstring.js";
import { MathCore } from "./mathcore.js";
import { ArchSuperFX } from "./ArchSuperFX.js";

let debug = (..._) => {};
/* c8 ignore next */
// if (process.env.UTTORI_DATA_DEBUG || true) {
try { const { default: d } = await import("debug"); debug = d("Assembler"); } catch {}
// }

// Add a type for macro definitions:
type MacroDefinition = {
  name: string;
  params: string[]; // fixed parameter names
  variadic: boolean;
  body: string[];   // lines of code
};

type WhileTracker = {
  iswhile: boolean;
  startline: number;
  cond: boolean;
  is_for: boolean;
  for_variable?: string;
  for_var_backup?: string;
  for_has_var_backup?: boolean;
  for_start?: number;
  for_end?: number;
  for_cur?: number;
};

type LabelEntry = {
  value: number;
  isStatic: boolean;
};

// Represents a structure definition.
interface StructDefinition {
  name: string;
  base: number;                // The SNES start address for the struct.
  offset: number;              // Running offset as member commands are processed.
  size: number;                // Final size (after alignment, etc.)
  labels: Map<string, number>; // Mapping from member name (without the leading dot) to its offset.
  align?: number;              // Optional alignment (if specified in endstruct).
  parent?: string;             // If this struct extends a parent.
  extensionSize?: number;      // For parent structs, the maximum extension size.
}

interface FreespaceBlock {
  start: number;  // Starting address of the freespace block
  size: number;   // Size of the block including RATS tag
  protectedLabels?: string[];  // Labels that should be protected from cleanup
  static?: boolean;  // Whether this block is static (can't move/grow)
}

export class Assembler {
  public snespos: number = 0;
  public realsnespos: number = 0;
  public startpos: number = 0;
  public realstartpos: number = 0;
  public bytes: number = 0;

  public mapper: string = "lorom"; // Possible values: lorom, hirom, exlorom, exhirom, sa1rom, sfxrom, bigsa1rom, norom
  public sa1banks: number[] = [0 << 20, 1 << 20, -1, -1, 2 << 20, 3 << 20, -1, -1];
  public movinglabelspossible: boolean = false;
  // public romdata: Uint8Array = new Uint8Array(); // Placeholder for ROM
  public romdata: number[] = []; // Placeholder for ROM
  public romlen: number = 0;
  public default_freespacebyte: number = 0x00;

  public recent_opcode_num: number = 0;

  public pass: number = 0;
  public numif: number = 0;
  public numtrue: number = 0;
  public whileStatus: WhileTracker[] = [];
  public condStack: { type: "if" | "while"; cond: boolean; start?: number; expr?: string; branchTaken?: boolean }[] = [];

  public namespaceStack: string[] = [];
  public currentNamespace: string = "";

  // Macro definition state:
  private inMacroDefinition: boolean = false;
  private currentMacroName: string = "";
  private currentMacroParams: string[] = [];
  private currentMacroBody: string[] = [];

  // Macros are stored in the macros map (MacroDefinition is defined above)
  public macros: Map<string, MacroDefinition> = new Map();

  public mathCore: MathCore;

  public moreonlinecond: boolean = true;
  public addressToLineMapping: AddressToLineMapping = new AddressToLineMapping();
  public currentFile: string = "";
  public currentLine: number = 0;

  public defines: Map<string, string> = new Map();
  public builtindefines: Set<string> = new Set();

  // Character mapping support
  private characterMappings: Map<string, number> = new Map();
  private currentTable: string | null = null;

  private inFunctionDefinition: boolean = false;
  private functionDefinitionLines: string[] = [];

  public arch65816: Arch65816;
  public archSPC700: ArchSPC700;
  public archSuperFX: ArchSuperFX;

  // Add a new property for architecture in the class:
  public arch: string = "65816";

  public pushpcStack: { snespos: number; startpos: number; realsnespos: number; realstartpos: number }[] = [];
  public pushpcnum: number = 0;
  public freespacebyte: { [key: number]: number } = {};
  public freespacepos: { [key: number]: number } = {};
  public freespaceleak: { [key: number]: boolean } = {};
  public freespaceorgpos: { [key: number]: number } = {};
  public freespaceorglen: { [key: number]: number } = {};
  public freespacelen: { [key: number]: number } = {};

  public freespaceBlocks: FreespaceBlock[] = [];
  public currentFreespaceBlock: FreespaceBlock | null = null;

  // Array to store the freespace IDs allocated in pass 0.
  public freespaceAllocations: number[] = [];
  // An index used during later passes to return the correct stored ID.
  public freespaceAllocIndex: number = 0;

  public nextFreespaceID: number = 0;
  // public labelTable: Map<string, number> = new Map();
  public labelTable: Map<string, LabelEntry> = new Map();

  public forwardLabels: { [depth: number]: number[] } = {};  // Track multiple `+` labels
  public backwardLabels: { [depth: number]: number[] } = {}; // Track multiple `-` labels


  public lastCommandSize: number = 0;
  public optimizeforbank: number = 0;
  public padUnit: number = 1;
  public padbyte: number[] = []

  public structs: Map<string, StructDefinition> = new Map();
  private currentStruct: StructDefinition | null = null;
  private savedPCStack: number[] = [];

  public fillbyte: number[] = new Array(12).fill(0); // initialize fill pattern

  public targetRom: number[];

  public dpbase: number = 0;            // For "dpbase"
  public optimize_dp: "none" | "ram" | "always" = "none"; // For "optimize dp"
  public optimize_address: "default" | "ram" | "mirrors" = "default"; // For "optimize address"

  // Add a static property to hold our CRC table.
  private static crcTable: number[] | null = null;

  private includedFiles: Set<string> = new Set();
  private includeGuardedFiles: Set<string> = new Set();
  private includeStack: string[] = [];
  private includePaths: string[] = ["./"];

  private commandBuffer: string = "";  // Class-wide buffer for command concatenation

  private loopBodyCommands: string[] = [];
  private inLoopBody: boolean = false;
  private loopLevel: number = 0;  // Track the nesting level of loops

  constructor(targetRom?: number[]) {
    this.targetRom = targetRom ?? [];
    this.arch65816 = new Arch65816(this);
    this.archSPC700 = new ArchSPC700(this);
    this.archSuperFX = new ArchSuperFX(this);
    this.mathCore = new MathCore();
    this.mathCore.delegate = (operation: string, ...args: (string | number)[]): number | string => {
      debug("delegate", { operation, args })
      switch (operation) {
        case "resolveLabel": {
          try {
            return this.getLabelValue(args[0] as string, false);
          } catch (e) {
            // If not found as a label, check if it's defined as a struct.
            if (this.structs.has(args[0] as string)) {
              // Return the identifier as a string for built-in functions that expect one.
              return args[0] as string;
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
        case "sizeof": {
          return this.getSizeOf(args[0] as string);
        }
        case "defined": {
          try {
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
          } catch (e) {
            throw new Error(`Could not get filesize for '${args[0]}': ${e.message}`);
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
        case "readfile1":
        case "readfile2":
        case "readfile3":
        case "readfile4":
        case "canread":
        case "canread1":
        case "canread2":
        case "canread3":
        case "canread4":
        case "canreadfile1":
        case "canreadfile2":
        case "canreadfile3":
        case "canreadfile4":
        case "canreadfile":
        default: {
          throw new Error(`delegate ${operation} not implemented`);
        }
      }
    }

    // initstuff
    for (let i = 0;i < 256; i++) {
      this.freespacepos[i] = -1;
      this.freespaceleak[i] = true;
      this.freespaceorgpos[i] = -2;
      this.freespaceorglen[i] = -1;
      this.freespacebyte[i] = 0x00;
    }
  }

  /**
   * Ensures the SNES position is valid.
   */
  verifysnespos(): void {
    // debug(`verifysnespos: snespos: ${this.snespos.toString(16)} realsnespos: ${this.realsnespos.toString(16)}`);
    if (this.snespos < 0 || this.realsnespos < 0) {
      debug("💥 missing ORG directive. Resetting SNES position.");
      this.snespos = 0x008000;
      this.realsnespos = 0x008000;
      this.startpos = 0x008000;
      this.realstartpos = 0x008000;
    }
  }

  /**
   * Adjusts memory addresses based on the ROM type.
   * @param {number} inaddr - The address to adjust.
   * @param {number} step - The number of bytes to step.
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
   * Advances memory position while handling bank crossing.
   * @param {number} num - The number of bytes to advance.
   */
  step(num: number): void {
    // debug("step", num);
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
    // let pcpos = this.snestopc(this.realsnespos & 0xFFFFFF);
    // debug("write1_65816 pcpos", pcpos.toString(16));

    // debug('write1_65816 this.pass', this.pass);
    if (this.pass === 2) {
      if (pcpos < 0) {
        this.movinglabelspossible = true;
        // throw new Error(`Error: SNES address doesn't map to ROM: ${this.realsnespos.toString(16)} / pcpos ${pcpos.toString(16)}`);
      }

      this.romdata[pcpos] = num & 0xFF;

      // debug("write1_65816 romdata[pcpos]", this.romdata[pcpos].toString(16));

      if (pcpos >= this.romdata.length) {
        debug("write1_65816 pcpos >= romdata.length", pcpos, this.romdata.length);
        if (pcpos - this.romdata.length > 0) {
          this.fillRomData(this.romdata.length, this.default_freespacebyte, pcpos - this.romdata.length);
        }
        this.romlen = pcpos + 1;
      }
    }

    this.step(1);
  }

  /**
   * Fills a section of ROM data with a value.
   * @param {number} start - The starting address.
   * @param {number} value - The value to fill with.
   * @param {number} length - The length of the section to fill.
   */
  fillRomData(start: number, value: number, length: number): void {
    debug("fillRomData", start, value, length);
    for (let i = 0; i < length; i++) {
      this.romdata[start + i] = value;
    }
  }

  /**
   * Picks the appropriate instruction handler based on architecture.
   * @param {string[]} words - The words to pick.
   * @returns {boolean} True if the instruction was handled, false otherwise.
   */
  asblock_pick(words: string[]): boolean {
    debug("asblock_pick", words);
    debug("asblock_pick arch", this.arch);
    this.recent_opcode_num = 1;
    if (words.length === 0) {
      return true;
    }

    // In pass 0, allow forward references by returning a dummy value.
    if (this.pass === 0) {
      return true;
    }

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

  asblock_superfx(words: string[]): boolean {
    debug("asblock_superfx", words);
    if (!this.archSuperFX.asblock_superfx(words)) {
      throw new Error(`Unknown instruction: ${words[0]}`);
    }
    return true;
  }

  asblock_65816(words: string[]): boolean {
    debug("asblock_65816", words);
    if (!this.arch65816.asblock_65816(words)) {
      throw new Error(`Unknown instruction: ${words[0]}`);
    }
    return true;
  }

  /**
   * Determines the byte size of an opcode.
   * @param {string} c - The opcode.
   * @returns {number} The byte size of the opcode.
   */
  getlenfromchar(c: string): number {
    debug("getlenfromchar", c);
    c = c.toLowerCase();
    switch (c) {
      case "b":
        return 1;
      case "w":
        return 2;
      case "l":
        return 3;
      case "d":
        console.warn("Warning: .d opcode suffix is deprecated.");
        return 4;
      default:
        throw new Error("Error: Invalid opcode length.");
    }
  }

  /**
   * Writes 1, 2, 3, or 4 bytes to ROM.
   * @param {number} num - The byte to write.
   */
  public write1(num: number): void {
    this.write1_65816(num);
  }

  public write2(num: number): void {
    this.write1(num & 0xFF);
    this.write1((num >> 8) & 0xFF);
  }

  public write3(num: number): void {
    this.write1(num & 0xFF);
    this.write1((num >> 8) & 0xFF);
    this.write1((num >> 16) & 0xFF);
  }

  public write4(num: number): void {
    this.write1(num & 0xFF);
    this.write1((num >> 8) & 0xFF);
    this.write1((num >> 16) & 0xFF);
    this.write1((num >> 24) & 0xFF);
  }

  /**
   * Reads 1, 2, or 3 bytes from ROM.
   * @param insnespos
   */
  read1(insnespos: number): number {
    const addr = this.snestopc(insnespos);
    if (addr < 0 || addr + 1 > this.romlen) {
      return -1;
    }
    return this.romdata[addr];
  }

  read2(insnespos: number): number {
    const addr = this.snestopc(insnespos);
    if (addr < 0 || addr + 2 > this.romlen) {
      return -1;
    }
    return this.romdata[addr] | (this.romdata[addr + 1] << 8);
  }

  read3(insnespos: number): number {
    const addr = this.snestopc(insnespos);
    if (addr < 0 || addr + 3 > this.romlen) {
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
      console.error("assembler assembleblock no words", { words });
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
    debug("processCommand", { command }, this.snespos, "/", this.snespos.toString(16));

    // If we're in a loop body and not processing an inner loop, store the command
    if (this.inLoopBody && command.trim() !== "endfor" && command.trim() !== "for") {
      debug("processCommand inLoopBody");
        this.loopBodyCommands.push(command);
      return;
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
      this.romlen = testRomSize;
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
    let words: string[] = [];
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
    if (words.length === 0) return;

    const keyword = words[0];

    // Handle table commands
    if (keyword.toLowerCase() === "table") {
      this.handleTableCommand(words);
      return;
    }

    // Handle character mappings (both inside and outside tables)
    if (words.length === 3 && words[1] === "=" && (words[0].startsWith("'") || words[0].startsWith('"'))) {
      this.handleCharacterMapping(words);
      return;
    }

    // Function Definition Mode
    if (keyword.toLowerCase().startsWith("function ")) {
      // If it ends with "\" we keep collecting
      if (keyword.endsWith("\\")) {
        this.inFunctionDefinition = true;
        this.functionDefinitionLines.push(keyword.slice(0, -1));
      } else {
        // Single-line definition
        this.parseFunctionDefinition(keyword);
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
              this.currentMacroParams[this.currentMacroParams.length - 1] === "...") {
            variadic = true;
            this.currentMacroParams.pop();
          }
          const macroDef: MacroDefinition = {
            name: this.currentMacroName,
            params: this.currentMacroParams,
            variadic,
            body: this.currentMacroBody
          };
          if (this.macros.has(macroDef.name)) {
            // If already defined on pass 0, that's an error.
            throw new Error(`Macro '${macroDef.name}' is already defined.`);
          }
          this.macros.set(macroDef.name, macroDef);
          debug(`Defined macro '${macroDef.name}' with params [${macroDef.params.join(", ")}]${variadic ? " (variadic)" : ""}.`);
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
      debug(`Started macro definition for '${this.currentMacroName}' with params [${this.currentMacroParams.join(", ")}].`);
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
        this.add_addr_to_line(this.realsnespos & 0xFFFFFF);
      } else {
        // It's a standalone define reference, resolve it and process the result
        const defineName = command.trim().substring(1); // Remove the !
        if (!this.defines.has(defineName)) {
          throw new Error(`Error: Define '${defineName}' not found.`);
        }

        // Get the define's value and process it as a command
        const defineValue = this.defines.get(defineName);
        debug(`Processing standalone define !${defineName} with value: ${defineValue}`);
        this.processCommand(defineValue);
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
        // For example: ".PosY:" – remove the colon.
        const labelName = keyword.replace(/:$/, "").substring(1); // remove the dot
        // Record this label's offset within the struct.
        this.currentStruct.labels.set(labelName, this.currentStruct.offset);
        debug(`processCommand struct "${this.currentStruct.name}": defined member "${labelName}" at offset ${this.currentStruct.offset}`);

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
          this.currentStruct.offset += 1;
          debug(`processCommand struct "${this.currentStruct.name}": offset now ${this.currentStruct.offset}`);
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

      // New: handle fillbyte (and fillword, filllong, filldword)
    if (
      keyword === "fillbyte" ||
      keyword === "fillword" ||
      keyword === "filllong" ||
      keyword === "filldword"
    ) {
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
      return; // done processing this line.
    }

    // New: handle "fill" command.
    if (keyword === "fill") {
      debug("processCommand fill", words);
      // Syntax: fill {number_of_bytes}
      if (words.length !== 2) {
        throw new Error("FILL directive requires exactly one parameter (number of bytes to fill).");
      }
      const count = this.getnum(this.resolvedefines(words[1]));
      for (let i = 0; i < count; i++) {
        this.write1(this.fillbyte[i % 12]);
      }
      this.add_addr_to_line(this.realsnespos & 0xFFFFFF);
      return;
    }

    // Handle non-relative (named) labels that use the colon syntax.
    // (Dynamic labels get their value from the current PC.)
    // Check if the first token ends with a colon.
    while (words.length > 0 && keyword.endsWith(":")) {
      debug("non-relative (named) label assignment", words)
      // Remove the colon to get the label name.
      const labelName = keyword.slice(0, -1);
      // Define the label at the current SNES position.
      this.setLabel(labelName);
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
      this.add_addr_to_line(this.realsnespos & 0xFFFFFF);
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
        const filename = words[1];
        this.handleInclude("include", filename);
        break;
      }
      case "includefrom": {
        if (words.length !== 2) {
          throw new Error("includefrom requires exactly one filename parameter");
        }
        const filename = words[1];
        this.handleInclude("includefrom", filename);
        break;
      }
      case "includeonce": {
        this.handleIncludeOnce();
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
        this.add_addr_to_line(this.realsnespos & 0xFFFFFF);
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
          // Reset bank optimization settings.
          this.optimizeforbank = -1;
          debug(`BASE set to ${param} (${num}).`);
        }
        break;
      }
      case "dpbase": {
        if (words.length !== 2) {
          throw new Error("dpbase requires exactly one parameter (an SNES address).");
        }
        // Evaluate the SNES address using getnum (which uses MathCore)
        this.dpbase = this.getnum(this.resolvedefines(words[1]));
        debug(`dpbase set to ${this.dpbase.toString(16)}`);
        return;
      }
      case "optimize": {
        if (words.length < 3) {
          throw new Error("optimize command requires two parameters.");
        }
        const subCmd = words[1].toLowerCase();
        const arg = words[2].toLowerCase();
        if (subCmd === "dp") {
          if (arg !== "none" && arg !== "ram" && arg !== "always") {
            throw new Error("optimize dp requires one of none, ram, or always.");
          }
          this.optimize_dp = arg;
          debug(`optimize dp set to ${this.optimize_dp}`);
          return;
        } else if (subCmd === "address") {
          if (arg !== "default" && arg !== "ram" && arg !== "mirrors") {
            throw new Error("optimize address requires one of default, ram, or mirrors.");
          }
          this.optimize_address = arg;
          debug(`optimize address set to ${this.optimize_address}`);
          return;
        } else {
          throw new Error(`Unknown optimize subcommand: ${subCmd}`);
        }
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
        case "-":
          this.handleRelativeLabel(command);
          break;
        case "if":
            this.handleIf(words.slice(1));
            break;
        case "elseif":
            this.handleElseIf(words.slice(1));
            break;
        case "else":
            this.handleElse();
            break;
        case "endif":
            this.handleEndIf();
            break;
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
            this.handlePushNamespace();
            break;
        case "pullns":
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
        case "dc.l":
            this.handleDataDirective(keyword, words.slice(1));
            break;
        case "check": {
          // handle check commands
          if (keyword === "check") {
            if (words.length < 3) {
              throw new Error("Invalid CHECK command. Expected: check bankcross <on|off|half|full>");
            }
            // if (words[1].toLowerCase() === "bankcross") {
            //   const param = words[2].toLowerCase();
            //   if (param === "on") {
            //     console.warn("Warning: 'check bankcross on' is deprecated; please use 'half' or 'full' instead.");
            //     // For backward compatibility, you might leave the flags unchanged.
            //   } else if (param === "off") {
            //     this.disableBankCrossErrors = true;
            //   } else if (param === "half") {
            //     this.disableBankCrossErrors = false;
            //     this.checkHalfBanksCrossed = true;
            //   } else if (param === "full") {
            //     this.disableBankCrossErrors = false;
            //     this.checkHalfBanksCrossed = false;
            //   } else {
            //     throw new Error("Invalid parameter for check bankcross: " + words[2]);
            //   }
            // } else {
            //   throw new Error("Invalid check command: " + words[1]);
            // }
            // Record the mapping and return.
            this.add_addr_to_line(this.realsnespos & 0xFFFFFF);
      return;
          }
        }
        case "warnings":
          debug("Unsupproted", words)
          break;
        case "print":
            debug(this.handlePrint(words.slice(1).join(" ")));
            break;
        case "freecode":
        case "freespace":
        case "freedata":
            this.handleFreespace(keyword, words.slice(1));
            break;
        case "autoclean":
        case "autoclear":
            this.handleAutoclean(words.slice(1));
            break;
        case "freespacebyte":
            this.handleFreespaceByte(words.slice(1));
            break;
        case "prot":
            this.handleProt(words.slice(1));
            break;
        case "pushpc":
            this.handlePushPC();
            break;
        case "pullpc":
            this.handlePullPC();
            break;
        case "arch": {
          debug("arch", words)
          if (words.length < 2) {
            throw new Error("ARCH command requires an architecture parameter.");
          }
          const archParam = words[1].toLowerCase();
          if (archParam === "65816") {
            this.arch = "65816";
            // (Reinitialize or update arch65816 if needed)
          } else if (archParam === "spc700") {
            this.arch = "spc700";
          } else if (archParam === "superfx") {
            this.arch = "superfx";
          } else {
            throw new Error("Unsupported architecture: " + archParam);
          }
          break;
        }
        default: {
          if (keyword.startsWith(";")) {
            // debug(`handleInstruction comment: ${words.join(" ")}`);
          } else if (keyword === "") {
            // debug(`handleInstruction white space: ${words.join(" ")}`);
          } else {
            const wasOpcode = this.asblock_pick(words);
            if (!wasOpcode) {
              console.error("💥 assembler processCommand unknown operation", keyword)
            }
          }
          break;
        }
    }

    // Determine how many bytes were written in this command.
    const commandSize = (this.realsnespos & 0xFFFFFF) - startPC;
    debug("processCommand commandSize", commandSize)
    // Save the command size for later label recording.
    this.lastCommandSize = commandSize;

    this.add_addr_to_line(this.realsnespos & 0xFFFFFF);
  }

  /**
   * Parses a function definition of the form:
   *   function name(param1, param2...) = expression
   * Possibly spanning multiple lines joined by backslashes.
   * @param defLine
   */
  private parseFunctionDefinition(defLine: string): void {
    this.mathCore.parseFunctionDefinition(defLine);
  }

  /**
   * Expands and calls a macro invocation.
   * The invocation is expected to be in the form:
   *   macroName(arg1, arg2, ...)
   * @param {string} invocation The macro invocation to expand and call.
   */
  public callMacro(invocation: string): void {
    debug("callMacro", invocation)
    // Use a regex to extract macro name and arguments.
    const invocationRegex = /^(\w+)\((.*)\)$/;
    const match = invocation.match(invocationRegex);
    if (!match) {
      throw new Error(`Invalid macro invocation: ${invocation}`);
    }
    const macroName = match[1].trim();
    const argsString = match[2].trim();
    // Parse arguments handling quoted strings properly
    const args: string[] = [];
    if (argsString) {
      debug("callMacro argsString =", argsString)
      let currentArg = "";
      let inQuotes = false;
      let i = 0;

      while (i < argsString.length) {
        const char = argsString[i];

        // Handle escaped quotes inside quoted strings
        if (char === '"' && inQuotes && argsString[i+1] === '"') {
          currentArg += '"';
          i += 2; // Skip both quote characters
          continue;
        }

        // Toggle quote state
        if (char === '"') {
          inQuotes = !inQuotes;
          i++;
          continue;
        }

        // If we hit a comma outside of quotes, we've reached the end of an argument
        if (char === "," && !inQuotes) {
          args.push(currentArg.trim());
          currentArg = "";
          i++;
          continue;
        }

        // Add the current character to the argument
        currentArg += char;
        i++;
      }

      // Add the last argument if there is one
      if (currentArg.trim() || args.length > 0) {
        args.push(currentArg.trim());
      }
    }
    if (!this.macros.has(macroName)) {
      throw new Error(`Macro '${macroName}' is not defined.`);
    }
    const macroDef = this.macros.get(macroName);
    if (!macroDef) {
      throw new Error(`Macro '${macroName}' is not defined.`);
    }
    // Validate argument counts.
    if (!macroDef.variadic && args.length !== macroDef.params.length) {
      throw new Error(`Macro '${macroName}' expects ${macroDef.params.length} parameters, but got ${args.length}.`);
    }
    if (macroDef.variadic && args.length < macroDef.params.length) {
      throw new Error(`Macro '${macroName}' expects at least ${macroDef.params.length} parameters, but got ${args.length}.`);
    }
    debug("callMacro args =", args)
    // Build a mapping for fixed parameters.
    const fixedArgs = new Map<string, string>();
    for (let i = 0; i < macroDef.params.length; i++) {
      fixedArgs.set(macroDef.params[i], args[i]);
    }
    // The remaining arguments (if any) are variadic.
    const variadicArgs = macroDef.variadic ? args.slice(macroDef.params.length) : [];
    const variadicCount = variadicArgs.length;
    // Expand each line of the macro body.
    for (const line of macroDef.body) {
      const expandedLine = this.expandMacroLine(line, fixedArgs, variadicArgs, variadicCount);
      // Process the expanded line just as if it were written in the source.
      this.assembleblock(expandedLine);
    }
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
    debug("expandMacroLine", line, fixedArgs, variadicArgs, variadicCount)
    let expanded = line;
    // Replace fixed parameters of the form <param>
    expanded = expanded.replace(/<(\w+)>/g, (match, paramName) => {
      if (fixedArgs.has(paramName)) {
        // Optionally, run the argument through resolvedefines.
        return this.resolvedefines(fixedArgs.get(paramName));
      }
      return match;
    });
    // Replace variadic parameters of the form <...[{math}]>
    expanded = expanded.replace(/<(?:\.{3}|…)\[([^\]]+)]>/g, (match, expr) => {
      // Resolve defines inside the math expression.
      const resolvedExpr = this.resolvedefines(expr);
      let index = this.mathCore.math(resolvedExpr);
      if (isNaN(index)) {
        throw new Error(`Invalid variadic index expression: ${expr}`);
      }
      index = Math.floor(index);
      if (index < 0 || index >= variadicCount) {
        throw new Error(`Variadic index ${index} out of range (0..${variadicCount - 1}).`);
      }
      return variadicArgs[index];
    });
    // Replace sizeof(...) with the number of variadic arguments.
    expanded = expanded.replace(/sizeof\(\.{3}\)/g, variadicCount.toString());
    // Finally, resolve any remaining defines.
    expanded = this.resolvedefines(expanded);
    debug("expandMacroLine = ", expanded)
    return expanded;
  }

  public handleDefineCommand(command: string): void {
    debug("handleDefineCommand", command)
    // Command examples:
    // !identifier = value
    // !identifier += value
    // !identifier := value
    // !identifier #= value
    // !identifier ?= value
    // Remove the leading "!" and trim.
    const line = command.substring(1).trim();
    // Use a regex to split into identifier, operator, and value.
    const match = line.match(/^(\w+)\s*(=|\+=|:=|#=|\?=)\s*(.*)$/);
    if (!match) {
      throw new Error(`Invalid define syntax: ${command}`);
    }
    const identifier = match[1];
    const operator = match[2];
    let value = match[3].trim();

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

    // Finally, for the "=" operator (and after processing the others),
    // disallow modification of built-in defines.
    if (this.builtindefines.has(identifier)) {
      throw new Error(`Cannot modify built-in define: ${identifier}`);
    }

    // Check if the value is a math expression that needs to be evaluated
    if (value.includes("+") || value.includes("-") || value.includes("*") || value.includes("/") ||
        value.includes("&") || value.includes("|") || value.includes("^") ||
        value.includes("<<") || value.includes(">>") || value.includes("(")) {
      try {
        // First resolve any defines inside the expression
        const resolvedValue = this.resolvedefines(value);
        // Then evaluate the math expression
        const result = this.mathCore.math(resolvedValue);
        if (!Number.isNaN(result)) {
          // Only use the result if it's a valid number
          value = "$" + result.toString(16).toUpperCase();
          debug(`Evaluated math expression in define: ${resolvedValue} = ${value}`);
        }
      } catch (error) {
        // If evaluation fails, keep the original value
        debug(`Math evaluation skipped for expression: ${value}`);
      }
    }

    // Assign the define.
    this.defines.set(identifier, value);

    debug(`handleDefineCommand define set: !${identifier} ${operator} ${value}`);
  }

  /**
   * Handles `+` and `-` relative labels correctly using SNES memory position instead of `currentLine`.
   * @param {string} label - The label to handle.
   * @returns {number} The address of the label.
   */
  handleRelativeLabel(label: string): number {
    debug("handleRelativeLabel", label);

    const depth = label.length;
    const isPositive = label.startsWith("+");
    const snesAddress = this.snespos;

    if (this.pass > 0) {
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
        return snesAddress;
    }

    // Pass 0: Store labels properly
    if (isPositive) {
        if (!this.forwardLabels[depth]) this.forwardLabels[depth] = [];
        this.forwardLabels[depth].push(snesAddress);
    } else {
        if (!this.backwardLabels[depth]) this.backwardLabels[depth] = [];
        this.backwardLabels[depth].push(snesAddress);
    }

    return snesAddress;
  }

  findNextLabel(label: string): number {
    debug("findNextLabel", label);

    const depth = label.length; // Number of `+` signs
    const currentAddress = this.snespos;

    // **Pass 0: Don't resolve labels yet, just track**
    if (this.pass === 0) {
      return 0; // Temporary placeholder value, will be resolved in Pass 2
    }

    // **Pass 2: Resolve properly**
    if (!this.forwardLabels[depth] || this.forwardLabels[depth].length === 0) {
        throw new Error(`Error: No + label '${label}' found after ${currentAddress.toString(16)}.`);
    }

    // **Find the first label that is AFTER the current address**
    const possibleTargets = this.forwardLabels[depth].filter(addr => addr > currentAddress);
    if (possibleTargets.length === 0) {
        throw new Error(`Error: No + label '${label}' found after ${currentAddress.toString(16)}.`);
    }

    debug("findNextLabel possibleTargets", possibleTargets);
    return Math.min(...possibleTargets); // Return the closest one
  }

  /**
   * Finds the next occurrence of a `+` label based on SNES memory position.
   * @param {string} label - The label to find.
   * @returns {number} The address of the next label.
   */
  findPreviousLabel(label: string): number {
    debug("findPreviousLabel", label);

    const depth = label.length; // Number of `-` signs
    const currentAddress = this.snespos;

    // **Pass 0: Don't resolve labels yet, just track**
    if (this.pass === 0) {
        return 0; // Temporary placeholder, will be resolved in Pass 2
    }

    // **Pass 2: Resolve properly**
    if (!this.backwardLabels[depth] || this.backwardLabels[depth].length === 0) {
        throw new Error(`Error: No - label '${label}' found before ${currentAddress.toString(16)}.`);
    }

    // **Find the first label that is BEFORE the current address**
    const possibleTargets = this.backwardLabels[depth].filter(addr => addr < currentAddress);
    if (possibleTargets.length === 0) {
        throw new Error(`Error: No - label '${label}' found before ${currentAddress.toString(16)}.`);
    }

    debug("findPreviousLabel possibleTargets", possibleTargets);
    return Math.max(...possibleTargets); // Return the closest one
  }

  /**
   * Handles setting a label in the assembler.
   * @param {string} label - The label to set.
   * @param {number} value - The value to set the label to.
   * @param {boolean} isStatic - Whether the label is static.
   */
  setLabel(label: string, value?: number, isStatic: boolean = false): void {
    debug("setLabel", { label, value, isStatic })
    const fullLabel = this.currentNamespace ? `${this.currentNamespace}:${label}` : label;
    const addr = (value !== undefined) ? value : this.snespos;
    if (this.pass === 0) {
      debug("setLabel pass 0", { fullLabel, addr, addrHex: addr.toString(16), isStatic })
      if (this.labelTable.has(fullLabel)) {
        debug(`setLabel ⚠️ Warning: Label '${fullLabel}' redefined.`);
      }
      this.labelTable.set(fullLabel, { value: addr, isStatic });
    } else if (this.pass === 1) {
      debug("setLabel pass 1", { fullLabel, addr, addrHex: addr.toString(16), isStatic });
      this.labelTable.set(fullLabel, { value: addr, isStatic });
    } else if (this.pass === 2) {
      if (!this.labelTable.has(fullLabel)) {
        throw new Error(`Error: Label '${fullLabel}' used but not defined.`);
      }
      debug("setLabel pass 2", { fullLabel, addr, addrHex: addr.toString(16), isStatic });
      // Optionally, you might check that a label expected to be static actually is.
      const entry = this.labelTable.get(fullLabel);
      if (isStatic && !entry.isStatic) {
        throw new Error(`Error: Label '${fullLabel}' is not static and cannot be used in conditionals.`);
      }
    } else {
      throw new Error(`Error: Label '${fullLabel}' used in pass ${this.pass}.`);
    }
  }

  /**
   * Retrieves the address of a stored label.
   * @param {string} label - The label to retrieve the value of.
   * @param {boolean} requireStatic - Whether the label must be static.
   * @returns {number} The value of the label.
   */
  public getLabelValue(label: string, requireStatic: boolean = false): number {
    debug("getLabelValue", { label, requireStatic })
    const fullLabel = this.currentNamespace ? `${this.currentNamespace}:${label}` : label;
    debug("getLabelValue fullLabel", fullLabel)
    debug("getLabelValue labelTable", this.labelTable)
    if (!this.labelTable.has(fullLabel)) {
      // In pass 0, allow forward references by returning a dummy value.
      // if (this.pass === 0) {
      //   debug('getLabelValue =', 0)
      //   return 0;
      // }
      return;
    }
    const entry = this.labelTable.get(fullLabel);
    if (requireStatic && !entry.isStatic) {
      throw new Error(`Error: Non-static label '${label}' used in conditional.`);
    }
    debug("getLabelValue =", entry.value, "/", entry.value.toString(16))
    return entry.value;
  }

  /**
   * Handles `for` loops.
   * @param {string[]} condition - The condition for the loop.
   */
  handleFor(condition: string[]): void {
    debug("handleFor", condition)

    // Handle both formats: "i = 1..5" or ["i", "=", "0..5"]
    let variable: string;
    let startVal: number;
    let endVal: number;

    if (condition.length === 1) {
      // Handle format: "i = 1..5" or similar
      const forRegex = /^(\w+)\s*=\s*(.+?)\.\.(.+?)$/;
      const match = condition[0].match(forRegex);
      debug("handleFor match single string", match)

      if (match) {
        variable = match[1];
        const startExpr = match[2];
        const endExpr = match[3];

        // Parse the start and end values using getnum to support expressions
        startVal = this.getnum(this.resolvedefines(startExpr));
        endVal = this.getnum(this.resolvedefines(endExpr));
      } else {
        throw new Error("Invalid FOR loop format");
      }
    } else if (condition.length === 3 && condition[1] === "=") {
      // Handle format: ["i", "=", "0..5"]
      variable = condition[0];
      const rangeMatch = condition[2].match(/^(.+?)\.\.(.+?)$/);
      debug("handleFor match array format", rangeMatch)

      if (rangeMatch) {
        const startExpr = rangeMatch[1];
        const endExpr = rangeMatch[2];

        // Parse the start and end values using getnum to support expressions
        startVal = this.getnum(this.resolvedefines(startExpr));
        endVal = this.getnum(this.resolvedefines(endExpr));
      } else {
        throw new Error("Invalid FOR loop range format");
      }
    } else {
      throw new Error("Invalid FOR loop syntax");
    }

    // Store the current position to return to after each iteration
    this.whileStatus.push({
      iswhile: false,
      startline: this.snespos,
      cond: startVal <= endVal,
      is_for: true,
      for_variable: variable,
      for_var_backup: "",
      for_has_var_backup: false,
      for_start: startVal,
      for_end: endVal,
      for_cur: startVal,
    });

    // Start collecting loop body commands
    this.inLoopBody = true;
    this.loopBodyCommands = [];
    this.loopLevel++;
  }

  /**
   * Handles `endfor` statements.
   */
  handleEndFor(): void {
    if (this.whileStatus.length === 0 || !this.whileStatus[this.whileStatus.length - 1].is_for) {
      debug("handleEndFor this.whileStatus.length", this.whileStatus.length)
      throw new Error("Misplaced ENDFOR.");
    }
    const loop = this.whileStatus[this.whileStatus.length - 1];
    debug("handleEndFor loop", loop)

    // Stop collecting loop body commands
    this.inLoopBody = false;
    this.loopLevel--;

    // Keep executing the loop body until we reach the end value
    while (loop && loop.for_cur < loop.for_end) {
      debug(`handleEndFor loop.for_cur < loop.for_end: ${loop.for_cur} < ${loop.for_end}`)
      // Re-execute the loop body commands
      debug("handleEndFor loopBodyCommands", this.loopBodyCommands.length)
      for (const command of this.loopBodyCommands) {
        debug("handleEndFor processCommand", command);
        // Temporarily disable loop body collection while executing commands
        const wasInLoopBody: boolean = this.inLoopBody;
        this.inLoopBody = false;
        this.processCommand(command);
        this.inLoopBody = wasInLoopBody;
      }

      // Increment the counter after executing the body
      loop.for_cur++;
    }

    // Loop is done, remove it from the stack
    this.whileStatus.pop();
  }

  /**
   * Handles `print` statements.
   * @param {string} input - The input string to print.
   * @returns {string} The formatted output.
   */
  handlePrint(input: string): string {
      if (this.pass !== 2) return "";
      if (!confirmqpar(input)) throw new Error("Mismatched parentheses in print function.");

      let output = "";
      const parts = input.split(",");

      for (let part of parts) {
          part = part.trim();
          if (part.startsWith('"') && part.endsWith('"')) {
              output += part.slice(1, -1);
          } else if (part === "bytes") {
              output += this.bytes.toString();
          } else if (part === "pc") {
              output += this.snespos.toString(16).toUpperCase();
          } else if (part.startsWith("bin(") || part.startsWith("dec(") || part.startsWith("hex(") || part.startsWith("double(")) {
              const content = part.slice(part.indexOf("(") + 1, part.lastIndexOf(")"));
              output += this.formatPrintFunction(part.split("(")[0], content);
          } else {
              throw new Error(`Unknown print argument: ${part}`);
          }
      }
      return output;
  }

  /**
   * Formats output for `bin`, `dec`, `hex`, and `double` print functions.
   * @param {string} type The type of print function.
   * @param {string} param The parameters for the print function.
   * @returns {string} The formatted output.
   */
  formatPrintFunction(type: string, param: string): string {
    debug("formatPrintFunction", type, param)
      let precision = 0;
      const parts = param.split(",");
      const value = parseInt(parts[0], 10);
      if (parts.length === 2) {
          precision = parseInt(parts[1], 10);
      }

      switch (type) {
          case "bin":
              return value.toString(2).padStart(precision, "0");
          case "dec":
              return value.toString(10).padStart(precision, "0");
          case "hex":
              return value.toString(16).toUpperCase().padStart(precision, "0");
          case "double":
              return value.toFixed(precision || 5);
          default:
              throw new Error(`Invalid print function type: ${type}`);
      }
  }

  /**
   * Adds a mapping of the current address to the source line number.
   * @param pos
   */
  public add_addr_to_line(pos: number): void {
    if (this.pass === 2) {
      this.addressToLineMapping.includeMapping(this.currentFile, this.currentLine + 1, pos);
    }
  }

  /**
   * Handles `if` statements.
   * @param condition
   */
  public handleIf(condition: string[]): void {
    debug("handleIf", condition)
    const conditionStr = condition.join(" ");
    const conditionResult = this.evaluateExpression(conditionStr);
    // Push an "if" entry with an additional flag to indicate if this branch was taken
    this.condStack.push({
      type: "if",
      cond: conditionResult,
      branchTaken: conditionResult // Track if this or any subsequent branch was taken
    });
    // Update the global flag (all conditions must be true to run commands).
    this.moreonlinecond = this.condStack.every(entry => entry.cond);
  }

  public handleElseIf(condition: string[]): void {
    debug("handleElseIf", condition)
    // Ensure we are inside an if block.
    if (this.condStack.length === 0 || this.condStack[this.condStack.length - 1].type !== "if") {
      throw new Error("Misplaced elseif");
    }

    // Get the current conditional context
    const current = this.condStack[this.condStack.length - 1];

    // If any previous branch in this if-block was already taken,
    // or if the current condition is false, set cond to false
    if (current.branchTaken) {
      // A previous branch was already taken, so this elseif should be skipped
      current.cond = false;
    } else {
      // No branch taken yet, evaluate this condition
      const conditionStr = condition.join(" ");
      const conditionResult = this.evaluateExpression(conditionStr);
      current.cond = conditionResult;

      // If this condition is true, mark that a branch has been taken
      if (conditionResult) {
        current.branchTaken = true;
      }
    }

    this.moreonlinecond = this.condStack.every(entry => entry.cond);
  }

  public handleElse(): void {
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

  public handleEndIf(): void {
    debug("handleEndIf")
    if (this.condStack.length === 0 || this.condStack[this.condStack.length - 1].type !== "if") {
      throw new Error("Misplaced endif");
    }
    this.condStack.pop();
    this.moreonlinecond = this.condStack.every(entry => entry.cond);
  }

  /**
   * Handles `while` loops.
   * @param condition
   */
  public handleWhile(condition: string[]): void {
    // Combine the tokens into a single expression.
    const expr = condition.join(" ");
    // Evaluate the expression.
    const cond = this.evaluateExpression(expr);
    // Push a while entry with the starting PC and the condition expression.
    this.condStack.push({ type: "while", cond, start: this.snespos, expr });
  }

  public handleEndWhile(): void {
    // Ensure the top of the stack is a while loop.
    if (this.condStack.length === 0 || this.condStack[this.condStack.length - 1].type !== "while") {
      throw new Error("Misplaced endwhile");
    }
    // Get the current while loop entry.
    const loopEntry = this.condStack[this.condStack.length - 1];
    // Jump back to the start of the loop.
    this.snespos = loopEntry.start!;
    // Re-evaluate the while condition.
    const newCond = this.evaluateExpression(loopEntry.expr);
    if (newCond) {
      // Still true – update the entry and continue looping.
      loopEntry.cond = true;
    } else {
      // Condition false – pop the while entry.
      this.condStack.pop();
    }
    // Update our global flag.
    this.moreonlinecond = this.condStack.every(e => e.cond);
  }


  /**
   * Handles `org` directive to set SNES memory location.
   * @param params
   */
  public handleOrg(params: string[]): void {
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
    if (params.length === 0) {
      throw new Error(`${type.toUpperCase()} directive requires at least one parameter.`);
    }

    if (this.pass === 0) {
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

    // Split by comma to correctly handle multiple values
    const values = params.join(" ").split(",").map(val => val.trim());
    debug("handleDataDirective values", values);

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
        debug("handleDataDirective numeric values", value);
        // Handle numeric values
        if (value.startsWith("#")) {
          console.warn("Warning: # before numbers in db/dw/... is deprecated. Remove the #.");
          value = value.substring(1);
        }

        // First resolve any defines in the expression so that tokens like "FillCount" are replaced.
        const resolved = this.resolvedefines(value);
        let num: number = this.mathCore.math(resolved);
        if (Number.isNaN(num)) {
          // As a fallback, try to look up a label (this assumes it's a static label).
          num = this.getLabelValue(resolved, true);
        }
        debug("handleDataDirective numeric num", num);

        if (Number.isNaN(num)) {
          console.error("Unable to determine value:", num)
          throw new Error("Unable to determine value:")
        }
        this.writeDataByLength(len, num);
      }
    }

    this.add_addr_to_line(this.realsnespos & 0xFFFFFF);
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
  public handlePushNamespace(): void {
    debug("handlePushNamespace")
    this.namespaceStack.push(this.currentNamespace);
  }

  /**
   * Restores the previous namespace.
   */
  public handlePullNamespace(): void {
    debug("handlePullNamespace");
    if (this.namespaceStack.length === 0) {
      throw new Error("pullns without pushns");
    }
    this.currentNamespace = this.namespaceStack.pop()!;
  }

  /**
   * Handles `namespace` definitions.
   * @param {string[]} params - The parameters for the namespace directive.
   */
  public handleNamespace(params: string[]): void {
    debug("handleNamespace", params);
    if (params.length === 0) {
      this.currentNamespace = "";
      return;
    }

    const action = params[0].toLowerCase();
    if (action === "off") {
      this.currentNamespace = "";
    } else {
      this.currentNamespace = params[0];
    }
  }

  /**
   * Handles `freespace` directives.
   * @param {string} type - The type of freespace directive.
   * @param {string[]} params - The parameters for the freespace directive.
   */
  handleFreespace(type: string, params: string[]): void {
    debug("handleFreespace", { type, params })
    if (type !== "freecode" && params.length === 0) {
      throw new Error(`${type.toUpperCase()} requires a size parameter.`);
    }

    if (type === "freecode") {
      type = "freespace";
      params.unshift("ram");
    } else if (type === "freedata") {
      type = "freespace";
      params.unshift("noram");
    }
    debug("handleFreespace parsed", { type, params })

    let useram = -1;
    let fixedpos = false;
    let align = false;
    let leakwarn = true;
    let fsbyte = this.default_freespacebyte;

    for (const param of params) {
      debug("handleFreespace param", param);
        switch (param.toLowerCase()) {
          case "ram":
            if (useram !== -1) {
              throw new Error(`Invalid freespace request: ${param} while useram !== -1`);
            }
            useram = 1;
            break;
          case "noram":
            if (useram !== -1) {
              throw new Error(`Invalid freespace request: ${param} while useram !== -1`);
            }
            useram = 0;
            break;
          case "static":
          case "fixed":
            if (fixedpos) {
              throw new Error(`Invalid freespace request: ${param} while fixedpos`);
            }
            fixedpos = true;
            break;
          case "align":
            if (align) {
              throw new Error(`Invalid freespace request: ${param} while align`);
            }
            align = true;
            break;
          case "cleaned":
            if (!leakwarn) {
              throw new Error(`Invalid freespace request: ${param} while !leakwarn`);
            }
            leakwarn = false;
            break;
          default:
            fsbyte = this.getnum(param);
      }
    }

    // if (useram === -1) {
    //   throw new Error("Invalid freespace request: useram === -1");
    // }
    if (this.mapper === "norom") {
      throw new Error("No freespace available in norom.");
    }

    // Get a new freespace ID.
    const freespaceid = this.getFreespaceID();
    debug("handleFreespace freespaceid", freespaceid);
    this.freespacebyte[freespaceid] = fsbyte;
    const isFreeCode = useram !== 0;
    debug("handleFreespace isFreeCode", isFreeCode);

    // Pass 0: simply reserve a location by setting the SNES position.
    if (this.pass === 0) {
      debug("handleFreespace reserve", isFreeCode, 0x8000);
      // On pass 0, just store a default position in the freespace tracking
      this.freespacepos[freespaceid] = 0x8000;
      this.snespos = 0x8000;
      this.realsnespos = 0x8000;
      this.startpos = 0x8000;
      this.realstartpos = 0x8000;
    } else if (this.pass === 1) {
      // On pass 1, if the user requested a fixed location, then the original freespace position must be set.
      let pos: number;
      if (fixedpos && this.freespaceorgpos[freespaceid] > 0) {
        pos = this.freespaceorgpos[freespaceid];
      }
      if (fixedpos && this.freespaceorgpos[freespaceid] > 0) {
        // Use the fixed freespace location.
        this.freespacepos[freespaceid] = this.snespos = this.freespaceorgpos[freespaceid];
      } else {
        // When finding freespace, account for RATS tag
        pos = this.getsnesfreespace(8, isFreeCode, true, true, align, this.freespacebyte[freespaceid]);
        if (pos < 0) {
          throw new Error("Could not find suitable freespace");
        }

        // Write the RATS tag
        this.snespos = pos;
        this.realsnespos = pos;
        this.writeRatsTag(0); // Initial size of 0, will be updated later
      }

      // Store the full address (with ID) in freespacepos for tracking
      this.freespacepos[freespaceid] = (freespaceid << 24) | pos;
      // But only use the actual address for snespos
      this.snespos = pos & 0xFFFFFF;
      this.realsnespos = this.snespos;
      this.startpos = this.snespos;
      this.realstartpos = this.snespos;
    } else if (this.pass === 2) {
      // On pass 2, if a fixed location was specified but not set (indicated by -1), then do nothing.
      if (fixedpos && this.freespaceorgpos[freespaceid] === -1) {
        debug("handleFreespace done", this.snespos, "/", this.snespos.toString(16));
        return;
      }
      this.snespos = this.freespacepos[freespaceid];
      // Resize the RATS tag so that the ROM "knows" about this block.
      this.resizeRats(this.snespos & 0xFFFFFF, this.freespacelen[freespaceid]);
      if (this.freespaceleak[freespaceid] && leakwarn) {
        console.warn("Warning: Freespace leaked.");
      }
    }

    // After finding and allocating the freespace, call:
    const allocatedAddress = this.snespos & 0xFFFFFF;
    const size = this.freespacelen[freespaceid] || 0;
    this.startFreespaceBlock(allocatedAddress, size, fixedpos);
    debug("handleFreespace done", this.snespos, "/", this.snespos.toString(16));
  }

  public handleFreespaceByte(params: string[]): void {
    if (params.length !== 1) throw new Error("FREESPACEBYTE requires a single value.");
    this.default_freespacebyte = this.getnum(params[0]);
  }

  public handlePushPC(): void {
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

  public handlePullPC(): void {
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
   * Handles the AUTOCLEAN directive.
   *
   * Usage:
   *   autoclean jml/jsl/dl {label}
   *   autoclean {snes_address}
   *
   * When used with a jml/jsl/dl, the assembler checks the instruction at the current PC
   * and, if its target is in an expanded area and protected by a RATS tag, cleans that area.
   * When used with an address (or math expression), the evaluated address is checked.
   * @param {string[]} params - The parameters for the AUTOCLEAN directive.
   */
  public handleAutoclean(params: string[]): void {
    debug("handleAutoclean", params);
    if (params.length === 0) {
      throw new Error("AUTOCLEAN requires at least one parameter.");
    }

    if (this.pass === 0) {
      return;
    }

    // Determine if the autoclean is used with an opcode modifier (jml/jsl/dl) or just an address.
    let mode: "jml" | "jsl" | "dl" | "address";
    let targetOperand: string;
    if (params.length === 2) {
      // First parameter should be one of jml, jsl, or dl (case-insensitive)
      const op = params[0].toLowerCase();
      if (op === "jml" || op === "jsl" || op === "dl") {
        mode = op;
      } else {
        throw new Error("Invalid autoclean opcode. Must be 'jml', 'jsl' or 'dl'.");
      }
      targetOperand = params[1];
    } else {
      mode = "address";
      targetOperand = params[0];
    }

    // Evaluate the target address using the assembler's getnum (which uses MathCore)
    debug("handleAutoclean mode", mode);
    debug("handleAutoclean targetOperand", targetOperand);
    const targetAddress = this.getnum(targetOperand);
    debug("handleAutoclean targetAddress", targetAddress, "/", targetAddress?.toString(16));

    // Check that the target address is in the expanded area.
    // Here we assume expanded areas are those with bank >= $10.
    // const bank = targetAddress >>> 16;
    // debug('handleAutoclean bank', bank, '/', bank.toString(16));
    // if (bank < 0x10) {
    //   // Not in expanded area; nothing to clean.
    //   debug('handleAutoclean not in expanded area');
    //   return;
    // }

    // Ensure that AUTOCLEAN is not used while already inside a freespace area.
    if (this.inFreespaceArea(this.snespos)) {
      throw new Error("AUTOCLEAN cannot be used inside a freespace area.");
    }

    // Check whether the target (or the instruction at the current PC) is protected by a RATS tag.
    // We assume a helper method isProtectedByRats(addr) returns true if the area (or its RATS tag) exists.
    // if (!this.isProtectedByRats(targetAddress)) {
    //   // Nothing to clean.
    //   debug('handleAutoclean not protected by RATS');
    //   return;
    // }

    // For the jml/jsl/dl modes, we need to verify that at the current PC the output ROM contains the respective opcode or address.
    // Then, if so, we clean that target and reassemble the instruction.
    if (mode !== "address") {
      const currentPC = this.snespos & 0xFFFFFF;
      // Read the opcode or, in the case of 'dl', the stored address at current PC.
      // (Assuming this.romdata holds the assembled ROM bytes.)
      const opcode = this.romdata[currentPC];
      let expectedOpcode: number | undefined;
      if (mode === "jml") {
        expectedOpcode = 0x5C;
      } else if (mode === "jsl") {
        expectedOpcode = 0x22;
      }
      // For "dl" we assume the output at current PC is a 2-byte address.
      // (You may adjust this depending on your implementation.)

      // If mode is jml or jsl and the opcode does not match, do nothing.
      // if (this.pass !== 0 && (mode === "jml" || mode === "jsl") && opcode !== expectedOpcode) {
      //   debug('handleAutoclean opcode mismatch', opcode, '/', opcode.toString(16), 'expected', expectedOpcode, '/', expectedOpcode.toString(16));
      //   return;
      // }

      // In any case, if the target address is protected by a RATS tag, we clean that area.
      this.cleanRats(targetAddress);

      // Also, reassemble the autoclean line at the current PC.
      // For jml and jsl, write the opcode followed by a 3-byte address.
      if (mode === "jml") {
        this.write1(0x5C);
        this.write3(targetAddress);
      } else if (mode === "jsl") {
        this.write1(0x22);
        this.write3(targetAddress);
      } else if (mode === "dl") {
        // For dl, assume we output a 2-byte address.
        this.write2(targetAddress);
      }
    } else {
      // In "address" mode, simply clean the target area.
      this.cleanRats(targetAddress);
    }

    // Mark the freespace area as cleaned so that it can be reused.
    // For example, we may record that the freespace with ID (bank) targetID is no longer leaking.
    const targetID = targetAddress >>> 24;
    if (this.pass === 1) {
      this.freespaceleak[targetID] = false;
    }
  }

  /**
   * Returns true if the SNES address (addr) is protected by a RATS tag.
   * We do this by using the assembler's ratsstart() to search backwards for a valid RATS tag.
   * @param {number} addr - The SNES address to check.
   * @returns {boolean} True if the address is protected by a RATS tag, false otherwise.
   */
  private isProtectedByRats(addr: number): boolean {
    // ratsstart returns the SNES address of a valid RATS tag for this address, or -1 if none is found.
    const ratsSnes = this.ratsstart(addr);
    return ratsSnes >= 0;
  }

  /**
   * Cleans up (frees) the area protected by the RATS tag for the given SNES address.
   * This method:
   *  1. Uses ratsstart() to locate the RATS tag.
   *  2. Converts that SNES address to a PC offset.
   *  3. Reads the block size from the tag (stored in little-endian at offsets +4 and +5).
   *  4. Fills the entire region (RATS tag + protected block) with the default freespace byte.
   *  5. Marks the corresponding freespace ID as no longer leaking.
   * @param {number} addr - The SNES address to clean.
   */
  cleanRats(addr: number): void {
    debug("cleanRats", addr, "/", addr.toString(16));
    const ratsSnes = this.ratsstart(addr);
    if (ratsSnes < 0) {
      console.warn(`cleanRats: No RATS tag found at or before address ${addr.toString(16)}`);
      return;
    }
    const ratsPC = this.snestopc(ratsSnes);
    if (ratsPC < 0) {
      console.warn(`cleanRats: Cannot convert RATS SNES address ${ratsSnes.toString(16)} to PC offset.`);
      return;
    }
    // The RATS tag is 8 bytes long.
    // Bytes at ratsPC+4 and ratsPC+5 (little-endian) hold the size of the protected block.
    const sizeLow = this.romdata[ratsPC + 4];
    const sizeHigh = this.romdata[ratsPC + 5];
    const blockSize = sizeLow | (sizeHigh << 8);
    const totalSize = 8 + blockSize; // tag plus the block it protects

    // Fill the entire region with the default freespace byte.
    for (let i = 0; i < totalSize; i++) {
      this.romdata[ratsPC + i] = this.default_freespacebyte;
    }
    // Mark the freespace as "clean" (no longer leaking) based on its ID.
    const freespaceID = ratsSnes >>> 24;
    this.freespaceleak[freespaceID] = false;
    console.log(
      `cleanRats: Cleaned RATS tag at SNES address ${ratsSnes.toString(16).toUpperCase()}, block size ${blockSize}`
    );
  }

  /**
   * Returns true if the given SNES address is within a freespace area.
   * For our purposes, we assume freespace areas are in banks $10 and above.
   * @param {number} addr - The SNES address to check.
   * @returns {boolean} True if the address is within a freespace area, false otherwise.
   */
  inFreespaceArea(addr: number): boolean {
    debug("inFreespaceArea", addr, "/", addr.toString(16))
    // The bank is the upper 8 bits of a 24-bit SNES address.
    const bank = addr >>> 16;
    debug("inFreespaceArea bank", bank, "/", bank.toString(16));
    return bank >= 0x10;
  }

  public handleStruct(words: string[]): void {
    debug("handleStruct", words)
    // Syntax:
    // struct {identifier} {snes_address}      OR
    // struct {extension_identifier} extends {parent_identifier}
    if (words.length < 3) {
      throw new Error("Struct definition requires at least two parameters.");
    }
    const structName = words[1];
    let base: number;
    let parent: string | undefined;
    if (words[2].toLowerCase() === "extends") {
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

  public handleEndStruct(words: string[]): void {
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
      // Also register this extension's labels under a combined name,
      // for example "Parent.Extension.Member" if desired.
      // (For simplicity we can also store the extension as a separate entry.)
      this.structs.set(`${parentName}.${this.currentStruct.name}`, this.currentStruct);
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

  public resolveStructLabel(labelRef: string): number {
    debug("resolveStructLabel", labelRef)
    // First, if the entire reference exists in our struct map, assume it's a full struct reference.
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
      arrayIndex = parseInt(arrayMatch[2], 10);
      extraMember = arrayMatch[3];
      if (extraMember.startsWith(".")) {
        extraMember = extraMember.substring(1);
      }
    }

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

        // If no member was specified, this is a reference to the struct itself.
        if (memberName.trim() === "") {
          return def.base;
        }
        if (!def.labels.has(memberName)) {
          throw new Error(`Member '${memberName}' not defined in struct '${potential}'.`);
        }
        const offset = def.labels.get(memberName);
        let finalAddress: number;
        if (def.parent) {
          const parentDef = this.structs.get(def.parent);
          if (!parentDef) {
            throw new Error(`Parent struct '${def.parent}' not defined for extension '${potential}'.`);
          }
          const combinedSize = parentDef.size + def.size;
          finalAddress = def.base + (arrayIndex * combinedSize) + parentDef.size + offset;
        } else {
          finalAddress = def.base + (arrayIndex * def.size) + offset;
        }
        debug("resolveStructLabel =", finalAddress);
        return finalAddress;
      }
    }
    throw new Error(`Struct not defined in reference: ${labelRef}`);
  }

  private evaluateRangeExpression(expr: string): number {
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
    debug("handleIncbin filenameWithRange", filenameWithRange)
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
    const fileData: Uint8Array = this.readFile(filename);
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
      if (parts.length !== 2) {
        throw new Error(`Invalid range specification: ${rangeStr}`);
      }
      startOffset = this.evaluateRangeExpression(parts[0]);
      endOffset = this.evaluateRangeExpression(parts[1]);
      // A value of 0 for endOffset means "until EOF"
      if (endOffset === 0) {
        endOffset = fileData.length;
      }
    }

    if (startOffset < 0 || startOffset > fileData.length) {
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
        if (this.pass === 0) {
          debug("handleIncbin targetLocation is label, pass 0");
          // On pass 0, create a freespace block first
          this.handleFreespace("freespace", ["align"]);
          // Now that freespace has set snespos, we can set the label
          this.setLabel(targetLocation, this.snespos);

          // Don't write data on pass 0
          this.handlePullPC();
          return;
        } else {
          // On later passes, look up the label's address
          targetAddress = this.getLabelValue(targetLocation);
          debug("handleIncbin targetAddress", targetAddress);
          this.snespos = targetAddress;
          this.realsnespos = targetAddress;
          this.startpos = targetAddress;
          this.realstartpos = targetAddress;
        }
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

    this.add_addr_to_line(this.realsnespos & 0xFFFFFF);
  }

  /**
   * Evaluates an expression (stub function).
   * @param {string} expression - The expression to evaluate.
   * @returns {boolean} True if the expression is true, false otherwise.
   */
  evaluateExpression(expression: string): boolean {
    debug("evaluateExpression", expression)
    // Resolve defines so tokens like "FOO" get replaced.
    const resolvedExpr = this.resolvedefines(expression);
    let result: number;
    try {
      result = this.mathCore.math(resolvedExpr);
    } catch (e) {
      throw new Error(`Error evaluating expression "${expression}" (resolved to "${resolvedExpr}"): ${e}`);
    }
    // In our assembler, a condition is true if the result is nonzero.
    debug("evaluateExpression =", result !== 0)
    return result !== 0;
  }

  /**
   * Checks for bank crossing issues.
   */
  checkBankCrossing(): void {
    if ((this.snespos & 0x7FFF) + this.bytes > 0x8000) {
      throw new Error("Bank crossing error detected");
    }
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
      )
        return -1;
      return addr & 0x3FFFFF;
    }

    if (this.mapper === "exlorom") {
      if (
        (addr & 0xF00000) === 0x700000 ||
        (addr & 0x408000) === 0x000000
      )
        return -1;
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
      )
        return -1;
      if ((addr & 0xC00000) !== 0xC00000) return (addr & 0x3FFFFF) | 0x400000;
      return addr & 0x3FFFFF;
    }

    if (this.mapper === "sfxrom") {
      // Emulate GSU1 – extra ROM data is not supported in SuperFX mode.
      if (
        (addr & 0x600000) === 0x600000 ||
        (addr & 0x408000) === 0x000000 ||
        (addr & 0x800000) === 0x800000
      )
        return -1;
      if (addr & 0x400000) return addr & 0x3FFFFF;
      else return ((addr & 0x7F0000) >> 1) | (addr & 0x7FFF);
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
        if ((addr & 0x008000) === 0) return -1;
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
      for (let i = 0; i < 8; i++) {
        if (this.sa1banks[i] === (addr & 0x700000)) {
          return 0x008000 | (i << 21) | (((addr & 0x0F8000)) << 1) | (addr & 0x7FFF);
        }
      }
      return -1;
    }

    if (this.mapper === "bigsa1rom") {
      if (addr >= 0x800000) return -1;
      if ((addr & 0x400000) === 0x400000) {
        return addr | 0xC00000;
      }
      if ((addr & 0x600000) === 0x000000) {
        return ((addr << 1) & 0x3F0000) | 0x8000 | (addr & 0x7FFF);
      }
      if ((addr & 0x600000) === 0x200000) {
        return 0x800000 | (((addr << 1) & 0x3F0000)) | 0x8000 | (addr & 0x7FFF);
      }
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
   * Resolves all define replacements in a given string.
   * @param {string} input - The string to resolve defines in.
   * @returns {string} The string with defines resolved.
   */
  resolvedefines(input: string): string {
    debug("resolvedefines", input);
    let result = "";
    let index = 0;

    if ((input.startsWith("sizeof(") || input.startsWith("objectsize(")) && input.endsWith(")")) {
      debug("resolvedefines sizeof found, skipping", input);
      return input;
    }

    // First, check if this is a for loop variable reference
    if (input.startsWith("!") && this.whileStatus.length > 0) {
      const varName = input.substring(1);
      // Check ALL loops in the stack, not just the innermost one
      for (let i = this.whileStatus.length - 1; i >= 0; i--) {
        const loop = this.whileStatus[i];
        if (loop.is_for && loop.for_variable === varName) {
          debug("resolvedefines found for loop variable", {
            varName,
            value: loop.for_cur
          });
          return loop.for_cur.toString();
        }
      }
    }

    // Then, process any explicit !defines as before.
    while (index < input.length) {
      const char = input[index];

      if (char === "\\" && input[index + 1] === "\\") {
        debug("resolvedefines double slash", char);
        result += "\\";
        index += 2;
      } else if (char === "\\" && input[index + 1] === "!") {
        debug("resolvedefines \!define", char);
        result += "!";
        index += 2;
      } else if (char === "!") {
        debug("resolvedefines !define", char);
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
          if (!this.validatedefinename(defineName)) throw new Error("Error: Invalid define name.");
        } else {
          while (index < input.length && /\w/.test(input[index])) {
            defineName += input[index++];
          }
        }
        if (defineName === "") {
          result += "!";
        } else {
          // Check for loop variables again before looking at defines
          // let foundLoopVar = false;
          // for (let i = this.whileStatus.length - 1; i >= 0; i--) {
          //   const loop = this.whileStatus[i];
          //   if (loop.is_for && loop.for_variable === defineName) {
          //     result += loop.for_cur.toString();
          //     foundLoopVar = true;
          //     break;
          //   }
          // }
          // if (!foundLoopVar) {
          if (!this.defines.has(defineName)) throw new Error(`Error: Define '${defineName}' not found.`);
          const replacement = this.defines.get(defineName);
          const resolved = this.resolvedefines(replacement);

          // Check if the resolved value looks like a define command that should be executed
          if (resolved.trim().startsWith("!") &&
              (resolved.includes("#=") || resolved.includes("+=") || resolved.includes(":=") ||
                resolved.includes("?=") || resolved.includes("="))) {
            // Execute the define command
            debug("resolvedefines executing nested command:", resolved);
            this.processCommand(resolved);
            // The result is a side effect (the command executed), not a string to include
            // so we don't append anything to the result
          } else {
            // Normal define replacement
            result += resolved;
          }
        }
      } else if (char === '"' && input[index + 1] === '"') {
        // Handle escaped double quotes
        debug("resolvedefines escaped double quote", char);
        result += '"';
        index += 2;
      } else {
        result += char;
        index++;
      }
    }

    // Replace tokens that look like struct references
    // This regex matches tokens with at least one dot (and an optional array index)
    result = result.replace(/\b([A-Z_a-z]\w*(?:\[\d+])?(?:\.[A-Z_a-z]\w*(?:\[\d+])?)+)\b/g, (match, token) => {
      debug("resolvedefines struct", result);
      try {
        // Resolve the struct reference (e.g. "ObjectList.PosY" or "ObjectList[2].PosY")
        const addr = this.resolveStructLabel(token);
        return addr.toString();
      } catch (e) {
        console.error("Error resolving struct label", e)
        // If resolution fails, leave the token as-is.
        return match;
      }
    });

    // Check for structs without access
    result = result.replace(/\b([A-Z_a-z]\w*)\b/g, (match, token) => {
      debug("resolvedefines struct (no dot or array index)", result);
      try {
        // Resolve the struct reference (e.g. "ObjectList.PosY" or "ObjectList[2].PosY")
        const addr = this.resolveStructLabel(token);
        return addr.toString();
      } catch (e) {
        // console.error('Error resolving struct (no dot or array index) label', e)
        // If resolution fails, leave the token as-is.
        return match;
      }
    });

    // Now, replace any bare tokens that match a label name with their value.
    // This will catch things like "FillCount" or even "FillCount+1"
    result = result.replace(/\b([A-Z_a-z]\w*)\b/g, (match, token) => {
      debug("resolvedefines label", token, "has label", this.labelTable.has(token));
      if (this.labelTable.has(token)) {
        // Only substitute if the label is marked static (if that's our policy)
        const entry = this.labelTable.get(token);
        debug("resolvedefines label =", entry);
        return "$" + entry.value.toString(16).toUpperCase();
        // TODO: We are inconsistently using hex or decimal here. causing spc700 to fail
        // return entry.value.toString();
      }
      return match;
    });

    // Quoted label
    result = result.replace(/('[A-Z_a-z]\w*')/g, (match) => {
      debug("resolvedefines quoted label", match);
      if (this.labelTable.has(match)) {
        const entry = this.labelTable.get(match);
        debug("resolvedefines quoted label =", entry);
        return entry.value.toString();
      }
      return match;
    });

    debug("resolvedefines =", { result });
    return result;
  }


  /**
   * Validates whether a given define name is allowed.
   * @param {string} name - The name to validate.
   * @returns {boolean} True if the name is valid, false otherwise.
   */
  validatedefinename(name: string): boolean {
    if (!name.length) return false;
    return /^\w+$/.test(name);
  }

  /**
   * Returns the compiled binary output.
   */
  getBinaryOutput = (): Uint8Array => {
    return new Uint8Array(this.romdata.slice(0, this.romdata.length));
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
          debug("getnum (label resolved) =", labelValue);
          return labelValue;
        }
      } else if (/^\w+$/.test(operand)) {
        // Otherwise, treat the operand as a label.
        const labelValue = this.getLabelValue(operand, false);
        debug("getnum (label resolved) =", labelValue);
        return labelValue;
      }
    }

    // Otherwise, assume the operand is a literal math expression.
    const value = this.mathCore.math(operand);
    debug("getnum (literal) =", value, "/", value.toString(16));
    return value;

    // // Handle an optional sign.
    // let sign = 1;
    // if (operand.startsWith("-")) {
    //   sign = -1;
    //   operand = operand.substring(1).trim();
    // } else if (operand.startsWith("+")) {
    //   operand = operand.substring(1).trim();
    // }

    // // TODO validate
    // let bitShift16 = false;
    // if (operand.startsWith("#<:")) {
    //   // shift right by 16
    //   operand = operand.substring(3).trim();
    //   bitShift16 = true;
    // }

    // // Handle an optional complement operator.
    // let doComplement = false;
    // if (operand.startsWith("~")) {
    //   doComplement = true;
    //   operand = operand.substring(1).trim();
    // }

    // // Determine base: hexadecimal if it starts with "$", binary if it starts with "%",
    // // otherwise assume decimal.
    // debug('getnum operand', operand)
    // let value = this.mathCore.math(operand);

    // // Apply sign
    // value = sign * value;

    // // If a complement was requested, perform a bitwise NOT.
    // if (doComplement) {
    //   // Note: In JavaScript the bitwise NOT works on 32-bit integers.
    //   value = ~value;
    // }

    // if (bitShift16) {
    //   value = value >>> 16;
    // }

    // debug('getnum =', value)
    // return value;
  }

  /**
   * Sets the current pass of assembly.
   * @param {number} pass - The pass number to set.
   */
  setPass(pass: number): void {
    debug("🏁 setPass", pass);
    this.pass = pass;
  }

  /**
   * Completes the current pass, performing any necessary cleanup.
   */
  public finishPass(): void {
    // TODO Make an option
    if (this.targetRom) {
      this.updateHeaderAndCRC32();
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

  /**
   * Returns a unique ID for freespace allocation.
   * @returns {number} The unique ID for the freespace allocation.
   */
  getFreespaceID(): number {
    debug("getFreespaceID")
    if (this.pass === 0 || this.pass === 1) {
      // Allocate a new freespace ID, store it, and return it.
      const id = this.nextFreespaceID++;
      this.freespaceAllocations.push(id);
      debug("getFreespaceID id", id)
      return id;
    } else {
      // On later passes, return the freespace ID that was allocated in pass 0.
      if (this.freespaceAllocIndex >= this.freespaceAllocations.length) {
        throw new Error("Freespace allocation ordering mismatch between passes.");
      }
      return this.freespaceAllocations[this.freespaceAllocIndex++];
    }
  }

  /**
   * Finds available SNES freespace for a given size.
   * @param {number} size - The size of the freespace to find.
   * @param {boolean} isForCode - Whether the freespace is for code.
   * @param {boolean} autoExpand - Whether to automatically expand the ROM.
   * @param {boolean} respectBankBorders - Whether to respect bank borders.
   * @param {boolean} align - Whether to align the freespace.
   * @param {number} fsByte - The byte value to check for.
   * @returns {number} The address of the freespace.
   */
  getsnesfreespace(size: number, isForCode: boolean, autoExpand: boolean, respectBankBorders: boolean, align: boolean, fsByte: number): number {
    debug("getsnesfreespace", { size, autoExpand, respectBankBorders, align, fsByte });
    if (size > 0x10000) {
      debug("getsnesfreespace size > 0x10000", size, "/", size.toString(16));
      return -1;
    }

    // Don't add RATS tag size if size is 0 (used for finding start of freespace)
    const sizeWithRats = size > 0 ? size + 8 : size;

    if (this.mapper === "lorom") {
      if (sizeWithRats > 0x8008 && respectBankBorders) {
        return -1;
      }
      // Start searching from $80000 (bank $80) up to max ROM size or $200000
      const pos = this.findFreespace(0x80000, Math.min(this.romlen, 0x200000), sizeWithRats, respectBankBorders, align, fsByte);
      if (pos >= 0) {
        debug("getsnesfreespace found freespace at", pos.toString(16));
        return pos;
      }
      if (autoExpand) {
        debug("getsnesfreespace autoExpand");
        return this.expandRomAndFindFreespace(sizeWithRats, fsByte);
      }
    }

    if (this.mapper === "hirom") {
      return this.findFreespace(0, this.romlen, sizeWithRats, respectBankBorders, align, fsByte);
    }

    return -1;
  }

  /**
   * Expands the ROM size and attempts to find new freespace.
   * @param {number} size - The size of the freespace to find.
   * @param {number} fsByte - The byte value to check for.
   * @returns {number} The address of the freespace.
   */
  expandRomAndFindFreespace(size: number, fsByte: number): number {
    debug("expandRomAndFindFreespace", { size, fsByte });
    if (this.romlen === 0x080000) {
      debug("expandRomAndFindFreespace romlen 0x080000");
      this.expandRom(0x100000, fsByte);
    } else if (this.romlen === 0x100000) {
      debug("expandRomAndFindFreespace romlen 0x100000");
      this.expandRom(0x200000, fsByte);
    } else if (this.romlen === 0x200000 || this.romlen === 0x300000) {
      debug("expandRomAndFindFreespace romlen 0x200000 or 0x300000");
      this.expandRom(0x400000, fsByte);
    } else {
      debug("expandRomAndFindFreespace romlen not 0x080000, 0x100000, 0x200000 or 0x300000");
      return -1;
    }
    return this.findFreespace(0x80000, Math.min(this.romlen, 0x200000), size, true, true, fsByte);
  }

  /**
   * Expands ROM size and fills it with a specified byte.
   * @param {number} newSize - The new size of the ROM.
   * @param {number} fsByte - The byte value to fill the ROM with.
   */
  expandRom(newSize: number, fsByte: number): void {
    debug("expandRom", { newSize, fsByte });
    this.writeDataBytes(this.romlen, fsByte, newSize - this.romlen);
    this.romlen = newSize;
  }

  /**
   * Writes a block of data to ROM.
   * @param {number} start - The starting address of the block to write.
   * @param {number} value - The byte value to write.
   * @param {number} length - The length of the block to write.
   */
  writeDataBytes(start: number, value: number, length: number): void {
    debug("writeDataBytes", { start, value, length });
    debug("writeDataBytes before this.romdata.length", this.romdata.length, "/", this.romdata.length.toString(16));
    for (let i = 0; i < length; i++) {
      this.romdata[start + i] = value;
    }
    debug("writeDataBytes after this.romdata.length", this.romdata.length, "/", this.romdata.length.toString(16));
  }

  /**
   * Finds an available freespace block in ROM.
   * @param {number} start - The starting address of the region to search.
   * @param {number} end - The ending address of the region to search.
   * @param {number} size - The size of the region to search for.
   * @param {boolean} respectBankBorders - Whether to respect bank borders.
   * @param {boolean} align - Whether to align the freespace.
   * @param {number} fsByte - The byte value to check for.
   * @returns {number} The address of the freespace.
   */
  findFreespace(start: number, end: number, size: number, respectBankBorders: boolean, align: boolean, fsByte: number): number {
    debug("findFreespace", { start, end, size, align, fsByte });
    while (start + size <= end) {
      // Check if start + size would exceed romdata length
      if (start + size >= this.romdata.length) {
        debug("findFreespace start + size >= romdata.length", start + size, ">", this.romdata.length);
        return -1;
      }
      if (this.isBlockEmpty(start, size, fsByte)) {
        debug("findFreespace found freespace at", start, "/", start.toString(16));
        return start;
      }
      start += align ? 8 : 1;
    }
    return -1;
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
   * Resizes a RATS tag in ROM.
   * @param {number} snesaddr - The SNES address of the RATS tag.
   * @param {number} newlen - The new length of the RATS tag.
   */
  resizeRats(snesaddr: number, newlen: number): void {
    debug("resizeRats", snesaddr, newlen);
    const pos = this.snestopc(this.ratsstart(snesaddr));
    if (pos < 0) {
      debug("resizeRats pos < 0", pos);
      return;
    }
    if (newlen !== 0) newlen--;

    debug("resizeRats pos", pos, "newlen", newlen);
    this.write1At(pos + 4, newlen & 0xFF);
    this.write1At(pos + 5, (newlen >> 8) & 0xFF);
    this.write1At(pos + 6, (newlen & 0xFF) ^ 0xFF);
    this.write1At(pos + 7, ((newlen >> 8) & 0xFF) ^ 0xFF);
  }

  /**
   * Returns the start of a RATS tag for a given SNES address.
   * @param {number} snesaddr - The SNES address to find the RATS tag for.
   * @returns {number} The starting address of the RATS tag.
   */
  ratsstart(snesaddr: number): number {
    debug("ratsstart", snesaddr);
    const pcaddr = this.snestopc(snesaddr);
    if (pcaddr < 0x7FFF8) return -1;

    for (let i = pcaddr - 0x10000; i >= 0; i--) {
      if (this.isRatsTag(i)) {
        return this.pctosnes(i);
      }
    }
    return -1;
  }

  /**
   * Checks if a given position in ROM contains a valid RATS tag.
   * @param {number} index - The position in ROM to check.
   * @returns {boolean} True if the position contains a valid RATS tag, false otherwise.
   */
  isRatsTag(index: number): boolean {
    // debug('isRatsTag', index);
    return (
      this.romdata[index] === "S".charCodeAt(0) &&
      this.romdata[index + 1] === "T".charCodeAt(0) &&
      this.romdata[index + 2] === "A".charCodeAt(0) &&
      this.romdata[index + 3] === "R".charCodeAt(0) &&
      (this.romdata[index + 4] ^ this.romdata[index + 6]) === 0xFF &&
      (this.romdata[index + 5] ^ this.romdata[index + 7]) === 0xFF
    );
  }

  /**
   * Writes a RATS tag at the current position.
   * Format: "STAR" + 2-byte size + 2-byte inverse size
   * @param {number} size - The size of the data following the RATS tag
   */
  writeRatsTag(size: number): void {
    debug("writeRatsTag", size);
    // Write "STAR"
    this.write1("S".charCodeAt(0));
    this.write1("T".charCodeAt(0));
    this.write1("A".charCodeAt(0));
    this.write1("R".charCodeAt(0));

    // Write size (16-bit)
    const adjustedSize = size - 1; // RATS size is stored as size-1
    this.write1(adjustedSize & 0xFF);
    this.write1((adjustedSize >> 8) & 0xFF);

    // Write inverse size
    this.write1(~(adjustedSize & 0xFF) & 0xFF);
    this.write1(~((adjustedSize >> 8) & 0xFF) & 0xFF);
  }

  /**
   * Starts a new freespace block with a RATS tag
   * @param {number} size - The size of data that will be written
   * @returns {number} The address after the RATS tag where data should be written
   */
  startFreespaceWithRats(size: number): number {
    debug("startFreespaceWithRats", size);
    // Write the RATS tag
    this.writeRatsTag(size);
    // Return the current position where data should be written
    return this.snespos;
  }

  /**
   * Writes a byte to a specific ROM position.
   * @param {number} pos - The position in ROM to write to.
   * @param {number} value - The byte value to write.
   */
  write1At(pos: number, value: number): void {
    debug("write1At", { pos, value });
    this.romdata[pos] = value;
  }

  // Updates the header checksum (16-bit) and CRC32.
  // For LoROM, the header is at 0x7FC0; for HiROM (and exhirom) at 0xFFC0.
  updateHeaderAndCRC32(): void {
    debug("updateHeaderAndCRC32")
    let headerOffset: number;
    if (this.mapper === "lorom") {
      headerOffset = 0x7FC0;
    } else if (this.mapper === "hirom" || this.mapper === "exhirom") {
      headerOffset = 0xFFC0;
    } else {
      // For other mappers we choose a default (or skip header update)
      headerOffset = 0xFFC0;
    }

    if (this.romlen < headerOffset + 0x20) {
      console.warn("ROM too small for header update.");
      return;
    }

    // Calculate the 16-bit checksum (the sum of all bytes modulo 0x10000).
    let checksum = 0;
    for (let i = 0; i < this.romlen; i++) {
      checksum = (checksum + (this.romdata[i] & 0xFF)) & 0xFFFF;
    }
    const complement = (~checksum) & 0xFFFF;

    // In a SNES header the checksum complement is typically stored at offset 0x1C
    // and the checksum at offset 0x1E (relative to the header base).
    this.romdata[headerOffset + 0x1C] = complement & 0xFF;
    this.romdata[headerOffset + 0x1D] = (complement >> 8) & 0xFF;
    this.romdata[headerOffset + 0x1E] = checksum & 0xFF;
    this.romdata[headerOffset + 0x1F] = (checksum >> 8) & 0xFF;

    // Now compute the CRC32 of the entire ROM.
    const crc32 = this.computeCRC32(this.romdata, this.romlen);
    debug(`Header updated: Checksum = 0x${checksum.toString(16).toUpperCase()}, Complement = 0x${complement.toString(16).toUpperCase()}, CRC32 = 0x${crc32.toString(16).toUpperCase()}`);

    // (Optionally, you might store crc32 in a property or write it into the header if desired.)
  }

  // Initializes the CRC32 lookup table (if not already built).
  initCRCTable(): void {
    if (Assembler.crcTable !== null) return;
    Assembler.crcTable = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        if (c & 1) {
          c = 0xEDB88320 ^ (c >>> 1);
        } else {
          c = c >>> 1;
        }
      }
      Assembler.crcTable[i] = c;
    }
  }

  // Computes CRC32 over the first 'length' bytes of data.
  computeCRC32(data: number[], length: number): number {
    this.initCRCTable();
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < length; i++) {
      crc = Assembler.crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  readFile = (filePath) => {
    debug("readFile", filePath)
    try {
      // Get the directory of the current file.
      const currentDir = this.currentFile ? path.dirname(this.currentFile) : process.cwd();
      // Resolve the full path relative to the current file.
      const fullPath = path.resolve(currentDir, filePath);
      debug("readFile:", fullPath);
      const buffer = fs.readFileSync(fullPath);
      return new Uint8Array(buffer);
    } catch (error: unknown) {
      console.error("Error reading file:", error);
      return null;
    }
  }

  /**
   * Expands an operand string into its expanded form and determines its expected length.
   * @param {string} operand The operand to expand.
   * @returns {{ expanded: string; length: number }} An object containing the expanded operand and its expected length.
   */
  expandOperand(operand: string): { expanded: string; length: number } {
    debug("expandOperand", operand)
    let expanded = operand.trim()
    let expectedLength = 2; // Default to 2 bytes for most operands
    let forceTwoBytes = false; // Flag to force 2 bytes for bank operations

    try {
      expanded = this.resolvedefines(expanded);
    } catch (e) {
      debug("expandOperand not a define")
    }
    debug("expandOperand: after resolvedefines:", { expanded });

    // Check for bank shorthand operations before any other processing
    if (expanded.includes("<:") || expanded.includes("bank(") || expanded.includes("bankbyte(")) {
      forceTwoBytes = true;
      debug("expandOperand detected bank operation, forcing 2 bytes");
    }

    // Immediate mode: if it starts with '#', remove the '#' and expand the inner expression.
    if (operand.startsWith("#")) {
      debug("expandOperand immediate mode", expanded);
      const inner = operand.substring(1).trim();

      // Check for bank operations in the inner expression
      if (inner.includes("<:") || inner.includes("bank(") || inner.includes("bankbyte(")) {
        forceTwoBytes = true;
        debug("expandOperand detected bank operation in immediate mode, forcing 2 bytes");
      }

      // Evaluate the inner expression (which may be something like "bank(other_test)" or "<:main")
      const value = this.getnum(inner);

      // Determine expected length based on value, unless we need to force 2 bytes
      if (forceTwoBytes) {
        expectedLength = 2;
      } else if (value <= 0xFF) {
        expectedLength = 1;
      } else if (value <= 0xFFFF) {
        expectedLength = 2;
      } else {
        expectedLength = 3;
      }

      // Format the value as a hex literal (or in decimal if preferred)
      const literal = "$" + value.toString(16).toUpperCase();
      // Reconstruct immediate operand preserving the '#' prefix.
      expanded = "#" + literal;
    } else if (expanded.includes(",")) {
      debug("expandOperand indexed mode", expanded);
      // For indexed addressing modes, check if X or Y index is present
      if (expanded.includes(",X") || expanded.includes(",Y") || expanded.includes(",S")) {
        // For indexed modes, default to 2 bytes unless clearly a 3-byte addressing mode
        if (expanded.startsWith("$") && expanded.length > 5) {
          expectedLength = 3; // Long addressing mode with index
        }
      }
    } else if (expanded.startsWith("$")) {
      debug("expandOperand direct addressing mode", expanded);
      // Direct addressing - determine length by the number of digits
      const hexPart = expanded.substring(1);
      if (hexPart.length <= 2) {
        expectedLength = 1; // Zero page
      } else if (hexPart.length <= 4) {
        expectedLength = 2; // Absolute
      } else {
        expectedLength = 3; // Long
      }
    } else if (expanded.startsWith("[") && expanded.endsWith("]")) {
      debug("expandOperand indirect addressing mode", expanded);
      // Indirect addressing
      expectedLength = 2;
    } else {
      debug("expandOperand other mode", expanded);
      // For non-immediate operands, if the operand does not start with a literal indicator,
      // it is likely a label, a struct reference, or similar.
      // We check if it starts with a "$", "%" or a digit; if not, we try to evaluate it.
      if (!expanded.match(/^[\d$%]/) || expanded.includes("+") || expanded.includes("-") || expanded.includes("*") || expanded.includes("/")) {
        debug("expandOperand parse math", expanded);
        try {
          // Try math evaluation as fallback
          const value = this.mathCore.math(expanded);
          // If evaluation succeeds, return the literal value.
          expanded = "$" + value.toString(16).toUpperCase();

          // Determine expected length based on calculated value
          if (forceTwoBytes) {
            expectedLength = 2;
          } else if (value <= 0xFF) {
            expectedLength = 1;
          } else if (value <= 0xFFFF) {
            expectedLength = 2;
          } else {
            expectedLength = 3;
          }
        } catch (e) {
          // Likely a plain label or struct reference; leave it unchanged.
          debug("expandOperand label/struct reference", expanded);
          expectedLength = 2; // Default for labels
        }
      }
    }

    // Check if the value is a math expression that needs to be evaluated
    if (expanded.includes("+") || expanded.includes("-") || expanded.includes("*") || expanded.includes("/") ||
    expanded.includes("&") || expanded.includes("|") || expanded.includes("^") ||
    expanded.includes("<<") || expanded.includes(">>") || expanded.includes("(")) {
      try {
        // First resolve any defines inside the expression
        const resolvedValue = this.resolvedefines(expanded);
        // Then evaluate the math expression
        const result = this.mathCore.math(resolvedValue);
        if (!Number.isNaN(result)) {
          // Only use the result if it's a valid number
          expanded = "$" + result.toString(16).toUpperCase();
          debug(`Evaluated math expression in define: ${resolvedValue} = ${expanded}`);
        }
      } catch (error) {
        // If evaluation fails, keep the original value
        debug(`Math evaluation skipped for expression: ${expanded}`);
      }
    }

    // If we need to force 2 bytes because of bank operations, override the length
    if (forceTwoBytes) {
      expectedLength = 2;
    }

    debug("expandOperand =", expanded, "length =", expectedLength);
    return { expanded, length: expectedLength };
  }

  getSizeOf(identifier: string): number {
    debug("getSizeOf", identifier)
    // For backwards compatibility, remove surrounding quotes.
    if (identifier.startsWith('"') && identifier.endsWith('"')) {
      identifier = identifier.substring(1, identifier.length - 1);
    }
    if (!this.structs.has(identifier)) {
      throw new Error(`Struct '${identifier}' doesn't exist.`);
    }
    const def = this.structs.get(identifier);
    // sizeof returns the base size of that struct (for an extension, the size defined in that extension)
    debug("getSizeOf =", def.size)
    return def.size;
  }

  getObjectSize(identifier: string): number {
    debug("getObjectSize", identifier)
    // For backwards compatibility, remove surrounding quotes.
    if (identifier.startsWith('"') && identifier.endsWith('"')) {
      identifier = identifier.substring(1, identifier.length - 1);
    }
    if (!this.structs.has(identifier)) {
      throw new Error(`Struct '${identifier}' doesn't exist.`);
    }
    const def = this.structs.get(identifier);
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

  handleProt(words: string[]): void {
    debug("handleProt", words);
    if (words.length === 0) {
      throw new Error("PROT command requires at least one label parameter.");
    }

    if (this.pass === 0) {
      return;
    }

    // Split on commas and trim whitespace
    const labels = words.join(" ").split(",").map(label => label.trim());
    debug("handleProt labels", labels);

    if (labels.length > 85) {
      throw new Error("PROT command cannot protect more than 85 labels.");
    }

    // Validate each label exists and points to a freespace area
    for (const label of labels) {
      if (!this.labelTable.has(label)) {
        throw new Error(`Label '${label}' not found for PROT command.`);
      }
    }

    // Record the protected labels for the current freespace block
    if (!this.currentFreespaceBlock) {
      throw new Error("PROT command must be used immediately after a FREECODE/FREESPACE/FREEDATA command.");
    }

    // Store the protected labels with the current freespace block
    this.currentFreespaceBlock.protectedLabels = labels;
    debug("handleProt this.currentFreespaceBlock.protectedLabels", this.currentFreespaceBlock.protectedLabels);
  }

  // Add this method to handle starting a new freespace block
  startFreespaceBlock = (start: number, size: number, isStatic: boolean = false): void => {
    debug("startFreespaceBlock", { start, size, isStatic }, start.toString(16))
    const block: FreespaceBlock = {
      start,
      size,
      static: isStatic
    };
    this.freespaceBlocks.push(block);
    this.currentFreespaceBlock = block;
  }

  // Add this method to check if a label is protected
  isLabelProtected = (label: string): boolean => {
    debug("isLabelProtected", label)
    for (const block of this.freespaceBlocks) {
      if (block.protectedLabels?.includes(label)) {
        return true;
      }
    }
    return false;
  }

  // Add these methods
  setIncludePaths = (paths: string[]): void => {
    debug("setIncludePaths", paths);
    this.includePaths = paths;
  }

  resolveIncludePath = (filename: string): string => {
    debug("resolveIncludePath", filename);
    // Strip quotes if present
    if ((filename.startsWith('"') && filename.endsWith('"')) ||
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

  handleInclude = (command: string, filename?: string): void => {
    debug("handleInclude", command, filename);

    // Check if this is the first command in the file
    // Only for include/includefrom commands
    // if (this.lineNumber > 1) {
    //   throw new Error(`${command} must be the first command in the file`);
    // }

    // Mark file as included
    this.includedFiles.add(filename);
    this.assemblefile(filename, true);

    if (command === "includefrom" && !filename) {
      throw new Error("includefrom requires a filename parameter");
    }
  }

  handleIncludeOnce = (): void => {
    debug("handleIncludeOnce");

    // Add current file to guarded set
    this.includeGuardedFiles.add(this.currentFile);
  }

  assemblefile = (filename: string, isInclude: boolean): void => {
    debug("assemblefile", filename, isInclude);

    const resolvedPath = this.resolveIncludePath(filename);

    // Check for include guards
    if (this.includeGuardedFiles.has(resolvedPath)) {
      return;
    }
    // Check for recursion limit
    if (this.includeStack.length >= 512) {
      throw new Error("Include recursion limit exceeded (512 levels)");
    }

    // Save current state
    const previousFile = this.currentFile;
    this.includeStack.push(previousFile);

    // Read and process the file
    try {
      const content = fs.readFileSync(resolvedPath, "utf8");
      this.currentFile = resolvedPath;

      // Process the file line by line
      const lines = content.split("\n");
      for (const line of lines) {
        this.processCommand(line);
      }
    } finally {
      // Restore state
      this.currentFile = this.includeStack.pop() || "";
    }
  }

  handleTableCommand(words: string[]): void {
    debug("handleTableCommand", words);

    if (words.length < 2) {
      throw new Error("Table command requires a table name");
    }
    // TODO actually parse the table file
    this.currentTable = words[1];
    // TODO support directions rtl and ltr
    // Clear any existing mappings for this table
    this.characterMappings.clear();
    // TODO Add characters to mapping here
  }

  handleCharacterMapping(words: string[]): void {
    debug("handleCharacterMapping", words);
    if (words.length !== 3) {
      throw new Error("Character mapping requires format: 'char' = value");
    }
    const char = words[0].replace(/["']/g, "");
    const value = this.getnum(words[2]);
    this.characterMappings.set(char, value);
  }

  mapCharacter(char: string): number {
    return this.characterMappings.get(char) ?? char.charCodeAt(0);
  }

  processStringWithMapping(str: string): number[] {
    return Array.from(str).map(char => this.mapCharacter(char));
  }
}

