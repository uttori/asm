import type { ICompilationBackend } from "../compiler/backend/CompilationBackend.js";
import { toCompilerDiagnostic, type CompilerDiagnostic } from "../compiler/diagnostics/Diagnostic.js";
import type { ParsedCommand } from "./ir.js";
import { findMatchingCloseParen, parseTokenizedCommands, splitArguments } from "./parser.js";
import { tokenizeSource } from "./tokenizer.js";

let debug: (...args: unknown[]) => void = () => {};
try {
  const { default: d } = await import("debug");
  debug = d("snes-asm:execute-ir");
} catch { /* optional */ }

const DATA_DIRECTIVES = new Set(["db", "dw", "dl", "dd", "dc.b", "dc.w", "dc.l"]);
const CONTROL_FLOW_DIRECTIVES = new Set(["if", "elseif", "else", "endif", "while", "endwhile", "for", "endfor"]);
const SIMPLE_LABEL_PATTERN = /^[A-Z_a-z]\w*$/;

/**
 *
 * @param commands
 * @param startIndex
 * @param openName
 * @param closeName
 */
function findMatchingEnd(commands: ParsedCommand[], startIndex: number, openName: string, closeName: string): number {
  return findMatchingEndWithAlternates(commands, startIndex, openName, [closeName]);
}

/** Asar allows while to be closed by endif; accept multiple close names. */
function findMatchingEndWithAlternates(commands: ParsedCommand[], startIndex: number, openName: string, closeNames: string[]): number {
  const closeSet = new Set(closeNames.map((n) => n.toLowerCase()));
  let depth = 1;
  for (let i = startIndex + 1; i < commands.length; i++) {
    const c = commands[i];
    if (c.kind === "directive") {
      const d = c.directive.toLowerCase();
      if (d === openName) depth++;
      else if (closeSet.has(d)) {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  throw new Error(`${openName} without matching ${closeNames.join("/")}`);
}

export interface ExecuteParsedCommandOptions {
  onDiagnostic?: (diagnostic: CompilerDiagnostic) => void;
  nativeSemanticSlices?: boolean;
}

/**
 *
 * @param backend
 * @param command
 * @param options
 */
function executeOne(
  backend: ICompilationBackend,
  command: ParsedCommand,
  options: ExecuteParsedCommandOptions
): void {
  const isIfDirective = command.kind === "directive" && ["if", "elseif", "else", "endif"].includes(command.directive.toLowerCase());
  if (!isIfDirective && typeof backend.shouldEmit === "function" && !backend.shouldEmit()) {
    return;
  }
  backend.setCurrentLine(command.sourceLine);

  try {
    switch (command.kind) {
      case "directive": {
        const d = command.directive.toLowerCase();
        const args = command.arguments;
        const argsRaw = command.argumentsRaw.trim();
        if (d === "if" && typeof backend.handleIf === "function") {
          debug("handleIf expr=%s", argsRaw);
          backend.handleIf(argsRaw);
          return;
        }
        if (d === "elseif" && typeof backend.handleElseif === "function") {
          backend.handleElseif(argsRaw);
          return;
        }
        if (d === "else" && typeof backend.handleElse === "function") {
          backend.handleElse();
          return;
        }
        if (d === "endif" && typeof backend.handleEndif === "function") {
          backend.handleEndif();
          return;
        }
        if (d === "org") {
          backend.handleOrg(args);
          return;
        }
        if (d === "base" && typeof backend.handleBase === "function") {
          backend.handleBase(args);
          return;
        }
        if (d === "pushpc" && typeof backend.handlePushpc === "function") {
          backend.handlePushpc();
          return;
        }
        if (d === "pullpc" && typeof backend.handlePullpc === "function") {
          backend.handlePullpc();
          return;
        }
        if (d === "pad" && typeof backend.handlePad === "function") {
          backend.handlePad(args);
          return;
        }
        if (d === "padbyte" && typeof backend.handlePadbyte === "function") {
          backend.handlePadbyte(args);
          return;
        }
        if (DATA_DIRECTIVES.has(d)) {
          backend.handleDataDirective(command.directive, args.length ? args : [argsRaw]);
          return;
        }
        if (d === "endwhile" || d === "endfor") {
          // Top-level while/for are handled in executeParsedCommands and skip past endwhile/endfor.
          // We only reach here if endwhile appears without a matching while (e.g. stray endwhile).
          throw new Error(`${d} without matching ${d === "endwhile" ? "while" : "for"}`);
        }
        if (d === "lorom" || d === "hirom" || d === "norom" || d === "exlorom" || d === "exhirom") {
          if (typeof backend.setMapper === "function") backend.setMapper(d);
          return;
        }
        if (d === "undef") {
          const name = (args[0] ?? argsRaw).trim().replace(/^["']|["']$/g, "");
          if (typeof backend.handleUndef === "function") backend.handleUndef(name);
          return;
        }
        if (d === "pushbase" || d === "pullbase") {
          return;
        }
        if (d === "pushtable" || d === "pulltable") {
          return;
        }
        if (d === "arch") {
          if (typeof backend.setArch === "function") {
            backend.setArch((args[0] ?? argsRaw).trim().toLowerCase());
          }
          return;
        }
        if (d === "asar") {
          return;
        }
        if (d === "function" || d === "endfunction") {
          return;
        }
        const FILL_DIRECTIVES = new Set(["fillbyte", "fillword", "filllong", "filldword"]);
        if (FILL_DIRECTIVES.has(d) && typeof backend.handleFillPattern === "function") {
          const fillArgs = argsRaw.split(/\s*:\s*/).map((s) => s.trim());
          const valuePart = fillArgs[0] ?? "";
          backend.handleFillPattern(d, valuePart ? [valuePart] : []);
          if (fillArgs[1]?.toLowerCase().startsWith("fill ")) {
            const countStr = fillArgs[1].slice(5).trim();
            if (typeof backend.handleFill === "function" && countStr) {
              backend.handleFill([countStr]);
            }
          }
          return;
        }
        if (d === "fill" && typeof backend.handleFill === "function") {
          backend.handleFill(args.length ? args : [argsRaw]);
          return;
        }
        if (!CONTROL_FLOW_DIRECTIVES.has(d)) {
          throw new Error(`Not implemented: directive ${command.directive}`);
        }
        return;
      }
      case "label":
        if (command.labelName === "-" || command.labelName === "+" || SIMPLE_LABEL_PATTERN.test(command.labelName) || /^[#?]/.test(command.labelName) || /^\.\w+$/.test(command.labelName)) {
          backend.setLabel(command.labelName);
          return;
        }
        throw new Error(`Not implemented: label "${command.labelName}"`);
      case "instruction": {
        const operandStr = command.operand?.trimStart() ?? "";
        if (operandStr.startsWith("=") && typeof backend.evaluateExpression === "function") {
          const expr = operandStr.slice(1).trim();
          const value = backend.evaluateExpression(expr);
          backend.setLabel(command.mnemonic, value);
          return;
        }
        const words = command.raw.trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) return;
        // !name invocation: expand string define and execute as code
        if (words[0].startsWith("!") && typeof backend.getDefineValue === "function") {
          const name = words[0].slice(1);
          const value = backend.getDefineValue(name);
          if (value != null) {
            const tokenized = tokenizeSource(value);
            const parsed = parseTokenizedCommands(tokenized);
            executeParsedCommands(backend, parsed, options);
            return;
          }
        }
        if (typeof backend.encodeInstruction !== "function") {
          throw new Error(`Not implemented: instruction "${command.raw}"`);
        }
        if (!backend.encodeInstruction(words)) {
          throw new Error(`Unknown instruction: ${words[0]}`);
        }
        return;
      }
      case "macro-call": {
        const savedParent = typeof backend.getCurrentParentLabel === "function" ? backend.getCurrentParentLabel() : "";
        debug("macro-call %s savedParent=%s", command.macroName, savedParent);
        try {
          if (typeof backend.getMacro !== "function") {
            throw new Error(`Not implemented: macro-call "${command.raw}"`);
          }
          const macro = backend.getMacro(command.macroName);
          if (!macro) {
            throw new Error(`Unknown macro: ${command.macroName}`);
          }
          const args: string[] = "arguments" in command && Array.isArray(command.arguments) ? command.arguments : [];
          const expandedLines = macro.body.map((line) => {
            let out = line;
            for (let i = 0; i < macro.paramNames.length; i++) {
              const paramName = macro.paramNames[i];
              const value = (args[i] ?? "").trim();
              const tag = `<${paramName}>`;
              out = out.split(tag).join(value);
            }
            return out;
          });
          const expandedSource = expandedLines.join("\n");
          debug("macro expanded first 3 lines: %s", expandedLines.slice(0, 3).join(" | "));
          if (typeof backend.setMacroCallerParent === "function") {
            backend.setMacroCallerParent(savedParent);
          }
          const tokenized = tokenizeSource(expandedSource);
          const parsed = parseTokenizedCommands(tokenized);
          executeParsedCommands(backend, parsed, options);
        } finally {
          if (typeof backend.setMacroCallerParent === "function") {
            backend.setMacroCallerParent(undefined);
          }
          if (typeof backend.setCurrentParentLabel === "function") {
            backend.setCurrentParentLabel(savedParent);
          }
          debug("macro-call done restored parent=%s", savedParent);
        }
        return;
      }
      case "fallback": {
        const raw = command.raw.trim();
        if (raw.startsWith("!") && (raw.includes("=") || raw.includes("#=")) && typeof backend.handleDefine === "function") {
          backend.handleDefine(command.raw);
          return;
        }
        throw new Error(`Not implemented: ${command.reason} "${command.raw}"`);
      }
    }
  } catch (error: unknown) {
    if (options.onDiagnostic) {
      options.onDiagnostic(toCompilerDiagnostic(error, {
        code: "PARSER_EXECUTION_ERROR",
        severity: "error",
        file: backend.currentFile,
        line: command.sourceLine,
        pass: backend.pass,
        rawCommand: command.raw
      }));
    }
    throw error;
  }
}

/**
 * Run only struct and macro definitions so structs and macros are available before any
 * other commands (e.g. if TestStruct.count) run. Called once at start of executeParsedCommands.
 */
function runStructAndMacroDefinitionsOnly(
  backend: ICompilationBackend,
  parsedCommands: ParsedCommand[]
): void {
  for (let i = 0; i < parsedCommands.length; i++) {
    const command = parsedCommands[i];
    if (!command) continue;
    const rawTrim = command.raw.trim();
    const rawLower = rawTrim.toLowerCase();
    const isStructBlock =
      (command.kind === "directive" && command.directive.trim().toLowerCase() === "struct") ||
      (rawLower.startsWith("struct") && command.kind !== "label");
    if (isStructBlock && typeof backend.startStruct === "function") {
      const endIdx = findMatchingEnd(parsedCommands, i, "struct", "endstruct");
      const argsRaw = (command.kind === "directive" ? command.argumentsRaw : rawTrim.replace(/^struct\s*/i, "")).trim();
      const words = argsRaw.split(/\s+/).map((w) => w.trim()).filter(Boolean);
      const structName = (command.kind === "directive" && command.arguments?.[0]?.trim()) || words[0] || "";
      let parent: string | undefined;
      if (words[1]?.toLowerCase() === "extends" && words[2]) parent = words[2];
      if (structName) {
        backend.startStruct(structName, parent);
        const structMemberSkipRe = /\s*\.(\w+):\s*skip\s+(\d+)/i;
        for (let j = i + 1; j < endIdx; j++) {
          const bodyCmd = parsedCommands[j];
          if (!bodyCmd || (bodyCmd.kind === "directive" && bodyCmd.directive.toLowerCase() === "endstruct")) continue;
          let memberName: string | null = null;
          let skipAmount = 0;
          const skipMatchRaw = bodyCmd.raw.match(structMemberSkipRe);
          if (skipMatchRaw) {
            memberName = skipMatchRaw[1];
            skipAmount = parseInt(skipMatchRaw[2], 10);
          } else if (bodyCmd.kind === "directive" && bodyCmd.directive.startsWith(".") && bodyCmd.directive.endsWith(":")) {
            memberName = bodyCmd.directive.replace(/:$/, "").replace(/^\./, "");
            const skipMatch = bodyCmd.argumentsRaw.match(/skip\s+(\d+)/i);
            skipAmount = skipMatch ? parseInt(skipMatch[1], 10) : 0;
          } else if (bodyCmd.kind === "label" && bodyCmd.labelName.startsWith(".")) {
            memberName = bodyCmd.labelName.replace(/^\./, "");
            const skipMatch = bodyCmd.raw.match(/skip\s+(\d+)/i);
            skipAmount = skipMatch ? parseInt(skipMatch[1], 10) : 0;
          }
          if (memberName !== null && typeof backend.recordStructMember === "function") {
            backend.recordStructMember(memberName, skipAmount);
          }
        }
        if (typeof backend.endStruct === "function") backend.endStruct();
      }
      i = endIdx;
      continue;
    }
    if (command.kind === "directive" && command.directive.toLowerCase() === "macro" && typeof backend.registerMacro === "function") {
      const endIdx = findMatchingEnd(parsedCommands, i, "macro", "endmacro");
      const argsRaw = command.argumentsRaw.trim();
      const openParen = argsRaw.indexOf("(");
      const macroName = openParen < 0 ? argsRaw : argsRaw.slice(0, openParen).trim();
      const closeParen = openParen >= 0 ? findMatchingCloseParen(argsRaw, openParen) : -1;
      const paramsStr = closeParen >= 0 ? argsRaw.slice(openParen + 1, closeParen).trim() : "";
      const paramNames = paramsStr ? splitArguments(paramsStr).map((s) => s.trim()) : [];
      const body = parsedCommands.slice(i + 1, endIdx).map((c) => c.raw);
      backend.registerMacro(macroName, paramNames, body);
      i = endIdx;
      continue;
    }
  }
}

export const executeParsedCommands = (
  backend: ICompilationBackend,
  parsedCommands: ParsedCommand[],
  options: ExecuteParsedCommandOptions = {}
): void => {
  runStructAndMacroDefinitionsOnly(backend, parsedCommands);
  for (let i = 0; i < parsedCommands.length; i++) {
    const command = parsedCommands[i];
    if (!command) continue;
    const isStructBlock =
      (command.kind === "directive" && command.directive.trim().toLowerCase() === "struct") ||
      (command.raw.trim().toLowerCase().startsWith("struct ") && command.kind !== "label");
    if (isStructBlock) {
      const endIdx = findMatchingEnd(parsedCommands, i, "struct", "endstruct");
      const argsRaw = (command.kind === "directive" ? command.argumentsRaw : command.raw.replace(/^struct\s+/i, "")).trim();
      const words = argsRaw.split(/\s+/).map((w) => w.trim()).filter(Boolean);
      const structName = (command.kind === "directive" && command.arguments?.[0]?.trim()) || words[0] || "";
      let parent: string | undefined;
      if (words[1]?.toLowerCase() === "extends" && words[2]) {
        parent = words[2];
      }
      debug("struct block i=%d endIdx=%d structName=%s kind=%s raw=%s", i, endIdx, structName, command.kind, command.raw?.slice(0, 50));
      if (structName && typeof backend.startStruct === "function") {
        backend.startStruct(structName, parent);
        debug("struct startStruct(%s) pass=%s", structName, backend.pass);
        const structMemberSkipRe = /\s*\.(\w+):\s*skip\s+(\d+)/i;
        for (let j = i + 1; j < endIdx; j++) {
          const bodyCmd = parsedCommands[j];
          if (!bodyCmd) continue;
          // Skip endstruct (we'll hit it as last body command when depth is used; we iterate j < endIdx so we don't include it)
          if (bodyCmd.kind === "directive" && bodyCmd.directive.toLowerCase() === "endstruct") {
            continue;
          }
          // Parser may treat ".first: skip 1" as directive ".first:" with argumentsRaw "skip 1"
          let memberName: string | null = null;
          let skipAmount = 0;
          const skipMatchRaw = bodyCmd.raw.match(structMemberSkipRe);
          if (skipMatchRaw) {
            memberName = skipMatchRaw[1];
            skipAmount = parseInt(skipMatchRaw[2], 10);
          } else if (bodyCmd.kind === "directive" && bodyCmd.directive.startsWith(".") && bodyCmd.directive.endsWith(":")) {
            memberName = bodyCmd.directive.replace(/:$/, "").replace(/^\./, "");
            const skipMatch = bodyCmd.argumentsRaw.match(/skip\s+(\d+)/i);
            skipAmount = skipMatch ? parseInt(skipMatch[1], 10) : 0;
          } else if (bodyCmd.kind === "label" && bodyCmd.labelName.startsWith(".")) {
            memberName = bodyCmd.labelName.replace(/^\./, "");
            const skipMatch = bodyCmd.raw.match(/skip\s+(\d+)/i);
            skipAmount = skipMatch ? parseInt(skipMatch[1], 10) : 0;
          }
          if (memberName !== null && typeof backend.recordStructMember === "function") {
            backend.recordStructMember(memberName, skipAmount);
            debug("struct recordStructMember(%s, %d)", memberName, skipAmount);
          }
        }
        if (typeof backend.endStruct === "function") backend.endStruct();
        debug("struct endStruct(%s)", structName);
      } else {
        debug("struct skip (no structName or no startStruct) structName=%s", structName);
      }
      i = endIdx;
      continue;
    }
    if (command.kind === "directive" && command.directive.toLowerCase() === "macro") {
      const endIdx = findMatchingEnd(parsedCommands, i, "macro", "endmacro");
      const argsRaw = command.argumentsRaw.trim();
      const openParen = argsRaw.indexOf("(");
      let macroName: string;
      let paramNames: string[];
      if (openParen < 0) {
        macroName = argsRaw;
        paramNames = [];
      } else {
        macroName = argsRaw.slice(0, openParen).trim();
        const closeParen = findMatchingCloseParen(argsRaw, openParen);
        const paramsStr = closeParen >= 0 ? argsRaw.slice(openParen + 1, closeParen).trim() : "";
        paramNames = paramsStr ? splitArguments(paramsStr).map((s) => s.trim()) : [];
      }
      const bodyCommands = parsedCommands.slice(i + 1, endIdx);
      const body = bodyCommands.map((c) => c.raw);
      if (typeof backend.registerMacro === "function") {
        backend.registerMacro(macroName, paramNames, body);
      }
      i = endIdx;
      continue;
    }
    if (command.kind === "directive" && command.directive.toLowerCase() === "while") {
      const endIdx = findMatchingEndWithAlternates(parsedCommands, i, "while", ["endwhile", "endif"]);
      const body = parsedCommands.slice(i + 1, endIdx);
      const argsRaw = command.argumentsRaw.trim();
      const evalCond = typeof backend.evaluateExpression === "function"
        ? () => backend.evaluateExpression(argsRaw) !== 0
        : () => false;
      let whileIter = 0;
      const maxWhileIter = 100_000;
      while (evalCond()) {
        debug("while iter %d cond=%s bodyLen=%d", whileIter, argsRaw, body.length);
        if (++whileIter > maxWhileIter) {
          throw new Error(`While loop exceeded ${maxWhileIter} iterations (cond: ${argsRaw}), likely infinite loop`);
        }
        executeParsedCommands(backend, body, options);
      }
      debug("while exit after %d iters", whileIter);
      i = endIdx;
      continue;
    }
    if (command.kind === "directive" && command.directive.toLowerCase() === "for") {
      const endIdx = findMatchingEnd(parsedCommands, i, "for", "endfor");
      const body = parsedCommands.slice(i + 1, endIdx);
      const argsRaw = command.argumentsRaw.trim();
      const toMatch = argsRaw.match(/^\s*(\w+)\s*=\s*(.+?)\s+to\s+(.+)$/);
      const dotMatch = argsRaw.match(/^\s*(\w+)\s*=\s*(.+?)\.\.\s*(.+)$/);
      const match = toMatch ?? dotMatch;
      const useDotSyntax = !!dotMatch;
      if (!match || typeof backend.evaluateExpression !== "function" || typeof backend.setDefineValue !== "function") {
        throw new Error(`Invalid for loop: ${argsRaw}`);
      }
      const varName = match[1];
      const startExpr = (match[2] ?? "0").trim();
      const endExpr = (match[3] ?? "0").trim();
      if (!varName) throw new Error(`Invalid for loop: ${argsRaw}`);
      const start = backend.evaluateExpression(startExpr);
      const end = backend.evaluateExpression(endExpr);
      debug("for %s = %d..%d bodyLen=%d", varName, start, end, body.length);
      // asar: .. is exclusive end, "to" is inclusive end
      const endCondition = useDotSyntax ? (v: number) => v < end : (v: number) => v <= end;
      for (let v = start; endCondition(v); v++) {
        backend.setDefineValue(varName, v);
        executeParsedCommands(backend, body, options);
      }
      i = endIdx;
      continue;
    }
    if (command.kind === "directive" && command.directive.toLowerCase() === "function") {
      // Single-line function: "function name(args) = expr" has no endfunction
      const argsRaw = command.argumentsRaw.trim();
      if (argsRaw.includes("=")) {
        // Skip this line only (single-line function definition; asar would register it for later use)
        continue;
      }
      const endIdx = findMatchingEnd(parsedCommands, i, "function", "endfunction");
      i = endIdx;
      continue;
    }
    executeOne(backend, command, options);
  }
};
