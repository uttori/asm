import { type LinkExpression } from "../ir/link-expression.js";
import type { TargetAddressSpace } from "../plugin/contracts.js";
import type { AddressedAssemblySection } from "../relocatable.js";
import type { ModuleAssembly } from "./module-assembly.js";
/** Translate authored ORG/BASE locations to ordinary section identities, retaining their addresses only as recipe hints. */
export declare class AsarModuleLayout {
    readonly module: ModuleAssembly;
    readonly addressSpace: TargetAddressSpace;
    private readonly origins;
    private previous;
    private sequence;
    private readonly pcStack;
    private readonly baseStack;
    constructor(module: ModuleAssembly, addressSpace: TargetAddressSpace);
    /** Previous-pass origins resolve forward labels, while the active pass rebuilds every authored contribution. */
    beginStage(): void;
    /** Each address transition opens a relocatable contribution; no fixed placement is stored in the object. */
    private open;
    /** Opens a section with identical load and run addresses. */
    org(address: number): number;
    /** Opens a section keeping the current load address and optional run address. */
    base(address?: number): number;
    /** Saves the current section cursor on the PC stack. */
    pushPc(): void;
    /** Restores the most recently pushed section cursor. */
    pullPc(): number;
    /** Saves the current run address on the base stack. */
    pushBase(): void;
    /** Reopens a section using the saved run address as the new base. */
    pullBase(): number;
    /** Numeric preview is for source encoding decisions only. Relocation expressions retain their section leaves. */
    currentAddress(kind: "load" | "run"): number;
    /** Unknown imports remain unknown; the encoder uses its normal unresolved form rather than a guessed final value. */
    preview(expression: LinkExpression, seen?: Set<string>): number | undefined;
    /** Return complete layout evidence only after every section has an authored load/run pair. */
    contributions(): readonly AddressedAssemblySection[];
}
//# sourceMappingURL=asar-module-layout.d.ts.map