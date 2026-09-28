import { type RomIdentity } from "@uttori/asm-disassembler";
import { type OwnedAssetRecipe } from "./modification-assets.js";
import { type VerifySnesProjectRoundTripOptions } from "./project-initializer.js";
import { type SnesMapper } from "./rom-header.js";
/** User-owned manifest, separate from the baseline generated-files.json contract. */
export declare const MODIFICATION_MANIFEST = "modification.json";
/** One manually placed, exact-size replacement. Offsets exclude any copier header. */
export interface RomReplacement {
    /** Also exported as Patch_<id> so separately assembled replacements can reference each other. */
    readonly id: string;
    readonly offset: number;
    /** Hexadecimal original bytes; their decoded length is the exact replacement budget. */
    readonly expected: string;
    /** Relative to the modification directory, under inputs/. Assembly may include other owned inputs. */
    readonly input: string;
    readonly kind: "assembly" | "binary" | "asset";
    /** Asset recipes encode the editable input on every build, then enforce the declared byte budget. */
    readonly asset?: OwnedAssetRecipe;
    /** Explicit padding for short binary/asset encodings; omitted means exact size. */
    readonly fill?: number;
    /** Initial 65816 widths; assembly inputs must declare these even for data-only source. */
    readonly accumulator?: 8 | 16;
    readonly index?: 8 | 16;
}
/** An owned fork of one exact baseline, with optional explicitly filled ROM expansion. */
export interface RomModificationProject {
    readonly format: "uttori-snes-modification";
    readonly schemaVersion: 1;
    readonly baseline: {
        /** Paths resolve relative to this manifest, keeping project relocation possible. */
        readonly sourceDirectory: string;
        readonly romFile: string;
        readonly rom: RomIdentity;
        readonly mapper: SnesMapper;
        readonly manifestSha256: string;
        readonly interfaceSha256: string;
        /** Immutable retained generation for source recovery and three-way rebase. */
        readonly snapshotDirectory?: string;
    };
    /** Checksums remain untouched unless their bytes are explicitly owned by a replacement. */
    readonly checksumPolicy: "preserve";
    readonly replacements: readonly RomReplacement[];
    /** Headerless output size and fill byte; expansion never changes mapper/header/checksum metadata implicitly. */
    readonly expansion?: {
        readonly size: number;
        readonly fill: number;
    };
}
/** Paths and identities of a complete immutable output generation; safe to hand directly to DAP. */
export interface ModifiedRomBuild {
    readonly ok: true;
    readonly outputPath: string;
    readonly finalOutput: string;
    readonly debugMapPath: string;
    readonly outputSha256: string;
    readonly debugMapFingerprint: string;
    readonly outputSize: number;
    readonly bytes: number;
    readonly changedBytes: number;
    readonly outputChanged: boolean;
    readonly debugMapChanged: boolean;
    readonly receiptFile: string;
    readonly target: "snes.sfc";
    readonly architecture: "snes.65816";
}
/** Trusted host loader is used only to verify baseline assets; modifications use bundled SNES assembly. */
export interface ModificationOperationOptions {
    readonly manifestFile: string;
    readonly signal?: AbortSignal;
    readonly loadEnvironment?: VerifySnesProjectRoundTripOptions["loadEnvironment"];
    readonly onProgress?: (message: string) => void;
}
/**
 * Reject ambiguous paths and symlinks instead of allowing inputs to escape their ownership root.
 * @param {string} root Owning modification directory.
 * @param {string} relative Safe project-relative filename.
 * @returns {string} Absolute path with no symlink components below root.
 */
export declare const modificationOwnedPath: (root: string, relative: string) => string;
/**
 * Validate every range and placement before invoking the assembler or writing output.
 * @param {string} manifestFile Modification manifest on disk.
 * @returns {RomModificationProject} Validated contract; malformed input throws.
 */
export declare const loadRomModificationProject: (manifestFile: string) => RomModificationProject;
/**
 * Creates a new owned project only after exact baseline verification; existing directories are preserved.
 * @param {object} options Original ROM, source generation, new destination and trusted loader.
 * @returns {Promise<string>} Newly created manifest filename.
 */
export declare const createRomModificationProject: (options: Omit<ModificationOperationOptions, "manifestFile"> & {
    sourceDirectory: string;
    romFile: string;
    directory: string;
}) => Promise<string>;
/**
 * Scaffold an owned replacement from exact original bytes, optionally encoding a reviewed uint16 value.
 * @param {object} options Reviewed range and optional two-byte value.
 * @returns {string} New owned input filename; existing files are never overwritten.
 */
export declare const addRomReplacement: (options: {
    manifestFile: string;
    id: string;
    offset: number;
    size: number;
    kind: "assembly" | "binary";
    value?: number;
}) => string;
/**
 * Verify the pinned baseline, assemble exact ranges, then atomically publish a pointer to a complete generation.
 * @param {ModificationOperationOptions} options Manifest and cancellation/host services.
 * @returns {Promise<ModifiedRomBuild>} Complete immutable build artifacts. Failure preserves the last successful pointer.
 */
export declare const buildModifiedRom: (options: ModificationOperationOptions) => Promise<ModifiedRomBuild>;
/**
 * Build, then analyze a new ROM-bound workspace. Baseline metadata/captures are deliberately not migrated.
 * @param {object} options Modification inputs and a missing or empty derived workspace.
 * @returns {Promise<object>} Derived workspace and immutable ROM identity.
 */
export declare const deriveModifiedRomProject: (options: ModificationOperationOptions & {
    outputDirectory: string;
}) => Promise<{
    outputDirectory: string;
    romFile: string;
    rom: RomIdentity;
}>;
//# sourceMappingURL=modification-project.d.ts.map