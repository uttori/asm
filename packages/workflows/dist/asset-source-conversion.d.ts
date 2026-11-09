import type { IndexedDocument } from "@uttori/asm-assets/indexed-document";
import { type AssetSourceCodecRegistry } from "@uttori/asm-assets/source-codecs";
import type { AssetEmissionInfo } from "@uttori/asm-core";
import { type SourceFileChange } from "@uttori/asm-disassembler/source-project";
import type { AssetSourceHost } from "./asset-interchange/contracts.js";
import { assetSourceAssemblyInventory } from "./asset-source-inventory.js";
import type { SourceProjectInspection } from "./source.js";
export { assetSourceAssemblyInventory };
/** Cursor coordinates identify one evaluated assembly statement, including continued calls and define-based paths. */
export interface AssetSourceConversionRequest {
    /** Project root directory for the operation. */
    readonly directory: string;
    /** Assembly file containing the includeAsset call under the cursor. */
    readonly file: string;
    /** One-based physical cursor line; the containing emitted statement is resolved from the current build. */
    readonly line: number;
    /** Requested authoring representation id for the conversion. */
    readonly representation: string;
    /** Optional replacement source path; omitted keeps the current path. */
    readonly destination?: string;
}
/** Native adapters supply mapping/resources; representation codecs only encode their shared document contract. */
export interface AssetConversionContext {
    /** Current source-project inspection used as the conversion oracle. */
    readonly build: SourceProjectInspection;
    /** Evaluated includeAsset emission that the conversion will rewrite. */
    readonly selected: AssetEmissionInfo;
    /** Current native or authoring source path being converted. */
    readonly source: string;
    /** Optional replacement source path; omitted keeps the current path. */
    readonly destination: string;
    /** Indexed-document codecs available for the requested representation. */
    readonly codecs: AssetSourceCodecRegistry<IndexedDocument>;
    /** Requested authoring representation id for the conversion. */
    readonly representation: string;
    /** Read exact declaration/resource bytes from the inspection snapshot. */
    read(file: string): Uint8Array;
}
/** Precise option additions keyed by evaluated emission, plus source-sidecar creations/replacements. */
export interface AssetConversionCandidate {
    /** Byte length or payload size bound. */
    readonly bytes: Uint8Array;
    /** Source-file replacements included in the conversion candidate. */
    readonly changes: readonly SourceFileChange[];
    /** includeAsset option rewrites keyed by evaluated emission. */
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
    /** Adapter identifier used to select a conversion path. */
    readonly id: string;
    /** True when this adapter can convert the evaluated emission. */
    supports(emission: AssetEmissionInfo): boolean;
    /** Plan source replacements for switching this emission to `representation`. */
    prepare(context: AssetConversionContext): Promise<AssetConversionCandidate>;
}
/** Complete validated source changes are reviewable and can be published through CLI transactions or native editor undo. */
export interface AssetSourceConversionPlan {
    /** Current native or authoring source path being converted. */
    readonly source: string;
    /** Optional replacement source path; omitted keeps the current path. */
    readonly destination: string;
    /** SHA-256 of the published linked image. */
    readonly outputSha256: string;
    /** Source-file replacements included in the conversion candidate. */
    readonly changes: readonly SourceFileChange[];
    /** Content hashes of files that must remain unchanged around publication. */
    readonly snapshots: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
    /** Assembly statements whose includeAsset options will be rewritten. */
    readonly affected: readonly {
        readonly file: string;
        readonly line: number;
        readonly format: string;
    }[];
    /** Old authoring sources kept because their reference closure is incomplete. */
    readonly retained: readonly string[];
    /** Unassembled declarations or symlinks make the old source's complete reference set uncertain. */
    readonly unresolvedDeclarations: readonly string[];
    /** Discovery scope is rechecked before retirement, including newly created unassembled declarations. */
    readonly assemblyInventory: readonly string[];
}
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
    /** Plan and validate a representation switch for the includeAsset under the cursor. */
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