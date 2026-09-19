import type { Serializable } from "node:child_process";

import { runMaintenanceJob, type MaintenanceJob } from "./disassembly-maintenance-jobs.js";

const cancellation = new AbortController();
let started = false;

/**
 * Starts at most one maintenance job per child and keeps cancellation responsive.
 * The final response is flushed before disconnect; progress messages need no callback.
 * @param {object} message Parent run/cancel request.
 * @param {Function} send IPC writer, injectable for process-lifecycle tests.
 * @returns {void}
 */
export const handleMaintenanceProcessMessage = (
  message: { type: "cancel" } | { type: "run"; job: MaintenanceJob },
  send: (response: unknown, callback?: () => void) => void = (response, callback) => {
    const payload = response as Serializable;
    if (callback) {
      process.send?.(payload, callback);
    } else {
      process.send?.(payload);
    }
  },
): void => {
  if (message.type === "cancel") {
    cancellation.abort();
    return;
  }
  if (started) {
    return;
  }
  started = true;
  const finish = (response: unknown): void => {
    send(response, () => process.disconnect?.());
  };
  void runMaintenanceJob(message.job, cancellation.signal, (progress) =>
    send({ type: "progress", progress }),
  ).then(
    (value) => finish({ type: "result", value }),
    (error: unknown) =>
      finish({
        type: "error",
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack, name: error.name }
            : { message: String(error) },
      }),
  );
};

// A parent shutdown must not leave a detached maintenance process behind.
if (typeof process.send === "function") {
  process.on("disconnect", () => process.exit(0));
  process.on("message", handleMaintenanceProcessMessage);
}
