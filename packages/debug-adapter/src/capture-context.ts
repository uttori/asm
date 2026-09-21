import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, open, readdir, readFile, link, unlink } from "node:fs/promises";
import path from "node:path";

import type { CaptureFileMetadata, CaptureFileSummary } from "./capture-file.js";
import type { CaptureRequestV2, CaptureTransportV2 } from "./capture-v2.js";

/** Context is enabled by default. The explicit false option is for trace-only
 * benchmarks and producers without the local context protocol. */
export interface CaptureContextOptions {
  readonly context?: boolean;
}

/** Coordinates paused context boundaries with either ACT2 sink. The native
 * companion writes into a newly reserved directory; manifest.json is published
 * only after the ACT2 archive and every companion file are complete and synced. */
export class CaptureContextRecorder {
  readonly directory: string;
  readonly transport: CaptureTransportV2;
  readonly #metadata: CaptureFileMetadata;
  readonly #native: CaptureTransportV2;

  constructor(archive: string, metadata: CaptureFileMetadata, transport: CaptureTransportV2) {
    this.directory = `${archive}.context`;
    // Recorder options also contain format, callbacks and host paths. Copy only
    // identity fields so they cannot overwrite the companion's format contract.
    this.#metadata = {
      architecture: metadata.architecture,
      addressSpace: metadata.addressSpace,
      romContentSha256: metadata.romContentSha256,
      producer: metadata.producer,
    };
    this.#native = transport;
    this.transport = async (request) => {
      if (request.operation === "start" || request.operation === "file-start") {
        await this.#request(
          {
            operation: "context",
            action: "prepare",
            directory: this.directory,
            romContentSha256: metadata.romContentSha256,
            producer: metadata.producer,
          },
          "prepared",
        );
        let session: string | undefined;
        try {
          const position = await transport(request);
          if (!("session" in position)) {
            throw new Error("Capture did not return a session.");
          }
          session = position.session;
          await this.#request({ operation: "context", action: "start", session }, "recording");
          return position;
        } catch (error) {
          if (session) {
            await transport({
              operation: request.operation === "file-start" ? "file-abort" : "abort",
              session,
            }).catch(() => undefined);
          }
          await transport({ operation: "context", action: "abort" }).catch(() => undefined);
          throw error;
        }
      }
      if (request.operation === "stop" || request.operation === "file-stop") {
        // Stop first pauses at an acknowledged CPU boundary. It stays held while
        // the independent graphics writer drains, so the end WRAM image
        // and primary terminal counters describe the same execution position.
        for (;;) {
          const result = await transport({
            operation: "context",
            action: "stop",
            session: request.session,
          });
          if (!("contextState" in result)) {
            throw new Error("Missing capture context stop status.");
          }
          if (result.contextState === "complete") {
            break;
          }
          if (result.contextState !== "draining") {
            throw new Error(`Capture context stop failed: ${result.contextState}.`);
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
      if (request.operation === "abort" || request.operation === "file-abort") {
        await transport({ operation: "context", action: "abort" }).catch(() => undefined);
      }
      return transport(request);
    };
  }

  /** Publish integrity hashes and trace-relative boundaries after primary publication.
   * Failures retain all files without claiming a complete context bundle.
   * @param {CaptureFileSummary} summary Completed primary archive whose session/counters must match.
   */
  async finish(summary: CaptureFileSummary): Promise<void> {
    const boundaries = JSON.parse(
      await readFile(path.join(this.directory, "boundaries.json"), "utf8"),
    ) as {
      session?: string;
      end?: { eventThrough?: string };
      graphicsWindowFrames?: null;
    };
    if (
      boundaries.session !== summary.position.session ||
      boundaries.end?.eventThrough !== summary.position.producedThrough
    ) {
      throw new Error("Capture context boundary does not match the completed ACT2 archive.");
    }
    const files: Record<string, { bytes: number; sha256: string }> = {};
    for (const name of (await readdir(this.directory)).sort()) {
      if (
        !/^(?:identity\.txt|machine\.json|start\.bst|wram-(?:start|end)\.bin|inputs\.bin|milestones\.jsonl|(?:start|end)-clock\.txt|boundaries\.json|graphics\.act2|screen-\d+\.png)$/.test(
          name,
        )
      ) {
        throw new Error(`Unexpected capture context artifact: ${name}.`);
      }
      const file = path.join(this.directory, name);
      const stat = await lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error("Capture context artifacts must be regular files.");
      }
      if (name.startsWith("wram-") && stat.size !== 131072) {
        throw new Error("WRAM snapshots must contain exactly 128 KiB.");
      }
      if (name === "inputs.bin" && stat.size % 18) {
        throw new Error("Controller evidence has an incomplete row.");
      }
      const hash = createHash("sha256");
      for await (const bytes of createReadStream(file)) {
        hash.update(bytes as Buffer);
      }
      const handle = await open(file, "r+");
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
      files[name] = { bytes: stat.size, sha256: hash.digest("hex") };
    }
    for (const name of [
      "start.bst",
      "wram-start.bin",
      "wram-end.bin",
      "inputs.bin",
      "milestones.jsonl",
      "identity.txt",
      "machine.json",
      "start-clock.txt",
      "end-clock.txt",
    ]) {
      if (!files[name]) {
        throw new Error(`Missing capture context artifact: ${name}.`);
      }
    }
    if (summary.scope === "snes.65816.instructions" && !files["graphics.act2"]) {
      throw new Error("Instruction context is missing its graphics companion.");
    }
    // Require the producer's explicit full-window acknowledgement so a mismatched
    // runtime cannot publish an early graphics cutoff as complete scene evidence.
    if (files["graphics.act2"] && boundaries.graphicsWindowFrames !== null) {
      throw new Error("Capture context requires full-capture graphics from the native runtime.");
    }
    const manifest = path.join(this.directory, "manifest.json");
    const handle = await open(`${manifest}.partial`, "wx");
    try {
      await handle.writeFile(
        `${JSON.stringify(
          {
            format: "uttori-capture-context",
            version: 1,
            ...this.#metadata,
            archive: path.basename(summary.archive),
            scope: summary.scope,
            boundaries,
            wram: { address: 0x7e0000, bytes: 131072 },
            inputs: {
              file: "inputs.bin",
              rowBytes: 18,
              encoding: "le-u64-clock,u64-instruction-ordinal,u8-port,u8-serial-bits",
            },
            visuals: {
              timing: "last-presented-frame",
              automaticIntervalFrames: 300,
              automaticLimit: 24,
            },
            graphics: files["graphics.act2"]
              ? { scope: "snes.cpu-bus-ppu", windowFrames: null, file: "graphics.act2" }
              : {
                  scope: summary.scope,
                  windowFrames: null,
                  file: null,
                  primaryArchive: path.basename(summary.archive),
                },
            files,
          },
          null,
          2,
        )}\n`,
      );
      await handle.sync();
    } finally {
      await handle.close();
    }
    await link(`${manifest}.partial`, manifest);
    await unlink(`${manifest}.partial`);
  }

  async #request(request: CaptureRequestV2, expected: string): Promise<void> {
    const result = await this.#native(request);
    if (!("contextState" in result) || result.contextState !== expected) {
      throw new Error(`Capture context requires ${expected} status.`);
    }
  }
}

/** Verify the entire companion before feeding a save state to native code. Every
 * path is a flat, regular artifact, and every byte is bound to this ROM/build.
 * @param {string} directory Companion directory selected by the user.
 * @param {Pick<CaptureFileMetadata, "romContentSha256" | "producer">} identity ROM and producer identity of the verified running emulator.
 */
export const verifyCaptureContext = async (
  directory: string,
  identity: Pick<CaptureFileMetadata, "romContentSha256" | "producer">,
): Promise<void> => {
  const metadataFile = path.join(directory, "manifest.json");
  const metadataStat = await lstat(metadataFile);
  if (!metadataStat.isFile() || metadataStat.isSymbolicLink() || metadataStat.size > 1048576) {
    throw new Error("Invalid capture context manifest.");
  }
  const manifest = JSON.parse(await readFile(metadataFile, "utf8")) as Record<string, unknown>;
  const producer = manifest.producer as CaptureFileMetadata["producer"] | undefined;
  if (
    manifest.format !== "uttori-capture-context" ||
    manifest.version !== 1 ||
    manifest.romContentSha256 !== identity.romContentSha256 ||
    producer?.id !== identity.producer.id ||
    producer?.revision !== identity.producer.revision ||
    !manifest.files ||
    typeof manifest.files !== "object"
  ) {
    throw new Error("Capture context requires the matching ROM and emulator build.");
  }
  const files = manifest.files as Record<string, { bytes: number; sha256: string }>;
  for (const name of [
    "start.bst",
    "wram-start.bin",
    "wram-end.bin",
    "inputs.bin",
    "identity.txt",
    "machine.json",
    "start-clock.txt",
    "end-clock.txt",
    "boundaries.json",
  ]) {
    if (!files[name]) {
      throw new Error(`Capture context is missing ${name}.`);
    }
  }
  for (const [name, artifact] of Object.entries(files)) {
    if (
      !/^(?:identity\.txt|machine\.json|start\.bst|wram-(?:start|end)\.bin|inputs\.bin|milestones\.jsonl|(?:start|end)-clock\.txt|boundaries\.json|graphics\.act2|screen-\d+\.png)$/.test(
        name,
      ) ||
      !artifact ||
      !Number.isSafeInteger(artifact.bytes) ||
      artifact.bytes < 0 ||
      !/^[\da-f]{64}$/.test(artifact.sha256)
    ) {
      throw new Error("Invalid capture context artifact descriptor.");
    }
    const file = path.join(directory, name),
      stat = await lstat(file);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size !== artifact.bytes ||
      (name === "start.bst" && (stat.size < 538 || stat.size > 32 * 1048576)) ||
      (name.startsWith("wram-") && stat.size !== 131072) ||
      (name === "inputs.bin" && stat.size % 18)
    ) {
      throw new Error(`Capture context artifact size/type mismatch: ${name}.`);
    }
    const hash = createHash("sha256");
    for await (const bytes of createReadStream(file)) {
      hash.update(bytes as Buffer);
    }
    if (hash.digest("hex") !== artifact.sha256) {
      throw new Error(`Capture context checksum mismatch: ${name}.`);
    }
  }
};
