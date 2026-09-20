#include "capture.hpp"
#undef NDEBUG
#include <cassert>
#include <iostream>
using ares_capture::Capture;

// Native framing fixture: a large DMA run crosses chunks and remains one transfer.
// Output is consumed by the existing TypeScript decoder tests. This harness needs only C++17.
auto main() -> int {
  Capture capture;
  std::cout << capture.command("transfer-capabilities") << '\n';
  std::cout << capture.command("start:4718656:bus-transfers") << '\n';
  const auto session = capture.sessionId();
  uint64_t chunk = 1, event = 0;
  auto drain = [&] {
    auto text = capture.command("read:" + session + ":" + std::to_string(chunk));
    assert(!text.empty() && text == capture.command("read:" + session + ":" + std::to_string(chunk)));
    uint32_t count = 0;
    for(unsigned i = 0; i < 4; ++i) count |= uint32_t(std::stoul(text.substr((40 + i) * 2, 2), nullptr, 16)) << (i * 8);
    event += count;
    std::cout << text << '\n';
    assert(capture.command("ack:" + session + ":" + std::to_string(chunk++) + ":" + std::to_string(event))[0] == '{');
  };
  capture.begin(0x808000, {}, 0);
  assert(capture.ready());
  std::array<uint8_t, 12> configuration{8, 0x20, 0, 0, 0x7e, 0, 2, 8, 0, 0, 0, 1};
  auto token = capture.transfer(0, false, 0, 0, configuration, {}, Capture::BusContext::Instruction, 0x808000, 0, 0, 0);
  for(unsigned i = 0; i < 4100; ++i) {
    if(!capture.ready()) drain();
    assert(capture.ready());
    capture.bus(i % 2 ? 0x2120 : 0x7e0000, 0x5a, i % 2,
      Capture::BusPhase::DMA, 0, Capture::BusContext::Instruction, 0x808000, uint64_t(i) * 4, (i * 4) % 1368, 0);
  }
  if(!capture.ready()) drain();
  configuration[6] = configuration[7] = 0;
  capture.transfer(1, false, 0, 2050, configuration, token, Capture::BusContext::Instruction, 0x808000, 16400, 0, 1);
  capture.command("stop:" + session);
  drain();
  assert(event == 4102);
  std::cout << capture.command("status:" + session) << '\n';
}
