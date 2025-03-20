import { Arch65816 } from "./Arch65816";
import { AddressToLineMapping } from "./addr2line";
import { confirmqpar, hex } from "./cppstring";
import { MacroProcessor } from "./macroprocessor";
import { MathCore } from "./mathcore";

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

export class Assembler {
  public snespos: number = 0;
  public realsnespos: number = 0;
  public startpos: number = 0;
  public realstartpos: number = 0;
  public bytes: number = 0;
  public disable_bank_cross_errors: boolean = false;

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

  public namespaceStack: string[] = [];
  public currentNamespace: string = "";

  public macros: MacroProcessor;
  public mathCore: MathCore;

  public moreonlinecond: boolean = true;
  public addressToLineMapping: AddressToLineMapping = new AddressToLineMapping();
  public currentFile: string = "";
  public currentLine: number = 0;

  public defines: Map<string, string> = new Map();
  public builtindefines: Set<string> = new Set();
  public emulatexkas: boolean = false;

  public arch65816: Arch65816;

  public pushpcStack: { snespos: number; startpos: number; realsnespos: number; realstartpos: number }[] = [];
  public pushpcnum: number = 0;
  public freespacebyte: { [key: number]: number } = {};
  public freespacepos: { [key: number]: number } = {};
  public freespaceleak: { [key: number]: boolean } = {};
  public freespaceorgpos: { [key: number]: number } = {};
  public freespaceorglen: { [key: number]: number } = {};
  public freespacelen: { [key: number]: number } = {};


  public nextFreespaceID: number = 0;
  public labelTable: Map<string, number> = new Map();

  public forwardLabels: { [count: number]: number } = {};
  public backwardLabels: { [count: number]: number } = {};
  public plusLabels: Map<string, number> = new Map();
  public minusLabels: Map<string, number> = new Map();

  constructor(macros: MacroProcessor) {
    this.macros = macros;
    this.arch65816 = new Arch65816(this);
    this.mathCore = new MathCore();

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
  public verifysnespos(): void {
    console.log(`assembler verifysnespos: snespos: ${hex(this.snespos)} realsnespos: ${hex(this.realsnespos)}`);
    if (this.snespos < 0 || this.realsnespos < 0) {
      console.error("assembler verifysnespos: Missing ORG directive. Resetting SNES position.");
      this.snespos = 0x008000;
      this.realsnespos = 0x008000;
      this.startpos = 0x008000;
      this.realstartpos = 0x008000;
    }
  }

  /**
   * Adjusts memory addresses based on the ROM type.
   * @param inaddr
   * @param step
   */
  public fixsnespos(inaddr: number, step: number): number {
    console.log(`assembler fixsnespos: inaddr: ${hex(inaddr)} step: ${hex(step)}`);
    switch (this.mapper) {
      case "lorom":
        return (inaddr & 0xFFFF) + step > 0xFFFF ? inaddr + step + 0x8000 : inaddr + step;
      case "hirom":
        if ((inaddr & 0x400000) === 0 && (inaddr & 0xFFFF) + step > 0xFFFF) {
          return inaddr + step + 0x8000;
        }
        return inaddr + step;
      case "exlorom":
      case "bigsa1rom":
        return this.pctosnes(this.snestopc(inaddr) + step);
      case "exhirom":
        if ((inaddr & 0x400000) === 0 && (inaddr & 0xFFFF) + step > 0xFFFF) {
          return inaddr + step + 0x8000;
        }
        return inaddr + step;
      case "sa1rom":
      case "sfxrom":
        if ((inaddr & 0x400000) === 0) {
          return (inaddr & 0xFFFF) + step > 0xFFFF ? inaddr + step + 0x8000 : inaddr + step;
        }
        return inaddr + step;
      case "norom":
        return inaddr + step;
      default:
        throw new Error(`Unknown mapper type: ${this.mapper}`);
    }
  }

  /**
   * Advances memory position while handling bank crossing.
   * @param num
   */
  public step(num: number): void {
    console.log("assembler step", num);
    if (this.disable_bank_cross_errors) {
      this.snespos = (this.snespos & 0xff000000) | this.fixsnespos(this.snespos & 0xffffff, num);
      this.realsnespos = (this.realsnespos & 0xff000000) | this.fixsnespos(this.realsnespos & 0xffffff, num);
      this.startpos = this.snespos;
      this.realstartpos = this.realsnespos;
    } else {
      this.snespos += num;
      this.realsnespos += num;
    }
    this.bytes += num;
  }

  /**
   * Writes a single byte to ROM.
   * @param num
   */
  public write1_65816(num: number): void {
    console.log("assembler write1_65816", hex(num));
    this.verifysnespos();
    const pcpos = this.snestopc(this.realsnespos & 0xFFFFFF);
    console.log("assembler write1_65816 pcpos", hex(pcpos));

    console.log("assembler write1_65816 this.pass", this.pass);
    if (this.pass === 2) {
      if (pcpos < 0) {
        this.movinglabelspossible = true;
        throw new Error(`Error: SNES address doesn't map to ROM: ${hex(this.realsnespos)}`);
      }

      this.romdata[pcpos] = num & 0xFF;

      console.log("assembler write1_65816 romdata[pcpos]", hex(this.romdata[pcpos]));

      if (pcpos >= this.romdata.length) {
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
   * @param start
   * @param value
   * @param length
   */
  public fillRomData(start: number, value: number, length: number): void {
    console.log("assembler fillRomData", start, value, length);
    for (let i = 0; i < length; i++) {
      this.romdata[start + i] = value;
    }
  }

  /**
   * Picks the appropriate instruction handler based on architecture.
   * @param words
   */
  public asblock_pick(words: string[]): boolean {
    console.log("assembler asblock_pick", words);
    this.recent_opcode_num = 1;
    if (words.length === 0) {
      return true;
    }

    const arch = "arch_65816"; // Placeholder, should be determined dynamically
    const op_len = 0;

    if (arch === "arch_spc700") {
      return this.asblock_spc700(words);
    }
    if (arch === "arch_65816") {
      const oldword0 = words[0];
      if (this.asblock_65816(words, false, op_len)) {
        return true;
      } else {
        return false;
      }
    }
    return true;
  }

  /**
   * Placeholder for architecture-specific instruction handling.
   * @param words
   */
  public asblock_spc700(words: string[]): boolean {
    return false;
  }

  public asblock_65816(words: string[], fake: boolean, outlen: number): boolean {
    console.log("assembler asblock_65816", words);
    if (words.length === 0) {
      return false;
    }

    if (!this.arch65816.asblock_65816(words, false)) {
      throw new Error(`Unknown instruction: ${words[0]}`);
    }

    return true;
  }

  /**
   * Determines the byte size of an opcode.
   * @param c
   */
  public getlenfromchar(c: string): number {
    console.log("assembler getlenfromchar", c);
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
   * @param num
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
  public read1(insnespos: number): number {
    const addr = this.snestopc(insnespos);
    if (addr < 0 || addr + 1 > this.romlen) {
      return -1;
    }
    return this.romdata[addr];
  }

  public read2(insnespos: number): number {
    const addr = this.snestopc(insnespos);
    if (addr < 0 || addr + 2 > this.romlen) {
      return -1;
    }
    return this.romdata[addr] | (this.romdata[addr + 1] << 8);
  }

  public read3(insnespos: number): number {
    const addr = this.snestopc(insnespos);
    if (addr < 0 || addr + 3 > this.romlen) {
      return -1;
    }
    return this.romdata[addr] | (this.romdata[addr + 1] << 8) | (this.romdata[addr + 2] << 16);
  }

  assembleblock(block: string): void {
    console.log("assembler assembleblock", block);
    if (!block.trim()) {
      return;
    }

    block = this.processMultiLineOperators(block);

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

  /**
   * Processes and handles multi-line formatting operators `,` and `\`.
   * @param block
   */
  public processMultiLineOperators(block: string): string {
    console.log("assembler processMultiLineOperators");
    const lines = block.split("\n");
    const processedLines: string[] = [];
    let buffer = "";

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (line.endsWith("\\")) {
            buffer += line.slice(0, -1); // Remove `\` and concatenate
        } else if (line.endsWith(",")) {
            buffer += line; // Keep `,` in concatenation
        } else {
            processedLines.push(buffer + line);
            buffer = "";
        }
    }

    if (buffer) processedLines.push(buffer);

    return processedLines.join("\n");
  }

  /**
   * Processes a single command from `assembleblock`.
   * @param command
   */
  public processCommand(command: string): void {
    console.log("assembler processCommand", command);
    let words = command.trim().split(/\s+/);
    if (words.length === 0) return;

    let resolved = "";
    const addrToLinePos = this.realsnespos & 0xFFFFFF;

    // Ensure proper condition handling
    if (!this.moreonlinecond && !["elseif", "else", "endif", "endwhile"].includes(words[0].toLowerCase())) {
        return;
    }

    // TODO: inmacro is external and resolvedefines is external
    // RPG Hacker: Fix issue where defines in elseifs weren't resolving correctly
    if (words[0].toLowerCase() === "elseif" && this.numtrue + 1 === this.numif) {
        const tmp =  this.macros.inmacro ? this.macros.replace_macro_args(command) : command;
        resolved = this.resolvedefines(tmp);
        words = resolved.trim().split(/\s+/);
    }

    const keyword = words[0].toLowerCase();
    switch (keyword) {
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
            this.handleDataDirective(words[0], words.slice(1));
            break;
        case "macro":
            this.handleMacro(words.slice(1));
            break;
        case "endmacro":
            this.handleEndMacro();
            break;
        case "print":
            console.log(this.handlePrint(words.slice(1).join(" ")));
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
        case "pushpc":
            this.handlePushPC();
            break;
        case "pullpc":
            this.handlePullPC();
            break;
        default: {
          if (words[0].startsWith("%")) {
            console.log(`assembler handleInstruction callmacro: ${words.join(" ")}`);
            this.macros.callmacro(words.join(" ").substring(1));
          } else if (words[0].startsWith(";")) {
            console.log(`assembler handleInstruction comment: ${words.join(" ")}`);
          } else  if (words[0] === "") {
            console.log(`assembler handleInstruction white space: ${words.join(" ")}`);
          } else {
            const wasOpcode = this.asblock_pick(words);
            if (!wasOpcode) {
              console.error("assembler processCommand unknown operation", keyword)
            }
          }
          break;
        }
    }

    this.add_addr_to_line(addrToLinePos);
  }

  /**
   * Handles `+` and `-` relative labels.
   */
  // public handleRelativeLabel(label: string): void {
  //   console.log('assembler handleRelativeLabel', label);
  //   let count = label.length; // Handles cases like `+++` or `----`

  //   if (label.startsWith("+")) {
  //       this.forwardLabels[count] = this.snespos;
  //   } else {
  //       this.backwardLabels[count] = this.snespos;
  //   }
  // }
  /**
   * Handles `+` and `-` relative labels correctly using SNES memory position instead of `currentLine`.
   * @param label
   */
  public handleRelativeLabel(label: string): number {
    console.log("assembler handleRelativeLabel", label);

    // Track labels based on SNES memory position, not line numbers
    const labelKey = `${this.currentFile}:${label}`;
    console.log("assembler labelKey", labelKey, hex(this.snespos));

    if (this.pass > 0) {
        if (label.startsWith("+")) {
            if (this.plusLabels.has(labelKey)) {
                return this.plusLabels.get(labelKey);
            }
        } else if (label.startsWith("-")) {
            if (this.minusLabels.has(labelKey)) {
                return this.minusLabels.get(labelKey);
            }
        }
        throw new Error(`Error: Undefined relative label '${label}'`);
    }

    // Pass 0: Store the label's address using SNES memory position
    if (label.startsWith("+")) {
        this.plusLabels.set(labelKey, this.snespos);
    } else if (label.startsWith("-")) {
        this.minusLabels.set(labelKey, this.snespos);
    }

    return this.snespos;
  }

  /**
   * Resolves `+` and `-` labels when encountered in instructions.
   * @param label
   */
  public resolveRelativeLabel(label: string): number {
    console.log("assembler resolveRelativeLabel", label);
    const count = label.length;

    if (label.startsWith("+")) {
      if (!this.forwardLabels[count]) {
        throw new Error(`Error: Undefined forward label '${label}'`);
      }
      return this.forwardLabels[count];
    } else {
      if (!this.backwardLabels[count]) {
          throw new Error(`Error: Undefined backward label '${label}'`);
      }
      return this.backwardLabels[count];
    }
  }

  /**
   * Finds the next occurrence of a `+` label based on SNES memory position.
   * @param label
   */
  public findNextLabel(label: string): number {
    console.log("assembler findNextLabel", label);
    const labelKey = `${this.currentFile}:${label}`;
    console.log("assembler findNextLabel labelKey", labelKey);
    if (!this.plusLabels.has(labelKey)) {
      throw new Error(`Error: Undefined + label: '${label}'`);
    }
    return this.plusLabels.get(labelKey);
  }

  /**
   * Finds the previous occurrence of a `-` label based on SNES memory position.
   * @param label
   */
  public findPreviousLabel(label: string): number {
    console.log("assembler findPreviousLabel", label);
    const labelKey = `${this.currentFile}:${label}`;
    console.log("assembler findPreviousLabel labelKey", labelKey);
    if (!this.minusLabels.has(labelKey)) {
      throw new Error(`Error: Undefined - label: '${label}'`);
    }
    return this.minusLabels.get(labelKey);
  }

  /**
   * Handles `for` loops.
   * @param condition
   */
  public handleFor(condition: string[]): void {
      if (condition.length !== 3) throw new Error("FOR loop requires start, end, and variable name.");
      const [start, end, variable] = condition;
      const startVal = parseInt(start, 10);
      const endVal = parseInt(end, 10);
      if (isNaN(startVal) || isNaN(endVal)) throw new Error("Invalid FOR loop parameters.");

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
  }

  /**
   * Handles `endfor` statements.
   */
  public handleEndFor(): void {
      if (this.whileStatus.length === 0 || !this.whileStatus[this.whileStatus.length - 1].is_for) {
          throw new Error("Misplaced ENDFOR.");
      }
      const loop = this.whileStatus.pop();
      if (loop && loop.for_cur < loop.for_end) {
          loop.for_cur++;
          this.whileStatus.push(loop);
      }
  }

  /**
   * Handles `print` statements.
   * @param input
   */
  public handlePrint(input: string): string {
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
   * @param type
   * @param param
   */
  public formatPrintFunction(type: string, param: string): string {
    console.log("assembler formatPrintFunction", type, param)
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
    console.log("assembler handleIf", condition)
    const conditionStr = condition.join(" ");
    const conditionResult = this.evaluateExpression(conditionStr);

    this.numif++;
    if (conditionResult) this.numtrue++;
  }

  /**
   * Handles `elseif` statements.
   * @param condition
   */
  public handleElseIf(condition: string[]): void {
    console.log("assembler handleElseIf", condition)
    if (this.numif === 0) throw new Error("Misplaced elseif");
    if (this.whileStatus[this.numif - 1].iswhile) throw new Error("elseif_in_while");

    const conditionStr = condition.join(" ");
    const conditionResult = this.evaluateExpression(conditionStr);

    if (this.numif === this.numtrue) this.numtrue--;
    if (conditionResult && this.numtrue < this.numif) this.numtrue++;
  }

  /**
   * Handles `else` statements.
   */
  public handleElse(): void {
    if (this.numif === 0) throw new Error("Misplaced else");
    if (this.numif === this.numtrue) this.numtrue--;
  }

  /**
   * Handles `endif` statements.
   */
  public handleEndIf(): void {
    if (this.numif === 0) throw new Error("Misplaced endif");
    if (this.numif === this.numtrue) this.numtrue--;
    this.numif--;
  }

  /**
   * Handles `while` loops.
   * @param condition
   */
  public handleWhile(condition: string[]): void {
    const conditionStr = condition.join(" ");
    const conditionResult = this.evaluateExpression(conditionStr);

    this.numif++;
    if (conditionResult) {
      this.numtrue++;
      this.whileStatus.push({
        iswhile: true,
        startline: this.snespos,
        cond: conditionResult
      });
    }
  }

  /**
   * Handles `endwhile` statements.
   */
  public handleEndWhile(): void {
    console.log("assembler handleEndWhile");
    if (this.numif === 0) throw new Error("Misplaced endwhile");
    this.numif--;
    if (this.numif === this.numtrue) this.numtrue--;
    this.whileStatus.pop();
  }

  /**
   * Handles `org` directive to set SNES memory location.
   * @param params
   */
  public handleOrg(params: string[]): void {
    console.log("assembler handleOrg", params);
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
    console.log("assembler handleOrg addr", addr , hex(addr));
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
   * @param type
   * @param params
   */
  public handleDataDirective(type: string, params: string[]): void {
    console.log("assembler handleDataDirective", type, params);
    if (params.length === 0) {
      throw new Error(`${type.toUpperCase()} directive requires at least one parameter.`);
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
    console.log("assembler handleDataDirective values", values);

    for (let value of values) {
      if (value.startsWith('"')) {
        console.log("assembler handleDataDirective string literals", value);
        // Handle string literals
        const unquoted = value.slice(1, -1);
        console.log("assembler handleDataDirective string literal unquoted", unquoted);
        for (const char of unquoted) {
          const charValue = char.charCodeAt(0);
          this.writeDataByLength(len, charValue);
        }
      } else {
        console.log("assembler handleDataDirective numeric values", value);
        // Handle numeric values
        if (value.startsWith("#")) {
          console.warn("Warning: # before numbers in db/dw/... is deprecated. Remove the #.");
          value = value.substring(1);
        }
        const num = this.mathCore.math(value);
        console.log("assembler handleDataDirective num", num);
        if (Number.isNaN(num)) {
          console.error(`Unknown operator. [${type} ${params}]`);
        } else {
          this.writeDataByLength(len, num);
        }
      }
    }

    this.add_addr_to_line(this.realsnespos & 0xFFFFFF);
  }

  /**
   * Writes data of the specified length.
   * @param len
   * @param value
   */
  public writeDataByLength(len: number, value: number): void {
    console.log("assembler writeDataByLength", len, value);
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
   * Handles `macro` definitions.
   * @param params
   */
  public handleMacro(params: string[]): void {
    if (params.length !== 1) throw new Error("Macro declaration must have a name.");
    this.macros.startmacro(params[0]);
  }

  /**
   * Handles `endmacro` directive.
   */
  public handleEndMacro(): void {
    this.macros.endmacro(true);
  }

  /**
   * Pushes the current namespace.
   */
  public handlePushNamespace(): void {
    console.log("assembler handlePushNamespace")
    this.namespaceStack.push(this.currentNamespace);
  }

  /**
   * Restores the previous namespace.
   */
  public handlePullNamespace(): void {
    console.log("assembler handlePullNamespace");
    if (this.namespaceStack.length === 0) {
      throw new Error("pullns without pushns");
    }
    this.currentNamespace = this.namespaceStack.pop()!;
  }

  /**
   * Handles `namespace` definitions.
   * @param params
   */
  public handleNamespace(params: string[]): void {
    console.log("handleNamespace", params);
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

  public handleFreespace(type: string, params: string[]): void {
    console.log("assembler handleFreespace", type, params)
    if (params.length === 0) {
      throw new Error(`${type.toUpperCase()} requires a size parameter.`);
    }

    if (type === "freecode") {
      params.unshift("ram");
    } else if (type === "freedata") {
      params.unshift("noram");
    }

    let useram = -1;
    let fixedpos = false;
    let align = false;
    let leakwarn = true;
    let fsbyte = this.default_freespacebyte;

    console.log("assembler handleFreespace params", params);
    for (const param of params) {
      console.log("assembler handleFreespace param", param);
        switch (param.toLowerCase()) {
            case "ram":
                if (useram !== -1) throw new Error(`Invalid freespace request: ${param} while useram !== -1`);
                useram = 1;
                break;
            case "noram":
                if (useram !== -1) throw new Error(`Invalid freespace request: ${param} while useram !== -1`);
                useram = 0;
                break;
            case "static":
            case "fixed":
                if (fixedpos) throw new Error(`Invalid freespace request: ${param} while fixedpos`);
                fixedpos = true;
                break;
            case "align":
              if (align) throw new Error(`Invalid freespace request: ${param} while align`);
              align = true;
              break;
            case "cleaned":
              if (!leakwarn) throw new Error(`Invalid freespace request: ${param} while !leakwarn`);
              leakwarn = false;
              break;
            default:
              fsbyte = this.getnum(param);
        }
    }

    if (useram === -1) {
      throw new Error("Invalid freespace request: useram === -1");
    }
    if (this.mapper === "norom") {
      throw new Error("No freespace available in norom.");
    }

    const freespaceid = this.getFreespaceID();
    this.freespacebyte[freespaceid] = fsbyte;
    const isFreeCode = useram !== 0;

    if (this.pass === 0) {
      this.snespos = (freespaceid << 24) | 0x8000;
    } else if (this.pass === 1) {
      if (fixedpos && this.freespaceorgpos[freespaceid] < 0) {
          this.freespacepos[freespaceid] = 0x008000;
          this.freespaceleak[freespaceid] = false;
          throw new Error("Error: Static freespace location not specified.");
      }
      if (fixedpos && this.freespaceorgpos[freespaceid] > 0) {
          this.freespacepos[freespaceid] = this.snespos = (freespaceid << 24) | this.freespaceorgpos[freespaceid];
      } else {
          this.freespacepos[freespaceid] = this.snespos = (freespaceid << 24) | this.getsnesfreespace(
              this.freespacelen[freespaceid], isFreeCode, true, true, align, this.freespacebyte[freespaceid]
          );
      }
    } else if (this.pass === 2) {
      if (fixedpos && this.freespaceorgpos[freespaceid] === -1) return;
      this.snespos = (freespaceid << 24) | this.freespacepos[freespaceid];
      this.resizeRats(this.snespos & 0xFFFFFF, this.freespacelen[freespaceid]);
      if (this.freespaceleak[freespaceid] && leakwarn) {
        console.warn("Warning: Freespace leaked.");
      }
    }
  }

  public handleFreespaceByte(params: string[]): void {
    if (params.length !== 1) throw new Error("FREESPACEBYTE requires a single value.");
    this.default_freespacebyte = this.getnum(params[0]);
  }

  public handlePushPC(): void {
    if (this.pushpcnum >= 256) throw new Error("PushPC stack overflow.");

    this.pushpcStack.push({
        snespos: this.snespos,
        startpos: this.startpos,
        realsnespos: this.realsnespos,
        realstartpos: this.realstartpos,
    });

    this.pushpcnum++;
  }

  public handlePullPC(): void {
    if (this.pushpcnum === 0) throw new Error("PullPC without PushPC.");

    const state = this.pushpcStack.pop();
    this.snespos = state.snespos;
    this.startpos = state.startpos;
    this.realsnespos = state.realsnespos;
    this.realstartpos = state.realstartpos;

    this.pushpcnum--;
  }


  public handleAutoclean(params: string[]): void {
    if (params.length === 0) throw new Error("AUTOCLEAN requires a label.");

    const label = params[0];
    const num = this.getLabelValue(label);

    const targetID = num >> 24;
    if (this.pass === 1) {
        this.freespaceleak[targetID] = false;
    }

    this.write1(0x22); // JSL instruction
    this.write3(num);
  }


  /**
   * Evaluates an expression (stub function).
   * @param expression
   */
  public evaluateExpression(expression: string): boolean {
    // Placeholder: Implement expression parsing logic here
    return expression.length % 2 === 0; // Mock condition
  }

  /**
   * Checks for bank crossing issues.
   */
  public checkBankCrossing(): void {
    if ((this.snespos & 0x7FFF) + this.bytes > 0x8000) {
      throw new Error("Bank crossing error detected");
    }
  }

    /**
     * Converts a SNES address to a PC offset.
     * Returns -1 if the address is invalid.
     * @param addr
     */
  snestopc = (addr: number): number => {
    if (addr < 0 || addr > 0xFFFFFF) return -1; // not 24-bit

    if (this.mapper === "lorom") {
      // The low pages ($0000-$7FFF) of banks 70-7D are reserved for SRAM.
      if (
        (addr & 0xFE0000) === 0x7E0000 || // WRAM
        (addr & 0x408000) === 0x000000 || // hardware registers, RAM mirrors, etc.
        (addr & 0x708000) === 0x700000 // SRAM (low parts of banks 70-7D)
      )
        return -1;
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
   * @param addr
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
   * @param input
   */
  public resolvedefines(input: string): string {
    let result = "";
    let index = 0;

    while (index < input.length) {
        const char = input[index];

        if (char === '"' && this.emulatexkas) {
            console.warn("Warning: xkas define quotes are deprecated. Removing them generally does what you want.");
            result += char;
            index++;
            while (index < input.length && input[index] !== '"') {
                result += input[index++];
            }
            result += input[index++] || "";
        } else if (char === "\\" && input[index + 1] === "\\") {
            result += "\\";
            index += 2;
        } else if (char === "\\" && input[index + 1] === "!") {
            result += "!";
            index += 2;
        } else if (char === "!") {
            let defineName = "";
            const first = index === 0 || (index >= 4 && input[index - 1] === " " && input[index - 2] === ":" && input[index - 3] === " ");

            index++;
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
                index++;
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
                if (!this.defines.has(defineName)) throw new Error(`Error: Define '${defineName}' not found.`);
                const replacement = this.defines.get(defineName);
                result += this.resolvedefines(replacement);
            }
        } else {
            result += char;
            index++;
        }
    }

    return result;
  }

  /**
   * Validates whether a given define name is allowed.
   * @param name
   */
  public validatedefinename(name: string): boolean {
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
   * @param operand
   */
  public getnum(operand: string): number {
    return Number.parseInt(operand.replace(/[$%]/g, ""), 16);
  }

  /**
   * Sets the current pass of assembly.
   * @param pass
   */
  public setPass(pass: number): void {
    console.log("assembler setPass", pass);
    this.pass = pass;
  }

  /**
   * Completes the current pass, performing any necessary cleanup.
   */
  public finishPass(): void {
    // this.verifyWarnings();
    // if (this.pass === 0 && this.pushpcnum > 0) {
    //   throw new Error("Error: pushpc without pullpc.");
    // }
    // if (this.pass === 0 && this.pushnsnum > 0) {
    //   throw new Error("Error: pushns without pullns.");
    // }
  }

  /**
   * Sets the current file being processed.
   * @param filename
   */
  public setCurrentFile(filename: string): void {
    console.log("assembler setCurrentFile", filename);
    this.currentFile = filename;
    this.currentLine = 0;
  }

  /**
   * Sets the current line number.
   * @param line
   */
  public setCurrentLine(line: number): void {
    console.log("assembler setCurrentLine", line);
    this.currentLine = line;
  }

  /**
   * Returns a unique ID for freespace allocation.
   */
  public getFreespaceID(): number {
    console.log("assembler getFreespaceID");
    return this.nextFreespaceID++;
  }

  /**
   * Finds available SNES freespace for a given size.
   * @param size
   * @param isForCode
   * @param autoExpand
   * @param respectBankBorders
   * @param align
   * @param fsByte
   */
  public getsnesfreespace(size: number, isForCode: boolean, autoExpand: boolean, respectBankBorders: boolean, align: boolean, fsByte: number): number {
    console.log("assembler getsnesfreespace", { size, autoExpand, respectBankBorders, align, fsByte });
    if (size > 0x10000) return -1;

    size += 8; // Account for RATS tag

    if (this.mapper === "lorom") {
        if (size > 0x8008 && respectBankBorders) return -1;
        const pos = this.findFreespace(0x80000, Math.min(this.romlen, 0x200000), size, respectBankBorders, align, fsByte);
        if (pos >= 0) return pos;
        if (autoExpand) {
            return this.expandRomAndFindFreespace(size, fsByte);
        }
    }

    if (this.mapper === "hirom") {
        return this.findFreespace(0, this.romlen, size, respectBankBorders, align, fsByte);
    }

    return -1;
  }

  /**
   * Expands the ROM size and attempts to find new freespace.
   * @param size
   * @param fsByte
   */
  public expandRomAndFindFreespace(size: number, fsByte: number): number {
    console.log("assembler expandRomAndFindFreespace", { size, fsByte });
    if (this.romlen === 0x080000) {
        this.expandRom(0x100000, fsByte);
    } else if (this.romlen === 0x100000) {
        this.expandRom(0x200000, fsByte);
    } else if (this.romlen === 0x200000 || this.romlen === 0x300000) {
        this.expandRom(0x400000, fsByte);
    } else {
        return -1;
    }
    return this.findFreespace(0x80000, Math.min(this.romlen, 0x200000), size, true, true, fsByte);
  }

  /**
   * Expands ROM size and fills it with a specified byte.
   * @param newSize
   * @param fsByte
   */
  public expandRom(newSize: number, fsByte: number): void {
    console.log("assembler expandRom", { newSize, fsByte });
    this.writeDataBytes(this.romlen, fsByte, newSize - this.romlen);
    this.romlen = newSize;
  }

  /**
   * Writes a block of data to ROM.
   * @param start
   * @param value
   * @param length
   */
  public writeDataBytes(start: number, value: number, length: number): void {
    console.log("assembler writeDataBytes", { start, value, length });
    for (let i = 0; i < length; i++) {
        this.romdata[start + i] = value;
    }
  }

  /**
   * Finds an available freespace block in ROM.
   * @param start
   * @param end
   * @param size
   * @param respectBankBorders
   * @param align
   * @param fsByte
   */
  public findFreespace(start: number, end: number, size: number, respectBankBorders: boolean, align: boolean, fsByte: number): number {
    console.log("assembler findFreespace", { start, end, size, align, fsByte });
    while (start + size <= end) {
        if (this.isBlockEmpty(start, size, fsByte)) {
            return start;
        }
        start += align ? 8 : 1;
    }
    return -1;
  }

  /**
   * Checks if a given ROM region is empty.
   * @param start
   * @param size
   * @param fsByte
   */
  public isBlockEmpty(start: number, size: number, fsByte: number): boolean {
    console.log("assembler isBlockEmpty", { start, size, fsByte });
    for (let i = 0; i < size; i++) {
        if (this.romdata[start + i] !== fsByte) return false;
    }
    return true;
  }

  /**
   * Resizes a RATS tag in ROM.
   * @param snesaddr
   * @param newlen
   */
  public resizeRats(snesaddr: number, newlen: number): void {
    console.log("assembler resizeRats", snesaddr, newlen);
    const pos = this.snestopc(this.ratsstart(snesaddr));
    if (pos < 0) return;
    if (newlen !== 0) newlen--;

    this.write1At(pos + 4, newlen & 0xFF);
    this.write1At(pos + 5, (newlen >> 8) & 0xFF);
    this.write1At(pos + 6, (newlen & 0xFF) ^ 0xFF);
    this.write1At(pos + 7, ((newlen >> 8) & 0xFF) ^ 0xFF);
  }

  /**
   * Retrieves the label value from the assembler symbol table.
   * @param label
   */
  public getLabelValue(label: string): number {
    console.log("assembler getLabelValue", { label });
    if (!this.labelTable.has(label)) {
      throw new Error(`Error: Label '${label}' not found.`);
    }
    return this.labelTable.get(label);
  }

  /**
   * Returns the start of a RATS tag for a given SNES address.
   * @param snesaddr
   */
  public ratsstart(snesaddr: number): number {
    console.log("assembler ratsstart", snesaddr);
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
   * @param index
   */
  public isRatsTag(index: number): boolean {
    // console.log('assembler isRatsTag', index);
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
   * Writes a byte to a specific ROM position.
   * @param pos
   * @param value
   */
  public write1At(pos: number, value: number): void {
    console.log("assembler write1At", { pos, value });
    this.romdata[pos] = value;
  }
}
