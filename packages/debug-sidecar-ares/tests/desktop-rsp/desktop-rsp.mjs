#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { GdbRspClient } from "../../src/gdb-rsp-client.ts";
import { NodeTcpGdbRspTransport } from "../../src/node-tcp-gdb-rsp-transport.ts";
import { syntheticRom } from "./synthetic-rom.mjs";

const executable = path.resolve(process.argv[2]);
const evidencePath = process.argv[3] ? path.resolve(process.argv[3]) : undefined;
const temporary = await mkdtemp(path.join(os.tmpdir(), "ares-desktop-rsp-"));
const rom = syntheticRom({ quiescent: process.argv.includes("--quiescent") });
/**
 * @param {Uint8Array} data Fixture or executable bytes.
 * @returns {string} SHA-256 identity included in the evidence.
 */
const hash = (data) => createHash("sha256").update(data).digest("hex");
await writeFile(path.join(temporary, "debug.sfc"), rom);
await mkdir(path.join(temporary, "systems"));
await writeFile(path.join(temporary, "settings.bml"), "");
const probe = net.createServer();
await new Promise((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => resolve(undefined));
});
const address = probe.address();
assert.ok(address && typeof address !== "string");
const port = address.port;
await new Promise((resolve) => probe.close(resolve));
const overrides = [
  "Developer/DebugServerEnabled=true",
  "Developer/DebugServerUseIPv4=true",
  `Developer/DebugServerPort=${port}`,
  "Boot/AwaitGDBClient=true",
  "Input/Defocus=Allow",
  "Video/Driver=None",
  "Audio/Mute=true",
  "Audio/Blocking=false",
  "Video/Blocking=false",
  `Paths/Home=${temporary}/systems/`,
  `Paths/Saves=${temporary}/`,
];
const child = spawn(
  executable,
  [
    "--no-file-prompt",
    "--settings-file",
    path.join(temporary, "settings.bml"),
    ...overrides.flatMap((value) => ["--setting", value]),
    path.join(temporary, "debug.sfc"),
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let log = "";
child.stdout.on("data", (chunk) => {
  log = (log + chunk).slice(-16000);
});
child.stderr.on("data", (chunk) => {
  log = (log + chunk).slice(-16000);
});
/** @type {GdbRspClient | undefined} */
let client;
const getClient = () => {
  assert.ok(client);
  return client;
};
/** @type {string[]} */
const checks = [];
/**
 * @param {string} name Completed desktop assertion group.
 * @returns {void}
 */
const record = (name) => {
  checks.push(name);
  process.stdout.write(`PASS ${name}\n`);
};
async function connect() {
  const deadline = Date.now() + 15000;
  for (;;) {
    if (child.exitCode !== null || child.signalCode) {
      throw new Error(`Desktop exited: ${log}`);
    }
    try {
      const transport = await NodeTcpGdbRspTransport.connect({
        host: "127.0.0.1",
        port,
        connectTimeoutMs: 500,
      });
      const connected = new GdbRspClient({ transport, requestTimeoutMs: 5000 });
      await connected.start();
      return connected;
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error;
      }
      await delay(50);
    }
  }
}
const pc = async () => {
  const registers = Buffer.from(await getClient().request("g"), "hex");
  assert.equal(registers.length, 16);
  return registers[11] * 65536 + registers.readUInt16LE(12);
};
/**
 * @param {() => Promise<unknown>} action Control request expected to produce a stop.
 * @returns {Promise<void>} Resolves after the request and corresponding stop.
 */
async function execute(action) {
  /** @type {ReturnType<GdbRspClient["onStop"]> | undefined} */
  let subscription;
  /** @type {NodeJS.Timeout | undefined} */
  let timer;
  /** @type {Promise<void>} */
  const stopped = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Stop timed out")), 5000);
    subscription = getClient().onStop(() => resolve());
  });
  try {
    await Promise.all([stopped, action()]);
  } finally {
    clearTimeout(timer);
    subscription?.dispose();
  }
}
/**
 * @param {import("node:child_process").ChildProcess} childProcess Child process to check.
 * @returns {boolean} True while the process has neither exited nor been signaled.
 */
const isRunning = (childProcess) => childProcess.exitCode === null && !childProcess.signalCode;
try {
  client = await connect();
  await delay(150); // A connected socket alone must leave boot held.
  const supported = await getClient().request("qSupported");
  assert.match(supported, /qXfer:features:read\+/);
  await getClient().requestStop("?");
  assert.equal(await pc(), 0x8000);
  record("desktop attach stops at reset vector before execution");
  let xml = "";
  for (;;) {
    const chunk = await getClient().request(
      `qXfer:features:read:target.xml:${xml.length.toString(16)},20`,
    );
    xml += chunk.slice(1);
    if (chunk[0] === "l") {
      break;
    }
    assert.equal(chunk[0], "m");
  }
  assert.match(xml, /dev\.ares\.wdc65816\.core/);
  assert.equal(await getClient().request("m8000,9"), rom.subarray(0, 9).toString("hex"));
  assert.equal(await getClient().request("m2100,1"), "E00");
  record("desktop register XML and safe ROM/MMIO reads");
  for (const expected of [0x8001, 0x8002, 0x8004, 0x8005]) {
    await execute(() => getClient().step());
    assert.equal(await pc(), expected);
  }
  record("four single steps have exact instruction PCs");
  assert.equal(await getClient().request("Z0,8005,1"), "OK");
  const before = await getClient().request("m0,1");
  await execute(() => getClient().continue());
  assert.equal(await pc(), 0x8005);
  assert.equal(
    Number.parseInt(await getClient().request("m0,1"), 16),
    (Number.parseInt(before, 16) + 1) & 255,
  );
  record("continue leaves breakpoint and executes one loop before stopping again");
  const started = performance.now();
  for (let i = 0; i < 200; ++i) {
    assert.equal(await getClient().request("p7"), "0580");
  }
  const burstMs = performance.now() - started;
  assert.equal(await pc(), 0x8005);
  record("200 desktop packet round trips preserve the stopped PC");
  /**
   * @param {string} text Native monitor reset command.
   * @returns {Promise<string>} The RSP response at its documented boundary.
   */
  const monitor = (text) => getClient().request(`qRcmd,${Buffer.from(text).toString("hex")}`);
  if (process.argv.includes("--quiescent")) {
    for (const [entry, stopped] of [
      ["2080", 0x8021],
      ["3080", 0x8031],
    ]) {
      assert.equal(await getClient().request(`P7=${entry}`), "OK");
      await execute(() => getClient().step());
      assert.equal(await pc(), stopped);
      await getClient().continue();
      await delay(30);
      await execute(() => getClient().interrupt());
      assert.equal(await pc(), stopped);
      assert.equal(await monitor("reset halt"), "OK");
      assert.equal(await pc(), 0x8000);
    }
    record("WAI and STP remain interruptible and resettable at quiescent boundaries");
  }
  assert.equal(await monitor("reset halt"), "OK");
  assert.equal(await pc(), 0x8000);
  record("monitor reset halt replies at reset vector");
  await execute(async () => assert.equal(await monitor("reset run"), "OK"));
  assert.equal(await pc(), 0x8005);
  record("monitor reset run reaches retained breakpoint");
  assert.equal(await getClient().request("z0,8005,1"), "OK");
  await getClient().continue();
  await delay(50);
  await execute(() => getClient().interrupt());
  assert.ok([0x8005, 0x8007].includes(await pc()));
  record("Ctrl-C returns a coherent loop boundary");
  assert.equal(await getClient().request("D"), "OK");
  await getClient().close();
  client = undefined;
  await delay(150);
  client = await connect();
  await getClient().requestStop("?");
  assert.ok([0x8005, 0x8007].includes(await pc()));
  await execute(() => getClient().step());
  record("desktop detach reconnect and step");
  if (process.argv.includes("--gui-quit")) {
    process.stdout.write(`READY FOR GUI QUIT: pid=${child.pid}; debugger is halted\n`);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("GUI quit timed out")), 60000);
      child.once("exit", (code, signal) => {
        clearTimeout(timer);
        if (code === 0 && signal === null) {
          resolve(undefined);
        } else {
          reject(new Error(`Unclean desktop exit: ${code}/${signal}`));
        }
      });
    });
    record("GUI quit while debugger is halted exits cleanly");
  }
  const evidence = {
    schemaVersion: 1,
    fixtureSha256: hash(rom),
    executableSha256: hash(await readFile(executable)),
    platform: process.platform,
    architecture: process.arch,
    fixtureVariant: process.argv.includes("--quiescent") ? "quiescent" : "loop",
    checks,
    packetRoundTrips: 200,
    packetBurstMs: burstMs,
    packetRoundTripsPerSecond: 200000 / burstMs,
    ordinaryGdb: false,
    cleanup: process.argv.includes("--gui-quit")
      ? "clean GUI quit while halted"
      : "process termination; GUI quit is a separate check",
  };
  if (evidencePath) {
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
  }
  process.stdout.write(JSON.stringify(evidence, null, 2) + "\n");
} catch (error) {
  process.stderr.write(log + "\n");
  throw error;
} finally {
  await client?.close();
  if (child.exitCode === null && !child.signalCode) {
    child.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(3000)]);
    if (isRunning(child)) {
      child.kill("SIGKILL");
    }
  }
  await rm(temporary, { recursive: true, force: true });
}
