import fs from "node:fs";
import path from "node:path";

import {
  RomImage,
  compareByteImages,
  openAnalysisProjectStore,
  type AnalysisProject,
} from "@uttori/asm-disassembler";
import { sourceContentHash } from "@uttori/asm-disassembler/source-project";
import { loadProjectEnvironment } from "@uttori/asm-plugin-loader-node";
import snesPlugin from "@uttori/asm-plugin-snes";
import {
  exportSnes65816Source,
  inspectSnesSource,
  createSnesAnalysisProject,
  analyzeSnesProject,
  type SnesSourceExportOptions,
  type CreateSnesAnalysisProjectOptions,
} from "@uttori/asm-plugin-snes/disassembler";

/** Test-only sink writes rendered bytes into disposable fixtures; production rendering has no disk writer. */
export function renderSourceFixture(
  project: {
    manifest: AnalysisProject["manifest"];
    shards: AnalysisProject["shards"];
  },
  rom: RomImage,
  directory: string,
  options: Omit<SnesSourceExportOptions, "emitFile"> &
    Pick<Partial<SnesSourceExportOptions>, "emitFile">,
) {
  if (!options.emitFile) {
    fs.mkdirSync(directory, { recursive: true });
    const defaults = {
      "ram-map.json": { format: "uttori-asm-snes-ram-map", schemaVersion: 1, variables: [] },
      "uttori-asm.config.json": {
        plugins: [{ module: "@uttori/asm-plugin-snes", options: { checksumEnabled: false } }],
        target: "snes.sfc",
        architecture: "snes.65816",
        entryPoints: ["main.asm"],
        includePaths: ["./"],
      },
    };
    for (const [name, value] of Object.entries(defaults)) {
      const file = path.join(directory, name);
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(value));
      }
    }
  }
  return exportSnes65816Source({ ...project, manifest: { ...project.manifest } }, rom, directory, {
    ...options,
    emitFile:
      options.emitFile ??
      ((file) => {
        const destination = path.join(directory, file.path);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, file.bytes);
      }),
  });
}

/** Verify renderer fixtures through the same ordinary-source inspection used by Git builds. */
export async function verifyRenderedFixture(options: {
  sourceDirectory: string;
  romFile: string;
  emitDebugMap?: boolean;
}) {
  const root = options.sourceDirectory;
  const configFile = path.join(root, "uttori-asm.config.json");
  const loaded = await loadProjectEnvironment({
    cwd: root,
    configFile,
    bundledPlugins: new Map([["@uttori/asm-plugin-snes", snesPlugin]]),
  });
  try {
    const rom = RomImage.load(options.romFile);
    const inspected = inspectSnesSource({
      root,
      entrySource: "main.asm",
      environment: loaded.environment,
      includePaths: loaded.includePaths,
      targetOptions: loaded.targetOptions,
      expectedSize: rom.length,
      originalContent: rom.read(0, rom.length)!,
    });
    if (inspected.diagnostics.length) {
      throw new Error(JSON.stringify(inspected.diagnostics));
    }
    return { comparison: compareByteImages(rom.read(0, rom.length)!, inspected.output) };
  } finally {
    await loaded.dispose();
  }
}

/** Render the analysis fixture's current evidence snapshot without any publication engine. */
export function renderAnalysisFixture(options: {
  projectDirectory: string;
  sourceDirectory: string;
  romFile: string;
}) {
  const store = openAnalysisProjectStore(options.projectDirectory);
  try {
    store.prepareAnnotationQueries();
    const manifest = store.transaction(() => {
      const view = store.sourceExportView();
      return renderSourceFixture(
        view,
        RomImage.load(options.romFile, { headerSize: view.manifest.rom.headerSize }),
        options.sourceDirectory,
        {
          sourceProjectSha256: sourceContentHash(JSON.stringify(view.manifest)),
          instructionGroups: store.instructionExportGroups(),
        },
      );
    }, false);
    return {
      manifest,
      codeBytes: manifest.spans
        .filter((span) => span.role === "code")
        .reduce((total, span) => total + span.end - span.start, 0),
    };
  } finally {
    store.close();
  }
}

/** Seed disposable analysis and render fixtures for analyzer tests; source creation is tested separately through Git. */
export async function initializeAnalysisFixture(
  options: Omit<CreateSnesAnalysisProjectOptions, "projectDirectory"> & { outputDirectory: string },
) {
  const projectDirectory = path.join(options.outputDirectory, "analysis");
  const project = createSnesAnalysisProject({ ...options, projectDirectory });
  const analysis = analyzeSnesProject({ projectDirectory, romFile: options.romFile });
  const source = renderAnalysisFixture({
    projectDirectory,
    sourceDirectory: options.outputDirectory,
    romFile: options.romFile,
  });
  return {
    project,
    analysis,
    source,
    roundTrip: await verifyRenderedFixture({
      sourceDirectory: options.outputDirectory,
      romFile: options.romFile,
    }),
  };
}
