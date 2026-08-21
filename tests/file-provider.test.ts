import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stub } from "sinon";
import { test } from "./ava-helper.js";
import {
  MemoryAssemblyFileProvider,
  NodeAssemblyFileProvider,
  stripWrappingQuotes,
} from "../src/file-provider.js";

test("MemoryAssemblyFileProvider resolves quoted, relative, and absolute keys", (t) => {
  const provider = new MemoryAssemblyFileProvider(
    {
      "/proj/main.asm": "org $8000\n",
      "/proj/child.asm": "nop\n",
      "/macros/lib.asm": "macro\n",
      "/inc/shared.asm": "db $01\n",
      "/work/cwd.asm": "db $02\n",
    },
    { workingDirectory: "/work" },
  );

  t.is(provider.resolvePath(""), undefined);
  t.is(provider.resolvePath("/proj/main.asm"), "/proj/main.asm");
  t.is(provider.resolvePath('"/proj/main.asm"'), "/proj/main.asm");
  t.is(provider.resolvePath("/missing.asm"), undefined);
  t.is(provider.resolvePath("child.asm", { currentFile: "/proj/main.asm" }), "/proj/child.asm");
  t.is(provider.resolvePath("lib.asm", { macroSourceFile: "/macros/def.asm" }), "/macros/lib.asm");
  t.is(provider.resolvePath("shared.asm", { includePaths: ["/inc"] }), "/inc/shared.asm");
  t.is(provider.resolvePath("cwd.asm"), "/work/cwd.asm");
  t.is(provider.resolvePath("nowhere.asm", { currentFile: "/proj/main.asm" }), undefined);
});

test("MemoryAssemblyFileProvider stats and reads string and binary files", (t) => {
  const bytes = new Uint8Array([0x41, 0x42]);
  const fromMap = new MemoryAssemblyFileProvider(
    new Map<string, string | Uint8Array>([
      ["/proj/main.asm", "org $8000\n"],
      ["/proj/data.bin", bytes],
    ]),
  );
  const empty = new MemoryAssemblyFileProvider();

  t.deepEqual(empty.stat("/proj/main.asm"), { exists: false, readable: false });
  t.deepEqual(fromMap.stat("/proj/main.asm"), {
    exists: true,
    readable: true,
    size: Buffer.byteLength("org $8000\n", "utf8"),
  });
  t.deepEqual(fromMap.stat("/proj/data.bin"), {
    exists: true,
    readable: true,
    size: bytes.length,
  });

  t.deepEqual(fromMap.readFile("/proj/main.asm"), new Uint8Array(Buffer.from("org $8000\n", "utf8")));
  t.deepEqual(fromMap.readFile("/proj/data.bin"), bytes);
  t.is(fromMap.readTextFile("/proj/main.asm"), "org $8000\n");
  t.is(fromMap.readTextFile("/proj/data.bin"), "AB");
  t.throws(() => fromMap.readFile("/missing.bin"), {
    message: "Virtual file not found: /missing.bin",
  });
  t.throws(() => fromMap.readTextFile("/missing.asm"), {
    message: "Virtual file not found: /missing.asm",
  });
});

test("stripWrappingQuotes: removes matched quotes only", (t) => {
  t.is(stripWrappingQuotes('"child.asm"'), "child.asm");
  t.is(stripWrappingQuotes("'child.asm'"), "child.asm");
  t.is(stripWrappingQuotes("`child.asm`"), "child.asm");
  t.is(stripWrappingQuotes('"child.asm'), '"child.asm');
  t.is(stripWrappingQuotes("child.asm"), "child.asm");
});

test("NodeAssemblyFileProvider resolves, stats, and reads disk files", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "snes-asm-files-"));
  const current = path.join(directory, "main.asm");
  const child = path.join(directory, "child.asm");
  const macros = path.join(directory, "macros", "def.asm");
  const fromMacro = path.join(directory, "macros", "lib.asm");
  const includeDir = path.join(directory, "inc");
  const fromInclude = path.join(includeDir, "shared.asm");
  fs.mkdirSync(path.dirname(fromMacro), { recursive: true });
  fs.mkdirSync(includeDir, { recursive: true });
  fs.writeFileSync(current, "org $8000\n");
  fs.writeFileSync(child, "nop\n");
  fs.writeFileSync(macros, "macro\n");
  fs.writeFileSync(fromMacro, "db $01\n");
  fs.writeFileSync(fromInclude, "db $02\n");

  try {
    const provider = new NodeAssemblyFileProvider();
    t.is(provider.resolvePath(""), undefined);
    t.is(provider.resolvePath(current), current);
    t.is(provider.resolvePath(`"${child}"`), child);
    t.is(provider.resolvePath(path.join(directory, "missing.asm")), undefined);
    t.is(provider.resolvePath("child.asm", { currentFile: current }), child);
    t.is(provider.resolvePath("lib.asm", { macroSourceFile: macros }), fromMacro);
    t.is(provider.resolvePath("shared.asm", { includePaths: [includeDir] }), fromInclude);
    t.is(provider.resolvePath("nowhere.asm", { currentFile: current, includePaths: [includeDir] }), undefined);

    t.deepEqual(provider.stat(path.join(directory, "missing.asm")), {
      exists: false,
      readable: false,
    });
    t.like(provider.stat(current), { exists: true, readable: true, size: fs.statSync(current).size });
    t.deepEqual(provider.readFile(child), new Uint8Array(fs.readFileSync(child)));
    t.is(provider.readTextFile(current), "org $8000\n");

    const access = stub(fs, "accessSync").throws(new Error("EACCES"));
    try {
      t.deepEqual(provider.stat(current), { exists: true, readable: false });
    } finally {
      access.restore();
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
