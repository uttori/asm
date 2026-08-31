/**
 * ca65 source-compatibility directives for the 65xx NES target.
 *
 * This is the Zelda-1 slice, not full ca65:
 * `.segment`, `.export`, `.import`, `.byte`/`.byt`, `.addr`/`.word`,
 * `.lobytes`, `.hibytes`, `.dbyt`.
 */

import type { Assembler } from "@uttori/asm-core";

import type { Ld65Segment } from "../linker-config.js";
import type { Nes65xxSessionState } from "../session-state.js";
import {
  ca65CpuNames,
  ca65CpuShorthands,
  resolve65xxCpuName,
  type Ca65SessionState,
} from "../ca65-profile.js";

/**
 * Strips one layer of matching quotes from a token.
 * @param {string} token Raw token, possibly quoted.
 * @returns {string} Unquoted token.
 */
function unquote(token: string): string {
  if (token.length >= 2) {
    const quote = token[0];
    if ((quote === '"' || quote === "'") && token.endsWith(quote)) {
      return token.slice(1, -1);
    }
  }
  return token;
}

/**
 * Splits remaining directive words on commas.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {string[]} Parameter expressions.
 */
function parameterList(words: readonly string[]): string[] {
  const joined = words.slice(1).join(" ");
  const parts: string[] = [];
  let current = "";
  let parenDepth = 0;
  let quote: string | undefined;
  for (const char of joined) {
    if (quote) {
      current += char;
      if (char === quote) quote = undefined;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") parenDepth++;
    else if (char === ")") parenDepth--;
    if (char === "," && parenDepth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = "";
      continue;
    }
    current += char;
  }
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts;
}

/**
 * Promotes a name to session-global and copies any already-defined file-local
 * value onto the unqualified key.
 * @param {Assembler} session Host assembler session.
 * @param {string} name Exported/imported identifier.
 * @returns {void}
 */
function markGlobalSymbol(session: Assembler, name: string): void {
  if (!name) return;
  const localKey = session.symbolScope.qualifySymbolName(name);
  session.globalSymbols.add(name);
  if (localKey !== name) {
    const existing = session.labelTable.get(localKey);
    if (existing) {
      session.symbolScope.setLabel(name, existing.value, existing.isStatic);
    }
  }
}

/**
 * Closes the active ld65 segment: records the next load cursor and emits
 * `__NAME_LOAD__` / `__NAME_RUN__` / `__NAME_SIZE__` / `__NAME_RUN_END__`.
 * @param {Assembler} session Host assembler session.
 * @param {Nes65xxSessionState} state Mutable NES session state.
 * @returns {void}
 */
export function closeActiveSegment(session: Assembler, state: Nes65xxSessionState): void {
  if (!state.currentSegment) return;
  const segment = state.linker.segments.get(state.currentSegment);
  if (!segment) {
    state.currentSegment = null;
    return;
  }
  const size = session.currentTargetBaseAddress - state.segmentLoadStart;
  state.memoryCursors[segment.load] = session.currentTargetBaseAddress;
  if (segment.define) {
    const loadName = `__${segment.name}_LOAD__`;
    const runName = `__${segment.name}_RUN__`;
    const sizeName = `__${segment.name}_SIZE__`;
    const runEndName = `__${segment.name}_RUN_END__`;
    session.globalSymbols.add(loadName);
    session.globalSymbols.add(runName);
    session.globalSymbols.add(sizeName);
    session.globalSymbols.add(runEndName);
    session.symbolScope.setLabel(loadName, state.segmentLoadStart, true);
    session.symbolScope.setLabel(runName, state.segmentRunStart, true);
    session.symbolScope.setLabel(sizeName, size, true);
    session.symbolScope.setLabel(runEndName, state.segmentRunStart + size, true);
  }
  state.currentSegment = null;
  state.currentLoadMemory = null;
}

/**
 * Evaluates SYMBOLS block expressions after the last segment closes.
 * @param {Assembler} session Host assembler session.
 * @param {Nes65xxSessionState} state Mutable NES session state.
 * @returns {void}
 */
export function applyLinkerSymbols(session: Assembler, state: Nes65xxSessionState): void {
  for (const symbol of state.linker.symbols) {
    session.globalSymbols.add(symbol.name);
    const value = session.operandResolver.getnum(symbol.valueExpr);
    session.symbolScope.setLabel(symbol.name, value, true);
  }
}

/**
 * Opens an ld65 segment: `org` to the load address, `base` to the run address
 * when they differ (overlay copy-to-RAM).
 * @param {Assembler} session Host assembler session.
 * @param {Nes65xxSessionState} state Mutable NES session state.
 * @param {Ld65Segment} segment Segment to activate.
 * @returns {void}
 */
function openSegment(session: Assembler, state: Nes65xxSessionState, segment: Ld65Segment): void {
  const loadMemory = state.linker.memories.get(segment.load);
  const runMemory = state.linker.memories.get(segment.run);
  if (!loadMemory || !runMemory) {
    throw new Error(`.segment "${segment.name}" references unknown MEMORY.`);
  }
  const loadStart = segment.start ?? state.memoryCursors[segment.load] ?? loadMemory.start;
  session.setWritePosition(loadStart);
  const runStart = segment.run === segment.load ? loadStart : runMemory.start;
  if (runStart !== loadStart) {
    session.currentTargetAddress = runStart;
    session.currentTargetStartAddress = runStart;
  }
  state.currentSegment = segment.name;
  state.currentLoadMemory = segment.load;
  state.segmentLoadStart = loadStart;
  state.segmentRunStart = runStart;
}

/**
 * Handles `.segment "NAME"`.
 * @param {Assembler} session Host assembler session.
 * @param {Nes65xxSessionState} state Mutable NES session state.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleSegment(
  session: Assembler,
  state: Nes65xxSessionState,
  words: readonly string[],
): void {
  const name = unquote(words[1] ?? "").trim();
  if (!name) {
    throw new Error(".segment requires a segment name.");
  }
  const segment = state.linker.segments.get(name);
  if (!segment) {
    throw new Error(`.segment "${name}" is not defined in the linker configuration.`);
  }
  closeActiveSegment(session, state);
  openSegment(session, state, segment);
}

function markGlobalSymbols(session: Assembler, words: readonly string[], keyword: string): void {
  const names = parameterList(words)
    .map((entry) => unquote(entry).trim())
    .filter(Boolean);
  if (names.length === 0) {
    throw new Error(`${keyword} requires at least one identifier.`);
  }
  for (const name of names) {
    markGlobalSymbol(session, name);
  }
}

/**
 * Handles `.export ident[, ident...]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleExport(session: Assembler, words: readonly string[]): void {
  markGlobalSymbols(session, words, ".export");
}

/**
 * Handles `.import ident[, ident...]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleImport(session: Assembler, words: readonly string[]): void {
  markGlobalSymbols(session, words, ".import");
}

/**
 * Handles `.byte` / `.byt`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleByte(session: Assembler, words: readonly string[]): void {
  session.directiveRuntime.handleDataDirective("db", [...words.slice(1)]);
}

/**
 * Handles `.addr` / `.word` (16-bit little-endian).
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleAddr(session: Assembler, words: readonly string[]): void {
  session.directiveRuntime.handleDataDirective("dw", [...words.slice(1)]);
}

/**
 * Emits one transformed byte per expression, or estimates during collection.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @param {(value: number) => void} write Called once per evaluated value.
 * @param {number} width Bytes consumed per value when estimating.
 * @returns {void}
 */
function emitMappedBytes(
  session: Assembler,
  words: readonly string[],
  write: (value: number) => void,
  width: number,
): void {
  const params = parameterList(words);
  if (params.length === 0) {
    throw new Error(`${words[0]} requires at least one parameter.`);
  }
  if (session.isDefinitionCollectionStage) {
    session.step(params.length * width);
    return;
  }
  for (const param of params) {
    write(session.operandResolver.getnum(param));
  }
}

/**
 * Handles `.lobytes expr[, expr...]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleLobytes(session: Assembler, words: readonly string[]): void {
  emitMappedBytes(session, words, (value) => session.write1(value & 0xff), 1);
}

/**
 * Handles `.hibytes expr[, expr...]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleHibytes(session: Assembler, words: readonly string[]): void {
  emitMappedBytes(session, words, (value) => session.write1((value >> 8) & 0xff), 1);
}

/**
 * Handles `.dbyt expr[, expr...]` (16-bit big-endian).
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleDbyt(session: Assembler, words: readonly string[]): void {
  emitMappedBytes(
    session,
    words,
    (value) => {
      session.write1((value >> 8) & 0xff);
      session.write1(value & 0xff);
    },
    2,
  );
}

/**
 * Handles `.dword` / `.faraddr` (32-bit or 24-bit little-endian).
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @param {3 | 4} width Emitted value width.
 */
export function handleDword(session: Assembler, words: readonly string[], width: 3 | 4 = 4): void {
  session.directiveRuntime.handleDataDirective(width === 3 ? "dl" : "dd", [...words.slice(1)]);
}

/**
 * Selects one of the 65xx-owned ca65 CPUs.
 * @param {Assembler} session Host assembler session.
 * @param {Ca65SessionState} state ca65 session state.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export function handleSetcpu(
  session: Assembler,
  state: Ca65SessionState,
  words: readonly string[],
): void {
  const name = unquote(words.slice(1).join(" ").trim());
  if (!name) throw new Error(".setcpu requires a CPU name argument.");
  const architecture = resolve65xxCpuName(name);
  if (!architecture) {
    throw new Error(
      `.setcpu "${name}" is not a supported 65xx CPU. Supported names: ${Object.keys(ca65CpuNames).join(", ")}.`,
    );
  }
  session.selectArchitecture(architecture, name.toLowerCase());
  state.currentArchitecture = architecture;
}

/**
 * Saves the current CPU for `.popcpu`.
 * @param {Assembler} session Host assembler session.
 * @param {Ca65SessionState} state ca65 session state.
 */
export function handlePushcpu(session: Assembler, state: Ca65SessionState): void {
  state.cpuStack.push(session.resolveActiveArchitecture().name);
}

/**
 * Restores the most recently pushed CPU.
 * @param {Assembler} session Host assembler session.
 * @param {Ca65SessionState} state ca65 session state.
 */
export function handlePopcpu(session: Assembler, state: Ca65SessionState): void {
  const architecture = state.cpuStack.pop();
  if (!architecture) throw new Error(".popcpu: CPU stack is empty.");
  session.selectArchitecture(architecture, architecture);
  state.currentArchitecture = architecture;
}

/**
 * Handles `.p02`, `.p6280`, and the other ca65 CPU shorthand directives.
 * @param {Assembler} session Host assembler session.
 * @param {Ca65SessionState} state ca65 session state.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export function handleCpuShorthand(
  session: Assembler,
  state: Ca65SessionState,
  words: readonly string[],
): void {
  const keyword = (words[0] ?? "").replace(/^\./, "").toLowerCase();
  const cpu = ca65CpuShorthands[keyword];
  if (!cpu) throw new Error(`Unknown ca65 CPU shorthand '.${keyword}'.`);
  handleSetcpu(session, state, ["setcpu", cpu]);
}

/**
 * Emits `.res count[, fill]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export function handleRes(session: Assembler, words: readonly string[]): void {
  const params = parameterList(words);
  if (params.length < 1 || params.length > 2) {
    throw new Error(".res expects count and an optional fill value.");
  }
  const count = session.operandResolver.getnum(params[0] ?? "");
  const fill = params[1] ? session.operandResolver.getnum(params[1]) : 0;
  if (!Number.isInteger(count) || count < 0) throw new Error(".res count must be non-negative.");
  if (session.isDefinitionCollectionStage) {
    session.step(count);
    return;
  }
  for (let index = 0; index < count; index++) session.write1(fill & 0xff);
}

/**
 * Pads to the next `.align boundary[, fill]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export function handleAlign(session: Assembler, words: readonly string[]): void {
  const params = parameterList(words);
  if (params.length < 1 || params.length > 2) {
    throw new Error(".align expects a boundary and optional fill value.");
  }
  const boundary = session.operandResolver.getnum(params[0] ?? "");
  const fill = params[1] ? session.operandResolver.getnum(params[1]) : 0;
  if (!Number.isInteger(boundary) || boundary <= 0) {
    throw new Error(".align boundary must be a positive integer.");
  }
  const count = (boundary - (session.currentTargetAddress % boundary)) % boundary;
  if (session.isDefinitionCollectionStage) {
    session.step(count);
    return;
  }
  for (let index = 0; index < count; index++) session.write1(fill & 0xff);
}

/**
 * Includes `.incbin "file"[, offset[, size]]` using ca65's offset/length convention.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export function handleCa65Incbin(session: Assembler, words: readonly string[]): void {
  const params = parameterList(words);
  if (params.length < 1 || params.length > 3) {
    throw new Error(".incbin expects a filename, optional offset, and optional size.");
  }
  const filename = unquote(params[0] ?? "");
  const data = session.includeSource.readFile(filename);
  if (!(data instanceof Uint8Array)) throw new Error(`Failed to read binary include: ${filename}`);
  const offset = params[1] ? session.operandResolver.getnum(params[1]) : 0;
  const size = params[2] ? session.operandResolver.getnum(params[2]) : data.length - offset;
  if (
    !Number.isInteger(offset) ||
    !Number.isInteger(size) ||
    offset < 0 ||
    size < 0 ||
    offset + size > data.length
  ) {
    throw new Error(
      `.incbin range ${offset}+${size} is outside '${filename}' (${data.length} bytes).`,
    );
  }
  if (session.isDefinitionCollectionStage) {
    session.step(size);
    return;
  }
  for (const byte of data.subarray(offset, offset + size)) session.write1(byte);
}

/**
 * Implements the flat-image subset of ca65 `.assert`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export function handleCa65Assert(session: Assembler, words: readonly string[]): void {
  const params = parameterList(words);
  if (params.length === 0) throw new Error(".assert requires an expression.");
  if (session.operandResolver.getnum(params[0] ?? "") !== 0) return;
  const message = params.find((part) => /^["']/.test(part));
  throw new Error(message ? unquote(message) : ".assert expression evaluated to false.");
}

/**
 * Enters a ca65 `.scope` or `.proc` using the core namespace mechanism.
 * @param {Assembler} session Host assembler session.
 * @param {Ca65SessionState} state ca65 session state.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @param {boolean} procedure Whether the scope declares a procedure label.
 */
export function handleScope(
  session: Assembler,
  state: Ca65SessionState,
  words: readonly string[],
  procedure: boolean,
): void {
  const name = words[1]?.trim() || `__anonymous_scope_${session.currentLine}`;
  if (procedure) {
    session.symbolScope.setLabel(session.symbolScope.qualifySymbolName(name));
  }
  state.scopeStack.push(session.currentNamespace);
  session.currentNamespace = session.currentNamespace
    ? `${session.currentNamespace}_${name}`
    : name;
}

/**
 * Leaves the most recent ca65 `.scope` or `.proc`.
 * @param {Assembler} session Host assembler session.
 * @param {Ca65SessionState} state ca65 session state.
 */
export function handleEndScope(session: Assembler, state: Ca65SessionState): void {
  const previous = state.scopeStack.pop();
  if (previous === undefined) throw new Error("ca65 scope stack is empty.");
  session.currentNamespace = previous;
}

/**
 * Records flat-image `.segment` intent without pretending to create an object segment.
 * @param {Ca65SessionState} state ca65 session state.
 * @param {readonly string[]} words Tokenized line, keyword first.
 */
export function handleFlatSegment(state: Ca65SessionState, words: readonly string[]): void {
  const name = unquote(words[1] ?? "").trim();
  if (!name) throw new Error(".segment requires a segment name.");
  state.currentFlatSegment = name;
}

/** @param {Ca65SessionState} state ca65 session state. */
export function handlePushseg(state: Ca65SessionState): void {
  state.segmentStack.push(state.currentFlatSegment);
}

/** @param {Ca65SessionState} state ca65 session state. */
export function handlePopseg(state: Ca65SessionState): void {
  const segment = state.segmentStack.pop();
  if (segment === undefined) throw new Error(".popseg: segment stack is empty.");
  state.currentFlatSegment = segment;
}

/**
 * Rejects directives that require ca65 object/linker semantics.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {never} This handler always throws.
 */
export function handleUnsupportedCa65(words: readonly string[]): never {
  const keyword = words[0] ?? "<unknown>";
  throw new Error(
    `.${keyword.replace(/^\./, "")} requires relocatable ca65 object/linker semantics, which the flat-image compatibility profile does not implement.`,
  );
}
