import type { LinkExpression } from "./ir/link-expression.js";
import type { SyntaxValue } from "./ir/source-syntax.js";
/** Stable identity within an independently assembled module; offsets are byte offsets in a section. */
export interface SectionPosition {
    readonly section: string;
    readonly offset: number;
}
/** A section is ROM-backed code/data or an uninitialized run-time reservation. Alignment is in bytes. */
export interface AssemblySectionOptions {
    readonly name: string;
    readonly kind?: "code" | "data" | "bss";
    readonly alignment?: number;
    readonly addressSpace?: string;
}
/** Source occurrence retained independently of its eventual ROM or run-time address. Lines are one-based. */
export interface RelocatableSource {
    readonly file: string;
    readonly line: number;
    readonly architecture: string;
}
/** Target-owned meaning of one encoded field. A relative PC is the instruction-end position. */
export interface RelocationEncoding {
    readonly constraint?: "powerOfTwo";
    /** Validate source values before packing/scaling them into a smaller instruction field. */
    readonly checks?: readonly {
        readonly expression: LinkExpression;
        readonly minimum?: number;
        readonly maximum?: number;
        readonly alignment?: number;
    }[];
    readonly width: 1 | 2 | 3 | 4;
    readonly endianness?: "little" | "big";
    readonly kind?: "absolute" | "relative" | "programBank" | "dataBank" | "directPage" | "upperPage";
    readonly signed?: boolean;
    /** Explicit authored truncation (data/masked expressions), separate from range-checked addresses. */
    readonly truncate?: boolean;
    readonly pc?: SectionPosition;
    /** Processor address width and optional within-bank wrap width, in bits. */
    readonly addressWidth?: number;
    readonly wrapWidth?: number;
    readonly state?: SyntaxValue;
    /** Bounds/alignment are checked by the target's link policy before applying any transformation. */
    readonly minimum?: number;
    readonly maximum?: number;
    readonly alignment?: number;
}
/** A typed field emitted by an encoder or data writer; expression semantics survive serialization. */
export interface AssemblyFixup extends SectionPosition {
    readonly expression: LinkExpression;
    readonly encoding: RelocationEncoding;
    readonly source: RelocatableSource;
}
/** Symbol values remain independent of section placement. Import/export bindings use external names. */
export interface AssemblyModuleSymbol {
    readonly name: string;
    readonly visibility: "local" | "export" | "import";
    readonly value?: LinkExpression;
    readonly source: RelocatableSource;
}
/** Owned section payload. BSS has an extent but no file bytes. */
export interface AssemblySection extends Required<AssemblySectionOptions> {
    readonly size: number;
    readonly bytes: Uint8Array;
}
/** Instruction/data/asset provenance is relocatable until the linker assigns final addresses. */
export interface AssemblyModuleRange extends SectionPosition {
    readonly size: number;
    readonly source: RelocatableSource;
    readonly kind: "instruction" | "data" | "asset" | "reservation";
    readonly details?: SyntaxValue;
}
/** Field attribution supplements emitted ranges without creating a second byte owner. */
export interface AssemblyModuleField extends SectionPosition {
    readonly reference: string;
    readonly expression: string;
    readonly size: number;
    readonly source: RelocatableSource;
}
/** Converted/raw asset attribution survives placement independently of its source resource paths. */
export interface AssemblyModuleAsset extends SectionPosition {
    readonly size: number;
    readonly source: RelocatableSource;
    readonly inputPath: string;
    readonly format: string;
    readonly part: string;
    readonly inputStart?: number;
    readonly inputEnd?: number;
    readonly conversion?: import("./addressToLine.js").AssetEmissionConversion;
}
/** Selected opcode form and processor assumptions are retained for final-address tools and target checks. */
export interface AssemblyModuleInstruction extends SectionPosition {
    readonly size: number;
    readonly source: RelocatableSource;
    readonly form: string;
    readonly state: SyntaxValue;
}
/** In-memory producer contract. Object-file encoding and linking are separate consumers of these records. */
export interface AssemblyModule {
    readonly id: string;
    readonly target: string;
    readonly targetOptions: Readonly<Record<string, unknown>>;
    readonly sections: readonly AssemblySection[];
    readonly symbols: readonly AssemblyModuleSymbol[];
    readonly fixups: readonly AssemblyFixup[];
    readonly ranges: readonly AssemblyModuleRange[];
    readonly fields: readonly AssemblyModuleField[];
    readonly assets: readonly AssemblyModuleAsset[];
    readonly instructions: readonly AssemblyModuleInstruction[];
    readonly dependencies: readonly {
        readonly path: string;
        readonly sha256: string;
        readonly size?: number;
        readonly crc32?: number;
    }[];
}
/** Enable section-relative output for one assembler session. Identity must be stable across rebuilds. */
export interface AssemblyModuleOptions {
    readonly id: string;
    /** Explicit source-layout adaptation; omission retains native section syntax and never changes absolute sessions. */
    readonly sourceAdapter?: "asar" | "ca65";
}
/** Authored layout hints supplied separately from relocatable object records. A recipe may replace these addresses. */
export interface AddressedAssemblySection {
    readonly section: string;
    readonly loadAddress: number;
    readonly runAddress: number;
    readonly size: number;
}
/** Target memory regions distinguish logical run addresses from optional physical ROM storage. */
export interface LinkMemoryRegion {
    /** Container bytes supplied by the target, such as an iNES header; never used as a ROM comparison oracle. */
    readonly initialBytes?: readonly number[];
    readonly name: string;
    readonly start: number;
    readonly size: number;
    readonly outputOffset?: number;
    readonly fillByte?: number;
    readonly addressSpace?: string;
}
/** Contributions with the same section name are combined in the recipe's explicit input order. */
export interface LinkSectionPlacement {
    /** Require each contribution to fit entirely within one processor bank of this byte size. */
    readonly bankSize?: number;
    readonly section: string;
    readonly load: string;
    readonly run: string;
    readonly start?: number;
    readonly alignment?: number;
}
/** Recipe symbols derive from placed section extents or pure expressions over other global names. */
export type LinkRecipeSymbol = {
    readonly name: string;
    readonly section: string;
    readonly property: "load" | "run" | "size" | "runEnd";
} | {
    readonly name: string;
    readonly expression: LinkExpression;
};
/** Portable layout input shared by target adapters and future linker consumers. It allocates nothing. */
export interface AssemblyLinkRecipe {
    /** Container/mapper policy is portable input, distinct from module-local encoder options. */
    readonly targetOptions?: Readonly<Record<string, unknown>>;
    readonly assumptions?: readonly import("./linker/types.js").LinkAssumption[];
    readonly assertions?: readonly import("./linker/types.js").LinkAssertion[];
    readonly target: string;
    readonly regions: readonly LinkMemoryRegion[];
    readonly placements: readonly LinkSectionPlacement[];
    readonly symbols?: readonly LinkRecipeSymbol[];
    readonly checksumPolicy?: "preserve" | "recompute";
}
//# sourceMappingURL=relocatable.d.ts.map