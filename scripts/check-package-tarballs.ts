import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runInNewContext } from "node:vm";

import { buildSync } from "esbuild";

import {
  declaredArchiveClosure,
  writePackageExportProbe,
  type PackageArchiveNode,
  type PackageConsumerExports,
} from "./package-consumers.js";

/** npm's inventory of an actual archive, after its prepack lifecycle completes. */
interface PackedArchive {
  readonly name: string;
  readonly filename: string;
  readonly files: ReadonlyArray<{ readonly path: string }>;
}

/** Package fields needed to verify its published runtime contract. */
interface PackageManifest {
  readonly name: string;
  readonly version: string;
  readonly private?: boolean;
  readonly repository?: { readonly type: string; readonly url: string; readonly directory: string };
  readonly homepage?: string;
  readonly bugs?: { readonly url: string };
  readonly keywords?: readonly string[];
  readonly license?: string;
  readonly engines?: { readonly node?: string };
  readonly publishConfig?: { readonly access?: string };
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly exports: Readonly<Record<string, string | Readonly<Partial<Record<string, string>>>>>;
  readonly bin?: Readonly<Record<string, string>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function readStringMap(value: unknown, label: string): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const entries: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      throw new Error(`${label}.${key} must be a string.`);
    }
    entries[key] = entry;
  }
  return entries;
}

function readExportTarget(value: unknown): string | Readonly<Partial<Record<string, string>>> {
  if (typeof value === "string") {
    return value;
  }
  const target = readStringMap(value, "export target");
  if (!target) {
    throw new Error("Package export target must be a string or condition map.");
  }
  return target;
}

function isPackageIdentity(
  value: unknown,
): value is Pick<PackageManifest, "name" | "version" | "dependencies"> {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.version === "string" &&
    (value.dependencies === undefined || isRecord(value.dependencies))
  );
}

function readPackageIdentity(
  value: unknown,
): Pick<PackageManifest, "name" | "version" | "dependencies"> {
  if (!isPackageIdentity(value)) {
    throw new Error("Installed package manifest is missing its name or version.");
  }
  const dependencies = readStringMap(value.dependencies, "dependencies");
  return {
    name: value.name,
    version: value.version,
    ...(dependencies === undefined ? {} : { dependencies }),
  };
}

function readPackageManifest(value: unknown): PackageManifest {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    typeof value.version !== "string" ||
    !isRecord(value.exports)
  ) {
    throw new Error("Package manifest is missing its name, version, or exports.");
  }
  const exportsMap: Record<string, string | Readonly<Partial<Record<string, string>>>> = {};
  for (const [key, entry] of Object.entries(value.exports)) {
    exportsMap[key] = readExportTarget(entry);
  }
  const manifest: PackageManifest = {
    name: value.name,
    version: value.version,
    exports: exportsMap,
  };
  if (value.private !== undefined) {
    if (typeof value.private !== "boolean") {
      throw new Error("Package private flag must be a boolean.");
    }
    return {
      ...manifest,
      private: value.private,
      ...optionalManifestFields(value),
    };
  }
  return { ...manifest, ...optionalManifestFields(value) };
}

function optionalManifestFields(value: Record<string, unknown>): {
  homepage?: string;
  license?: string;
  keywords?: string[];
  repository?: { type: string; url: string; directory: string };
  bugs?: { url: string };
  engines?: { node?: string };
  publishConfig?: { access?: string };
  dependencies?: Record<string, string>;
  bin?: Record<string, string>;
} {
  const fields: {
    homepage?: string;
    license?: string;
    keywords?: string[];
    repository?: { type: string; url: string; directory: string };
    bugs?: { url: string };
    engines?: { node?: string };
    publishConfig?: { access?: string };
    dependencies?: Record<string, string>;
    bin?: Record<string, string>;
  } = {};
  if (value.homepage !== undefined) {
    if (typeof value.homepage !== "string") {
      throw new Error("Package homepage must be a string.");
    }
    fields.homepage = value.homepage;
  }
  if (value.license !== undefined) {
    if (typeof value.license !== "string") {
      throw new Error("Package license must be a string.");
    }
    fields.license = value.license;
  }
  if (value.keywords !== undefined) {
    if (
      !Array.isArray(value.keywords) ||
      !value.keywords.every((entry) => typeof entry === "string")
    ) {
      throw new Error("Package keywords must be strings.");
    }
    fields.keywords = value.keywords.filter((entry): entry is string => typeof entry === "string");
  }
  if (value.repository !== undefined) {
    if (
      !isRecord(value.repository) ||
      typeof value.repository.type !== "string" ||
      typeof value.repository.url !== "string" ||
      typeof value.repository.directory !== "string"
    ) {
      throw new Error("Package repository must identify a git directory.");
    }
    fields.repository = {
      type: value.repository.type,
      url: value.repository.url,
      directory: value.repository.directory,
    };
  }
  if (value.bugs !== undefined) {
    if (!isRecord(value.bugs) || typeof value.bugs.url !== "string") {
      throw new Error("Package bugs.url must be a string.");
    }
    fields.bugs = { url: value.bugs.url };
  }
  if (value.engines !== undefined) {
    if (
      !isRecord(value.engines) ||
      (value.engines.node !== undefined && typeof value.engines.node !== "string")
    ) {
      throw new Error("Package engines.node must be a string.");
    }
    fields.engines = typeof value.engines.node === "string" ? { node: value.engines.node } : {};
  }
  if (value.publishConfig !== undefined) {
    if (
      !isRecord(value.publishConfig) ||
      (value.publishConfig.access !== undefined && typeof value.publishConfig.access !== "string")
    ) {
      throw new Error("Package publishConfig.access must be a string.");
    }
    fields.publishConfig =
      typeof value.publishConfig.access === "string" ? { access: value.publishConfig.access } : {};
  }
  const dependencies = readStringMap(value.dependencies, "dependencies");
  if (dependencies) {
    fields.dependencies = dependencies;
  }
  const bin = readStringMap(value.bin, "bin");
  if (bin) {
    fields.bin = bin;
  }
  return fields;
}

function readPackedArchive(value: unknown): PackedArchive {
  assert.ok(isRecord(value), "Expected one npm archive.");
  assert.equal(typeof value.name, "string");
  assert.equal(typeof value.filename, "string");
  assert.ok(Array.isArray(value.files));
  if (
    typeof value.name !== "string" ||
    typeof value.filename !== "string" ||
    !Array.isArray(value.files)
  ) {
    throw new Error("Expected one npm archive.");
  }
  return {
    name: value.name,
    filename: value.filename,
    files: value.files.map((file: unknown) => {
      assert.ok(isRecord(file) && typeof file.path === "string");
      if (!isRecord(file) || typeof file.path !== "string") {
        throw new Error("Expected archive file path.");
      }
      return { path: file.path };
    }),
  };
}

const root = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-package-check-"));

// Development conditions/loaders can hide a broken package. Consumers use ordinary Node
// resolution. A private empty npm cache makes installation independent of registry state.
const consumerEnvironment = { ...process.env };
delete consumerEnvironment.NODE_OPTIONS;
delete consumerEnvironment.NODE_PATH;
consumerEnvironment.npm_config_cache = path.join(scratch, "cache");

/**
 * Runs a bounded child without a shell, retaining diagnostics on failure.
 * @param executable Program to launch.
 * @param args Literal argument vector.
 * @param cwd Working directory.
 * @returns Successful UTF-8 stdout.
 */
const run = (executable: string, args: string[], cwd: string): string => {
  const result = spawnSync(executable, args, {
    cwd,
    env: consumerEnvironment,
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${executable} ${args.join(" ")} failed:\n${result.stderr}\n${result.stdout}`, {
      cause: result.error,
    });
  }
  return result.stdout;
};

function assertDistExport(
  destination: string | undefined,
  message: string,
): asserts destination is string {
  assert.ok(destination?.startsWith("./dist/"), message);
}

/**
 * Uses npm's JS entry point so Windows does not need a shell to execute npm.cmd.
 * @param args npm arguments.
 * @param cwd Working directory.
 * @returns npm stdout.
 */
const npm = (args: string[], cwd: string): string => {
  const executable = process.env.npm_execpath;
  assert.ok(executable, "Run this check through npm run pack:check.");
  return run(process.execPath, [executable, ...args], cwd);
};

/**
 * Resolve from the declaring package so nested dependency versions match the installed tree.
 * @param dependency External package name.
 * @param from Directory of the declaring package.
 * @returns Absolute manifest path for the resolved package.
 */
const dependencyManifest = (dependency: string, from: string): string => {
  let directory = from;
  for (;;) {
    const manifestPath = path.join(directory, "node_modules", dependency, "package.json");
    if (fs.existsSync(manifestPath)) {
      const parsedManifest: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const manifest = readPackageIdentity(parsedManifest);
      if (manifest.name === dependency) {
        return manifestPath;
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error(`Could not locate installed package '${dependency}'.`);
    }
    directory = parent;
  }
};

/**
 * Packs a directory and validates npm's generated archive name and inventory.
 * @param directory Package root.
 * @param lifecycle Whether to run this package's build hooks.
 * @returns Inventory of the archive written into the temporary directory.
 */
const pack = (directory: string, lifecycle: boolean): PackedArchive => {
  const args = ["pack", "--json", "--pack-destination", scratch];
  if (!lifecycle) {
    args.push("--ignore-scripts");
  }
  const output = npm(args, directory);
  // npm forwards prepack compiler stdout before its final JSON array. Keep the real lifecycle
  // enabled, but parse only npm's terminal inventory rather than treating build logs as JSON.
  const inventoryStart = output.lastIndexOf("\n[");
  const parsed: unknown = JSON.parse(
    inventoryStart < 0 ? output : output.slice(inventoryStart + 1),
  );
  assert.ok(Array.isArray(parsed) && parsed.length === 1, "Expected one npm archive.");
  const archive = readPackedArchive(parsed[0]);
  assert.equal(path.basename(archive.filename), archive.filename);
  return archive;
};

try {
  const workspaces = fs.readdirSync(path.join(root, "packages")).flatMap((name) => {
    const directory = path.join(root, "packages", name);
    const manifestPath = path.join(directory, "package.json");
    if (!fs.existsSync(manifestPath)) {
      return [];
    }
    const parsedManifest: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    // Private tooling/extension workspaces need not expose a published runtime API.
    if (isRecord(parsedManifest) && parsedManifest.private === true) {
      return [];
    }
    const manifest = readPackageManifest(parsedManifest);
    return manifest.private ? [] : [{ directory, manifest }];
  });
  const names = new Set(workspaces.map(({ manifest }) => manifest.name));
  const archives: string[] = [];
  const externalDependencies: Array<{ dependency: string; from: string }> = [];
  const packageArchives = new Map<string, PackageArchiveNode>();
  const packageExports = new Map<string, PackageConsumerExports>();
  /** Resolve external versions from the declaring package, not from the repository root. */
  const dependencyIdentity = (dependency: string, from: string): string => {
    if (names.has(dependency)) {
      return dependency;
    }
    const value: unknown = JSON.parse(
      fs.readFileSync(dependencyManifest(dependency, from), "utf8"),
    );
    const manifest = readPackageIdentity(value);
    return `${manifest.name}@${manifest.version}`;
  };
  const imports: string[] = [];
  const commonJsImports: string[] = [];
  for (const { directory, manifest } of workspaces) {
    const archive = pack(directory, true);
    const ownImports: string[] = [];
    const ownCommonJsImports: string[] = [];
    const jsonImports: string[] = [];
    const files = new Set(archive.files.map((file) => file.path));
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      const specifier = manifest.name + subpath.slice(1);
      if (typeof target === "string") {
        assert.ok(files.has(target.replace(/^\.\//, "")), `${specifier}: missing ${target}`);
        if (target.endsWith(".json")) {
          jsonImports.push(specifier);
        } else if (target.endsWith(".js") || target.endsWith(".mjs")) {
          ownImports.push(specifier);
        }
        continue;
      }
      // The maintainer-only source condition is opt-in. Normal runtime and type conditions must
      // point to shipped dist files, never to workspace TypeScript that needs a loader.
      for (const condition of ["types", "import", "require"] as const) {
        const destination: string | undefined = target[condition];
        if (condition === "require" && !destination) {
          continue;
        }
        // The CLI's public runtime is self-contained so private game composition never becomes a public dependency.
        const bundledCli =
          manifest.name === "@uttori/asm-cli" &&
          specifier === manifest.name &&
          condition === "import";
        if (bundledCli) {
          assert.equal(destination, "./out/cli.mjs");
        } else {
          assertDistExport(destination, `${specifier}: invalid ${condition} export`);
        }
        assert.ok(destination);
        let extension = ".js";
        if (condition === "types") {
          extension = ".d.ts";
        } else if (bundledCli) {
          extension = ".mjs";
        }
        assert.ok(
          destination.endsWith(extension),
          `${specifier}: ${condition} is not ${extension}`,
        );
        assert.ok(files.has(destination.slice(2)), `${specifier}: missing ${destination}`);
      }
      imports.push(specifier);
      ownImports.push(specifier);
      if (target.require) {
        commonJsImports.push(specifier);
        ownCommonJsImports.push(specifier);
      }
    }
    for (const binary of Object.values(manifest.bin ?? {})) {
      assert.ok(files.has(binary), `${manifest.name}: missing executable ${binary}`);
      assert.ok(files.has(`${binary}.licenses.txt`), `${manifest.name}: missing bundle notices`);
    }
    for (const file of files) {
      assert.ok(
        !/(?:^|\/)(?:fixtures|local only|node_modules)(?:\/|$)|\.(?:sfc|smc|nes)$/i.test(file),
        `${manifest.name}: forbidden payload ${file}`,
      );
    }
    assert.ok(files.has("README.md"), `${manifest.name}: missing published README`);
    assert.ok(files.has("LICENSE"), `${manifest.name}: missing published license`);
    assert.equal(manifest.license, "MIT");
    assert.equal(manifest.engines?.node, ">=26");
    assert.deepEqual(manifest.repository, {
      type: "git",
      url: "https://github.com/uttori/asm.git",
      directory: `packages/${path.basename(directory)}`,
    });
    assert.equal(manifest.bugs?.url, "https://github.com/uttori/asm/issues");
    assert.equal(
      manifest.homepage,
      `https://github.com/uttori/asm/tree/master/packages/${path.basename(directory)}#readme`,
    );
    assert.ok(manifest.keywords?.length);
    assert.equal(manifest.publishConfig?.access, "public");
    // Package-root guides are part of the installed documentation, not just repository links.
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        assert.ok(files.has(entry.name), `${manifest.name}: missing published guide ${entry.name}`);
      }
    }
    if (manifest.name === "@uttori/asm-plugin-65xx") {
      assert.ok(files.has("THIRD_PARTY_NOTICES.md"));
    }
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (!names.has(dependency)) {
        externalDependencies.push({ dependency, from: directory });
      }
    }
    const archivePath = path.join(scratch, archive.filename);
    archives.push(archivePath);
    packageArchives.set(manifest.name, {
      archive: archivePath,
      dependencies: Object.keys(manifest.dependencies ?? {}).map((name) =>
        dependencyIdentity(name, directory),
      ),
    });
    packageExports.set(manifest.name, {
      imports: ownImports,
      commonJsImports: ownCommonJsImports,
      jsonImports,
    });
    console.log(`${manifest.name}: ${files.size} files, compiled exports and executables present`);
  }

  // Stage installed third-party dependencies too. No workspace link, cached unpublished package,
  // or network fetch can rescue this installation. Set iteration includes discovered transitives.
  const stagedDependencies = new Set<string>();
  for (const { dependency, from } of externalDependencies) {
    const manifestPath = dependencyManifest(dependency, from);
    const parsedDependency: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const manifest = readPackageIdentity(parsedDependency);
    const identity = `${manifest.name}@${manifest.version}`;
    if (stagedDependencies.has(identity)) {
      continue;
    }
    stagedDependencies.add(identity);
    const archive = pack(path.dirname(manifestPath), false);
    const archivePath = path.join(scratch, archive.filename);
    archives.push(archivePath);
    packageArchives.set(identity, {
      archive: archivePath,
      dependencies: Object.keys(manifest.dependencies ?? {}).map((name) =>
        dependencyIdentity(name, path.dirname(manifestPath)),
      ),
    });
    for (const transitive of Object.keys(manifest.dependencies ?? {})) {
      if (!names.has(transitive)) {
        externalDependencies.push({ dependency: transitive, from: path.dirname(manifestPath) });
      }
    }
  }

  for (const { manifest } of workspaces) {
    const consumer = path.join(scratch, "isolated", manifest.name);
    fs.mkdirSync(consumer, { recursive: true });
    fs.writeFileSync(path.join(consumer, "package.json"), '{"private":true,"type":"module"}\n');
    npm(
      [
        "install",
        "--offline",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=false",
        ...declaredArchiveClosure([manifest.name], packageArchives),
      ],
      consumer,
    );
    const exports = packageExports.get(manifest.name);
    assert.ok(exports);
    run(process.execPath, [writePackageExportProbe(consumer, exports)], consumer);
    // TypeScript itself and Node ambient types are test tools, never package-resolution fallbacks.
    fs.writeFileSync(
      path.join(consumer, "public-api.mts"),
      exports.imports
        .map(
          (name, index) =>
            `import * as api${index} from ${JSON.stringify(name)};\nvoid api${index};`,
        )
        .join("\n"),
    );
    fs.writeFileSync(
      path.join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2024",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          types: ["node"],
          typeRoots: [path.join(root, "node_modules", "@types")],
        },
        files: ["public-api.mts"],
      }),
    );
    run(
      process.execPath,
      [path.join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"],
      consumer,
    );
    console.log(
      `${manifest.name}: isolated declared dependencies, runtime exports and types passed`,
    );
  }

  // Compile the guide's exact source in a consumer containing only its declared dependency closure.
  // Test tooling uses absolute paths; TypeScript package resolution cannot fall back to this repository.
  const example = path.join(scratch, "plugin-author");
  fs.mkdirSync(example);
  const exampleRoot = path.join(root, "packages/plugin-author");
  for (const file of ["package.json", "main.asm", "uttori-asm.config.json", "src"]) {
    fs.cpSync(path.join(exampleRoot, file), path.join(example, file), { recursive: true });
  }
  const exampleManifest: unknown = JSON.parse(
    fs.readFileSync(path.join(example, "package.json"), "utf8"),
  );
  assert.ok(isRecord(exampleManifest));
  const exampleDependencies = readStringMap(exampleManifest.dependencies, "example dependencies");
  npm(
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      ...declaredArchiveClosure(Object.keys(exampleDependencies ?? {}), packageArchives),
    ],
    example,
  );
  fs.copyFileSync(
    path.join(root, "tests/package-consumer/plugin-author.mts"),
    path.join(example, "plugin-author.mts"),
  );
  fs.writeFileSync(
    path.join(example, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2024",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        rootDir: ".",
        outDir: "compiled",
        types: ["node"],
        typeRoots: [path.join(root, "node_modules/@types")],
      },
      include: ["src/index.ts", "plugin-author.mts"],
    }),
  );
  run(
    process.execPath,
    [path.join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"],
    example,
  );
  console.log(run(process.execPath, ["compiled/plugin-author.mjs"], example).trim());

  // Private game integration is supplied only to the aggregate project fixture. Isolated public consumers
  // above must continue to succeed with their declared public dependency closures alone.
  const gameArchive = pack(path.join(root, "packages/game-secret-of-mana"), true);
  const consumer = path.join(scratch, "consumer");
  fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer, "package.json"), '{"private":true,"type":"module"}\n');
  npm(
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      ...archives,
      path.join(scratch, gameArchive.filename),
    ],
    consumer,
  );
  for (const { directory, manifest } of workspaces) {
    const name = manifest.name;
    assert.equal(fs.lstatSync(path.join(consumer, "node_modules", name)).isSymbolicLink(), false);
    assert.equal(
      fs.readFileSync(path.join(consumer, "node_modules", name, "LICENSE"), "utf8"),
      fs.readFileSync(path.join(root, "LICENSE"), "utf8"),
    );
    // Verify the archive preserves the reviewed guides and exact legal notices, not just filenames.
    const documents = fs.readdirSync(directory).filter((file) => file.endsWith(".md"));
    const notices = Object.values(manifest.bin ?? {}).map((binary) => `${binary}.licenses.txt`);
    for (const file of [...documents, ...notices]) {
      assert.equal(
        fs.readFileSync(path.join(consumer, "node_modules", name, file), "utf8"),
        fs.readFileSync(path.join(directory, file), "utf8"),
        `${name}: altered published document ${file}`,
      );
    }
  }
  fs.writeFileSync(
    path.join(consumer, "exports.json"),
    JSON.stringify({ imports, commonJsImports }),
  );
  fs.cpSync(path.join(root, "tests", "package-consumer"), consumer, { recursive: true });
  // Run the published how-to verbatim so copyable documentation cannot drift from installed APIs.
  const guide = fs.readFileSync(path.join(root, "packages/disassembler/PROJECTS.md"), "utf8");
  const examples = [...guide.matchAll(/```js\n([\S\s]*?)\n```/g)];
  assert.equal(examples.length, 1, "Expected one complete analysis workflow example.");
  fs.writeFileSync(path.join(consumer, "analysis-workflow.mjs"), examples[0][1]);
  const traceGuide = fs.readFileSync(path.join(root, "packages/disassembler/TRACES.md"), "utf8");
  const traceExamples = [...traceGuide.matchAll(/```js\n([\S\s]*?)\n```/g)];
  assert.equal(traceExamples.length, 1, "Expected one complete trace import example.");
  fs.writeFileSync(path.join(consumer, "import-trace.mjs"), traceExamples[0][1]);
  for (const fixture of [
    "ca65-v2.19-nmos-differential.json",
    "ca65-e11fb5c-cmos-vendor-differential.json",
    "ca65-e11fb5c-huc6280-m740-differential.json",
  ]) {
    fs.copyFileSync(
      path.join(root, "packages/plugin-65xx/tests/fixtures", fixture),
      path.join(consumer, fixture),
    );
  }
  console.log(run(process.execPath, ["consumer.mjs"], consumer).trim());

  // Compiler/Node types are test tooling. Package declarations resolve only from installed archives,
  // without our source conditions or tsconfig paths. Check every advertised typed subpath.
  fs.writeFileSync(
    path.join(consumer, "public-api.mts"),
    imports
      .map(
        (specifier, index) =>
          `import * as api${index} from ${JSON.stringify(specifier)};\nvoid api${index};`,
      )
      .join("\n"),
  );
  fs.writeFileSync(
    path.join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2024",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        outDir: "compiled",
        types: ["node"],
        typeRoots: [path.join(root, "node_modules", "@types")],
      },
      include: [
        "public-api.mts",
        "contract-plugin.mts",
        "contracts.mts",
        "storage.mts",
        "cli.mts",
        "asset-interchange.mts",
        "processors.mts",
        "traces.mts",
      ],
    }),
  );
  run(
    process.execPath,
    [path.join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"],
    consumer,
  );
  // Compile from installed archives with browser conditions, then execute without Node globals.
  fs.writeFileSync(
    path.join(consumer, "portable-types.mts"),
    `
import type { ArchitectureEncoder, ArchitectureEncoderContext, ParsedInstructionOperands,
  ParsedOperand, InstructionResolutionFrame, OperandResolutionContext, ArchitectureDecodeContext,
  ArchitectureDecodeResult, ArchitectureDecoder, ArchitectureInstructionSpecification,
  DecodedInstruction, DecodedOperand, DecodedReference, InstructionFlow } from "@uttori/asm-core";
import snes from "@uttori/asm-plugin-snes";
void snes;
`,
  );
  fs.writeFileSync(
    path.join(consumer, "tsconfig.browser.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        customConditions: ["browser"],
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: ["node"],
        typeRoots: [path.join(root, "node_modules/@types")],
      },
      files: ["portable-types.mts"],
    }),
  );
  run(
    process.execPath,
    [path.join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.browser.json"],
    consumer,
  );
  const portable = buildSync({
    stdin: {
      resolveDir: consumer,
      sourcefile: "portable-consumer.js",
      contents: `
    import {Assembler,MemoryAssemblyFileProvider,PluginManager} from "@uttori/asm-core";
    import snes from "@uttori/asm-plugin-snes";
    globalThis.portableResult=(async()=>{
      const manager=new PluginManager();await manager.activatePlugins([{plugin:snes}]);
      const assembler=new Assembler({environment:manager.freeze(),target:"snes.sfc",fileProvider:new MemoryAssemblyFileProvider({})});
      try {const program=assembler.buildProgramModel("lorom\\norg $808000\\nMain: db 2 * (3 + 4)\\ncheck bankcross off\\ndb (5+1)\\nfunction twice(x) = x*2\\nmacro Emit(x)\\ndb twice(<x>)\\nendmacro\\n%Emit(4)","main.asm");assembler.assembleProgram(JSON.parse(JSON.stringify(program)));return JSON.stringify([...assembler.getBinaryOutput()]);}
      finally {assembler.dispose();await manager.dispose();}
    })();
  `,
    },
    platform: "browser",
    conditions: ["browser"],
    bundle: true,
    write: false,
    format: "esm",
    logLevel: "silent",
  });
  const context = {
    portableResult: undefined as Promise<string> | undefined,
    TextEncoder,
    TextDecoder,
    structuredClone,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    Int8Array,
    Int16Array,
    Int32Array,
    ArrayBuffer,
    DataView,
  };
  await runInNewContext(`(async () => { ${portable.outputFiles[0].text} })()`, context);
  assert.equal(await context.portableResult, "[14,6,8]");
  console.log("Installed portable browser conditions assemble without Node globals.");
  console.log(run(process.execPath, ["compiled/contracts.mjs"], consumer).trim());
  console.log(run(process.execPath, ["compiled/storage.mjs"], consumer).trim());
  console.log(run(process.execPath, ["compiled/cli.mjs"], consumer).trim());
  console.log(run(process.execPath, ["compiled/asset-interchange.mjs"], consumer).trim());
  console.log(run(process.execPath, ["compiled/processors.mjs"], consumer).trim());
  console.log(run(process.execPath, ["compiled/traces.mjs"], consumer).trim());
  // Declaration comments are part of the installed editor experience, not just source docs.
  for (const [file, contract] of [
    ["@uttori/asm-core/dist/plugin/contracts.d.ts", "Copy all mutable descendants"],
    ["@uttori/asm-core/dist/plugin/manager.d.ts", "Each plugin commits independently"],
    ["@uttori/asm-plugin-loader-node/dist/loader.d.ts", "Serialize load/dispose calls"],
    ["@uttori/asm-plugin-loader-node/dist/types.d.ts", "Shallow merge:"],
    ["@uttori/asm-disassembler/dist/storage/sqlite-store.d.ts", "Run a synchronous unit"],
    ["@uttori/asm-disassembler/dist/model/project-types.d.ts", "Never publish"],
    ["@uttori/asm-disassembler/dist/project/project-transaction.d.ts", "Each supplied array"],
    ["@uttori/asm-cli/dist/index.d.ts", "No AbortSignal or signal handlers"],
    ["@uttori/asm-disassembler/dist/project/runtime-trace-project.d.ts", "A pointer-file error"],
    ["@uttori/asm-disassembler/dist/runtime/runtime-trace-file.d.ts", "2 GiB"],
    ["@uttori/asm-debug-adapter/dist/sidecar-client.d.ts", "Starts when queued"],
  ]) {
    assert.ok(
      fs.readFileSync(path.join(consumer, "node_modules", file), "utf8").includes(contract),
      `${file}: missing public contract JSDoc`,
    );
  }
  for (const { manifest } of workspaces) {
    for (const [name, binary] of Object.entries(manifest.bin ?? {})) {
      assert.match(
        run(
          process.execPath,
          [path.join(consumer, "node_modules", manifest.name, binary), "--help"],
          consumer,
        ),
        /usage/i,
      );
      assert.match(npm(["exec", "--offline", "--", name, "--help"], consumer), /usage/i);
    }
  }
  console.log(
    `${names.size} installed packages: ESM, declared CommonJS, types, binaries, assembly, plugin loading, and SQLite passed`,
  );
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
