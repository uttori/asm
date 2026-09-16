#include <nall/gdb/capture-file.hpp>
#include <cassert>
#include <iostream>

using namespace ares_capture;
using Clock = std::chrono::steady_clock;

// Native test hooks hold/fail only the data-batch sync. Production code and
// checkpoint policy are unchanged; the header is durable before timing starts.
auto hexPath(const std::string& value) -> std::string {
  std::string out;
  for(unsigned char c : value) { out += "0123456789abcdef"[c >> 4]; out += "0123456789abcdef"[c & 15]; }
  return out;
}
auto waitState(FileCapture& sink, Capture& capture, const char* state) -> std::string {
  const auto deadline = Clock::now() + std::chrono::seconds(10);
  for(;;) {
    auto status = sink.command(capture, "status:" + capture.sessionId(), true);
    if(status.find(std::string("\"fileState\":\"") + state + "\"") != std::string::npos) return status;
    assert(Clock::now() < deadline);
    std::this_thread::sleep_for(std::chrono::microseconds(100));
  }
}
auto main(int argc, char** argv) -> int {
  assert(argc == 2);
  std::filesystem::create_directories(argv[1]);
  bool comma = false;
  std::cout << "{\"warmups\":1,\"measuredSamples\":3,\"runs\":[\n";
  for(unsigned mode = 0; mode < 4; ++mode) for(unsigned sample = 0; sample < 4; ++sample) {
    Capture capture; FileCapture sink;
    FileCapture::holdSync = false; FileCapture::failSyncAt = -1;
    const auto file = std::filesystem::path(argv[1]) / (std::to_string(mode) + "-" + std::to_string(sample) + ".act2");
    const auto startCommand = "start:8388608:bus:" + hexPath(file.string()) + ":" + std::string(64, 'a') + ":61726573:6175646974:profile";
    assert(sink.command(capture, startCommand, true)[0] == '{');
    waitState(sink, capture, "writing");
    if(mode == 1 || mode == 3) FileCapture::holdSync = true;
    if(mode == 2) FileCapture::failSyncAt = FileCapture::syncCalls + 1;
    unsigned events = 0;
    uint64_t peakOccupied = 0;
    const auto start = Clock::now();
    auto produce = [&] {
      capture.bus(0x7e0000, uint8_t(events), false, Capture::BusPhase::CPU, 255,
        Capture::BusContext::Wait, 0x808000, uint64_t(events) * 8, 0, 0);
      ++events;
      peakOccupied = std::max(peakOccupied, capture.occupiedBytes());
      assert(peakOccupied <= capture.allocatedBytes());
    };
    // Fill to real producer backpressure before handing one batch to the worker.
    while(capture.ready()) produce();
    sink.service(capture);
    double statusMs = 0, cancelMs = 0;
    if(mode == 1 || mode == 3) {
      const auto deadline = Clock::now() + std::chrono::seconds(10);
      while(!FileCapture::waitingSync.load()) {
        assert(Clock::now() < deadline);
        std::this_thread::sleep_for(std::chrono::microseconds(100));
      }
      const auto stalled = Clock::now();
      const auto occupied = capture.occupiedBytes();
      for(unsigned call = 0; call < 1000; ++call) {
        auto status = sink.command(capture, "status:" + capture.sessionId(), true);
        assert(status.find("\"acceptedThrough\":\"0\"") != std::string::npos);
      }
      statusMs = std::chrono::duration<double, std::milli>(Clock::now() - stalled).count();
      assert(!capture.ready() && capture.occupiedBytes() == occupied);
      if(mode == 3) {
        const auto cancel = Clock::now();
        sink.command(capture, "abort:" + capture.sessionId(), true);
        cancelMs = std::chrono::duration<double, std::milli>(Clock::now() - cancel).count();
      }
      std::this_thread::sleep_until(stalled + std::chrono::milliseconds(100));
      FileCapture::holdSync = false;
    }
    std::string position;
    if(mode < 2) {
      const auto deadline = Clock::now() + std::chrono::seconds(10);
      while(events < 262144) {
        assert(Clock::now() < deadline && !capture.incomplete());
        if(capture.ready()) produce();
        else {
          sink.service(capture);
          std::this_thread::sleep_for(std::chrono::microseconds(50));
        }
      }
      sink.command(capture, "stop:" + capture.sessionId(), true);
      position = waitState(sink, capture, "complete");
      assert(capture.complete() && capture.occupiedBytes() == 0);
      assert(position.find("\"producedThrough\":\"262144\"") != std::string::npos);
    } else {
      position = waitState(sink, capture, "incomplete");
      assert(!std::filesystem::exists(file));
      const auto deadline = Clock::now() + std::chrono::seconds(10);
      // Incomplete status can precede worker settlement. Include the public
      // release handshake, which must wait for the worker's buffer ownership.
      while(sink.command(capture, "release:" + capture.sessionId(), true) == "E09") {
        assert(Clock::now() < deadline);
        std::this_thread::sleep_for(std::chrono::microseconds(100));
      }
      assert(!sink.owns() && capture.ready());
    }
    const double ms = std::chrono::duration<double, std::milli>(Clock::now() - start).count();
    const char* cases[] = {"normal", "sync-held-100ms", "sync-failure", "abort-during-held-sync"};
    if(comma) std::cout << ",\n";
    comma = true;
    std::cout << "{\"case\":\"" << cases[mode] << "\",\"sample\":" << sample << ",\"ms\":" << ms
      << ",\"eventsAttempted\":" << events << ",\"peakOccupiedBytes\":" << peakOccupied
      << ",\"statusCalls\":" << ((mode == 1 || mode == 3) ? 1000 : 0)
      << ",\"statusTotalMs\":" << statusMs << ",\"abortCommandMs\":" << cancelMs << ",\"position\":" << position << '}';
  }
  std::cout << "\n]}\n";
}
