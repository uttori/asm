import type { LinkExpression } from "./ir/link-expression.js";
import type { SyntaxValue } from "./ir/source-syntax.js";

/** Stable identity within an independently assembled module; offsets are byte offsets in a section. */
export interface SectionPosition {
  /** Section name owning the byte offset. */
  readonly section: string;
  /** Byte offset from the start of {@link section}. */
  readonly offset: number;
}

/** A section is ROM-backed code/data or an uninitialized run-time reservation. Alignment is in bytes. */
export interface AssemblySectionOptions {
  /** Unique section name within the module. */
  readonly name: string;
  /** Section kind controlling whether bytes are emitted or reserved. */
  readonly kind?: "code" | "data" | "bss";
  /** Byte alignment requirement for the section start. */
  readonly alignment?: number;
  /** Address-space contribution id owning the section bytes. */
  readonly addressSpace?: string;
}

/** Source occurrence retained independently of its eventual ROM or run-time address. Lines are one-based. */
export interface RelocatableSource {
  /** Path of the source file containing the occurrence. */
  readonly file: string;
  /** One-based source line attributed to the record. */
  readonly line: number;
  /** Architecture contribution id active when the record was emitted. */
  readonly architecture: string;
}

/** Target-owned meaning of one encoded field. A relative PC is the instruction-end position. */
export interface RelocationEncoding {
  /** Require the resolved value to be a power of two before packing. */
  readonly constraint?: "powerOfTwo";
  /** Validate source values before packing/scaling them into a smaller instruction field. */
  readonly checks?: readonly {
    /** Link expression evaluated for the check. */
    readonly expression: LinkExpression;
    /** Inclusive minimum allowed value when set. */
    readonly minimum?: number;
    /** Inclusive maximum allowed value when set. */
    readonly maximum?: number;
    /** Required alignment in bytes when set. */
    readonly alignment?: number;
  }[];
  /** Field width in bytes before any linker packing. */
  readonly width: 1 | 2 | 3 | 4;
  /** Byte order used when the field spans multiple bytes. */
  readonly endianness?: "little" | "big";
  /** Relocation interpretation applied when the link expression is resolved. */
  readonly kind?: "absolute" | "relative" | "programBank" | "dataBank" | "directPage" | "upperPage";
  /** Whether the packed value uses two's-complement semantics. */
  readonly signed?: boolean;
  /** Explicit authored truncation (data/masked expressions), separate from range-checked addresses. */
  readonly truncate?: boolean;
  /** Program-counter section position used for PC-relative relocations. */
  readonly pc?: SectionPosition;
  /** Processor address width and optional within-bank wrap width, in bits. */
  readonly addressWidth?: number;
  /** Within-bank address wrap width in bits when distinct from address width. */
  readonly wrapWidth?: number;
  /** Frozen syntax snapshot of processor state during encoding. */
  readonly state?: SyntaxValue;
  /** Bounds/alignment are checked by the target's link policy before applying any transformation. */
  readonly minimum?: number;
  /** Inclusive maximum value enforced by link policy before transformation. */
  readonly maximum?: number;
  /** Required byte alignment enforced by link policy before transformation. */
  readonly alignment?: number;
}

/** A typed field emitted by an encoder or data writer; expression semantics survive serialization. */
export interface AssemblyFixup extends SectionPosition {
  /** Link expression whose value is packed into the fixup site. */
  readonly expression: LinkExpression;
  /** Target encoding contract describing width, kind, and checks. */
  readonly encoding: RelocationEncoding;
  /** Source occurrence that emitted the fixup bytes. */
  readonly source: RelocatableSource;
}

/** Symbol values remain independent of section placement. Import/export bindings use external names. */
export interface AssemblyModuleSymbol {
  /** Symbol name as recorded in the object module. */
  readonly name: string;
  /** Linkage visibility for the symbol binding. */
  readonly visibility: "local" | "export" | "import";
  /** Relocatable value expression when the symbol is defined. */
  readonly value?: LinkExpression;
  /** Source occurrence that introduced the binding. */
  readonly source: RelocatableSource;
}

/** Owned section payload. BSS has an extent but no file bytes. */
export interface AssemblySection extends Required<AssemblySectionOptions> {
  /** Declared byte extent of the section payload. */
  readonly size: number;
  /** Section bytes; empty for BSS reservations. */
  readonly bytes: Uint8Array;
}

/** Instruction/data/asset provenance is relocatable until the linker assigns final addresses. */
export interface AssemblyModuleRange extends SectionPosition {
  /** Byte length of the attributed range. */
  readonly size: number;
  /** Source occurrence for the range start. */
  readonly source: RelocatableSource;
  /** Category of bytes covered by the range. */
  readonly kind: "instruction" | "data" | "asset" | "reservation";
  /** Optional syntax snapshot describing encoder-specific details. */
  readonly details?: SyntaxValue;
}

/** Field attribution supplements emitted ranges without creating a second byte owner. */
export interface AssemblyModuleField extends SectionPosition {
  /** Fully qualified struct field reference. */
  readonly reference: string;
  /** Source expression text encoded into the field. */
  readonly expression: string;
  /** Encoded width of the field in bytes. */
  readonly size: number;
  /** Source occurrence that emitted the field. */
  readonly source: RelocatableSource;
}

/** Converted/raw asset attribution survives placement independently of its source resource paths. */
export interface AssemblyModuleAsset extends SectionPosition {
  /** Output byte length contributed by the asset slice. */
  readonly size: number;
  /** Source occurrence of the include directive. */
  readonly source: RelocatableSource;
  /** Path to the binary input file on disk. */
  readonly inputPath: string;
  /** Asset format identifier or `raw` for incbin. */
  readonly format: string;
  /** Logical part name within a multi-part asset. */
  readonly part: string;
  /** Inclusive start offset within the input file when recorded. */
  readonly inputStart?: number;
  /** Exclusive end offset within the input file when recorded. */
  readonly inputEnd?: number;
  /** Evaluated converter contract when the asset was not raw incbin. */
  readonly conversion?: import("./addressToLine.js").AssetEmissionConversion;
}

/** Selected opcode form and processor assumptions are retained for final-address tools and target checks. */
export interface AssemblyModuleInstruction extends SectionPosition {
  /** Encoded instruction length in bytes. */
  readonly size: number;
  /** Source occurrence of the emitting statement. */
  readonly source: RelocatableSource;
  /** Canonical opcode form id selected by the encoder. */
  readonly form: string;
  /** Frozen syntax snapshot of assembly-time processor state. */
  readonly state: SyntaxValue;
}

/** In-memory producer contract. Object-file encoding and linking are separate consumers of these records. */
export interface AssemblyModule {
  /** Stable module identity assigned for this assembly session. */
  readonly id: string;
  /** Target contribution id that produced the module. */
  readonly target: string;
  /** Validated target options frozen at module creation. */
  readonly targetOptions: Readonly<Record<string, unknown>>;
  /** Section payloads emitted by the module. */
  readonly sections: readonly AssemblySection[];
  /** Symbol table entries with linkage metadata. */
  readonly symbols: readonly AssemblyModuleSymbol[];
  /** Relocatable fixup sites awaiting link resolution. */
  readonly fixups: readonly AssemblyFixup[];
  /** Byte-range provenance records for instructions, data, assets, and reservations. */
  readonly ranges: readonly AssemblyModuleRange[];
  /** Struct field attribution records parallel to emitted bytes. */
  readonly fields: readonly AssemblyModuleField[];
  /** Asset include records with input slice metadata. */
  readonly assets: readonly AssemblyModuleAsset[];
  /** Instruction encoding records with opcode form snapshots. */
  readonly instructions: readonly AssemblyModuleInstruction[];
  /** Binary dependencies fingerprinted during assembly. */
  readonly dependencies: readonly {
    /** Resolved dependency path on disk. */
    readonly path: string;
    /** SHA-256 hex digest of the dependency bytes. */
    readonly sha256: string;
    /** Byte length when recorded. */
    readonly size?: number;
    /** CRC32 when recorded for legacy consumers. */
    readonly crc32?: number;
  }[];
}

/** Enable section-relative output for one assembler session. Identity must be stable across rebuilds. */
export interface AssemblyModuleOptions {
  /** Stable module id reused across incremental rebuilds. */
  readonly id: string;
  /** Explicit source-layout adaptation; omission retains native section syntax and never changes absolute sessions. */
  readonly sourceAdapter?: "asar" | "ca65";
}

/** Authored layout hints supplied separately from relocatable object records. A recipe may replace these addresses. */
export interface AddressedAssemblySection {
  /** Section name receiving the layout hint. */
  readonly section: string;
  /** Load address assigned before linking overrides. */
  readonly loadAddress: number;
  /** Run address assigned before linking overrides. */
  readonly runAddress: number;
  /** Declared section size in bytes. */
  readonly size: number;
}

/** Target memory regions distinguish logical run addresses from optional physical ROM storage. */
export interface LinkMemoryRegion {
  /** Container bytes supplied by the target, such as an iNES header; never used as a ROM comparison oracle. */
  readonly initialBytes?: readonly number[];
  /** Region name referenced by section placements. */
  readonly name: string;
  /** Inclusive start address of the region in logical space. */
  readonly start: number;
  /** Byte extent of the region. */
  readonly size: number;
  /** Optional offset within the output image where region bytes begin. */
  readonly outputOffset?: number;
  /** Fill value used when expanding sparse output within the region. */
  readonly fillByte?: number;
  /** Address-space contribution id owning the region. */
  readonly addressSpace?: string;
}

/** Contributions with the same section name are combined in the recipe's explicit input order. */
export interface LinkSectionPlacement {
  /** Require each contribution to fit entirely within one processor bank of this byte size. */
  readonly bankSize?: number;
  /** Section name contributed by one or more modules. */
  readonly section: string;
  /** Load region name receiving the section image. */
  readonly load: string;
  /** Run region name receiving the execution mapping. */
  readonly run: string;
  /** Optional fixed start offset within the run region. */
  readonly start?: number;
  /** Optional byte alignment enforced before placement. */
  readonly alignment?: number;
}

/** Recipe symbols derive from placed section extents or pure expressions over other global names. */
export type LinkRecipeSymbol =
  | {
      /** Global symbol name exported by the recipe. */
      readonly name: string;
      /** Section whose layout property supplies the value. */
      readonly section: string;
      /** Which section extent property is bound to the symbol. */
      readonly property: "load" | "run" | "size" | "runEnd";
    }
  | {
      /** Global symbol name exported by the recipe. */
      readonly name: string;
      /** Pure link expression evaluated after placements are known. */
      readonly expression: LinkExpression;
    };

/** Portable layout input shared by target adapters and future linker consumers. It allocates nothing. */
export interface AssemblyLinkRecipe {
  /** Container/mapper policy is portable input, distinct from module-local encoder options. */
  readonly targetOptions?: Readonly<Record<string, unknown>>;
  /** Link-time assumptions validated before placement proceeds. */
  readonly assumptions?: readonly import("./linker/types.js").LinkAssumption[];
  /** Link-time assertions evaluated after placements are computed. */
  readonly assertions?: readonly import("./linker/types.js").LinkAssertion[];
  /** Target contribution id that interprets the recipe. */
  readonly target: string;
  /** Memory regions available for load and run mapping. */
  readonly regions: readonly LinkMemoryRegion[];
  /** Section-to-region placement rules applied in order. */
  readonly placements: readonly LinkSectionPlacement[];
  /** Optional global symbols derived from placements or expressions. */
  readonly symbols?: readonly LinkRecipeSymbol[];
  /** Whether container checksums are preserved or recomputed after linking. */
  readonly checksumPolicy?: "preserve" | "recompute";
}
