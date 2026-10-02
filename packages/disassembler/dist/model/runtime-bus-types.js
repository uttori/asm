import { normalizeRuntimePPUEffect } from "./runtime-ppu-effect.js";
function isInteger(value) {
    return typeof value === "number" && Number.isInteger(value);
}
/** Validate semantic facts independently of their transport or storage representation.
 * Return the normalization result so importers need not normalize twice. This
 * still checks untrusted PPU fields. The bus importer uses the returned canonical
 * effect for fact identity, keeping transport-only raster fields on the raw event.
 * @param {RuntimeBusFact} fact Byte-access coordinates and attribution.
 * @returns {RuntimePPUEffect | undefined} Canonical PPU effect when present, for reuse by the importer.
 * Throws on inconsistent actor, channel, phase, effect or out-of-range values. Never mutates the input.
 */
export const validateRuntimeBusFact = (fact) => {
    const address = fact.address;
    const pc = fact.pc;
    const value = fact.value;
    const direction = fact.direction;
    const context = fact.context;
    if (fact.addressSpace !== "snes.cpu" ||
        !(isInteger(address) && address >= 0 && address <= 0xffffff) ||
        !(isInteger(pc) && pc >= 0 && pc <= 0xffffff) ||
        !(isInteger(value) && value >= 0 && value <= 0xff) ||
        (direction !== "read" && direction !== "write") ||
        (context !== "unattributed" &&
            context !== "instruction" &&
            context !== "interrupt" &&
            context !== "wait" &&
            context !== "stop")) {
        throw new Error("Invalid bus access coordinates, value, direction or context.");
    }
    const actor = fact.actor;
    const channel = fact.channel;
    const phase = fact.phase;
    if (actor === "cpu") {
        if (channel !== null || phase !== "cpu") {
            throw new Error("CPU bus accesses require a null channel and CPU phase.");
        }
    }
    else {
        if (!(isInteger(channel) && channel >= 0 && channel <= 7)) {
            throw new Error("DMA/HDMA bus accesses require a channel in [0, 7].");
        }
        if (actor === "dma") {
            if (phase !== "dma") {
                throw new Error("DMA bus access has an invalid phase.");
            }
        }
        else if (actor === "hdma") {
            if (phase !== "hdma-table" && phase !== "hdma-indirect" && phase !== "hdma-transfer") {
                throw new Error("HDMA bus access has an invalid phase.");
            }
            // Table and indirect-pointer fetches are metadata reads, never transfer writes.
            if (phase !== "hdma-transfer" && direction !== "read") {
                throw new Error("HDMA table and indirect phases must be reads.");
            }
        }
        else {
            throw new Error("Unknown bus access actor.");
        }
    }
    if (fact.ppu !== undefined) {
        return normalizeRuntimePPUEffect(fact.ppu, { address, direction, value });
    }
    return undefined;
};
//# sourceMappingURL=runtime-bus-types.js.map