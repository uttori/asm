import { matchesResearchMapping, } from "@uttori/asm-disassembler";
import { nesPrgOffset } from "./mapper.js";
/** Flatten only mapper registers. CPU values never participate in a bank selector. */
export function nesResearchState(mapper) {
    const { banks, ...registers } = mapper;
    return { ...registers, ...Object.fromEntries(banks.map((value, index) => [`r${index}`, value])) };
}
/** Missing registers remain unknown; a research seed must not inherit the emulator's reset profile. */
export function nesResearchMapper(mapping) {
    const state = mapping?.state ?? {};
    const numeric = (key) => typeof state[key] === "number" ? state[key] : null;
    const flag = (key) => typeof state[key] === "boolean" ? state[key] : null;
    for (const [key, value] of Object.entries(state)) {
        let valid = false;
        if (["ramEnabled", "ramWritable", "irqEnabled"].includes(key)) {
            valid = typeof value === "boolean";
        }
        else {
            let maximum = -1;
            if (["prgMode", "chrMode", "mirroring"].includes(key)) {
                maximum = 1;
            }
            if (key === "select") {
                maximum = 7;
            }
            if (/^r[0-7]$/.test(key) || key === "irqLatch") {
                maximum = 255;
            }
            valid =
                typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maximum;
        }
        if (!valid) {
            throw new Error(`Invalid NES research mapper register '${key}'.`);
        }
    }
    return {
        select: numeric("select"),
        prgMode: numeric("prgMode"),
        chrMode: numeric("chrMode"),
        banks: Array.from({ length: 8 }, (_, index) => numeric(`r${index}`)),
        ramEnabled: flag("ramEnabled"),
        ramWritable: flag("ramWritable"),
        mirroring: numeric("mirroring"),
        irqLatch: numeric("irqLatch"),
        irqEnabled: flag("irqEnabled"),
    };
}
/** Test physical or CPU research at an instruction, including a range's anchored physical delta. */
export function matchesNesResearch(rom, record, address, mapper) {
    const prg = nesPrgOffset(rom, address, mapper);
    const fileOffset = prg === undefined ? undefined : rom.prg.offset - 16 + prg;
    const selected = record.addressSpace === "nes.file" ? fileOffset : address;
    if (record.addressSpace !== "nes.file" && record.addressSpace !== "nes.cpu") {
        return false;
    }
    if (selected === undefined) {
        return false;
    }
    const start = "address" in record ? record.address : record.start;
    const end = "address" in record ? start + 1 : record.end;
    return (selected >= start &&
        selected < end &&
        matchesResearchMapping(record.mapping, { fileOffset, state: nesResearchState(mapper) }, selected - start));
}
/** Build explicit inputs from the selected research projection. Bare switchable CPU locations are rejected. */
export function nesResearchInputs(rom, view) {
    const seeds = [];
    const targetOverrides = [];
    for (const record of [
        ...view.labels,
        ...view.comments,
        ...view.annotations,
        ...view.regions,
        ...view.analysis.filter((item) => item.kind === "target-override" || item.kind === "target-set"),
    ]) {
        if (record.id.startsWith("nes:")) {
            continue;
        }
        if (record.mapping) {
            nesResearchMapper(record.mapping);
        }
        if ("state" in record && record.state && Object.keys(record.state).length) {
            throw new Error("NES assumptions use mapping.state; 65816 CPU state is not supported.");
        }
        const banked = "targets" in record ||
            ("address" in record && record.address >= 0x8000) ||
            ("end" in record && record.end > 0x8000);
        if (record.addressSpace === "nes.cpu" && banked && rom.mapper === 4 && !record.mapping) {
            throw new Error(`NES CPU research '${record.id}' requires a mapping selector; use nes.file for physical-only research.`);
        }
        if (record.mapping?.fileOffset !== undefined && record.mapping.fileOffset >= rom.size - 16) {
            throw new Error(`NES research '${record.id}' has an out-of-image physical anchor.`);
        }
    }
    const seed = (record, address, kind) => {
        if (record.addressSpace !== "nes.cpu") {
            return;
        }
        const mapper = nesResearchMapper(record.mapping);
        const physical = nesPrgOffset(rom, address, mapper);
        if (physical === undefined ||
            !matchesResearchMapping(record.mapping, {
                fileOffset: physical + rom.prg.offset - 16,
                state: nesResearchState(mapper),
            })) {
            throw new Error(`Research seed '${record.id}' needs enough mapper state to prove its PRG location.`);
        }
        seeds.push({
            id: record.id + ":" + address.toString(16),
            address,
            kind,
            state: { a: null, x: null, y: null, mapper },
            evidence: record.evidence,
        });
    };
    for (const label of view.labels) {
        if (label.analysisEntryPoint !== false) {
            seed(label, label.address, "imported-label");
        }
    }
    for (const annotation of view.annotations) {
        if (!annotation.id.startsWith("nes:") &&
            (annotation.points?.includes("in") || annotation.classification === "opcode")) {
            seed(annotation, annotation.start, "manual");
        }
    }
    for (const record of view.analysis) {
        if (record.kind === "target-set") {
            for (const address of record.targets) {
                seed(record, address, "target-set");
            }
        }
        if (record.kind === "target-override" && record.addressSpace === "nes.cpu") {
            targetOverrides.push(record);
        }
    }
    return {
        seeds,
        targetOverrides,
        annotations: view.annotations.filter((item) => !item.id.startsWith("nes:")),
    };
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Validate persisted CFG mapper state before matching research or naming a physical instruction. */
export function nesStoredMapper(state) {
    const value = state.mapper;
    if (!isRecord(value) || !Array.isArray(value.banks) || value.banks.length !== 8) {
        throw new Error("Invalid stored NES mapper state.");
    }
    const fields = {};
    for (const [key, entry] of Object.entries(value)) {
        if (key === "banks") {
            continue;
        }
        if (entry === null) {
            continue;
        }
        if (typeof entry !== "number" && typeof entry !== "boolean") {
            throw new Error("Invalid stored NES mapper register.");
        }
        fields[key] = entry;
    }
    for (let index = 0; index < 8; index++) {
        const entry = value.banks[index];
        if (entry === null) {
            continue;
        }
        if (typeof entry !== "number") {
            throw new Error("Invalid stored NES bank register.");
        }
        fields[`r${index}`] = entry;
    }
    return nesResearchMapper({ state: fields });
}
//# sourceMappingURL=research.js.map