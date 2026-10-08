import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { projectSourceLabelNames, } from "@uttori/asm-disassembler";
import { Cpu6502Decoder, formatCpu6502Instruction } from "../decoder.js";
import { ricoh2a03Cpu } from "../instructions/opcodes.js";
import { NES_HARDWARE_SYMBOLS, nesHardwareOperand, nesHardwareSource } from "./hardware.js";
import { matchesNesResearch, nesStoredMapper } from "./research.js";
/** Stable 8 KiB PRG/CHR ownership with separate trainer/trailer segments. Offsets include the iNES header. */
export function nesSourceSegments(rom, _nodes = []) {
    const segments = [];
    if (rom.trainer.size) {
        segments.push({ name: "TRAINER", ...rom.trainer, origin: 0x7000 });
    }
    for (let offset = 0; offset < rom.prg.size; offset += 8192) {
        const bank = offset / 8192;
        let origin = 0x8000;
        if (offset === rom.prg.size - 16384) {
            origin = 0xc000;
        }
        if (offset === rom.prg.size - 8192) {
            origin = 0xe000;
        }
        // Canonical origins stay stable as captures discover additional aliases for a bank.
        segments.push({
            name: `PRG_${bank.toString(16).padStart(2, "0")}`,
            offset: rom.prg.offset + offset,
            size: 8192,
            origin,
        });
    }
    for (let offset = 0; offset < rom.chr.size; offset += 8192) {
        segments.push({
            name: `CHR_${(offset / 8192).toString(16).padStart(2, "0")}`,
            offset: rom.chr.offset + offset,
            size: 8192,
            origin: 0,
        });
    }
    // Keep nonstandard trailing bytes without assigning them CPU-code meaning.
    for (let offset = 0; offset < rom.trailing.size; offset += 8192) {
        segments.push({
            name: `TRAILER_${offset}`,
            offset: rom.trailing.offset + offset,
            size: Math.min(8192, rom.trailing.size - offset),
            origin: 0,
        });
    }
    return segments;
}
/** Export every physical byte once; ambiguous instruction boundaries remain editable binary data. */
export function exportNesSource(rom, nodes, romSha256, research = {}) {
    const segments = nesSourceSegments(rom, nodes);
    const files = [];
    const add = (path, value) => files.push({ path, bytes: typeof value === "string" ? Buffer.from(value) : value });
    const names = projectSourceLabelNames(research.labels ?? [], NES_HARDWARE_SYMBOLS.map((entry) => entry.name));
    const notes = new Map();
    const definitions = [];
    for (const record of [...(research.labels ?? []), ...(research.comments ?? [])]) {
        // A CPU alias can execute from several contexts; select every proven physical owner, once.
        const matching = nodes.filter((node) => matchesNesResearch(rom, record, node.address, nesStoredMapper(node.incomingState)));
        const offsets = new Set(matching.map((node) => node.fileOffset));
        if (record.addressSpace === "nes.file") {
            offsets.add(record.address);
        }
        const name = names.get(record.id);
        if (name && "name" in record && !record.suppressed) {
            let address = record.address;
            if (record.addressSpace === "nes.file") {
                const segment = segments.find((item) => address >= item.offset - 16 && address < item.offset - 16 + item.size);
                if (!segment) {
                    throw new Error(`Research label '${record.id}' is outside the original image.`);
                }
                address = segment.origin + record.address - (segment.offset - 16);
            }
            // Equates preserve CPU alias values independently of the bank's canonical export origin.
            definitions.push(`${name} = $${address.toString(16)} ; ${record.id}`);
        }
        const text = "text" in record
            ? record.text
            : [name, record.comment, record.inlineComment].filter(Boolean).join(" · ");
        for (const offset of offsets) {
            notes.set(offset, [
                ...(notes.get(offset) ?? []),
                ...text.split(/[\n\r\u2028\u2029]/).map((line) => `; ${line}`),
            ]);
        }
    }
    add("hardware.inc", nesHardwareSource(rom.mapper));
    add("research.inc", "; Original CPU aliases and physical-bank names.\n" + definitions.join("\n") + "\n");
    const bytes = rom.bytes();
    const payload = bytes.subarray(16);
    for (let offset = 0; offset < payload.length; offset += 4096) {
        add(`assets/raw/${offset.toString(16).padStart(6, "0")}.bin`, payload.slice(offset, offset + 4096));
    }
    const memory = segments
        .map((segment) => `${segment.name}: start = $${segment.origin.toString(16)}, size = $${segment.size.toString(16)}, file = %O;`)
        .join("\n");
    const layout = segments
        .map((segment) => `${segment.name}: load = ${segment.name}, type = ro;`)
        .join("\n");
    const targetOptions = {
        header: [...rom.header()],
        linkerConfig: `MEMORY {\n${memory}\n}\nSEGMENTS {\n${layout}\n}\n`,
    };
    add("uttori-asm.config.json", canonicalJson({
        plugins: [{ module: "@uttori/asm-plugin-65xx", options: targetOptions }],
        target: "65xx.nes",
        architecture: "65xx.2a03",
        entryPoints: ["main.asm"],
        includePaths: ["./"],
    }));
    add("source-raw.json", canonicalJson({ format: "uttori-source-raw", version: 1, romSha256, blockSize: 4096 }));
    const decoder = new Cpu6502Decoder(ricoh2a03Cpu);
    let codeBytes = 0;
    const ranges = [];
    const main = [
        "; Physical cartridge segments. Mapper state determines where PRG banks execute.",
    ];
    for (const segment of segments) {
        const start = segment.offset - 16;
        const end = start + segment.size;
        const candidates = nodes.filter((node) => node.fileOffset !== undefined &&
            node.fileOffset >= start &&
            node.fileOffset + node.size <= end);
        const byOffset = new Map();
        for (const node of candidates) {
            const offset = node.fileOffset;
            const conflicting = candidates.some((other) => other.fileOffset < offset + node.size &&
                other.fileOffset + other.size > offset &&
                (other.fileOffset !== offset || other.size !== node.size));
            if (!conflicting) {
                byOffset.set(offset, node);
            }
        }
        // Assembly files have independent symbol scopes; inline includes inherit their owning bank.
        const lines = [
            '.include "hardware.inc"',
            '.include "research.inc"',
            `.segment "${segment.name}"`,
            `${segment.name}_start:`,
        ];
        let offset = start;
        while (offset < end) {
            lines.push(...(notes.get(offset) ?? []));
            const node = byOffset.get(offset);
            if (node && segment.name.startsWith("PRG_")) {
                const decoded = decoder.decode({
                    source: new Uint8ArrayDecoderSource(payload.subarray(offset, offset + node.size)),
                    offset: 0,
                    logicalAddress: segment.origin + offset - start,
                });
                if (decoded.kind === "instruction" && decoded.instruction.size === node.size) {
                    let operand = nesHardwareOperand(decoded.instruction, rom.mapper);
                    if (!operand && decoded.instruction.mode === "absolute") {
                        const address = decoded.instruction.operands[0]?.value;
                        const owners = candidates.filter((candidate) => candidate.fileOffset === offset);
                        const resolved = owners.map((owner) => {
                            const labels = (research.labels ?? []).filter((label) => !label.suppressed &&
                                address !== undefined &&
                                matchesNesResearch(rom, label, address, nesStoredMapper(owner.incomingState)));
                            return labels.length === 1 ? names.get(labels[0].id) : undefined;
                        });
                        // A physical instruction can run under several mappings. Name its operand only when all agree.
                        if (resolved.length &&
                            resolved.every((name) => name !== undefined && name === resolved[0])) {
                            operand = resolved[0];
                        }
                    }
                    lines.push(`; PRG $${(offset - (rom.prg.offset - 16)).toString(16)} / CPU $${node.address.toString(16)}`, formatCpu6502Instruction(decoded.instruction, operand));
                    ranges.push({ start: offset, end: offset + node.size });
                    offset += node.size;
                    codeBytes += node.size;
                    continue;
                }
            }
            const block = Math.floor(offset / 4096) * 4096;
            let next = offset + 1;
            while (next < Math.min(end, block + 4096) && !byOffset.has(next) && !notes.has(next)) {
                next++;
            }
            lines.push(`.incbin "assets/raw/${block.toString(16).padStart(6, "0")}.bin", ${offset - block}, ${next - offset}`);
            offset = next;
        }
        lines.push(`${segment.name}_end:`, `.assert ((${segment.name}_end - ${segment.name}_start) & $ffff) = ${segment.size}, error, "${segment.name} size changed"`, "");
        const file = `banks/${segment.name.toLowerCase()}.asm`;
        add(file, lines.join("\n"));
        main.push(`.include "${file}"`);
    }
    add("source-code.json", canonicalJson({ format: "uttori-source-code", version: 1, romSha256, ranges }));
    add("main.asm", main.join("\n") + "\n");
    return { files, segments, codeBytes, ranges };
}
//# sourceMappingURL=source-export.js.map