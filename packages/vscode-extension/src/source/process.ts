import { executeAssetOperation, type AssetOperation } from "@uttori/asm-cli/asset-interchange";
import {
  executeAssetSourceOperation,
  type AssetSourceOperation,
} from "@uttori/asm-cli/asset-source";
import { executeSourceOperation, type SourceOperation } from "@uttori/asm-cli/source";

const cancellation = new AbortController();
let started = false;
let publication: { resolve(): void; reject(error: Error): void } | undefined;

const finish = (value: unknown): void => {
  process.send?.(value, () => process.disconnect?.());
};

/** Wait for a live editor-version check after native validation; disconnected or cancelled hosts cannot authorize writes. */
const beforePublish = (paths: readonly string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    cancellation.signal.throwIfAborted();
    if (!process.connected || publication) {
      reject(new Error("Asset publication coordinator unavailable."));
      return;
    }
    const timeout = setTimeout(
      () => settle(new Error("Asset publication check timed out.")),
      30000,
    );
    const settle = (error?: Error): void => {
      clearTimeout(timeout);
      publication = undefined;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    publication = { resolve: () => settle(), reject: (error) => settle(error) };
    process.send?.({ type: "publish-check", paths });
  });

function isAssetOperation(
  operation: SourceOperation | AssetOperation | AssetSourceOperation,
): operation is AssetOperation {
  return (
    operation.action === "asset-export" ||
    operation.action === "asset-review" ||
    operation.action === "asset-apply" ||
    operation.action === "asset-recover" ||
    operation.action === "asset-cleanup"
  );
}

/** One isolated operation per process; SQLite and native Git own recovery after an interrupted writer. */
process.on(
  "message",
  (
    message:
      | { type: "cancel" }
      | { type: "publish-confirm"; error?: string }
      | { type: "run"; operation: SourceOperation | AssetOperation | AssetSourceOperation },
  ) => {
    if (message.type === "cancel") {
      cancellation.abort();
      publication?.reject(new Error("Asset publication cancelled."));
      return;
    }
    if (message.type === "publish-confirm") {
      if (message.error) {
        publication?.reject(new Error(message.error));
      } else {
        publication?.resolve();
      }
      return;
    }
    if (started) {
      return;
    }
    started = true;
    let operation: Promise<unknown>;
    if (
      message.operation.action === "asset-convert" ||
      message.operation.action === "asset-conversion-finish" ||
      message.operation.action === "asset-source-target"
    ) {
      operation = executeAssetSourceOperation(message.operation, {
        signal: cancellation.signal,
        beforePublish,
      });
    } else if (isAssetOperation(message.operation)) {
      operation = executeAssetOperation(message.operation, {
        signal: cancellation.signal,
        beforePublish,
      });
    } else {
      operation = executeSourceOperation({
        ...message.operation,
        signal: cancellation.signal,
        onProgress: (progress) => process.send?.({ type: "progress", message: progress }),
      });
    }
    void operation.then(
      (value) => finish({ type: "result", value }),
      (error) =>
        finish({ type: "error", message: error instanceof Error ? error.message : String(error) }),
    );
  },
);
process.on("disconnect", () => process.exit(0));
