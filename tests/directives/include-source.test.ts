import { test } from "../ava-helper.js";
import {
  handleIncbin,
  handleInclude,
  handleIncsrc,
  registerIncludeSourceDirectives,
} from "../../src/directives/include-source.js";
import type { IncludeDirectiveContext } from "../../src/directives/types.js";
import { DirectiveRegistry } from "../../src/directives/registry.js";
import { createNormalizedCommand } from "../../src/ir/normalized-command.js";
import { parseExpressionNode, type ExpressionNode } from "../../src/ir/expression-node.js";
import { createOperandResolver, runtimeStub } from "./test-stubs.js";

const evalRange = (expr: string | ExpressionNode, labels: Record<string, number> = {}): number => {
  if (typeof expr === "string") {
    const text = expr.trim();
    if (text in labels) return labels[text];
    if (/^\$[\da-f]+$/i.test(text)) return parseInt(text.slice(1), 16);
    if (/^-?\d+$/.test(text)) return Number(text);
    const times = text.match(/^(\d+)\s*\*\s*(\d+)$/);
    if (times) return Number(times[1]) * Number(times[2]);
    return evalRange(parseExpressionNode(text), labels);
  }
  if (expr.type === "identifier") {
    if (expr.name in labels) return labels[expr.name];
    return 0;
  }
  if (expr.type === "literal") return evalRange(expr.value, labels);
  if (expr.type === "raw") {
    if (expr.value in labels) return labels[expr.value];
    return 0;
  }
  if (expr.type === "unary") {
    const value = evalRange(expr.argument, labels);
    if (expr.operator === "-") return -value;
    return value;
  }
  if (expr.type === "binary") {
    const left = evalRange(expr.left, labels);
    const right = evalRange(expr.right, labels);
    if (expr.operator === "*") return left * right;
    if (expr.operator === "+") return left + right;
    if (expr.operator === "-") return left - right;
    if (expr.operator === "&") return left & right;
    return 0;
  }
  return 0;
};

type IncludeSessionOverrides = {
  files?: Record<string, Uint8Array | string | null>;
  labels?: Record<string, number>;
};

const createContext = (overrides: IncludeSessionOverrides = {}) => {
  const written: number[] = [];
  const events: string[] = [];
  const files = overrides.files ?? {
    "data.bin": new Uint8Array([0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80]),
  };
  const labels = overrides.labels ?? {};
  const session = {
    evaluateRangeExpression: (expr) => evalRange(expr, labels),
    symbolScope: {
      getLabelValue: (label: string) => {
        if (label in labels) return labels[label];
        throw new Error(`unknown label ${label}`);
      },
    },
    setWritePosition: (address: number) => events.push(`seek:${address.toString(16)}`),
    recordCurrentAddress: () => events.push("record"),
    write1: (value: number) => written.push(value),
  };
  const includeCalls: string[] = [];
  const identityDefine = (content: string) => content;
  const ctx = {
    session,
    defineEngine: {
      resolveDefinesInStringLiteral: identityDefine,
      resolveRegularDefines: identityDefine,
    },
    includeSource: {
      assembleFile: (filename: string) => includeCalls.push(`incsrc:${filename}`),
      includeFile: (filename: string) => includeCalls.push(`include:${filename}`),
      guardCurrentFile: () => includeCalls.push("includeonce"),
      readFile: (filename: string) => files[filename] ?? null,
    },
    operandResolver: createOperandResolver(),
    runtime: {
      ...runtimeStub,
      handlePushPC: () => events.push("push"),
      handlePullPC: () => events.push("pull"),
    },
  } as IncludeDirectiveContext;
  return { ctx, session, written, events, includeCalls };
};

test("incbin writes the full file and records the address", (t) => {
  const { ctx, written, events } = createContext();
  handleIncbin(ctx, ["incbin", "data.bin"]);
  t.deepEqual(written, [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80]);
  t.deepEqual(events, ["record"]);
});

test("incbin strips quoted filenames and keeps colons inside quotes", (t) => {
  const { ctx, written } = createContext({
    files: {
      "data.bin": new Uint8Array([0xaa]),
      "C:\\data.bin": new Uint8Array([0xbb]),
      "tick.bin": new Uint8Array([0xcc]),
    },
  });
  handleIncbin(ctx, ["incbin", '"data.bin"']);
  handleIncbin(ctx, ["incbin", "'data.bin'"]);
  handleIncbin(ctx, ["incbin", "`tick.bin`"]);
  handleIncbin(ctx, ["incbin", '"C:\\data.bin"']);
  t.deepEqual(written, [0xaa, 0xaa, 0xcc, 0xbb]);
});

test("incbin slices with .. ranges and treats end 0 as EOF", (t) => {
  const { ctx, written } = createContext();
  handleIncbin(ctx, ["incbin", "data.bin:2..5"]);
  t.deepEqual(written, [0x30, 0x40, 0x50]);

  written.length = 0;
  handleIncbin(ctx, ["incbin", '"data.bin":2..4']);
  t.deepEqual(written, [0x30, 0x40]);

  written.length = 0;
  handleIncbin(ctx, ["incbin", "data.bin:2..0"]);
  t.deepEqual(written, [0x30, 0x40, 0x50, 0x60, 0x70, 0x80]);
});

test("incbin rejoins spaced math tokens in .. ranges", (t) => {
  const { ctx, written } = createContext();
  handleIncbin(ctx, ["incbin", "data.bin:(000", "*", "2)..(003", "*", "2)"]);
  t.deepEqual(written, [0x10, 0x20, 0x30, 0x40, 0x50, 0x60]);
});

test("incbin uses a normalized command range when provided", (t) => {
  const { ctx, written } = createContext();
  const command = createNormalizedCommand(
    'incbin "data.bin":$1..$3',
    'incbin "data.bin":$1..$3',
    ["incbin", '"data.bin":$1..$3'],
    "test.asm",
    1,
  );
  handleIncbin(ctx, ["incbin", '"data.bin":$1..$3'], "", command);
  t.deepEqual(written, [0x20, 0x30]);
});

test("incbin slices deprecated hyphen ranges and treats end 0 as EOF", (t) => {
  const { ctx, written } = createContext();
  handleIncbin(ctx, ["incbin", "data.bin:1-4"]);
  t.deepEqual(written, [0x20, 0x30, 0x40]);

  written.length = 0;
  handleIncbin(ctx, ["incbin", "data.bin:2-0"]);
  t.deepEqual(written, [0x30, 0x40, 0x50, 0x60, 0x70, 0x80]);

  written.length = 0;
  handleIncbin(ctx, ["incbin", "data.bin:4-"]);
  t.deepEqual(written, [0x50, 0x60, 0x70, 0x80]);
});

test("incbin hyphen ranges accept asar parenthesized math", (t) => {
  const { ctx, written } = createContext();
  handleIncbin(ctx, ["incbin", "data.bin:(0+1)-(1+3)"]);
  t.deepEqual(written, [0x20, 0x30, 0x40]);

  written.length = 0;
  handleIncbin(ctx, ["incbin", "data.bin:0-((1+3))"]);
  t.deepEqual(written, [0x10, 0x20, 0x30, 0x40]);

  written.length = 0;
  handleIncbin(ctx, ["incbin", "data.bin:(1+3)-"]);
  t.deepEqual(written, [0x50, 0x60, 0x70, 0x80]);
});

test("incbin hyphen ranges evaluate SMRPG bank-wrap math against a label", (t) => {
  const file = Uint8Array.from({ length: 3865 }, (_, index) => index & 0xff);
  const { ctx, written } = createContext({
    files: { "SPC700/DATA_C4FC3B.bin": file },
    labels: { DATA_C4FC3B: 0xc4fc3b },
  });
  handleIncbin(ctx, [
    "incbin",
    '"SPC700/DATA_C4FC3B.bin":0-(($010000-DATA_C4FC3B)&$00FFFF)',
  ]);
  t.is(written.length, 0x3c5);
  t.is(written[0], 0);
  t.is(written[written.length - 1], (0x3c5 - 1) & 0xff);
});

test("incbin seeks to a numeric -> target then restores PC", (t) => {
  const { ctx, written, events } = createContext();
  handleIncbin(ctx, ["incbin", "data.bin", "->", "$1000"]);
  t.deepEqual(written, [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80]);
  t.deepEqual(events, ["push", "seek:1000", "pull", "record"]);
});

test("incbin seeks to a decimal -> target and to a label", (t) => {
  const { ctx, events } = createContext({ labels: { LoadDest: 0x2000 } });
  handleIncbin(ctx, ["incbin", "data.bin", "->", "8192"]);
  t.deepEqual(events.slice(0, 2), ["push", "seek:2000"]);

  events.length = 0;
  handleIncbin(ctx, ["incbin", "data.bin", "->", "LoadDest"]);
  t.deepEqual(events.slice(0, 2), ["push", "seek:2000"]);
});

test("incbin rejects missing files and missing -> targets", (t) => {
  const { ctx } = createContext({
    files: {
      "text.bin": "not-bytes",
    },
  });
  t.is(
    t.throws(() => handleIncbin(ctx, ["incbin", "missing.bin"])).message,
    "Failed to read file: missing.bin",
  );
  t.is(
    t.throws(() => handleIncbin(ctx, ["incbin", "text.bin"])).message,
    "Failed to read file: text.bin",
  );
  t.is(
    t.throws(() => handleIncbin(ctx, ["incbin", '"unterminated.bin'])).message,
    'Failed to read file: "unterminated.bin',
  );
  t.is(
    t.throws(() => handleIncbin(ctx, ["incbin", "data.bin", "->"])).message,
    "incbin '->' syntax requires a target location.",
  );
});

test("incbin rejects malformed and parenthesized hyphen ranges", (t) => {
  const { ctx } = createContext();
  t.is(
    t.throws(() => handleIncbin(ctx, ["incbin", "data.bin:invalid"])).message,
    "Invalid range specification: invalid",
  );
  t.is(
    t.throws(() => handleIncbin(ctx, ["incbin", "data.bin:5.."])).message,
    "Invalid range specification: 5..",
  );
  t.is(
    t.throws(() => handleIncbin(ctx, ["incbin", "data.bin:(0..1)"])).message,
    "Invalid range specification: (0..1)",
  );
  t.is(
    t.throws(() => handleIncbin(ctx, ["incbin", "data.bin:2..5..7"])).message,
    "Invalid range specification: 2..5..7",
  );
  t.is(
    t.throws(() => handleIncbin(ctx, ["incbin", "data.bin:(2+2)+(1+3)-($8000)"])).message,
    "Emismatched_parentheses: Mismatched parentheses.",
  );
});

test("incbin rejects inverted and out-of-range slices", (t) => {
  const { ctx } = createContext();
  t.is(
    t.throws(() => handleIncbin(ctx, ["incbin", "data.bin:5..2"])).message,
    "Start offset 5 out of bounds for file data.bin (length 8, range 5..2)",
  );
  t.is(
    t.throws(() => handleIncbin(ctx, ["incbin", "data.bin:-1..2"])).message,
    "Start offset -1 out of bounds for file data.bin (length 8, range -1..2)",
  );
  t.is(
    t.throws(() => handleIncbin(ctx, ["incbin", "data.bin:9..9"])).message,
    "Start offset 9 out of bounds for file data.bin (length 8, range 9..9)",
  );
  t.is(
    t.throws(() => handleIncbin(ctx, ["incbin", "data.bin:0..100"])).message,
    "End offset 100 out of bounds for file data.bin (length 8, range 0..100)",
  );
});

test("incsrc and include prefer IR targets and reject missing filenames", (t) => {
  const { ctx, includeCalls } = createContext();
  const spaced = createNormalizedCommand(
    'incsrc "shared file.asm"',
    'incsrc "shared file.asm"',
    ["incsrc", '"shared file.asm"'],
    "test.asm",
    1,
  );

  handleIncsrc(ctx, ["incsrc", "raw.asm"]);
  handleInclude(ctx, ["include", "guarded.asm"]);
  handleIncsrc(ctx, ["incsrc", "ignored.asm"], "", spaced);
  t.is(
    t.throws(() => handleIncsrc(ctx, ["incsrc"])).message,
    "incsrc requires exactly one filename parameter",
  );
  t.is(
    t.throws(() => handleInclude(ctx, ["include"])).message,
    "include requires exactly one filename parameter",
  );
  t.deepEqual(includeCalls, ["incsrc:raw.asm", "include:guarded.asm", 'incsrc:"shared file.asm"']);
});

test("incsrc and include expand defines in quoted and unquoted paths", (t) => {
  const { ctx, includeCalls } = createContext();
  ctx.defineEngine = {
    resolveDefinesInStringLiteral: (content) => content.replaceAll("!ROMID", "SMRPG_U"),
    resolveRegularDefines: (content) => content.replaceAll("!GameID", "SMRPG"),
  };

  handleIncsrc(ctx, ["incsrc", '"../SMRPG/RomMap/ROM_Map_!ROMID.asm"']);
  handleInclude(ctx, ["include", "!GameID/boot.asm"]);
  t.deepEqual(includeCalls, [
    'incsrc:"../SMRPG/RomMap/ROM_Map_SMRPG_U.asm"',
    "include:SMRPG/boot.asm",
  ]);
});

test("incbin expands defines in the filename", (t) => {
  const { ctx, written } = createContext({
    files: {
      "engine.bin": new Uint8Array([0x11, 0x22]),
    },
  });
  ctx.defineEngine = {
    resolveDefinesInStringLiteral: (content) => content.replaceAll("!PathToFile", "engine.bin"),
    resolveRegularDefines: (content) => content,
  };
  handleIncbin(ctx, ["incbin", '"!PathToFile"']);
  t.deepEqual(written, [0x11, 0x22]);
});

test("include source registration exposes all handlers", (t) => {
  const { ctx, includeCalls } = createContext();
  const registry = new DirectiveRegistry();
  registerIncludeSourceDirectives(registry, ctx);

  for (const directive of ["incsrc", "include", "includeonce", "incbin"]) {
    t.true(registry.has(directive));
  }

  registry.dispatch("includeonce", ["includeonce"], "includeonce");
  t.deepEqual(includeCalls, ["includeonce"]);
});
