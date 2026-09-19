import { normalizeRuntimePPUEffect } from "./runtime-ppu.js";
/** Validate semantic facts independently of their transport or storage representation.
 * Return the normalization result so importers need not normalize twice. This
 * still checks untrusted PPU fields. The bus importer uses the returned canonical
 * effect for fact identity, keeping transport-only raster fields on the raw event.
 * @param {RuntimeBusFact} fact Byte-access coordinates and attribution.
 * @returns {RuntimePPUEffect | undefined} Canonical PPU effect when present, for reuse by the importer.
 * Throws on inconsistent actor, channel, phase, effect or out-of-range values; never mutates the input.
 */
export const validateRuntimeBusFact = (fact) => {
    if (fact.addressSpace !== "snes.cpu" ||
        !Number.isInteger(fact.address) ||
        fact.address < 0 ||
        fact.address > 0xffffff ||
        !Number.isInteger(fact.pc) ||
        fact.pc < 0 ||
        fact.pc > 0xffffff ||
        !Number.isInteger(fact.value) ||
        fact.value < 0 ||
        fact.value > 0xff ||
        !["read", "write"].includes(fact.direction) ||
        !["unattributed", "instruction", "interrupt", "wait", "stop"].includes(fact.context)) {
        throw new Error("Invalid bus access coordinates, value, direction or context.");
    }
    if (fact.actor === "cpu") {
        if (fact.channel !== null || fact.phase !== "cpu") {
            throw new Error("CPU bus accesses require a null channel and CPU phase.");
        }
    }
    else {
        if (!Number.isInteger(fact.channel) ||
            fact.channel === null ||
            fact.channel < 0 ||
            fact.channel > 7) {
            throw new Error("DMA/HDMA bus accesses require a channel in [0, 7].");
        }
        if (fact.actor === "dma") {
            if (fact.phase !== "dma") {
                throw new Error("DMA bus access has an invalid phase.");
            }
        }
        else if (fact.actor === "hdma") {
            if (!["hdma-table", "hdma-indirect", "hdma-transfer"].includes(fact.phase)) {
                throw new Error("HDMA bus access has an invalid phase.");
            }
            // Table and indirect-pointer fetches are metadata reads, never transfer writes.
            if (fact.phase !== "hdma-transfer" && fact.direction !== "read") {
                throw new Error("HDMA table and indirect phases must be reads.");
            }
        }
        else {
            throw new Error("Unknown bus access actor.");
        }
    }
    if (fact.ppu !== undefined) {
        return normalizeRuntimePPUEffect(fact.ppu, fact);
    }
    return undefined;
};
//# sourceMappingURL=runtime-bus-types.js.map