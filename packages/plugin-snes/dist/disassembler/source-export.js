import * as fs from "node:fs";
import path from "node:path";
import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { SOURCE_EXPORT_FORMAT, SOURCE_EXPORT_SCHEMA_VERSION, HalfOpenIntervalIndex, sourceExportSha256, projectSourceLabelNames, validateSourceLabelName, } from "@uttori/asm-disassembler";
import { Cpu65816Decoder, formatCpu65816Instruction, } from "../architectures/65816-decoder.js";
import { snesRomAddressSpace } from "../target/address-space.js";
import { createSnesAddressContext, SNES_CPU_ADDRESS_SPACE, SNES_FILE_ADDRESS_SPACE, } from "./address-identities.js";
import { identifySnesHardwareRegister, renderSnesHardwareDefines, SNES_HARDWARE_DEFINES_SOURCE, } from "./hardware-registers.js";
import { canonicalSnesWramAddress, indexSnesRamMap, loadSnesRamMap, renderSnesRamDefines, renderSnesRamMapSchema, SNES_RAM_DEFINES_SOURCE, SNES_RAM_MAP_SCHEMA_SOURCE, SNES_RAM_MAP_SOURCE, } from "./ram-map.js";
import { isSnesMapper, parseSnesInternalRomHeader } from "./rom-header.js";
import { formatStructDeclaration, omitAssemblyResearchReferences, wrapAssemblyComments, } from "./source-layout.js";
import { applySnesStructInstructionOperand, indexSnesStructInstructionUses, renderSnesStructUseComments, } from "./struct-instruction-uses.js";
import { indexSnesStructFields, loadSnesStructMap, planSnesStructRomFields, renderSnesStructData, renderSnesStructDefines, renderSnesStructInitializerFields, SNES_STRUCT_DEFINES_SOURCE, SNES_STRUCT_MAP_SOURCE, } from "./struct-map.js";
import { indexSnesTypedData, snesTypedDataAt, renderSnesTypedData, } from "./typed-data.js";
/**
 * Accepts an encoded direct-transfer mode.
 * @param {string} value Instruction addressing mode.
 * @returns {boolean} True for absolute, absolute long, relative, or relative long.
 */
function isSourceFlowMode(value) {
    return (value === "absolute" ||
        value === "absoluteLong" ||
        value === "relative" ||
        value === "relativeLong");
}
/**
 * Resolve direct control flow in the exported program bank without interpreting indirect pointers.
 * @param {DecodedInstruction} instruction ROM-matched instruction with encoded operands and references.
 * @param {number} sourceAddress 24-bit CPU address where the instruction will be emitted.
 * @returns {SourceFlowTarget | undefined} Direct destination with its encoded addressing mode, or undefined for other operands.
 */
const sourceFlowTarget = (instruction, sourceAddress) => {
    const { mode } = instruction;
    if (!isSourceFlowMode(mode)) {
        return undefined;
    }
    const flow = instruction.references.find((reference) => ["call", "jump", "branch"].includes(reference.kind) &&
        !reference.indirect &&
        reference.operandIndex === 0);
    const value = instruction.operands[0]?.value;
    if (!flow || value === undefined || instruction.mnemonic === "PER") {
        return undefined;
    }
    let address = flow.address;
    if (mode === "relative" || mode === "relativeLong") {
        address = (sourceAddress & 0xff0000) | ((sourceAddress + instruction.size + value) & 0xffff);
    }
    else if (mode === "absolute") {
        address = (sourceAddress & 0xff0000) | value;
    }
    if (address === undefined) {
        return undefined;
    }
    return { address, mode };
};
/**
 * Replace only a direct transfer operand, preserving near width and an encoded long-call mirror.
 * @param {string} source Formatted instruction text before trailing comments are attached.
 * @param {SourceFlowTarget} flow Direct destination resolved for the emitted instruction's bank.
 * @param {string} name Symbol present at the destination's final emitted span boundary.
 * @param {number} labelAddress 24-bit CPU address assigned to that emitted symbol.
 * @returns {string} Symbolic instruction text retaining the original transfer width and bus-address alias.
 */
const renderFlowLabel = (source, flow, name, labelAddress) => {
    let operand = name;
    if (flow.mode === "absolute") {
        operand = `(${name} & $FFFF)`;
    }
    else if (flow.mode === "absoluteLong" && flow.address !== labelAddress) {
        // A label lives in the export's canonical bank; JSL/JML must keep the original encoded alias.
        if ((flow.address & 0xffff) === (labelAddress & 0xffff)) {
            operand = `((${name} & $FFFF) | ${hex(flow.address & 0xff0000, 6)})`;
        }
        else {
            const delta = flow.address - labelAddress;
            operand = `(${name} ${delta < 0 ? "-" : "+"} ${hex(Math.abs(delta), 6)})`;
        }
    }
    return `${source.slice(0, source.indexOf(" "))} ${operand}`;
};
function isAssetIncludeFile(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    if (!("version" in value) || value.version !== 1) {
        return false;
    }
    return "entries" in value && Array.isArray(value.entries);
}
function isAssetIncludeEntry(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    if (!("start" in value) || !("end" in value) || !("directive" in value)) {
        return false;
    }
    const { start, end, directive } = value;
    return (typeof start === "number" &&
        typeof end === "number" &&
        Number.isSafeInteger(start) &&
        Number.isSafeInteger(end) &&
        start >= 0 &&
        end > start &&
        typeof directive === "string" &&
        /^includeAsset\([^\n\r]+\)$/.test(directive));
}
/**
 * Load exact ROM span replacements without making the exporter game-specific.
 * @param {string} directory Export source directory containing the optional project-owned map.
 * @returns {AssetIncludeMap | undefined} Validated replacements or undefined when the project has none.
 */
const loadAssetIncludeMap = (directory) => {
    const file = path.join(directory, "asset-includes.json");
    if (!fs.existsSync(file)) {
        return undefined;
    }
    const sourceBytes = fs.readFileSync(file);
    const data = JSON.parse(sourceBytes.toString("utf8"));
    if (!isAssetIncludeFile(data)) {
        throw new Error("asset-includes.json requires version 1 and an entries array.");
    }
    const entries = [];
    for (const entry of data.entries) {
        if (!isAssetIncludeEntry(entry)) {
            throw new Error("asset-includes.json has an invalid ROM span or includeAsset directive.");
        }
        entries.push(entry);
    }
    const ordered = [...entries];
    ordered.sort((left, right) => left.start - right.start);
    for (let index = 1; index < ordered.length; index++) {
        if (ordered[index - 1].end > ordered[index].start) {
            throw new Error("asset-includes.json has overlapping ROM spans.");
        }
    }
    return { sourceBytes, entries: ordered };
};
/**
 * Replace complete non-code spans only; a changed analysis boundary must be reviewed.
 * @param {PlannedSpan[]} planned Native spans from code, annotations and struct bindings.
 * @param {AssetIncludeMap | undefined} map Project-owned includes with half-open ROM file offsets.
 * @param {ReadonlyMap<number, NamedLine[]>} metadata Labels and comments whose interior boundaries must survive export.
 * @param {number} bankSize ROM bytes per emitted bank for the active mapper.
 * @returns {PlannedSpan[]} Spans with includes substituted and uncovered raw bytes retained.
 */
const applyAssetIncludes = (planned, map, metadata, bankSize) => {
    if (!map) {
        return [...planned];
    }
    const result = [];
    const spans = [...planned];
    let index = 0;
    const splitRawAt = (offset) => {
        const span = index >= 0 && index < spans.length ? spans[index] : undefined;
        if (!span || span.start >= offset || span.end <= offset) {
            return;
        }
        if (span.instruction || span.structured || span.structField || span.structRecord) {
            throw new Error(`Asset include boundary at ROM offset ${hex(offset)} splits typed data or code.`);
        }
        // Preserve both untouched sides when a generated raw span crosses the asset boundary.
        spans.splice(index, 1, { ...span, end: offset }, { ...span, start: offset });
    };
    for (const entry of map.entries) {
        while (index < spans.length && spans[index].end <= entry.start) {
            result.push(spans[index++]);
        }
        splitRawAt(entry.start);
        while (index < spans.length && spans[index].end <= entry.start) {
            result.push(spans[index++]);
        }
        if (spans[index]?.start !== entry.start ||
            Math.floor(entry.start / bankSize) !== Math.floor((entry.end - 1) / bankSize)) {
            throw new Error(`Asset include at ROM offset ${hex(entry.start)} does not start on one bank-local span.`);
        }
        let end = entry.start;
        while (index < spans.length && end < entry.end) {
            splitRawAt(entry.end);
            const span = spans[index];
            if (span.start !== end ||
                span.end > entry.end ||
                span.instruction ||
                span.structured ||
                (span.start !== entry.start && metadata.has(span.start))) {
                throw new Error(`Asset include at ROM offset ${hex(entry.start)} conflicts with exported data or metadata.`);
            }
            end = span.end;
            index++;
        }
        if (end !== entry.end) {
            throw new Error(`Asset include at ROM offset ${hex(entry.start)} has no exact end boundary.`);
        }
        result.push({ start: entry.start, end: entry.end, role: "raw", assetInclude: entry.directive });
    }
    while (index < spans.length) {
        result.push(spans[index++]);
    }
    return result;
};
const hex = (value, width = 6) => `$${value.toString(16).toUpperCase().padStart(width, "0")}`;
const byteList = (bytes) => [...bytes].map((byte) => hex(byte, 2)).join(", ");
const asciiString = (bytes) => {
    if (![...bytes].every((byte) => byte >= 0x20 && byte <= 0x7e)) {
        return undefined;
    }
    const value = String.fromCharCode(...bytes)
        .replaceAll("\\", "\\\\")
        .replaceAll("!", "\\!")
        .replaceAll('"', '\\"');
    return `"${value}"`;
};
const capacity = (bytes) => {
    if (bytes === undefined) {
        return "invalid size code";
    }
    if (bytes === 0) {
        return "none";
    }
    if (bytes >= 1024 * 1024 && bytes % (1024 * 1024) === 0) {
        return `${bytes / (1024 * 1024)} MiB`;
    }
    if (bytes >= 1024 && bytes % 1024 === 0) {
        return `${bytes / 1024} KiB`;
    }
    return `${bytes} bytes`;
};
const bytesField = (start, bytes, symbol, comment, preferAscii = false) => ({
    start,
    end: start + bytes.length,
    role: "snes-header",
    lines: [
        `${symbol}:`,
        `  db ${(preferAscii ? asciiString(bytes) : undefined) ?? byteList(bytes)} ; ${comment}`,
    ],
});
const byteField = (start, value, symbol, comment) => bytesField(start, Uint8Array.of(value), symbol, comment);
const wordField = (start, value, symbol, comment, role = "snes-header") => ({
    start,
    end: start + 2,
    role,
    lines: [`${symbol}:`, `  dw ${hex(value, 4)} ; ${comment}`],
});
const asciiComment = (value) => `"${value.replaceAll('"', '\\"')}"`;
/**
 * Builds field-aligned source for the selected internal/expanded header and all vector words.
 * @param {RomImage} rom Immutable headerless ROM view.
 * @param {SnesMapper} mapper Selected cartridge mapping family.
 * @returns {StructuredRomLayout | undefined} Structured fields when a header is in range.
 */
const structuredRomLayout = (rom, mapper) => {
    const header = parseSnesInternalRomHeader(rom, mapper);
    if (!header) {
        return undefined;
    }
    const base = header.offset;
    const rawHeader = rom.read(base, 0x20);
    const fields = [];
    if (header.expanded) {
        const expanded = header.expanded;
        const rawExpanded = rom.read(expanded.offset, 0x10);
        fields.push(bytesField(expanded.offset, rawExpanded.slice(0, 2), "SNES_EXPANDED_HEADER_MAKER_CODE", `Expanded header maker code ${asciiComment(expanded.makerCode)}.`, true), bytesField(expanded.offset + 2, rawExpanded.slice(2, 6), "SNES_EXPANDED_HEADER_GAME_CODE", `Expanded header game code ${asciiComment(expanded.gameCode)}.`, true), bytesField(expanded.offset + 6, rawExpanded.slice(6, 12), "SNES_EXPANDED_HEADER_RESERVED", "Expanded header reserved bytes."), byteField(expanded.offset + 0x0c, expanded.expansionFlashSizeCode, "SNES_EXPANDED_HEADER_FLASH_SIZE", "Expansion flash size code."), byteField(expanded.offset + 0x0d, expanded.expansionRamSizeCode, "SNES_EXPANDED_HEADER_RAM_SIZE", "Expansion RAM size code."), byteField(expanded.offset + 0x0e, expanded.specialVersion, "SNES_EXPANDED_HEADER_SPECIAL_VERSION", "Special version."), byteField(expanded.offset + 0x0f, expanded.chipsetSubtype, "SNES_EXPANDED_HEADER_CHIPSET_SUBTYPE", "Custom chipset subtype."));
    }
    fields.push(bytesField(base, rawHeader.slice(0, 0x15), "SNES_HEADER_TITLE", `Cartridge title ${asciiComment(header.title)}.`, true), byteField(base + 0x15, header.mapMode, "SNES_HEADER_MAP_MODE", `${header.speed === "fast" ? "FastROM" : "SlowROM"}, ${header.mapModeName} map mode.`), byteField(base + 0x16, header.chipset, "SNES_HEADER_CHIPSET", header.chipsetDescription), byteField(base + 0x17, header.romSizeCode, "SNES_HEADER_ROM_SIZE", `Declared ROM size: ${capacity(header.romSizeBytes)}.`), byteField(base + 0x18, header.ramSizeCode, "SNES_HEADER_RAM_SIZE", `Declared cartridge RAM size: ${capacity(header.ramSizeBytes)}.`), byteField(base + 0x19, header.regionCode, "SNES_HEADER_REGION", `Destination/region: ${header.region}.`), byteField(base + 0x1a, header.developerId, "SNES_HEADER_DEVELOPER_ID", header.expanded ? "Developer ID uses the expanded-header marker." : "Legacy developer ID."), byteField(base + 0x1b, header.version, "SNES_HEADER_VERSION", `ROM revision ${header.version}.`), wordField(base + 0x1c, header.checksumComplement, "SNES_HEADER_CHECKSUM_COMPLEMENT", `Checksum complement${header.checksumValid ? " (valid pair)" : " (does not form a valid pair)"}.`), wordField(base + 0x1e, header.checksum, "SNES_HEADER_CHECKSUM", `ROM checksum${header.checksumValid ? " (valid pair)" : " (does not form a valid pair)"}.`));
    for (const vector of header.vectors) {
        const mode = vector.mode === "native" ? "Native-mode" : "Emulation-mode";
        let comment = `${mode} reserved vector word.`;
        if (vector.state && vector.targetAddress === undefined) {
            comment = `${mode} ${vector.name} vector is unpopulated.`;
        }
        else if (vector.state) {
            comment = `${mode} ${vector.name} handler. Target bank is forced to $00 -> ${hex(vector.targetAddress, 6)}.`;
        }
        fields.push(wordField(vector.fileOffset, vector.value, vector.symbol, comment, "vectors"));
    }
    const sorted = fields.toSorted((left, right) => left.start - right.start);
    return {
        start: sorted[0].start,
        end: sorted.at(-1).end,
        headerOffset: header.offset,
        fields: sorted,
        byStart: new Map(sorted.map((field) => [field.start, field])),
    };
};
const known = (value) => {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    const entry = value;
    return entry.kind === "known" && typeof entry.value === "number" ? entry.value : undefined;
};
const decodeState = (record) => ({
    ...(known(record.e) === undefined ? {} : { e: known(record.e) === 0 ? 0 : 1 }),
    ...(known(record.m) === undefined ? {} : { m: known(record.m) === 0 ? 0 : 1 }),
    ...(known(record.x) === undefined ? {} : { x: known(record.x) === 0 ? 0 : 1 }),
    ...(known(record.pbr) === undefined ? {} : { programBank: known(record.pbr) & 0xff }),
    ...(known(record.dbr) === undefined ? {} : { dataBank: known(record.dbr) & 0xff }),
    ...(known(record.d) === undefined ? {} : { directPage: known(record.d) & 0xffff }),
});
/**
 * Formats one decoded instruction with explicit native operand-width qualification.
 * @param {DecodedInstruction} instruction Decoded 65816 instruction.
 * @param {ReadonlyMap<number, SnesRamMapVariable>} [ramVariables] Canonical WRAM and explicit SRAM CPU locations to name.
 * @param {number} [sourceAddress] Canonical address where generated source places the instruction.
 * @param {ReadonlyMap<number, string>} [sourceLabels] Explicit names at exact exported addresses.
 * @param {ReadonlyMap<number, string>} [structFields] Native struct expressions at known data addresses.
 * @param {ReadonlyMap<number, string>} [indexedStructFields] Struct expressions including explicitly biased array bases.
 * @returns {string} Native source with a `.b`, `.w`, or `.l` suffix where width is selectable.
 */
export const formatSnes65816SourceInstruction = (instruction, ramVariables, sourceAddress, sourceLabels, structFields, indexedStructFields) => {
    const decodedOperand = instruction.operands.length > 0 ? instruction.operands[0] : undefined;
    const rebaseRelative = sourceAddress !== undefined &&
        (instruction.mode === "relative" ||
            (instruction.mode === "relativeLong" && instruction.mnemonic !== "PER")) &&
        decodedOperand?.value !== undefined;
    const formatted = formatCpu65816Instruction(rebaseRelative
        ? {
            ...instruction,
            operands: [
                {
                    ...decodedOperand,
                    targetAddress: (sourceAddress & 0xff0000) |
                        ((sourceAddress + instruction.size + decodedOperand.value) & 0xffff),
                },
                ...instruction.operands.slice(1),
            ],
        }
        : instruction);
    const space = formatted.indexOf(" ");
    const mnemonic = space < 0 ? formatted : formatted.slice(0, space);
    const operandText = space < 0 ? "" : formatted.slice(space);
    let suffix = "";
    if (instruction.mode === "immediate") {
        suffix = instruction.operands[0]?.width === 2 ? ".w" : ".b";
    }
    else if (instruction.mode === "direct" ||
        instruction.mode === "directIndexedX" ||
        instruction.mode === "directIndexedY") {
        suffix = ".b";
    }
    else if (instruction.mode === "absolute" ||
        instruction.mode === "absoluteIndexedX" ||
        instruction.mode === "absoluteIndexedY") {
        suffix = ".w";
    }
    else if (instruction.mode === "absoluteLong" || instruction.mode === "absoluteLongIndexedX") {
        suffix = ".l";
    }
    let renderedOperand = operandText;
    const rawValue = instruction.operands[0]?.value;
    const dataAddress = instruction.references.find((reference) => reference.kind === "data" && reference.operandIndex === 0)?.address;
    const canonicalRamAddress = dataAddress === undefined ? undefined : canonicalSnesWramAddress(dataAddress);
    const namedAddress = canonicalRamAddress ?? dataAddress;
    // WRAM has fixed bus mirrors. SRAM names only match the CPU window declared in the map.
    const ramVariable = namedAddress === undefined ? undefined : ramVariables?.get(namedAddress);
    const indexed = [
        "absoluteLongIndexedX",
        "absoluteIndexedX",
        "absoluteIndexedY",
        "directIndexedX",
        "directIndexedY",
    ].includes(instruction.mode);
    const structField = namedAddress === undefined
        ? undefined
        : (indexed ? (indexedStructFields ?? structFields) : structFields)?.get(namedAddress);
    if ((structField || ramVariable) && rawValue !== undefined) {
        const rawWidth = instruction.operands[0]?.width ?? 1;
        const encoded = `$${rawValue
            .toString(16)
            .toUpperCase()
            .padStart(rawWidth * 2, "0")}`;
        const variableOffset = ramVariable ? namedAddress - ramVariable.address : 0;
        const variableExpression = structField ??
            (variableOffset === 0
                ? ramVariable.name
                : `(${ramVariable.name} + $${variableOffset.toString(16).toUpperCase().padStart(2, "0")})`);
        let symbolic = variableExpression;
        if (rawWidth === 3 && rawValue !== namedAddress) {
            // Naming a WRAM mirror must preserve the bank encoded in the instruction.
            // Canonical $7E variables can also be reached through $00-$3F/$80-$BF.
            symbolic = `(${variableExpression} & $FFFF)`;
            const encodedBank = rawValue & 0xff0000;
            if (encodedBank !== 0) {
                symbolic += ` | ${hex(encodedBank, 6)}`;
            }
        }
        else if (rawWidth !== 3) {
            symbolic = `${variableExpression} & ${rawWidth === 1 ? "$FF" : "$FFFF"}`;
        }
        renderedOperand = operandText.replace(encoded, symbolic);
    }
    else if (instruction.mode === "absolute" ||
        instruction.mode === "absoluteIndexedX" ||
        instruction.mode === "absoluteIndexedY") {
        const value = instruction.operands[0]?.value;
        const register = dataAddress === undefined ? undefined : identifySnesHardwareRegister(dataAddress);
        if (register && value !== undefined) {
            renderedOperand = operandText.replace(`$${value.toString(16).toUpperCase().padStart(4, "0")}`, register.symbol);
        }
    }
    else if ((instruction.mode === "absoluteLong" || instruction.mode === "absoluteLongIndexedX") &&
        (instruction.operands[0]?.value ?? -1) <= 0xffff) {
        const value = instruction.operands[0]?.value;
        const register = dataAddress === undefined ? undefined : identifySnesHardwareRegister(dataAddress);
        if (register && value !== undefined) {
            renderedOperand = operandText.replace(`$${value.toString(16).toUpperCase().padStart(6, "0")}`, register.symbol);
        }
    }
    const flow = instruction.references.find((reference) => ["call", "jump", "branch"].includes(reference.kind) &&
        !reference.indirect &&
        reference.operandIndex === 0);
    if (flow && sourceLabels && rawValue !== undefined) {
        let target = flow.address;
        if (rebaseRelative) {
            target =
                (sourceAddress & 0xff0000) | ((sourceAddress + instruction.size + rawValue) & 0xffff);
        }
        else if (instruction.mode === "absolute" && sourceAddress !== undefined) {
            target = (sourceAddress & 0xff0000) | rawValue;
        }
        const name = target === undefined ? undefined : sourceLabels.get(target);
        if (name) {
            renderedOperand = instruction.mode === "absolute" ? ` (${name} & $FFFF)` : ` ${name}`;
        }
    }
    return `${mnemonic}${suffix}${renderedOperand}`;
};
const mapperDirective = (mapper) => mapper === "bigsa1rom" ? "fullsa1rom" : mapper;
/**
 * Classifies one already-cut export span without rescanning every project annotation.
 * @param {number} start Inclusive ROM file offset.
 * @param {number} end Exclusive ROM file offset.
 * @param {HalfOpenIntervalIndex<IntervalAnnotation>} annotations File-space annotation index shared by the export.
 * @returns {SourceExportSpanRole} Stable source-emission role for the complete span.
 */
const roleAt = (start, end, annotations) => {
    // planSpans cuts at annotation boundaries, so an indexed point lookup plus containment check is
    // sufficient here. A full-array scan at every span made large imported projects quadratic.
    if (annotations
        .at(start)
        .some((entry) => entry.classification === "empty" && entry.start <= start && end <= entry.end)) {
        return "padding";
    }
    return "raw";
};
const toFileOffset = (addressSpace, address, mapper, romSize) => {
    if (addressSpace === SNES_FILE_ADDRESS_SPACE) {
        return address < romSize ? address : undefined;
    }
    if (addressSpace !== SNES_CPU_ADDRESS_SPACE) {
        return undefined;
    }
    const offset = snesRomAddressSpace.toOutputOffset(address, createSnesAddressContext(mapper));
    return offset >= 0 && offset < romSize ? offset : undefined;
};
/**
 * Validate annotation names against generated functions, hardware definitions, and RAM names.
 * @param {AnalysisProjectShards} shards Validated native project metadata.
 * @param {SnesMapper} mapper Selected ROM mapping.
 * @param {number} romSize Headerless ROM size.
 * @param {readonly string[]} ramNames Global symbols from RAM, layouts, bindings, and constants.
 * @returns {ReadonlyMap<string, string>} Unique assembly names keyed by native label id.
 */
export const snesSourceLabelNames = (shards, mapper, romSize, ramNames = []) => {
    const offsets = new Set(shards.labels.map((label) => toFileOffset(label.addressSpace, label.address, mapper, romSize)));
    const reserved = [...renderSnesHardwareDefines().matchAll(/^([A-Z_a-z]\w*)\s*=/gm)].map((match) => match[1]);
    const reservedNames = new Set(reserved.map((name) => name.toLowerCase()));
    // User RAM maps can reserve arbitrarily many names. None should be lost to a call-argument limit.
    for (const name of ramNames) {
        validateSourceLabelName(name);
        if (/^snes_/i.test(name) || reservedNames.has(name.toLowerCase())) {
            throw new Error(`Source input symbol '${name}' conflicts with another symbol.`);
        }
        reserved.push(name);
        reservedNames.add(name.toLowerCase());
    }
    for (const fn of shards.analysis) {
        if (fn.kind !== "function") {
            continue;
        }
        const offset = toFileOffset(fn.addressSpace, fn.address, mapper, romSize);
        if (offset !== undefined && !offsets.has(offset)) {
            const name = `Fn_${fn.address.toString(16).toUpperCase().padStart(6, "0")}`;
            if (reservedNames.has(name.toLowerCase())) {
                throw new Error(`Generated function '${name}' conflicts with a source input symbol.`);
            }
            reserved.push(name);
            reservedNames.add(name.toLowerCase());
            // Mirrored or repeated function candidates produce just one declaration per ROM offset.
            offsets.add(offset);
        }
    }
    for (const label of shards.labels) {
        if (label.sourceName && /^snes_/i.test(label.sourceName)) {
            throw new Error(`Source label '${label.sourceName}' uses the reserved SNES_ namespace.`);
        }
    }
    return projectSourceLabelNames(shards.labels, reserved);
};
const metadataLines = (shards, mapper, romSize, names) => {
    const values = new Map();
    const append = (offset, line) => {
        if (offset === undefined) {
            return;
        }
        values.set(offset, [...(values.get(offset) ?? []), line]);
    };
    for (const label of [...shards.labels].toSorted((a, b) => a.id.localeCompare(b.id))) {
        append(toFileOffset(label.addressSpace, label.address, mapper, romSize), {
            name: names.get(label.id),
            identity: label,
            ...(label.comment ? { comment: label.comment } : {}),
            ...(label.inlineComment ? { inlineComment: label.inlineComment } : {}),
        });
    }
    const suppressedOffsets = new Set(shards.labels
        .filter((label) => label.suppressed)
        .map((label) => toFileOffset(label.addressSpace, label.address, mapper, romSize)));
    for (const fn of shards.analysis.filter((record) => record.kind === "function")) {
        const offset = toFileOffset(fn.addressSpace, fn.address, mapper, romSize);
        // Removing a name must not immediately recreate it as a generated function label. The native
        // label remains an analysis seed independently of its presentation suppression.
        const suppressed = suppressedOffsets.has(offset);
        if (offset === undefined || suppressed || values.get(offset)?.some((line) => line.name)) {
            continue;
        }
        append(offset, {
            name: `Fn_${fn.address.toString(16).toUpperCase().padStart(6, "0")}`,
            inferredFunction: true,
            identity: fn,
        });
    }
    for (const region of [...shards.regions].toSorted((a, b) => a.id.localeCompare(b.id))) {
        append(toFileOffset(region.addressSpace, region.start, mapper, romSize), {
            comment: `Region: ${region.name}${region.context ? ` (${region.context})` : ""}`,
        });
    }
    for (const comment of [...shards.comments].toSorted((a, b) => a.id.localeCompare(b.id))) {
        append(toFileOffset(comment.addressSpace, comment.address, mapper, romSize), comment.placement === "inline-instruction"
            ? { instructionComment: comment.text }
            : { comment: comment.text });
    }
    return values;
};
/**
 * Keep label descriptions above labels and other annotations at the owner's indentation.
 * @param {readonly NamedLine[] | undefined} lines Native metadata at this exact address.
 * @param {boolean} [hasInstruction] Whether inline instruction comments will be emitted separately.
 * @param {string} [bodyIndent] Empty for named data; two spaces for instruction bodies.
 * @returns {string[]} Source lines preserving metadata order and label ownership.
 */
const renderedMetadata = (lines, hasInstruction = false, bodyIndent = "  ") => {
    if (!lines) {
        return [];
    }
    const output = [];
    const lastLabelIndex = lines.findLastIndex((line) => line.name);
    for (const [index, line] of lines.entries()) {
        // Label descriptions stay above their label. Comments after the last label or at an
        // unlabeled instruction belong to its body and must not terminate indentation folding.
        const indent = line.name || index < lastLabelIndex ? "" : bodyIndent;
        if (line.comment) {
            for (const text of line.comment.split(/\r\n|[\n\r\u2028\u2029]/)) {
                output.push(`${indent}; ${text}`);
            }
        }
        if (line.name) {
            output.push(`${line.name}:${line.inlineComment ? ` ; ${line.inlineComment}` : ""}`);
        }
        else if (line.inlineComment) {
            // An inline label comment still belongs to the same record when only its name is removed.
            output.push(`${indent}; ${line.inlineComment}`);
        }
        if (line.instructionComment && !hasInstruction) {
            output.push(`${indent}; [Instruction comment. Instruction unavailable] ${line.instructionComment}`);
        }
    }
    return output;
};
/** Positive data classifications remain authoritative even when execution was observed. */
const rawClassifications = new Set([
    "data8",
    "data16",
    "data24",
    "data32",
    "pointer16",
    "pointer24",
    "pointer32",
    "graphics",
    "music",
    "empty",
    "text",
]);
/**
 * Only the ROM-matched runtime-code namespace establishes an observed instruction extent.
 * Static propagation may inherit the same evidence IDs without observing those bytes.
 * @param {InstructionExportRecord} node Candidate from native runtime/static analysis.
 * @param {ReadonlySet<string>} runtimeEvidence IDs of runtime evidence retained by this project.
 * @returns {boolean} Whether the candidate has direct runtime provenance.
 */
const isCapturedRomInstruction = (node, runtimeEvidence) => node.id.startsWith("runtime:code:") && node.evidence.some((id) => runtimeEvidence.has(id));
/**
 * Reports whether project evidence requires one CFG instruction to remain raw bytes.
 * @param {InstructionExportRecord} node Candidate instruction and its ROM extent.
 * @param {HalfOpenIntervalIndex<IntervalAnnotation>} annotations File-space annotation index shared by the export.
 * @param {ReadonlySet<string>} runtimeEvidence IDs identifying actual runtime evidence sources.
 * @returns {boolean} Whether a data classification or uncontradicted unreached interval blocks emission.
 */
const rejectedByAnnotation = (node, annotations, runtimeEvidence) => {
    // analyzeSnesRuntimeCode assigns this namespace and a fileOffset only after matching captured
    // bytes to ROM. Static nodes may inherit runtime evidence, so provenance alone is insufficient.
    const capturedRomInstruction = isCapturedRomInstruction(node, runtimeEvidence);
    return (node.fileOffset === undefined ||
        annotations
            // Performance invariant: use one range query. Do not scan every annotation for every CFG node.
            .overlapping(node.fileOffset, node.fileOffset + node.size)
            .some((entry) => rawClassifications.has(entry.classification) ||
            (entry.classification === "unreached" && !capturedRomInstruction)));
};
/**
 * Selects deterministic, conflict-free CFG nodes that can be emitted as native 65816 source.
 *
 * Annotation and metadata indexes are constructed by the caller and reused for every candidate.
 * The function still re-decodes and checks each instruction against its recorded specification so
 * an optimization cannot turn uncertain/conflicting bytes into source text.
 * Identical encodings use numeric operands when processor-state variants disagree on symbol names.
 * @param {RomImage} rom Immutable headerless ROM content.
 * @param {SnesMapper} mapper Selected mapper used for continuity checks.
 * @param {AnalysisProjectShards} shards Validated project evidence.
 * @param {ReadonlyMap<number, readonly NamedLine[]>} metadata Metadata keyed by ROM file offset.
 * @param {HalfOpenIntervalIndex<IntervalAnnotation>} annotations Reusable file-space annotation index.
 * @param {ReadonlyMap<number, SnesRamMapVariable>} ramVariables Canonical WRAM and explicit SRAM CPU locations to name.
 * @param {StructuredRomLayout | undefined} structure Header/vector interval excluded from code.
 * @param {ReadonlyMap<number, string>} [sourceLabels] Friendly names at exact exported addresses.
 * @param {ReadonlyMap<number, string>} [structFields] Addressed struct fields for RAM and ROM data.
 * @param {ReadonlyMap<number, string>} [indexedStructFields] Addressed fields including biased array bases.
 * @param {Iterable} [instructionGroups] Complete SQL-ordered groups, avoiding a full CFG array.
 * @param {ReadonlyMap<number, SnesStructInstructionUse>} [instructionUses] Byte-checked explicit uses by ROM offset.
 * @returns {ReadonlyMap<number, PlannedInstruction>} Safe instructions keyed by start offset.
 */
const planInstructions = (rom, mapper, shards, metadata, annotations, ramVariables, structure, sourceLabels, structFields, indexedStructFields, instructionGroups, instructionUses) => {
    const decoder = new Cpu65816Decoder();
    const source = new Uint8ArrayDecoderSource(rom.bytes());
    const runtimeEvidence = new Set(shards.evidence.filter((record) => record.source === "runtime").map((record) => record.id));
    const conflictNodes = new Set(shards.analysis
        .filter((record) => record.kind === "conflict")
        .flatMap((record) => record.nodes));
    const metadataOffsets = [...metadata.keys()].toSorted((left, right) => left - right);
    const explicitMetadataOffsets = metadataOffsets.filter((offset) => metadata.get(offset).some((line) => !line.inferredFunction));
    const hasInteriorMetadata = (node) => {
        // An imported entry bit may point inside an observed operand. Only inferred function
        // markers yield here; explicit labels/comments still require their exact source boundary.
        const offsets = isCapturedRomInstruction(node, runtimeEvidence)
            ? explicitMetadataOffsets
            : metadataOffsets;
        const start = node.fileOffset;
        const end = start + node.size;
        // Binary search the first metadata offset after start. A linear scan here would multiply label,
        // comment, and region counts by every CFG candidate.
        let low = 0;
        let high = offsets.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if (offsets[middle] <= start) {
                low = middle + 1;
            }
            else {
                high = middle;
            }
        }
        return low < offsets.length && offsets[low] < end;
    };
    const fallbackGroups = () => {
        const grouped = new Map();
        for (const record of shards.analysis) {
            if (record.kind !== "cfg-node" || record.fileOffset === undefined || record.fileOffset < 0) {
                continue;
            }
            const group = grouped.get(record.fileOffset) ?? [];
            group.push(record);
            grouped.set(record.fileOffset, group);
        }
        return [...grouped].toSorted(([a], [b]) => a - b).map(([, records]) => records);
    };
    const candidates = new Map();
    const context = createSnesAddressContext(mapper);
    let previousOffset = -1;
    // SQL callers hold only the current offset's variants. In-memory callers retain the same semantic path.
    for (const group of instructionGroups ?? fallbackGroups()) {
        if (!group.length) {
            continue;
        }
        const offset = group[0].fileOffset;
        if (offset === undefined ||
            offset <= previousOffset ||
            group.some((record) => record.fileOffset !== offset)) {
            throw new Error("Export instruction groups must have distinct, ascending file offsets.");
        }
        previousOffset = offset;
        const records = group.filter((record) => record.fileOffset !== undefined &&
            record.fileOffset >= 0 &&
            record.fileOffset + record.size <= rom.length &&
            !(structure !== undefined &&
                record.fileOffset < structure.end &&
                structure.start < record.fileOffset + record.size) &&
            !conflictNodes.has(record.id) &&
            !rejectedByAnnotation(record, annotations, runtimeEvidence) &&
            !hasInteriorMetadata(record));
        if (!records.length) {
            continue;
        }
        const sourceAddress = snesRomAddressSpace.fromOutputOffset(offset, context);
        if (sourceAddress < 0) {
            continue;
        }
        const variants = records
            .toSorted((left, right) => left.id.localeCompare(right.id))
            .map((record) => {
            const state = decodeState(record.incomingState);
            const result = decoder.decode({ source, offset, logicalAddress: record.address, state });
            if (result.kind !== "instruction" ||
                result.instruction.size !== record.size ||
                result.instruction.opcode !== record.opcode ||
                result.instruction.specificationId !== record.specificationId) {
                return undefined;
            }
            return {
                record,
                instruction: result.instruction,
                source: formatSnes65816SourceInstruction(result.instruction, ramVariables, sourceAddress, sourceLabels, structFields, indexedStructFields),
            };
        });
        const resolved = variants.filter((entry) => entry !== undefined);
        if (resolved.length !== variants.length) {
            continue;
        }
        const first = resolved[0];
        // Every variant reads the same ROM offset. Matching size and specification establish one encoding.
        if (resolved.some((entry) => entry.record.size !== first.record.size ||
            entry.record.specificationId !== first.record.specificationId)) {
            continue;
        }
        // A rebuilt static CFG can add seed nodes with unknown DBR/DP beside an observed address.
        // Unknown static state supplies no contradictory address evidence; it must not erase a
        // captured name. Keep every runtime variant and every resolved static address in the vote.
        const capturedDataAddress = resolved.some(({ record, instruction }) => isCapturedRomInstruction(record, runtimeEvidence) &&
            instruction.references.some((reference) => reference.kind === "data" &&
                reference.operandIndex === 0 &&
                reference.address !== undefined));
        const namingVariants = resolved.filter(({ record, instruction }) => !capturedDataAddress ||
            !record.id.startsWith("static:cfg:") ||
            !instruction.references.some((reference) => reference.kind === "data" &&
                reference.operandIndex === 0 &&
                reference.address === undefined));
        let renderedSource = namingVariants[0].source;
        if (namingVariants.some((entry) => entry.source !== renderedSource)) {
            // DBR/direct-page changes can give identical ROM instructions different RAM, struct, or
            // hardware names. Keep the instruction with a numeric operand instead of inventing a conflict.
            // Removing data references also disables hardware naming. Control-flow labels remain usable.
            const numericSources = resolved.map(({ instruction }) => formatSnes65816SourceInstruction({
                ...instruction,
                references: instruction.references.filter((reference) => reference.kind !== "data"),
            }, undefined, sourceAddress, sourceLabels));
            if (numericSources.some((numericSource) => numericSource !== numericSources[0])) {
                continue;
            }
            renderedSource = numericSources[0];
        }
        const use = instructionUses?.get(offset);
        if (use) {
            // Every context must agree with the explicit operand contract. Observed accesses remain
            // comments even when a different DBR/direct-page context forced the numeric fallback above.
            for (const variant of resolved) {
                renderedSource = applySnesStructInstructionOperand(variant.instruction, renderedSource, use);
            }
        }
        candidates.set(offset, {
            nativeAddress: first.record.address,
            start: offset,
            end: offset + first.record.size,
            source: renderedSource,
            nodeIds: resolved.map((entry) => entry.record.id),
            flow: sourceFlowTarget(first.instruction, sourceAddress),
            ...(use ? { structComments: renderSnesStructUseComments(use) } : {}),
        });
    }
    const owners = new Map();
    for (const instruction of candidates.values()) {
        for (let offset = instruction.start; offset < instruction.end; offset++) {
            owners.set(offset, [...(owners.get(offset) ?? []), instruction.start]);
        }
    }
    for (const [start, instruction] of candidates) {
        if ([...Array(instruction.end - instruction.start).keys()].some((index) => (owners.get(start + index)?.length ?? 0) !== 1)) {
            candidates.delete(start);
            continue;
        }
        const firstAddress = snesRomAddressSpace.fromOutputOffset(start, context);
        const lastAddress = snesRomAddressSpace.fromOutputOffset(instruction.end - 1, context);
        if (firstAddress < 0 || lastAddress !== firstAddress + instruction.end - start - 1) {
            candidates.delete(start);
        }
    }
    return candidates;
};
/**
 * Omit inferred entry markers disproved by accepted instruction interiors, leaving native
 * records intact. Resolve overlaps first so a rejected runtime candidate cannot hide metadata.
 * @param {ReadonlyMap<number, readonly NamedLine[]>} metadata Original source metadata by ROM offset.
 * @param {ReadonlyMap<number, PlannedInstruction>} instructions Final nonoverlapping instruction plan.
 * @returns {ReadonlyMap<number, readonly NamedLine[]>} Metadata whose boundaries can appear in source.
 */
const reconcileInferredFunctionMarkers = (metadata, instructions) => {
    const index = new HalfOpenIntervalIndex([...instructions.values()]);
    const result = new Map();
    for (const [offset, lines] of metadata) {
        let retained = lines;
        if (index.overlapping(offset, offset + 1).some((instruction) => instruction.start < offset)) {
            retained = lines.filter((line) => !line.inferredFunction);
        }
        if (retained.length) {
            result.set(offset, retained);
        }
    }
    return result;
};
/**
 * Partitions the complete ROM into deterministic source-emission spans.
 *
 * All instruction, metadata, annotation, region, bank, header, and vector boundaries become cuts
 * before roles are assigned. Because spans cannot cross those boundaries, `roleAt()` can use an
 * indexed point lookup rather than repeatedly scanning the complete annotation shard.
 * @param {RomImage} rom Immutable headerless ROM content.
 * @param {SnesMapper} mapper Selected mapper and bank layout.
 * @param {AnalysisProjectShards} shards Validated project evidence supplying cuts.
 * @param {ReadonlyMap<number, PlannedInstruction>} instructions Safe native-source instructions.
 * @param {ReadonlyMap<number, readonly NamedLine[]>} metadata Metadata keyed by file offset.
 * @param {HalfOpenIntervalIndex<IntervalAnnotation>} annotations Reusable file-space annotation index.
 * @param {StructuredRomLayout | undefined} structure Field-aligned header/vector source plan.
 * @param {readonly SnesStructRomField[]} structFields Physical fields in explicitly bound ROM arrays.
 * @returns {readonly PlannedSpan[]} Complete, ordered, non-overlapping export plan.
 */
const planSpans = (rom, mapper, shards, instructions, metadata, annotations, structure, structFields, typedData) => {
    const bankSize = mapper === "hirom" || mapper === "exhirom" || mapper === "norom" ? 0x10000 : 0x8000;
    const cuts = new Set([0, rom.length]);
    const addExternalCut = (offset) => {
        if (offset <= 0 || offset >= rom.length) {
            return;
        }
        if (structure && offset > structure.start && offset < structure.end) {
            return;
        }
        cuts.add(offset);
    };
    for (let offset = bankSize; offset < rom.length; offset += bankSize) {
        cuts.add(offset);
    }
    for (const field of structure?.fields ?? []) {
        cuts.add(field.start);
        cuts.add(field.end);
    }
    const structIndex = new HalfOpenIntervalIndex(structFields);
    const instructionIndex = new HalfOpenIntervalIndex([...instructions.values()]);
    for (const field of structFields) {
        if (structure && field.start < structure.end && structure.start < field.end) {
            throw new Error(`Struct field '${field.expression}' overlaps the cartridge header/vectors.`);
        }
        cuts.add(field.start);
        cuts.add(field.end);
    }
    for (const [offset, instruction] of instructions) {
        if (structIndex.overlapping(offset, instruction.end).length > 0) {
            throw new Error(`ROM struct overlaps decoded code at ${hex(offset)}. Resolve the conflicting evidence before export.`);
        }
        cuts.add(offset);
        cuts.add(instruction.end);
    }
    for (const offset of metadata.keys()) {
        addExternalCut(offset);
    }
    for (const entry of shards.annotations) {
        if (entry.addressSpace !== SNES_FILE_ADDRESS_SPACE) {
            continue;
        }
        if (entry.classification === "opcode" || entry.classification === "operand") {
            continue;
        }
        // Byte-wise imported data classifications need not fragment an explicitly typed field.
        // Labels, comments, and region boundaries still receive their own cuts above/below.
        for (const offset of [entry.start, entry.end]) {
            // Generic byte classifications must not fragment an explicitly wider data element. Native
            // labels/comments still cut it and render the affected partial elements as literal bytes.
            const typed = typedData && snesTypedDataAt(typedData, offset, offset + 1);
            if (entry.classification === "data8" &&
                typed &&
                typed.width > 1 &&
                offset > typed.start &&
                offset < typed.end) {
                continue;
            }
            // Stale coverage can split an opcode from its operands. Once an instruction is accepted,
            // those negative-coverage boundaries cannot split it back into raw source spans.
            if (entry.classification === "unreached" &&
                instructionIndex.overlapping(offset, offset + 1).some((node) => node.start < offset)) {
                continue;
            }
            const overlappingFields = structIndex.overlapping(offset, offset + 1);
            const field = overlappingFields.length > 0 ? overlappingFields[0] : undefined;
            if (!field || offset === field.start) {
                addExternalCut(offset);
            }
        }
    }
    for (const region of shards.regions) {
        const start = toFileOffset(region.addressSpace, region.start, mapper, rom.length);
        const last = toFileOffset(region.addressSpace, region.end - 1, mapper, rom.length);
        if (start !== undefined) {
            addExternalCut(start);
        }
        if (last !== undefined) {
            addExternalCut(last + 1);
        }
    }
    const sorted = [...cuts].toSorted((left, right) => left - right);
    return sorted.slice(0, -1).map((start, index) => {
        const end = sorted[index + 1];
        const instruction = instructions.get(start);
        const structured = structure?.byStart.get(start);
        const overlappingFields = structIndex.overlapping(start, end);
        const structField = overlappingFields.length > 0 ? overlappingFields[0] : undefined;
        if (instruction?.end === end) {
            return { start, end, role: "code", instruction };
        }
        if (structured?.end === end) {
            return { start, end, role: structured.role, structured };
        }
        if (structField) {
            return { start, end, role: "raw", structField };
        }
        return { start, end, role: roleAt(start, end, annotations) };
    });
};
/**
 * Regroup only whole records. The field plan remains the authority for safety:
 * bank cuts, interior labels/comments, and region boundaries prevent grouping.
 * In those cases the old assert + db/dw renderer preserves exact byte ownership.
 * @param {readonly PlannedSpan[]} spans Safe field-aligned export plan.
 * @param {ReadonlyMap<number, readonly NamedLine[]>} metadata Source labels/comments by file offset.
 * @param {AnalysisProjectShards} shards Region boundaries that must remain visible.
 * @param {SnesMapper} mapper Address mapping and bank size.
 * @param {number} romSize Headerless ROM length.
 * @returns {readonly PlannedSpan[]} Same byte coverage with complete records grouped.
 */
const groupStructRecords = (spans, metadata, shards, mapper, romSize) => {
    const protectedCuts = new Set(metadata.keys());
    const bankSize = mapper === "hirom" || mapper === "exhirom" || mapper === "norom" ? 0x10000 : 0x8000;
    for (let offset = bankSize; offset < romSize; offset += bankSize) {
        protectedCuts.add(offset);
    }
    for (const region of shards.regions) {
        const start = toFileOffset(region.addressSpace, region.start, mapper, romSize);
        const last = toFileOffset(region.addressSpace, region.end - 1, mapper, romSize);
        if (start !== undefined) {
            protectedCuts.add(start);
        }
        if (last !== undefined) {
            protectedCuts.add(last + 1);
        }
    }
    const grouped = [];
    for (let index = 0; index < spans.length;) {
        const first = spans[index];
        const record = first.structField?.record;
        let next = index;
        if (record && first.start === record.start) {
            while (next < spans.length &&
                spans[next].structField?.record === record &&
                (next === index || !protectedCuts.has(spans[next].start))) {
                next++;
            }
        }
        if (record && next > index && spans[next - 1].end === record.end) {
            grouped.push({ start: record.start, end: record.end, role: "raw", structRecord: record });
            index = next;
        }
        else {
            grouped.push(first);
            index++;
        }
    }
    return grouped;
};
const regionIdsFor = (start, end, shards, mapper, romSize) => shards.regions
    .filter((region) => {
    const regionStart = toFileOffset(region.addressSpace, region.start, mapper, romSize);
    const regionLast = toFileOffset(region.addressSpace, region.end - 1, mapper, romSize);
    return (regionStart !== undefined &&
        regionLast !== undefined &&
        regionStart < end &&
        start < regionLast + 1);
})
    .map((region) => region.id)
    .toSorted();
/**
 * Renders a deterministic 65816 source tree that can be reassembled with this plugin.
 * Confident CFG nodes become width-qualified instructions. Unknown bytes remain
 * `incbin` assets. The internal/expanded SNES headers, vector words, and explicitly
 * bound ROM struct fields become native data source. An optional 512-byte copier
 * header remains an asset. Optional struct bindings also name RAM/ROM operands.
 * Checksums are preserved, not recomputed.
 * @param {{ readonly manifest: AnalysisProjectManifest; readonly shards: AnalysisProjectShards }} project Loaded analysis project.
 * @param {RomImage} rom Immutable ROM used for asset bytes and copier-header extraction.
 * @param {string} directory Immutable input snapshot containing research recipes and build configuration.
 * @param {SnesSourceExportOptions} options Provenance hash and required output sink. The renderer never publishes files.
 * @returns {SourceExportManifest} Rendered file inventory, spans, and rebuild configuration.
 */
export const exportSnes65816Source = (project, rom, directory, options) => {
    const emitFile = (_root, relative, bytes, kind, files) => {
        const value = typeof bytes === "string" ? Buffer.from(bytes) : bytes;
        options.emitFile({ path: relative, bytes: value });
        files.push({ path: relative, kind, size: value.length, sha256: sourceExportSha256(value) });
    };
    const commentLineWidth = options.commentLineWidth ?? 100;
    if (!Number.isSafeInteger(commentLineWidth) || commentLineWidth < 20) {
        throw new Error("commentLineWidth must be an integer of at least 20 columns.");
    }
    if (options.wrapComments !== undefined && typeof options.wrapComments !== "boolean") {
        throw new Error("wrapComments must be a boolean.");
    }
    const formatComments = (source) => {
        const cleaned = omitAssemblyResearchReferences(source);
        return options.wrapComments === false
            ? cleaned
            : wrapAssemblyComments(cleaned, commentLineWidth);
    };
    const structLineWidth = options.structLineWidth ?? 100;
    if (!Number.isSafeInteger(structLineWidth) || structLineWidth < 40) {
        throw new Error("structLineWidth must be an integer of at least 40 columns.");
    }
    const mapper = project.manifest.mapping.mapper;
    if (!isSnesMapper(mapper)) {
        throw new Error(`Unsupported SNES mapper '${mapper}'.`);
    }
    const context = createSnesAddressContext(mapper);
    const structure = structuredRomLayout(rom, mapper);
    // Pure rendering reads an explicit input snapshot. New-project initialization owns creation of
    // the empty RAM map; a renderer must not mutate a user's inputs merely by inspecting them.
    if (!fs.existsSync(path.join(directory, SNES_RAM_MAP_SOURCE))) {
        throw new Error("Pure source rendering requires an explicit ram-map.json input.");
    }
    const assetIncludes = loadAssetIncludeMap(directory);
    const ramMap = loadSnesRamMap(directory);
    const ramVariables = indexSnesRamMap(ramMap.variables);
    const structMap = loadSnesStructMap(directory);
    const structRomFields = planSnesStructRomFields(structMap, rom.length, (offset) => snesRomAddressSpace.fromOutputOffset(offset, context));
    const structFields = indexSnesStructFields(structMap);
    const indexedStructFields = indexSnesStructFields(structMap, true);
    const instructionUses = indexSnesStructInstructionUses(structMap?.instructionUses, rom, (address) => toFileOffset(SNES_CPU_ADDRESS_SPACE, address, mapper, rom.length));
    const structNames = [
        ...(structMap?.structures.map(({ id }) => id) ?? []),
        ...(structMap?.bindings.map(({ name }) => name) ?? []),
        ...(structMap?.constants?.map(({ name }) => name) ?? []),
    ];
    const ramNames = new Set(ramMap.variables.map(({ name }) => name.toLowerCase()));
    for (const name of structNames) {
        if (ramNames.has(name.toLowerCase())) {
            throw new Error(`Struct-map name '${name}' conflicts with a RAM variable.`);
        }
    }
    const names = snesSourceLabelNames(project.shards, mapper, rom.length, [
        ...ramMap.variables.map(({ name }) => name),
        ...structNames,
    ]);
    const initialMetadata = metadataLines(project.shards, mapper, rom.length, names);
    // Build one immutable index for both instruction rejection and raw/padding span roles. Keeping a
    // single instance is essential: these consumers collectively issue a query for most CFG nodes
    // and planned spans in a production ROM.
    const annotations = new HalfOpenIntervalIndex(project.shards.annotations.filter(({ addressSpace }) => addressSpace === SNES_FILE_ADDRESS_SPACE));
    const typedData = indexSnesTypedData(project.shards.annotations, project.shards.evidence);
    const instructions = planInstructions(rom, mapper, project.shards, initialMetadata, annotations, ramVariables, structure, undefined, structFields, indexedStructFields, options.instructionGroups, instructionUses);
    const metadata = reconcileInferredFunctionMarkers(initialMetadata, instructions);
    // Rejected, overlapping and undecoded sites cannot silently acquire authoritative-looking uses.
    // Do this after instruction conflict resolution and before any generated file is written.
    for (const [offset, use] of instructionUses ?? []) {
        if (!instructions.has(offset)) {
            throw new Error(`Struct instruction use at ${hex(use.address)} requires an accepted instruction.`);
        }
    }
    const fieldPlan = planSpans(rom, mapper, project.shards, instructions, metadata, annotations, structure, structRomFields, typedData);
    const bankSize = mapper === "hirom" || mapper === "exhirom" || mapper === "norom" ? 0x10000 : 0x8000;
    const planned = applyAssetIncludes(groupStructRecords(fieldPlan, metadata, project.shards, mapper, rom.length), assetIncludes, metadata, bankSize);
    // Instruction planning can suppress inferred operand-interior markers. Only labels emitted at
    // final span starts may enter the lookup, including fallback Fn_ and imported native names.
    const emittedLabels = new Map();
    for (const span of planned) {
        if (span.structured) {
            continue;
        }
        const name = metadata.get(span.start)?.find((line) => line.name)?.name;
        if (name) {
            emittedLabels.set(span.start, name);
        }
    }
    const files = [];
    {
        // Fixed original-ROM blocks keep binary identity independent of new code/data boundaries.
        // Raw includes consume slices; build validation rejects edits to bytes no longer consumed.
        const blockSize = 0x1000;
        for (let start = 0; start < rom.length; start += blockSize) {
            emitFile(directory, `assets/raw/${start.toString(16).padStart(6, "0")}.bin`, rom.read(start, Math.min(blockSize, rom.length - start)), "asset", files);
        }
        emitFile(directory, "source-raw.json", canonicalJson({
            format: "uttori-source-raw",
            version: 1,
            romSha256: rom.identity.contentSha256,
            blockSize,
        }), "configuration", files);
        emitFile(directory, "source-code.json", canonicalJson({
            format: "uttori-source-code",
            version: 1,
            romSha256: rom.identity.contentSha256,
            ranges: planned
                .filter((span) => span.role === "code")
                .map((span) => ({ start: span.start, end: span.end })),
        }), "configuration", files);
        // Stable symbol identity is deliberately smaller than a source ownership map. Editor renames
        // need the original research key, not line ranges that become stale after ordinary text edits.
        const symbols = planned.flatMap((span) => span.structured
            ? []
            : (metadata.get(span.start) ?? [])
                .filter((line) => line.name && line.identity)
                .map((line) => ({
                id: line.inferredFunction
                    ? `symbol:${line.identity.addressSpace}:${line.identity.address.toString(16)}`
                    : line.identity.id,
                name: line.name,
                addressSpace: line.identity.addressSpace,
                address: line.identity.address,
                evidence: line.identity.evidence,
            })));
        emitFile(directory, "source-symbols.json", canonicalJson({
            format: "uttori-source-symbols",
            version: 1,
            romSha256: rom.identity.contentSha256,
            symbols,
        }), "configuration", files);
    }
    const spans = [];
    const banks = new Map();
    for (const span of planned) {
        const bank = Math.floor(span.start / bankSize);
        const entries = banks.get(bank) ?? [];
        entries.push(span);
        banks.set(bank, entries);
    }
    const bankSources = [];
    for (const [bank, bankSpans] of [...banks].toSorted(([left], [right]) => left - right)) {
        const bankPath = `banks/bank-${bank.toString(16).padStart(3, "0")}.asm`;
        bankSources.push(bankPath);
        const lines = [`; Generated bank ${bank.toString(16).toUpperCase().padStart(3, "0")}.`];
        let nextAddress;
        let table;
        for (const [spanIndex, span] of bankSpans.entries()) {
            const address = snesRomAddressSpace.fromOutputOffset(span.start, context);
            if (address < 0) {
                throw new Error(`Mapper '${mapper}' cannot represent ROM offset ${hex(span.start)}.`);
            }
            const spanMetadata = metadata.get(span.start);
            const named = span.structured
                ? []
                : renderedMetadata(spanMetadata, Boolean(span.instruction), span.structRecord ? "" : "  ");
            let closedTable = false;
            if (table &&
                (span.structRecord?.binding.name !== table.name ||
                    span.structRecord.index !== table.nextIndex ||
                    named.length > 0 ||
                    nextAddress !== address)) {
                lines.push("endDataStructs");
                table = undefined;
                closedTable = true;
            }
            if (nextAddress !== address) {
                lines.push("", `org ${hex(address)}`);
            }
            // Separate declarations from adjacent code/data, but keep labels and comments attached
            // to their own data and keep consecutive rows inside the same table together.
            if ((named.length ||
                closedTable ||
                (!table && (span.structRecord || bankSpans[spanIndex - 1]?.structRecord))) &&
                lines.at(-1) !== "") {
                lines.push("");
            }
            if (named.length) {
                // Multiple imports can attach an input-sized set of labels/comments to the same offset.
                for (const line of named) {
                    lines.push(line);
                }
            }
            if (span.instruction) {
                // Explicit operand-size suffixes fix the encoding. Emitting ambient M/X directives here
                // would make identical instructions churn whenever the preferred captured state changes.
                for (const comment of span.instruction.structComments ?? []) {
                    // These comments belong to the instruction body; column zero would end label folding.
                    lines.push(`  ; ${comment}`);
                }
                const inline = (metadata.get(span.start) ?? []).flatMap((line) => line.instructionComment ? [line.instructionComment] : []);
                let source = span.instruction.source;
                const flow = span.instruction.flow;
                if (flow) {
                    const targetOffset = toFileOffset(SNES_CPU_ADDRESS_SPACE, flow.address, mapper, rom.length);
                    const name = targetOffset === undefined ? undefined : emittedLabels.get(targetOffset);
                    if (name && targetOffset !== undefined) {
                        const labelAddress = snesRomAddressSpace.fromOutputOffset(targetOffset, context);
                        source = renderFlowLabel(source, flow, name, labelAddress);
                    }
                }
                lines.push(`  ${source}${inline.length ? ` ; ${inline.join(" | ")}` : ""}`);
                spans.push({
                    id: `code:${span.start.toString(16).padStart(6, "0")}`,
                    source: "analysis",
                    addressSpace: SNES_FILE_ADDRESS_SPACE,
                    start: span.start,
                    end: span.end,
                    role: "code",
                    file: bankPath,
                    nodeIds: span.instruction.nodeIds,
                    regionIds: regionIdsFor(span.start, span.end, project.shards, mapper, rom.length),
                });
            }
            else if (span.assetInclude) {
                lines.push(`  ${span.assetInclude}`);
                spans.push({
                    id: `asset:${span.start.toString(16).padStart(6, "0")}`,
                    source: "asset-includes.json",
                    addressSpace: SNES_FILE_ADDRESS_SPACE,
                    start: span.start,
                    end: span.end,
                    role: "raw",
                    file: bankPath,
                    regionIds: regionIdsFor(span.start, span.end, project.shards, mapper, rom.length),
                });
            }
            else if (span.structured) {
                const headings = [];
                if (span.start === structure?.start && structure.start < structure.headerOffset) {
                    headings.push("; SNES expanded cartridge header ($FFB0-$FFBF).");
                }
                if (span.start === structure?.headerOffset) {
                    headings.push("; SNES internal cartridge header ($FFC0-$FFDF).");
                }
                if (span.start === (structure?.headerOffset ?? -0x20) + 0x20) {
                    headings.push("; SNES 65C816 interrupt vector table ($FFE0-$FFFF).");
                }
                lines.push("", ...headings, ...span.structured.lines);
                spans.push({
                    id: `${span.role}:${span.start.toString(16).padStart(6, "0")}`,
                    source: "rom",
                    addressSpace: SNES_FILE_ADDRESS_SPACE,
                    start: span.start,
                    end: span.end,
                    role: span.role,
                    file: bankPath,
                    regionIds: regionIdsFor(span.start, span.end, project.shards, mapper, rom.length),
                });
            }
            else if (span.structRecord) {
                const record = span.structRecord;
                const next = bankSpans[spanIndex + 1]?.structRecord;
                // Stop/restart tables around record labels so their addresses and source
                // lines remain independently navigable. Single records use dataStruct.
                if (!table &&
                    next?.binding === record.binding &&
                    next.start === record.end &&
                    next.index === record.index + 1 &&
                    !metadata.has(next.start)) {
                    table = { name: record.binding.name, nextIndex: record.index };
                    // Bindings already name this data. Legacy guide labels never make it a code body.
                    lines.push(`dataStructs ${record.binding.name}`);
                }
                const fields = renderSnesStructInitializerFields(record, rom.read(record.start, record.end - record.start));
                // Row comments belong to the binding index, so they neither split arrays nor create labels.
                const entryComment = record.binding.entryComments?.[record.index];
                if (table) {
                    lines.push(...(entryComment ? [`  ; ${entryComment}`] : []), ...formatStructDeclaration(`  [${record.index}] = `, fields, structLineWidth));
                    table.nextIndex = record.index + 1;
                }
                else {
                    const reference = record.binding.count === 1 && record.index === 0
                        ? record.binding.name
                        : `${record.binding.name}[${record.index}]`;
                    lines.push(...(entryComment ? [`; ${entryComment}`] : []), ...formatStructDeclaration(`dataStruct ${reference}, `, fields, structLineWidth));
                }
                spans.push({
                    id: `struct:${span.start.toString(16).padStart(6, "0")}`,
                    source: SNES_STRUCT_MAP_SOURCE,
                    addressSpace: SNES_FILE_ADDRESS_SPACE,
                    start: span.start,
                    end: span.end,
                    role: "raw",
                    file: bankPath,
                    regionIds: regionIdsFor(span.start, span.end, project.shards, mapper, rom.length),
                });
            }
            else if (span.structField) {
                // Interior native metadata can force a record back to field directives. Keep its entry
                // identity once at the record start, even when that first field is itself fragmented.
                const record = span.structField.record;
                const entryComment = record?.binding.entryComments?.[record.index];
                if (record?.start === span.start && entryComment) {
                    lines.push(`  ; ${entryComment}`);
                }
                // Each field always renders two lines: a placement assertion and one data directive.
                lines.push(...renderSnesStructData(span.structField, span.start, rom.read(span.start, span.end - span.start)));
                spans.push({
                    id: `struct:${span.start.toString(16).padStart(6, "0")}`,
                    source: SNES_STRUCT_MAP_SOURCE,
                    addressSpace: SNES_FILE_ADDRESS_SPACE,
                    start: span.start,
                    end: span.end,
                    role: "raw",
                    file: bankPath,
                    regionIds: regionIdsFor(span.start, span.end, project.shards, mapper, rom.length),
                });
            }
            else {
                const typed = snesTypedDataAt(typedData, span.start, span.end);
                if (typed) {
                    lines.push(...renderSnesTypedData(rom.read(span.start, span.end - span.start), span.start, typed));
                    spans.push({
                        id: `data:${span.start.toString(16).padStart(6, "0")}`,
                        source: "analysis",
                        addressSpace: SNES_FILE_ADDRESS_SPACE,
                        start: span.start,
                        end: span.end,
                        role: "raw",
                        file: bankPath,
                        regionIds: regionIdsFor(span.start, span.end, project.shards, mapper, rom.length),
                    });
                }
                else {
                    const blockSize = 0x1000;
                    const assetPath = `assets/raw/${(Math.floor(span.start / blockSize) * blockSize).toString(16).padStart(6, "0")}.bin`;
                    for (let offset = span.start; offset < span.end;) {
                        const block = Math.floor(offset / blockSize) * blockSize;
                        const end = Math.min(span.end, block + blockSize);
                        const name = `assets/raw/${block.toString(16).padStart(6, "0")}.bin`;
                        lines.push(`  incbin "../${name}":${hex(offset - block, 4)}..${hex(end - block, 4)}`);
                        offset = end;
                    }
                    spans.push({
                        id: `${span.role}:${span.start.toString(16).padStart(6, "0")}`,
                        source: "rom",
                        addressSpace: SNES_FILE_ADDRESS_SPACE,
                        start: span.start,
                        end: span.end,
                        role: span.role,
                        file: assetPath,
                        regionIds: regionIdsFor(span.start, span.end, project.shards, mapper, rom.length),
                    });
                }
            }
            nextAddress = address + span.end - span.start;
        }
        if (table) {
            lines.push("endDataStructs");
        }
        emitFile(directory, bankPath, formatComments(`${lines.join("\n")}\n`), "source", files);
    }
    if (rom.identity.headerSize === 512) {
        const copier = "assets/copier-header.bin";
        emitFile(directory, copier, rom.copierHeaderBytes(), "asset", files);
        spans.push({
            id: "copier-header:000000",
            source: "rom",
            addressSpace: "rom.file-with-header",
            start: 0,
            end: 512,
            role: "copier-header",
            file: copier,
        });
    }
    const main = [
        "; Deterministic native source generated by Uttori ASM.",
        "; Edit and commit source normally. Regenerate through the project's Git history.",
        mapperDirective(mapper),
        "arch 65816",
        ".smart off",
        "",
        `incsrc "${SNES_HARDWARE_DEFINES_SOURCE}"`,
        `incsrc "${SNES_RAM_DEFINES_SOURCE}"`,
        ...(structMap ? [`incsrc "${SNES_STRUCT_DEFINES_SOURCE}"`] : []),
        "",
        ...bankSources.map((source) => `incsrc "${source}"`),
        "",
    ].join("\n");
    const hardwareSource = formatComments(renderSnesHardwareDefines());
    emitFile(directory, SNES_HARDWARE_DEFINES_SOURCE, hardwareSource, "source", files);
    emitFile(directory, SNES_RAM_MAP_SCHEMA_SOURCE, renderSnesRamMapSchema(), "configuration", files);
    emitFile(directory, SNES_RAM_DEFINES_SOURCE, formatComments(renderSnesRamDefines(ramMap.variables, ramMap.file)), "source", files);
    emitFile(directory, "main.asm", formatComments(main), "source", files);
    if (structMap) {
        emitFile(directory, SNES_STRUCT_DEFINES_SOURCE, formatComments(renderSnesStructDefines(structMap)), "source", files);
    }
    const annotationIssues = [...project.shards.labels, ...project.shards.comments]
        .flatMap((record) => {
        const offset = toFileOffset(record.addressSpace, record.address, mapper, rom.length);
        let reason;
        if (offset === undefined) {
            reason =
                "Address does not map to this ROM export. Annotation retained in the analysis project.";
        }
        else if (structure && structure.start <= offset && offset < structure.end) {
            reason =
                "Annotation is inside a structured header/vector field. Annotation retained in the analysis project.";
        }
        else if ("placement" in record &&
            record.placement === "inline-instruction" &&
            !instructions.has(offset)) {
            reason =
                "No exportable instruction starts here. Rendered as a standalone comment. Inline placement remains saved.";
        }
        return reason
            ? [{ id: record.id, addressSpace: record.addressSpace, address: record.address, reason }]
            : [];
    })
        .toSorted((left, right) => left.id.localeCompare(right.id));
    emitFile(directory, "annotation-report.json", canonicalJson({ issues: annotationIssues }), "configuration", files);
    const defaultConfiguration = canonicalJson({
        $schema: "./node_modules/@uttori/asm-plugin-loader-node/asm-config.schema.json",
        plugins: [
            {
                module: "@uttori/asm-plugin-snes",
                options: { checksumEnabled: false, checksumMode: "asar" },
            },
        ],
        target: "snes.sfc",
        architecture: "snes.65816",
        entryPoints: ["main.asm"],
        includePaths: ["./"],
        buildOutput: "build/rebuilt-content.sfc",
    });
    const configurationPath = path.join(directory, "uttori-asm.config.json");
    // An existing source project may register asset formats and custom compressors.
    // Rewriting its build configuration would leave regenerated includes unassemblable.
    const configuration = fs.existsSync(configurationPath)
        ? fs.readFileSync(configurationPath)
        : Buffer.from(defaultConfiguration);
    const manifest = {
        format: SOURCE_EXPORT_FORMAT,
        schemaVersion: SOURCE_EXPORT_SCHEMA_VERSION,
        target: project.manifest.target,
        architecture: "snes.65816",
        mapper,
        sourceProjectSha256: options.sourceProjectSha256,
        rom: rom.identity,
        entrySource: "main.asm",
        buildConfiguration: "uttori-asm.config.json",
        contentOutput: "build/rebuilt-content.sfc",
        finalOutput: "build/rebuilt.sfc",
        checksumPolicy: "preserve",
        inputs: [
            {
                path: "uttori-asm.config.json",
                kind: "configuration",
                size: configuration.length,
                sha256: sourceExportSha256(configuration),
            },
            ...(assetIncludes
                ? [
                    {
                        path: "asset-includes.json",
                        kind: "metadata",
                        size: assetIncludes.sourceBytes.length,
                        records: assetIncludes.entries.length,
                        sha256: sourceExportSha256(assetIncludes.sourceBytes),
                    },
                ]
                : []),
            ...(structMap
                ? [
                    {
                        path: SNES_STRUCT_MAP_SOURCE,
                        kind: "metadata",
                        size: structMap.sourceBytes.length,
                        records: structMap.structures.length +
                            structMap.bindings.length +
                            (structMap.instructionUses?.length ?? 0),
                        sha256: sourceExportSha256(structMap.sourceBytes),
                    },
                ]
                : []),
            {
                path: SNES_RAM_MAP_SOURCE,
                kind: "metadata",
                size: ramMap.sourceBytes.length,
                records: ramMap.variables.length,
                sha256: sourceExportSha256(ramMap.sourceBytes),
            },
        ],
        files: files.toSorted((left, right) => left.path.localeCompare(right.path)),
        spans: spans.toSorted((left, right) => left.start - right.start || left.id.localeCompare(right.id)),
    };
    return manifest;
};
//# sourceMappingURL=source-export.js.map