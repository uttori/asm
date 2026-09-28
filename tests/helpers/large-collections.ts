/** Child-process regressions for input-sized collections, using Node's default native stack. */
import assert from "node:assert/strict";

import { RomImage, type InstructionAnalysisAnnotation } from "@uttori/asm-disassembler";

import { MathCore } from "../../packages/core/src/mathcore.js";
import {
  definePlugin,
  PluginManager,
  PLUGIN_API_VERSION,
} from "../../packages/core/src/plugin/index.js";
import {
  DirectiveRuntimeService,
  type DirectiveRuntimeHost,
} from "../../packages/core/src/services/directive-runtime-service.js";
import {
  SymbolScopeService,
  type SymbolScopeHost,
} from "../../packages/core/src/services/symbol-scope-service.js";
import type { DebugBackendEvent } from "../../packages/debug-adapter/src/contracts.js";
import { DebugAdapterSession } from "../../packages/debug-adapter/src/dap.js";
import { ReplayDebugBackend } from "../../packages/debug-adapter/src/replay-backend.js";
import {
  renderSnesStructDefines,
  validateSnesStructMap,
} from "../../packages/plugin-snes/src/disassembler/struct-map.js";
import {
  analyzeSnes65816,
  analyzeSpc700Aram,
  Spc700AramImage,
  SPC700_ARAM_ADDRESS_SPACE,
} from "../../packages/plugin-snes/src/index.js";
import { formatInstructionAnnotationDetails } from "../../packages/vscode-extension/src/editor-info/format.js";
import { benchmarkStatistics } from "../../scripts/benchmark-report.js";

// Above the default V8 argument-count limit, but small enough for routine CI execution.
const count = 131_072;
const scenarios: Record<string, () => void | Promise<void>> = {
  "numeric-extrema": () => {
    const values = Array.from({ length: count }, (_, index) => index - 100);
    const math = new MathCore();
    assert.equal(math.callBuiltInFunction("min", values), -100);
    assert.equal(math.callBuiltInFunction("max", values), count - 101);
    const statistics = benchmarkStatistics(values);
    assert.equal(statistics.min, -100);
    assert.equal(statistics.max, count - 101);
    assert.equal(values[0], -100);
    assert.equal(values.at(-1), count - 101);

    // Comparison-only folds can accidentally discard NaN or choose the wrong signed zero.
    for (const name of ["min", "max"]) {
      assert.equal(math.callBuiltInFunction(name, [1, NaN, 2]), NaN);
      assert.throws(() => math.callBuiltInFunction(name, [NaN, "invalid"]));
    }
    assert.equal(math.callBuiltInFunction("min", [0, -0]), -0);
    assert.equal(math.callBuiltInFunction("max", [-0, 0]), 0);
    assert.equal(benchmarkStatistics([0, -0]).min, -0);
    assert.equal(benchmarkStatistics([-0, 0]).max, 0);
    assert.equal(benchmarkStatistics([1, NaN, 2]).min, NaN);
    assert.equal(benchmarkStatistics([1, NaN, 2]).max, NaN);
  },
  "data-expansion": () => {
    const values = Array.from({ length: count }, (_, index) => index % 251);
    const list = values.join(",");
    const emitted: number[] = [];
    let estimatedBytes = 0;
    // Exercise the same nested expansion during both layout and emission. Sentinels and a
    // mapped string ensure a stack conversion cannot silently reverse or reorder operands.
    const host = {
      isDefinitionCollectionStage: true,
      collectSourceMetadata: false,
      characterMappings: new Map([["A", 42]]),
      defineEngine: { resolveDefinesInStringLiteral: (value: string) => value },
      structEngine: { hasStructReference: () => false },
      operandResolver: { getnum: Number },
      resolvedefines: (value: string) => {
        if (value === "NEST") {
          return '7,LIST,"AZ",8';
        }
        if (value === "LIST") {
          return list;
        }
        return value;
      },
      step: (bytes: number) => {
        estimatedBytes += bytes;
      },
      write2: (value: number) => {
        emitted.push(value);
      },
    } as unknown as DirectiveRuntimeHost;
    const service = new DirectiveRuntimeService(host);
    service.handleDataDirective("dw", ["9,NEST,10"]);
    host.isDefinitionCollectionStage = false;
    service.handleDataDirective("dw", ["9,NEST,10"]);
    assert.equal(estimatedBytes, (count + 6) * 2);
    assert.equal(emitted.length, count + 6);
    assert.deepEqual(emitted.slice(0, 2), [9, 7]);
    assert.deepEqual(emitted.slice(2, count + 2), values);
    assert.deepEqual(emitted.slice(-4), [42, 90, 8, 10]);
  },
  "local-labels": () => {
    const entries = Array.from({ length: count }, (_, index) => ({ addr: index + 1 }));
    const service = new SymbolScopeService({
      enforceResolvedLabels: true,
      isDefinitionCollectionStage: false,
      inMacroExpansion: false,
      forwardLabels: { 1: entries },
      backwardLabels: { 1: entries },
    } as unknown as SymbolScopeHost);
    assert.equal(service.findNextLabel("+", 0), 1);
    assert.equal(service.findNextLabel("+", 1), 1);
    assert.equal(service.findPreviousLabel("-", count + 1), count);
    assert.equal(service.findPreviousLabel("-", count), count - 1);
    assert.throws(() => service.findNextLabel("+", count + 1), /No \+ label/);
    assert.throws(() => service.findPreviousLabel("-", 1), /No - label/);
  },
  "65816-evidence": () => {
    const evidence = Array.from({ length: count }, (_, index) => `capture:${index}`);
    const bytes = new Uint8Array(0x10000);
    bytes[0] = 0xdb; // STP keeps graph size tiny while provenance grows across captures.
    const result = analyzeSnes65816(new RomImage(bytes), "lorom", {
      entryPoints: [{ id: "main", address: 0x8000 }],
      annotations: [
        {
          id: "captured-state",
          addressSpace: "rom.file",
          start: 0,
          end: 1,
          classification: "opcode",
          architecture: "snes.65816",
          state: { e: false, m: true, x: true },
          evidence,
        },
      ],
    });
    assert.equal(result.status, "complete");
    assert.equal(result.nodes.length, 1);
    const retained = new Set(result.nodes[0].evidence);
    assert.ok(evidence.every((id) => retained.has(id)));
  },
  "spc700-evidence": () => {
    const evidence = Array.from({ length: count }, (_, index) => `capture:${index}`);
    const result = analyzeSpc700Aram(new Spc700AramImage([0xff], 0x200), {
      entryPoints: [{ id: "main", address: 0x200 }],
      annotations: [
        {
          id: "captured-state",
          addressSpace: SPC700_ARAM_ADDRESS_SPACE,
          start: 0x200,
          end: 0x201,
          classification: "opcode",
          architecture: "snes.spc700",
          state: { directPage: 0x100 },
          evidence,
        },
      ],
    });
    assert.equal(result.status, "complete");
    assert.equal(result.nodes.length, 1);
    const retained = new Set(result.nodes[0].evidence);
    assert.ok(evidence.every((id) => retained.has(id)));
  },
  "annotation-details": () => {
    const empty: InstructionAnalysisAnnotation = {
      id: "hot-instruction",
      addressSpace: "cpu",
      address: 0x8000,
      outputOffsets: [],
      architectures: [],
      nodeIds: [],
      effectiveAddresses: [],
      stateTransitions: [],
      stateObservations: [],
      executionCount: 0,
      executionRecordIds: [],
      runtimeCoverage: [],
      memoryAccesses: [],
      evidence: [],
    };
    // Every full-detail section is unbounded. Compare all lines to single-record formatting,
    // retaining distinct observation identities so missing/reordered rows cannot pass.
    for (const field of [
      "runtimeCoverage",
      "effectiveAddresses",
      "memoryAccesses",
      "stateTransitions",
      "stateObservations",
    ] as const) {
      const observations = Array.from({ length: count }, (_, index) => {
        switch (field) {
          case "runtimeCoverage":
            return { coverage: "executed", count: index, recordIds: [], evidence: [] };
          case "effectiveAddresses":
            return {
              operandIndex: 0,
              address: index,
              explanation: "observed",
              nodeIds: [],
              evidence: [],
            };
          case "memoryAccesses":
            return {
              accessedAddressSpace: "wram",
              accessedAddress: 0,
              access: "read",
              width: 1,
              count: index,
              recordIds: [],
              evidence: [],
            };
          case "stateTransitions":
            return { field: `register${index}`, before: 0, after: 1, nodeIds: [], evidence: [] };
          case "stateObservations":
            return {
              source: "runtime",
              state: { a: index },
              count: 1,
              recordIds: [],
              evidence: [],
            };
          default:
            throw new Error(`Unexpected annotation field: ${String(field)}`);
        }
      });
      const annotation = { ...empty, [field]: observations } as InstructionAnalysisAnnotation;
      const lines = formatInstructionAnnotationDetails(annotation).split("\n");
      assert.equal(lines.length, count + 5);
      for (let index = 0; index < count; index++) {
        const single = {
          ...empty,
          [field]: [observations[index]],
        } as InstructionAnalysisAnnotation;
        assert.equal(lines[index + 5], formatInstructionAnnotationDetails(single).split("\n")[5]);
      }
    }
  },
  "plugin-registration": async () => {
    const manager = new PluginManager();
    await manager.activatePlugins([
      {
        plugin: definePlugin({
          manifest: {
            id: "stress",
            name: "Stress",
            version: "1.0.0",
            apiVersion: PLUGIN_API_VERSION,
          },
          activate(context) {
            for (let index = 0; index < count; index++) {
              context.registerSessionState({
                id: `stress.state${index}`,
                create: () => index,
                clone: (value) => value,
              });
            }
          },
        }),
      },
    ]);
    const states = manager.freeze().sessionStates;
    assert.equal(states.length, count);
    assert.equal(new Set(states.map((state) => state.contributionId)).size, count);
    assert.equal(states[0].contributionId, "stress.state0");
    assert.equal(states.at(-1)?.contributionId, `stress.state${count - 1}`);
  },
  "failed-debug-launch": async () => {
    const backend = new ReplayDebugBackend({
      snapshots: [{ threads: [], frames: [], registers: {}, memory: [] }],
    });
    let emit: (event: DebugBackendEvent) => void = () => {
      throw new Error("Listener missing");
    };
    backend.onEvent = (listener) => {
      emit = listener;
      return { dispose() {} };
    };
    backend.connect = async () => {
      // Interleave disposable lifecycle events with a large diagnostic burst. Failure cleanup
      // must keep every output in order and preserve the original launch error.
      for (let index = 0; index < count; index++) {
        if (index % 1000 === 0) {
          emit({ type: "stopped", reason: "entry", threadId: 1 });
        }
        emit({ type: "output", category: "console", text: `diagnostic:${index}` });
      }
      throw new Error("large launch failed");
    };
    const session = new DebugAdapterSession({ backend });
    try {
      const messages = await session.dispatch({ seq: 1, type: "request", command: "launch" });
      assert.equal(messages.length, count + 1);
      const response = messages[0];
      assert.equal(response.type, "response");
      assert.ok("success" in response && !response.success);
      assert.ok("message" in response && response.message === "large launch failed");
      for (let index = 0; index < count; index++) {
        const message = messages[index + 1];
        assert.ok(message.type === "event" && message.event === "output");
        assert.deepEqual(message.body, { category: "console", output: `diagnostic:${index}` });
      }
    } finally {
      session.dispose();
    }
  },
  "struct-notes": () => {
    const notes = Array.from({ length: count }, (_, index) => `note:${index}`);
    const map = validateSnesStructMap({
      format: "uttori-asm-snes-struct-map",
      schemaVersion: 1,
      structures: [
        {
          id: "Record",
          size: 1,
          fields: [{ name: "value", offset: 0, size: 1, type: "db" }],
          notes,
        },
      ],
      bindings: [],
    });
    const lines = renderSnesStructDefines({ ...map, sourceBytes: new Uint8Array() }).split("\n");
    const start = lines.indexOf("; note:0");
    assert.ok(start >= 0);
    assert.deepEqual(
      lines.slice(start, start + count),
      notes.map((note) => `; ${note}`),
    );
    assert.equal(lines[start + count], "struct Record $0");
  },
};

const scenario = process.argv[2];
assert.ok(scenario in scenarios, `Unknown large-collection scenario: ${scenario}`);
await scenarios[scenario]();
process.stdout.write(JSON.stringify({ scenario, items: count }));
