import fs from "node:fs";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { openAnalysisProjectStore } from "@uttori/asm-disassembler";
import {
  sourceFilePublicationEpoch,
  readSourceLinkBuild,
  sourceProjectLocalInputs,
  sourceContentHash,
  assertSourcePath,
  readSourceCaptureCatalog,
  type SourceProject,
  type SourceTargetOperation,
  type SourceWorkflowHost,
  type SourceProjectInspection,
  type SourceTargetDescriptor,
  type SourceTargetCaptureOptions,
} from "@uttori/asm-disassembler/source-project";
import {
  loadNesRom,
  type BuildNesSourceOptions,
  buildNesSource,
  inspectNesSource,
  prepareNesGeneration,
  analyzeNesProject,
  importNesPPUCapture,
  nesGenerationOptionsHash,
  initializeNesSourceProject,
} from "@uttori/asm-plugin-65xx/disassembler";
/** Declared target bounds and CPU assumptions are Git inputs; absence never implies proof. */
interface SourceLayout {
  readonly format: "uttori-nes-layout";
  readonly version: 1;
  readonly romSha256: string;
  readonly size: number;
  readonly states: readonly unknown[];
  readonly extents: readonly unknown[];
}

function assertSourceLayout(value: unknown, romSha256: string): asserts value is SourceLayout {
  if (
    typeof value !== "object" ||
    value === null ||
    !("format" in value) ||
    value.format !== "uttori-nes-layout" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("romSha256" in value) ||
    value.romSha256 !== romSha256 ||
    !("size" in value) ||
    typeof value.size !== "number" ||
    !Number.isSafeInteger(value.size) ||
    value.size <= 0 ||
    !("states" in value) ||
    !isUnknownArray(value.states) ||
    !("extents" in value) ||
    !isUnknownArray(value.extents)
  ) {
    throw new Error("Invalid NES source layout contract.");
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isUnknownArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);
const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
/** Read compact contracts with explicit size limits before parsing untrusted workspace JSON. */
function readJson(file: string): unknown {
  if (fs.statSync(file).size > 8 * 1024 * 1024) {
    throw new Error(`Project contract is too large: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Build editable source with a fresh content identity; original-ROM equality belongs to pure generation only. */
async function withSourceBuild<T>(
  project: SourceProject,
  host: SourceWorkflowHost,
  signal: AbortSignal | undefined,
  run: (
    options: BuildNesSourceOptions,
    layout: SourceLayout,
    environmentInputs: ReadonlyMap<string, Uint8Array>,
  ) => T,
): Promise<T> {
  const publicationEpoch = sourceFilePublicationEpoch(project.repository);
  const root = project.repository.root;
  const environmentInputs = new Map<string, Uint8Array>();
  const readEnvironment = (file: string): Uint8Array => {
    const captured = environmentInputs.get(file);
    if (captured) {
      return captured;
    }
    const bytes = Uint8Array.from(fs.readFileSync(file));
    environmentInputs.set(file, bytes);
    return bytes;
  };
  const projectBytes = readEnvironment(path.join(root, ".uttori/project.json"));
  if (
    sourceContentHash(canonicalJson(JSON.parse(Buffer.from(projectBytes).toString("utf8")))) !==
    project.configurationSha256
  ) {
    throw new Error("Source project configuration changed before inspection.");
  }
  const layout: unknown = JSON.parse(
    Buffer.from(readEnvironment(path.join(root, project.configuration.layout))).toString("utf8"),
  );
  assertSourceLayout(layout, project.configuration.romSha256);
  const configFile = path.join(root, project.configuration.buildConfig);
  const configurationBytes = readEnvironment(configFile);
  const configuration: unknown = JSON.parse(Buffer.from(configurationBytes).toString("utf8"));
  const entryPoints =
    isRecord(configuration) && isStringArray(configuration.entryPoints)
      ? configuration.entryPoints
      : undefined;
  if (
    !entryPoints ||
    entryPoints.length !== 1 ||
    !isRecord(configuration) ||
    configuration.baseImage
  ) {
    throw new Error(
      "Source projects require one complete ROM entry point and no base-image patch mode.",
    );
  }
  const entrySource = path
    .relative(root, path.resolve(path.dirname(configFile), entryPoints[0]))
    .split(path.sep)
    .join("/");
  assertSourcePath(entrySource);
  const link = readSourceLinkBuild(
    configuration,
    configFile,
    path.resolve(root, entrySource),
    readEnvironment,
  );
  const raw: unknown = JSON.parse(
    Buffer.from(readEnvironment(path.join(path.dirname(configFile), "source-raw.json"))).toString(
      "utf8",
    ),
  );
  if (
    !isRecord(raw) ||
    raw.format !== "uttori-source-raw" ||
    raw.version !== 1 ||
    raw.blockSize !== 0x1000 ||
    raw.romSha256 !== project.configuration.romSha256
  ) {
    throw new Error("Regenerate the project's stable raw-block contract before building.");
  }
  const originalFile = sourceProjectLocalInputs(project).rom;
  const original = loadNesRom(originalFile).rom;
  if (original.identity.contentSha256 !== project.configuration.romSha256) {
    throw new Error("The local original ROM does not match this source project.");
  }
  {
    const evidence = openAnalysisProjectStore(sourceProjectLocalInputs(project).evidence);
    try {
      // Header bytes select the mapper; a matching payload alone cannot authenticate the original.
      if (evidence.manifest().rom.sha256 !== original.identity.sha256) {
        throw new Error("The local original NES cartridge header or payload changed.");
      }
    } finally {
      evidence.close();
    }
  }
  const loaded = await host.loadEnvironment(configFile);
  try {
    const toolchain = host.fingerprint(
      loaded.configuration.plugins
        .filter((plugin) => !plugin.bundled)
        .map((plugin) => plugin.resolvedModule),
    );
    const result = run(
      {
        root,
        controlInputs: [...environmentInputs].map(([file, bytes]) => ({
          path: file,
          sha256: sourceContentHash(bytes),
        })),
        entrySource,
        ...(link ? { link } : {}),
        environment: loaded.environment,
        includePaths: loaded.includePaths,
        targetOptions: loaded.targetOptions,
        expectedSize: layout.size,
        expectedHeader: original.fileBytes().subarray(0, 16),
        rawBlocks: {
          directory: path.join(path.dirname(project.configuration.buildConfig), "assets/raw"),
          original: original.read(0, original.length)!,
          blockSize: raw.blockSize,
        },
        outputDirectory: path.join(root, ".uttori-local/builds"),
        toolchainSha256: toolchain.sha256,
        configurationSha256: sourceContentHash(
          canonicalJson({
            ...(link ? { link: { module: link.module, recipe: link.recipe } } : {}),
            configuration: sourceContentHash(configurationBytes),
            project: project.configurationSha256,
            layout,
          }),
        ),
        signal,
      },
      layout,
      environmentInputs,
    );
    // Consumers use these exact configuration bytes at publication, rather than a later disk read.
    for (const [file, bytes] of environmentInputs) {
      if (sourceContentHash(fs.readFileSync(file)) !== sourceContentHash(bytes)) {
        throw new Error("Source build environment changed during inspection.");
      }
    }
    if (
      sourceFilePublicationEpoch(project.repository) !== publicationEpoch ||
      sourceContentHash(fs.readFileSync(configFile)) !== sourceContentHash(configurationBytes) ||
      canonicalJson(readJson(path.join(root, project.configuration.layout))) !==
        canonicalJson(layout)
    ) {
      throw new Error(
        "Build configuration or layout changed during source inspection. Retry with the current files.",
      );
    }
    return result;
  } finally {
    await loaded.dispose();
  }
}

/** Inspect current or overlaid source with normal project checks, without publishing build artifacts. */
async function inspectBuiltinProject(
  project: SourceProject,
  host: SourceWorkflowHost,
  overlays?: ReadonlyMap<string, Uint8Array | null>,
  signal?: AbortSignal,
): Promise<SourceProjectInspection> {
  return withSourceBuild(project, host, signal, (options, _layout, environmentInputs) => {
    const inspected = inspectNesSource({ ...options, overlays });
    const snapshots = new Map(inspected.snapshots);
    for (const [file, bytes] of environmentInputs) {
      const before = snapshots.get(file);
      if (before && sourceContentHash(before) !== sourceContentHash(bytes)) {
        throw new Error("Source build consumed different configuration bytes.");
      }
      snapshots.set(file, bytes);
    }
    return {
      ...inspected,
      snapshots,
      root: project.repository.root,
      configurationSha256: options.configurationSha256,
      toolchainSha256: options.toolchainSha256,
    };
  });
}

function graphicsNesProject(project: SourceProject, operation: SourceTargetOperation) {
  const repository = project.repository;
  if (project.configuration.target !== "65xx.nes") {
    throw new Error("Graphics selection currently supports NES source projects.");
  }
  const catalog = readSourceCaptureCatalog(
    repository.root,
    project.configuration.captures,
    project.configuration.romSha256,
  ).catalog;
  const captures = catalog.captures.filter((entry) => entry.profile === "nes-graphics-v1");
  if (!operation.graphicsQuery) {
    return { captures };
  }
  if (!captures.some((entry) => entry.sha256 === operation.graphicsQuery!.captureSha256)) {
    throw new Error("Select a graphics identity from the portable capture catalog.");
  }
  const store = openAnalysisProjectStore(sourceProjectLocalInputs(project).evidence);
  try {
    const rows = store.graphicsEvidence({
      ...operation.graphicsQuery,
      architecture: "65xx.2a03",
      addressSpace: "nes.cpu",
    });
    return {
      capture: captures.find((entry) => entry.sha256 === operation.graphicsQuery!.captureSha256),
      rows,
      limit: operation.graphicsQuery.limit ?? 500,
      relation:
        "Same physical PRG code observed in CPU evidence; counts are independent, not temporal event matches.",
    };
  } finally {
    store.close();
  }
}

/** Authenticate the complete cartridge identity before importing any target-specific evidence. */
async function importNesGraphics(options: SourceTargetCaptureOptions) {
  const { project } = options;
  const local = sourceProjectLocalInputs(project);
  const { rom } = loadNesRom(local.rom);
  if (rom.identity.contentSha256 !== project.configuration.romSha256) {
    throw new Error("Original NES evidence changed.");
  }
  const store = openAnalysisProjectStore(local.evidence);
  try {
    if (store.manifest().rom.sha256 !== rom.identity.sha256) {
      throw new Error("Original NES cartridge identity changed.");
    }
  } finally {
    store.close();
  }
  return importNesPPUCapture({
    ...options,
    file: options.capture,
    evidenceDirectory: local.evidence,
    directory: path.join(project.repository.root, ".uttori-local", "graphics", "reports"),
    romFileSha256: rom.identity.sha256,
    romContentSha256: rom.identity.contentSha256,
  });
}
/** NES cartridge authentication and graphics capture policy, installed by executable hosts. */
export const nesSourceTarget: SourceTargetDescriptor = {
  id: "65xx.nes",
  recipeFormat: "uttori-nes-generation-inputs",
  matchesRom: (prefix) => Buffer.from(prefix).equals(Buffer.from([0x4e, 0x45, 0x53, 0x1a])),
  initialize: initializeNesSourceProject,
  build: (project, host, signal) => withSourceBuild(project, host, signal, buildNesSource),
  inspect: inspectBuiltinProject,
  generationOptionsHash: nesGenerationOptionsHash,
  prepare: prepareNesGeneration,
  analyze: analyzeNesProject,
  graphics: graphicsNesProject,
  importPrimary: importNesGraphics,
  companionArchive: "graphics.act2",
};
