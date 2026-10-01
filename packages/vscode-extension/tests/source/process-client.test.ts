import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import { SourceProcessClient } from "../../src/source/process-client.js";

/** Real child processes exercise IPC serialization, orderly exit, and cancellation of synchronous work. */
function fixture(source: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-source-worker-"));
  const file = path.join(root, "worker.mjs");
  fs.writeFileSync(file, source);
  const client = new SourceProcessClient(file);
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
  t.deepEqual(progress, ["Assembling"]);
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
          if (message === "Started") {
            abort.abort();
          }
        },
      },
    ),
    { message: /Check Source status before retrying/ },
  );
});
