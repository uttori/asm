import type { AssemblerEnvironment, AddressToLineMapping } from "@uttori/asm-core";

import type {
  SourceGeneration,
  SourceGenerationFile,
  SourceGenerationInputs,
} from "./generation.js";
import type { SourceRepository } from "./git.js";
import type { SourceBuildVerification } from "./merge.js";
/** Original assets come from immutable Git objects or original ROM bytes, never live working files. */
export interface SourceGenerationOptions {
  /** Omission preserves the existing absolute renderer/build path. */
  readonly assembly?: "linked";
  /** Git checkout that owns the generation scratch space and publication lease. */
  readonly repository: SourceRepository;
  /** Parent commit object id the generation tree will extend. */
  readonly parent: string;
  /** Directory holding compact capture evidence referenced by the generation inputs. */
  readonly evidenceDirectory: string;
  /** Repository-relative path to the original ROM file used for pristine checks. */
  readonly romFile: string;
  /** Exact source projection prefix in this project repository, such as disassembly. */
  readonly sourceRoot: string;
  /** Declared generation inputs, including ROM identity and research bindings. */
  readonly inputs: SourceGenerationInputs;
  /** Explicit authoring maps/configuration, already captured by the caller. Paths are source-root relative. */
  readonly recipes: readonly SourceGenerationFile[];
  /** Exact research/configuration/catalog and evidence-manifest bytes retained in generation history. */
  readonly inputFiles: readonly SourceGenerationFile[];
  /** Repository-relative pristine inputs; the complete generation must still rebuild the original ROM. */
  readonly pristineAssets: readonly {
    readonly path: string;
    readonly sha256: string;
    /** Half-open, headerless original-ROM file offsets. This admits new binary inputs without trusting edited working files. */
    readonly romRange?: { readonly start: number; readonly end: number };
    /** Explicit immutable blob for a newly decoded/reviewed original asset; SHA-256 guards its bytes. */
    readonly originalBlob?: string;
  }[];
  /** Git-reviewed exceptions for withdrawing previously emitted code; reasons remain in the input receipt. */
  readonly codeWithdrawals?: readonly {
    readonly start: number;
    readonly end: number;
    readonly reason: string;
  }[];
  /** Checked between assembler passes; aborting rejects with the signal reason. */
  readonly signal?: AbortSignal;
  /** Phase boundaries for the host's responsive progress/timing display; never changes admission checks. */
  readonly onProgress?: (message: string) => void;
  /** Host owns trusted plugin loading and disposal, keeping Node module loading out of the target layer. */
  readonly loadEnvironment: (configuration: string) => Promise<{
    readonly environment: AssemblerEnvironment;
    readonly includePaths: readonly string[];
    readonly targetOptions: Readonly<Record<string, unknown>>;
    dispose(): Promise<void>;
  }>;
}

/** Candidate and exact build proof; temporary source and build folders are reclaimed before returning. */
export interface PreparedSourceGeneration {
  /** Immutable generation payload ready for Git publication. */
  readonly generation: SourceGeneration;
  /** Exact rebuild proof tying the candidate tree back to the original ROM. */
  readonly verification: SourceBuildVerification;
  /** Total reconstructed instruction bytes emitted into the source tree. */
  readonly codeBytes: number;
  /** Count of generated source and asset files in the candidate tree. */
  readonly files: number;
  /** Half-open ROM intervals explicitly withdrawn from emitted code. */
  readonly withdrawnCode: readonly { readonly start: number; readonly end: number }[];
}

/** An unpublished inspection owns the exact input bytes consumed across assembler passes. */
export interface SourceInspection {
  /** Rebuilt ROM image bytes from the unpublished inspection pass. */
  readonly output: Uint8Array;
  /** Linker provenance mapping output placement back to source and assets. */
  readonly mapping: AddressToLineMapping;
  /** Resolved symbol name to output address map from the inspection build. */
  readonly symbols: ReadonlyMap<string, number>;
  /** Exact dependency bytes read during the inspection, keyed by resolved path. */
  readonly snapshots: ReadonlyMap<string, Uint8Array>;
  /** Non-fatal assembler and linker messages collected during inspection. */
  readonly diagnostics: readonly { readonly message: string }[];
}
