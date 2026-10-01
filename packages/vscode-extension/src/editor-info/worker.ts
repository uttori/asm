import { parentPort } from "node:worker_threads";

import { EditorInformationProvider } from "./provider.js";

if (!parentPort) {
  throw new Error("Source information worker needs its host message port.");
}
const port = parentPort;
let sequence = 0;
const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
/** Small callbacks preserve existing discovery and evidence services without importing VS Code here. */
function host<T>(method: string, args: unknown[] = []): Promise<T> {
  const id = ++sequence;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: (value) => resolve(value as T), reject });
    port.postMessage({ type: "host", id, method, args });
  });
}
const provider = new EditorInformationProvider({
  discoverMaps: () => host("discoverMaps"),
  projects: () => host("projects"),
  request: (...args) => host("request", args),
});
let publishedRevision = -1;
/** Queries may overlap, while invalidation advances the provider epoch before stale results return. */
const handleMessage = async (message: {
  type: string;
  id: number;
  method: string;
  args: unknown[];
  value?: unknown;
  error?: string;
}) => {
  if (message.type === "hostResult") {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      request?.reject(new Error(message.error));
    } else {
      request?.resolve(message.value);
    }
    return;
  }
  try {
    let value: unknown;
    // Explicit dispatch prevents a malformed message from calling arbitrary provider properties.
    switch (message.method) {
      case "invalidate":
        provider.invalidate();
        break;
      case "configurationChanged":
        provider.configurationChanged();
        break;
      case "buildCompleted":
        provider.buildCompleted(
          ...(message.args as Parameters<EditorInformationProvider["buildCompleted"]>),
        );
        break;
      case "diagnostics":
        value = await provider.diagnostics(
          ...(message.args as Parameters<EditorInformationProvider["diagnostics"]>),
        );
        break;
      case "lines":
        value = await provider.lines(
          ...(message.args as Parameters<EditorInformationProvider["lines"]>),
        );
        break;
      default:
        throw new Error("Unknown source information operation.");
    }
    if (message.type === "query") {
      let tracked: readonly string[] | undefined;
      if (publishedRevision !== provider.trackedRevision()) {
        publishedRevision = provider.trackedRevision();
        tracked = provider.trackedFiles();
      }
      port.postMessage({ type: "result", id: message.id, value, tracked });
    }
  } catch (error) {
    if (message.type === "query") {
      port.postMessage({ type: "result", id: message.id, error: String(error) });
    } else {
      // Control failures cannot leave the host displaying facts from an invalidated build.
      port.postMessage({ type: "failure", error: String(error) });
    }
  }
};
port.on("message", (message: Parameters<typeof handleMessage>[0]) => {
  void handleMessage(message);
});
