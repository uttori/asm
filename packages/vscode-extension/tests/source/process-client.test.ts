import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  readAssetExportManifest,
  readAssetImportReview,
} from "@uttori/asm-workflows/asset-interchange/public-records";
import sinon from "sinon";

import { test } from "../../../../tests/ava-helper.js";
import {
  readBuildCoverage,
  checkBuildCoverageFreshness,
} from "../../src/analysis/build-coverage.js";
import { SourceProcessClient } from "../../src/source/process-client.js";
import { readGenerationCommit, readMergePreview } from "../../src/source/result-readers.js";

test("bundled source worker prepares and previews a verified generation", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-worker-generation-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "project");
  const rom = path.join(root, "original.sfc");
  const bytes = Buffer.alloc(0x8000);
  bytes[0] = 0xdb;
  for (let offset = 0x7fe0; offset < bytes.length; offset += 2) {
    bytes.writeUInt16LE(0x8000, offset);
  }
  fs.writeFileSync(rom, bytes);
  const client = new SourceProcessClient(
    process.env.UTTORI_TEST_SOURCE_WORKER ??
      path.resolve("packages/vscode-extension/out/source-process.mjs"),
  );
  t.teardown(() => client.dispose());
  await client.run({ action: "init", directory, rom, mapper: "lorom" }, { maxMemoryMiB: 512 });
  await client.run({ action: "build", directory }, { maxMemoryMiB: 512 });
  const snapshot = await readBuildCoverage(directory);
  t.truthy(snapshot?.summary.coverage);
  t.true(fs.statSync(path.join(directory, ".uttori-local/builds/summary.json")).size < 1024);
  t.is((await checkBuildCoverageFreshness(directory, snapshot!.summary)).status, "current");
  const prepared = await client.run(
    { action: "prepare", directory },
    {
      maxMemoryMiB: 512,
      readResult: readGenerationCommit,
    },
  );
  const preview = await client.run(
    { action: "preview", directory, candidate: prepared.generation.commit },
    {
      maxMemoryMiB: 512,
      readResult: readMergePreview,
    },
  );
  t.deepEqual(preview.conflicts, []);
  t.truthy(preview.resultTree);
});

test("installed asset worker fingerprints its executable without development dependencies", async (t) => {
  const { spriteSourceFixture } = await import("../../../../tests/fixtures/sprite-source.js");
  const project = await spriteSourceFixture(t.teardown);
  const installed = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-installed-asset-worker-"));
  const worker = path.join(installed, "source-process.mjs");
  fs.copyFileSync(path.resolve("packages/vscode-extension/out/source-process.mjs"), worker);
  fs.copyFileSync(
    path.resolve("packages/vscode-extension/package.json"),
    path.join(installed, "package.json"),
  );
  const client = new SourceProcessClient(worker);
  t.teardown(() => {
    client.dispose();
    fs.rmSync(installed, { recursive: true, force: true });
  });
  const selection = path.join(project.directory, ".uttori-local/selection.json");
  const document = path.join(project.directory, ".uttori-local/editor.aseprite");
  const manifest = document + ".json";
  fs.writeFileSync(selection, JSON.stringify(project.selection));
  const exported = await client.run(
    {
      action: "asset-export",
      directory: project.directory,
      adapter: "som.sprite.native",
      selection,
      document,
      manifest,
    },
    { maxMemoryMiB: 512, readResult: readAssetExportManifest },
  );
  t.is(exported.codec.id, "aseprite.indexed-structure");
  const operation = {
    action: "asset-review" as const,
    directory: project.directory,
    document,
    manifest,
  };
  const reviewed = await client.run(operation, {
    maxMemoryMiB: 512,
    readResult: readAssetImportReview,
  });
  t.deepEqual(reviewed.files, []);
  // Self-contained does not mean version-only: changing installed executable bytes invalidates an export.
  fs.appendFileSync(worker, "\n// changed executable identity\n");
  await t.throwsAsync(client.run(operation, { maxMemoryMiB: 512 }), {
    message: /re-export is required/i,
  });
});

/** Real child processes exercise IPC serialization, orderly exit, and cancellation of synchronous work. */
function fixture(
  source: string,
  log?: (message: string) => void,
  limits?: ConstructorParameters<typeof SourceProcessClient>[2],
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-source-worker-"));
  const file = path.join(root, "worker.mjs");
  fs.writeFileSync(file, source);
  const client = new SourceProcessClient(file, log, limits);
  return {
    client,
    cleanup: () => {
      client.dispose();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

test("source process admission is bounded and disposal settles active work permanently", async (t) => {
  const { client, cleanup } = fixture("process.on('message', () => {});", undefined, {
    maxConcurrent: 1,
  });
  t.teardown(cleanup);
  const active = t.throwsAsync(
    client.run({ action: "status", directory: "/fixture" }, { maxMemoryMiB: 128 }),
  );
  await t.throwsAsync(
    client.run({ action: "build", directory: "/fixture" }, { maxMemoryMiB: 128 }),
    { message: /capacity/ },
  );
  client.dispose();
  await active;
  await t.throwsAsync(
    client.run({ action: "status", directory: "/fixture" }, { maxMemoryMiB: 128 }),
    { message: /disposed/ },
  );
});

test("malformed source messages reject without crashing the host", async (t) => {
  const { client, cleanup } = fixture("process.on('message', () => process.send(null));");
  t.teardown(cleanup);
  await t.throwsAsync(
    client.run({ action: "status", directory: "/fixture" }, { maxMemoryMiB: 128 }),
    { message: /Malformed source worker/ },
  );
});

test.serial(
  "worker progress extends the inactivity deadline across a long capture queue",
  async (t) => {
    const clock = sinon.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    t.teardown(() => clock.restore());
    const logs: string[] = [];
    const { client, cleanup } = fixture(
      `process.on('message', () => {
    for (let i=0;i<4;i++) process.send({type:'progress',message:'Capture '+i+': Merging facts'});
    process.send({type:'result',value:'committed'},()=>process.disconnect());
  });`,
      (message) => logs.push(message),
    );
    t.teardown(cleanup);
    const result = await client.run(
      { action: "import", directory: "/fixture", captures: ["one.act2", "two.act2"] },
      {
        maxMemoryMiB: 128,
        onProgress: (message) => {
          if (message.includes(": Capture ")) {
            clock.tick(20 * 60_000);
          }
        },
      },
    );
    t.is(result, "committed");
    t.false(logs.some((message) => message.includes("Cancelling")));
    t.true(logs.some((message) => message.includes("completed in 4800.0s")));
    t.is(clock.countTimers(), 0);
  },
);

test("a worker without progress still expires and preserves the recovery diagnostic", async (t) => {
  const logs: string[] = [];
  const { client, cleanup } = fixture(
    "process.on('message',()=>{while(true){}});",
    (message) => logs.push(message),
    { timeoutMs: 100 },
  );
  t.teardown(cleanup);
  await t.throwsAsync(
    client.run(
      { action: "import", directory: "/fixture", capture: "one.act2" },
      { maxMemoryMiB: 128 },
    ),
    {
      message: /Check Source status before retrying/,
    },
  );
  t.true(logs.some((message) => message.includes("no progress for 100 ms")));
});

test("source workers retain buffer bytes and report progress before a completed result", async (t) => {
  const { client, cleanup } = fixture(`process.on('message', ({operation}) => {
    process.send({type:'progress',message:'Assembling'});
    process.send({type:'result',value:Array.from(operation.overlays[0].bytes)}, () => process.disconnect());
  });`);
  t.teardown(cleanup);
  const progress: string[] = [];
  const result = await client.run(
    {
      action: "preview",
      candidate: "a".repeat(40),
      directory: "/fixture",
      overlays: [{ path: "bank.asm", bytes: Uint8Array.from([0, 128, 255]) }],
    },
    { maxMemoryMiB: 128, onProgress: (message) => progress.push(message) },
  );
  t.deepEqual(result, [0, 128, 255]);
  t.is(progress.length, 1);
  t.regex(progress[0], /^\d+\.\d+s: Assembling$/);
});

test.serial(
  "quiet synchronous workers retain the capture filename and show parent status until completion",
  async (t) => {
    const clock = sinon.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    t.teardown(() => clock.restore());
    const logs: string[] = [];
    const { client, cleanup } = fixture(
      `process.on('message', () => {
    process.send({type:'progress',message:'Import /captures/large.act2: Merging facts.'});
    const started = performance.now();
    while (performance.now() - started < 100) {}
    process.send({type:'result',value:'committed'}, () => process.disconnect());
  });`,
      (message) => logs.push(message),
    );
    t.teardown(cleanup);
    const progress: string[] = [];
    const result = await client.run(
      { action: "import", directory: "/fixture", capture: "/captures/large.act2" },
      {
        maxMemoryMiB: 128,
        onProgress: (message) => {
          progress.push(message);
          if (message === "0.0s: Import /captures/large.act2: Merging facts.") {
            clock.tick(30_000);
          }
        },
      },
    );
    t.is(result, "committed");
    t.is(progress.length, 4);
    t.regex(
      progress[3],
      /^30\.0s: Waiting for worker \d+; last progress update 30s ago. Import \/captures\/large.act2: Merging facts\.$/,
    );
    t.true(
      logs.some(
        (message) => message.includes("completed in 30.0s") && message.includes("large.act2"),
      ),
    );
    clock.tick(30_000);
    t.is(progress.length, 4);
  },
);

test.serial("worker failure logs the filename and clears quiet-phase status timers", async (t) => {
  const clock = sinon.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  t.teardown(() => clock.restore());
  const logs: string[] = [];
  const { client, cleanup } = fixture(
    `process.on('message', () => {
    process.send({type:'progress',message:'Import /captures/bad.act2: Validating archive.'}, () => process.exit(1));
  });`,
    (message) => logs.push(message),
  );
  t.teardown(cleanup);
  const progress: string[] = [];
  await t.throwsAsync(
    client.run(
      { action: "import", directory: "/fixture", capture: "/captures/bad.act2" },
      {
        maxMemoryMiB: 128,
        onProgress: (message) => progress.push(message),
      },
    ),
    { message: /Source operation exited/ },
  );
  t.true(logs.some((message) => message.includes("failed after") && message.includes("bad.act2")));
  clock.tick(30_000);
  t.is(progress.length, 1);
});

test("cancelling a synchronous source worker releases the editor with an honest recovery diagnostic", async (t) => {
  const { client, cleanup } = fixture(
    "process.on('message', () => { process.send({type:'progress',message:'Started'}); while (true) {} });",
  );
  t.teardown(cleanup);
  const abort = new AbortController();
  await t.throwsAsync(
    client.run(
      { action: "analyze", directory: "/fixture" },
      {
        maxMemoryMiB: 128,
        signal: abort.signal,
        onProgress: (message) => {
          if (message.endsWith("Started")) {
            abort.abort();
          }
        },
      },
    ),
    { message: /Check Source status before retrying/ },
  );
});

for (const allow of [true, false]) {
  test(`asset workers ${allow ? "publish after" : "preserve sources when rejecting"} a live editor-version acknowledgment`, async (t) => {
    const { client, cleanup } = fixture(`process.on('message', (message) => {
      if(message.type === 'run') process.send({type:'publish-check',paths:['/fixture/source/pixels.png']});
      else if(message.type === 'publish-confirm') process.send(message.error ? {type:'error',message:message.error} : {type:'result',value:'published'}, () => process.disconnect());
    });`);
    t.teardown(cleanup);
    const run = client.run(
      {
        action: "asset-apply",
        directory: "/fixture",
        document: "/saved.aseprite",
        manifest: "/manifest.json",
        review: "a".repeat(64),
      },
      {
        maxMemoryMiB: 128,
        onBeforePublish: (paths) => {
          t.deepEqual(paths, ["/fixture/source/pixels.png"]);
          if (!allow) {
            throw new Error("Opaque draft changed; review again.");
          }
        },
      },
    );
    if (allow) {
      t.is(await run, "published");
    } else {
      await t.throwsAsync(run, { message: /Opaque draft changed/ });
    }
  });
}

test("committed warning identity survives process transport", async (t) => {
  const { client, cleanup } = fixture(
    "process.on('message',()=>process.send({type:'error',code:'committed-with-warning',message:'Catalog publication failed after evidence commit'},()=>process.disconnect()));",
  );
  t.teardown(cleanup);
  const error = await t.throwsAsync(
    client.run(
      { action: "import", directory: "/fixture", capture: "/fixture/capture.act2" },
      { maxMemoryMiB: 128 },
    ),
  );
  t.is(Reflect.get(error, "code"), "committed-with-warning");
});

test("an orderly durable result wins cancellation racing the child commit", async (t) => {
  const { client, cleanup } = fixture(`process.on('message',message=>{
    if(message.type!=='run') return;
    process.send({type:'progress',message:'Committed'});
    setTimeout(()=>process.send({type:'result',value:{committed:true}},()=>process.disconnect()),50);
  });`);
  t.teardown(cleanup);
  const cancellation = new AbortController();
  const result = await client.run(
    { action: "build", directory: "/fixture" },
    {
      maxMemoryMiB: 128,
      signal: cancellation.signal,
      onProgress: (message) => {
        if (message.endsWith("Committed")) {
          cancellation.abort();
        }
      },
    },
  );
  t.deepEqual(result, { committed: true });
});
