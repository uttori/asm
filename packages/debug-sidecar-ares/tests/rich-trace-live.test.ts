import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SidecarDebugBackend, DebugSidecarClient, NodeStdioSidecarTransport, createDebugSidecarSessionToken } from "@uttori/asm-debug-adapter";
import test from "ava";

import { AresProcessHost, parseAresRuntimeManifest } from "../src/ares-process-host.js";
import { AresRspDebugBackend, ARES_RSP_CAPABILITIES } from "../src/ares-rsp-backend.js";

const live = process.env.UTTORI_ARES_RICH_LIVE === "1" ? test.serial : test.serial.skip;
live(
  "built stdio sidecar negotiates runtime capabilities and preserves full trace details",
  async (t) => {
    const runtimeDirectory = path.resolve(
      process.env.UTTORI_ARES_RICH_RUNTIME ?? "Local Only/ares-rich-trace-runtime",
    );
    const backend = new SidecarDebugBackend({
      backend: "ares-rsp",
      capabilities: ARES_RSP_CAPABILITIES,
      createClient: () => {
        const session = createDebugSidecarSessionToken();
        return new DebugSidecarClient({
          session,
          requestTimeoutMs: 15000,
          transport: new NodeStdioSidecarTransport({
            command: process.execPath,
            args: [
              path.resolve("packages/debug-sidecar-ares/out/sidecar.mjs"),
              "--manifest",
              path.join(runtimeDirectory, "ares-runtime-manifest.json"),
              "--ares",
              path.join(runtimeDirectory, "bin/ares-headless"),
              "--rom",
              path.resolve(
                process.env.UTTORI_ARES_LIVE_ROM ?? "Local Only/Secret of Mana (USA).sfc",
              ),
              "--runtime-dir",
              runtimeDirectory,
            ],
            session,
            shutdownTimeoutMs: 3000,
          }),
        });
      },
    });
    try {
      await backend.connect({ reset: true });
      t.true(
        backend.capabilities.architectures.find((a) => a.architecture === "snes.65816")?.trace
          ?.instructionDetails,
      );
      t.is(
        (
          await backend.readMemory(
            { architecture: "snes.65816", addressSpace: "snes.sram", address: 0 },
            4,
          )
        ).bytes.length,
        4,
      );
      await backend.startTrace({
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        detail: "full",
      });
      const stopped = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          subscription.dispose();
          reject(new Error("Rich sidecar step timed out"));
        }, 5000);
        const subscription = backend.onEvent((event) => {
          if (event.type === "stopped") {
            clearTimeout(timeout);
            subscription.dispose();
            resolve();
          }
        });
      });
      await backend.step(1, "instruction");
      await stopped;
      await backend.stopTrace();
      const batch = await backend.readTrace(240);
      t.deepEqual(batch.addresses, [0x8004]);
      t.deepEqual(batch.details?.[0]?.bytes, [0x18]);
      t.is(batch.details?.[0]?.state.e, 1);
      t.true(batch.details?.[0]?.memoryAccesses?.some((access) => access.access === "fetch"));
      await backend.disconnect({ terminate: false });
      await backend.connect({ reset: false });
      t.true(
        backend.capabilities.architectures.find((a) => a.architecture === "snes.65816")?.trace
          ?.instructionDetails,
      );
    } finally {
      await backend.disconnect({ terminate: true }).catch(() => undefined);
    }
  },
);
live(
  "native rich trace captures executed WRAM bytes and bus accesses; SRAM/ARAM peeks are available",
  async (t) => {
    const runtimeDirectory = path.resolve(
      process.env.UTTORI_ARES_RICH_RUNTIME ?? "Local Only/ares-rich-trace-runtime",
    );
    const rom = path.resolve(
      process.env.UTTORI_ARES_LIVE_ROM ?? "Local Only/Secret of Mana (USA).sfc",
    );
    const manifest = parseAresRuntimeManifest(
      JSON.parse(readFileSync(path.join(runtimeDirectory, "ares-runtime-manifest.json"), "utf8")),
    );
    const host = new AresProcessHost({
      executable: path.join(runtimeDirectory, "bin/ares-headless"),
      rom,
      runtimeDirectory,
      manifest,
      startupTimeoutMs: 10000,
      requestTimeoutMs: 3000,
      shutdownTimeoutMs: 2000,
    });
    const backend = new AresRspDebugBackend({
      createClient: (options) => host.createClient(options),
      terminate: () => host.terminate(),
    });
    try {
      await backend.connect({ reset: true });
      t.true(
        backend.capabilities.architectures.find((a) => a.architecture === "snes.65816")?.trace
          ?.instructionDetails,
      );
      for (const address of [
        { architecture: "snes.65816", addressSpace: "snes.sram", address: 0 },
        { architecture: "snes.spc700", addressSpace: "snes.spc700.aram", address: 0 },
      ]) {
        const memory = await backend.readMemory(address, 16);
        t.is(memory.bytes.length, 16);
        t.is(memory.unreadableBytes, 0);
      }
      await backend.startTrace({
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        detail: "full",
      });
      t.deepEqual(
        (await backend.readTrace(16)).addresses,
        [],
        "starting while paused does not invent an execution",
      );
      await backend.continue(1);
      const chunks = [];
      for (let index = 0; index < 160; index++) {
        chunks.push(await backend.readTrace(240));
      }
      await backend.stopTrace();
      // End the producer first, then drain a bounded ring so the saved file is importable.
      for (let index = 0; index < 4097; index++) {
        const batch = await backend.readTrace(240);
        chunks.push(batch);
        if (!batch.addresses.length) {
          break;
        }
      }
      let expectedSequence = 1,
        dropped = 0;
      for (const batch of chunks) {
        t.is(batch.sequenceStart - expectedSequence, batch.droppedEvents - dropped);
        t.is(batch.details?.length, batch.addresses.length);
        expectedSequence = batch.sequenceStart + batch.addresses.length;
        dropped = batch.droppedEvents;
      }
      const addresses = chunks.flatMap((chunk) => chunk.addresses);
      const details = chunks.flatMap((chunk) => chunk.details ?? []);
      const accesses = details.flatMap((detail) => detail.memoryAccesses ?? []);
      t.true(
        addresses.some((address) => address >= 0x7e0000 && address <= 0x7fffff),
        "game executes captured WRAM code",
      );
      t.true(details.every((detail) => detail.bytes.length >= 1 && detail.bytes.length <= 4));
      t.true(accesses.some((access) => access.access === "write"));
      t.true(accesses.some((access) => access.actor === "dma" || access.actor === "hdma"));
      t.false(chunks.at(-1)?.active);
      t.log(
        JSON.stringify({
          observations: addresses.length,
          wram: addresses.filter((address) => address >= 0x7e0000 && address <= 0x7fffff).length,
          busOperations: accesses.length,
          dma: accesses.filter((access) => access.actor === "dma").length,
          dropped,
          droppedMemory: details.reduce(
            (sum, detail) => sum + (detail.droppedMemoryAccesses ?? 0),
            0,
          ),
          unattributed: chunks.at(-1)?.unattributedMemoryAccesses,
        }),
      );
      if (process.env.UTTORI_ARES_RICH_CAPTURE) {
        const destination = path.resolve(process.env.UTTORI_ARES_RICH_CAPTURE);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(
          destination,
          JSON.stringify({
            format: "uttori-asm-instruction-trace",
            schemaVersion: 1,
            architecture: "snes.65816",
            addressSpace: "snes.cpu",
            romContentSha256: createHash("sha256").update(readFileSync(rom)).digest("hex"),
            producer: { id: "ares", revision: manifest.executableSha256 },
            chunks: chunks.map(
              ({ architecture: _architecture, addressSpace: _addressSpace, ...chunk }) => chunk,
            ),
          }),
        );
      }
    } finally {
      await backend.disconnect({ terminate: true }).catch(() => host.terminate());
    }
  },
);
