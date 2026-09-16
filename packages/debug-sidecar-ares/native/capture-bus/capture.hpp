#pragma once

// Downstream ACT2 producer with separately negotiated instruction and bus scopes.
// No ares or transport dependencies; callers serialize access through the
// emulation thread or the frontend's guarded handoff.
#include <array>
#include <charconv>
#include <cstdint>
#include <cstring>
#include <limits>
#include <random>
#include <string>
#include <vector>

namespace ares_capture {
class Capture {
public:
  static constexpr uint32_t chunkBytes = 262144;
  static constexpr uint32_t recordReserve = 71; // 32 common + 19 identity + 4 fetched + 16 state
  static constexpr uint32_t busRecordBytes = 64;
  // These values are the private bus record's wire dictionary. A phase describes
  // the actual operation, independent of mutable DMA enable bits.
  enum class BusPhase : uint8_t { CPU, DMA, HDMATable, HDMAIndirect, HDMATransfer };
  enum class BusContext : uint8_t { Unattributed, Instruction, Interrupt, Wait, Stop };
  // Covers the fixed record scratch, queue bookkeeping and bounded hex/JSON
  // response temporaries. TCP socket buffers belong to the transport budget.
  static constexpr uint32_t overheadBytes = 4194304;
  struct Chunk {
    std::array<uint8_t, chunkBytes> bytes{};
    uint64_t sequence{}, first{};
    uint32_t used{64}, count{};
    bool sealed{};
  };

  auto active() const -> bool { return recording; }
  auto busScope() const -> bool { return busOnly; }
  auto busActive() const -> bool { return busOnly && recording; }
  auto pendingInstruction() const -> bool { return pending; }
  auto occupiedBytes() const -> uint64_t { return uint64_t(size) * sizeof(Chunk); }
  auto allocatedBytes() const -> uint64_t { return uint64_t(queue.size()) * sizeof(Chunk) + overheadBytes; }
  auto sessionId() const -> const std::string& { return session; }
  auto clockRate(uint64_t numerator, uint64_t denominator) -> void { clockNumerator = numerator; clockDenominator = denominator; }

  // Called BEFORE an instruction or bus operation begins. A false return
  // requires yielding to the frontend without performing that operation.
  auto ready() -> bool {
    if(failed) return false;
    if(!recording) return true;
    bool tailRoom = false;
    if(size) {
      auto& tail = queue[(head + size - 1) % queue.size()];
      tailRoom = !tail.sealed && tail.used + reserveBytes() <= chunkBytes;
    }
    bool room = tailRoom || size < queue.size();
    if(throttled && (size > queue.size() / 4 || !room)) return false;
    if(!room || (!throttled && !tailRoom && size >= highWater)) {
      if(!throttled) { throttled = true; ++throttleCount; }
      return false;
    }
    throttled = false;
    state = "recording";
    return true;
  }

  auto begin(uint64_t pc, const std::array<uint16_t, 10>& registers, uint64_t cycle) -> void {
    if(!recording) return;
    if(pending || !ready() || produced == UINT64_MAX || ordinal == UINT64_MAX) { fail("instruction-reserve"); return; }
    ++ordinal;
    pending = true;
    pendingPC = pc; pendingState = registers; pendingCycle = cycle; fetchedCount = 0;
  }
  auto fetch(uint8_t byte) -> void {
    if(!pending || busOnly) return;
    if(fetchedCount == fetched.size()) { fail("fetched-byte-bound"); return; }
    fetched[fetchedCount++] = byte;
  }
  // WAI/STP commit on their first idle boundary. Subsequent idle cycles and
  // interrupt entry are excluded by this instruction-only scope.
  auto end() -> void {
    if(!pending) return;
    pending = false;
    if(busOnly) return;
    if(!fetchedCount) { fail("missing-fetched-bytes"); return; }
    uint32_t length = 67 + fetchedCount;
    auto* out = append(1, length, pendingCycle);
    if(!out) return;
    put(out + 32, ordinal, 8);
    put(out + 40, pendingPC, 8); out[48] = fetchedCount; put(out + 49, 16, 2);
    std::memcpy(out + 51, fetched.data(), fetchedCount);
    auto* regs = out + 51 + fetchedCount;
    for(unsigned i = 0; i < 5; ++i) put(regs + i * 2, pendingState[i], 2);
    regs[10] = pendingState[5]; regs[11] = pendingState[6];
    put(regs + 12, pendingState[7], 2); regs[14] = pendingState[8]; regs[15] = pendingState[9];
    auto& tail = queue[(head + size - 1) % queue.size()];
    if(!recording) { seal(tail); state = "draining"; }
  }

  // ready() must succeed immediately before the real bus operation. Append the
  // observed value immediately afterwards, before clocks or another bus access.
  // Ordinal zero explicitly means no captured instruction owns this access.
  auto bus(uint32_t address, uint8_t value, bool write, BusPhase phase, uint8_t channel,
           BusContext context, uint32_t pc, uint64_t cycle, uint16_t h, uint16_t v) -> void {
    if(!busActive()) return;
    auto* out = append(2, busRecordBytes, cycle);
    if(!out) return;
    put(out + 32, pending ? ordinal : 0, 8);
    put(out + 40, address, 8);
    put(out + 48, pending ? pendingPC : pc, 4);
    out[52] = value; out[53] = write;
    out[54] = 2;
    if(phase == BusPhase::CPU) out[54] = 0;
    if(phase == BusPhase::DMA) out[54] = 1;
    out[55] = channel; out[56] = uint8_t(phase);
    out[57] = uint8_t(pending ? BusContext::Instruction : context);
    put(out + 58, h, 2); put(out + 60, v, 2); put(out + 62, 0, 2);
  }

  auto fail(const std::string& reason) -> void {
    if(session.empty() || state == "complete" || state == "incomplete") return;
    recording = pending = false; failed = true; state = "incomplete"; error = reason;
    if(size) seal(queue[(head + size - 1) % queue.size()]);
  }

  auto command(const std::string& request) -> std::string {
    auto fields = split(request);
    if(fields.empty()) return "E01";
    if(fields[0] == "capabilities" && fields.size() == 1)
      return "{\"version\":2,\"scope\":\"snes.65816.instructions\",\"mode\":\"lossless\",\"ownership\":\"durable-prefix\",\"maxChunkBytes\":262144,\"requiredReserveBytes\":71,\"overheadBytes\":4194304,\"resumeSession\":false}";
    if(fields[0] == "bus-capabilities" && fields.size() == 1)
      return "{\"version\":2,\"scope\":\"snes.cpu-bus\",\"mode\":\"lossless\",\"ownership\":\"durable-prefix\",\"maxChunkBytes\":262144,\"requiredReserveBytes\":64,\"overheadBytes\":4194304,\"resumeSession\":false}";
    if(fields[0] == "start" && (fields.size() == 2 || (fields.size() == 3 && fields[2] == "bus"))) {
      uint64_t budget;
      if(!number(fields[1], budget) || budget > 64 * 1024 * 1024 || budget < overheadBytes + 2 * sizeof(Chunk)) return "E02";
      if(!session.empty() && state != "complete" && state != "incomplete") return "E03";
      std::array<uint8_t, 16> id{};
      try { std::random_device rng; for(auto& byte : id) byte = rng(); }
      catch(...) { return "E04"; }
      // An explicit new session discards the previous stopped/incomplete queue.
      // Release it before allocating, so rearming cannot double the byte budget.
      std::vector<Chunk>().swap(queue);
      head = size = 0;
      std::vector<Chunk> fresh;
      try { fresh.resize((budget - overheadBytes) / sizeof(Chunk)); }
      catch(...) { return "E04"; }
      auto numerator = clockNumerator, denominator = clockDenominator;
      *this = Capture{};
      busOnly = fields.size() == 3;
      clockRate(numerator, denominator);
      queue = std::move(fresh); sessionBytes = id; session = hex(id.data(), id.size());
      highWater = std::max<size_t>(1, queue.size() * 3 / 4);
      recording = true; state = "armed";
      return status();
    }
    if(fields.size() < 2 || fields[1] != session || session.empty()) return "E05";
    if(fields[0] == "status" && fields.size() == 2) return status();
    if(fields[0] == "stop" && fields.size() == 2) {
      recording = false;
      // Bus records commit independently; stopping fixes the last completed bus
      // event even if the containing instruction/DMA transfer has not finished.
      if(busOnly) pending = false;
      if(!failed && state != "complete") {
        state = pending ? "stopping" : "draining";
        if(!pending && size) seal(queue[(head + size - 1) % queue.size()]);
        completeIfDrained();
      }
      return status();
    }
    if(fields[0] == "abort" && fields.size() == 2) { fail("consumer-aborted"); return status(); }
    // Explicit recovery of debugger control after an incomplete capture. It
    // never changes integrity or starts/resumes a capture.
    if(fields[0] == "release" && fields.size() == 2 && state == "incomplete") { failed = false; return status(); }
    uint64_t seq;
    if(fields[0] == "read" && fields.size() == 3 && number(fields[2], seq)) {
      if(seq != acceptedChunk + 1) return "E06";
      if(!size) return "";
      auto& front = queue[head];
      // A pending instruction reserved the current tail. Do not seal that
      // reservation out from under it (e.g. a frame exit inside DMA).
      if(!front.sealed && pending && !busOnly) return "";
      seal(front); delivered = front.first + front.count - 1;
      return hex(front.bytes.data(), front.used);
    }
    uint64_t event;
    if(fields[0] == "ack" && fields.size() == 4 && number(fields[2], seq) && number(fields[3], event)) {
      if(seq == acceptedChunk && event == accepted) return status();
      if(!size) return "E07";
      auto& front = queue[head];
      if(!front.sealed || seq != front.sequence || event != front.first + front.count - 1 || event != delivered) return "E07";
      acceptedChunk = seq; accepted = event;
      head = (head + 1) % queue.size(); --size;
      completeIfDrained();
      return status();
    }
    return "E08";
  }

  auto status() const -> std::string {
    auto q = [](uint64_t v) { return "\"" + std::to_string(v) + "\""; };
    return "{\"scope\":\"" + std::string(busOnly ? "snes.cpu-bus" : "snes.65816.instructions") +
      "\",\"session\":\"" + session + "\",\"state\":\"" + (throttled && recording ? "throttled" : state) +
      "\",\"producedThrough\":" + q(produced) + ",\"deliveredThrough\":" + q(delivered) +
      ",\"acceptedThrough\":" + q(accepted) + ",\"durableThrough\":" + q(accepted) +
      ",\"releasedThrough\":" + q(accepted) + ",\"chunkThrough\":" + q(acceptedChunk) +
      ",\"producedChunks\":" + q(chunks) + ",\"bufferedBytes\":" + std::to_string(occupiedBytes()) +
      ",\"clockNumerator\":" + q(clockNumerator) + ",\"clockDenominator\":" + q(clockDenominator) +
      ",\"allocatedBytes\":" + std::to_string(allocatedBytes()) +
      ",\"throttleCount\":" + q(throttleCount) + ",\"droppedInScope\":\"0\",\"error\":\"" + error + "\"}";
  }

private:
  std::vector<Chunk> queue;
  size_t head{}, size{}, highWater{};
  std::string session, state{"idle"}, error;
  std::array<uint8_t, 16> sessionBytes{};
  uint64_t produced{}, chunks{}, delivered{}, accepted{}, acceptedChunk{}, throttleCount{};
  uint64_t clockNumerator{236250000}, clockDenominator{11};
  bool recording{}, throttled{}, pending{}, failed{}, busOnly{};
  uint64_t ordinal{};
  uint64_t pendingPC{}, pendingCycle{};
  std::array<uint16_t, 10> pendingState{};
  std::array<uint8_t, 4> fetched{};
  uint8_t fetchedCount{};

  auto reserveBytes() const -> uint32_t { return busOnly ? busRecordBytes : recordReserve; }

  // Commit one record into already reserved queue capacity. Both scopes share
  // chunk ownership, retry/ack semantics, and the same bounded allocation.
  auto append(uint16_t kind, uint32_t length, uint64_t cycle) -> uint8_t* {
    if(produced == UINT64_MAX) { fail("event-overflow"); return nullptr; }
    if(size) {
      auto& tail = queue[(head + size - 1) % queue.size()];
      if(tail.used + reserveBytes() > chunkBytes) seal(tail);
    }
    if(!size || queue[(head + size - 1) % queue.size()].sealed) {
      if(size == queue.size() || chunks == UINT64_MAX) { fail("reserve-violation"); return nullptr; }
      auto& fresh = queue[(head + size++) % queue.size()];
      fresh = {}; fresh.sequence = ++chunks; fresh.first = produced + 1;
    }
    auto& tail = queue[(head + size - 1) % queue.size()];
    auto* out = tail.bytes.data() + tail.used;
    put(out, kind, 2); put(out + 2, 1, 2); put(out + 4, length, 4);
    put(out + 8, ++produced, 8); put(out + 16, 0, 4); put(out + 20, 0, 4);
    put(out + 24, cycle, 8);
    tail.used += length; ++tail.count;
    return out;
  }

  auto completeIfDrained() -> void { if(!failed && !recording && !pending && !size) state = "complete"; }
  static auto put(uint8_t* out, uint64_t value, unsigned bytes) -> void {
    for(unsigned i = 0; i < bytes; ++i) out[i] = value >> (8 * i);
  }
  static auto hex(const uint8_t* bytes, size_t count) -> std::string {
    const char* digits = "0123456789abcdef";
    std::string out(count * 2, '0');
    for(size_t i = 0; i < count; ++i) { out[i * 2] = digits[bytes[i] >> 4]; out[i * 2 + 1] = digits[bytes[i] & 15]; }
    return out;
  }
  static auto number(const std::string& s, uint64_t& out) -> bool {
    if(s.empty() || (s.size() > 1 && s[0] == '0')) return false;
    auto r = std::from_chars(s.data(), s.data() + s.size(), out);
    return r.ec == std::errc{} && r.ptr == s.data() + s.size();
  }
  static auto split(const std::string& value) -> std::vector<std::string> {
    std::vector<std::string> parts;
    size_t begin = 0;
    for(size_t i = 0; i <= value.size(); ++i) if(i == value.size() || value[i] == ':') {
      parts.push_back(value.substr(begin, i - begin)); begin = i + 1;
      if(parts.size() > 4) return {};
    }
    return parts;
  }
  auto seal(Chunk& chunk) -> void {
    if(chunk.sealed) return;
    auto* p = chunk.bytes.data();
    std::memcpy(p, "ACT2", 4); put(p + 4, 2, 2); put(p + 6, 0, 2);
    std::memcpy(p + 8, sessionBytes.data(), 16);
    put(p + 24, chunk.sequence, 8); put(p + 32, chunk.first, 8);
    put(p + 40, chunk.count, 4); put(p + 44, 64, 4);
    put(p + 48, chunk.used - 64, 4); put(p + 52, chunk.used - 64, 4);
    put(p + 56, 0, 8);
    uint32_t crc = ~uint32_t(0);
    for(uint32_t i = 0; i < chunk.used; ++i) {
      crc ^= p[i];
      for(unsigned bit = 0; bit < 8; ++bit) crc = (crc >> 1) ^ (0x82f63b78u & (0u - (crc & 1)));
    }
    put(p + 56, ~crc, 4); chunk.sealed = true;
  }
};
}
