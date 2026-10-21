import assert from "node:assert/strict";
import fs from "node:fs";

import { Assembler, MemoryAssemblyFileProvider, Uint8ArrayDecoderSource } from "@uttori/asm-core";
import { PluginManager } from "@uttori/asm-core/plugin";

import plugin from "./src/index.js";

const source = fs.readFileSync("main.asm", "utf8");
for (const byte of [undefined, 0, 255]) {
  const manager = new PluginManager();
  try {
    await manager.activatePlugins([{ plugin, options: byte === undefined ? undefined : { byte } }]);
    const environment = manager.freeze();
    for (let repeat = 0; repeat < 2; repeat++) {
      const assembler = new Assembler({
        environment,
        target: "example.raw",
        fileProvider: new MemoryAssemblyFileProvider({}),
      });
      try {
        assembler.assembleSource(source, "main.asm");
        assert.deepEqual([...assembler.getBinaryOutput()], [byte ?? 0x42]);
        assembler.assembleSource(source, "main.asm");
        assert.deepEqual([...assembler.getBinaryOutput()], [byte ?? 0x42]);
      } finally {
        assembler.dispose();
      }
    }
    const decoder = environment.getArchitecture("example.byte")?.createDecoder?.({
      targetId: "example.raw",
      options: {},
      state: {
        get: () => {
          throw new Error("Decoder must not require mutable session state");
        },
      },
    });
    assert.ok(decoder);
    const decode = (bytes: number[]) =>
      decoder.decode({
        source: new Uint8ArrayDecoderSource(Uint8Array.from(bytes)),
        offset: 0,
        logicalAddress: 0,
      });
    assert.equal(decode([byte ?? 0x42]).kind, "instruction");
    assert.equal(decode([]).kind, "error");
    assert.equal(decode([(byte ?? 0x42) ^ 255]).kind, "error");
    await assert.rejects(manager.activatePlugins([{ plugin }]));
  } finally {
    await manager.dispose();
  }
  await manager.dispose();
}
for (const options of [{ byte: -1 }, { byte: 256 }, { byte: 1.5 }, { byte: "66" }, null]) {
  const manager = new PluginManager();
  try {
    await assert.rejects(manager.activatePlugins([{ plugin, options }]));
  } finally {
    await manager.dispose();
  }
}
console.log(
  "Exact installed plugin-author example: assembly, repeated sessions, decoder errors, options, freeze and disposal passed.",
);
