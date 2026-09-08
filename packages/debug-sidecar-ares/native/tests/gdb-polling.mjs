#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Compile the actual polling method against a deterministic transport double.
// No polling algorithm is duplicated here and no emulator socket is required.
// This checks scheduling, not packet parsing or desktop/GDB interoperability.
const checkout = process.argv[2];
if (!checkout) throw new Error("Usage: node gdb-polling.mjs /path/to/ares-checkout");
const sourcePath = path.resolve(checkout, "nall/nall/gdb/server.cpp");
const source = await readFile(sourcePath, "utf8");
const start = source.indexOf("  auto Server::updateLoop() -> void {");
const end = source.indexOf("  auto Server::getStatusText(", start);
if (start < 0 || end < start) throw new Error(`Cannot locate polling method in ${sourcePath}`);
const method = source.slice(start, end);
const harness =
  String.raw`
#include <cstdint>
#include <functional>
#include <iostream>
#include <stdexcept>
#include <string>
using u32 = std::uint32_t;

namespace nall::GDB {
auto usleep(unsigned) -> void {}
struct Server {
  bool started = true, halted = false, requestDisconnect = false, noAckMode = false;
  bool disconnected = false;
  u32 messageCount = 0, polls = 0, delivered = 0, acknowledgements = 0;
  std::function<void(Server&)> next;
  auto isStarted() const -> bool { return started; }
  auto isHalted() const -> bool { return halted; }
  auto disconnectClient() -> void { disconnected = true; }
  auto resumeProgram() -> void { halted = false; }
  auto sendText(const char*) -> void { ++acknowledgements; }
  auto packet() -> void { ++messageCount; ++delivered; }
  auto update() -> void {
    if (++polls > 100000) throw std::runtime_error("polling exceeded bounded test limit");
    if (next) next(*this);
  }
  auto updateLoop() -> void;
};
` +
  method +
  String.raw`
}
using nall::GDB::Server;
auto require(bool condition, const char* message) -> void {
  if (!condition) throw std::runtime_error(message);
}
int main() {
  unsigned failures = 0;
  auto test = [&](const char* name, auto scenario) {
    try { scenario(); std::cout << "PASS " << name << '\n'; }
    catch (const std::exception& error) {
      ++failures;
      std::cerr << "FAIL " << name << ": " << error.what() << '\n';
    }
  };
  test("inactive server does not poll", [] {
    Server s; s.started = false; s.updateLoop();
    require(s.polls == 0, "inactive server polled");
  });
  for (bool halted : {false, true}) {
    test(halted ? "halted idle budget" : "running idle budget", [=] {
      Server s; s.halted = halted; s.updateLoop();
      require(s.polls == (halted ? 10000u : 100u), "idle budget changed");
    });
    test(halted ? "halted queued messages" : "running queued messages", [=] {
      Server s; s.halted = halted;
      // A full initial budget of completed messages, followed by one more.
      // Exiting the inner loop after each message leaves this queue undrained.
      const u32 packets = halted ? 21u : 2u;
      s.next = [=](Server& server) { if (server.polls <= packets) server.packet(); };
      s.updateLoop();
      require(s.delivered == packets, "queued message deferred to another updateLoop call");
    });
    test(halted ? "halted continuous traffic is bounded" : "running continuous traffic is bounded", [=] {
      Server s; s.halted = halted;
      s.next = [](Server& server) { server.packet(); };
      s.updateLoop();
      require(s.polls <= (halted ? 20000u : 10100u), "reset budget exceeded");
      require(s.delivered >= 10000u, "polling exited before exercising the reset guard");
    });
  }
  test("message at idle boundary permits a following message", [] {
    Server s;
    s.next = [](Server& server) {
      if (server.polls == 100 || server.polls == 101) server.packet();
    };
    s.updateLoop();
    require(s.delivered == 2, "boundary packet did not extend the polling window");
  });
  test("resume immediately returns control for execution", [] {
    Server s; s.halted = true;
    s.next = [](Server& server) { server.packet(); server.resumeProgram(); };
    s.updateLoop();
    require(s.polls == 1 && !s.halted, "polled again after resume");
  });
  for (bool noAck : {false, true}) {
    test(noAck ? "disconnect without ack" : "disconnect with ack", [=] {
      Server s; s.halted = true; s.requestDisconnect = true; s.noAckMode = noAck;
      s.updateLoop();
      require(s.polls == 0 && s.disconnected && !s.halted && !s.requestDisconnect,
        "disconnect lifecycle changed");
      require(s.acknowledgements == (noAck ? 0u : 1u), "disconnect acknowledgement changed");
    });
  }
  return failures ? 1 : 0;
}
`;

const temporary = await mkdtemp(path.join(os.tmpdir(), "ares-gdb-polling-"));
try {
  const input = path.join(temporary, "polling.cpp");
  const binary = path.join(temporary, "polling");
  await writeFile(input, harness);
  const compile = spawnSync(
    process.env.CXX ?? "c++",
    ["-std=c++17", "-Wall", "-Wextra", "-Werror", input, "-o", binary],
    {
      encoding: "utf8",
      timeout: 30000,
    },
  );
  if (compile.error) throw compile.error;
  if (compile.status !== 0) throw new Error(compile.stderr || "Compilation failed");
  const run = spawnSync(binary, [], { encoding: "utf8", timeout: 5000 });
  if (run.error) throw run.error;
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr);
  process.exitCode = run.status ?? 1;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
