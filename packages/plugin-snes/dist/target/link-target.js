import { LinkError, addressedSourceLinkRecipe, } from "@uttori/asm-core";
import { calculateHeaderChecksum, getChecksumHeaderOffset } from "../asar/compatibility.js";
import { snesSessionStateKey } from "../session-state.js";
import { snesRomAddressSpace } from "./address-space.js";
/** Source mapper/checksum directives seed a recipe; sections themselves remain fully relocatable. */
export function createSnesSourceLinkRecipe(context, sections) {
    const state = context.state.get(snesSessionStateKey);
    const mapping = { mapper: state.mapper, sa1banks: state.sa1Banks };
    const recipe = addressedSourceLinkRecipe({
        target: context.targetId,
        sections,
        outputOffset: (address) => snesRomAddressSpace.toOutputOffset(address, mapping),
        targetOptions: { mapper: state.mapper, checksumMode: state.checksumMode },
        fillByte: state.outputFillByte,
    });
    const end = recipe.regions.reduce((maximum, region) => region.outputOffset === undefined
        ? maximum
        : Math.max(maximum, region.outputOffset + region.size), 0);
    const checksum = state.checksumEnabled && end >= getChecksumHeaderOffset(state.mapper) + 0x20;
    return { ...recipe, checksumPolicy: checksum ? "recompute" : "preserve" };
}
/** Existing mapper/checksum implementations are reused by the linker; container headers stay outside ROM arithmetic. */
export function createSnesLinkTarget() {
    return {
        target: "snes.sfc",
        revision: "snes-link-v1",
        validate(modules, recipe, allocations) {
            const mapper = recipe.targetOptions?.mapper ?? "lorom";
            const headerSize = recipe.targetOptions?.headerSize ?? 0;
            if (typeof mapper !== "string" ||
                ![
                    "lorom",
                    "hirom",
                    "exlorom",
                    "exhirom",
                    "sa1rom",
                    "sfxrom",
                    "bigsa1rom",
                    "norom",
                ].includes(mapper)) {
                throw new LinkError("snes-mapper", "A supported SNES mapper is required.");
            }
            if (headerSize !== 0 && headerSize !== 512) {
                throw new LinkError("snes-header", "SNES container headers must be 0 or 512 bytes.");
            }
            if (headerSize === 512 &&
                !recipe.regions.some((region) => region.outputOffset === 0 && region.size === 512 && region.initialBytes?.length === 512)) {
                throw new LinkError("snes-header", "A headered link requires an explicit 512-byte container region.");
            }
            const context = { mapper, sa1banks: [0, 1 << 20, -1, -1, 2 << 20, 3 << 20, -1, -1] };
            for (const allocation of allocations) {
                if (allocation.outputOffset === undefined || allocation.size === 0) {
                    continue;
                }
                const first = snesRomAddressSpace.toOutputOffset(allocation.loadAddress, context);
                const last = snesRomAddressSpace.toOutputOffset(allocation.loadAddress + allocation.size - 1, context);
                if (first !== allocation.outputOffset - headerSize ||
                    last !== first + allocation.size - 1) {
                    throw new LinkError("snes-mapping", `Section '${allocation.module}:${allocation.section}' is not contiguous under mapper '${mapper}'.`);
                }
            }
            const allocationByPosition = new Map(allocations.map((allocation) => [
                JSON.stringify([allocation.module, allocation.section]),
                allocation,
            ]));
            for (const module of modules) {
                for (const instruction of module.instructions) {
                    if (!["snes.65816", "snes.spc700", "snes.superfx"].includes(instruction.source.architecture)) {
                        throw new LinkError("snes-architecture", "Unsupported processor in SNES object.", instruction.source);
                    }
                    if (instruction.source.architecture !== "snes.65816" || instruction.size === 0) {
                        continue;
                    }
                    const allocation = allocationByPosition.get(JSON.stringify([module.id, instruction.section]));
                    const start = allocation.runAddress + instruction.offset;
                    if (Math.floor(start / 65536) !== Math.floor((start + instruction.size - 1) / 65536)) {
                        throw new LinkError("instruction-bank", "65816 instruction crosses a program-bank boundary.", instruction.source);
                    }
                }
            }
        },
        finalize(output, recipe) {
            const mapper = recipe.targetOptions?.mapper ?? "lorom";
            const headerSize = recipe.targetOptions?.headerSize ?? 0;
            const mode = recipe.targetOptions?.checksumMode ?? "asar";
            if (typeof mapper !== "string" ||
                typeof headerSize !== "number" ||
                (mode !== "asar" && mode !== "simple")) {
                throw new LinkError("snes-finalization", "Invalid SNES checksum options.");
            }
            const rom = output.subarray(headerSize);
            const header = getChecksumHeaderOffset(mapper);
            if (rom.length < header + 0x20) {
                throw new LinkError("snes-finalization", "Linked image is too short for its checksum header.");
            }
            rom.set([255, 255, 0, 0], header + 0x1c);
            const checksum = calculateHeaderChecksum(rom, mode);
            const complement = ~checksum & 65535;
            rom.set([complement & 255, complement >> 8, checksum & 255, checksum >> 8], header + 0x1c);
        },
    };
}
//# sourceMappingURL=link-target.js.map