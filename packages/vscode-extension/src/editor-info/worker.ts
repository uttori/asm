import { parentPort } from "node:worker_threads";

import type { InformationRequirements } from "./format.js";
import {
  EditorInformationProvider,
  type EditorProjectManifest,
  type InformationLineRange,
} from "./provider.js";

if (!parentPort) {
  throw new Error("Source information worker needs its host message port.");
}
const port = parentPort;
let sequence = 0;
const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
/** Narrow IPC payloads to plain objects before reading fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate dirty-file sets forwarded from the extension host. */
function isStringSet(value: unknown): value is ReadonlySet<string> {
  if (!(value instanceof Set)) {
    return false;
  }
  for (const entry of value) {
    if (typeof entry !== "string") {
      return false;
    }
  }
  return true;
}

/** Validate one-based inclusive viewport ranges from IPC. */
function isLineRange(value: unknown): value is InformationLineRange {
  return isRecord(value) && typeof value.start === "number" && typeof value.end === "number";
}

/** Validate placeholder requirement flags from IPC. */
function isRequirements(value: unknown): value is InformationRequirements {
  return (
    isRecord(value) &&
    typeof value.counts === "boolean" &&
    typeof value.bytes === "boolean" &&
    typeof value.state === "boolean"
  );
}

/** Validate debug-map discovery results forwarded by the host. */
function isDiscoverMaps(
  value: unknown,
): value is readonly { file: string; sourceRoots: readonly string[] }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.file === "string" &&
        Array.isArray(entry.sourceRoots) &&
        entry.sourceRoots.every((root) => typeof root === "string"),
    )
  );
}

/** Validate one analysis manifest snapshot from the host. */
function isEditorProjectManifest(value: unknown): value is EditorProjectManifest {
  return (
    isRecord(value) &&
    typeof value.target === "string" &&
    isRecord(value.rom) &&
    typeof value.rom.contentSha256 === "string" &&
    typeof value.rom.contentSize === "number" &&
    Array.isArray(value.addressSpaces) &&
    value.addressSpaces.every(
      (space) => isRecord(space) && typeof space.id === "string" && typeof space.kind === "string",
    )
  );
}

/** Validate the project list forwarded for annotation queries. */
function isProjects(
  value: unknown,
): value is readonly { directory: string; manifest: EditorProjectManifest }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.directory === "string" &&
        isEditorProjectManifest(entry.manifest),
    )
  );
}

/** Small callbacks preserve existing discovery and evidence services without importing VS Code here. */
function host(method: string, args: unknown[] = []): Promise<unknown> {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    port.postMessage({ type: "host", id, method, args });
  });
}
const provider = new EditorInformationProvider({
  discoverMaps: async () => {
    const value = await host("discoverMaps");
    if (!isDiscoverMaps(value)) {
      throw new Error("Invalid source information map discovery.");
    }
    return value;
  },
  projects: async () => {
    const value = await host("projects");
    if (!isProjects(value)) {
      throw new Error("Invalid source information projects.");
    }
    return value;
  },
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
        if (
          message.args.length !== 2 ||
          typeof message.args[0] !== "string" ||
          typeof message.args[1] !== "string"
        ) {
          throw new Error("Invalid buildCompleted arguments.");
        }
        provider.buildCompleted(message.args[0], message.args[1]);
        break;
      case "diagnostics":
        if (
          message.args.length !== 2 ||
          typeof message.args[0] !== "string" ||
          !isStringSet(message.args[1])
        ) {
          throw new Error("Invalid diagnostics arguments.");
        }
        value = await provider.diagnostics(message.args[0], message.args[1]);
        break;
      case "lines":
        if (
          message.args.length !== 4 ||
          typeof message.args[0] !== "string" ||
          !Array.isArray(message.args[1]) ||
          !message.args[1].every(isLineRange) ||
          !isRequirements(message.args[2]) ||
          !isStringSet(message.args[3])
        ) {
          throw new Error("Invalid lines arguments.");
        }
        value = await provider.lines(
          message.args[0],
          message.args[1],
          message.args[2],
          message.args[3],
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
