#include "capture.hpp"
#include "send-all.hpp"
#undef NDEBUG
#include <cassert>
#include <iostream>
using ares_capture::Capture;

auto main() -> int {
  // Short writes and EAGAIN/EINTR preserve the exact output prefix. A stopped
  // or replaced connection must not receive the unsent tail.
  std::array<uint8_t, 7> input{1, 2, 3, 4, 5, 6, 7};
  std::vector<uint8_t> output;
  unsigned calls = 0, waits = 0;
  assert(nall::TCP::sendAll(input.data(), input.size(), [&](const uint8_t* p, size_t n) -> int64_t {
    if(++calls % 2 == 0) return -1;
    auto count = std::min<size_t>(2, n); output.insert(output.end(), p, p + count); return count;
  }, [] { return true; }, [&] { ++waits; }));
  assert(output == std::vector<uint8_t>(input.begin(), input.end()) && waits == 3);
  calls = 0;
  assert(!nall::TCP::sendAll(input.data(), input.size(), [&](const uint8_t*, size_t) -> int64_t { ++calls; return -1; }, [&] { return calls < 3; }, [] {}));
  assert(calls == 3);
  assert(!nall::TCP::sendAll(input.data(), input.size(), [](const uint8_t*, size_t) -> int64_t { return 0; }, [] { return true; }, [] {}));
  Capture c;
  assert(c.command("start:1") == "E02");
  assert(c.command("start:000200000") == "E02");
  assert(c.command("start:18446744073709551616") == "E02");
  const auto budget = Capture::overheadBytes + 2 * sizeof(Capture::Chunk);
  c.command("start:" + std::to_string(budget));
  auto session = c.sessionId();
  assert(session.size() == 32 && c.allocatedBytes() <= budget);
  assert(c.command("start:" + std::to_string(budget)) == "E03");
  assert(c.command("read:" + session + ":1").empty());
  unsigned produced = 0;
  std::array<uint16_t, 10> state{}; state[7] = 0x8000; state[8] = 0x30; state[9] = 1;
  while(c.ready()) {
    c.begin(0x8000, state, produced * 6); c.fetch(0xea); c.end(); ++produced;
  }
  assert(produced > 0 && produced < 4000);
  auto chunk = c.command("read:" + session + ":1");
  for(unsigned retry = 0; retry < 10; ++retry) {
    assert(!c.ready());
    assert(c.command("read:" + session + ":1") == chunk);
  }
  assert(c.command("read:" + session + ":2") == "E06");
  assert(c.command("ack:00000000000000000000000000000000:1:1") == "E05");
  assert(c.command("ack:" + session + ":1:9999") == "E07");
  auto ack = "ack:" + session + ":1:" + std::to_string(produced);
  assert(c.command(ack)[0] == '{');
  assert(c.command(ack)[0] == '{');
  assert(c.ready());
  c.begin(0x8000, state, 10000); c.fetch(0xea);
  assert(c.command("read:" + session + ":2").empty());
  c.command("stop:" + session);
  assert(c.status().find("stopping") != std::string::npos);
  c.end();
  assert(c.command("ack:" + session + ":2:" + std::to_string(produced + 1)) == "E07");
  c.command("read:" + session + ":2");
  c.command("ack:" + session + ":2:" + std::to_string(produced + 1));
  assert(c.status().find("complete") != std::string::npos);
  c.command("start:" + std::to_string(budget));
  assert(c.sessionId() != session);
  session = c.sessionId();
  c.command("stop:" + session);
  assert(c.status().find("\"producedThrough\":\"0\"") != std::string::npos);
  assert(c.status().find("complete") != std::string::npos);
  c.command("start:" + std::to_string(budget)); session = c.sessionId();
  c.fail("disk-full"); assert(!c.ready());
  assert(c.command("stop:" + session).find("incomplete") != std::string::npos);
  c.command("release:" + session); assert(c.ready());
  std::cout << chunk << '\n'; // consumed by the TypeScript interoperability test
  std::cerr << "PASS bounded reservation, slow consumer, retries, ack validation, pending stop, empty capture, failure\n";
}
