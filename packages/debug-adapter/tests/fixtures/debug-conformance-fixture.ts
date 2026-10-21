import type { DebugBackendConformanceFixture, ReplayScript } from "../../src/index.js";

export const conformanceAddress = (value: number) => ({
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  address: value,
});

const snapshot = (pc: number, accumulator: string) => ({
  threads: [
    { id: 1, name: "Main CPU", architecture: "snes.65816" },
    { id: 2, name: "Audio CPU", architecture: "snes.spc700" },
  ],
  frames: [
    { id: 10, threadId: 1, name: "65816", pc: conformanceAddress(pc) },
    {
      id: 20,
      threadId: 2,
      name: "SPC700",
      pc: { architecture: "snes.spc700", addressSpace: "spc.aram", address: 0x200 },
    },
  ],
  registers: {
    10: [
      { name: "A", value: accumulator, bits: 16 },
      { name: "PC", value: pc.toString(16), bits: 24 },
    ],
    20: [{ name: "A", value: "00", bits: 8 }],
  },
  memory: [
    { addressSpace: "snes.cpu", start: 0x808000, bytes: [0xea, 0xea, 0xdb] },
    { addressSpace: "spc.aram", start: 0x200, bytes: [0x00] },
  ],
  instructions: [
    {
      address: conformanceAddress(pc),
      bytes: [pc === 0x808002 ? 0xdb : 0xea],
      text: "nop",
    },
    {
      address: { architecture: "snes.spc700", addressSpace: "spc.aram", address: 0x200 },
      bytes: [0x00],
      text: "nop",
    },
  ],
});

export const debugConformanceScript: ReplayScript = {
  snapshots: [snapshot(0x808000, "0000"), snapshot(0x808001, "0001"), snapshot(0x808002, "0002")],
  architectures: [
    {
      architecture: "snes.65816",
      addressSpaces: ["snes.cpu"],
      memorySpaces: [{ addressSpace: "snes.cpu", sideEffectFree: true }],
      trace: {
        addressSpaces: ["snes.cpu"],
        maxBufferedEvents: 65_536,
        maxBatchEvents: 4_096,
        instructionDetails: false,
      },
      pause: true,
      step: true,
      stepKinds: ["instruction", "over", "in", "out"],
      registers: true,
      memory: true,
      stackFrames: true,
      breakpoints: true,
      disassemble: true,
    },
    {
      architecture: "snes.spc700",
      addressSpaces: ["spc.aram"],
      memorySpaces: [{ addressSpace: "spc.aram", sideEffectFree: true }],
      trace: {
        addressSpaces: ["spc.aram"],
        maxBufferedEvents: 65_536,
        maxBatchEvents: 4_096,
        instructionDetails: false,
      },
      pause: true,
      step: false,
      stepKinds: [],
      registers: true,
      memory: true,
      stackFrames: true,
      breakpoints: false,
      disassemble: true,
    },
    {
      architecture: "snes.superfx",
      addressSpaces: ["superfx.rom", "superfx.ram"],
      memorySpaces: [
        { addressSpace: "superfx.rom", sideEffectFree: true },
        { addressSpace: "superfx.ram", sideEffectFree: true },
      ],
      trace: null,
      pause: false,
      step: false,
      stepKinds: [],
      registers: false,
      memory: true,
      stackFrames: false,
      breakpoints: false,
      disassemble: true,
    },
  ],
};

export const debugConformanceFixture: DebugBackendConformanceFixture = {
  architectures: [
    {
      architecture: "snes.65816",
      addressSpaces: ["snes.cpu"],
      memorySpaces: [{ addressSpace: "snes.cpu", sideEffectFree: true }],
      capabilities: { step: true, registers: true, memory: true, breakpoints: true },
    },
    {
      architecture: "snes.spc700",
      addressSpaces: ["spc.aram"],
      memorySpaces: [{ addressSpace: "spc.aram", sideEffectFree: true }],
      capabilities: { step: false, registers: true, memory: true },
    },
    {
      architecture: "snes.superfx",
      addressSpaces: ["superfx.rom", "superfx.ram"],
      memorySpaces: [
        { addressSpace: "superfx.rom", sideEffectFree: true },
        { addressSpace: "superfx.ram", sideEffectFree: true },
      ],
      capabilities: { step: false, registers: false, memory: true },
    },
  ],
  primaryArchitecture: "snes.65816",
  primaryAddressSpace: "snes.cpu",
  initialAddress: conformanceAddress(0x808000),
  steppedAddress: conformanceAddress(0x808001),
  breakpointAddress: conformanceAddress(0x808002),
  memoryAddress: conformanceAddress(0x808000),
  memoryBytes: [0xea, 0xea, 0xdb],
  requiredRegisters: ["A", "PC"],
  disassemblyAddress: conformanceAddress(0x808000),
  disassemblyText: "nop",
};
