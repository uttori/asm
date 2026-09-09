// Local macOS/Linux desktop validation client. No Node or external ROM required.
#include <algorithm>
#include <arpa/inet.h>
#include <poll.h>
#include <sys/socket.h>
#include <unistd.h>
#include <array>
#include <chrono>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>

using Clock = std::chrono::steady_clock;
using namespace std::chrono_literals;

auto require(bool condition, const char* message) -> void {
  if(!condition) throw std::runtime_error(message);
}

auto fixture(const char* path) -> void {
  std::array<uint8_t, 0x8000> rom;
  rom.fill(0xea);
  const uint8_t program[] = {0x78, 0xd8, 0xa2, 0xff, 0x9a, 0xe6, 0x00, 0x80, 0xfc};
  std::copy(std::begin(program), std::end(program), rom.begin());
  std::fill(rom.begin() + 0x7fc0, rom.end(), 0);
  std::memcpy(rom.data() + 0x7fc0, "ARES DEBUG FIXTURE   ", 20);
  const uint8_t header[] = {0x20, 0x02, 0x05, 0x03, 0x01, 0x33, 0x00};
  std::copy(std::begin(header), std::end(header), rom.begin() + 0x7fd5);
  for(auto vector : {0x7fea, 0x7fee, 0x7ffa, 0x7ffc, 0x7ffe}) rom[vector + 1] = 0x80;
  uint16_t checksum = 0x1fe;
  for(auto byte : rom) checksum += byte;
  rom[0x7fdc] = checksum ^ 0xff; rom[0x7fdd] = (checksum >> 8) ^ 0xff;
  rom[0x7fde] = checksum; rom[0x7fdf] = checksum >> 8;
  std::ofstream output(path, std::ios::binary);
  output.write(reinterpret_cast<const char*>(rom.data()), rom.size());
  require(bool(output), "cannot write fixture");
}

struct Client {
  int fd = -1;
  ~Client() { if(fd >= 0) ::close(fd); }

  explicit Client(int port) {
    auto deadline = Clock::now() + 15s;
    do {
      fd = ::socket(AF_INET, SOCK_STREAM, 0);
      sockaddr_in address{};
      address.sin_family = AF_INET;
      address.sin_port = htons(port);
      address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
      if(::connect(fd, reinterpret_cast<sockaddr*>(&address), sizeof(address)) == 0) break;
      ::close(fd); fd = -1;
      std::this_thread::sleep_for(50ms);
    } while(Clock::now() < deadline);
    require(fd >= 0, "connection timed out");
#if defined(SO_NOSIGPIPE)
    int enabled = 1;
    setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &enabled, sizeof(enabled));
#endif
    send("+");
  }

  auto send(const std::string& data) -> void {
    size_t offset = 0;
    while(offset < data.size()) {
      auto size = ::send(fd, data.data() + offset, data.size() - offset, 0);
      require(size > 0, "socket write failed");
      offset += size;
    }
  }

  auto packet(const std::string& data) -> void {
    uint8_t checksum = 0;
    for(auto byte : data) checksum += uint8_t(byte);
    const char* hex = "0123456789abcdef";
    send("$" + data + "#" + hex[checksum >> 4] + hex[checksum & 15]);
  }

  auto receive() -> std::string {
    auto deadline = Clock::now() + 1500ms;
    auto byte = [&]() -> char {
      int timeout = std::chrono::duration_cast<std::chrono::milliseconds>(deadline - Clock::now()).count();
      pollfd descriptor{fd, POLLIN, 0};
      require(timeout > 0 && ::poll(&descriptor, 1, timeout) > 0, "RSP response timed out; closing client");
      char value;
      require(::recv(fd, &value, 1, 0) == 1, "RSP connection closed");
      return value;
    };
    while(byte() != '$') {}
    std::string data;
    uint8_t checksum = 0;
    for(char value = byte(); value != '#'; value = byte()) {
      require(data.size() < 1024 * 1024, "oversized packet");
      data += value;
      checksum += uint8_t(value);
    }
    std::string encoded; encoded += byte(); encoded += byte();
    require(std::stoul(encoded, nullptr, 16) == checksum, "bad response checksum");
    send("+");
    return data;
  }

  auto request(const std::string& command, bool stop = false) -> std::string {
    packet(command);
    for(;;) {
      auto response = receive();
      bool stopped = !response.empty() && (response[0] == 'S' || response[0] == 'T');
      if(stopped == stop) return response;
    }
  }

  auto pc() -> unsigned {
    auto registers = request("g");
    require(registers.size() == 32, "unexpected register packet");
    return std::stoul(registers.substr(22, 2), nullptr, 16) * 65536
      + std::stoul(registers.substr(26, 2), nullptr, 16) * 256
      + std::stoul(registers.substr(24, 2), nullptr, 16);
  }
};

auto main(int argc, char** argv) -> int {
  try {
    if(argc == 3 && std::string(argv[1]) == "--fixture") { fixture(argv[2]); return 0; }
    require(argc == 2, "usage: desktop-state-rsp PORT | --fixture FILE");
    Client client(std::stoi(argv[1]));
    require(client.request("qSupported").find("uttoriInstructionDetails+") != std::string::npos, "rich trace capability missing");
    client.request("?", true);
    require(client.pc() == 0x8000, "attach did not stop at reset vector");
    require(client.request("QUttoriTrace:2") == "OK", "cannot enable rich tracing");
    std::string saved = client.request("g"), undo;
    std::cout << "READY: paused at 8000; save slot 1 in the desktop\n" << std::flush;
    for(std::string action; std::getline(std::cin, action);) {
      if(action == "advance") {
        for(auto pc : {0x8001u, 0x8002u, 0x8004u, 0x8005u}) {
          client.request("s", true);
          require(client.pc() == pc, "incorrect instruction step");
        }
        undo = client.request("g");
        std::cout << "READY: paused at 8005; load slot 1 in the desktop\n";
      } else if(action == "poll") {
        auto end = Clock::now() + 15s;
        unsigned count = 0;
        while(Clock::now() < end) {
          require(client.request("g").size() == 32, "register request failed during state operation");
          ++count;
          std::this_thread::sleep_for(20ms);
        }
        std::cout << "PASS: " << count << " register requests during desktop state operation\n";
      } else if(action == "loaded" || action == "undo") {
        auto expected = action == "loaded" ? saved : undo;
        require(!expected.empty(), "no expected snapshot");
        for(unsigned i = 0; i < 50; ++i) {
          require(client.request("g") == expected, "loaded state changed or emulation resumed");
          std::this_thread::sleep_for(10ms);
        }
        std::cout << "PASS: " << action << " preserved registers and pause over 50 socket requests\n";
      } else if(action == "control") {
        require(client.pc() == 0x8005, "control check requires restored undo at 8005");
        client.request("s", true);
        require(client.pc() == 0x8007, "step after load failed");
        require(client.request("Z0,8005,1") == "OK", "breakpoint insertion failed");
        client.request("c", true);
        require(client.pc() == 0x8005, "continue after load failed");
        require(client.request("z0,8005,1") == "OK", "breakpoint removal failed");
        client.packet("c");
        std::this_thread::sleep_for(20ms);
        client.send(std::string(1, 3));
        auto stop = client.receive();
        require(stop.starts_with("S05") || stop.starts_with("T05"), "pause after continue failed");
        auto trace = client.request("qUttoriTraceDetailRead:10");
        require(trace.starts_with("1:"), "rich trace stopped working after load");
        std::cout << "PASS: step, continue, breakpoint, Ctrl-C and rich trace after load/undo\n";
      } else if(action == "quit") {
        require(client.request("D") == "OK", "detach failed");
        break;
      } else {
        throw std::runtime_error("unknown action");
      }
      std::cout << std::flush;
    }
  } catch(const std::exception& error) {
    std::cerr << "FAIL: " << error.what() << '\n';
    return 1;
  }
}
