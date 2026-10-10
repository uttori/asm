import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";
import {
  openAnalysisProjectStore,
  openSourceProject,
  sourceGit,
  sourceRepository,
  sourceContentHash,
  retainSourceGeneration,
  createSourceInputSnapshot,
  SOURCE_GENERATION_FILE,
  synchronizeSourceResearch,
  type SourceGenerationFile,
  sourceStatus,
} from "@uttori/asm-disassembler";
import {
  loadNesRom,
  createNesAnalysisProject,
  analyzeNesProject,
  exportNesSource,
  buildNesSource,
  nesGenerationOptionsHash,
} from "@uttori/asm-plugin-65xx/disassembler";

import type { InitializeSourceOptions } from "./source-init.js";

/** Verify a complete cartridge in staging before adding an editable Git project beside original inputs. */
export async function initializeNesSourceProject(options: InitializeSourceOptions) {
  const destination = path.resolve(options.directory);
  // Existing folders may contain originals, but no source/Git project is overwritten.
  const owned = [
    ".git",
    ".gitignore",
    ".uttori",
    ".uttori-local",
    "source",
    ".vscode",
    "README.md",
  ];
  const existed = fs.existsSync(destination);
  if (
    existed &&
    (!fs.lstatSync(destination).isDirectory() ||
      owned.some((name) => fs.existsSync(path.join(destination, name))))
  ) {
    throw new Error(
      "NES initialization requires an unused project folder or a folder containing only original inputs.",
    );
  }
  if (options.mapper || options.dizRawFile)
    throw new Error(
      "NES initialization reads its mapper from iNES and does not import SNES research.",
    );
  const id = options.id ?? path.basename(destination).replaceAll(/[^\w.-]+/g, "-");
  if (!/^[\w.-]+$/.test(id)) {
    throw new Error("Project identity uses letters, digits, dots, underscores and hyphens.");
  }
  const romFile = path.resolve(options.rom);
  options.signal?.throwIfAborted();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const staging = path.join(path.dirname(destination), `.source-init-${randomUUID()}`);
  fs.mkdirSync(staging);
  const write = (name: string, bytes: string | Uint8Array) => {
    const file = path.join(staging, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  };
  const json = (name: string, value: unknown) => write(name, canonicalJson(value));
  try {
    await sourceGit(staging, ["init", "-b", "main"]);
    // Git's configured author and signing/hooks are honored. Do not fabricate a user identity.
    await sourceGit(staging, ["var", "GIT_AUTHOR_IDENT"]);
    write(
      ".gitignore",
      ".DS_Store\n/.uttori-local/\n/.uttori-asm/\n/node_modules/\n/*.NES\n/*.nes\n/*.ram\n",
    );
    fs.mkdirSync(path.join(staging, ".uttori-local"));
    fs.copyFileSync(
      romFile,
      path.join(staging, ".uttori-local/original.nes"),
      fs.constants.COPYFILE_EXCL,
    );
    const localRom = path.join(staging, ".uttori-local/original.nes");
    const evidenceDirectory = path.join(staging, ".uttori-local/evidence");
    createNesAnalysisProject(evidenceDirectory, localRom);
    const { cartridge, rom } = loadNesRom(localRom);
    json(".uttori/project.json", {
      format: "uttori-source-project",
      version: 1,
      id,
      target: "65xx.nes",
      romSha256: rom.identity.contentSha256,
      sourceRoots: ["source"],
      researchRoots: [".uttori/research"],
      buildConfig: "source/uttori-asm.config.json",
      layout: ".uttori/layout.json",
      captures: ".uttori/captures.json",
      limits: options.limits,
    });
    json(".uttori-local/project.json", {
      format: "uttori-source-local",
      version: 1,
      rom: ".uttori-local/original.nes",
      evidence: ".uttori-local/evidence",
    });
    json(".uttori/research/decisions.json", {
      format: "uttori-research",
      version: 1,
      project: id,
      romSha256: rom.identity.contentSha256,
      decisions: [],
    });
    json(".uttori/captures.json", {
      format: "uttori-capture-catalog",
      version: 1,
      romSha256: rom.identity.contentSha256,
      captures: [],
    });
    json(".uttori/layout.json", {
      format: "uttori-nes-layout",
      version: 1,
      romSha256: rom.identity.contentSha256,
      size: cartridge.size,
      states: [],
      extents: [],
    });
    const initial = exportNesSource(cartridge, [], rom.identity.contentSha256);
    for (const file of initial.files) write(`source/${file.path}`, file.bytes);
    const project = await openSourceProject(staging);
    synchronizeSourceResearch(project);
    const analysis = analyzeNesProject({
      projectDirectory: evidenceDirectory,
      romFile: localRom,
      research: project.research,
      maxWorkItems: options.limits?.analysisWorkItems,
      maxCallDepth: options.limits?.analysisCallDepth,
      signal: options.signal,
      onProgress: (event) => options.onProgress?.(event.message),
    });
    const files: SourceGenerationFile[] = [];
    const store = openAnalysisProjectStore(evidenceDirectory);
    let evidenceSha256: string;
    let evidenceManifest: Uint8Array;
    try {
      store.prepareAnnotationQueries();
      evidenceSha256 = store.transaction(() => {
        const view = store.sourceExportView();
        evidenceManifest = Buffer.from(canonicalJson(view.manifest));
        const identity = sourceContentHash(evidenceManifest);
        const exported = exportNesSource(
          cartridge,
          store.analysisByKinds(["cfg-node"]).filter((record) => record.kind === "cfg-node"),
          rom.identity.contentSha256,
        );
        for (const file of exported.files) {
          options.signal?.throwIfAborted();
          const name = `source/${file.path}`;
          write(name, file.bytes);
          files.push({ ...file, path: name });
        }
        return identity;
      }, false);
    } finally {
      store.close();
    }
    const configFile = path.join(staging, "source/uttori-asm.config.json");
    const recipes = ["uttori-asm.config.json"].map((name) => ({
      path: name,
      bytes: fs.readFileSync(path.join(staging, "source", name)),
    }));
    json(".uttori/generation-inputs.json", {
      format: "uttori-nes-generation-inputs",
      version: 1,
      sourceRoot: "source",
      recipes: recipes.map((recipe) => recipe.path),
      pristineAssets: [],
      codeWithdrawals: [],
    });
    const snapshot = createSourceInputSnapshot([
      ...[
        ".uttori/project.json",
        ".uttori/generation-inputs.json",
        ".uttori/captures.json",
        ...project.research.files.map((file) => file.path),
        ...recipes.map((file) => `source/${file.path}`),
      ].map((name) => ({
        path: name,
        bytes: fs.readFileSync(path.join(staging, name)),
      })),
      { path: ".uttori/evidence-snapshot.json", bytes: evidenceManifest! },
    ]);
    write(snapshot.path, snapshot.bytes);
    files.push(snapshot);
    const loaded = await options.loadEnvironment(configFile);
    let verification;
    try {
      options.onProgress?.("Verifying the complete original ROM before creating source history.");
      verification = buildNesSource({
        root: staging,
        entrySource: "source/main.asm",
        environment: loaded.environment,
        includePaths: loaded.includePaths,
        targetOptions: loaded.targetOptions,
        expectedSize: cartridge.size,
        originalContent: cartridge.bytes(),
        outputDirectory: path.join(staging, ".uttori-local/builds"),
        configurationSha256: sourceContentHash(fs.readFileSync(configFile)),
        toolchainSha256: options.toolchainSha256,
        signal: options.signal,
      }).verification;
    } finally {
      await loaded.dispose();
    }
    const repository = await sourceRepository(staging);
    const generation = await retainSourceGeneration(repository, {
      files,
      inputs: {
        project: id,
        romSha256: rom.identity.contentSha256,
        evidenceSha256,
        researchSha256: project.research.hash,
        captureCatalogSha256: sourceContentHash(
          canonicalJson({
            format: "uttori-capture-catalog",
            version: 1,
            romSha256: rom.identity.contentSha256,
            captures: [],
          }),
        ),
        toolchainSha256: options.toolchainSha256,
        optionsSha256: nesGenerationOptionsHash({
          sourceRoot: "source",
          recipes,
          pristineAssets: [],
          codeWithdrawals: [],
        }),
      },
    });
    // Attach the verified pure root to the initialized branch without creating another branch;
    // later source commits must retain this generation in their ancestry.
    await sourceGit(staging, ["update-ref", "HEAD", generation.commit]);
    await sourceGit(staging, ["read-tree", generation.commit]);
    json(SOURCE_GENERATION_FILE, generation.descriptor);
    write(
      "README.md",
      `# ${id}\n\nEdit and commit source and research with Git. Private ROM, evidence and builds live in .uttori-local.\n\nPrepare and preview regeneration while editing. Commit a checkpoint before applying; resolve native Git conflicts, then validate and finish the merge.\n`,
    );
    json(".vscode/tasks.json", {
      version: "2.0.0",
      tasks: [
        {
          label: "Build and Check",
          type: "uttori-source",
          action: "build",
          project: "${workspaceFolder}",
          group: { kind: "build", isDefault: true },
        },
      ],
    });
    await sourceGit(staging, ["add", "--all"]);
    await sourceGit(staging, ["commit", "-m", "Initialize editable source and Git research"]);
    // Hooks may intentionally edit or restage files; they cannot confer the earlier ROM proof on different inputs.
    if (
      (await sourceStatus(repository)).length ||
      files.some(
        (file) =>
          sourceContentHash(fs.readFileSync(path.join(staging, file.path))) !==
          sourceContentHash(file.bytes),
      )
    ) {
      throw new Error(
        "Initialization hooks changed verified source. Review the hook before creating this project.",
      );
    }
    const current = await openSourceProject(staging);
    if (
      current.research.hash !== project.research.hash ||
      current.configurationSha256 !== project.configurationSha256
    ) {
      throw new Error("Initialization inputs changed before publication.");
    }
    await sourceGit(staging, ["update-ref", "-d", generation.ref, generation.commit]);
    options.signal?.throwIfAborted();
    // Publish only new owned entries into an existing originals folder. Roll back just those
    // entries on failure, preserving every original and any concurrently created unrelated file.
    if (!existed) {
      if (fs.existsSync(destination))
        throw new Error("Project destination appeared during initialization.");
      fs.renameSync(staging, destination);
    } else {
      if (owned.some((name) => fs.existsSync(path.join(destination, name))))
        throw new Error("Project files appeared during initialization.");
      const installed: string[] = [];
      try {
        for (const name of owned) {
          fs.renameSync(path.join(staging, name), path.join(destination, name));
          installed.push(name);
        }
      } catch (error) {
        for (const name of installed.toReversed())
          fs.renameSync(path.join(destination, name), path.join(staging, name));
        throw error;
      }
    }
    return {
      directory: destination,
      generation: generation.commit,
      verification,
      analysis: {
        status: analysis.status,
        instructions: analysis.instructions,
        incompleteReasons: analysis.incompleteReasons,
      },
    };
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
