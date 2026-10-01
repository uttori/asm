import { executeSourceOperation, type SourceOperation } from "@uttori/asm-cli/source";

const cancellation = new AbortController();
let started = false;

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
    const finish = (value: unknown): void => {
      process.send?.(value as Parameters<NonNullable<typeof process.send>>[0], () =>
        process.disconnect?.(),
      );
    };
    void executeSourceOperation({
      ...message.operation,
      signal: cancellation.signal,
      onProgress: (message) => process.send?.({ type: "progress", message }),
    }).then(
      (value) => finish({ type: "result", value }),
      (error) =>
        finish({ type: "error", message: error instanceof Error ? error.message : String(error) }),
    );
  },
);
process.on("disconnect", () => process.exit(0));
