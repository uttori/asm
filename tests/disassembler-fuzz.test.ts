import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  Uint8ArrayDecoderSource,
  type ArchitectureDecodeResult,
  type ArchitectureDecoder,
  type DecodedInstruction,
} from "@uttori/asm-core";
import {
  DEBUG_SIDECAR_PROTOCOL,
  DEBUG_SIDECAR_PROTOCOL_VERSION,
  DebugSidecarMessageParser,
  assertDebugSidecarMessage,
  encodeDebugSidecarMessage,
  type DebugSidecarMessage,
  type DebugSidecarProtocolLimits,
} from "@uttori/asm-debug-adapter";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_MANIFEST,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RUNTIME_INSTRUCTION_TRACE_FORMAT,
  RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
  RomImage,
  canonicalJson,
  importRuntimeInstructionTrace,
  loadAnalysisProject,
  migrateManifest,
  validateAnalysisProjectManifest,
  writeAnalysisProject,
  type AnalysisProject,
  type AnalysisProjectManifest,
  type RuntimeInstructionTraceArtifact,
} from "@uttori/asm-disassembler";
import {
  Cpu65816Decoder,
  Spc700Decoder,
  SuperFxDecoder,
  type Cpu65816DecodeState,
  type Spc700DecodeState,
  type SuperFxDecodeState,
} from "@uttori/asm-plugin-snes";

import { test } from "./ava-helper.js";
import { FuzzRandom, fuzzSeed, type FuzzJson } from "./fuzz-helpers.js";

const sha256 = (value: string): string => crypto.createHash("sha256").update(value).digest("hex");

/**
 * Captures an untrusted-boundary result while enforcing the public rule that rejections are Errors.
 * @template T
 * @param {() => T} operation Boundary invocation.
 * @returns {{ ok: true; value: T } | { ok: false; error: Error }} Accepted result or explicit error.
 */
const capture = <T>(operation: () => T): { ok: true; value: T } | { ok: false; error: Error } => {
  try {
    return { ok: true, value: operation() };
  } catch (error) {
    if (!(error instanceof Error))
      throw new Error(`Boundary threw a non-Error value: ${String(error)}`);
    return { ok: false, error };
  }
};

/**
 * Checks invariants common to all architecture-neutral decoder results.
 * @param {ArchitectureDecodeResult} result Decoder output.
 * @param {Uint8Array} bytes Complete source bytes.
 * @param {number} offset Requested source offset.
 */
const assertDecodeContract = (
  result: ArchitectureDecodeResult,
  bytes: Uint8Array,
  offset: number,
): void => {
  let instructions: readonly DecodedInstruction[] = [];
  if (result.kind === "instruction") instructions = [result.instruction];
  if (result.kind === "ambiguous") instructions = [...result.alternatives];
  for (const instruction of instructions) {
    if (!Number.isSafeInteger(instruction.size) || instruction.size <= 0) {
      throw new Error("Decoder returned a non-positive instruction size.");
    }
    if (instruction.offset !== offset || instruction.bytes.length !== instruction.size) {
      throw new Error("Decoder returned inconsistent instruction offsets or byte lengths.");
    }
    if (offset < 0 || offset + instruction.size > bytes.length) {
      throw new Error("Decoder instruction extends outside the supplied source.");
    }
    const expected = bytes.subarray(offset, offset + instruction.size);
    if (!instruction.bytes.every((byte, index) => byte === expected[index])) {
      throw new Error("Decoder instruction bytes differ from the supplied source.");
    }
  }
  if (result.kind === "ambiguous") {
    if (
      result.minimumSize <= 0 ||
      result.maximumSize < result.minimumSize ||
      result.requiredState.length === 0
    ) {
      throw new Error("Decoder returned malformed ambiguity bounds.");
    }
  }
  if (
    result.kind === "error" &&
    !["invalidOpcode", "invalidState", "outOfBounds", "truncated"].includes(result.code)
  ) {
    throw new Error(`Decoder returned unknown error code '${result.code}'.`);
  }
};

test("deterministic decoder fuzz preserves bounds across 65816, SPC700, and SuperFX", (t) => {
  const seed = fuzzSeed(0x6581_6f01);
  const random = new FuzzRandom(seed);
  const decoders: ReadonlyArray<{
    readonly name: string;
    readonly decoder: ArchitectureDecoder<unknown>;
    readonly state: () => unknown;
    readonly logicalMaximum: number;
  }> = [
    {
      name: "65816",
      decoder: new Cpu65816Decoder(),
      logicalMaximum: 0x1_000000,
      state: (): Cpu65816DecodeState => ({
        e: random.pick([0, 1, true, false, "unknown", undefined]),
        m: random.pick([0, 1, true, false, "unknown", undefined]),
        x: random.pick([0, 1, true, false, "unknown", undefined]),
        programBank: random.boolean() ? random.integer(0x100) : undefined,
        dataBank: random.boolean() ? random.integer(0x100) : undefined,
        directPage: random.boolean() ? random.integer(0x1_0000) : undefined,
      }),
    },
    {
      name: "SPC700",
      decoder: new Spc700Decoder(),
      logicalMaximum: 0x1_0000,
      state: (): Spc700DecodeState => ({
        directPage: random.pick([0, 0x100, "unknown", undefined]),
      }),
    },
    {
      name: "SuperFX",
      decoder: new SuperFxDecoder(),
      logicalMaximum: 0x1_000000,
      state: (): SuperFxDecodeState => ({
        alt: random.pick([0, 1, 2, 3, "unknown", undefined]),
        destinationRegister: random.pick([random.integer(16), "unknown" as const, undefined]),
        sourceRegister: random.pick([random.integer(16), "unknown" as const, undefined]),
        programBank: random.pick([random.integer(0x100), "unknown" as const, undefined]),
      }),
    },
  ];

  for (const entry of decoders) {
    for (let iteration = 0; iteration < 4_096; iteration++) {
      const bytes = random.bytes(8);
      const offset = random.integer(bytes.length + 3) - 1;
      const decoded = capture(() =>
        entry.decoder.decode({
          source: new Uint8ArrayDecoderSource(bytes),
          offset,
          logicalAddress: random.integer(entry.logicalMaximum),
          state: entry.state(),
        }),
      );
      if (!decoded.ok) {
        t.fail(
          `${entry.name} threw at seed ${seed}, iteration ${iteration}: ${decoded.error.message}`,
        );
        continue;
      }
      try {
        assertDecodeContract(decoded.value, bytes, offset);
      } catch (error) {
        t.fail(
          `${entry.name} violated its contract at seed ${seed}, iteration ${iteration}: ${String(error)}`,
        );
      }
    }
  }
  t.pass(`decoder seed ${seed}`);
});

const minimalManifest = (): AnalysisProjectManifest => ({
  format: ANALYSIS_PROJECT_FORMAT,
  schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
  target: "fuzz.target",
  rom: {
    sha256: "a".repeat(64),
    contentSha256: "a".repeat(64),
    fileSize: 0x8000,
    contentSize: 0x8000,
    headerSize: 0,
  },
  mapping: { mapper: "fuzz", source: "override", candidates: [] },
  addressSpaces: [{ id: "rom.file", name: "ROM", addressBits: 24, kind: "file" }],
  shards: [],
});

test("deterministic project fuzz rejects or migrates arbitrary manifests", (t) => {
  const seed = fuzzSeed(0x0a11_ce11);
  const random = new FuzzRandom(seed);
  let accepted = 0;
  for (let iteration = 0; iteration < 2_048; iteration++) {
    const candidate: FuzzJson =
      iteration % 16 === 0
        ? ({
            ...minimalManifest(),
            [random.pick([
              "format",
              "schemaVersion",
              "target",
              "rom",
              "mapping",
              "addressSpaces",
              "shards",
            ])]: random.json(),
          } as unknown as FuzzJson)
        : random.json();
    const migrated = capture(() => migrateManifest(candidate));
    if (!migrated.ok) continue;
    accepted++;
    t.notThrows(() => validateAnalysisProjectManifest(migrated.value));
    t.is(migrated.value.schemaVersion, ANALYSIS_PROJECT_SCHEMA_VERSION);
  }
  t.true(accepted >= 1, `seed ${seed} retained at least one valid current manifest`);
});

const emptyProject = (rom: RomImage): AnalysisProject => ({
  manifest: {
    ...minimalManifest(),
    rom: rom.identity,
  },
  shards: {
    analysis: [],
    annotations: [],
    labels: [],
    comments: [],
    regions: [],
    runtime: [],
    evidence: [],
    imports: [],
  },
});

test("deterministic project fuzz bounds JSON shard parsing and validation", (t) => {
  const seed = fuzzSeed(0x5a4d_0002);
  const random = new FuzzRandom(seed);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-project-fuzz-"));
  try {
    const rom = new RomImage(new Uint8Array(0x8000));
    const manifest = writeAnalysisProject(directory, emptyProject(rom));
    const descriptor = manifest.shards.find((entry) => entry.kind === "annotations");
    if (!descriptor) throw new Error("Fuzz fixture has no annotation shard.");
    let accepted = 0;
    for (let iteration = 0; iteration < 256; iteration++) {
      const payload = iteration % 17 === 0 ? [] : random.json();
      const text =
        iteration % 29 === 0 ? `{invalid-${random.nextUint32()}` : canonicalJson(payload);
      fs.writeFileSync(path.join(directory, descriptor.path), text);
      const candidate: AnalysisProjectManifest = {
        ...manifest,
        shards: manifest.shards.map((entry) =>
          entry.kind === "annotations"
            ? {
                ...entry,
                sha256: sha256(text),
                records: Array.isArray(payload) ? payload.length : 0,
              }
            : entry,
        ),
      };
      fs.writeFileSync(path.join(directory, ANALYSIS_PROJECT_MANIFEST), canonicalJson(candidate));
      const loaded = capture(() => loadAnalysisProject(directory));
      if (loaded.ok) {
        accepted++;
        t.true(Array.isArray(loaded.value.shards.annotations));
      }
    }
    t.true(accepted >= 1, `seed ${seed} retained valid empty shards`);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

const validTrace = (random: FuzzRandom): RuntimeInstructionTraceArtifact => {
  const chunks: RuntimeInstructionTraceArtifact["chunks"][number][] = [];
  let nextSequence = 1;
  let droppedEvents = 0;
  let active = true;
  for (let index = 0; index < random.integer(6); index++) {
    droppedEvents += random.integer(3);
    nextSequence += droppedEvents - (chunks.at(-1)?.droppedEvents ?? 0);
    const addresses = Array.from({ length: random.integer(9) }, () => random.integer(0x1_000000));
    active &&= random.boolean();
    chunks.push({ sequenceStart: nextSequence, addresses, droppedEvents, active });
    nextSequence += addresses.length;
  }
  return {
    format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
    schemaVersion: RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    romContentSha256: "b".repeat(64),
    producer: { id: "fuzz", revision: "1" },
    chunks,
  };
};

test("deterministic trace fuzz validates arbitrary and ordered artifacts", (t) => {
  const seed = fuzzSeed(0x7ace_0001);
  const random = new FuzzRandom(seed);
  const context = { projectRomContentSha256: "b".repeat(64), sourceName: "fuzz.trace.json" };
  for (let iteration = 0; iteration < 1_024; iteration++) {
    capture(() =>
      importRuntimeInstructionTrace(
        random.json() as unknown as RuntimeInstructionTraceArtifact,
        context,
      ),
    );
  }
  for (let iteration = 0; iteration < 512; iteration++) {
    const artifact = validTrace(random);
    const imported = importRuntimeInstructionTrace(artifact, context);
    const observed = artifact.chunks.reduce((total, chunk) => total + chunk.addresses.length, 0);
    t.is(imported.observedEvents, observed, `seed ${seed}, valid iteration ${iteration}`);
    t.is(imported.droppedEvents, artifact.chunks.at(-1)?.droppedEvents ?? 0);
    t.regex(imported.sourceSha256, /^[\da-f]{64}$/);
  }
});

const protocolLimits: DebugSidecarProtocolLimits = {
  maxFrameBytes: 1_024,
  maxBufferedBytes: 2_048,
  maxMemoryReadBytes: 256,
  maxDisassemblyInstructions: 64,
  maxBreakpoints: 64,
  maxTraceBatchEvents: 64,
  maxQueuedMessages: 32,
  maxQueuedBytes: 8_192,
};

const validProtocolMessage = (random: FuzzRandom, sequence: number): DebugSidecarMessage => {
  const envelope = {
    protocol: DEBUG_SIDECAR_PROTOCOL,
    version: DEBUG_SIDECAR_PROTOCOL_VERSION,
    session: "f".repeat(43),
    sequence,
  } as const;
  switch (random.integer(3)) {
    case 0:
      return { ...envelope, type: "request", command: "ping" };
    case 1:
      return {
        ...envelope,
        type: "response",
        requestSequence: sequence,
        success: true,
        result: { nonce: random.nextUint32() },
      };
    default:
      return { ...envelope, type: "event", event: "output", body: { text: "fuzz" } };
  }
};

test("deterministic protocol fuzz preserves validation, framing, and ordering bounds", (t) => {
  const seed = fuzzSeed(0x51de_ca42);
  const random = new FuzzRandom(seed);
  for (let iteration = 0; iteration < 2_048; iteration++) {
    capture(() => assertDebugSidecarMessage(random.json(), protocolLimits));
  }

  const parser = new DebugSidecarMessageParser(protocolLimits);
  for (let sequence = 1; sequence <= 512; sequence++) {
    const message = validProtocolMessage(random, sequence);
    const frame = encodeDebugSidecarMessage(message, protocolLimits);
    const decoded: DebugSidecarMessage[] = [];
    for (let offset = 0; offset < frame.length;) {
      const size = Math.min(frame.length - offset, random.integer(17) + 1);
      decoded.push(...parser.push(frame.subarray(offset, offset + size)));
      offset += size;
    }
    t.deepEqual(decoded, [message], `seed ${seed}, framed sequence ${sequence}`);
  }

  for (let iteration = 0; iteration < 1_024; iteration++) {
    const malformed = random.bytes(96);
    const parsed = capture(() => new DebugSidecarMessageParser(protocolLimits).push(malformed));
    if (parsed.ok) {
      for (const message of parsed.value) t.notThrows(() => assertDebugSidecarMessage(message));
    }
  }
});
