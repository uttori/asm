import path from "node:path";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { openAnalysisProjectStore, } from "@uttori/asm-disassembler";
import { sourceContentHash } from "@uttori/asm-disassembler/source-project";
/** Aggregate verified PPU port accesses without timing/register snapshots multiplying every fact.
 * Full ordered events, including fetch/A12/IRQ timelines, remain in the hashed ACT2 archive.
 */
export function createNesGraphicsProjection() {
    const facts = new Map();
    return {
        push(event) {
            if (event.address < 0x2000 || event.address >= 0x4000) {
                return;
            }
            const fact = {
                addressSpace: "nes.cpu",
                address: event.address,
                pc: event.pc,
                actor: event.actor,
                context: event.context,
                direction: event.direction,
                value: event.value,
                cpuMapping: event.pcPrgOffset === null
                    ? null
                    : { offsetStateField: "prg0", physicalOffset: event.pcPrgOffset },
                effect: event.effect,
            };
            const key = sourceContentHash(canonicalJson(fact));
            const previous = facts.get(key);
            if (previous) {
                previous.count++;
            }
            else {
                if (facts.size >= 262144) {
                    throw new Error("NES graphics fact budget exceeded.");
                }
                facts.set(key, { fact, count: 1 });
            }
        },
        finish(sha256) {
            const evidence = [`runtime:graphics:${sha256}`];
            return [...facts].map(([key, entry]) => ({
                ...entry.fact,
                count: entry.count,
                kind: "runtime-graphics-access",
                architecture: "65xx.2a03",
                id: `${evidence[0]}:${key}`,
                evidence,
            }));
        },
    };
}
/** Publish complete graphics provenance and facts atomically beneath the selected Git research overlay. */
export function publishNesGraphicsEvidence(options) {
    const store = openAnalysisProjectStore(options.directory);
    try {
        const unchanged = new Error("unchanged graphics projection");
        let noChange;
        let result;
        try {
            result = store.transaction(() => {
                options.signal?.throwIfAborted();
                options.assertResearchCurrent?.();
                if (store.researchInputsIdentity() !== options.research?.hash) {
                    throw new Error("Refresh selected research before importing graphics evidence.");
                }
                const manifest = store.manifest();
                const { summary } = options;
                if (manifest.target !== "65xx.nes" ||
                    manifest.rom.sha256 !== summary.header.romFileSha256 ||
                    manifest.rom.contentSha256 !== summary.header.romContentSha256) {
                    throw new Error("Graphics capture/project cartridge identity mismatch.");
                }
                const sha256 = summary.archiveSha256;
                const previous = store.loadTable("imports").find((item) => item.sourceSha256 === sha256);
                const report = {
                    id: `import:nes-graphics:${sha256}`,
                    format: "uttori-nes-ppu-evidence",
                    sourceVersion: "1",
                    sourceName: previous?.sourceName ?? path.basename(options.file),
                    sourceSha256: sha256,
                    indexProfile: "nes-graphics-v1",
                    imported: {
                        graphicsEvents: summary.events,
                        graphicsFacts: options.records.length,
                        ppuFetches: summary.timeline.fetches,
                        a12Edges: summary.timeline.a12Edges,
                        mapperWrites: summary.timeline.mapperWrites,
                        irqEdges: summary.timeline.irqEdges,
                    },
                    unsupported: [],
                    warnings: [],
                };
                // Projections are additive evidence. Suspending the overlay prevents manual declarations from
                // being captured as imported observations; both layers return in this same transaction.
                if (options.research) {
                    store.suspendResearchInputs();
                }
                const merged = store.mergeEvidenceBatch({
                    runtime: options.records,
                    imports: [report],
                    evidence: [
                        {
                            id: `runtime:graphics:${sha256}`,
                            source: "runtime",
                            sourceId: "nes.graphics-v1",
                            confidence: "certain",
                            detail: "Verified NES graphics ports and storage effects; physical-code joins are independent of event chronology.",
                            artifact: {
                                format: "uttori-nes-ppu-evidence",
                                formatVersion: "1",
                                sha256,
                                romContentSha256: manifest.rom.contentSha256,
                            },
                        },
                    ],
                });
                // Roll back the temporary overlay suspension on an exact retry. Readiness and revision stay intact.
                if (!merged.changed) {
                    noChange = merged;
                    throw unchanged;
                }
                store.publishManifest(manifest);
                if (options.research) {
                    store.synchronizeResearchInputs(options.research);
                }
                store.recordCaptureReceipt(report);
                options.signal?.throwIfAborted();
                return merged;
            });
        }
        catch (error) {
            if (error !== unchanged || !noChange) {
                throw error;
            }
            result = noChange;
        }
        if (result.changed) {
            store.writePointer(options.directory);
        }
        return result;
    }
    finally {
        store.close();
    }
}
//# sourceMappingURL=ppu-evidence.js.map