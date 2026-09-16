#include "capture.hpp"
#undef NDEBUG
#include <cassert>
#include <iostream>
using ares_capture::Capture;

// Emit native protocol evidence for consumers without a ROM, GUI or JavaScript
// harness. The full chunk and stopped tail both belong to one pending instruction.
auto main() -> int {
  Capture capture;
  std::cout << capture.command("bus-capabilities") << '\n';
  const auto budget = Capture::overheadBytes + 2 * sizeof(Capture::Chunk);
  std::cout << capture.command("start:" + std::to_string(budget) + ":bus") << '\n';
  const auto session = capture.sessionId();
  assert(capture.busActive());
  capture.begin(0x808000, {}, 0);
  for(unsigned i = 0; i < 4100; ++i) {
    if(i == 4095) {
      assert(!capture.ready());
      const auto chunk = capture.command("read:" + session + ":1");
      assert(chunk.size() == Capture::chunkBytes * 2);
      assert(capture.command("read:" + session + ":1") == chunk);
      std::cout << chunk << '\n';
      assert(capture.command("ack:" + session + ":1:4095")[0] == '{');
    }
    assert(capture.ready());
    const auto phase = Capture::BusPhase(i % 5);
    const uint8_t channel = phase == Capture::BusPhase::CPU ? 255 : i % 8;
    capture.bus(0x7e1000 + i, i % 256, false, phase, channel,
      Capture::BusContext::Unattributed, 0, uint64_t(i) * 8, (i * 8) % 1368, i % 313);
  }
  assert(capture.pendingInstruction());
  capture.command("stop:" + session);
  assert(!capture.pendingInstruction());
  std::cout << capture.command("read:" + session + ":2") << '\n';
  const auto terminal = capture.command("ack:" + session + ":2:4100");
  assert(terminal.find("\"state\":\"complete\"") != std::string::npos);
  std::cout << terminal << '\n';
}
