import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import { formatSpc700Instruction, Spc700Decoder } from "../architectures/spc700-decoder.js";
import { formatSuperFxInstruction, SuperFxDecoder } from "../architectures/superfx-decoder.js";
import { initialSuperFxState, superFxDecodeState, transferSuperFxState } from "./superfx-state.js";
/**
 * Formats an unsigned value as uppercase `$` hex.
 * @param value Unsigned value.
 * @param width Minimum digit count, zero-padded.
 * @returns Assembler hex literal.
 */
const hex = (value, width) => `$${value.toString(16).toUpperCase().padStart(width, "0")}`;
/**
 * Emits raw bytes as one `db` directive.
 * @param bytes Bytes to emit.
 * @returns Comma-separated byte directive.
 */
const dataLine = (bytes) => `db ${[...bytes].map((value) => hex(value, 2)).join(",")}`;
/**
 * Linearly decodes SPC700 bytes with direct page zero, emitting a one-byte `db` for every
 * undecodable position so the output always reassembles to the same bytes.
 * @param bytes Payload bytes.
 * @param loadAddress ARAM address of the first byte; wrapped to 16 bits per instruction.
 * @returns Source lines in byte order.
 */
const spc700Lines = (bytes, loadAddress) => {
    const decoder = new Spc700Decoder();
    const source = new Uint8ArrayDecoderSource(bytes);
    const lines = [];
    let offset = 0;
    while (offset < bytes.length) {
        const decoded = decoder.decode({
            source,
            offset,
            logicalAddress: (loadAddress + offset) & 0xffff,
            state: { directPage: 0 },
        });
        if (decoded.kind !== "instruction") {
            lines.push(dataLine(bytes.slice(offset, offset + 1)));
            offset++;
            continue;
        }
        lines.push(formatSpc700Instruction(decoded.instruction));
        offset += decoded.instruction.size;
    }
    return lines;
};
/**
 * Renders a standalone ARAM image as byte-exact native SPC700 source.
 * @param image ARAM bytes and load address.
 * @returns Native source that recreates the payload.
 */
export const renderSpc700AramSource = (image) => [
    "; Generated standalone SPC700 payload.",
    "arch spc700-raw",
    "org $000000",
    `base ${hex(image.loadAddress, 4)}`,
    ...spc700Lines(image.bytes(), image.loadAddress),
    "",
].join("\n");
/**
 * Renders an explicitly parsed NSPC stream as byte-exact native embedded-block source.
 * @param rom Source ROM containing the payload bytes.
 * @param stream Validated upload-stream structure.
 * @returns Native source that recreates the stream.
 */
export const renderSpc700UploadSource = (rom, stream) => {
    const lines = ["; Generated Nintendo-style SPC700 upload stream.", "lorom", "org $008000"];
    if (stream.blocks.length === 0) {
        lines.push(`dw $0000,${hex(stream.executeAddress, 4)}`, "");
        return lines.join("\n");
    }
    for (const block of stream.blocks) {
        const bytes = rom.read(block.payloadOffset, block.size);
        if (!bytes) {
            throw new Error(`SPC700 upload block ${block.index} is outside the ROM image.`);
        }
        lines.push("", `spcblock ${hex(block.destination, 4)} nspc`);
        // A valid upload can contain tens of thousands of instructions. Its 16-bit size bound
        // is a file-format limit, not a guarantee that the resulting lines fit a native call.
        for (const line of spc700Lines(bytes, block.destination)) {
            lines.push(line);
        }
        lines.push(block.index === stream.blocks.length - 1
            ? `endspcblock execute ${hex(stream.executeAddress, 4)}`
            : "endspcblock");
    }
    lines.push("");
    return lines.join("\n");
};
/**
 * Renders a contiguous GSU program image as byte-exact native SuperFX source.
 * @param image GSU bytes and logical load address.
 * @returns Native source that recreates the program image.
 */
export const renderSuperFxRomSource = (image) => {
    const bytes = image.bytes();
    const source = new Uint8ArrayDecoderSource(bytes);
    const decoder = new SuperFxDecoder();
    let state = initialSuperFxState(image.loadAddress >>> 16);
    let offset = 0;
    const lines = [
        "; Generated standalone SuperFX payload.",
        "norom",
        "org $000000",
        `base ${hex(image.loadAddress, 6)}`,
        "arch superfx",
    ];
    while (offset < bytes.length) {
        const decoded = decoder.decode({
            source,
            offset,
            logicalAddress: image.loadAddress + offset,
            state: superFxDecodeState(state),
        });
        if (decoded.kind !== "instruction") {
            lines.push(dataLine(bytes.slice(offset, offset + 1)));
            offset++;
            continue;
        }
        const instruction = decoded.instruction;
        const statefulAlt = state.alt.kind === "known" &&
            state.alt.value !== 0 &&
            instruction.bytes[0] !== 0x3d &&
            instruction.bytes[0] !== 0x3e &&
            instruction.bytes[0] !== 0x3f;
        lines.push(statefulAlt ? dataLine(instruction.bytes) : formatSuperFxInstruction(instruction));
        state = transferSuperFxState(instruction, state);
        offset += instruction.size;
    }
    lines.push("");
    return lines.join("\n");
};
//# sourceMappingURL=processor-source-export.js.map