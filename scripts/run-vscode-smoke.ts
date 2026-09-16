import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  writeAnalysisProject,
} from "@uttori/asm-disassembler";
import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";

/** VS Code release matching the extension's declared minimum API and embedded Node 24 runtime. */
const VSCODE_TEST_VERSION = "1.128.0";

/**
 * Checks the minimum editor's exact API in addition to the pinned development typings.
 * The temporary config never changes the developer's installed type package.
 * @param {string} executable Downloaded VS Code executable.
 * @returns {void} Throws with compiler diagnostics if a newer editor API is used.
 */
const checkMinimumEditorApi = (executable: string): void => {
  const root = process.cwd();
  let resources = path.join(path.dirname(executable), "resources");
  if (process.platform === "darwin") {
    resources = path.resolve(path.dirname(executable), "../Resources");
  }
  const declarations = path.join(resources, "app/out/vscode-dts/vscode.d.ts");
  if (!fs.existsSync(declarations)) {
    throw new Error(`Minimum editor API declarations are missing: ${declarations}`);
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-vscode-api-"));
  try {
    const config = path.join(temporary, "tsconfig.json");
    fs.writeFileSync(
      config,
      JSON.stringify({
        extends: path.join(root, "packages/vscode-extension/tsconfig.json"),
        compilerOptions: {
          rootDir: root,
          types: ["node"],
          typeRoots: [path.join(root, "node_modules/@types")],
          paths: { vscode: [declarations] },
        },
      }),
    );
    execFileSync(
      process.execPath,
      [path.join(root, "node_modules/typescript/bin/tsc"), "-p", config],
      {
        stdio: "inherit",
        timeout: 60_000,
      },
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
};

/**
 * Launches the compiled extension in a real isolated Extension Development Host.
 *
 * The temporary workspace is intentionally outside the repository: the smoke test invokes a real
 * language-server build and must not leave a generated ROM or workspace settings in the checkout.
 * `@vscode/test-electron` retains only its downloadable editor cache under `.vscode-test/`.
 * @returns {Promise<void>} Promise settled after VS Code exits and the temporary workspace is gone.
 */
const main = async (): Promise<void> => {
  const root = process.cwd();
  const extensionDevelopmentPath = path.join(root, "packages/vscode-extension");
  const extensionTestsPath = path.join(extensionDevelopmentPath, "tests-host/out/index.cjs");
  const vscodeExecutablePath = await downloadAndUnzipVSCode(VSCODE_TEST_VERSION);
  checkMinimumEditorApi(vscodeExecutablePath);
  if (process.env.UTTORI_VSCODE_LIVE_WORKSPACE) {
    await runTests({
      version: VSCODE_TEST_VERSION,
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        path.resolve(process.env.UTTORI_VSCODE_LIVE_WORKSPACE),
        "--disable-extensions",
        "--disable-gpu",
        "--disable-workspace-trust",
        "--skip-welcome",
      ],
    });
    return;
  }
  const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-vscode-smoke-"));
  try {
    fs.writeFileSync(path.join(workspacePath, "main.asm"), "lorom\norg $008000\nStart:\n  sei\n");
    writeAnalysisProject(path.join(workspacePath, "analysis"), {
      manifest: {
        format: ANALYSIS_PROJECT_FORMAT,
        schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
        target: "snes.sfc",
        rom: new RomImage(new Uint8Array(0x8000)).identity,
        mapping: { mapper: "lorom", source: "override", candidates: [] },
        addressSpaces: [
          { id: "snes.cpu", name: "CPU", kind: "cpu", addressBits: 24 },
          { id: "rom.file", name: "ROM", kind: "file", addressBits: 24 },
        ],
      },
      shards: {
        annotations: Array.from({ length: 500 }, (_, index) => ({
          id: `annotation-${index}`,
          addressSpace: "rom.file",
          start: index,
          end: index + 1,
          classification: "data8",
          architecture: "snes.65816",
          evidence: ["smoke"],
        })),
        analysis: Array.from({ length: 500 }, (_, index) => ({
          id: `function-${index}`,
          kind: "function",
          addressSpace: "snes.cpu",
          address: 0x808000 + index,
          source: "smoke",
          evidencePath: [],
          evidence: ["smoke"],
        })),
        evidence: [
          { id: "smoke", source: "manual", sourceId: "smoke", confidence: "certain" },
          ...["a", "b"].map((id) => ({
            id,
            source: "runtime" as const,
            sourceId: "smoke-trace",
            confidence: "certain" as const,
            artifact: {
              format: "trace",
              sha256: id.repeat(64),
              romContentSha256: new RomImage(new Uint8Array(0x8000)).identity.contentSha256,
            },
          })),
        ],
        labels: [],
        comments: [],
        regions: [],
        runtime: [
          ...["a", "b"].flatMap((source) =>
            Array.from({ length: source === "a" ? 500 : 100 }, (_, index) => ({
              id: `pc:${source}:${index}`,
              kind: "runtime-execution" as const,
              architecture: "snes.65816",
              addressSpace: "snes.cpu",
              address: 0x808000 + index,
              size: 1,
              count: 1,
              evidence: [source],
            })),
          ),
        ],
        imports: ["a", "b"].map((id) => ({
          id: `import:${id}`,
          format: "trace",
          sourceName: id === "a" ? "chest.json" : "idle.json",
          sourceSha256: id.repeat(64),
          imported: { instructions: id === "a" ? 500 : 100 },
          warnings: [],
          unsupported: [],
        })),
      },
    });
    await runTests({
      version: VSCODE_TEST_VERSION,
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        workspacePath,
        "--disable-extensions",
        "--disable-gpu",
        "--skip-release-notes",
        "--skip-welcome",
      ],
    });
  } finally {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }
};

await main();
