import { createHash } from "node:crypto";
import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import { canonicalJson, } from "@uttori/asm-disassembler";
import { Cpu65816Decoder } from "../architectures/65816-decoder.js";
import { snesRomAddressSpace } from "../target/address-space.js";
import { createSnesAddressContext } from "./address-identities.js";
import { identifySnesHardwareRegister } from "./hardware-registers.js";
/**
 * Extract only state used by the decoder; aliases, unknowns and emulation widths match analysis.
 * @param {RuntimeInstructionRecord} sample Execution-time instruction and paired registers.
 * @returns {Cpu65816DecodeState} Width and bank state actually consumed by decoding.
 */
const runtimeDecodeState = (sample) => {
    const value = (key, max) => {
        const entry = sample.state[key] ?? sample.state[key.toUpperCase()];
        return typeof entry === "number" && Number.isInteger(entry) && entry >= 0 && entry <= max
            ? entry
            : undefined;
    };
    const p = value("p", 255);
    const e = value("e", 1);
    let widths = {};
    if (p !== undefined)
        widths = { m: ((p >> 5) & 1), x: ((p >> 4) & 1) };
    if (e === 1)
        widths = { m: 1, x: 1 };
    return {
        ...(e === undefined ? {} : { e }),
        ...widths,
        programBank: sample.address >>> 16,
        ...(value("db", 255) === undefined ? {} : { dataBank: value("db", 255) }),
        ...(value("d", 65535) === undefined ? {} : { directPage: value("d", 65535) }),
    };
};
/**
 * Decode captured code from any CPU bus location, including WRAM and cartridge RAM.
 * @param {AnalysisProjectShards} shards Captured instructions and evidence.
 * @param {RomImage} rom Verified cartridge image.
 * @param {SnesMapper} mapper Address mapper for checking ROM provenance.
 * @param {Iterable<RuntimeEvidenceRecord>} [runtime] SQL instruction-variant cursor, consumed within its read snapshot.
 * @returns {readonly AnalysisRecord[]} Captured CFG variants and explicit conflicts.
 */
export const analyzeSnesRuntimeCode = (shards, rom, mapper, runtime = shards.runtime) => {
    const decoder = new Cpu65816Decoder();
    const context = createSnesAddressContext(mapper);
    const romBytes = rom.bytes();
    const nodes = new Map();
    const instructions = new Map();
    const records = [];
    for (const sample of runtime) {
        if (sample.kind !== "runtime-instruction" ||
            sample.architecture !== "snes.65816" ||
            sample.addressSpace !== "snes.cpu")
            continue;
        const state = runtimeDecodeState(sample);
        const variant = createHash("sha256")
            .update(canonicalJson({ address: sample.address, bytes: sample.bytes, state }))
            .digest("hex")
            .slice(0, 24);
        const id = `runtime:code:${variant}`;
        const duplicate = nodes.get(id);
        if (duplicate) {
            nodes.set(id, {
                ...duplicate,
                evidence: [...new Set([...duplicate.evidence, ...sample.evidence])].sort(),
            });
            continue;
        }
        const decoded = decoder.decode({
            source: new Uint8ArrayDecoderSource(Uint8Array.from(sample.bytes)),
            offset: 0,
            logicalAddress: sample.address,
            state,
        });
        if (decoded.kind !== "instruction" || decoded.instruction.size !== sample.bytes.length) {
            if (!records.some((record) => record.id === `${id}:unresolved`))
                records.push({
                    id: `${id}:unresolved`,
                    kind: "unresolved",
                    addressSpace: "snes.cpu",
                    address: sample.address,
                    flowKind: "decode",
                    indirect: false,
                    reason: "Captured bytes/state do not establish one complete 65816 instruction.",
                    evidence: sample.evidence,
                });
            continue;
        }
        const instruction = decoded.instruction;
        const fileOffset = snesRomAddressSpace.toOutputOffset(sample.address, context);
        const matchesRom = fileOffset >= 0 &&
            fileOffset + sample.bytes.length <= rom.length &&
            sample.bytes.every((byte, index) => romBytes[fileOffset + index] === byte);
        // Preserve bank/width conventions shared by the static CFG consumers.
        const known = (entry) => entry === undefined || entry === "unknown"
            ? { kind: "unknown" }
            : { kind: "known", value: Number(entry) };
        const incomingState = {
            e: known(state.e),
            m: known(state.m),
            x: known(state.x),
            dbr: known(state.dataBank),
            d: known(state.directPage),
            pbr: known(state.programBank),
        };
        const prior = nodes.get(id);
        nodes.set(id, {
            id,
            kind: "cfg-node",
            addressSpace: "snes.cpu",
            address: sample.address,
            ...(matchesRom ? { fileOffset } : {}),
            bytes: sample.bytes,
            size: instruction.size,
            opcode: instruction.opcode,
            specificationId: instruction.specificationId,
            mnemonic: instruction.mnemonic,
            mode: instruction.mode,
            context: [],
            incomingState,
            outgoingState: {},
            entryPoint: `captured:${sample.evidence[0]}`,
            evidencePath: [id],
            evidence: [...new Set([...(prior?.evidence ?? []), ...sample.evidence])].sort(),
            effectiveAddresses: instruction.references
                .filter((ref) => ref.kind === "data" || ref.kind === "pointer")
                .map((ref) => {
                const indexed = instruction.mode.includes("Indexed") ||
                    instruction.mode.includes("Indirect") ||
                    instruction.mode.startsWith("stackRelative");
                const hardware = ref.address === undefined ? undefined : identifySnesHardwareRegister(ref.address);
                let resolved = {};
                if (ref.address !== undefined)
                    resolved = indexed ? { baseAddress: ref.address } : { address: ref.address };
                return {
                    operandIndex: ref.operandIndex ?? 0,
                    ...resolved,
                    volatile: !!hardware,
                    ...(hardware ? { symbol: hardware.symbol } : {}),
                    explanation: indexed
                        ? "Captured instruction has an unresolved indexed/indirect operand; consult observed bus accesses."
                        : "Decoded from execution-time bytes and processor state.",
                };
            }),
        });
        instructions.set(id, instruction);
    }
    const byAddress = new Map();
    for (const node of nodes.values()) {
        const entries = byAddress.get(node.address) ?? [];
        entries.push(node);
        byAddress.set(node.address, entries);
    }
    const edges = [];
    const entries = new Set();
    for (const node of nodes.values()) {
        const instruction = instructions.get(node.id);
        const targets = instruction.references
            .filter((ref) => ["call", "branch", "jump"].includes(ref.kind))
            .map((ref) => ({ address: ref.address, kind: ref.kind, indirect: ref.indirect }));
        if (instruction.flow.fallthrough)
            targets.push({
                address: (node.address & 0xff0000) | ((node.address + node.size) & 65535),
                kind: "fallthrough",
                indirect: false,
            });
        for (const [index, target] of targets.entries()) {
            const candidates = target.address === undefined ? [] : (byAddress.get(target.address) ?? []);
            const destination = candidates.length === 1 ? candidates[0] : undefined;
            if (target.kind === "call" && destination)
                entries.add(destination.id);
            edges.push({
                id: `${node.id}:edge:${index}`,
                kind: "cfg-edge",
                addressSpace: "snes.cpu",
                from: node.id,
                fromAddress: node.address,
                ...(destination ? { to: destination.id } : {}),
                ...(target.address === undefined ? {} : { toAddress: target.address }),
                edgeKind: target.kind,
                indirect: target.indirect ?? false,
                explanation: "Possible edge decoded from captured bytes; does not assert that this branch was taken.",
                evidence: node.evidence,
            });
        }
    }
    // Only proven call targets establish function candidates. Interior observations remain blocks.
    const outgoing = new Map();
    for (const edge of edges) {
        const list = outgoing.get(edge.from) ?? [];
        list.push(edge);
        outgoing.set(edge.from, list);
    }
    const ownership = new Map();
    for (const entry of entries) {
        const queue = [[entry]];
        const visited = new Set();
        for (let index = 0; index < queue.length; index++) {
            const trail = queue[index];
            const id = trail.at(-1);
            if (visited.has(id))
                continue;
            visited.add(id);
            const previous = ownership.get(id);
            ownership.set(id, previous && previous[0] !== entry ? [] : (previous ?? trail));
            for (const edge of outgoing.get(id) ?? [])
                if (edge.to &&
                    edge.edgeKind !== "call" &&
                    (!entries.has(edge.to) || edge.to === entry) &&
                    !visited.has(edge.to))
                    queue.push([...trail, edge.to]);
        }
        const node = nodes.get(entry);
        records.push({
            id: `${entry}:function`,
            kind: "function",
            addressSpace: "snes.cpu",
            address: node.address,
            source: "runtime-call-target",
            evidencePath: [entry],
            evidence: node.evidence,
        });
    }
    for (const node of nodes.values())
        records.push({
            ...node,
            evidencePath: ownership.get(node.id)?.length ? ownership.get(node.id) : [node.id],
        });
    // Large captures exceed V8's function-argument limit even when the arrays fit in memory.
    // Append individually to retain every edge without spreading the graph onto the call stack.
    for (const edge of edges)
        records.push(edge);
    for (const [address, variants] of byAddress) {
        // CPU state can legitimately differ between executions of the same instruction. Preserve
        // every state/evidence variant, but only incompatible instruction encodings are code conflicts.
        // For example, changing X width does not change an accumulator-immediate LDA instruction.
        const encodings = new Set(variants.map((node) => `${node.specificationId}:${node.size}:${node.bytes?.join(",")}`));
        if (encodings.size > 1)
            records.push({
                id: `runtime:code:variants:${address.toString(16)}`,
                kind: "conflict",
                addressSpace: "snes.cpu",
                address,
                conflictKind: "runtime-code-variants",
                message: "Captured executions disagree on instruction bytes or decoding; all variants and their trace evidence are retained.",
                nodes: variants.map((node) => node.id),
                evidence: [...new Set(variants.flatMap((node) => node.evidence))].sort(),
            });
    }
    return records.sort((a, b) => a.id.localeCompare(b.id));
};
//# sourceMappingURL=runtime-code.js.map