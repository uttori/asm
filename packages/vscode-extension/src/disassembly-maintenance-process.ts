import { runMaintenanceJob, type MaintenanceJob } from "./disassembly-maintenance-jobs.js";

const cancellation = new AbortController();
let started = false;
// A parent shutdown must not leave a detached maintenance process behind.
process.on("disconnect", () => process.exit(0));
process.on("message", (message: { type: "cancel" } | { type: "run"; job: MaintenanceJob }) => {
  if (message.type === "cancel") {
    cancellation.abort();
    return;
  }
  if (started) return;
  started = true;
  const finish = (response: unknown): void => {
    process.send?.(response, () => process.disconnect?.());
  };
  void runMaintenanceJob(message.job, cancellation.signal, (progress) =>
    process.send?.({ type: "progress", progress }),
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
});
