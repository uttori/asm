import { test } from "../../../../tests/ava-helper.js";
import { busPosition } from "../../../../tests/helpers/capture-bus.js";
import type { NativeCaptureFilePosition } from "../../../debug-adapter/src/capture-file.js";
import {
  handleLiveBusProcessMessage,
  runLiveBusAnalysis,
} from "../../src/runtime/live-bus-analysis-process.js";

const position = (bytes: number, n: number): NativeCaptureFilePosition => ({
  ...busPosition(String(n), String(n), "recording"),
  fileState: "writing",
  fileBytes: String(bytes),
  fileBatches: String(n),
});

test("live bus analysis rejects invalid budgets before opening a capture", async (t) => {
  await t.throwsAsync(
    runLiveBusAnalysis({
      type: "start",
      file: "/missing.act2",
      projectDirectory: "/project",
      position: position(0, 0),
      maxLagBytes: 0,
      maxBytes: 1024,
      maxIndexRecords: 10,
    }),
    { message: /Invalid live analysis budgets/ },
  );
});

test("live bus process handler acknowledges positions and ignores preview acks until a start", (t) => {
  const accepted: unknown[] = [];
  const originalSend = process.send;
  process.send = ((message: unknown) => {
    accepted.push(message);
    return true;
  }) as typeof process.send;
  t.teardown(() => {
    process.send = originalSend;
  });
  handleLiveBusProcessMessage({ type: "preview-accepted" });
  handleLiveBusProcessMessage({ type: "position", position: position(10, 1) });
  t.deepEqual(accepted, [{ type: "accepted" }]);
  handleLiveBusProcessMessage({ type: "cancel" });
});
