export const MESEN_BACKEND_ID = "mesence-debug-server";
export const MESEN_NATIVE_PROTOCOL_VERSION = 1;
export const MESEN_65816_ARCHITECTURE = "snes.65816";
export const MESEN_SPC700_ARCHITECTURE = "snes.spc700";
export const MESEN_SUPERFX_ARCHITECTURE = "snes.superfx";
export const MESEN_65816_ADDRESS_SPACE = "snes.cpu";
export const MESEN_65816_WRAM_ADDRESS_SPACE = "snes.wram";
export const MESEN_65816_ROM_ADDRESS_SPACE = "snes.cartridge-rom";
export const MESEN_SPC700_ADDRESS_SPACE = "spc.aram";
export const MESEN_SUPERFX_ROM_ADDRESS_SPACE = "superfx.rom";
export const MESEN_SUPERFX_RAM_ADDRESS_SPACE = "superfx.ram";
export const MESEN_NATIVE_MAX_MEMORY_READ = 4_096;
const MESEN_STEP_KINDS = Object.freeze(["instruction", "in"]);
/** Immutable editor/sidecar negotiation profile for the patched MesenCE debugger. */
export const MESEN_CAPABILITIES = Object.freeze({
    pause: true,
    step: true,
    stepKinds: MESEN_STEP_KINDS,
    registers: true,
    memory: true,
    stackFrames: true,
    breakpoints: true,
    disassemble: true,
    reconnect: true,
    architectures: Object.freeze([
        Object.freeze({
            architecture: MESEN_65816_ARCHITECTURE,
            addressSpaces: Object.freeze([
                MESEN_65816_ADDRESS_SPACE,
                MESEN_65816_WRAM_ADDRESS_SPACE,
                MESEN_65816_ROM_ADDRESS_SPACE,
            ]),
            memorySpaces: Object.freeze([
                Object.freeze({ addressSpace: MESEN_65816_WRAM_ADDRESS_SPACE, sideEffectFree: true }),
                Object.freeze({ addressSpace: MESEN_65816_ROM_ADDRESS_SPACE, sideEffectFree: true }),
            ]),
            trace: null,
            pause: true,
            step: true,
            stepKinds: MESEN_STEP_KINDS,
            registers: true,
            memory: true,
            stackFrames: true,
            breakpoints: true,
            disassemble: true,
        }),
        Object.freeze({
            architecture: MESEN_SPC700_ARCHITECTURE,
            addressSpaces: Object.freeze([MESEN_SPC700_ADDRESS_SPACE]),
            memorySpaces: Object.freeze([
                Object.freeze({ addressSpace: MESEN_SPC700_ADDRESS_SPACE, sideEffectFree: true }),
            ]),
            trace: null,
            pause: true,
            step: true,
            stepKinds: MESEN_STEP_KINDS,
            registers: true,
            memory: true,
            stackFrames: true,
            breakpoints: false,
            disassemble: true,
        }),
        Object.freeze({
            architecture: MESEN_SUPERFX_ARCHITECTURE,
            addressSpaces: Object.freeze([
                MESEN_SUPERFX_ROM_ADDRESS_SPACE,
                MESEN_SUPERFX_RAM_ADDRESS_SPACE,
            ]),
            memorySpaces: Object.freeze([
                Object.freeze({ addressSpace: MESEN_SUPERFX_ROM_ADDRESS_SPACE, sideEffectFree: true }),
                Object.freeze({ addressSpace: MESEN_SUPERFX_RAM_ADDRESS_SPACE, sideEffectFree: true }),
            ]),
            trace: null,
            pause: true,
            step: true,
            stepKinds: MESEN_STEP_KINDS,
            registers: true,
            memory: true,
            stackFrames: true,
            breakpoints: false,
            disassemble: true,
        }),
    ]),
});
//# sourceMappingURL=profile.js.map