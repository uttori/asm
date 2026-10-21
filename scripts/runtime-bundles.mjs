import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** @typedef {{output: string, source: string, target: string, notices: string}} RuntimeBundle */
/** @typedef {RuntimeBundle & {version: number, sha256: string, noticesSha256: string, inputs: {file: string, sha256: string}[]}} RuntimeBundleReceipt */

/** Executable artifacts, their owning source entry, and the actual host runtime that loads them. */
export const runtimeBundles = [
  ["packages/cli/out/cli.mjs", "packages/cli/src/index.ts", "node26"],
  [
    "packages/debug-sidecar-ares/out/sidecar.mjs",
    "packages/debug-sidecar-ares/src/sidecar.ts",
    "node26",
  ],
  ...["server", "asset-preview-worker", "index-worker"].map((name) => [
    `packages/language-server/out/${name}.mjs`,
    `packages/language-server/src/${name}.ts`,
    "node26",
  ]),
  ...[
    ["out/extension.js", "src/extension.ts"],
    ["out/png-worker.cjs", "src/assets/png-worker.ts"],
    ["out/editor-information-worker.cjs", "src/editor-info/worker.ts"],
    ["out/source-process.mjs", "src/source/process.ts"],
    ["out/live-bus-analysis-process.cjs", "src/runtime/live-bus-analysis-process.ts"],
    ["out/analysis-worker.cjs", "src/analysis/worker.ts"],
    ["tests-host/out/extension-driver.cjs", "tests-host/extension-driver.ts"],
    ["tests-host/out/asset-recovery-driver.cjs", "tests-host/asset-recovery-driver.ts"],
    ["tests-host/out/index.cjs", "tests-host/index.ts"],
    ["server/server.mjs", "../language-server/src/server.ts"],
    ["server/asset-preview-worker.mjs", "../language-server/src/asset-preview-worker.ts"],
    ["server/index-worker.mjs", "../language-server/src/index-worker.ts"],
    ["sidecars/ares.mjs", "../debug-sidecar-ares/src/sidecar.ts"],
  ].map(([output, source]) => [
    `packages/vscode-extension/${output}`,
    path.posix.normalize(`packages/vscode-extension/${source}`),
    "node24",
  ]),
].map(([output, source, target]) =>
  Object.freeze({ output, source, target, notices: `${output}.licenses.txt` }),
);

const root = path.resolve(import.meta.dirname, "..");
/** Remove retired outputs only after every registered member of the directory verifies successfully.
 * Compile failures preserve the previous runnable artifacts; successful builds cannot package old modules.
 * @param {string} directory Generated executable directory owned by the build.
 */
export function pruneRuntimeOutputs(directory) {
  const bundles = runtimeBundles.filter(
    (bundle) => path.dirname(path.join(root, bundle.output)) === path.resolve(directory),
  );
  if (bundles.length === 0) {
    throw new Error(`Unregistered runtime directory: ${directory}`);
  }
  const expected = new Set();
  for (const bundle of bundles) {
    checkRuntimeBundle(bundle);
    for (const file of [bundle.output, bundle.notices, `${bundle.output}.manifest.json`]) {
      expected.add(path.basename(file));
    }
  }
  for (const file of fs.readdirSync(directory)) {
    if (!expected.has(file)) {
      fs.rmSync(path.join(directory, file), { recursive: true, force: true });
    }
  }
}

/** Content identities include dirty executable bytes; timestamps and package versions are insufficient.
 * @param {string} file File whose complete contents enter the identity.
 * @returns {string} SHA-256 of the complete file bytes.
 */
const hashFile = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

/** Reject unregistered executables or runtime drift before building a potentially incompatible worker.
 * @param {import("esbuild").BuildOptions & {outfile: string}} options Executable build request.
 * @returns {RuntimeBundle} Registered runtime and notices contract for this entry point.
 */
export function runtimeBundleFor(options) {
  const relative = path.relative(root, options.outfile).split(path.sep).join("/");
  const bundle = runtimeBundles.find((entry) => entry.output === relative);
  if (!bundle) {
    throw new Error(`Unregistered runtime bundle: ${relative}`);
  }
  const entry = Array.isArray(options.entryPoints) ? options.entryPoints[0] : undefined;
  if (typeof entry !== "string") {
    throw new Error("Runtime bundle requires one string entry point.");
  }
  if (
    options.target !== bundle.target ||
    path.resolve(entry) !== path.resolve(root, bundle.source)
  ) {
    throw new Error(`Runtime/source mismatch for ${relative}`);
  }
  return bundle;
}

/** Write a reproducible receipt after bundle and notices exist. Source hashes make stale workers detectable.
 * @param {RuntimeBundle} bundle Registered output contract.
 * @param {import("esbuild").Metafile} metafile Actual transitive build inputs.
 * @param {string} base Working directory used to resolve esbuild inputs.
 */
export function writeRuntimeBundleReceipt(bundle, metafile, base) {
  const inputs = [
    ...new Set([
      ...Object.keys(metafile.inputs).map((input) =>
        path.relative(root, path.resolve(base, input)).split(path.sep).join("/"),
      ),
      "package-lock.json",
      "scripts/bundle-notices.mjs",
      "scripts/runtime-bundles.mjs",
      `packages/${bundle.output.split("/")[1]}/esbuild.mjs`,
    ]),
  ].toSorted();
  const receipt = {
    version: 1,
    ...bundle,
    sha256: hashFile(path.join(root, bundle.output)),
    noticesSha256: hashFile(path.join(root, bundle.notices)),
    inputs: inputs.map((file) => ({ file, sha256: hashFile(path.join(root, file)) })),
  };
  fs.writeFileSync(
    path.join(root, `${bundle.output}.manifest.json`),
    JSON.stringify(receipt, null, 2) + "\n",
  );
}

/** Verify both generated bytes and all inputs. A separate root supports isolated corruption regressions.
 * @param {RuntimeBundle} bundle Expected output contract.
 * @param {string} directory Repository or isolated fixture root.
 * @returns {RuntimeBundleReceipt} Verified output and transitive input identities.
 */
export function checkRuntimeBundle(bundle, directory = root) {
  /** @type {unknown} */
  const receipt = JSON.parse(
    fs.readFileSync(path.join(directory, `${bundle.output}.manifest.json`), "utf8"),
  );
  if (
    !isReceipt(receipt) ||
    receipt.version !== 1 ||
    receipt.output !== bundle.output ||
    receipt.source !== bundle.source ||
    receipt.target !== bundle.target ||
    receipt.notices !== bundle.notices
  ) {
    throw new Error(`Invalid runtime receipt: ${bundle.output}`);
  }
  for (const [file, expected] of [
    [bundle.output, receipt.sha256],
    [bundle.notices, receipt.noticesSha256],
    ...receipt.inputs.map((input) => [input.file, input.sha256]),
  ]) {
    if (hashFile(path.join(directory, file)) !== expected) {
      throw new Error(`Stale runtime bundle ${bundle.output}: ${file}`);
    }
  }
  if (!receipt.inputs.some((input) => input.file === bundle.source)) {
    throw new Error(`Missing runtime source: ${bundle.source}`);
  }
  return receipt;
}

/** Validate persisted receipt fields before using paths or expected content identities.
 * @param {unknown} value Parsed JSON receipt.
 * @returns {value is RuntimeBundleReceipt} Whether all required fields have their declared shape.
 */
function isReceipt(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    "version" in value &&
    typeof value.version === "number" &&
    "output" in value &&
    typeof value.output === "string" &&
    "source" in value &&
    typeof value.source === "string" &&
    "target" in value &&
    typeof value.target === "string" &&
    "notices" in value &&
    typeof value.notices === "string" &&
    "sha256" in value &&
    typeof value.sha256 === "string" &&
    "noticesSha256" in value &&
    typeof value.noticesSha256 === "string" &&
    "inputs" in value &&
    Array.isArray(value.inputs) &&
    value.inputs.every(
      (/** @type {unknown} */ input) =>
        typeof input === "object" &&
        input !== null &&
        "file" in input &&
        typeof input.file === "string" &&
        "sha256" in input &&
        typeof input.sha256 === "string",
    )
  );
}
