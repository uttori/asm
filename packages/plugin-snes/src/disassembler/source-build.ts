import path from "node:path";

import {
  Assembler,
  parseExpressionNode,
  isReferenceExpressionNode,
  NodeAssemblySnapshotProvider,
  createDebugMap,
  type AssemblerEnvironment,
  type AddressToLineMapping,
} from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import {
  publishSourceBuild,
  assertSourcePath,
  sourceContentHash,
  type SourceBuildVerification,
} from "@uttori/asm-disassembler/source-project";

import {
  checkSnesSourceLayout,
  checkSnesPlacements,
  type SnesPlacementContract,
  type SnesFixedExtent,
  type SnesInstructionStateContract,
  type SnesLayoutDiagnostic,
} from "./rom-layout/check.js";
import { checkSnesCodeFlow } from "./rom-layout/code-flow.js";
import { checkSnesRomExpansion, type SnesRomExpansionPolicy } from "./rom-layout/expansion.js";
import { checkRawBlockConsumption, type RawBlockInput } from "./rom-layout/raw-consumption.js";

/** Build normal editable source. Original-ROM equality is requested only for pure generations. */
export interface BuildSnesSourceOptions {
  readonly root: string;
  readonly entrySource: string;
  readonly environment: AssemblerEnvironment;
  readonly includePaths?: readonly string[];
  readonly targetOptions?: Readonly<Record<string, unknown>>;
  readonly expectedSize: number;
  /** Explicit same-mapper growth; never used to change the identity of a pure generation. */
  readonly expansion?: SnesRomExpansionPolicy;
  readonly states?: readonly SnesInstructionStateContract[];
  readonly extents?: readonly SnesFixedExtent[];
  readonly placements?: SnesPlacementContract;
  /** Exact headerless ROM bytes, supplied only when verifying a pristine generation. */
  readonly originalContent?: Uint8Array;
  /** Original-ROM block directory and immutable bytes for checking edits no longer consumed after regeneration. */
  readonly rawBlocks?: {
    readonly directory: string;
    readonly original: Uint8Array;
    readonly blockSize: number;
  };
  readonly outputDirectory: string;
  readonly toolchainSha256: string;
  /** Hash of the complete saved configuration, including plugin and encoder options. */
  readonly configurationSha256: string;
  readonly signal?: AbortSignal;
}

/** Matching artifacts are published together only after all required checks pass. */
export interface SnesSourceBuild {
  readonly outputFile: string;
  readonly debugMapFile: string;
  readonly inputSha256: string;
  /** Exact consumed saved files, relative to the source root; timestamps and editor events are not input identities. */
  readonly inputs: readonly { readonly path: string; readonly sha256: string }[];
  readonly outputSize: number;
  /** Debugger map identity differs from the SHA-256 of its serialized file. */
  readonly debugMapFingerprint: string;
  readonly verification: SourceBuildVerification;
  /** Counts make a successful build's semantic coverage explicit; empty declarations prove no CPU-state assumptions. */
  readonly contracts: { readonly cpuStates: number; readonly fixedExtents: number };
  /** Successful publication may leave unknown or externally locked cache files for explicit inspection. */
  readonly cacheWarnings?: readonly string[];
}

/** Inspect a prospective source edit without writing files, ROMs or build receipts. */
export interface InspectSnesSourceOptions extends Omit<
  BuildSnesSourceOptions,
  "outputDirectory" | "toolchainSha256" | "configurationSha256"
> {
  /** Repository-relative candidate files. Null hides a retired file; bytes also support not-yet-published resources. */
  readonly overlays?: ReadonlyMap<string, Uint8Array | null>;
  /** Structured names needed by placement services in addition to ordinary labels and extents. */
  readonly resolveSymbols?: readonly string[];
}

/** Unpublished assembly evidence. Layout diagnostics do not make this a successful build. */
export interface SnesSourceInspection {
  readonly output: Uint8Array;
  readonly mapping: AddressToLineMapping;
  readonly symbols: ReadonlyMap<string, number>;
  /** Absolute dependency paths and exact bytes consumed by every assembler pass. */
  readonly snapshots: ReadonlyMap<string, Uint8Array>;
  readonly diagnostics: readonly SnesLayoutDiagnostic[];
}

/** Assemble one immutable input snapshot; return diagnostics for placement previews without publishing output. */
export function inspectSnesSource(options: InspectSnesSourceOptions): SnesSourceInspection {
  options.signal?.throwIfAborted();
  const root = path.resolve(options.root);
  const entrySource = path.resolve(root, options.entrySource);
  const overlays = new Map<string, Uint8Array | null>();
  for (const [name, bytes] of options.overlays ?? []) {
    assertSourcePath(name);
    overlays.set(path.resolve(root, name), bytes);
  }
  const files = new NodeAssemblySnapshotProvider({ overlays });
  const assembler = new Assembler({
    environment: options.environment,
    target: "snes.sfc",
    architecture: "snes.65816",
    targetOptions: options.targetOptions,
    collectSourceMetadata: true,
    fileProvider: files,
  });
  try {
    assembler.setIncludePaths([
      ...new Set([path.dirname(entrySource), ...(options.includePaths ?? [])]),
    ]);
    assembler.setCurrentFile(entrySource);
    const source = files.readTextFile(entrySource);
    const program = assembler.buildProgramModel(source, entrySource, 0);
    assembler.assembleProgram(program);
    options.signal?.throwIfAborted();
    const output = Uint8Array.from(assembler.getBinaryOutput());
    const mapping = assembler.addressToLineMapping;
    const rawBlocks: RawBlockInput[] = [];
    const rawIssues: string[] = [];
    if (options.rawBlocks) {
      const { directory, original, blockSize } = options.rawBlocks;
      if (!Number.isSafeInteger(blockSize) || blockSize <= 0 || blockSize > 65536) {
        throw new Error("Invalid raw block size.");
      }
      for (let start = 0; start < original.length; start += blockSize) {
        const file = path.resolve(root, directory, `${start.toString(16).padStart(6, "0")}.bin`);
        if (files.stat(file).exists) {
          rawBlocks.push({
            file,
            original: original.subarray(start, start + blockSize),
            current: files.readFile(file),
          });
        }
      }
      rawIssues.push(...checkRawBlockConsumption(mapping, rawBlocks));
    }
    for (const [file, bytes] of files.snapshots) {
      mapping.registerDependencySnapshot(file, bytes);
    }
    const symbols = new Map(
      [...assembler.labelTable].map(([name, symbol]) => [name, symbol.value]),
    );
    const requestedSymbols = new Set([
      ...(options.resolveSymbols ?? []),
      ...(options.extents ?? []).flatMap((extent) => [extent.startSymbol, extent.endSymbol]),
      ...(options.placements?.objects ?? []).flatMap((object) => [
        object.startSymbol,
        object.endSymbol,
      ]),
    ]);
    for (const name of requestedSymbols) {
      if (!symbols.has(name)) {
        // dataStructs bases and members use the assembler's structured-reference resolver;
        // they need not be ordinary labels. Missing names remain source-linked extent failures.
        try {
          const reference = parseExpressionNode(name);
          if (isReferenceExpressionNode(reference)) {
            symbols.set(name, assembler.evaluateReferenceExpressionNode(reference));
          }
        } catch {
          /* Report below. */
        }
      }
    }
    const codeFlow = options.placements
      ? checkSnesCodeFlow(output, mapping, options.placements, options.states)
      : { diagnostics: [], states: [] };
    // Propagated leaf-block states prove widths for newly inserted instructions. Explicit interior
    // assumptions remain assertions and cannot override a contradictory predecessor path.
    const provenStates = new Map((options.states ?? []).map((state) => [state.offset, state]));
    for (const state of codeFlow.states) {
      provenStates.set(state.offset, state);
    }
    const diagnostics = checkSnesSourceLayout({
      output,
      mapping,
      expectedSize: options.expectedSize,
      states: [...provenStates.values()],
      extents: options.extents,
      requiredCpuStateRanges: options.placements?.objects
        .filter((object) => object.kind === "code")
        .map((object) => ({ start: object.start, end: object.start + object.length })),
      symbols,
    });
    if (options.expansion && (!options.rawBlocks || options.originalContent)) {
      throw new Error(
        "Expansion requires the immutable original raw-block contract and editable source.",
      );
    }
    if (options.rawBlocks) {
      diagnostics.push(
        ...checkSnesRomExpansion(
          output,
          options.rawBlocks.original,
          options.expectedSize,
          options.expansion,
          options.placements?.objects,
        ),
      );
    }
    diagnostics.push(
      ...codeFlow.diagnostics,
      ...rawIssues.map((message) => ({ code: "raw-consumption" as const, message })),
    );
    if (options.placements) {
      diagnostics.push(...checkSnesPlacements(output, symbols, options.placements));
    }
    for (const [file, bytes] of overlays) {
      // A retired input must no longer be consumed. Reading it already fails in the provider;
      // absence therefore has the opposite success condition from a candidate creation/edit.
      if (bytes !== null && !files.snapshots.has(file)) {
        throw new Error(`Source preview overlay is not consumed by this assembly: ${file}`);
      }
    }
    files.assertUnchanged();
    if (
      options.originalContent &&
      sourceContentHash(options.originalContent) !== sourceContentHash(output)
    ) {
      throw new Error("Pure generation does not reproduce the original ROM exactly.");
    }
    return { output, mapping, symbols, snapshots: files.snapshots, diagnostics };
  } finally {
    assembler.dispose();
  }
}

/**
 * Publish a matching ROM/map pair only after all source and target checks pass. Inspection used
 * by placement previews has no publication path and cannot replace the last successful build.
 */
export function buildSnesSource(options: BuildSnesSourceOptions): SnesSourceBuild {
  options.signal?.throwIfAborted();
  for (const hash of [options.toolchainSha256, options.configurationSha256]) {
    if (!/^[\da-f]{64}$/.test(hash)) {
      throw new Error("Source build needs exact toolchain and configuration identities.");
    }
  }
  const root = path.resolve(options.root);
  const entrySource = path.resolve(root, options.entrySource);
  // JavaScript callers can supply extra properties. Published builds always describe saved files;
  // prospective overlays belong only to the explicit unpublished inspection API.
  const { output, mapping, diagnostics } = inspectSnesSource({
    ...options,
    overlays: undefined,
    resolveSymbols: undefined,
  });
  if (diagnostics.length) {
    throw new Error(
      diagnostics
        .slice(0, 20)
        .map(
          (diagnostic) =>
            `${diagnostic.file ?? entrySource}:${diagnostic.line ?? 1}: ${diagnostic.code}: ${diagnostic.message}`,
        )
        .join("\n"),
    );
  }
  const sources = mapping.fileList
    .map((file) => ({
      path: path.relative(root, file.name).replaceAll(path.sep, "/"),
      sha256: file.sha256,
    }))
    .toSorted((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  const outputSha256 = sourceContentHash(output);
  const inputSha256 = sourceContentHash(
    canonicalJson({
      sources,
      configuration: options.configurationSha256,
      toolchain: options.toolchainSha256,
      layout: {
        expectedSize: options.expectedSize,
        expansion: options.expansion ?? null,
        states: options.states ?? [],
        extents: options.extents ?? [],
        placements: options.placements
          ? { objects: options.placements.objects, references: options.placements.references }
          : null,
      },
      originalContent: options.originalContent ? sourceContentHash(options.originalContent) : null,
      rawBlocks: options.rawBlocks
        ? {
            directory: options.rawBlocks.directory,
            blockSize: options.rawBlocks.blockSize,
            originalSha256: sourceContentHash(options.rawBlocks.original),
          }
        : null,
    }),
  );
  const map = createDebugMap({ target: "snes.sfc", output, mapping, sourceRoot: root });
  const debugMap = canonicalJson(map);
  const verification: SourceBuildVerification = {
    outputSha256,
    debugMapSha256: sourceContentHash(debugMap),
    toolchainSha256: options.toolchainSha256,
    checks: [
      "assembly",
      "emitted-range-overlap",
      "declared-output-size",
      "program-bank-boundaries",
      "input-freshness",
      ...(options.states?.length ? ["declared-cpu-widths"] : []),
      ...(options.extents?.length ? ["declared-fixed-extents"] : []),
      ...(options.placements ? ["declared-placements-and-references"] : []),
      ...(options.expansion ? ["declared-expansion-header-checksum-and-ownership"] : []),
      ...(options.originalContent ? ["pure-ROM-equality"] : []),
      ...(options.rawBlocks ? ["edited-raw-byte-consumption"] : []),
    ],
  };
  // Immutable content-addressed outputs keep the last successful build usable if another fails.
  // Publish the receipt last so a process interrupted between files cannot expose a mixed pair.
  const directory = path.join(options.outputDirectory, inputSha256);
  const outputFile = path.join(directory, "program.sfc");
  const debugMapFile = path.join(directory, "program.sfc.debug.json");
  const result: SnesSourceBuild = {
    outputFile,
    debugMapFile,
    inputSha256,
    inputs: sources,
    outputSize: output.length,
    debugMapFingerprint: map.fingerprint.value,
    verification,
    contracts: {
      cpuStates: options.states?.length ?? 0,
      fixedExtents: options.extents?.length ?? 0,
    },
  };
  return publishSourceBuild({
    directory: options.outputDirectory,
    receipt: result,
    output,
    debugMap: debugMap,
    signal: options.signal,
  });
}
