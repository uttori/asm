import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { parseAresRuntimeManifest } from "../packages/debug-sidecar-ares/src/ares-process-host.js";

interface Options {
  readonly source: string;
  readonly runtime: string;
}

interface NoticeSource {
  readonly destination: string;
  readonly source: string;
}

const workspace = process.cwd();
const defaults: Options = {
  source: path.join(workspace, "Local Only/ares-current-port"),
  runtime: path.join(workspace, "Local Only/ares-current-live-runtime"),
};

const usage = `Usage: npm run fixture:ares:notices -- [options]

Options:
  --source <path>       Pinned ares source checkout
  --runtime <path>      Portable runtime root containing the manifest
  --help                Show this help
`;

const parseArguments = (arguments_: readonly string[]): Options => {
  const parsed = { ...defaults };
  const seen = new Set<keyof Options>();
  const names = new Map<string, keyof Options>([
    ["--source", "source"],
    ["--runtime", "runtime"],
  ]);
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    if (argument === "--help") {
      process.stdout.write(usage);
      process.exit(0);
    }
    const name = names.get(argument ?? "");
    if (!name) throw new Error(`Unknown argument '${String(argument)}'.\n${usage}`);
    if (seen.has(name)) throw new Error(`Duplicate argument '${String(argument)}'.`);
    const value = arguments_[++index];
    if (!value || value.startsWith("--"))
      throw new Error(`Argument '${String(argument)}' requires a path.`);
    parsed[name] = path.resolve(value);
    seen.add(name);
  }
  return parsed;
};

const assertDirectory = (directory: string, label: string): void => {
  if (!statSync(directory).isDirectory())
    throw new Error(`${label} is not a directory: ${directory}`);
};

const assertFile = (file: string, label: string): void => {
  if (!statSync(file).isFile()) throw new Error(`${label} is not a file: ${file}`);
};

const sha256 = (file: string): string =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

const options = parseArguments(process.argv.slice(2));
assertDirectory(options.source, "Ares source checkout");
assertDirectory(options.runtime, "Ares runtime root");

const source = realpathSync(options.source);
const runtime = realpathSync(options.runtime);
const manifestFile = path.join(runtime, "ares-runtime-manifest.json");
assertFile(manifestFile, "Ares runtime manifest");

const manifest = parseAresRuntimeManifest(JSON.parse(readFileSync(manifestFile, "utf8")));
const sourceRevision = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
}).trim();
if (sourceRevision !== manifest.forkRevision)
  throw new Error(
    `Source revision mismatch: manifest '${manifest.forkRevision}', checkout '${sourceRevision}'.`,
  );

const notices: readonly NoticeSource[] = [
  { destination: "LICENSES/ares-LICENSE.txt", source: path.join(source, "LICENSE") },
  {
    destination: "LICENSES/libchdr-LICENSE.txt",
    source: path.join(source, "thirdparty/libchdr/LICENSE.txt"),
  },
  {
    destination: "LICENSES/lzma-sdk-LICENSE.txt",
    source: path.join(source, "thirdparty/libchdr/deps/lzma-25.01/LICENSE"),
  },
  {
    destination: "LICENSES/miniz-3.1.1-LICENSE.txt",
    source: path.join(workspace, "scripts/licenses/miniz-3.1.1-MIT.txt"),
  },
  {
    destination: "LICENSES/sljit-LICENSE.txt",
    source: path.join(source, "thirdparty/sljit/LICENSE"),
  },
  {
    destination: "LICENSES/TZXFile-LICENSE.txt",
    source: path.join(source, "thirdparty/TZXFile/LICENSE"),
  },
  {
    destination: "LICENSES/zstd-1.5.7-LICENSE.txt",
    source: path.join(workspace, "scripts/licenses/zstd-1.5.7-BSD-3-Clause.txt"),
  },
];

for (const notice of notices) {
  assertFile(notice.source, `Notice source '${notice.destination}'`);
  const destination = path.resolve(runtime, notice.destination);
  if (!destination.startsWith(`${runtime}${path.sep}`))
    throw new Error(`Notice destination escapes runtime root: ${notice.destination}`);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(notice.source, destination);
}

const noticeResources = notices
  .map(({ destination }) => ({
    path: destination,
    sha256: sha256(path.join(runtime, destination)),
  }))
  .sort((left, right) => left.path.localeCompare(right.path));
const runtimeResources = manifest.resources.filter(
  ({ path: resourcePath }) => !resourcePath.startsWith("LICENSES/"),
);
const updatedManifest = {
  ...manifest,
  resources: [...runtimeResources, ...noticeResources].sort((left, right) =>
    left.path.localeCompare(right.path),
  ),
};
parseAresRuntimeManifest(updatedManifest);
writeFileSync(manifestFile, `${JSON.stringify(updatedManifest, undefined, 2)}\n`, "utf8");

process.stdout.write(
  `${JSON.stringify(
    {
      status: "pass",
      sourceRevision,
      manifest: manifestFile,
      notices: noticeResources,
    },
    undefined,
    2,
  )}\n`,
);
