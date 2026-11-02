import { applyLinkerSymbols, closeActiveSegment } from "../directives/ca65.js";
import { defaultLd65ConfigText, linkerDefinedSymbolNames, parseLd65Config, } from "../linker-config.js";
import { cloneNes65xxSessionState, nes65xxSessionStateKey, resetNes65xxStageState, } from "../session-state.js";
/** iNES / NES 2.0 cartridge target (`nes`, `ines`, `6502-nes` aliases). */
export const NES_65XX_TARGET_ID = "65xx.nes";
export const NES_65XX_ADDRESS_SPACE_ID = "65xx.ines-address-space";
export const NES_65XX_OUTPUT_FORMAT_ID = "65xx.ines-output";
export const NES_65XX_LIFECYCLE_ID = "65xx.nes-lifecycle";
const INES_MAGIC = [0x4e, 0x45, 0x53, 0x1a];
/**
 * Accepts a JSON object. Arrays and null are not option maps.
 * @param {unknown} value Candidate target options.
 * @returns {boolean} True when `value` is a non-array object.
 */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * Coerces NES target options. Omitted `linkerConfig` uses a 32 KiB `$8000` ROM.
 * Omitted `header` synthesizes a 16-byte iNES header from PRG size.
 * @param {unknown} configured Assembler `targetOptions`.
 * @returns {Nes65xxTargetOptions} Normalized options including a parsed linker.
 */
export function createNes65xxTargetOptions(configured) {
    const value = isRecord(configured) ? configured : {};
    const sourceStyle = value.sourceStyle ?? "ca65";
    if (sourceStyle !== "asar" && sourceStyle !== "ca65") {
        throw new Error("NES sourceStyle must be 'asar' or 'ca65'.");
    }
    const linkerConfig = typeof value.linkerConfig === "string" && value.linkerConfig.trim()
        ? value.linkerConfig
        : defaultLd65ConfigText();
    const linker = parseLd65Config(linkerConfig);
    const fillByte = typeof value.fillByte === "number" && Number.isInteger(value.fillByte)
        ? value.fillByte & 0xff
        : 0xff;
    const header = normalizeHeader(value.header, linker.imageSize);
    return { header, linkerConfig, fillByte, linker, sourceStyle };
}
/**
 * Builds the initial NES session state from target options.
 * @param {object} context Session creation context.
 * @param {Readonly<Record<string, unknown>>} context.targetOptions Normalized NES options.
 * @returns {Nes65xxSessionState} Fresh session state.
 */
export function createInitialNesState(context) {
    const options = createNes65xxTargetOptions(context.targetOptions);
    const state = {
        header: options.header,
        fillByte: options.fillByte,
        linker: options.linker,
        memoryCursors: {},
        currentSegment: null,
        currentLoadMemory: null,
        segmentLoadStart: 0,
        segmentRunStart: 0,
    };
    resetNes65xxStageState(state);
    return state;
}
/**
 * Rejects addresses outside the unsigned 16-bit NES CPU space.
 * @param {number} address Candidate CPU address.
 * @returns {number} The same address when it is in range.
 */
function validate(address) {
    if (!Number.isInteger(address) || address < 0 || address > 0xffff) {
        throw new Error(`Address $${address.toString(16).toUpperCase()} is outside 16-bit NES space.`);
    }
    return address;
}
/**
 * Maps load addresses into the iNES image using physical Asar offsets or ca65 MEMORY regions.
 * Logical CPU/PPU addresses stay independent of the load cursor through core `base` support.
 * @param {TargetFactoryContext} context Target factory context.
 * @returns {TargetAddressSpace} The NES address space.
 */
export function createNesAddressSpace({ state, options, }) {
    if (options.sourceStyle === "asar") {
        const nes = state.get(nes65xxSessionStateKey);
        // Banked CPU addresses are not unique ROM locations. org selects physical payload bytes;
        // core base supplies the independent logical address used by labels and instruction encoding.
        const physical = (address) => {
            if (!Number.isSafeInteger(address) || address < 0 || address >= nes.linker.imageSize) {
                throw new Error(`NES physical write offset ${address} is outside the fixed cartridge layout.`);
            }
            return address;
        };
        return {
            addressWidth: 32,
            defaultOrigin: 0,
            normalizeForWrite: physical,
            advance: (address, amount) => address + amount,
            toOutputOffset(address) {
                // End-of-bank source ranges may point one byte past the payload; actual writes remain strict.
                if (!Number.isSafeInteger(address) || address < 0 || address > nes.linker.imageSize) {
                    return -1;
                }
                return nes.header.length + address;
            },
            fromOutputOffset(offset) {
                const address = offset - nes.header.length;
                return address >= 0 && address < nes.linker.imageSize ? address : -1;
            },
            validateWrite: physical,
        };
    }
    return {
        addressWidth: 16,
        defaultOrigin: 0,
        normalizeForWrite: validate,
        advance(address, amount) {
            return validate((address + amount) & 0xffff);
        },
        toOutputOffset(address) {
            const nes = state.get(nes65xxSessionStateKey);
            if (!nes.currentLoadMemory) {
                return -1;
            }
            const memory = nes.linker.memories.get(nes.currentLoadMemory);
            if (!memory || memory.fileOffset < 0) {
                return -1;
            }
            if (address < memory.start || address >= memory.start + memory.size) {
                return -1;
            }
            return nes.header.length + memory.fileOffset + (address - memory.start);
        },
        fromOutputOffset(offset) {
            const nes = state.get(nes65xxSessionStateKey);
            const prgOffset = offset - nes.header.length;
            if (prgOffset < 0) {
                return -1;
            }
            for (const memory of nes.linker.memories.values()) {
                if (memory.fileOffset < 0) {
                    continue;
                }
                if (prgOffset >= memory.fileOffset && prgOffset < memory.fileOffset + memory.size) {
                    return memory.start + (prgOffset - memory.fileOffset);
                }
            }
            return -1;
        },
        validateWrite(address) {
            validate(address);
        },
    };
}
/**
 * Header plus filled PRG image. Checksum is not an iNES concept.
 * @returns {TargetOutputFormat} The NES output format.
 */
export function createNesOutputFormat() {
    return {
        finalize: () => undefined,
        getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes),
    };
}
/**
 * Prefills header + `$FF` PRG, reseeds linker symbols, and closes the last segment.
 * @param {TargetFactoryContext} context Target factory context.
 * @returns {SessionLifecycle} NES session lifecycle hooks.
 */
export function createNesLifecycle({ state }) {
    const prefill = (session) => {
        const nes = state.get(nes65xxSessionStateKey);
        resetNes65xxStageState(nes);
        session.outputFillByte = nes.fillByte;
        if (session.module) {
            for (const name of linkerDefinedSymbolNames(nes.linker)) {
                session.module.declare(name, "import");
            }
            session.bytes = 0;
            return;
        }
        const total = nes.header.length + nes.linker.imageSize;
        const image = Array.from({ length: total }, () => nes.fillByte);
        for (let index = 0; index < nes.header.length; index++) {
            image[index] = nes.header[index] ?? 0;
        }
        session.outputBytes = image;
        session.bytes = 0;
        for (const name of linkerDefinedSymbolNames(nes.linker)) {
            session.globalSymbols.add(name);
        }
    };
    return {
        onSessionCreated: ({ session }) => {
            prefill(session);
        },
        onStageStart: ({ session }) => {
            prefill(session);
        },
        onStageEnd: ({ session }) => {
            const nes = state.get(nes65xxSessionStateKey);
            closeActiveSegment(session, nes);
            applyLinkerSymbols(session, nes);
        },
    };
}
export { cloneNes65xxSessionState };
/**
 * Normalizes a caller-supplied header or synthesizes a 16-byte iNES header.
 * @param {unknown} configured Header bytes, if any.
 * @param {number} imageSize Linked PRG size in bytes.
 * @returns {number[]} Header bytes.
 */
function normalizeHeader(configured, imageSize) {
    if (configured instanceof Uint8Array || Array.isArray(configured)) {
        const bytes = [...configured].map((value) => Number(value) & 0xff);
        if (bytes.length === 0) {
            throw new Error("65xx NES target header must not be empty.");
        }
        return bytes;
    }
    if (configured !== undefined) {
        throw new Error("65xx NES target header must be a byte array.");
    }
    const prgBanks = Math.max(1, Math.ceil(imageSize / 0x4000));
    const header = Array.from({ length: 16 }, () => 0);
    header[0] = INES_MAGIC[0];
    header[1] = INES_MAGIC[1];
    header[2] = INES_MAGIC[2];
    header[3] = INES_MAGIC[3];
    header[4] = prgBanks & 0xff;
    return header;
}
//# sourceMappingURL=nes.js.map