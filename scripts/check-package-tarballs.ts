import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
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
  readonly private?: boolean;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly exports: Readonly<Record<string, string | Readonly<Record<string, string>>>>;
  readonly bin?: Readonly<Record<string, string>>;
}

const root = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-package-check-"));
const require = createRequire(import.meta.url);

// Development conditions/loaders can hide a broken package. Consumers use ordinary Node
// resolution; a private empty npm cache makes installation independent of registry state.
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

/**
 * Packs a directory and validates npm's generated archive name and inventory.
 * @param {string} directory Package root.
 * @param {boolean} lifecycle Whether to run this package's build hooks.
 * @returns {PackedArchive} Inventory of the archive written into the temporary directory.
 */
const pack = (directory: string, lifecycle: boolean): PackedArchive => {
  const args = ["pack", "--json", "--pack-destination", scratch];
  if (!lifecycle) args.push("--ignore-scripts");
  const output = npm(args, directory);
  // npm forwards prepack compiler stdout before its final JSON array. Keep the real lifecycle
  // enabled, but parse only npm's terminal inventory rather than treating build logs as JSON.
  const inventoryStart = output.lastIndexOf("\n[");
  const parsed: unknown = JSON.parse(
    inventoryStart < 0 ? output : output.slice(inventoryStart + 1),
  );
  assert.ok(Array.isArray(parsed) && parsed.length === 1, "Expected one npm archive.");
  const archive = parsed[0] as PackedArchive;
  assert.equal(typeof archive.name, "string");
  assert.equal(typeof archive.filename, "string");
  assert.equal(path.basename(archive.filename), archive.filename);
  assert.ok(Array.isArray(archive.files));
  for (const file of archive.files as readonly unknown[]) {
    assert.ok(file !== null && typeof file === "object" && "path" in file);
    assert.equal(typeof file.path, "string");
  }
  return archive;
};

try {
  const workspaces = fs.readdirSync(path.join(root, "packages")).flatMap((name) => {
    const directory = path.join(root, "packages", name);
    const manifestPath = path.join(directory, "package.json");
    if (!fs.existsSync(manifestPath)) return [];
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as PackageManifest;
    return manifest.private ? [] : [{ directory, manifest }];
  });
  const names = new Set(workspaces.map(({ manifest }) => manifest.name));
  const archives: string[] = [];
  const externalDependencies = new Set<string>();
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
        if (condition === "require" && !destination) continue;
        assert.ok(destination?.startsWith("./dist/"), `${specifier}: invalid ${condition} export`);
        const extension = condition === "types" ? ".d.ts" : ".js";
        assert.ok(
          destination.endsWith(extension),
          `${specifier}: ${condition} is not ${extension}`,
        );
        assert.ok(files.has(destination.slice(2)), `${specifier}: missing ${destination}`);
      }
      imports.push(specifier);
      if (target.require) commonJsImports.push(specifier);
    }
    for (const binary of Object.values(manifest.bin ?? {})) {
      assert.ok(files.has(binary), `${manifest.name}: missing executable ${binary}`);
    }
    for (const file of files) {
      assert.ok(
        !/(?:^|\/)(?:fixtures|local only|node_modules)(?:\/|$)|\.(?:sfc|smc|nes)$/i.test(file),
        `${manifest.name}: forbidden payload ${file}`,
      );
    }
    if (fs.existsSync(path.join(directory, "README.md"))) assert.ok(files.has("README.md"));
    if (manifest.name === "@uttori/asm-plugin-65xx") assert.ok(files.has("THIRD_PARTY_NOTICES.md"));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (!names.has(dependency)) externalDependencies.add(dependency);
    }
    archives.push(path.join(scratch, archive.filename));
    console.log(`${manifest.name}: ${files.size} files, compiled exports and executables present`);
  }

  // Stage installed third-party dependencies too. No workspace link, cached unpublished package,
  // or network fetch can rescue this installation. Set iteration includes discovered transitives.
  const stagedDependencies = new Set<string>();
  for (const dependency of externalDependencies) {
    if (stagedDependencies.has(dependency)) continue;
    stagedDependencies.add(dependency);
    const manifestPath = require.resolve(`${dependency}/package.json`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as PackageManifest;
    const archive = pack(path.dirname(manifestPath), false);
    archives.push(path.join(scratch, archive.filename));
    for (const transitive of Object.keys(manifest.dependencies ?? {})) {
      if (!names.has(transitive)) externalDependencies.add(transitive);
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
  for (const name of names) {
    assert.equal(fs.lstatSync(path.join(consumer, "node_modules", name)).isSymbolicLink(), false);
  }
  fs.writeFileSync(
    path.join(consumer, "exports.json"),
    JSON.stringify({ imports, commonJsImports }),
  );
  fs.cpSync(path.join(root, "tests", "package-consumer"), consumer, { recursive: true });
  console.log(run(process.execPath, ["consumer.mjs"], consumer).trim());

  // Compiler/Node types are test tooling; package declarations resolve only from installed archives,
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
        noEmit: true,
        types: ["node"],
        typeRoots: [path.join(root, "node_modules", "@types")],
      },
      include: ["public-api.mts"],
    }),
  );
  run(
    process.execPath,
    [path.join(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"],
    consumer,
  );
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
