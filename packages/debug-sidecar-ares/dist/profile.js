export const ARES_RSP_BACKEND_ID = "ares-rsp";
export const ARES_65816_ARCHITECTURE = "snes.65816";
export const ARES_65816_ADDRESS_SPACE = "snes.cpu";
export const ARES_65816_WRAM_ADDRESS_SPACE = "snes.wram";
export const ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE = "snes.cartridge-rom";
export const ARES_65816_THREAD_ID = 1;
export const ARES_65816_FRAME_ID = 1;
export const ARES_TRACE_BUFFER_EVENTS = 65_536;
export const ARES_TRACE_BATCH_EVENTS = 240;
const ARES_STEP_KINDS = Object.freeze(["instruction", "in"]);
const NO_STEP_KINDS = Object.freeze([]);
/** Immutable editor/sidecar negotiation profile for the patched ares RSP interface. */
export const ARES_RSP_CAPABILITIES = Object.freeze({
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
//# sourceMappingURL=profile.js.map