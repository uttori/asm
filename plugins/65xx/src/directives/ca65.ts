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
 * Handles `.export ident[, ident…]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleExport(session: Assembler, words: readonly string[]): void {
  markGlobalSymbols(session, words, ".export");
}

/**
 * Handles `.import ident[, ident…]`.
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
 * Handles `.lobytes expr[, expr…]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleLobytes(session: Assembler, words: readonly string[]): void {
  emitMappedBytes(session, words, (value) => session.write1(value & 0xff), 1);
}

/**
 * Handles `.hibytes expr[, expr…]`.
 * @param {Assembler} session Host assembler session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 */
export function handleHibytes(session: Assembler, words: readonly string[]): void {
  emitMappedBytes(session, words, (value) => session.write1((value >> 8) & 0xff), 1);
}

/**
 * Handles `.dbyt expr[, expr…]` (16-bit big-endian).
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
