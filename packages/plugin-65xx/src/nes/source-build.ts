import path from "node:path";

import {
  Assembler,
  NodeAssemblySnapshotProvider,
  createDebugMap,
  type AssemblerEnvironment,
} from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import {
  checkRawBlockConsumption,
  publishSourceBuild,
  sourceBuildCoverage,
  type SourceBuildCoverage,
  assertSourcePath,
  sourceContentHash,
  type SourceBuildVerification,
  type SourceLinkBuild,
  linkSourceAssembly,
  sourceMappingFromLink,
} from "@uttori/asm-disassembler/source-project";

import { NesCartridge } from "./cartridge.js";
import { validateNesMapper } from "./mapper.js";

/** Saved inputs for a fixed-layout cartridge; pristine generations additionally require exact original bytes. */
export interface BuildNesSourceOptions {
  /** Explicit generated-module selection; omitted for existing absolute Asar projects. */
  readonly link?: SourceLinkBuild;
  /** Exact host configuration snapshots, included in saved-input freshness checks. */
  readonly controlInputs?: readonly { readonly path: string; readonly sha256: string }[];
  /** Absolute project root containing the NES sources. */
  readonly root: string;
  /** Entry assembly file assembled for the cartridge. */
  readonly entrySource: string;
  /** Activated assembler environment for this build. */
  readonly environment: AssemblerEnvironment;
  /** Additional include directories replacing configured paths when set. */
  readonly includePaths?: readonly string[];
  /** NES target options forwarded to the assembler session. */
  readonly targetOptions?: Readonly<Record<string, unknown>>;
  /** Original payload blocks let regeneration detect edited bytes that are no longer included. */
  readonly rawBlocks?: {
    readonly directory: string;
    readonly original: Uint8Array;
    readonly blockSize: number;
  };
  /** Exact iNES image size the build must produce. */
  readonly expectedSize: number;
  /** Fixed-layout projects preserve all 16 original header bytes, including mapper and section sizes. */
  readonly expectedHeader?: Uint8Array;
  /** Original cartridge bytes used to detect unincluded edits. */
  readonly originalContent?: Uint8Array;
  /** Directory receiving the published image and debug map. */
  readonly outputDirectory: string;
  /** Fingerprint of the Node toolchain and plugin modules. */
  readonly toolchainSha256: string;
  /** Fingerprint of the project configuration used for this build. */
  readonly configurationSha256: string;
  /** Optional cooperative cancellation. */
  readonly signal?: AbortSignal;
}

/** Matching binary/map publication and the saved dependencies that produced it. */
export interface NesSourceBuild {
  /** Published binary path for this receipt. */
  readonly outputFile: string;
  /** Published debug-map path paired with the binary. */
  readonly debugMapFile: string;
  /** SHA-256 of the exact saved inputs that produced the binary. */
  readonly inputSha256: string;
  /** Optional source-coverage summary recorded with the receipt. */
  readonly coverage?: SourceBuildCoverage;
  /** Saved-input paths and hashes that must stay fresh. */
  readonly inputs: readonly { readonly path: string; readonly sha256: string }[];
  /** Published binary size in bytes. */
  readonly outputSize: number;
  /** Canonical fingerprint of the published debug map. */
  readonly debugMapFingerprint: string;
  /** Byte-identity checks against the original ROM when required. */
  readonly verification: SourceBuildVerification;
  /** Counts of CPU-state and fixed-extent contracts recorded for the build. */
  readonly contracts: { readonly cpuStates: number; readonly fixedExtents: number };
}

/** Assemble a complete iNES image without publication; stale dependencies invalidate the result. */
export function inspectNesSource(
  options: BuildNesSourceOptions & { readonly overlays?: ReadonlyMap<string, Uint8Array | null> },
) {
  options.signal?.throwIfAborted();
  const root = path.resolve(options.root);
  const entry = path.resolve(root, options.entrySource);
  const overlays = new Map<string, Uint8Array | null>();
  for (const [file, bytes] of options.overlays ?? []) {
    assertSourcePath(file);
    overlays.set(path.resolve(root, file), bytes);
  }
  const files = new NodeAssemblySnapshotProvider({ overlays });
  // Bind the selected recipe/configuration bytes before assembly, then retain them in normal freshness checks.
  for (const input of [...(options.controlInputs ?? []), ...(options.link?.dependencies ?? [])]) {
    if (sourceContentHash(files.readFile(input.path)) !== input.sha256) {
      throw new Error(`Source link input changed: ${input.path}`);
    }
  }
  const assembler = new Assembler({
    module: options.link?.module,
    environment: options.environment,
    target: "65xx.nes",
    architecture: "65xx.2a03",
    targetOptions: options.targetOptions,
    collectSourceMetadata: true,
    fileProvider: files,
  });
  try {
    assembler.setIncludePaths([path.dirname(entry), ...(options.includePaths ?? [])]);
    assembler.setCurrentFile(entry);
    assembler.assembleSource(files.readTextFile(entry), entry);
    const linked = options.link
      ? linkSourceAssembly(assembler, options.link, options.signal)
      : undefined;
    const output = linked?.output ?? Uint8Array.from(assembler.getBinaryOutput());
    const cartridge = new NesCartridge(output);
    validateNesMapper(cartridge);
    if (options.expectedHeader && !Buffer.from(cartridge.header()).equals(options.expectedHeader)) {
      throw new Error("NES fixed-layout builds must preserve the original iNES header.");
    }
    if (output.length !== options.expectedSize) {
      throw new Error(
        `NES layout expected ${options.expectedSize} bytes; received ${output.length}.`,
      );
    }
    const mapping = linked ? sourceMappingFromLink(linked, root) : assembler.addressToLineMapping;
    if (options.rawBlocks) {
      const { directory, original, blockSize } = options.rawBlocks;
      if (!Number.isSafeInteger(blockSize) || blockSize < 1 || blockSize > 65536) {
        throw new Error("Invalid raw block size.");
      }
      const blocks = [];
      for (let start = 0; start < original.length; start += blockSize) {
        const file = path.resolve(root, directory, `${start.toString(16).padStart(6, "0")}.bin`);
        if (files.stat(file).exists) {
          blocks.push({
            file,
            original: original.subarray(start, start + blockSize),
            current: files.readFile(file),
          });
        }
      }
      const issues = checkRawBlockConsumption(mapping, blocks);
      if (issues.length) {
        throw new Error(issues.join("\n"));
      }
    }
    for (const [file, bytes] of files.snapshots) {
      mapping.registerDependencySnapshot(file, bytes);
    }
    files.assertUnchanged();
    if (
      options.originalContent &&
      sourceContentHash(output) !== sourceContentHash(options.originalContent)
    ) {
      throw new Error("Pure NES generation does not reproduce the complete original cartridge.");
    }
    options.signal?.throwIfAborted();
    return {
      output,
      mapping,
      snapshots: files.snapshots,
      symbols: new Map(
        linked
          ? linked.symbols.map((symbol) => [symbol.name, symbol.value] as const)
          : [...assembler.labelTable].map(([name, symbol]) => [name, symbol.value] as const),
      ),
      diagnostics: [],
    };
  } finally {
    assembler.dispose();
  }
}

/** Publish immutable matching artifacts, then advance the current-build pointer under one lease. */
export function buildNesSource(options: BuildNesSourceOptions): NesSourceBuild {
  for (const hash of [options.toolchainSha256, options.configurationSha256]) {
    if (!/^[\da-f]{64}$/.test(hash)) {
      throw new Error("NES build requires exact configuration and toolchain hashes.");
    }
  }
  const { output, mapping, snapshots } = inspectNesSource({ ...options, overlays: undefined });
  const inputs = [...snapshots]
    .map(([file, bytes]) => ({
      path: path.relative(options.root, file).split(path.sep).join("/"),
      sha256: sourceContentHash(bytes),
    }))
    .toSorted((a, b) => a.path.localeCompare(b.path));
  const inputSha256 = sourceContentHash(
    canonicalJson({
      inputs,
      ...(options.link
        ? { link: { module: options.link.module, recipe: options.link.recipe } }
        : {}),
      configuration: options.configurationSha256,
      toolchain: options.toolchainSha256,
      expectedSize: options.expectedSize,
      expectedHeader: options.expectedHeader ? [...options.expectedHeader] : null,
      raw: options.rawBlocks ? sourceContentHash(options.rawBlocks.original) : null,
      original: options.originalContent ? sourceContentHash(options.originalContent) : null,
    }),
  );
  const map = createDebugMap({ target: "65xx.nes", output, mapping, sourceRoot: options.root });
  const mapBytes = canonicalJson(map);
  const directory = path.join(options.outputDirectory, inputSha256);
  const outputFile = path.join(directory, "program.nes");
  const debugMapFile = `${outputFile}.debug.json`;
  const result: NesSourceBuild = {
    outputFile,
    debugMapFile,
    inputSha256,
    ...(options.rawBlocks
      ? { coverage: sourceBuildCoverage(mapping, options.root, options.rawBlocks) }
      : {}),
    inputs,
    outputSize: output.length,
    debugMapFingerprint: map.fingerprint.value,
    contracts: { cpuStates: 0, fixedExtents: 0 },
    verification: {
      outputSha256: sourceContentHash(output),
      debugMapSha256: sourceContentHash(mapBytes),
      toolchainSha256: options.toolchainSha256,
      checks: [
        "assembly",
        ...(options.link ? ["object-serialization", "link-placement-and-relocations"] : []),
        ...(options.link && options.originalContent ? ["complete-container-equality"] : []),
        "ines-sections",
        "declared-output-size",
        "input-freshness",
        ...(options.rawBlocks ? ["edited-raw-byte-consumption"] : []),
        ...(options.originalContent ? ["pure-ROM-equality"] : []),
      ],
    },
  };
  return publishSourceBuild({
    directory: options.outputDirectory,
    receipt: result,
    output,
    debugMap: mapBytes,
    signal: options.signal,
  });
}
