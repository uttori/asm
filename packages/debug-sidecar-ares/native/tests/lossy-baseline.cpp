#include <nall/nall.hpp>
#include <nall/gdb/server.cpp>
#include <cassert>
#include <chrono>
#include <iostream>
using namespace nall;
using nall::GDB::server;
auto command(const string& packet) -> string {
  bool reply = true;
  return server.processCommand(packet, reply);
}
int main() {
  server.hooks.instructionTrace = server.hooks.instructionTraceDetails = true;
  assert(command("QUttoriTrace:2") == "OK");
  assert(server.instructionTraceCapacity == 8);
  assert(server.instructionTraceNextSequence == 1 && server.instructionTraceSize == 0);
  server.traceMemory(0x2100, 0x80, 1, 1, 0);
  server.traceMemory(0x2101, 0x81, 1, 2, 1);
  for(u32 ordinal = 1; ordinal <= 25; ++ordinal) {
    server.beginInstructionTrace(0x7e0000 + ordinal, {});
    for(u32 byte = 0; byte < 40; ++byte) server.traceMemory(0x7f0000 + byte, byte, 0);
    server.endInstructionTrace();
  }
  assert(server.instructionTraceNextSequence == 26 && server.instructionTraceSize == 8);
  assert(server.instructionTraceDroppedEvents == 17 && server.unattributedTraceMemory == 2);
  for(u32 index = 0; index < 8; ++index) {
    const auto slot = (server.instructionTraceHead + index) % 8;
    assert(server.instructionTraceAddresses[slot] == 0x7e0012 + index);
    assert(server.instructionTraceDetails[slot].memoryCount == 32);
    assert(server.instructionTraceDetails[slot].dropped == 8);
  }
  auto active = command("qUttoriTraceDetailRead:1");
  assert(active.beginsWith("1:12:11:2:"));
  assert(server.instructionTraceSize == 7);
  assert(command("QUttoriTrace:0") == "OK");
  unsigned drained = 0;
  while(server.instructionTraceSize) {
    auto remaining = server.instructionTraceSize;
    command("qUttoriTraceDetailRead:1");
    drained += remaining - server.instructionTraceSize;
  }
  assert(drained == 7);
  std::cout << "PASS baseline (8-slot overlay of actual legacy queue): produced=25 activeRead=1 finalDrain=7 droppedInstructions=17 retainedBusTruncations=64 unattributedBus=2 detailBytes="
    << sizeof(nall::GDB::Server::TraceDetail) << "\n";
}
