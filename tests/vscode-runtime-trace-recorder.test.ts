import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { importRuntimeInstructionTrace } from "@uttori/asm-disassembler";
import {
  RuntimeTraceFileRecorder,
  type EditorTraceBatch,
} from "../packages/vscode-extension/src/runtime-trace-recorder.js";
import { test } from "./ava-helper.js";

const romContentSha256 = "a".repeat(64);

test("VS Code recorder streams, drains, and closes an importable native trace", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-vscode-trace-"));
  const file = path.join(directory, "capture.json");
  let active = true;
  let first = true;
  let stoppedBatch = true;
  const readTrace = async (): Promise<EditorTraceBatch> => {
    if (first) {
      first = false;
      return {
        architecture: "snes.65816",
        addressSpace: "snes.address-space",
        sequenceStart: 1,
        addresses: [0x808000, 0x808001],
        droppedEvents: 0,
        active: true,
      };
    }
    if (!active && stoppedBatch) {
      stoppedBatch = false;
      return {
        architecture: "snes.65816",
        addressSpace: "snes.address-space",
        sequenceStart: 3,
        addresses: [0x808002],
        droppedEvents: 0,
        active: false,
      };
    }
    return {
      architecture: "snes.65816",
      addressSpace: "snes.address-space",
      sequenceStart: active ? 3 : 4,
      addresses: [],
      droppedEvents: 0,
      active,
    };
  };
  try {
    const recorder = await RuntimeTraceFileRecorder.create({
      file,
      architecture: "snes.65816",
      addressSpace: "snes.address-space",
      romContentSha256,
      producer: { id: "ares", revision: "fixture" },
      maxBatchEvents: 240,
      readTrace,
      stopTrace: () => {
        active = false;
        return Promise.resolve();
      },
    });
    const summary = await recorder.stop();
    t.deepEqual(summary, {
      file,
      chunks: 3,
      observedEvents: 3,
      droppedEvents: 0,
      complete: true,
    });
    const artifact = JSON.parse(await fs.readFile(file, "utf8"));
    const imported = importRuntimeInstructionTrace(artifact, {
      projectRomContentSha256: romContentSha256,
      sourceName: path.basename(file),
      addressSpaceAliases: { "snes.address-space": "snes.cpu" },
    });
    t.is(imported.observedEvents, 3);
    t.is(imported.droppedEvents, 0);
    t.deepEqual(
      imported.batch.runtime.map(({ address }) => address),
      [0x808000, 0x808001, 0x808002],
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("VS Code recorder validates identity before replacing a destination", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-vscode-trace-invalid-"));
  const file = path.join(directory, "capture.json");
  await fs.writeFile(file, "preserve me", "utf8");
  try {
    await t.throwsAsync(
      RuntimeTraceFileRecorder.create({
        file,
        architecture: "snes.65816",
        addressSpace: "snes.address-space",
        romContentSha256: "invalid",
        producer: { id: "ares", revision: "fixture" },
        maxBatchEvents: 240,
        readTrace: async () => {
          throw new Error("unreachable");
        },
        stopTrace: () => Promise.resolve(),
      }),
      { message: /lowercase SHA-256/ },
    );
    t.is(await fs.readFile(file, "utf8"), "preserve me");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
