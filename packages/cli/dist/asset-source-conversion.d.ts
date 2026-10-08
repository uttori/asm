import type { IndexedDocument } from "@uttori/asm-assets/indexed-document";
import { type AssetSourceCodecRegistry } from "@uttori/asm-assets/source-codecs";
import type { AssetEmissionInfo } from "@uttori/asm-core";
import { type SourceFileChange } from "@uttori/asm-disassembler";
import type { AssetSourceHost } from "./asset-interchange/contracts.js";
import type { SourceProjectInspection } from "./source.js";
/** Cursor coordinates identify one evaluated assembly statement, including continued calls and define-based paths. */
export interface AssetSourceConversionRequest {
    readonly directory: string;
    readonly file: string;
    /** One-based physical cursor line; the containing emitted statement is resolved from the current build. */
    readonly line: number;
    readonly representation: string;
    readonly destination?: string;
}
/** Native adapters supply mapping/resources; representation codecs only encode their shared document contract. */
export interface AssetConversionContext {
    readonly build: SourceProjectInspection;
    readonly selected: AssetEmissionInfo;
    readonly source: string;
    readonly destination: string;
    readonly codecs: AssetSourceCodecRegistry<IndexedDocument>;
    readonly representation: string;
    read(file: string): Uint8Array;
}
/** Precise option additions keyed by evaluated emission, plus source-sidecar creations/replacements. */
export interface AssetConversionCandidate {
    readonly bytes: Uint8Array;
    readonly changes: readonly SourceFileChange[];
    readonly updates: readonly {
        readonly emission: AssetEmissionInfo;
        readonly path?: string;
        readonly values: Readonly<Record<string, unknown>>;
    }[];
    /** Old authoring sources remain available when discovery cannot prove their full reference closure. */
    readonly retained?: readonly string[];
}
/** Extensible game/native adapter seam. Hosts may register new adapters without changing editor publication logic. */
export interface AssetSourceConversionAdapter {
    readonly id: string;
    supports(emission: AssetEmissionInfo): boolean;
    prepare(context: AssetConversionContext): Promise<AssetConversionCandidate>;
}
/** Complete validated source changes are reviewable and can be published through CLI transactions or native editor undo. */
export interface AssetSourceConversionPlan {
    readonly source: string;
    readonly destination: string;
    readonly outputSha256: string;
    readonly changes: readonly SourceFileChange[];
    readonly snapshots: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
    readonly affected: readonly {
        readonly file: string;
        readonly line: number;
        readonly format: string;
    }[];
    readonly retained: readonly string[];
    /** Unassembled declarations or symlinks make the old source's complete reference set uncertain. */
    readonly unresolvedDeclarations: readonly string[];
    /** Discovery scope is rechecked before retirement, including newly created unassembled declarations. */
    readonly assemblyInventory: readonly string[];
}
/** A current build proves only its consumed calls. Unassembled source files conservatively retain the old input. */
export declare function assetSourceAssemblyInventory(root: string): string[];
/** Source hosts, adapters and representation registries are injected independently for future editor/format support. */
export declare class AssetSourceConversionService {
    readonly adapters: readonly AssetSourceConversionAdapter[];
    readonly host: AssetSourceHost;
    readonly codecs: AssetSourceCodecRegistry<IndexedDocument>;
    constructor(adapters: readonly AssetSourceConversionAdapter[], host?: AssetSourceHost, codecs?: AssetSourceCodecRegistry<IndexedDocument>);
    /** Resolve the saved evaluated call; menus and execution share the same semantic context rules. */
    resolve(request: Omit<AssetSourceConversionRequest, "representation" | "destination">, signal?: AbortSignal): Promise<{
        build: SourceProjectInspection;
        selected: AssetEmissionInfo;
        source: string;
        current: import("@uttori/asm-assets/source-codecs").AssetSourceCodec<IndexedDocument>;
    }>;
    prepare(request: AssetSourceConversionRequest, signal?: AbortSignal): Promise<AssetSourceConversionPlan>;
    /** Absence and all build dependencies are guarded again immediately before publication. */
    assertFresh(root: string, plan: AssetSourceConversionPlan): void;
    /** Coordinated recoverability uses the shared journal; clean conversions have no separate review/apply lifecycle. */
    convert(request: AssetSourceConversionRequest, options?: {
        signal?: AbortSignal;
        stageOnly?: boolean;
    }): Promise<{
        source: string;
        destination: string;
        outputSha256: string;
        changes: readonly SourceFileChange[];
        snapshots: readonly {
            readonly path: string;
            readonly sha256: string;
        }[];
        affected: readonly {
            readonly file: string;
            readonly line: number;
            readonly format: string;
        }[];
        retained: readonly string[];
        unresolvedDeclarations: readonly string[];
        assemblyInventory: readonly string[];
        transaction: string | undefined;
    }>;
}
//# sourceMappingURL=asset-source-conversion.d.ts.map