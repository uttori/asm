#include "capture.hpp"
#undef NDEBUG
#include <cassert>
#include <iostream>
using ares_capture::Capture;

// Standalone framing fixture. Real PPU behavior is tested by ares CTest; this
// transcript exercises mixed lengths, repeated byte destinations and queue reuse.
auto main() -> int {
  Capture capture;
  std::cout << capture.command("ppu-capabilities") << '\n';
  std::cout << capture.command("start:4718656:bus-ppu") << '\n';
  uint64_t chunk = 1, event = 0;
  auto drain = [&] {
    auto request = "read:" + capture.sessionId() + ":" + std::to_string(chunk);
    auto hex = capture.command(request);
    assert(!hex.empty() && hex == capture.command(request));
    uint32_t count = 0;
    for(unsigned i = 0; i < 4; ++i) count |= uint32_t(std::stoul(hex.substr((40 + i) * 2, 2), nullptr, 16)) << (i * 8);
    event += count;
    std::cout << hex << '\n';
    assert(capture.command("ack:" + capture.sessionId() + ":" + std::to_string(chunk++) + ":" + std::to_string(event))[0] == '{');
  };
  // Eight cases repeat across multiple chunks. The latched CGRAM byte differs
  // from the completing bus byte, and OAM writes twice to the same destination.
  for(unsigned i = 0; i < 8000; ++i) {
    if(!capture.ready()) drain();
    assert(capture.ready()); capture.ppuReset();
    unsigned port = 0x2100, value = 0xff;
    switch(i % 8) {
    case 0: port = 0x2118; capture.ppuBegin(1, 1, 100, 8); capture.ppuWrite(65534, value); break;
    case 1: port = 0x2119; capture.ppuBegin(1, 13, 102, 8); capture.ppuWrite(131071, value); break;
    case 2: port = 0x2118; capture.ppuBegin(1, 6, 104, 8); capture.ppuBlocked(); break;
    case 3: port = 0x2122; capture.ppuBegin(2, 1, 106, 8); break;
    case 4: port = 0x2122; capture.ppuBegin(2, 6, 108, 8); capture.ppuWrite(12, 0xab); capture.ppuWrite(13, 0x7f); break;
    case 5: port = 0x2104; capture.ppuBegin(3, 0, 110, 8); break;
    case 6: port = 0x2104; capture.ppuBegin(3, 2, 112, 8); capture.ppuWrite(536, 0xab); capture.ppuWrite(536, value); break;
    }
    capture.bus(port, value, true, Capture::BusPhase::CPU, 255, Capture::BusContext::Unattributed, 0x808000, i * 2, i % 1364, 8);
  }
  capture.command("stop:" + capture.sessionId()); drain();
  assert(event == 8000);
  std::cout << capture.command("status:" + capture.sessionId()) << '\n';
  // Fail closed on a missing hook, and erase pending effects when starting again.
  assert(capture.command("start:4718656:bus-ppu")[0] == '{');
  capture.ppuBegin(3, 1, 0, 0); capture.ppuReset();
  capture.bus(0x2104, 0, true, Capture::BusPhase::CPU, 255, Capture::BusContext::Unattributed, 0, 0, 0, 0);
  assert(capture.status().find("incomplete") != std::string::npos);
  assert(capture.command("start:4718656:bus-ppu")[0] == '{');
  capture.bus(0x2100, 0, true, Capture::BusPhase::CPU, 255, Capture::BusContext::Unattributed, 0, 0, 0, 0);
  assert(capture.status().find("incomplete") == std::string::npos);
}
