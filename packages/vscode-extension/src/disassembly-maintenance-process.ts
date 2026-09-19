import { runMaintenanceJob, type MaintenanceJob } from "./disassembly-maintenance-jobs.js";

const cancellation = new AbortController();
let started = false;

export const handleMaintenanceProcessMessage = (
  message: { type: "cancel" } | { type: "run"; job: MaintenanceJob },
  send: (response: unknown, callback?: () => void) => void = (response, callback) =>
    process.send?.(response as Parameters<NonNullable<typeof process.send>>[0], callback),
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
