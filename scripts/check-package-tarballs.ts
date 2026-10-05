import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

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
 * @param {string} executable Program to launch.
 * @param {string[]} args Literal argument vector.
 * @param {string} cwd Working directory.
 * @returns {string} Successful UTF-8 stdout.
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
 * @param {string[]} args npm arguments.
 * @param {string} cwd Working directory.
 * @returns {string} npm stdout.
 */
const npm = (args: string[], cwd: string): string => {
  const executable = process.env.npm_execpath;
  assert.ok(executable, "Run this check through npm run pack:check.");
  return run(process.execPath, [executable, ...args], cwd);
};

/** Resolve from the declaring package so nested dependency versions match the installed tree.
 * @param {string} dependency External package name.
 * @param {string} from Directory of the declaring package.
 * @returns {string} Absolute manifest path for the resolved package.
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
 * @param {string} directory Package root.
 * @param {boolean} lifecycle Whether to run this package's build hooks.
 * @returns {PackedArchive} Inventory of the archive written into the temporary directory.
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
  const imports: string[] = [];
  const commonJsImports: string[] = [];
  for (const { directory, manifest } of workspaces) {
    const archive = pack(directory, true);
    const files = new Set(archive.files.map((file) => file.path));
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      const specifier = manifest.name + subpath.slice(1);
      if (typeof target === "string") {
        assert.ok(files.has(target.replace(/^\.\//, "")), `${specifier}: missing ${target}`);
        continue;
      }
      // The maintainer-only source condition is opt-in. Normal runtime and type conditions must
      // point to shipped dist files, never to workspace TypeScript that needs a loader.
      for (const condition of ["types", "import", "require"] as const) {
        const destination: string | undefined = target[condition];
        if (condition === "require" && !destination) {
          continue;
        }
        assertDistExport(destination, `${specifier}: invalid ${condition} export`);
        const extension = condition === "types" ? ".d.ts" : ".js";
        assert.ok(
          destination.endsWith(extension),
          `${specifier}: ${condition} is not ${extension}`,
        );
        assert.ok(files.has(destination.slice(2)), `${specifier}: missing ${destination}`);
      }
      imports.push(specifier);
      if (target.require) {
        commonJsImports.push(specifier);
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
    archives.push(path.join(scratch, archive.filename));
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
    archives.push(path.join(scratch, archive.filename));
    for (const transitive of Object.keys(manifest.dependencies ?? {})) {
      if (!names.has(transitive)) {
        externalDependencies.push({ dependency: transitive, from: path.dirname(manifestPath) });
      }
    }
  }

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
