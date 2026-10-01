/** Fresh-boot manual smoke harness. All ROM, SRAM, settings, and snapshots stay in the test clone. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { sourceContentHash } from "@uttori/asm-disassembler";

import { GdbRspClient } from "../../../debug-sidecar-ares/src/gdb-rsp-client.ts";
import { NodeTcpGdbRspTransport } from "../../../debug-sidecar-ares/src/node-tcp-gdb-rsp-transport.ts";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const root = path.join(application, "experiments/secret-of-mana-git-workflow-full");
const verification = path.join(root, ".verification");
const proof = JSON.parse(
  fs.readFileSync(path.join(verification, "compressed-relocation.json"), "utf8"),
);
assert.equal(proof.success, true);
const runtime = path.join(application, "fixtures/external/ares/runtime");
const manifest = JSON.parse(
  fs.readFileSync(path.join(runtime, "ares-runtime-manifest.json"), "utf8"),
);
const executable = path.join(runtime, "ares.app/Contents/MacOS/ares");
assert.equal(sourceContentHash(fs.readFileSync(executable)), manifest.executableSha256);
const revision = `${manifest.forkRevision}:${manifest.patchSha256}:${manifest.executableSha256}`;
const rom = fs.readFileSync(proof.afterRom);
assert.equal(sourceContentHash(rom), proof.expectedSha256);
const directory = fs.mkdtempSync(path.join(verification, "manual-runtime-"));
fs.writeFileSync(path.join(directory, "program.sfc"), rom);
fs.writeFileSync(path.join(directory, "settings.bml"), "");
fs.mkdirSync(path.join(directory, "systems"));
const reportPath = path.join(verification, "manual-runtime.json");
const commandPath = path.join(verification, "manual-runtime-command.json");
const replyPath = path.join(verification, "manual-runtime-reply.json");
const probe = net.createServer();
await new Promise((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", resolve);
});
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const keys = [
  ...fs
    .readFileSync(
      path.join(application, "fixtures/external/ares/ruby/input/keyboard/quartz.cpp"),
      "utf8",
    )
    .matchAll(/keys\.push_back\({"([^"]+)"/g),
].map((match) => match[1]);
const bindings = {
  "Pad.Up": "Up",
  "Pad.Down": "Down",
  "Pad.Left": "Left",
  "Pad.Right": "Right",
  Start: "Return",
  Select: "Tab",
  "A..South": "Z",
  "B..East": "X",
  "X..West": "A",
  "Y..North": "S",
  "L-Bumper": "Q",
  "R-Bumper": "W",
};
const settings = [
  "Developer/DebugServerEnabled=true",
  "Developer/DebugServerUseIPv4=true",
  `Developer/DebugServerPort=${port}`,
  "Boot/AwaitGDBClient=true",
  "Boot/Fast=true",
  "Input/Defocus=Allow",
  "General/RunAhead=false",
  "General/Rewind=false",
  "Video/Driver=Metal",
  "Video/Blocking=true",
  "Audio/Mute=true",
  "Audio/Blocking=false",
  `Paths/Home=${directory}/systems/`,
  `Paths/Saves=${directory}/saves/`,
  ...Object.entries(bindings).map(([button, key]) => {
    const index = keys.indexOf(key);
    assert.ok(index >= 0);
    return `VirtualPad1/${button}=0x1/0/${index};;`;
  }),
];
const child = spawn(
  executable,
  [
    "--no-file-prompt",
    "--system",
    "Super Famicom",
    "--settings-file",
    path.join(directory, "settings.bml"),
    ...settings.flatMap((setting) => ["--setting", setting]),
    path.join(directory, "program.sfc"),
  ],
  { cwd: directory, stdio: ["ignore", "pipe", "pipe"] },
);
let log = "",
  client,
  stopped = true;
child.stdout.on("data", (chunk) => {
  log = (log + chunk).slice(-16000);
});
child.stderr.on("data", (chunk) => {
  log = (log + chunk).slice(-16000);
});
const report = {
  directory,
  pid: child.pid,
  romSha256: proof.expectedSha256,
  executableSha256: manifest.executableSha256,
  sourceHead: proof.head,
  started: new Date().toISOString(),
  freshBoot: true,
  bindings,
  operations: [],
};
const save = () => fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
const hex = (value) => Buffer.from(value).toString("hex");
/** Interrupt only a running CPU, and wait for its coherent instruction boundary before inspection. */
async function pause() {
  if (stopped) {
    return;
  }
  let subscription, timer;
  const done = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Native pause timed out")), 10000);
    subscription = client.onStop(resolve);
  });
  try {
    await Promise.all([done, client.interrupt()]);
  } finally {
    clearTimeout(timer);
    subscription.dispose();
  }
}
/** Save the actual native state and last presented frame without recording minutes of trace data. */
async function snapshot(label) {
  assert.match(label, /^[\da-z-]{1,60}$/);
  await pause();
  const target = path.join(directory, `${report.operations.length}-${label}`);
  assert.equal(
    await client.request(
      `qUttoriContext:prepare:${hex(target)}:${hex(proof.expectedSha256)}:${hex("ares")}:${hex(revision)}`,
    ),
    "prepared",
  );
  const response = await client.request("qUttoriCapture:start:8388608");
  assert.match(response, /^J[\da-f]+$/);
  const capture = JSON.parse(Buffer.from(response.slice(1), "hex").toString("utf8"));
  assert.equal(await client.request(`qUttoriContext:start:${capture.session}`), "recording");
  let state = await client.request(`qUttoriContext:stop:${capture.session}`);
  const deadline = Date.now() + 10000;
  while (state === "draining") {
    assert.ok(Date.now() < deadline);
    await delay(100);
    state = await client.request(`qUttoriContext:stop:${capture.session}`);
  }
  assert.equal(state, "complete");
  await client.request(`qUttoriCapture:stop:${capture.session}`);
  assert.equal(await client.request("qUttoriContext:abort"), "aborted");
  return {
    target,
    files: Object.fromEntries(
      fs
        .readdirSync(target)
        .filter((file) => fs.statSync(path.join(target, file)).isFile())
        .map((file) => [file, sourceContentHash(fs.readFileSync(path.join(target, file)))]),
    ),
  };
}
try {
  const deadline = Date.now() + 15000;
  for (;;) {
    assert.equal(child.exitCode, null, log);
    try {
      const transport = await NodeTcpGdbRspTransport.connect({
        host: "127.0.0.1",
        port,
        connectTimeoutMs: 500,
      });
      client = new GdbRspClient({ transport, requestTimeoutMs: 10000 });
      await client.start();
      break;
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error;
      }
      await delay(50);
    }
  }
  await client.requestStop("?");
  client.onStop(() => {
    stopped = true;
  });
  report.initialRegisters = await client.request("g");
  save();
  console.log(JSON.stringify({ ready: true, directory, pid: child.pid, commandPath }));
  let lastId = fs.existsSync(commandPath)
    ? JSON.parse(fs.readFileSync(commandPath, "utf8")).id
    : null;
  // A private file mailbox keeps interactive UI checks separate from emulation and leaves an audit trail.
  while (Date.now() - Date.parse(report.started) < 3600000) {
    assert.equal(child.exitCode, null, log);
    await delay(100);
    if (!fs.existsSync(commandPath)) {
      continue;
    }
    const command = JSON.parse(fs.readFileSync(commandPath, "utf8"));
    if (command.id === lastId) {
      continue;
    }
    lastId = command.id;
    const result = { id: command.id, action: command.action, at: new Date().toISOString() };
    try {
      if (command.action === "run") {
        assert.equal(stopped, true);
        stopped = false;
        await client.continue();
      } else if (command.action === "pause") {
        await pause();
      } else if (command.action === "snapshot") {
        Object.assign(result, await snapshot(command.label));
      } else if (command.action === "breakpoint") {
        await pause();
        assert.ok(
          Number.isSafeInteger(command.address) &&
            command.address >= 0 &&
            command.address <= 0xffffff,
        );
        const operation = command.remove ? "z0" : "Z0";
        assert.equal(await client.request(`${operation},${command.address.toString(16)},1`), "OK");
        result.address = command.address;
      } else if (command.action === "done") {
        await pause();
      } else {
        throw new Error("Unknown manual operation");
      }
      if (stopped) {
        result.registers = await client.request("g");
      }
      result.stopped = stopped;
      result.success = true;
    } catch (error) {
      result.error = String(error);
      result.success = false;
    }
    report.operations.push(result);
    save();
    fs.writeFileSync(replyPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result));
    if (command.action === "done") {
      report.completed = new Date().toISOString();
      save();
      break;
    }
  }
} finally {
  await client?.close();
  child.kill("SIGTERM");
  await delay(500);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
  fs.writeFileSync(path.join(directory, "runtime.log"), log);
}
