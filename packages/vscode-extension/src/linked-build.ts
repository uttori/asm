import path from "node:path";

import {
  readAssemblyBuildResult,
  type AssemblyBuildOperation,
  type AssemblyBuildResult,
  type AssemblyLinkedResult,
} from "@uttori/asm-workflows/build-contracts";
import { resolveAssemblyBuildSelection } from "@uttori/asm-workflows/build-selection";
import {
  commands,
  EventEmitter,
  ProgressLocation,
  TabInputCustom,
  Uri,
  window,
  workspace,
  type Disposable,
  type ExtensionContext,
  type LogOutputChannel,
} from "vscode";

import type { BinaryDrafts } from "./assets/binary-drafts.js";
import { SourceProcessClient } from "./source/process-client.js";

/** Explicit native tool commands and opt-in Build/Run/Debug share the same isolated worker. */
export class LinkedBuildController implements Disposable {
  readonly #worker: SourceProcessClient;
  readonly #commands: Disposable[];
  readonly #inputs = new Set<string>();
  readonly #builds = new Map<string, AssemblyLinkedResult>();
  readonly #changed = new EventEmitter<Uri>();
  readonly onDidChangeInput = this.#changed.event;
  #busy = false;

  constructor(
    context: ExtensionContext,
    readonly output: LogOutputChannel,
    readonly binaryDrafts: BinaryDrafts,
  ) {
    this.#worker = new SourceProcessClient(
      context.asAbsolutePath("out/source-process.mjs"),
      (message) => output.info(message),
    );
    const files = workspace.createFileSystemWatcher("**/*");
    const changed = (uri: Uri): void => {
      if (this.tracks(uri.fsPath)) {
        this.#changed.fire(uri);
      }
    };
    this.#commands = [
      files,
      files.onDidChange(changed),
      files.onDidCreate(changed),
      files.onDidDelete(changed),
      binaryDrafts.onDidChange(changed),
      commands.registerCommand("asm.object.assemble", (uri?: Uri) =>
        this.guard(() => this.assemble(uri)),
      ),
      commands.registerCommand("asm.library.create", () => this.guard(() => this.library())),
      commands.registerCommand("asm.link", (uri?: Uri) =>
        this.guard(() => this.manifest("link", uri)),
      ),
      commands.registerCommand("asm.linked.build", (uri?: Uri) =>
        this.guard(() => this.manifest("build-linked", uri)),
      ),
    ];
  }

  /** Watch reacts to consumed sources, resources, recipes, configuration and serialized inputs. */
  tracks(file: string): boolean {
    return this.#inputs.has(path.resolve(file));
  }

  /** An absent manifest preserves the existing build route; an invalid opted-in build fails without falling back. */
  async buildConfigured(uri?: Uri): Promise<AssemblyLinkedResult | undefined> {
    const folder = uri ? workspace.getWorkspaceFolder(uri) : workspace.workspaceFolders?.[0];
    if (!folder) {
      return undefined;
    }
    const settings = workspace.getConfiguration("asm", uri ?? folder.uri);
    const selection = await resolveAssemblyBuildSelection(
      folder.uri.fsPath,
      settings.get<string>("configFile", "") || undefined,
      settings.get<string>("linkProject", ""),
    );
    const manifest = selection.manifest;
    if (selection.configurationFile) {
      this.#inputs.add(selection.configurationFile);
    }
    if (!manifest) {
      return undefined;
    }
    this.#inputs.add(manifest);
    const result = await this.run({
      action: "build-linked",
      directory: path.dirname(manifest),
      manifest,
      ...(selection.configurationFile && selection.configurationSha256
        ? {
            selection: { file: selection.configurationFile, sha256: selection.configurationSha256 },
          }
        : {}),
    });
    if (result.kind !== "linked") {
      throw new Error("Expected a linked ROM build.");
    }
    // Compare against the artifacts last returned to this editor, rather than an unrelated
    // CLI publication that may have switched current.json since the emulator was launched.
    const previous = this.#builds.get(manifest);
    const build = {
      ...result,
      outputChanged: previous?.outputSha256 !== result.outputSha256,
      debugMapChanged: previous?.debugMapFingerprint !== result.debugMapFingerprint,
    };
    this.#builds.set(manifest, build);
    this.#inputs.clear();
    for (const input of result.inputs) {
      this.#inputs.add(input.path);
    }
    return build;
  }

  /** Capture versions before spawning; neither dirty inputs nor mid-build edits may authorize publication. */
  private async run(operation: AssemblyBuildOperation): Promise<AssemblyBuildResult> {
    if (!workspace.isTrusted) {
      throw new Error("Trust this workspace before running assembly tools or plugins.");
    }
    if (this.#busy) {
      throw new Error("An assembly build operation is already running.");
    }
    const versions = new Map(
      workspace.textDocuments.map((document) => [document.uri.fsPath, document.version]),
    );
    const binaryVersions = new Map(
      [...this.binaryDrafts.documents].map((document) => [document.uri.fsPath, document.version]),
    );
    this.#busy = true;
    try {
      return await window.withProgress(
        { location: ProgressLocation.Notification, title: "Assembly build", cancellable: true },
        async (progress, token) => {
          const cancellation = new AbortController();
          const listener = token.onCancellationRequested(() => cancellation.abort());
          try {
            return await this.#worker.run(operation, {
              maxMemoryMiB: workspace
                .getConfiguration("asm")
                .get<number>("analysis.maxMemoryMiB", 4096),
              signal: cancellation.signal,
              onProgress: (message) => progress.report({ message }),
              readResult: readAssemblyBuildResult,
              onBeforePublish: (paths) => {
                const consumed = new Set(paths.map((file) => path.resolve(file)));
                // Keep the previous dependency set until the next complete check, so a failed
                // rebuild can still be retried by saving the input that broke it.
                for (const file of consumed) {
                  this.#inputs.add(file);
                }
                for (const document of workspace.textDocuments) {
                  if (
                    consumed.has(document.uri.fsPath) &&
                    (document.isDirty ||
                      (versions.has(document.uri.fsPath) &&
                        versions.get(document.uri.fsPath) !== document.version))
                  ) {
                    throw new Error(`Save changed build input and rebuild: ${document.uri.fsPath}`);
                  }
                }
                for (const document of this.binaryDrafts.documents) {
                  if (
                    consumed.has(document.uri.fsPath) &&
                    (document.dirty ||
                      (binaryVersions.has(document.uri.fsPath) &&
                        binaryVersions.get(document.uri.fsPath) !== document.version))
                  ) {
                    throw new Error(`Save changed build asset and rebuild: ${document.uri.fsPath}`);
                  }
                }
                for (const group of window.tabGroups.all) {
                  for (const tab of group.tabs) {
                    if (
                      tab.isDirty &&
                      tab.input instanceof TabInputCustom &&
                      consumed.has(tab.input.uri.fsPath)
                    ) {
                      throw new Error(
                        `Save changed build asset and rebuild: ${tab.input.uri.fsPath}`,
                      );
                    }
                  }
                }
              },
            });
          } finally {
            listener.dispose();
          }
        },
      );
    } finally {
      this.#busy = false;
    }
  }

  private async assemble(uri?: Uri): Promise<void> {
    const source = uri ?? window.activeTextEditor?.document.uri;
    if (!source || source.scheme !== "file") {
      throw new Error("Open a saved assembly source file first.");
    }
    const root = workspace.getWorkspaceFolder(source)?.uri.fsPath ?? path.dirname(source.fsPath);
    const module = await window.showInputBox({
      title: "Stable module ID",
      value: path.relative(root, source.fsPath).replace(/\.[^.]+$/, ""),
    });
    if (!module) {
      return;
    }
    const adapter = await window.showQuickPick(
      [
        {
          label: "Native sections",
          description: "Use explicit sections and a link recipe",
          sourceAdapter: undefined,
        },
        {
          label: "Asar source",
          description: "Adapt ORG/BASE layout to relocatable contributions",
          sourceAdapter: "asar" as const,
        },
        {
          label: "ca65 source",
          description: "Reuse segments and configured linker layout",
          sourceAdapter: "ca65" as const,
        },
      ],
      { title: "Object source style" },
    );
    if (!adapter) {
      return;
    }
    const output = await window.showSaveDialog({
      defaultUri: Uri.file(source.fsPath.replace(/\.[^.]+$/, "") + ".uobj"),
      filters: { "Uttori object": ["uobj"] },
    });
    if (!output) {
      return;
    }
    const config = workspace.getConfiguration("asm", source).get<string>("configFile", "");
    await this.run({
      action: "assemble-object",
      directory: root,
      source: source.fsPath,
      output: output.fsPath,
      module,
      ...(adapter.sourceAdapter ? { sourceAdapter: adapter.sourceAdapter } : {}),
      ...(config ? { config } : {}),
    });
    void window.showInformationMessage(`Assembly: object written to ${output.fsPath}.`);
  }

  private async library(): Promise<void> {
    const inputs = await window.showOpenDialog({
      canSelectMany: true,
      filters: { "Uttori objects": ["uobj"] },
      openLabel: "Choose library members",
    });
    if (!inputs?.length) {
      return;
    }
    const output = await window.showSaveDialog({
      defaultUri: Uri.file(path.join(path.dirname(inputs[0].fsPath), "library.ulib")),
      filters: { "Uttori library": ["ulib"] },
    });
    if (!output) {
      return;
    }
    await this.run({
      action: "library",
      directory: path.dirname(output.fsPath),
      output: output.fsPath,
      objects: inputs.map((input) => input.fsPath),
    });
    void window.showInformationMessage(`Assembly: library written to ${output.fsPath}.`);
  }

  private async manifest(action: "link" | "build-linked", uri?: Uri): Promise<void> {
    const selected =
      uri ??
      (
        await window.showOpenDialog({
          filters: { "Build manifest": ["json"] },
          openLabel: "Choose build manifest",
        })
      )?.[0];
    if (!selected) {
      return;
    }
    const result = await this.run({
      action,
      directory: path.dirname(selected.fsPath),
      manifest: selected.fsPath,
    });
    void window.showInformationMessage(`Assembly: built ${result.outputFile}.`);
  }

  /** Command errors remain visible without escaping as unhandled extension-host rejections. */
  private async guard(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.error(message);
      void window.showErrorMessage(`Assembly: ${message}`);
    }
  }

  dispose(): void {
    this.#worker.dispose();
    this.#changed.dispose();
    for (const command of this.#commands) {
      command.dispose();
    }
  }
}
