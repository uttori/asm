import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parseAresRuntimeManifest } from "../packages/debug-sidecar-ares/src/ares-process-host.js";

interface Options {
  readonly runtime: string;
  readonly output: string;
}

interface ArchiveEntry {
  readonly path: string;
  readonly bytes: Buffer;
  readonly mode: number;
}

const workspace = process.cwd();
const defaults: Options = {
  runtime: path.join(workspace, "Local Only/ares-current-live-runtime"),
  output: path.join(
    workspace,
    "Local Only/ares-current-live-runtime/uttori-ares-runtime-darwin-arm64.tar",
  ),
};

const usage = `Usage: npm run fixture:ares:package -- [options]

Options:
  --runtime <path>      Portable runtime root containing the verified manifest
  --output <path>       Deterministic uncompressed tar archive to create
  --help                Show this help
`;

const parseArguments = (arguments_: readonly string[]): Options => {
  const parsed = { ...defaults };
  const seen = new Set<keyof Options>();
  const names = new Map<string, keyof Options>([
    ["--runtime", "runtime"],
    ["--output", "output"],
  ]);
  for (let index = 0; index < arguments_.length; index++) {
    const argument = arguments_[index];
    if (argument === "--help") {
      process.stdout.write(usage);
      process.exit(0);
    }
    const name = names.get(argument);
    if (!name) {
      throw new Error(`Unknown argument '${argument}'.\n${usage}`);
    }
    if (seen.has(name)) {
      throw new Error(`Duplicate argument '${argument}'.`);
    }
    const value = arguments_[++index];
    if (!value || value.startsWith("--")) {
      throw new Error(`Argument '${argument}' requires a path.`);
    }
    parsed[name] = path.resolve(value);
    seen.add(name);
  }
  return parsed;
};

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const octal = (value: number, width: number): Buffer => {
  const encoded = `${value.toString(8).padStart(width - 1, "0")}\0`;
  if (encoded.length !== width) {
    throw new Error(`Tar value ${value} exceeds field width ${width}.`);
  }
  return Buffer.from(encoded, "ascii");
};

const tarHeader = (entry: ArchiveEntry): Buffer => {
  const header = Buffer.alloc(512);
  let name = Buffer.from(entry.path, "utf8");
  let prefix = Buffer.alloc(0);
  if (name.length > 100) {
    const slashOffsets = [...entry.path.matchAll(/\//g)].map(({ index }) => index);
    const split = slashOffsets.findLast((offset) => {
      const candidatePrefix = Buffer.byteLength(entry.path.slice(0, offset), "utf8");
      const candidateName = Buffer.byteLength(entry.path.slice(offset + 1), "utf8");
      return candidatePrefix <= 155 && candidateName <= 100;
    });
    if (split === undefined) {
      throw new Error(`Tar entry path exceeds ustar limits: ${entry.path}`);
    }
    prefix = Buffer.from(entry.path.slice(0, split), "utf8");
    name = Buffer.from(entry.path.slice(split + 1), "utf8");
  }
  name.copy(header, 0);
  octal(entry.mode, 8).copy(header, 100);
  octal(0, 8).copy(header, 108);
  octal(0, 8).copy(header, 116);
  octal(entry.bytes.length, 12).copy(header, 124);
  octal(0, 12).copy(header, 136);
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  Buffer.from("ustar\0", "ascii").copy(header, 257);
  Buffer.from("00", "ascii").copy(header, 263);
  Buffer.from("root\0", "ascii").copy(header, 265);
  Buffer.from("root\0", "ascii").copy(header, 297);
  prefix.copy(header, 345);
  const checksum = header.reduce((total, byte) => total + byte, 0);
  const checksumText = `${checksum.toString(8).padStart(6, "0")}\0 `;
  Buffer.from(checksumText, "ascii").copy(header, 148);
  return header;
};

const createTar = (entries: readonly ArchiveEntry[]): Buffer => {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    chunks.push(tarHeader(entry), entry.bytes);
    const padding = (512 - (entry.bytes.length % 512)) % 512;
    if (padding > 0) {
      chunks.push(Buffer.alloc(padding));
    }
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
};

const options = parseArguments(process.argv.slice(2));
if (!statSync(options.runtime).isDirectory()) {
  throw new Error(`Ares runtime root is not a directory: ${options.runtime}`);
}
const runtime = realpathSync(options.runtime);
const manifestPath = path.join(runtime, "ares-runtime-manifest.json");
const manifestBytes = readFileSync(manifestPath);
const manifest = parseAresRuntimeManifest(JSON.parse(manifestBytes.toString("utf8")));
if (manifest.platform !== "darwin" || manifest.architecture !== "arm64") {
  throw new Error(
    `This packager requires a darwin/arm64 manifest, got ${manifest.platform}/${manifest.architecture}.`,
  );
}

const relativeFiles = [
  "ares-runtime-manifest.json",
  "bin/ares-headless",
  "patches/0001-Add-bounded-SNES-debugger-hooks-to-headless-runtime.patch",
  "patches/headless-series.patch",
  ...manifest.resources.map(({ path: resourcePath }) => resourcePath),
];
const uniqueFiles = [...new Set(relativeFiles)].toSorted();
if (uniqueFiles.length !== relativeFiles.length) {
  throw new Error("Runtime archive allowlist contains duplicate paths.");
}
if (
  !manifest.resources.some(({ path: resourcePath }) => resourcePath === "LICENSES/ares-LICENSE.txt")
) {
  throw new Error("Runtime manifest does not contain the aggregate ares license.");
}
if (
  manifest.resources.filter(({ path: resourcePath }) => resourcePath.startsWith("LICENSES/"))
    .length < 7
) {
  throw new Error("Runtime manifest does not contain the complete macOS notice set.");
}

const hashExpectations = new Map<string, string>([
  ["bin/ares-headless", manifest.executableSha256],
  ["patches/0001-Add-bounded-SNES-debugger-hooks-to-headless-runtime.patch", manifest.patchSha256],
  ["patches/headless-series.patch", manifest.headlessPatchSha256],
  ...manifest.resources.map(
    ({ path: resourcePath, sha256: digest }) => [resourcePath, digest] as const,
  ),
]);
const prefix = `uttori-ares-runtime-${manifest.platform}-${manifest.architecture}`;
const entries = uniqueFiles.map((relativePath): ArchiveEntry => {
  if (path.isAbsolute(relativePath) || relativePath.split("/").includes("..")) {
    throw new Error(`Unsafe archive path: ${relativePath}`);
  }
  const file = path.resolve(runtime, relativePath);
  if (!file.startsWith(`${runtime}${path.sep}`)) {
    throw new Error(`Archive path escapes runtime root: ${relativePath}`);
  }
  const metadata = lstatSync(file);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Archive input must be a regular non-symlink file: ${relativePath}`);
  }
  const bytes = readFileSync(file);
  const expectedHash = hashExpectations.get(relativePath);
  if (expectedHash && sha256(bytes) !== expectedHash) {
    throw new Error(`Archive input hash mismatch: ${relativePath}`);
  }
  return {
    path: `${prefix}/${relativePath}`,
    bytes,
    mode: relativePath === "bin/ares-headless" ? 0o755 : 0o644,
  };
});

const tar = createTar(entries);
writeFileSync(options.output, tar);
process.stdout.write(
  `${JSON.stringify(
    {
      status: "pass",
      output: path.resolve(options.output),
      bytes: tar.length,
      sha256: sha256(tar),
      entries: entries.map(({ path: entryPath, bytes, mode }) => ({
        path: entryPath,
        bytes: bytes.length,
        mode: mode.toString(8),
      })),
    },
    undefined,
    2,
  )}\n`,
);
