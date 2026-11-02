import somPlugin from "@uttori/asm-game-secret-of-mana";
import { executeSourceOperation } from "@uttori/asm-game-secret-of-mana/source-host";
import {
  executeAssetOperation,
  executeAssetSourceOperation,
} from "@uttori/asm-game-secret-of-mana/workflows";
import { type AssetOperation } from "@uttori/asm-workflows/asset-interchange";
import { type AssetSourceOperation } from "@uttori/asm-workflows/asset-source";
import {
  createAssemblyBuildHost,
  executeAssemblyBuildOperation,
  type AssemblyBuildOperation,
} from "@uttori/asm-workflows/build";
import { SourceOperationError } from "@uttori/asm-workflows/source";
import { type SourceOperation } from "@uttori/asm-workflows/source";

const cancellation = new AbortController();
const assemblyHost = createAssemblyBuildHost([["@uttori/asm-game-secret-of-mana", somPlugin]]);
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

/** Explicit action names keep ordinary source operations on their existing dispatcher. */
function isAssemblyBuildOperation(
  operation: SourceOperation | AssetOperation | AssetSourceOperation | AssemblyBuildOperation,
): operation is AssemblyBuildOperation {
  return ["assemble-object", "library", "link", "build-linked"].includes(operation.action);
}

/** One isolated operation per process; SQLite and native Git own recovery after an interrupted writer. */
process.on(
  "message",
  (
    message:
      | { type: "cancel" }
      | { type: "publish-confirm"; error?: string }
      | {
          type: "run";
          operation:
            | SourceOperation
            | AssetOperation
            | AssetSourceOperation
            | AssemblyBuildOperation;
        },
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
    if (isAssemblyBuildOperation(message.operation)) {
      operation = executeAssemblyBuildOperation(
        message.operation,
        {
          signal: cancellation.signal,
          onProgress: (progress) => process.send?.({ type: "progress", message: progress }),
          beforePublish,
        },
        assemblyHost,
      );
    } else if (
      message.operation.action === "asset-convert" ||
      message.operation.action === "asset-conversion-finish" ||
      message.operation.action === "asset-source-target"
    ) {
      process.send?.({ type: "progress", message: "Resolving saved asset source." });
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
      (error) => {
        let code = cancellation.signal.aborted ? "cancelled" : "failed";
        if (error instanceof SourceOperationError) {
          code = error.code;
        }
        finish({
          type: "error",
          code,
          message: error instanceof Error ? error.message : String(error),
        });
      },
    );
  },
);
process.on("disconnect", () => process.exit(0));
