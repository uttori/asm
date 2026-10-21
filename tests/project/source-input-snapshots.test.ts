import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { NodeAssemblySnapshotProvider } from "@uttori/asm-core";
import { sourceContentHash } from "@uttori/asm-disassembler/source-project";
import { create65xxAssemblerEnvironment, NesCartridge } from "@uttori/asm-plugin-65xx";
import {
  buildNesSource,
  exportNesSource,
  inspectNesSource,
} from "@uttori/asm-plugin-65xx/disassembler";
import { createSnesAssemblerEnvironment } from "@uttori/asm-plugin-snes";
import { buildSnesSource, inspectSnesSource } from "@uttori/asm-plugin-snes/disassembler";
import { stub } from "sinon";

import { test } from "../ava-helper.js";

/** Redistributable source fixtures exercise the same input contract through both target APIs. */
async function fixture(root: string, target: "nes" | "snes") {
  let original = Uint8Array.of(1, 2);
  let sources = [
    { path: "main.asm", bytes: Buffer.from('hirom\norg $C00000\nincbin "payload.bin"\n') },
  ];
  let binary = "payload.bin";
  let targetOptions: Record<string, unknown> = { checksumEnabled: false };
  if (target === "nes") {
    original = new Uint8Array(16 + 16384);
    original.set([0x4e, 0x45, 0x53, 0x1a, 1]);
    const exported = exportNesSource(
      new NesCartridge(original),
      [],
      sourceContentHash(original.subarray(16)),
    );
    for (const file of exported.files) {
      const destination = path.join(root, file.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, file.bytes);
    }
    sources = exported.files
      .filter((file) => file.path.endsWith(".asm"))
      .map((file) => ({ path: file.path, bytes: Buffer.from(file.bytes) }));
    binary = exported.files.find((file) => file.path.endsWith(".bin"))!.path;
    const configuration = JSON.parse(
      fs.readFileSync(path.join(root, "uttori-asm.config.json"), "utf8"),
    );
    targetOptions = configuration.plugins[0].options;
  } else {
    fs.writeFileSync(path.join(root, binary), original);
    fs.writeFileSync(path.join(root, "main.asm"), sources[0].bytes);
  }
  const environment =
    target === "nes"
      ? await create65xxAssemblerEnvironment()
      : await createSnesAssemblerEnvironment();
  const options = {
    root,
    entrySource: "main.asm",
    environment,
    targetOptions,
    expectedSize: original.length,
    originalContent: original,
    outputDirectory: path.join(root, "build"),
    toolchainSha256: "a".repeat(64),
    configurationSha256: "b".repeat(64),
  };
  const inspect = target === "nes" ? inspectNesSource : inspectSnesSource;
  const build = target === "nes" ? buildNesSource : buildSnesSource;
  return { original, sources, binary, options, inspect, build };
}

for (const target of ["nes", "snes"] as const) {
  test.serial(
    `${target} resolves created includes, binary overlays and macro/include precedence without publishing them`,
    async (t) => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), `uttori-${target}-overlays-`));
      t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
      const { original, sources, binary, options, inspect, build } = await fixture(root, target);
      t.deepEqual(inspect(options).output, original);
      const overlays = new Map<string, Uint8Array | null>();
      for (const file of sources) {
        const text = file.bytes.toString();
        if (text.includes(binary)) {
          overlays.set(file.path, Buffer.from(text.replaceAll(binary, `${binary}.new`)));
        }
      }
      overlays.set(`${binary}.new`, fs.readFileSync(path.join(root, binary)));
      const main = Buffer.from(
        overlays.get("main.asm") ?? sources.find((file) => file.path === "main.asm")!.bytes,
      ).toString();
      overlays.set(
        "main.asm",
        Buffer.from(
          `${main}\nincsrc "created.asm"\nincsrc "macros/definition.asm"\n%snapshot_macro()\nincsrc "include-only.asm"\n`,
        ),
      );
      overlays.set("created.asm", Buffer.from("; Created only in the draft\n"));
      overlays.set(
        "macros/definition.asm",
        Buffer.from('macro snapshot_macro()\nincsrc "shared.asm"\nendmacro\n'),
      );
      overlays.set("macros/shared.asm", Buffer.from("; Macro-relative candidate wins\n"));
      overlays.set("includes/include-only.asm", Buffer.from("; Include directory candidate\n"));
      // A saved same-name file must not shadow the macro's draft-relative candidate.
      fs.writeFileSync(path.join(root, "shared.asm"), "invalid source must not be consumed\n");
      const input = { ...options, overlays, includePaths: [path.join(root, "includes")] };
      const inspected = inspect(input);
      t.deepEqual(inspected.output, original);
      for (const file of [
        "created.asm",
        "macros/shared.asm",
        "includes/include-only.asm",
        `${binary}.new`,
      ]) {
        t.true(inspected.snapshots.has(path.join(root, file)), file);
        t.false(fs.existsSync(path.join(root, file)), file);
      }
      // Publication explicitly ignores prospective overlays, even if a structurally compatible caller passes them.
      const built = build(input);
      t.deepEqual(new Uint8Array(fs.readFileSync(built.outputFile)), original);
      t.false(built.inputs.some((file) => file.path === "created.asm"));
      fs.writeFileSync(path.join(root, "retired.asm"), "; retired\n");
      t.throws(
        () =>
          inspect({
            ...options,
            overlays: new Map([
              [
                "main.asm",
                Buffer.from(
                  `${fs.readFileSync(path.join(root, "main.asm"), "utf8")}\nincsrc "retired.asm"\n`,
                ),
              ],
              ["retired.asm", null],
            ]),
          }),
        { message: /Could not find file|removed/ },
      );
    },
  );

  test.serial(`${target} rejects saved inputs changed during assembly`, async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `uttori-${target}-stale-`));
    t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
    const { options, inspect, binary } = await fixture(root, target);
    const originalRead = NodeAssemblySnapshotProvider.prototype.readFile;
    let changed = false;
    const read = stub(NodeAssemblySnapshotProvider.prototype, "readFile").callsFake(function (
      this: NodeAssemblySnapshotProvider,
      file: string,
    ) {
      const bytes = originalRead.call(this, file);
      if (!changed && file === path.join(root, binary)) {
        changed = true;
        const next = bytes.slice();
        next[0] ^= 1;
        fs.writeFileSync(file, next);
      }
      return bytes;
    });
    t.teardown(() => read.restore());
    t.throws(() => inspect(options), { message: /Source dependency changed during assembly/ });
    t.true(changed);
  });
}
