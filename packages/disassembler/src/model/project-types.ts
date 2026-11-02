import type { ResearchMapping } from "./research-mapping.js";
import type { RomIdentity } from "./rom-image.js";
import type { RuntimeBusFact } from "./runtime-bus-types.js";
import type { RuntimeGraphicsFact } from "./runtime-graphics-fact.js";

/** Manifest `format` field for a native analysis project. */
export const ANALYSIS_PROJECT_FORMAT = "uttori-asm-analysis";
/** Current analysis-project schema. Only the current SQLite container is supported. */
export const ANALYSIS_PROJECT_SCHEMA_VERSION = 3;
/** Watcher pointer filename. The authoritative manifest lives in SQLite. */
export const ANALYSIS_PROJECT_MANIFEST = "analysis.json";

/** Named byte-address space. Equal numeric addresses in different spaces are unrelated. */
export interface AddressSpaceDescriptor {
  /** Stable identifier referenced by shard records. */
  readonly id: string;
  /** Human-readable label shown in tooling. */
  readonly name: string;
  /** Integer width from 1 through 53. Addresses are nonnegative safe integers below 2 ** addressBits. */
  readonly addressBits: number;
  /** `file` is headerless ROM offsets. `cpu` is the target bus. `memory` is RAM/SRAM. */
  readonly kind: "file" | "cpu" | "memory";
}

/** One scoring signal from mapper/header detection. */
export interface DetectionEvidence {
  /** Detector-specific category for this signal. */
  readonly kind: string;
  /** Signed contribution toward the candidate score. */
  readonly score: number;
  /** Human-readable justification retained for diagnostics. */
  readonly detail: string;
}

/** One scored internal-header candidate produced during ROM ingestion. */
export interface MappingCandidate {
  /** Mapper id proposed for this header placement. */
  readonly mapper: string;
  /** Byte offset in headerless ROM content of the 64-byte cartridge header, when applicable. */
  readonly headerOffset: number;
  /** Aggregate score after combining all evidence signals. */
  readonly score: number;
  /** Individual scoring signals that produced this candidate. */
  readonly evidence: readonly DetectionEvidence[];
}

/** Selected cartridge mapping stored on the project. */
export interface ProjectMapping {
  /** Mapper id used for address translation and exports. */
  readonly mapper: string;
  /** Cartridge speed when known (`slow` / `fast` on SNES). */
  readonly speed?: string;
  /** Byte offset in headerless ROM content, excluding any copier header. */
  readonly headerOffset?: number;
  /** How the mapper was chosen. `import` is `.dizraw` and similar. */
  readonly source: "detected" | "override" | "import";
  /** Ranked alternatives retained from detection for audit and override UI. */
  readonly candidates: readonly MappingCandidate[];
}

/** Semantic record collection names, also used for SQLite tables. */
export type ShardKind =
  | "analysis"
  | "annotations"
  | "labels"
  | "comments"
  | "regions"
  | "runtime"
  | "evidence"
  | "imports";

/** Authoritative SQLite manifest, mirrored in `analysis.json` for watchers. Contains no ROM bytes. */
export interface AnalysisProjectManifest {
  /** Must equal `uttori-asm-analysis` for native projects. */
  readonly format: typeof ANALYSIS_PROJECT_FORMAT;
  /** Schema version gating readers and migrations. */
  readonly schemaVersion: typeof ANALYSIS_PROJECT_SCHEMA_VERSION;
  /** Target plugin id owning decode and export behavior. */
  readonly target: string;
  /** Immutable ROM identity bound to this project. */
  readonly rom: RomIdentity;
  /** Selected cartridge mapping and detection audit trail. */
  readonly mapping: ProjectMapping;
  /** Declared address spaces available to shard records. */
  readonly addressSpaces: readonly AddressSpaceDescriptor[];
  /**
   * Project-relative filename, fixed to `analysis.sqlite` on publication.
   */
  readonly db?: string;
  /** Monotonic SQLite publication counter, supplied by the store. */
  readonly revision?: number;
}

/**
 * Justification for a fact in the project.
 * `confidence` ranks how strongly later analysis should trust this record.
 */
export interface EvidenceRecord {
  /** Stable evidence identifier referenced by shard records. */
  readonly id: string;
  /** Provenance channel that produced this justification. */
  readonly source: "manual" | "import" | "detector" | "static" | "runtime";
  /** Detector, importer, or plugin id that created this record. */
  readonly sourceId: string;
  /** Trust rank used when merging or presenting conflicting facts. */
  readonly confidence: "certain" | "high" | "medium" | "low" | "unknown";
  /** Optional free-form note explaining the justification. */
  readonly detail?: string;
  /** Immutable identity of an imported evidence artifact and the ROM context it describes. */
  readonly artifact?: {
    readonly format: string;
    readonly formatVersion?: string;
    readonly sha256: string;
    readonly romContentSha256: string;
    readonly mapper?: string;
  };
}

/**
 * Half-open classified interval. Data classifications block static decode.
 * `opcode` / `operand` intervals are typically regenerated by analysis.
 */
export interface IntervalAnnotation {
  /** Optional original-image bank qualifier; targets inherit the selected mapping. */
  readonly mapping?: ResearchMapping;
  /** Stable annotation identifier referenced by evidence. */
  readonly id: string;
  /** Address space containing the half-open range. */
  readonly addressSpace: string;
  /** Inclusive start address of the classified interval. */
  readonly start: number;
  /** Exclusive end. */
  readonly end: number;
  /** Semantic classification governing decode, export, and analysis behavior. */
  readonly classification:
    | "unreached"
    | "opcode"
    | "operand"
    | "data8"
    | "data16"
    | "data24"
    | "data32"
    | "pointer16"
    | "pointer24"
    | "pointer32"
    | "graphics"
    | "music"
    | "compressed"
    | "asset"
    | "empty"
    | "text";
  /** Target architecture id interpreting register state on this interval. */
  readonly architecture: string;
  /** Compact register assumptions interpreted by readAnalysisTargetState using architecture as codec identity. */
  readonly state?: Readonly<Record<string, boolean | number>>;
  /**
   * Control-flow hints imported from tools such as DiztinGUIsh.
   * `in` seeds analysis at `start`.
   */
  readonly points?: readonly ("in" | "out" | "end" | "read")[];
  /** Version-pinned semantic codec supplied by core, a target, or a game plugin. */
  readonly asset?: ProjectAssetCodecAnnotation;
  /** Evidence identifiers justifying this interval classification. */
  readonly evidence: readonly string[];
}

/** Stable plugin provenance for a codec implementation used by this project. */
export interface ProjectCodecProvider {
  /** Plugin id supplying the codec implementation. */
  readonly pluginId: string;
  /** Plugin version pinned when the declaration was stored. */
  readonly pluginVersion: string;
}

/** JSON-safe declaration options retained verbatim in the project database. */
export type ProjectCodecValue =
  | null
  | string
  | number
  | boolean
  | readonly ProjectCodecValue[]
  | { readonly [key: string]: ProjectCodecValue };

/** Versioned codec reference stored without extracted or ROM byte payloads. */
export interface ProjectCodecReference {
  /** Codec id resolved by the plugin registry. */
  readonly codecId: string;
  /** Codec version pinned for reproducible decode. */
  readonly codecVersion: string;
  /** Optional plugin provenance when a third-party codec supplied the reference. */
  readonly provider?: ProjectCodecProvider;
  /** JSON-safe options passed verbatim to the codec at decode time. */
  readonly options?: ProjectCodecValue;
}

/** Optional recompression layer associated with a semantic asset annotation. */
export interface ProjectCompressionReference extends ProjectCodecReference {
  /** Maximum encoded bytes in the owning annotation range. */
  readonly maximumSize?: number;
  /** Optional half-open logical bank bounds. Both must be present together. */
  readonly bankStart?: number;
  /** Exclusive upper bank bound paired with bankStart. */
  readonly bankEnd?: number;
  /** Optional byte used to fill unused bytes after a shorter recompression. */
  readonly fillByte?: number;
}

/** Persistent, merge-friendly declaration of an asset and optional compressor. */
export interface ProjectAssetCodecAnnotation extends ProjectCodecReference {
  /** Optional nested compressor applied before semantic asset decode. */
  readonly compression?: ProjectCompressionReference;
}

/** Named label at a single address. */
export interface ProjectLabel {
  /** Optional original-image bank qualifier; targets inherit the selected mapping. */
  readonly mapping?: ResearchMapping;
  /** Stable label identifier referenced by evidence. */
  readonly id: string;
  /** Address space containing the labeled location. */
  readonly addressSpace: string;
  /** Labeled byte address within the space. */
  readonly address: number;
  /** Primary display and assembly name unless sourceName overrides export. */
  readonly name: string;
  /** Optional multi-line comment stored with the label. */
  readonly comment?: string;
  /** Explicit global assembly name. Legacy names keep their export sanitization. */
  readonly sourceName?: string;
  /** Previous assembly spellings for this stable identity; used to diagnose or repair stale references. */
  readonly aliases?: readonly string[];
  /** Single-line comment emitted beside the label definition. */
  readonly inlineComment?: string;
  /** False for presentation-only labels, which must not seed new code analysis. */
  readonly analysisEntryPoint?: boolean;
  /** Hide this name and automatic function-name fallback, retaining comments and analysis seeds. */
  readonly suppressed?: boolean;
  /** Optional author attribution for manual labels. */
  readonly author?: string;
  /** Optional trust hint for imported or heuristic labels. */
  readonly confidence?: string;
  /** Evidence identifiers justifying this label. */
  readonly evidence: readonly string[];
}

/** Free-form comment anchored at a single address. */
export interface ProjectComment {
  /** Optional original-image bank qualifier; targets inherit the selected mapping. */
  readonly mapping?: ResearchMapping;
  /** Stable comment identifier referenced by evidence. */
  readonly id: string;
  /** Address space containing the commented location. */
  readonly addressSpace: string;
  /** Comment anchor address within the space. */
  readonly address: number;
  /** Comment body text emitted during export. */
  readonly text: string;
  /** Omission retains the legacy standalone comment rendering. */
  readonly placement?: "before" | "inline-instruction";
  /** Evidence identifiers justifying this comment. */
  readonly evidence: readonly string[];
}

/** Named region, optionally used as an export or overlay grouping. */
export interface ProjectRegion {
  /** Optional original-image bank qualifier; targets inherit the selected mapping. */
  readonly mapping?: ResearchMapping;
  /** Stable region identifier referenced by evidence. */
  readonly id: string;
  /** Optional containing/logical source region. Cross-address-space parents model projections. */
  readonly parentRegion?: string;
  /** Address space containing the half-open region bounds. */
  readonly addressSpace: string;
  /** Inclusive start address of the region. */
  readonly start: number;
  /** Exclusive end. */
  readonly end: number;
  /** Region name used for grouping and export overlays. */
  readonly name: string;
  /** Optional semantic context string for tooling and filters. */
  readonly context?: string;
  /** Optional sort priority when regions overlap in presentation. */
  readonly priority?: number;
  /** Optional string, number, or boolean attributes attached to the region. */
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
  /** Evidence identifiers justifying this region. */
  readonly evidence: readonly string[];
}

/** One imported field that could not be represented in the native schema. */
export interface ImportLossItem {
  /** Source field or collection name that could not be mapped. */
  readonly field: string;
  /** Number of source values dropped for this field. */
  readonly count: number;
  /** Explanation of why the values were unsupported. */
  readonly reason: string;
}

/** Deterministic report of an import (counts plus loss). */
export interface ImportReport {
  /** Stable import report identifier. */
  readonly id: string;
  /** Source format id that produced this report. */
  readonly format: string;
  /** Original filename or URI of the imported source. */
  readonly sourceName: string;
  /** SHA-256 of the imported source bytes. */
  readonly sourceSha256: string;
  /** Optional version string from the source format. */
  readonly sourceVersion?: string;
  /** Versioned index projection. Omitted for full imports. The same source cannot mix profiles. */
  readonly indexProfile?: string;
  /** Counts of native records created per shard kind. */
  readonly imported: Readonly<Record<string, number>>;
  /** Aggregated unsupported fields with loss reasons. */
  readonly unsupported: readonly ImportLossItem[];
  /** Non-fatal import warnings retained for the user. */
  readonly warnings: readonly string[];
}

/** Accepted CFG instruction node serialized into the analysis shard. */
export interface AnalysisControlFlowNodeRecord {
  /** Stable CFG node identifier referenced by edges and evidence. */
  readonly id: string;
  /** Discriminator marking this record as a CFG instruction node. */
  readonly kind: "cfg-node";
  /** Address space containing the instruction opcode. */
  readonly addressSpace: string;
  /** CPU-space address of the decoded opcode. */
  readonly address: number;
  /** Absent for captured RAM code. Never synthesize a ROM offset. */
  readonly fileOffset?: number;
  /** Optional raw opcode bytes when captured separately from the ROM image. */
  readonly bytes?: readonly number[];
  /** Instruction length in bytes at this address. */
  readonly size: number;
  /** Primary opcode byte value. */
  readonly opcode: number;
  /** Architecture specification id used to decode this instruction. */
  readonly specificationId: string;
  /** Decoded mnemonic string for presentation. */
  readonly mnemonic: string;
  /** Addressing mode name from the specification. */
  readonly mode: string;
  /** Call-site addresses forming the calling context, innermost last. */
  readonly context: readonly number[];
  /** Abstract CPU state observed immediately before decode. */
  readonly incomingState: Readonly<Record<string, unknown>>;
  /** Abstract CPU state after applying instruction effects. */
  readonly outgoingState: Readonly<Record<string, unknown>>;
  /** Operand effective-address explanations attached to this node. */
  readonly effectiveAddresses: readonly Readonly<Record<string, unknown>>[];
  /** Seed or vector id that first reached this instruction. */
  readonly entryPoint: string;
  /** Unambiguous owning function's CFG node. Compact graphs use this instead of copying every path prefix. */
  readonly functionEntry?: string;
  /** Previous CFG node on a discovery path within functionEntry, permitting lazy path reconstruction. */
  readonly evidencePredecessor?: string;
  /** Legacy explicit discovery path, or just this node's ID when compact ownership is present. */
  readonly evidencePath: readonly string[];
  /** Evidence identifiers consumed while accepting this node. */
  readonly evidence: readonly string[];
}

/** CFG edge, including unresolved targets that have no `to` node. */
export interface AnalysisControlFlowEdgeRecord {
  /** Stable edge identifier referenced by diagnostics. */
  readonly id: string;
  /** Discriminator marking this record as a CFG edge. */
  readonly kind: "cfg-edge";
  /** Address space shared by both endpoints. */
  readonly addressSpace: string;
  /** Source CFG node id. */
  readonly from: string;
  /** Source instruction address for diagnostics without loading the node. */
  readonly fromAddress: number;
  /** Destination CFG node id when the target was accepted. */
  readonly to?: string;
  /** Destination instruction address when known statically. */
  readonly toAddress?: number;
  /** Serialized control-flow kind for this edge. */
  readonly edgeKind: string;
  /** True when the destination was resolved indirectly or manually. */
  readonly indirect: boolean;
  /** Target-override id when this edge was supplied by the user. */
  readonly override?: string;
  /** Optional human-readable note explaining an indirect or overridden edge. */
  readonly explanation?: string;
  /** Evidence identifiers justifying this edge. */
  readonly evidence: readonly string[];
}

/** Function-entry candidate discovered from a seed, call, or interrupt. */
export interface AnalysisFunctionRecord {
  /** Stable function candidate identifier. */
  readonly id: string;
  /** Discriminator marking this record as a function entry. */
  readonly kind: "function";
  /** Address space containing the entry point. */
  readonly addressSpace: string;
  /** Entry instruction address for the function candidate. */
  readonly address: number;
  /** Origin channel such as seed, call site, or interrupt vector. */
  readonly source: string;
  /** Discovery call site, a legacy explicit ancestry path, or empty for seed functions. */
  readonly evidencePath: readonly string[];
  /** Evidence identifiers supporting this function candidate. */
  readonly evidence: readonly string[];
}

/** Decode, mapping, or overlapping-instruction conflict. */
export interface AnalysisConflictRecord {
  /** Stable conflict identifier. */
  readonly id: string;
  /** Discriminator marking this record as an analysis conflict. */
  readonly kind: "conflict";
  /** Address space where the conflict was detected. */
  readonly addressSpace: string;
  /** Primary conflict address. */
  readonly address: number;
  /** Optional exclusive end for a conflict spanning more than one address. */
  readonly end?: number;
  /** Conflict category used for filtering and presentation. */
  readonly conflictKind: string;
  /** Human-readable conflict description. */
  readonly message: string;
  /** CFG node ids involved in the conflict. */
  readonly nodes: readonly string[];
  /** Evidence identifiers attached to the conflict report. */
  readonly evidence: readonly string[];
}

/** Indirect or otherwise unknown control-flow site. */
export interface AnalysisUnresolvedRecord {
  /** Stable unresolved-flow identifier. */
  readonly id: string;
  /** Discriminator marking this record as unresolved control flow. */
  readonly kind: "unresolved";
  /** Address space containing the unresolved site. */
  readonly addressSpace: string;
  /** Instruction address where flow could not be resolved. */
  readonly address: number;
  /** Serialized control-flow kind at the unresolved site. */
  readonly flowKind: string;
  /** True when the site depends on indirect addressing or runtime state. */
  readonly indirect: boolean;
  /** Explanation of why static resolution failed. */
  readonly reason: string;
  /** Evidence identifiers collected at the unresolved site. */
  readonly evidence: readonly string[];
}

/** Run-level coverage and completion status for one analysis pass. */
export interface AnalysisSummaryRecord {
  /** Stable summary identifier for this analysis pass. */
  readonly id: string;
  /** Discriminator marking this record as a run summary. */
  readonly kind: "summary";
  /** Architecture id summarized by this record. */
  readonly architecture: string;
  /** Whether the worklist finished before hitting configured limits. */
  readonly status: "complete" | "incomplete";
  /** Named coverage counters produced by the pass. */
  readonly coverage: Readonly<Record<string, number>>;
  /** Work items processed when the pass stopped. */
  readonly processedWorkItems: number;
  /** Structured reasons when status is incomplete. */
  readonly incompleteReasons: readonly Readonly<Record<string, unknown>>[];
  /** Evidence identifiers attached to the summary. */
  readonly evidence: readonly string[];
}

/** Editable project input that resolves one indirect control-flow site. */
export interface AnalysisTargetOverrideRecord {
  /** Optional original-image bank qualifier; targets inherit the selected mapping. */
  readonly mapping?: ResearchMapping;
  /** Stable override identifier referenced by edges. */
  readonly id: string;
  /** Discriminator marking this record as a target override. */
  readonly kind: "target-override";
  /** Address space containing the indirect site. */
  readonly addressSpace: string;
  /** Instruction address where overrides apply. */
  readonly address: number;
  /** Allowed destination addresses for the indirect site. */
  readonly targets: readonly number[];
  /** Evidence identifiers justifying this override. */
  readonly evidence: readonly string[];
}

/** Editable named entry-point collection for overlays, engines, or banked dispatch. */
export interface AnalysisTargetSetRecord {
  /** Optional original-image bank qualifier; targets inherit the selected mapping. */
  readonly mapping?: ResearchMapping;
  /** Stable target-set identifier. */
  readonly id: string;
  /** Discriminator marking this record as a named target set. */
  readonly kind: "target-set";
  /** Address space containing the listed entry points. */
  readonly addressSpace: string;
  /** Display name for the target collection. */
  readonly name: string;
  /** Entry-point addresses seeded into analysis from this set. */
  readonly targets: readonly number[];
  /** Evidence identifiers justifying this target set. */
  readonly evidence: readonly string[];
}

/** Collections with user-editable metadata; generated CFG and runtime observations are excluded. */
export type MetadataShard = "labels" | "comments" | "annotations" | "analysis";

/** Records accepted by Git-tracked research declarations. */
export type EditableMetadataRecord =
  | ProjectLabel
  | ProjectComment
  | IntervalAnnotation
  | AnalysisTargetOverrideRecord
  | AnalysisTargetSetRecord;

/** Discriminated analysis-shard record. */
export type AnalysisRecord =
  | AnalysisControlFlowNodeRecord
  | AnalysisControlFlowEdgeRecord
  | AnalysisFunctionRecord
  | AnalysisConflictRecord
  | AnalysisUnresolvedRecord
  | AnalysisSummaryRecord
  | AnalysisTargetOverrideRecord
  | AnalysisTargetSetRecord;

/** A scalar register or mode value captured from a runtime source. */
export type RuntimeStateValue = string | number | boolean;

/** Shared identity and aggregation fields for runtime evidence records. */
interface RuntimeRecordBase {
  /** Stable runtime record identifier. */
  readonly id: string;
  /** Target architecture id interpreting captured state. */
  readonly architecture: string;
  /** Number of observations aggregated into this deterministic record. */
  readonly count: number;
  /** Evidence identifiers supporting this runtime fact. */
  readonly evidence: readonly string[];
}

/** Aggregated observation that an instruction began execution at an address. */
export interface RuntimeExecutionRecord extends RuntimeRecordBase {
  /** Discriminator marking an execution-count observation. */
  readonly kind: "runtime-execution";
  /** Address space where execution was observed. */
  readonly addressSpace: string;
  /** Instruction address that began execution. */
  readonly address: number;
  /** Optional headerless ROM offset when the space maps to file content. */
  readonly fileOffset?: number;
  /** Optional decoded instruction size when captured with the observation. */
  readonly size?: number;
  /** Optional opcode byte when captured with the observation. */
  readonly opcode?: number;
}

/** Execution-time instruction image. Separate variants preserve mutable RAM code. */
export interface RuntimeInstructionRecord extends RuntimeRecordBase {
  /** Discriminator marking a captured instruction image. */
  readonly kind: "runtime-instruction";
  /** Address space containing the captured bytes. */
  readonly addressSpace: string;
  /** Address of the captured instruction image. */
  readonly address: number;
  /** Raw instruction bytes observed at execution time. */
  readonly bytes: readonly number[];
  /** CPU state associated with this instruction variant. */
  readonly state: Readonly<Record<string, RuntimeStateValue>>;
}

/** Aggregated read or write observed while an instruction executes. */
export interface RuntimeMemoryAccessRecord extends RuntimeRecordBase {
  /** Discriminator marking a memory access observation. */
  readonly kind: "runtime-memory-access";
  /** Address space of the executing instruction. */
  readonly instructionAddressSpace: string;
  /** Address of the executing instruction. */
  readonly instructionAddress: number;
  /** Address space of the accessed location. */
  readonly accessedAddressSpace: string;
  /** Accessed byte address within the accessed space. */
  readonly accessedAddress: number;
  /** Bus actor when the access was not performed by the CPU alone. */
  readonly actor?: "cpu" | "dma" | "hdma";
  /** DMA channel number when actor is dma or hdma. */
  readonly channel?: number;
  /** Observed access direction or ambiguity. */
  readonly access: "read" | "write" | "read-write" | "unknown";
  /** Access width in bytes. */
  readonly width: number;
  /** Observed value when the capture included data. */
  readonly value?: number;
}

/** Register and mode values observed immediately before an instruction executes. */
export interface RuntimeCpuStateRecord extends RuntimeRecordBase {
  /** Discriminator marking a pre-instruction CPU state snapshot. */
  readonly kind: "runtime-cpu-state";
  /** Address space of the observed instruction. */
  readonly addressSpace: string;
  /** Instruction address whose prologue state was captured. */
  readonly address: number;
  /** Flat register and mode values keyed by architecture-specific names. */
  readonly state: Readonly<Record<string, RuntimeStateValue>>;
}

/** Half-open aggregate coverage projected into a named project address space. */
export interface RuntimeCoverageRecord extends RuntimeRecordBase {
  /** Discriminator marking an aggregate coverage interval. */
  readonly kind: "runtime-coverage";
  /** Address space receiving the coverage projection. */
  readonly addressSpace: string;
  /** Inclusive start of the covered half-open range. */
  readonly start: number;
  /** Exclusive end of the covered half-open range. */
  readonly end: number;
  /** Coverage semantics applied across the interval. */
  readonly coverage: "executed" | "operand" | "read" | "written";
}

/** Observed control-flow destination, including a resolved indirect target. */
export interface RuntimeControlTargetRecord extends RuntimeRecordBase {
  /** Discriminator marking an observed control-flow edge. */
  readonly kind: "runtime-control-target";
  /** Address space of the branching instruction. */
  readonly fromAddressSpace: string;
  /** Address of the branching instruction. */
  readonly fromAddress: number;
  /** Address space of the observed destination. */
  readonly toAddressSpace: string;
  /** Observed destination address. */
  readonly toAddress: number;
  /** Serialized control-flow kind for the observed transfer. */
  readonly flowKind: string;
  /** True when the destination was reached through indirection. */
  readonly indirect: boolean;
}

/** Aggregated bus activity, including accesses without an owning instruction. */
export interface RuntimeBusAccessRecord extends RuntimeRecordBase, RuntimeBusFact {
  /** Discriminator marking a normalized bus access fact. */
  readonly kind: "runtime-bus-access";
}

/** Graphics observations remain independent of instruction discovery. */
export interface RuntimeGraphicsAccessRecord extends RuntimeRecordBase, RuntimeGraphicsFact {
  /** Discriminator marking a normalized graphics observation. */
  readonly kind: "runtime-graphics-access";
}

/** Normalized, emulator-neutral runtime fact stored independently from regenerated CFG output. */
export type RuntimeEvidenceRecord =
  | RuntimeGraphicsAccessRecord
  | RuntimeBusAccessRecord
  | RuntimeInstructionRecord
  | RuntimeExecutionRecord
  | RuntimeMemoryAccessRecord
  | RuntimeCpuStateRecord
  | RuntimeCoverageRecord
  | RuntimeControlTargetRecord;

/**
 * Logical SQLite collections. Readonly types do not freeze the decoded objects at runtime.
 * A full load contains every record. A view can omit runtime or select records. Never publish
 * a partial view through a full-replacement API: omitted records would be deleted.
 */
export interface AnalysisProjectShards {
  /** CFG, conflicts, summaries, and editable analysis inputs. */
  readonly analysis: readonly AnalysisRecord[];
  /** Classified interval annotations including opcode and data markers. */
  readonly annotations: readonly IntervalAnnotation[];
  /** Named labels anchored at single addresses. */
  readonly labels: readonly ProjectLabel[];
  /** Free-form comments anchored at single addresses. */
  readonly comments: readonly ProjectComment[];
  /** Named half-open regions for grouping and overlays. */
  readonly regions: readonly ProjectRegion[];
  /** Emulator-neutral runtime facts independent of regenerated CFG output. */
  readonly runtime: readonly RuntimeEvidenceRecord[];
  /** Justifications referenced by shard record evidence arrays. */
  readonly evidence: readonly EvidenceRecord[];
  /** Deterministic import reports with loss accounting. */
  readonly imports: readonly ImportReport[];
}

/** Complete replacement for full writers. Pure edit helpers can also operate on selected views. */
export interface AnalysisProject {
  /** Authoritative manifest describing ROM identity and address spaces. */
  readonly manifest: AnalysisProjectManifest;
  /** Full shard collections loaded or to be written atomically. */
  readonly shards: AnalysisProjectShards;
}

/** One consistent revision, detached from storage. Readonly types do not freeze records at runtime. */
export interface LoadedAnalysisProject {
  /** Manifest snapshot paired with the loaded shards. */
  readonly manifest: AnalysisProjectManifest;
  /** Shard snapshot read from storage for this revision. */
  readonly shards: AnalysisProjectShards;
}

/** A fresh reducer per read attempt. It must not publish facts before the load succeeds. */
export interface RuntimeRecordProjection {
  /** Appends one runtime fact to the in-flight projection buffer. */
  readonly push: (record: RuntimeEvidenceRecord) => void;
  /** Finalizes buffered runtime facts in deterministic order. */
  readonly finish: () => readonly RuntimeEvidenceRecord[];
}

/** Metadata and optional runtime projection. Never pass this partial view to a full replacement. */
export interface LoadedAnalysisProjectView {
  /** Manifest snapshot for the partially loaded project. */
  readonly manifest: AnalysisProjectManifest;
  /** Shard subset loaded for this view; may omit collections. */
  readonly view: AnalysisProjectShards;
}
