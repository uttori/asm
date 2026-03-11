import fs from "node:fs";
import path from "node:path";

import { Arch65816 } from "../../Arch65816.js";
import { MathCore } from "../../mathcore.js";
import { parseNum } from "./parseNum.js";

function readLittleEndian(bytes: Uint8Array, pos: number, width: number): number | undefined {
  if (pos < 0 || pos + width > bytes.length) return undefined;
  let v = 0;
  for (let i = 0; i < width; i++) v |= bytes[pos + i]! << (i * 8);
  return v >>> 0;
}

let debug: (...args: unknown[]) => void = () => {};
try {
  const { default: d } = await import("debug");
  debug = d("snes-asm:backend");
} catch { /* optional */ }

const DEFAULT_ROM_SIZE = 512 * 1024;
const LOROM_MASK = 0xffffff;

/**
 * Lorom: SNES addr to PC offset. Invalid addresses return -1.
 * @param addr
 */
function snestopcLorom(addr: number): number {
  addr = addr & LOROM_MASK;
  if (addr < 0 || addr > 0xffffff) return -1;
  if ((addr & 0xfe0000) === 0x7e0000) return -1;
  if ((addr & 0x408000) === 0x000000) return -1;
  if ((addr & 0x708000) === 0x700000) return -1;
  return ((addr & 0x7f0000) >> 1) | (addr & 0x7fff);
}

/**
 * Lorom: PC offset to SNES address.
 * @param pc
 */
function pctosnesLorom(pc: number): number {
  if (pc < 0 || pc >= 0x400000) return -1;
  const addr = (((pc << 1) & 0x7f0000) | (pc & 0x7fff)) | 0x8000;
  return addr | 0x800000;
}

/**
 * Hirom: SNES addr to PC offset. Invalid addresses return -1.
 */
function snestopcHirom(addr: number): number {
  addr = addr & LOROM_MASK;
  if (addr < 0 || addr > 0xffffff) return -1;
  if ((addr & 0xfe0000) === 0x7e0000) return -1;
  if ((addr & 0x408000) === 0x000000) return -1;
  return addr & 0x3fffff;
}

/**
 * Hirom: PC offset to SNES address.
 */
function pctosnesHirom(pc: number): number {
  if (pc < 0 || pc >= 0x400000) return -1;
  return pc | 0xc00000;
}

/**
 * Exlorom: SNES addr to PC offset. Invalid addresses return -1.
 */
function snestopcExlorom(addr: number): number {
  addr = addr & LOROM_MASK;
  if (addr < 0 || addr > 0xffffff) return -1;
  if ((addr & 0xf00000) === 0x700000) return -1;
  if ((addr & 0x408000) === 0x000000) return -1;
  if (addr & 0x800000) {
    return ((addr & 0x7f0000) >> 1) | (addr & 0x7fff);
  }
  return (((addr & 0x7f0000) >> 1) | (addr & 0x7fff)) + 0x400000;
}

/**
 * Exlorom: PC offset to SNES address.
 */
function pctosnesExlorom(pc: number): number {
  if (pc < 0 || pc >= 0x800000) return -1;
  if (pc & 0x400000) {
    let addr = pc - 0x400000;
    addr = (((addr << 1) & 0x7f0000) | (addr & 0x7fff)) | 0x8000;
    return addr;
  }
  let addr = (((pc << 1) & 0x7f0000) | (pc & 0x7fff)) | 0x8000;
  return addr | 0x800000;
}

/**
 * Exhirom: SNES addr to PC offset. Invalid addresses return -1.
 */
function snestopcExhirom(addr: number): number {
  const a = addr & LOROM_MASK;
  if (a < 0 || a > 0xffffff) return -1;
  if ((a & 0xfe0000) === 0x7e0000) return -1;
  if ((a & 0x408000) === 0x000000) return -1;
  if ((a & 0x800000) === 0) return (a & 0x3fffff) | 0x400000;
  return a & 0x3fffff;
}

/**
 * Exhirom: PC offset to SNES address.
 */
function pctosnesExhirom(pc: number): number {
  if (pc < 0 || pc >= 0x800000) return -1;
  if (pc & 0x400000) return pc;
  return pc | 0xc00000;
}

export interface ICompilationBackend {
  pass: number;
  currentFile: string;
  currentLine: number;
  snespos: number;
  setCurrentLine(line: number): void;
  setCurrentFile(file: string): void;
  setPass(pass: number): void;
  finishPass(): void;
  setLabel(label: string, value?: number): void;
  getLabelValue(label: string, _requireStatic?: boolean): number;
  handleOrg(params: string[]): void;
  handleBase?(params: string[]): void;
  handlePushpc?(): void;
  handlePullpc?(): void;
  handlePad?(params: string[]): void;
  handlePadbyte?(params: string[]): void;
  handleDataDirective(type: string, params: string[]): void;
  handleDefine?(command: string): void;
  /** Get define value by name (for !name invocation / string defines). */
  getDefineValue?(name: string): string | undefined;
  encodeInstruction?(words: string[]): boolean;
  /** Whether we are inside a taken branch (no if/else block is currently skipping). */
  shouldEmit?(): boolean;
  handleIf?(expr: string): void;
  handleElseif?(expr: string): void;
  handleElse?(): void;
  handleEndif?(): void;
  /** Set a define to a numeric value (e.g. for for-loop variable). */
  setDefineValue?(name: string, value: number): void;
  /** Evaluate expression to a number (for conditions). */
  evaluateExpression?(expr: string): number;
  /** Register a macro (name, param names, body lines). */
  registerMacro?(name: string, paramNames: string[], body: string[]): void;
  /** Get a macro by name. */
  getMacro?(name: string): { paramNames: string[]; body: string[] } | undefined;
  /** For compound sublabels: get/restore current parent around macro expansion. */
  getCurrentParentLabel?(): string;
  setCurrentParentLabel?(label: string): void;
  /** When expanding a macro: parent at call site, used for # (local) labels so they become e.g. Main_InMacro. */
  setMacroCallerParent?(parent: string | undefined): void;
  /** Struct definition (parser path). */
  startStruct?(name: string, parent?: string): void;
  recordStructMember?(memberName: string, skipAmount: number): void;
  endStruct?(): void;
  resolveStructMember?(compoundId: string): number;
  /** Switch CPU arch (65816/spc700/superfx). No-op if not implemented. */
  setArch?(name: string): void;
  /** Set ROM mapper (lorom, hirom, exlorom, exhirom) for snestopc/pctosnes. */
  setMapper?(name: string): void;
  handleUndef?(name: string): void;
  /** Set fill pattern (fillbyte/fillword/filllong/filldword) value. */
  handleFillPattern?(type: string, params: string[]): void;
  /** Emit N bytes using current fill pattern. */
  handleFill?(params: string[]): void;
  getBinaryOutput(): Uint8Array;
}

export class CompilationBackend implements ICompilationBackend {
  public pass: number = 0;
  public currentFile: string = "";
  public currentLine: number = 0;
  public snespos: number = 0x8000;
  public realsnespos: number = 0x8000;
  public startpos: number = 0x8000;
  public realstartpos: number = 0x8000;

  public mapper: string = "lorom";
  /** Search paths for resolving file references (getfilestatus, readfile1, etc.). */
  public includePaths: string[] = [];
  public romdata: number[] = [];
  private labelTable: Map<string, number> = new Map();
  private defines: Map<string, string> = new Map();
  private readonly targetRom: Uint8Array | undefined;
  private mathCore: MathCore;
  private arch65816: Arch65816;
  /** Stack of if-blocks: cond true => emit, branchTaken => we already took an if/elseif/else branch. */
  private condStack: { type: "if"; cond: boolean; branchTaken: boolean }[] = [];
  private pushpcStack: { snespos: number; realsnespos: number }[] = [];
  private padByte: number = 0x00;
  /** Fill pattern for fill directive (12 bytes, repeat). */
  private fillPattern: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  private macroMap: Map<string, { paramNames: string[]; body: string[] }> = new Map();
  /** Forward-reference labels "+" (next + after current line). */
  private forwardLabels: { sourceLine: number; addr: number }[] = [];
  /** Current parent label for compound sublabels (Parent_Sublabel). */
  private currentParentLabel: string = "";
  /** When inside macro expansion: parent at call site, for # labels -> Main_InMacro style. */
  private macroCallerParent: string = "";
  /** Struct definitions: name -> { size, labels: memberName -> offset, parent? }. */
  private structs: Map<string, { size: number; labels: Map<string, number>; parent?: string }> = new Map();
  /** While parsing a struct body. */
  private currentStruct: { name: string; offset: number; labels: Map<string, number>; parent?: string } | null = null;
  /** Highest PC written to (for trimming output when no targetRom, to match legacy). */
  private maxWrittenPc: number = -1;

  constructor(targetRom?: Uint8Array) {
    this.targetRom = targetRom;
    const size = targetRom && targetRom.length > 0
      ? Math.max(targetRom.length, DEFAULT_ROM_SIZE)
      : DEFAULT_ROM_SIZE;
    this.romdata = Array.from({ length: size }, (_, i) =>
      targetRom && i < targetRom.length ? targetRom[i] : 0x00
    );
    this.mathCore = new MathCore();
    const resolveReadablePath = (filename: string): string | undefined => {
      const unquoted = filename.replace(/^["']|["']$/g, "").trim();
      if (path.isAbsolute(unquoted)) return fs.existsSync(unquoted) ? unquoted : undefined;
      const dirs = [
        path.dirname(path.resolve(this.currentFile || ".")),
        process.cwd(),
        ...this.includePaths
      ];
      for (const dir of dirs) {
        const candidate = path.resolve(dir, unquoted);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      }
      return undefined;
    };
    this.mathCore.delegate = (operation: string, ...args: (string | number)[]): number | string => {
      if (operation === "resolveLabel") {
        const id = args[0] as string;
        if (id.includes(".") && this.structs.size > 0) {
          try {
            return this.resolveStructMember(id);
          } catch {
            // fall back to label (e.g. "file.ext" as a label)
          }
        }
        return this.getLabelValue(id, false);
      }
      if (operation === "pc") return this.snespos;
      if (operation === "realbase") return this.realsnespos;
      if (operation === "defined") return (this.defines.has(args[0] as string) || this.labelTable.has(args[0] as string)) ? 1 : 0;
      if (operation === "snestopc") return this.snestopc(args[0] as number);
      if (operation === "pctosnes") return this.pctosnes(args[0] as number);
      if (operation === "getfilestatus") {
        const resolved = resolveReadablePath(args[0] as string);
        if (!resolved) return 1;
        try {
          fs.accessSync(resolved, fs.constants.R_OK);
          return 0;
        } catch {
          return 2;
        }
      }
      if (operation === "filesize") {
        const resolved = resolveReadablePath(args[0] as string);
        if (!resolved) throw new Error(`Could not get filesize for '${args[0]}'`);
        return fs.statSync(resolved).size;
      }
      if (operation === "canreadfile1" || operation === "canreadfile2" || operation === "canreadfile3" || operation === "canreadfile4") {
        const width = parseInt(operation.slice(-1), 10);
        const filename = args[0] as string;
        const pos = Math.trunc(args[1] as number);
        const resolved = resolveReadablePath(filename);
        if (!resolved) return 0;
        const size = fs.statSync(resolved).size;
        return (Number.isInteger(pos) && pos >= 0 && pos + width <= size) ? 1 : 0;
      }
      if (operation === "readfile1" || operation === "readfile2" || operation === "readfile3" || operation === "readfile4") {
        const width = parseInt(operation.slice(-1), 10);
        const filename = args[0] as string;
        const pos = Math.trunc(args[1] as number);
        const defaultValue = args.length > 2 ? Number(args[2]) : undefined;
        const resolved = resolveReadablePath(filename);
        if (!resolved) {
          if (defaultValue !== undefined) return defaultValue;
          throw new Error(`Could not read file: ${filename}`);
        }
        const fileBytes = new Uint8Array(fs.readFileSync(resolved));
        const value = readLittleEndian(fileBytes, pos, width);
        if (value === undefined) {
          if (defaultValue !== undefined) return defaultValue;
          throw new Error(`${operation} out of bounds at ${pos}`);
        }
        return value;
      }
      throw new Error(`delegate ${operation} not implemented`);
    };
    // Arch65816 is typed to take Assembler; we duck-type (expandOperand, getnum, write1, write2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend provides minimal assembler API for Arch65816
    this.arch65816 = new Arch65816(this as any);
  }

  /**
   * Determine operand size in bytes from value.
   * @param value
   * @param forceTwoBytes
   */
  determineValueLength(value: string | number, forceTwoBytes?: boolean): number {
    if (forceTwoBytes) return 2;
    let hexString: string;
    if (typeof value === "number") hexString = value.toString(16).toUpperCase();
    else hexString = (value.startsWith("$") ? value.slice(1) : value).trim();
    if (hexString.length <= 2) return 1;
    if (hexString.length <= 4) return 2;
    return 3;
  }

  /**
   * Expand operand (defines, labels, math) and return length.
   * @param operand
   */
  expandOperand(operand: string): { expanded: string; length: number } {
    if (!operand.trim()) return { expanded: "", length: 2 };
    let expanded = this.resolvedefines(operand.trim());
    if (/^\++$/.test(expanded) || /^-+$/.test(expanded)) return { expanded, length: 2 };
    try {
      const value = this.getnum(expanded);
      const length = this.determineValueLength(value);
      const hexDigits = length * 2;
      expanded = "$" + (value >>> 0).toString(16).toUpperCase().padStart(hexDigits, "0");
      return { expanded, length };
    } catch {
      return { expanded, length: 2 };
    }
  }

  encodeInstruction(words: string[]): boolean {
    return this.arch65816.asblock_65816(words);
  }

  shouldEmit(): boolean {
    return this.condStack.every((e) => e.cond);
  }

  handleIf(expr: string): void {
    const val = this.getnum(expr.trim() || "0");
    const cond = val !== 0;
    this.condStack.push({ type: "if", cond, branchTaken: cond });
  }

  handleElseif(expr: string): void {
    const top = this.condStack[this.condStack.length - 1];
    if (!top || top.type !== "if") throw new Error("elseif without matching if");
    if (top.branchTaken) {
      top.cond = false;
      return;
    }
    const val = this.getnum(expr.trim() || "0");
    const cond = val !== 0;
    top.cond = cond;
    top.branchTaken = cond;
  }

  handleElse(): void {
    const top = this.condStack[this.condStack.length - 1];
    if (!top || top.type !== "if") throw new Error("else without matching if");
    if (top.branchTaken) {
      top.cond = false;
      return;
    }
    top.cond = true;
    top.branchTaken = true;
  }

  handleEndif(): void {
    const top = this.condStack.pop();
    if (!top || top.type !== "if") throw new Error("endif without matching if");
  }

  setDefineValue(name: string, value: number): void {
    this.defines.set(name, "$" + (value >>> 0).toString(16).toUpperCase());
    debug("setDefineValue %s = %d", name, value);
  }

  evaluateExpression(expr: string): number {
    const result = this.getnum(expr.trim() || "0");
    debug("evaluateExpression %s => %d", expr.trim(), result);
    return result;
  }

  /**
   * Resolve !define references in a string.
   * @param expr
   */
  resolvedefines(expr: string): string {
    let result = "";
    let i = 0;
    while (i < expr.length) {
      if (expr[i] === "!" && i + 1 < expr.length && /\w/.test(expr[i + 1])) {
        i++;
        let name = "";
        while (i < expr.length && /\w/.test(expr[i])) name += expr[i++];
        result += this.defines.get(name) ?? `!${name}`;
        continue;
      }
      result += expr[i++];
    }
    return result;
  }

  /**
   * Parse !name #= expr and set define to evaluated number.
   * @param command
   */
  handleDefineAssign(command: string): void {
    const line = command.slice(1).trim();
    const match = line.match(/^(\w+)\s*#=\s*(.*)$/);
    if (!match) throw new Error(`Invalid define assign: ${command}`);
    const name = match[1];
    const expr = (match[2] ?? "").trim();
    if (!name) throw new Error(`Invalid define assign: ${command}`);
    const num = this.getnum(expr);
    this.setDefineValue(name, num);
  }

  /**
   * Parse !name = value and set define.
   * @param command
   */
  handleDefine(command: string): void {
    const line = command.slice(1).trim();
    // Only treat as assign when the line starts with "name #=" (avoid matching #= inside quoted value)
    if (/^\w+\s*#=/.test(line)) {
      this.handleDefineAssign(command);
      return;
    }
    const match = line.match(/^(\w+)\s*=\s*(.*)$/);
    if (!match) throw new Error(`Invalid define: ${command}`);
    const [, name, value] = match;
    if (!name) throw new Error(`Invalid define: ${command}`);
    let val = (value ?? "").trim();
    // Quoted string: store inner text as-is (defines inside resolved when invoked)
    if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
      this.defines.set(name, val.slice(1, -1));
      return;
    }
    let prev = "";
    while (prev !== val) {
      prev = val;
      val = this.resolvedefines(val);
    }
    try {
      this.mathCore.str = val;
      const num = this.mathCore.math(val);
      if (!Number.isNaN(num)) val = "$" + num.toString(16).toUpperCase();
    } catch {
      // keep as string
    }
    this.defines.set(name, val);
  }

  getDefineValue(name: string): string | undefined {
    return this.defines.get(name);
  }

  /**
   * Evaluate expression to number (defines, literals, labels, math).
   * @param expr
   */
  getnum(expr: string): number {
    const resolved = this.resolvedefines(expr.trim());
    try {
      return parseNum(resolved);
    } catch {
      // not a literal
    }
    try {
      this.mathCore.str = resolved;
      return this.mathCore.math(resolved);
    } catch {
      return this.getLabelValue(resolved, false);
    }
  }

  setCurrentLine(line: number): void {
    this.currentLine = line;
  }

  setCurrentFile(file: string): void {
    this.currentFile = file;
  }

  setIncludePaths(paths: string[]): void {
    this.includePaths = paths;
  }

  setMapper(name: string): void {
    this.mapper = name.toLowerCase();
  }

  handleUndef(name: string): void {
    this.defines.delete(name.replace(/^["']|["']$/g, "").trim());
  }

  setPass(pass: number): void {
    this.pass = pass;
    // Keep forwardLabels across passes so "+" refs (e.g. in macros) resolve on pass 1+ after being defined on pass 0
    if (pass === 0) this.forwardLabels = [];
  }

  finishPass(): void {
    // No-op for minimal backend.
  }

  setLabel(label: string, value?: number): void {
    label = label.replace(/:$/, "").trim();
    const addr = value !== undefined ? value : (this.realsnespos & LOROM_MASK);
    if (label === "+") {
      this.forwardLabels.push({ sourceLine: this.currentLine, addr });
      return;
    }
    if (label === "-") {
      this.labelTable.set("-", addr);
      return;
    }
    // # (local) labels inside a macro: set CallerParent_LocalName and bare LocalName so "InMacro" / "Main_InMacroSub" resolve
    if (label.startsWith("#") && this.macroCallerParent) {
      const localPart = label.slice(1).trim();
      const subPart = localPart.replace(/^\./, "");
      const compoundKey = this.macroCallerParent + "_" + subPart;
      this.labelTable.set(compoundKey, addr);
      if (!localPart.startsWith(".")) this.labelTable.set(subPart, addr);
      return;
    }
    this.labelTable.set(label, addr);
    // Compound labels: sublabel (e.g. .MacroSub or ?.MacroSub) also sets Parent_Sublabel
    const isSublabel = label.startsWith(".") || (label.startsWith("?") && label.includes(".") && label.indexOf(".") === 1);
    if (isSublabel && this.currentParentLabel) {
      const subPart = label.replace(/^\.|^\?\./, "");
      const compoundKey = this.currentParentLabel + "_" + subPart;
      this.labelTable.set(compoundKey, addr);
      debug("setLabel compound %s + %s -> %s = %s", this.currentParentLabel, subPart, compoundKey, addr);
    } else if (!isSublabel) {
      this.currentParentLabel = label;
      debug("setLabel parentLabel=%s addr=%s", label, addr);
    }
  }

  getLabelValue(label: string, _requireStatic?: boolean): number {
    if (label === "+") {
      const next = this.forwardLabels.find((e) => e.sourceLine > this.currentLine);
      if (!next) {
        if (this.pass === 0) return 0;
        throw new Error("Label '+' not found (no forward '+' after current line).");
      }
      return next.addr;
    }
    if (label === "-") {
      const v = this.labelTable.get("-");
      if (v === undefined) throw new Error("Label '-' not found.");
      return v;
    }
    if (label.includes(".") && this.structs.size > 0) {
      try {
        return this.resolveStructMember(label);
      } catch (e) {
        debug("getLabelValue struct miss label=%s structs.size=%d err=%s", label, this.structs.size, (e as Error).message);
        // not a struct member path, try left-hand side of " == " (getnum fallback passes full expr)
        const eqIdx = label.indexOf(" == ");
        if (eqIdx > 0) {
          const leftPart = label.slice(0, eqIdx).trim();
          if (leftPart) {
            try {
              return this.resolveStructMember(leftPart);
            } catch {
              // fall through to label lookup
            }
          }
        }
        // resolve as normal label
      }
    }
    const v = this.labelTable.get(label);
    if (v === undefined) {
      debug("getLabelValue not found label=%s structs.size=%d", label, this.structs.size);
      throw new Error("Label '" + label + "' not found.");
    }
    return v;
  }

  getCurrentParentLabel(): string {
    return this.currentParentLabel;
  }

  setCurrentParentLabel(label: string): void {
    this.currentParentLabel = label;
  }

  setMacroCallerParent(parent: string | undefined): void {
    this.macroCallerParent = parent ?? "";
  }

  startStruct(name: string, parent?: string): void {
    if (this.currentStruct) throw new Error("Nested struct not supported: already in struct " + this.currentStruct.name);
    this.currentStruct = { name, offset: 0, labels: new Map(), parent };
  }

  recordStructMember(memberName: string, skipAmount: number): void {
    if (!this.currentStruct) throw new Error("recordStructMember called outside struct");
    this.currentStruct.labels.set(memberName, this.currentStruct.offset);
    this.currentStruct.offset += skipAmount;
  }

  endStruct(): void {
    if (!this.currentStruct) throw new Error("endstruct without matching struct");
    this.structs.set(this.currentStruct.name, {
      size: this.currentStruct.offset,
      labels: new Map(this.currentStruct.labels),
      parent: this.currentStruct.parent,
    });
    this.currentStruct = null;
  }

  /**
   * Resolves struct member path (e.g. TestStruct.count, TestStruct[0].count, TestStruct.NewStruct.new).
   * @param compoundId
   */
  resolveStructMember(compoundId: string): number {
    const firstId = compoundId.trim().match(/^([A-Z_a-z]\w*)/)?.[1];
    if (!firstId || !this.structs.has(firstId)) throw new Error("Struct not found: " + compoundId);
    let rest = compoundId.substring(firstId.length).trim();
    let base = 0;
    let currentStruct = this.structs.get(firstId);
    if (!currentStruct) throw new Error("Struct not found: " + compoundId);
    let currentStructName = firstId;
    while (rest.length > 0) {
      if (rest.startsWith(".")) {
        rest = rest.substring(1).trim();
        const memberMatch = rest.match(/^([A-Z_a-z]\w*)/);
        if (!memberMatch) throw new Error("Invalid struct member: " + compoundId);
        const memberName = memberMatch[1];
        rest = rest.substring(memberName.length).trim();
        const memberOffset = currentStruct.labels.get(memberName);
        if (memberOffset !== undefined) {
          return base + memberOffset;
        }
        const childStruct = this.structs.get(memberName);
        if (childStruct && childStruct.parent === currentStructName) {
          currentStruct = childStruct;
          currentStructName = memberName;
        } else {
          throw new Error("Struct member not found: " + currentStructName + "." + memberName);
        }
      } else if (rest.startsWith("[")) {
        const bracketEnd = rest.indexOf("]");
        if (bracketEnd === -1) throw new Error("Unclosed [ in struct ref: " + compoundId);
        const indexStr = rest.substring(1, bracketEnd).trim();
        const index = parseInt(indexStr, 10);
        if (isNaN(index) || index < 0) throw new Error("Invalid struct index: " + indexStr);
        rest = rest.substring(bracketEnd + 1).trim();
        base += index * currentStruct.size;
      } else {
        break;
      }
    }
    return base;
  }

  private snestopc(addr: number): number {
    if (this.mapper === "lorom") return snestopcLorom(addr);
    if (this.mapper === "hirom") return snestopcHirom(addr);
    if (this.mapper === "exlorom") return snestopcExlorom(addr);
    if (this.mapper === "exhirom") return snestopcExhirom(addr);
    return -1;
  }

  private pctosnes(pc: number): number {
    if (this.mapper === "lorom") return pctosnesLorom(pc);
    if (this.mapper === "hirom") return pctosnesHirom(pc);
    if (this.mapper === "exlorom") return pctosnesExlorom(pc);
    if (this.mapper === "exhirom") return pctosnesExhirom(pc);
    return -1;
  }

  private step(num: number): void {
    if (num <= 0) return;
    this.snespos = (this.snespos & 0xff000000) | ((this.snespos & LOROM_MASK) + num);
    this.realsnespos = (this.realsnespos & 0xff000000) | ((this.realsnespos & LOROM_MASK) + num);
    this.startpos = this.snespos;
    this.realstartpos = this.realsnespos;
  }

  private ensureRomSize(pc: number): void {
    if (pc > this.maxWrittenPc) this.maxWrittenPc = pc;
    if (pc >= this.romdata.length) {
      const add = Math.max(pc - this.romdata.length + 1, 1024);
      for (let i = 0; i < add; i++) this.romdata.push(0x00);
    }
  }

  write1(num: number): void {
    const pc = this.snestopc(this.realsnespos & LOROM_MASK);
    if (pc < 0) throw new Error("Invalid SNES position for write.");
    if (this.pass === 2) {
      this.ensureRomSize(pc);
      this.romdata[pc] = num & 0xff;
    }
    this.step(1);
  }

  write2(num: number): void {
    this.write1(num & 0xff);
    this.write1((num >> 8) & 0xff);
  }

  write3(num: number): void {
    this.write1(num & 0xff);
    this.write1((num >> 8) & 0xff);
    this.write1((num >> 16) & 0xff);
  }

  write4(num: number): void {
    this.write1(num & 0xff);
    this.write1((num >> 8) & 0xff);
    this.write1((num >> 16) & 0xff);
    this.write1((num >> 24) & 0xff);
  }

  writeDataByLength(len: number, value: number): void {
    switch (len) {
      case 1: this.write1(value); break;
      case 2: this.write2(value); break;
      case 3: this.write3(value); break;
      case 4: this.write4(value); break;
      default: throw new Error(`Unsupported data length ${len}`);
    }
  }

  handleOrg(params: string[]): void {
    if (params.length !== 1) throw new Error("ORG requires a single address parameter.");
    const addr = this.getnum(params[0]);
    const snes = addr & LOROM_MASK;
    this.snespos = snes;
    this.realsnespos = snes;
    this.startpos = snes;
    this.realstartpos = snes;
  }

  handleBase(params: string[]): void {
    if (params.length >= 1 && params[0].trim().toLowerCase() === "off") return;
    this.handleOrg(params);
  }

  handlePushpc(): void {
    this.pushpcStack.push({ snespos: this.snespos, realsnespos: this.realsnespos });
  }

  handlePullpc(): void {
    const entry = this.pushpcStack.pop();
    if (!entry) throw new Error("pullpc without matching pushpc");
    this.snespos = entry.snespos;
    this.realsnespos = entry.realsnespos;
    this.startpos = entry.snespos;
    this.realstartpos = entry.realsnespos;
  }

  handlePad(params: string[]): void {
    if (params.length < 1) throw new Error("PAD requires an address.");
    const targetSnes = this.getnum(params[0]) & LOROM_MASK;
    const targetPc = this.snestopc(targetSnes);
    const currentPc = this.snestopc(this.realsnespos & LOROM_MASK);
    if (targetPc < 0 || currentPc < 0) throw new Error("Invalid address for PAD.");
    if (this.pass === 2 && targetPc > currentPc) {
      const count = targetPc - currentPc;
      this.ensureRomSize(targetPc);
      for (let i = 0; i < count; i++) this.romdata[currentPc + i] = this.padByte;
    }
    this.snespos = targetSnes;
    this.realsnespos = targetSnes;
    this.startpos = targetSnes;
    this.realstartpos = targetSnes;
  }

  handlePadbyte(params: string[]): void {
    if (params.length !== 1) throw new Error("PADBYTE requires one byte value.");
    this.padByte = this.getnum(params[0]) & 0xff;
  }

  handleDataDirective(type: string, params: string[]): void {
    if (!Array.isArray(params) || params.length === 0) {
      throw new Error(`${type.toUpperCase()} directive requires at least one parameter.`);
    }
    if (this.pass === 0) return;

    const typeMap: Record<string, number> = {
      db: 1, dw: 2, dl: 3, dd: 4,
      "dc.b": 1, "dc.w": 2, "dc.l": 3
    };
    const len = typeMap[type.toLowerCase()];
    if (!len) throw new Error(`Invalid data directive: ${type}`);

    for (const value of params) {
      const v = value.trim();
      if (v.startsWith('"') || v.startsWith("'")) {
        const unquoted = v.slice(1, -1);
        for (let j = 0; j < unquoted.length; j++) {
          this.writeDataByLength(len, unquoted.charCodeAt(j) & 0xff);
        }
      } else {
        const num = this.getnum(v);
        this.writeDataByLength(len, num);
      }
    }
  }

  handleFillPattern(type: string, params: string[]): void {
    if (!params.length) throw new Error(`${type.toUpperCase()} requires a value.`);
    let len: number;
    switch (type.toLowerCase()) {
      case "fillbyte": len = 1; break;
      case "fillword": len = 2; break;
      case "filllong": len = 3; break;
      case "filldword": len = 4; break;
      default: throw new Error(`Unknown fill type: ${type}`);
    }
    const val = this.getnum(params[0].trim());
    for (let i = 0; i < 12; i += len) {
      let tmpVal = val;
      for (let j = 0; j < len; j++) {
        this.fillPattern[i + j] = tmpVal & 0xff;
        tmpVal >>>= 8;
      }
    }
  }

  handleFill(params: string[]): void {
    if (!params.length) throw new Error("FILL requires a count.");
    const count = this.getnum(params[0].trim());
    if (this.pass === 2) {
      for (let i = 0; i < count; i++) {
        this.write1(this.fillPattern[i % 12]);
      }
    }
  }

  setArch(_name: string): void {
    // No-op: backend only has 65816 encoder; arch spc700/superfx would need separate encoders.
  }

  registerMacro(name: string, paramNames: string[], body: string[]): void {
    this.macroMap.set(name, { paramNames, body });
  }

  getMacro(name: string): { paramNames: string[]; body: string[] } | undefined {
    return this.macroMap.get(name);
  }

  getBinaryOutput(): Uint8Array {
    // When no targetRom, trim to highest written PC + 1 so output matches legacy (which only grows on write).
    const size = (this.targetRom && this.targetRom.length > 0)
      ? this.romdata.length
      : (this.maxWrittenPc >= 0 ? this.maxWrittenPc + 1 : 0);
    return new Uint8Array(this.romdata.slice(0, size));
  }
}
