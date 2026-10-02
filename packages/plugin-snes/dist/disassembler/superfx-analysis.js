import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import { analyzeStaticControlFlow, } from "@uttori/asm-disassembler";
import { SuperFxDecoder } from "../architectures/superfx-decoder.js";
import { coverageRecord, effectiveAddressRecords, incompleteReasonRecords, superFxStateRecord, } from "./analysis-record-values.js";
import { SUPERFX_ROM_ADDRESS_SPACE } from "./superfx-address-space.js";
import { enterSuperFxAddress, initialSuperFxState, joinSuperFxStates, superFxDecodeState, superFxStateKey, transferSuperFxState, } from "./superfx-state.js";
const DATA_CLASSIFICATIONS = new Set([
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
const contains = (entry, address) => entry.start <= address && address < entry.end;
/**
 * Applies a SuperFX entry point state override to the initial state.
 * @param {SuperFxAbstractState} state Initial state.
 * @param {SuperFxEntryPoint["state"]} override Entry point state override.
 * @returns {SuperFxAbstractState} State with the override applied.
 */
const applyEntryState = (state, override) => {
    if (!override) {
        return state;
    }
    return {
        ...state,
        ...(override.alt === undefined ? {} : { alt: { kind: "known", value: override.alt } }),
        ...(override.destinationRegister === undefined
            ? {}
            : { destinationRegister: { kind: "known", value: override.destinationRegister } }),
        ...(override.sourceRegister === undefined
            ? {}
            : { sourceRegister: { kind: "known", value: override.sourceRegister } }),
    };
};
/**
 * Converts a decoded instruction into a set of control targets.
 * @param {DecodedInstruction} instruction Decoded instruction.
 * @returns {readonly StaticControlTarget[]} Control targets.
 */
const controlsFor = (instruction) => instruction.references
    .filter((entry) => entry.kind === "branch" || entry.kind === "call" || entry.kind === "jump")
    .map((entry) => Object.assign({}, { kind: entry.kind }, entry.address === undefined ? {} : { address: entry.address }, Object.assign({}, entry.indirect ? { indirect: true } : {}, entry.address === undefined && entry.indirect
    ? { explanation: "The SuperFX register target is not known statically." }
    : {})));
/**
 * Converts a decoded instruction into a set of effective addresses.
 * @param {DecodedInstruction} instruction Decoded instruction.
 * @returns {readonly StaticEffectiveAddress[]} Effective addresses.
 */
const effectiveAddressesFor = (instruction) => instruction.references
    .filter((entry) => entry.kind === "data" || entry.kind === "pointer")
    .map((entry) => Object.assign({}, { operandIndex: entry.operandIndex ?? 0 }, entry.address === undefined ? {} : { address: entry.address }, {
    volatile: false,
    explanation: entry.address === undefined
        ? "The register-indirect SuperFX RAM address is unresolved."
        : "The encoded operand identifies SuperFX RAM, not cartridge ROM.",
}));
/**
 * Converts a static analysis result into a set of analysis records.
 * @param {StaticAnalysisResult<SuperFxAbstractState>} result Static analysis result.
 * @param {string} runEvidence Evidence string.
 * @returns {readonly AnalysisRecord[]} Analysis records.
 */
const recordsFor = (result, runEvidence) => [
    ...result.nodes.map((node) => ({
        id: `static:superfx:${node.id}`,
        kind: "cfg-node",
        addressSpace: SUPERFX_ROM_ADDRESS_SPACE,
        address: node.address,
        fileOffset: node.fileOffset,
        size: node.size,
        opcode: node.opcode,
        specificationId: node.specificationId,
        mnemonic: node.mnemonic,
        mode: node.mode,
        context: node.context,
        incomingState: superFxStateRecord(node.incomingState),
        outgoingState: superFxStateRecord(node.outgoingState),
        effectiveAddresses: effectiveAddressRecords(node.effectiveAddresses),
        entryPoint: node.entryPoint,
        evidencePath: node.evidencePath.map((id) => `static:superfx:${id}`),
        evidence: [...new Set([...node.evidence, runEvidence])].toSorted(),
    })),
    ...result.edges.map((edge) => ({
        id: `static:superfx:${edge.id}`,
        kind: "cfg-edge",
        addressSpace: SUPERFX_ROM_ADDRESS_SPACE,
        from: `static:superfx:${edge.from}`,
        fromAddress: edge.fromAddress,
        ...(edge.to ? { to: `static:superfx:${edge.to}` } : {}),
        ...(edge.toAddress === undefined ? {} : { toAddress: edge.toAddress }),
        edgeKind: edge.kind,
        indirect: edge.indirect,
        ...(edge.override ? { override: edge.override } : {}),
        ...(edge.explanation ? { explanation: edge.explanation } : {}),
        evidence: [...new Set([...edge.evidence, runEvidence])].toSorted(),
    })),
    ...result.functions.map((entry) => ({
        id: `static:superfx:${entry.id}`,
        kind: "function",
        addressSpace: SUPERFX_ROM_ADDRESS_SPACE,
        address: entry.address,
        source: entry.source,
        evidencePath: entry.evidencePath.map((id) => `static:superfx:${id}`),
        evidence: [...new Set([...entry.evidence, runEvidence])].toSorted(),
    })),
    ...result.conflicts.map((entry) => ({
        id: `static:superfx:${entry.id}`,
        kind: "conflict",
        addressSpace: SUPERFX_ROM_ADDRESS_SPACE,
        address: entry.address,
        conflictKind: entry.kind,
        message: entry.message,
        nodes: entry.nodes.map((id) => `static:superfx:${id}`),
        evidence: [...new Set([...entry.evidence, runEvidence])].toSorted(),
    })),
    ...result.unresolved.map((entry) => ({
        id: `static:superfx:${entry.id}`,
        kind: "unresolved",
        addressSpace: SUPERFX_ROM_ADDRESS_SPACE,
        address: entry.address,
        flowKind: entry.kind,
        indirect: entry.indirect,
        reason: entry.reason,
        evidence: [...new Set([...entry.evidence, runEvidence])].toSorted(),
    })),
    {
        id: "static:superfx:summary",
        kind: "summary",
        architecture: "snes.superfx",
        status: result.status,
        coverage: coverageRecord(result.coverage),
        processedWorkItems: result.processedWorkItems,
        incompleteReasons: incompleteReasonRecords(result.incompleteReasons),
        evidence: [runEvidence],
    },
];
/**
 * Converts a static analysis result into a set of interval annotations.
 * @param {StaticAnalysisResult<SuperFxAbstractState>} result Static analysis result.
 * @param {string} evidence Evidence string.
 * @returns {readonly IntervalAnnotation[]} Interval annotations.
 */
const annotationsFor = (result, evidence) => result.nodes.flatMap((node) => {
    const address = node.address.toString(16).padStart(6, "0");
    const records = [
        {
            id: `static:superfx:opcode:${address}`,
            addressSpace: SUPERFX_ROM_ADDRESS_SPACE,
            start: node.address,
            end: node.address + 1,
            classification: "opcode",
            architecture: "snes.superfx",
            evidence: [...new Set([...node.evidence, evidence])].toSorted(),
        },
    ];
    if (node.size > 1) {
        records.push({
            id: `static:superfx:operand:${address}`,
            addressSpace: SUPERFX_ROM_ADDRESS_SPACE,
            start: node.address + 1,
            end: node.address + node.size,
            classification: "operand",
            architecture: "snes.superfx",
            evidence: [...new Set([...node.evidence, evidence])].toSorted(),
        });
    }
    return records;
});
/**
 * Runs conservative control-flow analysis over one contiguous SuperFX program image.
 * @param {SuperFxRomImage} image Immutable GSU ROM image to analyze.
 * @param {SuperFxAnalysisOptions} options Entry points, annotations, and overrides.
 * @returns {SuperFxAnalysisResult} CFG, evidence, conflicts, and project records.
 */
export const analyzeSuperFxRom = (image, options = {}) => {
    const decoder = new SuperFxDecoder();
    const source = new Uint8ArrayDecoderSource(image.bytes());
    const annotations = (options.annotations ?? []).filter((entry) => !entry.id.startsWith("static:superfx:"));
    const runEvidence = `static:superfx:${image.contentSha256}:${image.loadAddress.toString(16)}`;
    const evidenceRecords = [
        {
            id: runEvidence,
            source: "static",
            sourceId: "snes.superfx.static-v1",
            confidence: "high",
            detail: `Conservative SuperFX analysis at $${image.loadAddress.toString(16).padStart(6, "0")} of ${image.contentSha256}`,
        },
    ];
    const seeds = [
        ...(options.labels ?? [])
            .filter((entry) => entry.addressSpace === SUPERFX_ROM_ADDRESS_SPACE)
            .map((entry) => ({
            id: `label:${entry.id}`,
            address: entry.address,
            kind: "imported-label",
            state: initialSuperFxState(entry.address >>> 16),
            evidence: entry.evidence,
            detail: entry.name,
        })),
        ...annotations
            .filter((entry) => entry.addressSpace === SUPERFX_ROM_ADDRESS_SPACE && entry.points?.includes("in"))
            .map((entry) => ({
            id: `point:${entry.id}`,
            address: entry.start,
            kind: "manual",
            state: initialSuperFxState(entry.start >>> 16),
            evidence: entry.evidence,
        })),
        ...(options.entryPoints ?? []).map((entry) => {
            const evidenceId = entry.evidence?.[0] ?? `manual:entry:${entry.id}`;
            if (!(options.evidence ?? []).some((value) => value.id === evidenceId)) {
                evidenceRecords.push({
                    id: evidenceId,
                    source: "manual",
                    sourceId: entry.id,
                    confidence: "certain",
                    detail: `Configured SuperFX entry point $${entry.address.toString(16).padStart(6, "0")}.`,
                });
            }
            return {
                id: `entry:${entry.id}`,
                address: entry.address,
                kind: "configured",
                state: applyEntryState(initialSuperFxState(entry.address >>> 16), entry.state),
                evidence: entry.evidence ?? [evidenceId],
            };
        }),
        ...(options.targetSets ?? [])
            .filter((entry) => entry.addressSpace === SUPERFX_ROM_ADDRESS_SPACE)
            .flatMap((entry) => entry.targets.map((address) => ({
            id: `target-set:${entry.id}:${address.toString(16)}`,
            address,
            kind: "target-set",
            state: initialSuperFxState(address >>> 16),
            evidence: entry.evidence,
        }))),
    ];
    const targetOverrides = (options.targetOverrides ?? [])
        .filter((entry) => entry.addressSpace === SUPERFX_ROM_ADDRESS_SPACE)
        .map((entry) => ({
        id: entry.id,
        address: entry.address,
        targets: [...entry.targets].toSorted((a, b) => a - b),
        evidence: entry.evidence,
    }));
    const result = analyzeStaticControlFlow({
        backingSize: image.length,
        enterAddress: enterSuperFxAddress,
        join: joinSuperFxStates,
        stateKey: superFxStateKey,
        transfer: transferSuperFxState,
        decode: (address, state) => {
            const identity = image.identifyAddress(address);
            if (!identity) {
                return { kind: "error", reason: "Address is outside the SuperFX image." };
            }
            const blocked = annotations.find((entry) => contains(entry, address) && DATA_CLASSIFICATIONS.has(entry.classification));
            if (blocked) {
                return {
                    kind: "blocked",
                    reason: `Analysis reached '${blocked.classification}' region '${blocked.id}'.`,
                    evidence: blocked.evidence,
                };
            }
            const decoded = decoder.decode({
                source,
                offset: identity.imageOffset,
                logicalAddress: address,
                state: superFxDecodeState(state),
            });
            if (decoded.kind === "ambiguous") {
                return {
                    kind: "ambiguous",
                    reason: decoded.reason,
                    requiredState: decoded.requiredState,
                };
            }
            if (decoded.kind === "error") {
                return { kind: "error", reason: decoded.message };
            }
            const instruction = decoded.instruction;
            const crossing = annotations.find((entry) => DATA_CLASSIFICATIONS.has(entry.classification) &&
                Array.from({ length: instruction.size }, (_, index) => address + index).some((value) => contains(entry, value)));
            if (crossing) {
                return {
                    kind: "blocked",
                    reason: `Instruction crosses '${crossing.classification}' region '${crossing.id}'.`,
                    evidence: crossing.evidence,
                };
            }
            const normalized = {
                specificationId: instruction.specificationId,
                address,
                fileOffset: identity.imageOffset,
                size: instruction.size,
                opcode: instruction.opcode,
                mnemonic: instruction.mnemonic,
                mode: instruction.mode,
                effects: instruction.effects,
                flow: instruction.flow,
                targets: controlsFor(instruction),
                effectiveAddresses: effectiveAddressesFor(instruction),
            };
            return { kind: "instruction", instruction: normalized };
        },
    }, seeds, {
        ...(options.maxWorkItems === undefined ? {} : { maxWorkItems: options.maxWorkItems }),
        ...(options.maxCallDepth === undefined ? {} : { maxCallDepth: options.maxCallDepth }),
        targetOverrides,
    });
    return {
        ...result,
        records: recordsFor(result, runEvidence),
        annotations: annotationsFor(result, runEvidence),
        evidenceRecords: [...(options.evidence ?? []), ...evidenceRecords].toSorted((a, b) => a.id.localeCompare(b.id)),
    };
};
//# sourceMappingURL=superfx-analysis.js.map