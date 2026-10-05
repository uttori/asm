import { execFileSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  publishAnalysisProject,
} from "@uttori/asm-disassembler";
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests,
} from "@vscode/test-electron";

/** Resolve the latest stable release for acceptance; explicit versions remain available for reproducible receipts. */
const VSCODE_TEST_VERSION = "stable";

/** Parsed JSON must be a plain object before its fields are read. */
function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} is not a JSON object.`);
  }
}

/**
 * Install the actual archive into a disposable profile and test it in production extension mode.
 * A separate empty development extension supplies the test runner without replacing the installed
 * package. Reopening the profile checks startup after shutdown. Restricted mode uses a direct
 * launch because the upstream test harness always disables Workspace Trust.
 * @param {string} workspace Temporary synthetic workspace.
 * @param {string} tests Compiled Extension Host assertions.
 * @param {string} executable Editor executable, either cached or explicitly selected.
 * @param {string} editorVersion Actual runtime version read from the editor package.
 * @param {string} vsix Candidate archive to install without rebuilding it.
 * @returns {Promise<void>} Rejects on installation, assertion, or editor shutdown failure.
 */
const testInstalledArchive = async (
  workspace: string,
  tests: string,
  executable: string,
  editorVersion: string,
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
        engines: { vscode: `^${editorVersion}` },
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
    // Include core's installed runtime dependencies so the empty-cache consumer stays fully offline.
    for (const directory of [
      "packages/core",
      "node_modules/semver",
      "node_modules/@uttori/data-tools",
      "node_modules/@uttori/data-tools/node_modules/pako",
    ]) {
      const packed = execFileSync(
        process.execPath,
        [npmCli, "pack", "--ignore-scripts", "--json", "--pack-destination", isolation],
        { cwd: path.resolve(directory), encoding: "utf8", env: npmEnvironment },
      );
      const packedArchives: unknown = JSON.parse(packed);
      if (!Array.isArray(packedArchives) || packedArchives.length !== 1) {
        throw new Error(`npm pack in ${directory} did not report one archive.`);
      }
      const packedArchive: unknown = packedArchives[0];
      assertRecord(packedArchive, `npm pack in ${directory}`);
      if (typeof packedArchive.filename !== "string") {
        throw new Error(`npm pack in ${directory} did not report an archive filename.`);
      }
      archives.push(path.join(isolation, packedArchive.filename));
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
 * Checks the selected editor's exact API in addition to the development typings.
 * The temporary config never changes the developer's installed type package.
 * @param {string} executable Downloaded VS Code executable.
 * @returns {void} Throws with compiler diagnostics if its shipped API cannot type-check the extension.
 */
const checkEditorApi = (executable: string): void => {
  const root = process.cwd();
  let resources = path.join(path.dirname(executable), "resources");
  if (process.platform === "darwin") {
    resources = path.resolve(path.dirname(executable), "../Resources");
  }
  const declarations = path.join(resources, "app/out/vscode-dts/vscode.d.ts");
  if (!fs.existsSync(declarations)) {
    throw new Error(`Selected editor API declarations are missing: ${declarations}`);
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
  // Directory names and downloader markers are not runtime identity. A moving
  // release channel resolves to a concrete version; explicit numeric pins must match.
  let resources = path.join(path.dirname(vscodeExecutablePath), "resources");
  if (process.platform === "darwin") {
    resources = path.resolve(path.dirname(vscodeExecutablePath), "../Resources");
  }
  const editorPackage: unknown = JSON.parse(
    fs.readFileSync(path.join(resources, "app/package.json"), "utf8"),
  );
  assertRecord(editorPackage, "VS Code package.json");
  if (typeof editorPackage.version !== "string") {
    throw new Error(`Expected VS Code ${version}, found no version. Replace the stale test cache.`);
  }
  const actual = editorPackage.version;
  if (version !== "stable" && version !== "insiders" && actual !== version) {
    throw new Error(`Expected VS Code ${version}, found ${actual}. Replace the stale test cache.`);
  }
  console.log(`Testing VS Code ${actual} (requested ${version}).`);
  checkEditorApi(vscodeExecutablePath);
  if (process.env.UTTORI_VSCODE_LIVE_WORKSPACE) {
    // Full-project checks may open and undo real source buffers. Isolate both extension state and
    // hot-exit backups so a verification run cannot reuse or overwrite the user's editor session.
    const isolation = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-vscode-live-"));
    let completed = false;
    try {
      // VS Code resolves custom-editor providers only for contributed view types.
      // Keep the driven test view in a disposable extension, outside the shipped manifest.
      const developmentPaths = [extensionDevelopmentPath];
      if (
        process.env.UTTORI_VSCODE_BINARY_PREVIEW === "1" ||
        process.env.UTTORI_VSCODE_ASSET_INTERCHANGE === "1" ||
        process.env.UTTORI_VSCODE_SOURCE_LAUNCH === "1" ||
        process.env.UTTORI_VSCODE_SOURCE_LIFECYCLE === "1"
      ) {
        // Only the disposable manifest points at the instrumented test entry.
        // Workers, resources and production composition come from the same build.
        const instrumented = path.join(isolation, "instrumented-extension");
        fs.mkdirSync(instrumented);
        for (const entry of fs.readdirSync(extensionDevelopmentPath)) {
          if (entry !== "package.json") {
            fs.symlinkSync(
              path.join(extensionDevelopmentPath, entry),
              path.join(instrumented, entry),
            );
          }
        }
        const manifest: unknown = JSON.parse(
          fs.readFileSync(path.join(extensionDevelopmentPath, "package.json"), "utf8"),
        );
        assertRecord(manifest, "extension package.json");
        // VS Code assigns API ownership from the real module path; a symlinked
        // entry would not own the debugger contribution in this disposable root.
        fs.copyFileSync(
          path.join(extensionDevelopmentPath, "tests-host/out/extension-driver.cjs"),
          path.join(instrumented, "entry.cjs"),
        );
        manifest.main = "./entry.cjs";
        fs.writeFileSync(path.join(instrumented, "package.json"), JSON.stringify(manifest));
        developmentPaths[0] = instrumented;
      }
      if (process.env.UTTORI_VSCODE_GIT_SOURCE === "1") {
        const driver = path.join(isolation, "asset-driver");
        fs.mkdirSync(driver);
        fs.writeFileSync(
          path.join(driver, "package.json"),
          JSON.stringify({
            name: "uttori-asset-test-driver",
            publisher: "uttori-tests",
            version: "0.0.0",
            engines: { vscode: `^${actual}` },
            main: process.env.UTTORI_VSCODE_ASSET_RECOVERY === "1" ? "index.js" : undefined,
            activationEvents:
              process.env.UTTORI_VSCODE_ASSET_RECOVERY === "1" ? ["onStartupFinished"] : undefined,
            contributes: {
              customEditors: [
                {
                  viewType: "uttori.paletteSmoke",
                  displayName: "Palette smoke",
                  selector: [{ filenamePattern: "**/rom-palettes.json" }],
                  priority: "option",
                },
                {
                  viewType: "uttori.pngSmoke",
                  displayName: "PNG smoke",
                  selector: [{ filenamePattern: "*.png" }],
                  priority: "option",
                },
              ],
            },
          }),
        );
        if (process.env.UTTORI_VSCODE_ASSET_RECOVERY === "1") {
          fs.copyFileSync(
            path.join(extensionDevelopmentPath, "tests-host/out/asset-recovery-driver.cjs"),
            path.join(driver, "index.js"),
          );
        }
        developmentPaths.push(driver);
      }
      const phases = process.env.UTTORI_VSCODE_ASSET_RECOVERY === "1" ? ["draft", "recover"] : [""];
      if (phases.length > 1) {
        fs.mkdirSync(path.join(isolation, "profile/User"), { recursive: true });
        fs.writeFileSync(
          path.join(isolation, "profile/User/settings.json"),
          JSON.stringify({
            "files.hotExit": "onExitAndWindowClose",
            "window.restoreWindows": "all",
            "files.autoSave": "off",
          }),
        );
        // Normal installed-extension windows receive a persistent text-backup path.
        // Development windows can retain custom backup IDs while omitting text backups.
        const installed = path.join(isolation, "extensions");
        fs.mkdirSync(installed, { recursive: true });
        fs.symlinkSync(
          extensionDevelopmentPath,
          path.join(installed, "matthewcallis.uttori-asm-vscode-1.0.0"),
          "dir",
        );
        fs.symlinkSync(
          path.join(isolation, "asset-driver"),
          path.join(installed, "uttori-tests.uttori-asset-test-driver-0.0.0"),
          "dir",
        );
      }
      const launchArgs = [
        path.resolve(process.env.UTTORI_VSCODE_LIVE_WORKSPACE),
        "--user-data-dir",
        path.join(isolation, "profile"),
        "--extensions-dir",
        path.join(isolation, "extensions"),
        "--shared-data-dir",
        path.join(isolation, "shared"),
        "--disable-extensions",
        "--disable-gpu",
        "--disable-workspace-trust",
        "--skip-welcome",
        "--skip-release-notes",
        "--disable-updates",
      ];
      for (const phase of phases) {
        if (!phase) {
          await runTests({
            version,
            vscodeExecutablePath,
            extensionDevelopmentPath: developmentPaths,
            extensionTestsPath,
            launchArgs,
          });
          continue;
        }
        // Extension-test hosts intentionally use in-memory workbench storage.
        // The disposable driver runs assertions in ordinary hosts for hot exit.
        const resultFile = path.join(isolation, `recovery-${phase}.json`);
        await new Promise<void>((resolve, reject) => {
          const child = spawn(
            vscodeExecutablePath,
            launchArgs.filter((item) => item !== "--disable-extensions"),
            {
              stdio: "inherit",
              env: {
                ...process.env,
                UTTORI_VSCODE_NATIVE_RECOVERY: "1",
                UTTORI_VSCODE_ASSET_RECOVERY_PHASE: phase,
                UTTORI_VSCODE_ASSET_RECOVERY_RESULT: resultFile,
              },
            },
          );
          const timer = setTimeout(() => {
            child.kill("SIGTERM");
            reject(new Error(`Asset recovery ${phase} timed out.`));
          }, 120000);
          child.once("error", (error) => {
            clearTimeout(timer);
            reject(error);
          });
          child.once("exit", (code) => {
            clearTimeout(timer);
            if (code !== 0) {
              reject(new Error(`Asset recovery host exited ${code}.`));
              return;
            }
            try {
              const result: unknown = JSON.parse(fs.readFileSync(resultFile, "utf8"));
              assertRecord(result, "asset recovery result");
              if (result.success !== true || result.phase !== phase) {
                throw new Error(
                  typeof result.error === "string"
                    ? result.error
                    : "Asset recovery did not complete its phase.",
                );
              }
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          });
        });
      }
      completed = true;
    } finally {
      if (process.env.UTTORI_VSCODE_GIT_SOURCE === "1") {
        const destination = path.join(
          path.resolve(process.env.UTTORI_VSCODE_LIVE_WORKSPACE),
          ".verification",
          "editor-host-logs",
        );
        // Retain only this disposable host's diagnostics; never copy its profile or hot-exit state.
        if (fs.existsSync(path.join(isolation, "profile/logs"))) {
          fs.cpSync(path.join(isolation, "profile/logs"), destination, { recursive: true });
        }
        console.error(`Editor diagnostics retained at ${destination}`);
      }
      if (completed || process.env.UTTORI_VSCODE_ASSET_RECOVERY !== "1") {
        fs.rmSync(isolation, { recursive: true, force: true });
      } else {
        console.error(`Failed hot-exit profile retained for inspection: ${isolation}`);
      }
    }
    return;
  }
  const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-vscode-smoke-"));
  try {
    fs.writeFileSync(
      path.join(workspacePath, "main.asm"),
      "lorom\norg $008000\nStart:\n  sei\nRAM_EASTER_EGG_COUNTER = $7E002B\n  LDA.w RAM_EASTER_EGG_COUNTER & $FFFF,x\n  RTS\n",
    );
    publishAnalysisProject(path.join(workspacePath, "analysis"), {
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
        runtime: ["a", "b"].flatMap((source) =>
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
        actual,
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
