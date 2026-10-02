import { executeSourceOperation, type SourceOperation } from "@uttori/asm-cli/source";

const cancellation = new AbortController();
let started = false;

const finish = (value: unknown): void => {
  process.send?.(value, () => process.disconnect?.());
};

/** One isolated operation per process; SQLite and native Git own recovery after an interrupted writer. */
process.on(
  "message",
  (message: { type: "cancel" } | { type: "run"; operation: SourceOperation }) => {
    if (message.type === "cancel") {
      cancellation.abort();
      return;
    }
    if (started) {
      return;
    }
    started = true;
    void executeSourceOperation({
      ...message.operation,
      signal: cancellation.signal,
      onProgress: (progress) => process.send?.({ type: "progress", message: progress }),
    }).then(
      (value) => finish({ type: "result", value }),
      (error) =>
        finish({ type: "error", message: error instanceof Error ? error.message : String(error) }),
    );
  },
);
process.on("disconnect", () => process.exit(0));
