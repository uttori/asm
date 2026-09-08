import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { runTests } from "@vscode/test-electron";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  writeAnalysisProject,
} from "@uttori/asm-disassembler";

/** VS Code release matching the extension's declared minimum API and checked-in type definitions. */
const VSCODE_TEST_VERSION = "1.128.0";

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
  if (process.env.UTTORI_VSCODE_LIVE_WORKSPACE) {
    await runTests({
      version: VSCODE_TEST_VERSION,
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
        evidence: [{ id: "smoke", source: "manual", sourceId: "smoke", confidence: "certain" }],
        labels: [],
        comments: [],
        regions: [],
        runtime: [],
        imports: [],
      },
    });
    await runTests({
      version: VSCODE_TEST_VERSION,
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
