import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { stub } from "sinon";

import { test } from "../../../tests/ava-helper.js";
import {
  MemoryAssemblyFileProvider,
  NodeAssemblyFileProvider,
  NodeAssemblySnapshotProvider,
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

test("snapshot resolution uses macro, source, include and cwd order for saved and overlay files", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asm-snapshot-resolution-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const macro = path.join(root, "macros/shared.asm");
  const source = path.join(root, "source/shared.asm");
  const include = path.join(root, "includes/shared.asm");
  fs.mkdirSync(path.dirname(include), { recursive: true });
  fs.writeFileSync(include, "disk");
  const cwd = path.resolve(`snapshot-${path.basename(root)}.asm`);
  const options = {
    macroSourceFile: path.join(root, "macros/definition.asm"),
    currentFile: path.join(root, "source/main.asm"),
    includePaths: [path.dirname(include)],
  };
  const overlays = new Map<string, Uint8Array | null>([
    [macro, Buffer.from("macro")],
    [source, Buffer.from("source")],
    [cwd, Buffer.from("cwd")],
  ]);
  let files = new NodeAssemblySnapshotProvider({ overlays });
  t.is(files.resolvePath("shared.asm", options), macro);
  t.is(files.resolvePath(`\`${macro}\``), macro);
  t.is(files.resolvePath(path.basename(cwd)), cwd);
  t.is(files.resolvePath(""), undefined);
  overlays.set(macro, null);
  files = new NodeAssemblySnapshotProvider({ overlays });
  t.is(files.resolvePath('"shared.asm"', options), source);
  t.is(files.resolvePath(macro), undefined);
  overlays.set(source, null);
  files = new NodeAssemblySnapshotProvider({ overlays });
  t.is(files.resolvePath("shared.asm", options), include);
  overlays.set(include, null);
  files = new NodeAssemblySnapshotProvider({ overlays });
  t.is(files.resolvePath("shared.asm", options), undefined);
  t.false(files.stat(include).exists);
  t.throws(() => files.readFile(include), { message: /Candidate source removed/ });
});

test("snapshots own overlay bytes and retain first reads until saved-input freshness validation", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asm-snapshot-ownership-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const saved = path.join(root, "saved.bin");
  const created = path.join(root, "created.bin");
  fs.writeFileSync(saved, Buffer.from([1, 2]));
  const input = Uint8Array.of(3, 4);
  const overlays = new Map<string, Uint8Array | null>([[created, input]]);
  const files = new NodeAssemblySnapshotProvider({ overlays });
  input.fill(99);
  overlays.set(created, null);
  files.readFile(created).fill(88);
  t.deepEqual([...files.readFile(created)], [3, 4]);
  t.deepEqual([...files.readFile(saved)], [1, 2]);
  files.assertUnchanged();
  fs.writeFileSync(saved, Buffer.from([2, 1]));
  t.deepEqual([...files.readFile(saved)], [1, 2]);
  t.throws(() => files.assertUnchanged(), { message: /Source dependency changed/ });
  fs.unlinkSync(saved);
  t.is(files.resolvePath(saved), saved);
  t.is(files.stat(saved).size, 2);
  t.throws(() => files.assertUnchanged(), { message: /Source dependency changed/ });
  t.deepEqual([...files.snapshots.get(created)!], [3, 4]);
  t.true(files.readFiles.has(created));
});

test("snapshot byte limits cover overlays and aggregate consumed inputs without recounting passes", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asm-snapshot-limits-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const first = path.join(root, "first.bin");
  const second = path.join(root, "second.bin");
  fs.writeFileSync(first, Uint8Array.of(1, 2));
  fs.writeFileSync(second, Uint8Array.of(3, 4));
  const files = new NodeAssemblySnapshotProvider({ maxBytes: 3 });
  files.readFile(first);
  files.readFile(first);
  t.throws(() => files.readFile(second), { message: /snapshot exceeds 3 bytes/ });
  t.is(files.snapshots.size, 1);
  t.throws(() => new NodeAssemblySnapshotProvider({ maxBytes: 0 }), {
    message: /positive safe integer/,
  });
  t.throws(
    () =>
      new NodeAssemblySnapshotProvider({
        maxBytes: 3,
        overlays: new Map([[first, new Uint8Array(4)]]),
      }),
    { message: /overlays exceed 3 bytes/ },
  );
  t.throws(
    () => new NodeAssemblySnapshotProvider({ overlays: new Map([["relative.asm", null]]) }),
    { message: /absolute path/ },
  );
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

  t.deepEqual(
    fromMap.readFile("/proj/main.asm"),
    new Uint8Array(Buffer.from("org $8000\n", "utf8")),
  );
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
    t.is(
      provider.resolvePath("nowhere.asm", { currentFile: current, includePaths: [includeDir] }),
      undefined,
    );

    t.deepEqual(provider.stat(path.join(directory, "missing.asm")), {
      exists: false,
      readable: false,
    });
    t.like(provider.stat(current), {
      exists: true,
      readable: true,
      size: fs.statSync(current).size,
    });
    t.deepEqual(provider.readFile(child), new Uint8Array(fs.readFileSync(child)));
    t.is(provider.readTextFile(current), "org $8000\n");

    const access = stub(fs, "accessSync").throws(new Error("EACCES"));
    try {
      t.like(provider.stat(current), { exists: true, readable: false });
    } finally {
      access.restore();
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
