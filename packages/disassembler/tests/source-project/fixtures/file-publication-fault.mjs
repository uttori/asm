import path from "node:path";

import { applySourceFileTransaction } from "../../../src/source-project/file-transaction.ts";

const [root, boundary] = process.argv.slice(2);
const repository = {
  root,
  gitDirectory: path.join(root, ".git"),
  stateDirectory: path.join(root, ".git/state"),
};
applySourceFileTransaction(
  repository,
  [
    { path: "one.bin", before: Uint8Array.of(1), after: Uint8Array.of(3) },
    { path: "two.bin", before: Uint8Array.of(2), after: Uint8Array.of(4) },
  ],
  {
    onStage(stage) {
      // Terminate the disposable fixture process without exception cleanup to exercise durable crash recovery.
      if (stage === boundary) {
        process.kill(process.pid, "SIGKILL");
      }
    },
  },
);
