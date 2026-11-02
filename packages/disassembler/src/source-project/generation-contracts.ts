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
  readonly repository: SourceRepository;
  readonly parent: string;
  readonly evidenceDirectory: string;
  readonly romFile: string;
  /** Exact source projection prefix in this project repository, such as disassembly. */
  readonly sourceRoot: string;
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
  readonly generation: SourceGeneration;
  readonly verification: SourceBuildVerification;
  readonly codeBytes: number;
  readonly files: number;
  readonly withdrawnCode: readonly { readonly start: number; readonly end: number }[];
}

/** An unpublished inspection owns the exact input bytes consumed across assembler passes. */
export interface SourceInspection {
  readonly output: Uint8Array;
  readonly mapping: AddressToLineMapping;
  readonly symbols: ReadonlyMap<string, number>;
  readonly snapshots: ReadonlyMap<string, Uint8Array>;
  readonly diagnostics: readonly { readonly message: string }[];
}
