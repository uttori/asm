#include "../capture-realtime/capture.hpp"
#include <cassert>
#include <iostream>
#include <memory>

using ares_capture::Capture;
using Clock = std::chrono::steady_clock;

// Isolate the pinned producer's encoding/CRC/hex costs. No emulator, filesystem,
// TCP, or consumer is present; the existing PPU harness measures those hooks.
struct Workload {
  const char* name;
  unsigned kind;  // 0: fetched instruction; 1: bus; 2: boundary; 3: PPU effect.
  unsigned variant;
};

auto main() -> int {
  const Workload workloads[] = {
    {"instruction-1-byte", 0, 1}, {"instruction-2-byte", 0, 2},
    {"instruction-3-byte", 0, 3}, {"instruction-4-byte", 0, 4},
    {"cpu-bus", 1, 0}, {"dma-bus", 1, 1}, {"hdma-table", 1, 2},
    {"hdma-indirect", 1, 3}, {"hdma-payload", 1, 4},
    {"dma-boundaries", 2, 0}, {"hdma-boundaries", 2, 1}, {"dma-interrupted", 2, 2},
    {"vram-written", 3, 0}, {"vram-blocked", 3, 1},
    {"cgram-written", 3, 2}, {"cgram-latched", 3, 3}, {"oam-written", 3, 4},
  };
  constexpr unsigned events = 262144;
  std::cout << "{\"events\":" << events << ",\"warmups\":1,\"measuredSamples\":3,\"runs\":[\n";
  bool comma = false;
  for(const auto& workload : workloads) for(bool hex : {false, true}) for(unsigned sample = 0; sample < 4; ++sample) {
    auto owner = std::make_unique<Capture>();
    auto& capture = *owner;
    std::string scope;
    if(workload.kind == 1) scope = ":bus";
    if(workload.kind == 2) scope = ":bus-transfers";
    if(workload.kind == 3) scope = ":bus-ppu";
    assert(capture.command("start:4718656" + scope)[0] == '{');
    Capture::profileSeals = true;
    uint64_t drained = 0, bytes = 0, chunks = 0;
    double drainMs = 0;
    auto drain = [&] {
      const auto start = Clock::now();
      while(auto* chunk = capture.nativeChunk(0)) {
        assert(chunk && chunk->sealed);
        const auto sequence = chunk->sequence;
        const auto through = chunk->first + chunk->count - 1;
        bytes += chunk->used; drained += chunk->count; ++chunks;
        if(hex) {
          const auto encoded = capture.command("read:" + capture.sessionId() + ":" + std::to_string(sequence));
          assert(encoded.size() == chunk->used * 2);
          assert(capture.command("ack:" + capture.sessionId() + ":" + std::to_string(sequence) + ":" + std::to_string(through))[0] == '{');
        } else assert(capture.acknowledgeNative(sequence, through));
      }
      drainMs += std::chrono::duration<double, std::milli>(Clock::now() - start).count();
    };
    std::array<uint16_t, 10> registers{0, 0, 0, 511, 0, 0, 128, 0x8000, 48, 1};
    std::array<uint8_t, 12> configuration{};
    configuration[6] = 1; // DAS low byte: one attempted byte per begin/complete encoding pair.
    Capture::TransferToken token{};
    const auto start = Clock::now();
    for(unsigned i = 0; i < events; ++i) {
      if(!capture.ready()) drain();
      assert(capture.ready());
      if(workload.kind == 0) {
        capture.begin(0x808000, registers, uint64_t(i) * 8);
        for(unsigned fetched = 0; fetched < workload.variant; ++fetched) capture.fetch(uint8_t(fetched));
        capture.end();
      } else if(workload.kind == 2) {
        unsigned boundary = i % 2;
        if(boundary && workload.variant == 2) boundary = 2;
        token = capture.transfer(boundary, workload.variant == 1, (i / 2) % 8, i % 2,
          configuration, token, Capture::BusContext::Wait, 0x808000, uint64_t(i) * 8, 0, 0);
      } else {
        auto phase = Capture::BusPhase::CPU;
        uint8_t channel = 255;
        uint32_t address = 0x7e0000;
        bool write = false;
        if(workload.kind == 1) {
          phase = Capture::BusPhase(workload.variant);
          if(workload.variant) channel = 0;
        } else {
          // These scratch decisions benchmark wire branches, not PPU semantics.
          write = true;
          address = 0x2118;
          unsigned target = 1;
          if(workload.variant == 2 || workload.variant == 3) { target = 2; address = 0x2122; }
          if(workload.variant == 4) { target = 3; address = 0x2104; }
          capture.ppuBegin(target, workload.variant == 1 ? 0 : 1, 0, 0);
          if(workload.variant == 1) capture.ppuBlocked();
          else if(workload.variant != 3) {
            capture.ppuWrite(0, uint8_t(i));
            if(target != 1) capture.ppuWrite(1, target == 2 ? uint8_t(i) & 127 : uint8_t(i));
          }
        }
        capture.bus(address, uint8_t(i), write, phase, channel, Capture::BusContext::Wait, 0x808000, uint64_t(i) * 8, 0, 0);
      }
      assert(!capture.incomplete());
    }
    capture.command("stop:" + capture.sessionId());
    drain();
    const double ms = std::chrono::duration<double, std::milli>(Clock::now() - start).count();
    assert(capture.complete() && drained == events);
    assert(capture.status().find("\"producedThrough\":\"" + std::to_string(events) + "\"") != std::string::npos);
    if(comma) std::cout << ",\n";
    comma = true;
    std::cout << "{\"case\":\"" << workload.name << "\",\"sink\":\"" << (hex ? "hex" : "native-memory")
      << "\",\"sample\":" << sample << ",\"ms\":" << ms << ",\"drainMs\":" << drainMs
      << ",\"sealNs\":" << Capture::sealNanoseconds << ",\"bytes\":" << bytes << ",\"chunks\":" << chunks
      << ",\"events\":" << drained << ",\"allocatedBytes\":" << capture.allocatedBytes() << '}';
  }
  std::cout << "\n]}\n";
}
