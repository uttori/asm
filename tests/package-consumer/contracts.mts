import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { Assembler, MemoryAssemblyFileProvider } from "@uttori/asm-core";
import type { AssemblerOptions } from "@uttori/asm-core";
import { PluginError, PluginManager } from "@uttori/asm-core/plugin";
import { NodePluginLoader } from "@uttori/asm-plugin-loader-node";
import type { LoadProjectEnvironmentOptions } from "@uttori/asm-plugin-loader-node";

import plugin, {
  events,
  escapedCapability,
  escapedParsedOperand,
  sawMacroOrigin,
} from "./contract-plugin.mjs";

const manager = new PluginManager();
try {
  await manager.activatePlugins([{ plugin, options: { start: 5 } }]);
  const environment = manager.freeze();
  assert.equal(manager.freeze(), environment);
  const options = {
    environment,
    target: "consumer.target",
    fileProvider: new MemoryAssemblyFileProvider({ "included.asm": "tick\ntick" }),
  } satisfies AssemblerOptions;
  // Independent sessions share contributions but must never share the counter's live state.
  for (let index = 0; index < 2; index++) {
    const session = new Assembler(options);
    try {
      session.assembleSource(
        'org 0\nmark\nmacro Mark()\nmark\nendmacro\n%Mark()\nincsrc "included.asm"',
        "main.asm",
      );
      assert.deepEqual([...session.getBinaryOutput()], [5, 6]);
      assert.throws(escapedCapability, /borrow|callback|active/i);
      assert.throws(escapedParsedOperand, /borrow|callback|active/i);
      assert.equal(sawMacroOrigin, true);
    } finally {
      session.dispose();
    }
  }
  await assert.rejects(manager.activatePlugins([]), { code: "PLUGIN_ACTIVATION_FAILED" });
} finally {
  await manager.dispose();
}
assert.deepEqual(events, [
  // Construction enters the definitions stage once before an explicit build begins.
  "collectDefinitions",
  "collectDefinitions",
  "resolveLayout",
  "emitProgram",
  "session-dispose",
  "state-dispose",
  "collectDefinitions",
  "collectDefinitions",
  "resolveLayout",
  "emitProgram",
  "session-dispose",
  "state-dispose",
  "plugin-dispose",
]);

const loader = new NodePluginLoader();
try {
  const options = {
    cwd: process.cwd(),
    pluginModules: [{ module: "./compiled/contract-plugin.mjs", options: { start: 7 } }],
    overrides: { pluginOptions: { "consumer.counter": { start: 9 } } },
  } satisfies LoadProjectEnvironmentOptions;
  const loaded = await loader.loadProjectEnvironment(options);
  const session = new Assembler({ environment: loaded.environment, target: loaded.target });
  try {
    session.setIncludePaths([...loaded.includePaths]);
    session.assembleSource("org 0\ntick\ntick", "main.asm");
    assert.deepEqual([...session.getBinaryOutput()], [9, 10]);
  } finally {
    session.dispose();
  }
  await assert.rejects(
    loader.loadProjectEnvironment({
      ...options,
      overrides: { pluginOptions: { "consumer.counter": { start: 1000 } } },
    }),
    (error: unknown) =>
      error instanceof PluginError && error.code === "PLUGIN_CONFIGURATION_INVALID",
  );
} finally {
  await loader.dispose();
}
console.log(
  "Installed TypeScript plugin: options, isolated state, stages, includes, loading, and disposal passed",
);

// Exercise actual installed-plugin snapshots outside instrumentation and test-runner workers.
const benchmarkManager = new PluginManager();
try {
  await benchmarkManager.activatePlugins([{ plugin, options: { start: 5 } }]);
  const environment = benchmarkManager.freeze();
  const typedSession = new Assembler({ environment, target: "consumer.target" });
  try {
    const program = typedSession.buildProgramModel(
      "org 0\nMain: db 2 * (3 + 4)\ntypedmark 42",
      "typed.asm",
    );
    typedSession.assembleProgram(JSON.parse(JSON.stringify(program)));
    assert.deepEqual([...typedSession.getBinaryOutput()], [14, 42]);
    typedSession.assembleProgram(program);
    assert.deepEqual([...typedSession.getBinaryOutput()], [14, 42]);
  } finally {
    typedSession.dispose();
  }
  const source = "org 0\n" + "mark\n".repeat(512);
  const wallMs: number[] = [];
  let retainedSyntaxBytes = 0;
  for (let sample = 0; sample < 8; sample++) {
    const start = performance.now();
    const session = new Assembler({ environment, target: "consumer.target" });
    try {
      session.assembleSource(source, "plugin-snapshots.asm");
      assert.equal(session.getBinaryOutput().length, 0);
      wallMs.push(performance.now() - start);
      if (sample === 7) {
        retainedSyntaxBytes = Buffer.byteLength(
          JSON.stringify(session.buildProgramModel(source, "plugin-snapshots.asm")),
        );
      }
    } finally {
      session.dispose();
    }
  }
  console.log(
    "AST_INSTALLED_PLUGIN_BENCHMARK " +
      JSON.stringify({
        node: process.version,
        instrumentation: false,
        sourceSha256: createHash("sha256").update(source).digest("hex"),
        directives: 512,
        stages: 3,
        wallMs,
        retainedSyntaxBytes,
        peakRssBytes: process.resourceUsage().maxRSS * 1024,
      }),
  );
} finally {
  await benchmarkManager.dispose();
}
