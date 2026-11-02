import type { DebugBackendCapabilities, DebugStepKind } from "@uttori/asm-debug-adapter";

/** Backend identifier advertised by the ares RSP sidecar during negotiation. */
export const ARES_RSP_BACKEND_ID = "ares-rsp" as const;
/** Architecture id of the SNES main CPU. */
export const ARES_65816_ARCHITECTURE = "snes.65816" as const;
/** 24-bit CPU bus address space, including mapped I/O; reads may have side effects. */
export const ARES_65816_ADDRESS_SPACE = "snes.cpu" as const;
/** Side-effect-free view of the 128 KiB work RAM. */
export const ARES_65816_WRAM_ADDRESS_SPACE = "snes.wram" as const;
/** Side-effect-free view of cartridge ROM bytes by file-independent ROM offset. */
export const ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE = "snes.cartridge-rom" as const;
/** The only thread id exposed for the 65816; RSP has no multi-thread model here. */
export const ARES_65816_THREAD_ID = 1 as const;
/** The only stack frame id exposed for the 65816 stopped location. */
export const ARES_65816_FRAME_ID = 1 as const;
/** Maximum execution trace events retained by the native ring buffer. */
export const ARES_TRACE_BUFFER_EVENTS = 65_536;
/** Maximum execution trace events returned by one native batch request. */
export const ARES_TRACE_BATCH_EVENTS = 240;
const ARES_STEP_KINDS = Object.freeze<readonly DebugStepKind[]>(["instruction", "in"]);
const NO_STEP_KINDS = Object.freeze<readonly DebugStepKind[]>([]);

/** Immutable editor/sidecar negotiation profile for the patched ares RSP interface. */
export const ARES_RSP_CAPABILITIES = Object.freeze<DebugBackendCapabilities>({
  pause: true,
  step: true,
  stepKinds: ARES_STEP_KINDS,
  registers: true,
  memory: true,
  stackFrames: true,
  breakpoints: true,
  disassemble: true,
  reconnect: true,
  architectures: Object.freeze([
    Object.freeze({
      architecture: ARES_65816_ARCHITECTURE,
      addressSpaces: Object.freeze([
        ARES_65816_ADDRESS_SPACE,
        ARES_65816_WRAM_ADDRESS_SPACE,
        ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE,
      ]),
      memorySpaces: Object.freeze([
        Object.freeze({
          addressSpace: ARES_65816_WRAM_ADDRESS_SPACE,
          sideEffectFree: true,
        }),
        Object.freeze({
          addressSpace: ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE,
          sideEffectFree: true,
        }),
      ]),
      trace: Object.freeze({
        addressSpaces: Object.freeze([ARES_65816_ADDRESS_SPACE]),
        maxBufferedEvents: ARES_TRACE_BUFFER_EVENTS,
        maxBatchEvents: ARES_TRACE_BATCH_EVENTS,
        instructionDetails: false,
      }),
      pause: true,
      step: true,
      stepKinds: ARES_STEP_KINDS,
      registers: true,
      memory: true,
      stackFrames: true,
      breakpoints: true,
      disassemble: true,
    }),
    Object.freeze({
      architecture: "snes.spc700",
      addressSpaces: Object.freeze(["spc.aram"]),
      memorySpaces: Object.freeze([]),
      trace: null,
      pause: false,
      step: false,
      stepKinds: NO_STEP_KINDS,
      registers: false,
      memory: false,
      stackFrames: false,
      breakpoints: false,
      disassemble: false,
    }),
    Object.freeze({
      architecture: "snes.superfx",
      addressSpaces: Object.freeze(["superfx.ram", "superfx.rom"]),
      memorySpaces: Object.freeze([]),
      trace: null,
      pause: false,
      step: false,
      stepKinds: NO_STEP_KINDS,
      registers: false,
      memory: false,
      stackFrames: false,
      breakpoints: false,
      disassemble: false,
    }),
  ]),
});

/** Famicom exposes only features its native hooks implement; PPU capture is negotiated independently and replay remains unsupported. */
export const ARES_NES_CAPABILITIES = Object.freeze<DebugBackendCapabilities>({
  ...ARES_RSP_CAPABILITIES,
  architectures: [
    {
      architecture: "65xx.2a03",
      addressSpaces: [
        "nes.cpu",
        "nes.ram",
        "nes.prg-rom",
        "nes.chr-rom",
        "nes.prg-ram",
        "nes.ppu-snapshot",
        "nes.chr-ram",
      ],
      memorySpaces: [
        "nes.ram",
        "nes.prg-rom",
        "nes.chr-rom",
        "nes.prg-ram",
        "nes.ppu-snapshot",
        "nes.chr-ram",
        "nes.cpu",
      ].map((addressSpace) => ({ addressSpace, sideEffectFree: true })),
      trace: {
        addressSpaces: ["nes.cpu"],
        maxBufferedEvents: ARES_TRACE_BUFFER_EVENTS,
        maxBatchEvents: ARES_TRACE_BATCH_EVENTS,
        instructionDetails: true,
      },
      pause: true,
      step: true,
      stepKinds: ARES_STEP_KINDS,
      registers: true,
      memory: true,
      stackFrames: true,
      breakpoints: true,
      disassemble: true,
    },
  ],
});
