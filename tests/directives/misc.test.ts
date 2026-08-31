import { test } from "../ava-helper.js";
import {
  handleAssert,
  handleClearTable,
  handleError,
  handleTable,
  handleWarnpc,
  registerMiscDirectives,
} from "../../packages/core/src/directives/misc.js";
import type {
  DiagnosticDirectiveContext,
  TableDirectiveContext,
} from "../../packages/core/src/directives/types.js";
import type { ExpressionNode } from "../../packages/core/src/ir/expression-node.js";
import { DirectiveRegistry } from "../../packages/core/src/directives/registry.js";

const parseStubNumber = (input: string): number => {
  const text = input.trim();
  if (/^\$[\da-f]+$/i.test(text)) {
    return Number.parseInt(text.slice(1), 16);
  }
  return Number(text);
};

const createDiagnosticContext = (
  evaluateExpression: (expression: string | ExpressionNode) => boolean,
  currentTargetAddress = 0,
): DiagnosticDirectiveContext => ({
  session: {
    evaluateExpression,
    resolvedefines: (input) => input,
    currentTargetAddress,
    operandResolver: { getnum: parseStubNumber },
  },
});

test("assert passes a nonzero condition and ignores the message", (t) => {
  const seen: string[] = [];
  const ctx = createDiagnosticContext((expression) => {
    seen.push(String(expression));
    return true;
  });

  handleAssert(ctx, ["assert", "1"], 'assert 1, "unused"');

  t.deepEqual(seen, ["1"]);
});

test("assert splits the message at the first top-level comma", (t) => {
  const seen: string[] = [];
  const ctx = createDiagnosticContext((expression) => {
    seen.push(String(expression));
    return true;
  });

  handleAssert(ctx, ["assert"], 'assert 0 == select(1, 1, 0), "Oh no, commas!", bin(%01010101, 8)');

  t.deepEqual(seen, ["0 == select(1, 1, 0)"]);
});

test("assert fails with asar's default message", (t) => {
  const ctx = createDiagnosticContext(() => false);

  t.throws(() => handleAssert(ctx, ["assert", "0"], "assert 0"), {
    message: "Assertion failed.",
  });
});

test("assert fails with a dequoted custom message", (t) => {
  const ctx = createDiagnosticContext(() => false);

  t.throws(() => handleAssert(ctx, ["assert"], 'assert 0, "You must put a BANK_END"'), {
    message: "Assertion failed: You must put a BANK_END",
  });
});

test("assert rejects a missing condition", (t) => {
  const ctx = createDiagnosticContext(() => true);

  t.throws(() => handleAssert(ctx, ["assert"], "assert"), {
    message: "Broken conditional: assert",
  });
});

test("error throws asar's default and quoted messages", (t) => {
  const ctx = createDiagnosticContext(() => true);

  t.throws(() => handleError(ctx, ["error"], "error"), {
    message: "error command.",
  });
  t.throws(() => handleError(ctx, ["error"], 'error "Bank $FF is beyond"'), {
    message: "error command: Bank $FF is beyond",
  });
});

test("warnpc passes when PC is at or below the bound", (t) => {
  const ctx = createDiagnosticContext(() => true, 0x8000);

  handleWarnpc(ctx, ["warnpc", "$8001"], "warnpc $8001");
  handleWarnpc(ctx, ["warnpc", "$8000"], "warnpc $8000");
  t.pass();
});

test("warnpc fails when PC is past the bound", (t) => {
  const ctx = createDiagnosticContext(() => true, 0x8002);

  t.throws(() => handleWarnpc(ctx, ["warnpc", "$8001"], "warnpc $8001"), {
    message: "warnpc failed: Current pc = $008002, wanted <= $008001",
  });
});

test("warnpc rejects a missing address", (t) => {
  const ctx = createDiagnosticContext(() => true);
  t.throws(() => handleWarnpc(ctx, ["warnpc"], "warnpc"), {
    message: "warnpc requires an address",
  });
});

test("error strips @keyword and ignores a mismatched raw keyword", (t) => {
  const ctx = createDiagnosticContext(() => true);
  t.throws(() => handleError(ctx, ["error"], "@error"), {
    message: "error command.",
  });
  t.throws(() => handleError(ctx, ["error"], "@e"), {
    message: "error command.",
  });
  t.throws(() => handleError(ctx, ["error"], "assert 1"), {
    message: "error command: assert 1",
  });
});

test("table loads asar char=hex lines without stripping a leading space", (t) => {
  const mappings = new Map<string, number>();
  const ctx: TableDirectiveContext = {
    session: {
      tableStack: [],
      characterMappings: mappings,
      currentTable: null,
      includeSource: {
        readFile: () => " =20\n!=21\nA=41\n~=3A\n",
      },
    },
  };

  handleTable(ctx, ["table", '"font.txt"'], 'table "font.txt"');

  t.is(mappings.get(" "), 0x20);
  t.is(mappings.get("!"), 0x21);
  t.is(mappings.get("A"), 0x41);
  t.is(mappings.get("~"), 0x3a);
  t.is(ctx.session.currentTable, "font.txt");
});

test("table rtl reads hex=char lines", (t) => {
  const mappings = new Map<string, number>();
  const ctx: TableDirectiveContext = {
    session: {
      tableStack: [],
      characterMappings: mappings,
      currentTable: null,
      includeSource: {
        readFile: () => "41=A\n20= \n",
      },
    },
  };

  handleTable(ctx, ["table", '"font.txt"', "rtl"], 'table "font.txt",rtl');

  t.is(mappings.get("A"), 0x41);
  t.is(mappings.get(" "), 0x20);
});

test("table ltr suffix is accepted and ignored as the default direction", (t) => {
  const mappings = new Map<string, number>();
  const ctx: TableDirectiveContext = {
    session: {
      tableStack: [],
      characterMappings: mappings,
      currentTable: null,
      includeSource: {
        readFile: () => "A=41\n",
      },
    },
  };

  handleTable(ctx, ["table", '"font.txt"', "ltr"], 'table "font.txt",ltr');
  t.is(mappings.get("A"), 0x41);
});

test("table replaces prior mappings and rejects invalid lines", (t) => {
  const mappings = new Map<string, number>([["Z", 0x5a]]);
  const ctx: TableDirectiveContext = {
    session: {
      tableStack: [],
      characterMappings: mappings,
      currentTable: "old",
      includeSource: {
        readFile: (filename) => {
          if (filename === "bad.txt") {
            return "A=4\n";
          }
          if (filename === "bytes.bin") {
            return new Uint8Array([0x41]);
          }
          return "B=42\n";
        },
      },
    },
  };

  handleTable(ctx, ["table", '"ok.txt"'], 'table "ok.txt"');
  t.false(mappings.has("Z"));
  t.is(mappings.get("B"), 0x42);

  t.throws(() => handleTable(ctx, ["table"], "table"), {
    message: "table requires a filename",
  });
  t.throws(() => handleTable(ctx, ["table", '"bad.txt"'], 'table "bad.txt"'), {
    message: "Invalid table file: line 1",
  });
  t.throws(() => handleTable(ctx, ["table", '"bytes.bin"'], 'table "bytes.bin"'), {
    message: "Error reading file: bytes.bin",
  });
});

test("table keeps CRLF mapped characters and rejects asar-invalid spellings", (t) => {
  const mappings = new Map<string, number>();
  const ctx: TableDirectiveContext = {
    session: {
      tableStack: [],
      characterMappings: mappings,
      currentTable: null,
      includeSource: {
        readFile: (filename) => {
          if (filename === "crlf.txt") {
            return "A=41\r\nB=42\r";
          }
          if (filename === "ltr-bad.txt") {
            return "A-41\n";
          }
          if (filename === "ltr-hex.txt") {
            return "A=4G\n";
          }
          if (filename === "ltr-x.txt") {
            return "A=0x\n";
          }
          if (filename === "rtl-x.txt") {
            return "0X41=A\n";
          }
          if (filename === "rtl-eq.txt") {
            return "4=AB\n";
          }
          return "GG=A\n";
        },
      },
    },
  };

  handleTable(ctx, ["table", '"crlf.txt"'], 'table "crlf.txt"');
  t.is(mappings.get("A"), 0x41);
  t.is(mappings.get("B"), 0x42);

  t.throws(() => handleTable(ctx, ["table", '"ltr-bad.txt"'], 'table "ltr-bad.txt"'), {
    message: "Invalid table file: line 1",
  });
  t.throws(() => handleTable(ctx, ["table", '"ltr-hex.txt"'], 'table "ltr-hex.txt"'), {
    message: "Invalid table file: line 1",
  });
  t.throws(() => handleTable(ctx, ["table", '"ltr-x.txt"'], 'table "ltr-x.txt"'), {
    message: "Invalid table file: line 1",
  });
  t.throws(() => handleTable(ctx, ["table", '"rtl-x.txt"', "rtl"], 'table "rtl-x.txt",rtl'), {
    message: "Invalid table file: line 1",
  });
  t.throws(() => handleTable(ctx, ["table", '"rtl-eq.txt"', "rtl"], 'table "rtl-eq.txt",rtl'), {
    message: "Invalid table file: line 1",
  });
  t.throws(() => handleTable(ctx, ["table", '"rtl-hex.txt"', "rtl"], 'table "rtl-hex.txt",rtl'), {
    message: "Invalid table file: line 1",
  });
});

test("cleartable restores identity mappings", (t) => {
  const mappings = new Map<string, number>([
    ["A", 0x10],
    ["~", 0x3a],
  ]);
  const ctx: TableDirectiveContext = {
    session: {
      tableStack: [],
      characterMappings: mappings,
      currentTable: "font.txt",
      includeSource: {
        readFile: () => "",
      },
    },
  };

  handleClearTable(ctx);
  t.is(mappings.size, 0);
  t.is(ctx.session.currentTable, null);
});

test("misc registry dispatches assert, error, warn, and warnpc", (t) => {
  const registry = new DirectiveRegistry();
  let evaluated = "";
  registerMiscDirectives(registry, {
    table: {
      session: {
        tableStack: [],
        characterMappings: new Map(),
        currentTable: null,
        includeSource: {
          readFile: () => "",
        },
      },
    },
    diagnostic: {
      session: {
        evaluateExpression: (expression) => {
          evaluated = String(expression);
          return true;
        },
        resolvedefines: (input) => input,
        currentTargetAddress: 0x8000,
        operandResolver: { getnum: parseStubNumber },
      },
    },
  });
  t.true(registry.dispatch("assert", ["assert", "1"], "assert 1"));
  t.is(evaluated, "1");
  t.false(registry.dispatch("warn", ["warn"], "warn"));
  t.true(registry.dispatch("warnpc", ["warnpc", "$8001"], "warnpc $8001"));
  t.throws(() => registry.dispatch("error", ["error"], "error"));
});
