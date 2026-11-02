import { type LinkExpression } from "../ir/link-expression.js";
import type { AssemblyStageName } from "../plugin/contracts.js";
import type { AssemblyFixup, AssemblyModule, AssemblyModuleRange, AssemblyModuleSymbol, AssemblySectionOptions, RelocatableSource, RelocationEncoding, SectionPosition } from "../relocatable.js";
/** Mutable section state belongs to exactly one assembly pass. */
interface SectionState extends Required<AssemblySectionOptions> {
    size: number;
    cursor: number;
    bytes: number[];
}
/** Owns in-memory section/symbol/fixup production; it performs no placement or object-file serialization. */
export declare class ModuleAssembly {
    readonly id: string;
    readonly defaultAddressSpace: string;
    readonly sections: Map<string, SectionState>;
    readonly symbols: Map<string, AssemblyModuleSymbol>;
    readonly fixups: AssemblyFixup[];
    readonly ranges: AssemblyModuleRange[];
    readonly fields: import("../relocatable.js").AssemblyModuleField[];
    readonly assets: import("../relocatable.js").AssemblyModuleAsset[];
    readonly instructions: import("../relocatable.js").AssemblyModuleInstruction[];
    private readonly definitions;
    private readonly exports;
    private readonly imports;
    private readonly references;
    private sectionName;
    private stage;
    private complete;
    /** Only numeric probes borrow this cursor; emitted extents always use the active section cursor. */
    private previewOffset?;
    /** Probing compound syntax must not introduce dependencies on register names or failed parses. */
    private trackReferences;
    constructor(id: string, defaultAddressSpace: string);
    /** Each pass replays section sizes; previous symbol definitions remain available to forward references. */
    beginStage(stage: AssemblyStageName): void;
    /** Reopening a section resumes its byte cursor; conflicting declarations fail before mutation. */
    selectSection(options: AssemblySectionOptions): number;
    private get current();
    /** A detached byte position; numeric offsets never masquerade as final processor addresses. */
    position(offset?: number): SectionPosition;
    get sectionKind(): AssemblySectionOptions["kind"];
    /** Local padding is only meaningful when the linker also aligns the section's starting address. */
    requireAlignment(alignment: number): number;
    location(offset?: number): LinkExpression;
    /** Numeric compatibility probes may advance a temporary cursor without touching section extents, bytes or fixups. */
    withPreviewCursor<T>(operation: (advance: (bytes: number) => void) => T): T;
    /** Reserve bytes without using mapper bank-wrap arithmetic. BSS stores only its extent. */
    advance(count: number): number;
    /** Restore a saved source-layout cursor without inventing bytes or allowing a seek beyond an existing extent. */
    seek(offset: number): number;
    /** Payload writes cannot initialize BSS, and only final emission retains bytes. */
    write(value: number): void;
    /** A symbol definition retains its owning section even when two sections use the same offset. */
    define(name: string, value: number, isStatic: boolean, source: RelocatableSource): void;
    /** Aliases retain unresolved external and cross-section dependencies without guessed addresses. */
    defineExpression(name: string, value: LinkExpression, source: RelocatableSource): void;
    isDefinedThisStage(name: string): boolean;
    /** Imports use external names; exports may precede their definitions. */
    declare(name: string, visibility: "import" | "export", source: RelocatableSource): void;
    /** Constants fold immediately; imported and not-yet-defined names remain explicit references. */
    reference(name: string): LinkExpression;
    /** Classifiers may probe register/compound syntax as an expression; failed probes must not declare symbol dependencies. */
    probe<T>(operation: () => T): T;
    /** Record a field independently of placeholder bytes. Target semantics remain explicit for the linker. */
    field(expression: LinkExpression, encoding: RelocationEncoding, source: RelocatableSource): number[];
    /** Coalesce adjacent bytes from the same occurrence without merging across sections or architectures. */
    recordRange(source: RelocatableSource, kind: AssemblyModuleRange["kind"], size: number, offset: number): void;
    /** A failed or incomplete pass can never expose a module as a successful object producer result. */
    finish(): void;
    /** Copy payload storage so subsequent assembly or caller mutation cannot alter a retained result. */
    snapshot(target: string, targetOptions: AssemblyModule["targetOptions"], dependencies: AssemblyModule["dependencies"]): AssemblyModule;
}
export {};
//# sourceMappingURL=module-assembly.d.ts.map