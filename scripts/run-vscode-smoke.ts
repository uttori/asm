import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { runTests } from "@vscode/test-electron";

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
  const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-vscode-smoke-"));
  try {
    fs.writeFileSync(path.join(workspacePath, "main.asm"), "lorom\norg $008000\nStart:\n  sei\n");
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
