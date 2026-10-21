import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-jsonrpc/node";

import { runWithInternalInstrumentation } from "../packages/core/src/internal-instrumentation.js";
import { MathCore } from "../packages/core/src/mathcore.js";

const hash = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const percentile = (values: readonly number[], fraction: number): number =>
  values.toSorted((a, b) => a - b)[
    Math.min(values.length - 1, Math.floor(values.length * fraction))
  ];
const expressions = Array.from({ length: 128 }, (_, i) => `(${i} + 3) * 7 / 2 + (5 << 2)`);
// Independent arithmetic oracle and the frozen pre-A1 scanner work count (128 × 100).
const values = expressions.map((_expression, index) => ((index + 3) * 7) / 2 + 20);
const legacyParsingPasses = 12800;
const math = new MathCore();
const measured = runWithInternalInstrumentation(() => {
  for (let repeat = 0; repeat < 100; repeat++) {
    for (const [index, expression] of expressions.entries()) {
      assert.equal(math.math(expression), values[index]);
    }
  }
});
const server = path.resolve("packages/language-server/out/server.mjs");
const samples: {
  coldMs: number;
  editToFreshMs: number;
  editToDiagnosticsMs: number;
  completionP50Ms: number;
  completionP95Ms: number;
  hoverP95Ms: number;
  requests: number;
  staleNotifications: number;
}[] = [];
const source =
  "org $808000\n" +
  Array.from({ length: 2000 }, (_, i) => `Symbol${i}:\nnop`).join("\n") +
  "\nlda Symbol1\n";
for (let sample = 0; sample < 3; sample++) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-lsp-latency-"));
  const file = path.join(root, "main.asm"),
    uri = pathToFileURL(file).href;
  fs.writeFileSync(file, source);
  const child = spawn(process.execPath, [server, "--stdio"], { stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const connection = createMessageConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin),
  );
  let fresh = false,
    editing = false,
    staleNotifications = 0;
  let lastDiagnosticsAt: number | undefined;
  connection.onNotification("textDocument/publishDiagnostics", (value: unknown) => {
    if (typeof value === "object" && value !== null && "uri" in value && value.uri === uri) {
      lastDiagnosticsAt = performance.now();
    }
  });
  connection.onNotification("asm/indexUpdated", (value: unknown) => {
    if (typeof value !== "object" || value === null || !("stale" in value)) {
      return;
    }
    if (value.stale === true) {
      staleNotifications++;
      fresh = false;
    } else if (editing) {
      fresh = true;
    }
  });
  connection.listen();
  const request = async (method: string, params?: unknown): Promise<unknown> => {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        connection.sendRequest(method, params),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(`Timed out: ${method}: ${stderr}`)), 30000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  console.log(`Sample ${sample + 1}: initialize`);
  try {
    const started = performance.now();
    await request("initialize", {
      processId: process.pid,
      rootUri: pathToFileURL(root).href,
      workspaceFolders: [{ uri: pathToFileURL(root).href, name: "benchmark" }],
      capabilities: {},
      initializationOptions: {
        owningRoot: pathToFileURL(root).href,
        workspaceTrusted: true,
        target: "snes.sfc",
        entryPoints: [file],
      },
    });
    const coldMs = performance.now() - started;
    console.log(`Sample ${sample + 1}: cold ${coldMs.toFixed(1)}ms`);
    await connection.sendNotification("initialized", {});

    await connection.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId: "asm", version: 1, text: source },
    });
    const completions: number[] = [],
      hovers: number[] = [];
    const query = async (): Promise<void> => {
      let start = performance.now();
      const result = await request("textDocument/completion", {
        textDocument: { uri },
        position: { line: 1, character: 0 },
      });
      assert.ok(
        Array.isArray(result) && result.length > 0,
        "Previous snapshot must serve completions during reindex",
      );
      completions.push(performance.now() - start);
      start = performance.now();
      await request("textDocument/hover", {
        textDocument: { uri },
        position: { line: 4001, character: 6 },
      });
      hovers.push(performance.now() - start);
    };
    editing = true;
    let editedAt = performance.now();
    for (let revision = 2; revision <= 9; revision++) {
      editedAt = performance.now();
      await connection.sendNotification("textDocument/didChange", {
        textDocument: { uri, version: revision },
        contentChanges: [{ text: source + `Latest${revision}:\nnop\n` }],
      });

      await query();

      await delay(20);
    }
    while (true) {
      if (fresh) {
        break;
      }
      await query();
      await delay(10);
      if (performance.now() - editedAt > 30000) {
        throw new Error(`Index benchmark timed out: ${stderr}`);
      }
    }
    const editToFreshMs = performance.now() - editedAt;
    // The server publishes this snapshot's diagnostics before its fresh notification on one stream.
    assert.ok(lastDiagnosticsAt !== undefined && lastDiagnosticsAt >= editedAt);
    const editToDiagnosticsMs = lastDiagnosticsAt - editedAt;
    const symbols: unknown = await request("textDocument/documentSymbol", {
      textDocument: { uri },
    });
    assert.ok(JSON.stringify(symbols).includes("Latest9"), "Only the latest edit may publish");
    samples.push({
      coldMs,
      editToFreshMs,
      editToDiagnosticsMs,
      completionP50Ms: percentile(completions, 0.5),
      completionP95Ms: percentile(completions, 0.95),
      hoverP95Ms: percentile(hovers, 0.95),
      requests: completions.length + hovers.length,
      staleNotifications,
    });
    await request("shutdown");
    await connection.sendNotification("exit");
  } catch (error) {
    throw new Error(`${String(error)}\n${stderr}`, { cause: error });
  } finally {
    connection.dispose();
    child.kill();
    fs.rmSync(root, { recursive: true, force: true });
  }
}
const result = {
  version: 1,
  node: process.version,
  serverSha256: hash(fs.readFileSync(server)),
  sourceSha256: hash(source),
  workload: { labels: 2000, editBurst: 8, debounceMs: 500, samples: 3 },
  expressions: {
    inputSha256: hash(expressions.join("\n")),
    evaluations: 12800,
    legacyParsingPasses,
    parses: measured.metrics.counters.expressionParses,
    parserCalls: measured.metrics.counters.expressionParserCalls,
    instrumentationParses: measured.metrics.counters.expressionInstrumentationParses,
    legacyEvaluations: measured.metrics.counters.expressionLegacyEvaluations,
    boundaries: measured.metrics.expressionBoundaries,
    parseCacheHits: measured.metrics.counters.expressionParseCacheHits,
    rawFallbacks: measured.metrics.counters.expressionRawFallbackEvaluations,
    valuesSha256: hash(JSON.stringify(values)),
  },
  samples,
};
const output = process.argv[2] ?? "docs/package-contract-benchmarks-2026-10-17.json";
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
