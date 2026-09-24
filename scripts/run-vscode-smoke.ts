import { execFileSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  writeAnalysisProject,
} from "@uttori/asm-disassembler";
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests,
} from "@vscode/test-electron";

/** VS Code release matching the extension's declared minimum API and embedded Node 24 runtime. */
const VSCODE_TEST_VERSION = "1.128.0";

/**
 * Install the actual archive into a disposable profile and test it in production extension mode.
 * A separate empty development extension supplies the test runner without replacing the installed
 * package. Reopening the profile checks startup after shutdown. Restricted mode uses a direct
 * launch because the upstream test harness always disables Workspace Trust.
 * @param {string} workspace Temporary synthetic workspace.
 * @param {string} tests Compiled Extension Host assertions.
 * @param {string} executable Editor executable, either cached or explicitly selected.
 * @param {string} vsix Candidate archive to install without rebuilding it.
 * @returns {Promise<void>} Rejects on installation, assertion, or editor shutdown failure.
 */
const testInstalledArchive = async (
  workspace: string,
  tests: string,
  executable: string,
  vsix: string,
): Promise<void> => {
  const isolation = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-vsix-"));
  try {
    const extensions = path.join(isolation, "extensions");
    const profile = path.join(isolation, "profile");
    const driver = path.join(isolation, "driver");
    fs.mkdirSync(driver);
    fs.writeFileSync(
      path.join(driver, "package.json"),
      JSON.stringify({
        name: "uttori-release-test-driver",
        publisher: "uttori-tests",
        version: "0.0.0",
        engines: { vscode: "^1.128.0" },
        main: "index.js",
        activationEvents: ["*"],
        capabilities: { untrustedWorkspaces: { supported: true } },
      }),
    );
    fs.writeFileSync(path.join(driver, "index.js"), "exports.activate = () => {};\n");
    const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(executable, {
      reuseMachineInstall: true,
    });
    execFileSync(
      cli,
      [
        ...cliArgs,
        "--user-data-dir",
        profile,
        "--extensions-dir",
        extensions,
        "--install-extension",
        vsix,
        "--force",
      ],
      {
        stdio: "inherit",
        timeout: 120_000,
        shell: process.platform === "win32",
      },
    );
    // Install the core archive as an ordinary consumer so the built-in TypeScript service resolves
    // its emitted declarations and JSDoc without source conditions or a workspace symlink.
    const npmCli = process.env.npm_execpath;
    if (!npmCli) {
      throw new Error("Run the installed smoke through npm run vscode:smoke:installed.");
    }
    const archives: string[] = [];
    const npmEnvironment = { ...process.env, npm_config_cache: path.join(isolation, "npm-cache") };
    for (const directory of ["packages/core", "node_modules/semver"]) {
      const packed = execFileSync(
        process.execPath,
        [npmCli, "pack", "--ignore-scripts", "--json", "--pack-destination", isolation],
        { cwd: path.resolve(directory), encoding: "utf8", env: npmEnvironment },
      );
      const [{ filename }] = JSON.parse(packed) as { filename: string }[];
      archives.push(path.join(isolation, filename));
    }
    fs.writeFileSync(path.join(workspace, "package.json"), '{"private":true,"type":"module"}\n');
    execFileSync(
      process.execPath,
      [
        npmCli,
        "install",
        "--offline",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=false",
        ...archives,
      ],
      { cwd: workspace, stdio: "inherit", env: npmEnvironment },
    );
    for (const phase of ["installed", "reopen", "restricted"] as const) {
      if (phase === "restricted") {
        fs.writeFileSync(
          path.join(workspace, "blocked-plugin.mjs"),
          `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(path.join(workspace, "plugin-executed"))}, 'executed'); throw new Error('Untrusted plugin executed');\n`,
        );
        fs.writeFileSync(
          path.join(workspace, "uttori-asm.config.json"),
          JSON.stringify({
            plugins: [{ module: "./blocked-plugin.mjs" }],
          }),
        );
      }
      const userData = phase === "restricted" ? path.join(isolation, "restricted") : profile;
      fs.mkdirSync(path.join(userData, "User"), { recursive: true });
      fs.writeFileSync(
        path.join(userData, "User/settings.json"),
        JSON.stringify({
          "security.workspace.trust.startupPrompt": "never",
          "security.workspace.trust.banner": "never",
          "workbench.startupEditor": "none",
          "extensions.autoUpdate": false,
          "update.mode": "none",
        }),
      );
      const launchArgs = [
        workspace,
        "--user-data-dir",
        userData,
        "--extensions-dir",
        extensions,
        "--disable-gpu",
        "--skip-welcome",
        "--skip-release-notes",
      ];
      const env = { UTTORI_VSCODE_RELEASE_PHASE: phase, UTTORI_VSCODE_INSTALLED_ROOT: extensions };
      if (phase !== "restricted") {
        await runTests({
          vscodeExecutablePath: executable,
          extensionDevelopmentPath: driver,
          extensionTestsPath: tests,
          launchArgs,
          extensionTestsEnv: env,
        });
        continue;
      }
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          executable,
          [
            ...launchArgs,
            "--no-sandbox",
            "--disable-updates",
            `--extensionDevelopmentPath=${driver}`,
            `--extensionTestsPath=${tests}`,
          ],
          {
            env: { ...process.env, ...env },
            stdio: "inherit",
          },
        );
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error("Restricted editor smoke exceeded 120 seconds."));
        }, 120_000);
        child.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.once("exit", (code, signal) => {
          clearTimeout(timer);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Restricted editor smoke exited with ${signal ?? code}.`));
          }
        });
      });
    }
  } finally {
    fs.rmSync(isolation, { recursive: true, force: true });
  }
};

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
  const version = process.env.UTTORI_VSCODE_TEST_VERSION ?? VSCODE_TEST_VERSION;
  const vscodeExecutablePath = process.env.UTTORI_VSCODE_TEST_EXECUTABLE
    ? path.resolve(process.env.UTTORI_VSCODE_TEST_EXECUTABLE)
    : await downloadAndUnzipVSCode(version);
  checkMinimumEditorApi(vscodeExecutablePath);
  if (process.env.UTTORI_VSCODE_LIVE_WORKSPACE) {
    await runTests({
      version,
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
    fs.writeFileSync(
      path.join(workspacePath, "main.asm"),
      "lorom\norg $008000\nStart:\n  sei\nRAM_EASTER_EGG_COUNTER = $7E002B\n  LDA.w RAM_EASTER_EGG_COUNTER & $FFFF,x\n  RTS\n",
    );
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
    if (process.env.UTTORI_VSCODE_TEST_VSIX) {
      await testInstalledArchive(
        workspacePath,
        extensionTestsPath,
        vscodeExecutablePath,
        path.resolve(process.env.UTTORI_VSCODE_TEST_VSIX),
      );
      return;
    }
    await runTests({
      version,
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
