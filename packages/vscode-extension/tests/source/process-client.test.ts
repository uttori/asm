import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import sinon from "sinon";

import { test } from "../../../../tests/ava-helper.js";
import { SourceProcessClient } from "../../src/source/process-client.js";

/** Real child processes exercise IPC serialization, orderly exit, and cancellation of synchronous work. */
function fixture(source: string, log?: (message: string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-source-worker-"));
  const file = path.join(root, "worker.mjs");
  fs.writeFileSync(file, source);
  const client = new SourceProcessClient(file, log);
  return {
    client,
    cleanup: () => {
      client.dispose();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

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
      directory: "/fixture",
      overlays: [{ path: "bank.asm", bytes: Uint8Array.from([0, 128, 255]) }],
    },
    { maxMemoryMiB: 128, onProgress: (message) => progress.push(message) },
  );
  t.deepEqual(result, [0, 128, 255]);
  t.is(progress.length, 1);
  t.regex(progress[0], /^\[\d+\.\d+s] Assembling$/);
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
          if (message === "[0.0s] Import /captures/large.act2: Merging facts.") {
            clock.tick(30_000);
          }
        },
      },
    );
    t.is(result, "committed");
    t.is(progress.length, 4);
    t.regex(
      progress[3],
      /^\[30.0s] Waiting for worker \d+; last progress update 30s ago. Import \/captures\/large.act2: Merging facts\.$/,
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
