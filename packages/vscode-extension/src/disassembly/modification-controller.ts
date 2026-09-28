import fs from "node:fs";
import path from "node:path";

import type { DebugMap } from "@uttori/asm-core/debug-map";
import {
  findManagedSourceFile,
  sourceExportSha256,
  loadSourceOwnership,
  loadSourceExportManifest,
  sourceOwnersAt,
  RomImage,
} from "@uttori/asm-disassembler";
import { loadRomModificationProject } from "@uttori/asm-plugin-snes";
import {
  commands,
  env,
  ConfigurationTarget,
  ProgressLocation,
  RelativePattern,
  StatusBarAlignment,
  Uri,
  window,
  workspace,
  type Disposable,
  type ExtensionContext,
  type LogOutputChannel,
} from "vscode";

import { rememberSnesRom } from "../project/snes-rom-bindings.js";
import { DisassemblyMaintenanceClient } from "./maintenance-client.js";
import type { MaintenanceJobs } from "./maintenance-jobs.js";
import { resolveTarget } from "./maintenance.js";
import { openRomWorkbench } from "./rom-workbench.js";

/** Common artifact fields consumed by the existing run/debug paths. */
export interface TargetBuildResult {
  readonly ok: boolean;
  readonly outputPath?: string;
  readonly debugMapPath?: string;
  readonly outputSha256?: string;
  readonly debugMapFingerprint?: string;
  readonly bytes?: number;
  readonly outputChanged?: boolean;
  readonly debugMapChanged?: boolean;
  readonly message?: string;
}

/** Editor entry points for owned replacements; long-running assembly stays in maintenance processes. */
export class ModificationController implements Disposable {
  readonly #worker: DisassemblyMaintenanceClient;
  readonly #subscriptions: Disposable[] = [];
  readonly #status = window.createStatusBarItem(StatusBarAlignment.Left, -1);
  #building = false;
  /** A watch keeps the same baseline selection until its target settings change. */
  #baseline?: Awaited<ReturnType<typeof resolveTarget>>;
  #inputWatcher?: Disposable;
  /** Baseline publication/input changes also invalidate modified watch builds. Output artifacts are excluded. */
  readonly #baselineInputs = new Set<string>();

  constructor(
    readonly context: ExtensionContext,
    readonly output: LogOutputChannel,
    readonly targetChanged: () => void,
    readonly buildCompleted: (result: TargetBuildResult) => void,
    readonly inputChanged: () => void,
  ) {
    this.#worker = new DisassemblyMaintenanceClient(
      path.join(context.extensionPath, "out/disassembly-maintenance-process.cjs"),
      output,
    );
    this.#status.command = "asm.buildTarget.select";
    const register = (name: string, callback: () => Promise<unknown>): void => {
      this.#subscriptions.push(
        commands.registerCommand(name, async () => {
          try {
            return await callback();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            output.error(message);
            void window.showErrorMessage(`Assembly: ${message}`);
            return undefined;
          }
        }),
      );
    };
    register("asm.buildTarget.select", () => this.select());
    register("asm.modification.create", () => this.create());
    register("asm.modification.edit", async () => {
      const manifestFile = await this.manifest();
      if (manifestFile) {
        this.#subscriptions.push(
          openRomWorkbench(this.context.extensionUri, manifestFile, (operation, input) =>
            this.run(operation, input),
          ),
        );
      }
    });
    for (const [command, tab] of [
      ["asm.asset.edit", "edit"],
      ["asm.metadata.migrate", "migration"],
      ["asm.retention.manage", "retention"],
    ]) {
      register(command, async () => {
        const manifestFile = await this.manifest();
        if (manifestFile) {
          this.#subscriptions.push(
            openRomWorkbench(
              this.context.extensionUri,
              manifestFile,
              (operation, input) => this.run(operation, input),
              tab,
            ),
          );
        }
      });
    }
    register("asm.modification.add", () => this.add());
    register("asm.modification.open", async () => {
      const file = await this.manifest();
      if (file) {
        await window.showTextDocument(Uri.file(file));
      }
    });
    register("asm.modification.build", async () => {
      if (await this.useModified()) {
        return commands.executeCommand("asm.build");
      }
      return undefined;
    });
    register("asm.modification.run", async () => {
      if (await this.useModified()) {
        return commands.executeCommand("asm.runEmulator");
      }
      return undefined;
    });
    register("asm.modification.debug", async () => {
      if (await this.useModified()) {
        return commands.executeCommand("asm.debugEmulator");
      }
      return undefined;
    });
    register("asm.modification.watch", async () => {
      if (await this.useModified()) {
        return commands.executeCommand("asm.runAndWatch");
      }
      return undefined;
    });
    register("asm.baseline.verify", async () => {
      await this.setTarget("baseline");
      return commands.executeCommand("asm.build");
    });
    register("asm.modification.derive", () => this.derive());
    register("asm.modification.openInput", () => this.openReplacement());
    register("asm.asset.openExternal", () => this.openAssetExternally());
    register("asm.modification.remove", () => this.removeReplacement());
    register("asm.asset.extract", () => this.assetExtract());
    register("asm.asset.import", () => this.assetImport());
    register("asm.allocation.review", () => this.placementReview());
    register("asm.allocation.apply", () => this.placementApply());
    register("asm.rebase.review", () => this.rebaseReview());
    register("asm.rebase.accept", () => this.rebaseAccept());
    register("asm.rebase.refresh", () => this.rebaseRefresh());
    register("asm.source.review", () => this.sourceReview());
    register("asm.source.import", () => this.sourceImport());
    register("asm.source.restore", () => this.sourceRestore());
    register("asm.source.detach", () => this.detachSource());
    this.#subscriptions.push(
      workspace.onDidChangeConfiguration((event) => {
        if (
          event.affectsConfiguration("asm.buildTarget") ||
          event.affectsConfiguration("asm.modificationProject")
        ) {
          this.#baseline = undefined;
          targetChanged();
          this.updateStatus();
          this.watchInputs();
        }
      }),
    );
    this.updateStatus();
    this.#status.show();
    this.watchInputs();
  }

  /** All target settings are workspace-wide so moving the cursor cannot switch a running watch target.
   * @returns {string} Explicit build contract for all build/run commands.
   */
  get target(): "configured" | "baseline" | "modified" {
    return workspace.getConfiguration("asm").get("buildTarget", "configured");
  }
  get configuredManifest(): string | undefined {
    const relative = workspace.getConfiguration("asm").get<string>("modificationProject", "");
    if (!relative) {
      return undefined;
    }
    const root = workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root && !path.isAbsolute(relative)) {
      return undefined;
    }
    return path.resolve(root ?? ".", relative);
  }

  /** Modified watches include manifest, interface, assembly includes and binary inputs, excluding build outputs.
   * @param {string} file Absolute changed filename.
   * @returns {boolean} Whether this change should rebuild the modified target.
   */
  watches(file: string): boolean {
    const manifest = this.configuredManifest;
    if (this.target !== "modified" || !manifest) {
      return false;
    }
    if (this.#baselineInputs.has(path.resolve(file))) {
      return true;
    }
    const relative = path.relative(path.dirname(manifest), file).split(path.sep).join("/");
    return (
      relative === "modification.json" ||
      relative === "baseline-interface.asm" ||
      relative.startsWith("inputs/")
    );
  }

  /** Route generic Build/Run/Debug through the selected target. Undefined retains ordinary assembly projects.
   * @returns {Promise<TargetBuildResult | undefined>} Successful artifact identity or an explicit failed/cancelled outcome.
   */
  async build(): Promise<TargetBuildResult | undefined> {
    if (this.target === "configured") {
      return undefined;
    }
    if (this.#building) {
      return { ok: false, message: "A target build is already running." };
    }
    this.#building = true;
    try {
      let result: TargetBuildResult;
      if (this.target === "modified") {
        const manifestFile = await this.manifest();
        if (!manifestFile) {
          return { ok: false, message: "No modification project selected." };
        }
        const built = await this.run("modificationBuild", { manifestFile });
        result = built;
        this.output.info(
          `Modified ROM verified: ${built.changedBytes} changed byte(s). Baseline runtime evidence applies only to its original ROM; analyze this ROM for new evidence. Receipt: ${built.receiptFile}`,
        );
      } else {
        const target = this.#baseline ?? (await resolveTarget(this.context));
        if (!target) {
          return { ok: false, message: "Baseline selection cancelled." };
        }
        this.#baseline = target;
        const verified = await this.run("verify", target);
        const map = JSON.parse(fs.readFileSync(verified.debugMap!, "utf8")) as DebugMap;
        result = {
          ok: true,
          outputPath: verified.contentOutput,
          debugMapPath: verified.debugMap,
          outputSha256: map.output.sha256,
          debugMapFingerprint: map.fingerprint.value,
          bytes: map.output.size,
        };
      }
      this.buildCompleted(result);
      const message = `Assembly: ${this.target} verified → ${result.outputPath}`;
      this.output.info(message);
      window.setStatusBarMessage(message, 6000);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.error(message);
      void window.showErrorMessage(`Assembly: ${message}`);
      return { ok: false, message };
    } finally {
      this.#building = false;
    }
  }

  private updateStatus(): void {
    let label = "Assembly";
    if (this.target === "baseline") {
      label = "Baseline";
    } else if (this.target === "modified") {
      label = "Modified ROM";
    }
    this.#status.text = `$(circuit-board) ${label}`;
    this.#status.tooltip = "Select the target for Build, Run, Debug and Watch";
  }
  /** Watch binary edits made outside VS Code as well as editor saves; never watch generated outputs. */
  private watchInputs(): void {
    this.#inputWatcher?.dispose();
    this.#baselineInputs.clear();
    const manifest = this.configuredManifest;
    if (!manifest) {
      return;
    }
    const watcher = workspace.createFileSystemWatcher(
      new RelativePattern(path.dirname(manifest), "**/*"),
    );
    const changed = (uri: Uri): void => {
      if (this.watches(uri.fsPath)) {
        this.inputChanged();
      }
    };
    const subscriptions = [
      watcher,
      watcher.onDidChange(changed),
      watcher.onDidCreate(changed),
      watcher.onDidDelete(changed),
    ];
    try {
      const project = loadRomModificationProject(manifest);
      const source = path.resolve(path.dirname(manifest), project.baseline.sourceDirectory);
      const exported = loadSourceExportManifest(source);
      for (const name of [
        "generated-files.json",
        ".uttori-publication.json",
        ...exported.files.map((entry) => entry.path),
        ...(exported.inputs ?? []).map((entry) => entry.path),
      ]) {
        this.#baselineInputs.add(path.join(source, name));
      }
      const baselineWatcher = workspace.createFileSystemWatcher(
        new RelativePattern(source, "**/*"),
      );
      subscriptions.push(
        baselineWatcher,
        baselineWatcher.onDidChange(changed),
        baselineWatcher.onDidCreate(changed),
        baselineWatcher.onDidDelete(changed),
      );
    } catch (error) {
      this.output.warn(`Baseline watch unavailable: ${String(error)}`);
    }
    this.#inputWatcher = {
      dispose: () => {
        for (const subscription of subscriptions) {
          subscription.dispose();
        }
      },
    };
  }
  private async setTarget(target: "configured" | "baseline" | "modified"): Promise<void> {
    if (this.target === target) {
      return;
    }
    this.targetChanged();
    await workspace
      .getConfiguration("asm")
      .update("buildTarget", target, ConfigurationTarget.Workspace);
    this.updateStatus();
  }
  private async select(): Promise<void> {
    const selected = await window.showQuickPick(
      [
        { label: "Baseline — exact ROM verification", target: "baseline" as const },
        { label: "Modified ROM — owned replacements", target: "modified" as const },
        { label: "Configured assembly project", target: "configured" as const },
      ],
      { title: "Build / Run / Debug / Watch target" },
    );
    if (selected?.target === "modified") {
      await this.useModified();
    } else if (selected) {
      this.#baseline = undefined;
      await this.setTarget(selected.target);
    }
  }
  private async useModified(): Promise<boolean> {
    if (!(await this.manifest())) {
      return false;
    }
    await this.setTarget("modified");
    return true;
  }
  private async manifest(): Promise<string | undefined> {
    let file = this.configuredManifest;
    if (!file) {
      file = (
        await window.showOpenDialog({
          title: "Select modification.json",
          canSelectMany: false,
          filters: { "Modification project": ["json"] },
        })
      )?.[0]?.fsPath;
      if (!file) {
        return undefined;
      }
      loadRomModificationProject(file);
      await workspace
        .getConfiguration("asm")
        .update("modificationProject", file, ConfigurationTarget.Workspace);
    }
    const project = loadRomModificationProject(file);
    if (!project.baseline.snapshotDirectory) {
      await this.run("baselineRetain", { manifestFile: file });
    }
    return file;
  }

  /** Create alongside generated source, keeping modification generations outside export staging. */
  private async create(): Promise<void> {
    const target = await resolveTarget(this.context);
    if (!target) {
      return;
    }
    const name = await window.showInputBox({
      title: "New modification project",
      prompt: "Name for a new user-owned directory alongside the disassembly",
      value: "modifications",
      validateInput: (value) =>
        /^[\w-]+$/.test(value) ? undefined : "Use letters, digits, underscores or hyphens.",
    });
    if (!name) {
      return;
    }
    const directory = path.join(path.dirname(target.sourceDirectory), name);
    const file = await this.run("modificationCreate", {
      sourceDirectory: target.sourceDirectory,
      romFile: target.romFile,
      directory,
    });
    await workspace
      .getConfiguration("asm")
      .update("modificationProject", file, ConfigurationTarget.Workspace);
    await this.setTarget("modified");
    await window.showTextDocument(Uri.file(file));
    const action = await window.showInformationMessage(
      "Modification project created. Add a bounded replacement to start editing ROM bytes.",
      "Add Replacement",
    );
    if (action) {
      await this.add();
    }
  }

  /** Review the actual baseline bytes before creating an owned assembly or binary input. */
  private async add(): Promise<void> {
    const editor = window.activeTextEditor;
    let suggestedOffset: number | undefined;
    let suggestedSize = 2;
    if (editor && !editor.document.isDirty) {
      const managed = findManagedSourceFile(editor.document.uri.fsPath);
      if (managed) {
        const map = loadSourceOwnership(managed);
        const owner =
          map &&
          sourceOwnersAt(
            map,
            managed.relative,
            editor.document.getText(),
            editor.selection.active.line + 1,
            editor.selection.active.character,
          ).find((entry) => entry.outputStart !== undefined);
        suggestedOffset = owner?.outputStart;
        if (owner?.outputEnd !== undefined && suggestedOffset !== undefined) {
          suggestedSize = owner.outputEnd - suggestedOffset;
        }
      }
    }
    const manifestFile = await this.manifest();
    if (!manifestFile) {
      return;
    }
    const project = loadRomModificationProject(manifestFile);
    const kind = await window.showQuickPick(
      ["16-bit value (little-endian)", "Assembly instructions or data", "Binary data"],
      { title: "New ROM replacement" },
    );
    if (!kind) {
      return;
    }
    const id = await window.showInputBox({
      title: "Replacement name",
      prompt: "Also available to other replacements as Patch_<name>",
      validateInput: (value) =>
        /^[A-Z_a-z]\w*$/.test(value) ? undefined : "Use an assembly identifier.",
    });
    if (!id) {
      return;
    }
    const parse = (value: string): number => Number(value.replace(/^\$/, "0x"));
    const offsetText = await window.showInputBox({
      title: "Headerless ROM byte offset",
      prompt:
        "Use decimal, 0x hexadecimal, or $ hexadecimal. This is a file offset, not a CPU address.",
      value: suggestedOffset === undefined ? "" : `0x${suggestedOffset.toString(16)}`,
      validateInput: (value) =>
        value.trim() &&
        Number.isSafeInteger(parse(value)) &&
        parse(value) >= 0 &&
        parse(value) < project.baseline.rom.contentSize
          ? undefined
          : "Enter an offset within the baseline ROM.",
    });
    if (!offsetText) {
      return;
    }
    const offset = parse(offsetText);
    let size = 2;
    if (kind !== "16-bit value (little-endian)") {
      const sizeText = await window.showInputBox({
        title: "Exact replacement size in bytes",
        value: String(suggestedSize),
        validateInput: (value) =>
          Number.isSafeInteger(parse(value)) &&
          parse(value) > 0 &&
          parse(value) <= 65536 &&
          offset + parse(value) <= project.baseline.rom.contentSize
            ? undefined
            : "Enter a positive size within the ROM (maximum 65536 bytes).",
      });
      if (!sizeText) {
        return;
      }
      size = parse(sizeText);
    }
    const rom = RomImage.load(path.resolve(path.dirname(manifestFile), project.baseline.romFile), {
      headerSize: project.baseline.rom.headerSize,
    });
    const original = Buffer.from(rom.read(offset, size) ?? []);
    if (original.length !== size || rom.identity.sha256 !== project.baseline.rom.sha256) {
      throw new Error("Baseline bytes do not match this project.");
    }
    let value: number | undefined;
    if (kind === "16-bit value (little-endian)") {
      const newValue = await window.showInputBox({
        title: `Original uint16: ${original.readUInt16LE(0)} (${original.toString("hex")})`,
        prompt: "New unsigned 16-bit value. Confirm the field's encoding before editing.",
        value: String(original.readUInt16LE(0)),
        validateInput: (text) =>
          text.trim() &&
          Number.isSafeInteger(parse(text)) &&
          parse(text) >= 0 &&
          parse(text) <= 65535
            ? undefined
            : "Enter an integer from 0 to 65535.",
      });
      if (newValue === undefined) {
        return;
      }
      value = parse(newValue);
    }
    const action = await window.showInformationMessage(
      `Create ${id} at ROM offset 0x${offset.toString(16)} (${size} bytes)? Original: ${original.subarray(0, 32).toString("hex")}${size > 32 ? "…" : ""}`,
      { modal: true },
      "Create Replacement",
    );
    if (!action) {
      return;
    }
    const input = await this.run("modificationAdd", {
      manifestFile,
      id,
      offset,
      size,
      kind: kind === "Binary data" ? "binary" : "assembly",
      ...(value === undefined ? {} : { value }),
    });
    await this.setTarget("modified");
    await commands.executeCommand("vscode.open", Uri.file(input));
  }

  /** Choose a stable owner rather than requiring users to locate a manifest array entry.
   * @param {readonly string[]} [kinds] Optional supported input-kind filter.
   * @returns {Promise<object | undefined>} Selected owner or cancellation.
   */
  private async chooseReplacement(
    kinds?: readonly string[],
  ): Promise<
    { manifestFile: string; entry: import("@uttori/asm-plugin-snes").RomReplacement } | undefined
  > {
    const manifestFile = await this.manifest();
    if (!manifestFile) {
      return undefined;
    }
    const project = loadRomModificationProject(manifestFile);
    const picked = await window.showQuickPick(
      project.replacements
        .filter((entry) => !kinds || kinds.includes(entry.kind))
        .map((entry) => ({
          label: entry.id,
          description: `${entry.kind} · ROM 0x${entry.offset.toString(16)} · ${entry.expected.length / 2} bytes`,
          entry,
        })),
      {
        title: "Select owned ROM range",
        placeHolder: "Use Add ROM Replacement to own a new range first",
      },
    );
    return picked ? { manifestFile, entry: picked.entry } : undefined;
  }

  private async assetExtract(): Promise<void> {
    const selected = await this.chooseReplacement(["binary"]);
    if (!selected) {
      return;
    }
    const format = await window.showQuickPick(
      [
        "snes.tile.2bpp",
        "snes.tile.3bpp",
        "snes.tile.4bpp",
        "snes.tile.8bpp",
        "snes.tile.mode7",
        "snes.palette.bgr555",
        "snes.tilemap.bg",
        "snes.tilemap.mode7",
        "snes.brr",
      ],
      {
        title: "Native asset format",
        placeHolder: "Choose the native decoded format; compression is selected explicitly next",
      },
    );
    if (!format) {
      return;
    }
    const encoding = await window.showQuickPick(
      ["Uncompressed native bytes", "Versioned compression pipeline JSON"],
      { title: "Asset storage encoding" },
    );
    if (!encoding) {
      return;
    }
    let transforms: import("@uttori/asm-plugin-snes").OwnedAssetRecipe["transforms"];
    if (encoding === "Versioned compression pipeline JSON") {
      const file = (
        await window.showOpenDialog({
          title: "Pipeline recipe JSON with transforms: [{id, version, options}]",
          filters: { JSON: ["json"] },
          canSelectMany: false,
        })
      )?.[0];
      if (!file) {
        return;
      }
      const recipe = JSON.parse(
        fs.readFileSync(file.fsPath, "utf8"),
      ) as import("@uttori/asm-plugin-snes").OwnedAssetRecipe;
      if (!recipe.transforms?.length) {
        throw new Error("Choose a recipe with explicit versioned transforms.");
      }
      transforms = recipe.transforms;
    }
    let paletteOffset: number | undefined;
    let paletteSize: number | undefined;
    if (format.startsWith("snes.tile.")) {
      const value = await window.showInputBox({
        title: "Palette ROM offset (headerless)",
        prompt: "Exact shared BGR555 palette used by these tiles; decimal, 0x or $ hexadecimal",
        validateInput: (text) =>
          Number.isSafeInteger(Number(text.replace(/^\$/, "0x"))) && text.trim()
            ? undefined
            : "Enter a ROM offset.",
      });
      if (value === undefined) {
        return;
      }
      paletteOffset = Number(value.replace(/^\$/, "0x"));
      const depth = Number(/\.([2-48])bpp$/.exec(format)?.[1] ?? 8);
      paletteSize = 2 * 2 ** depth;
    }
    const input = await this.run("assetExtract", {
      manifestFile: selected.manifestFile,
      id: selected.entry.id,
      format,
      paletteOffset,
      paletteSize,
      transforms,
    });
    await commands.executeCommand("vscode.open", Uri.file(input));
    void window.showInformationMessage(
      "Extracted and verified byte-for-byte. Edit this owned input; Build reencodes it. PNG palette slots are locked; shared palette changes require a separate palette owner.",
    );
  }

  private async assetImport(): Promise<void> {
    const selected = await this.chooseReplacement(["asset", "binary"]);
    if (!selected) {
      return;
    }
    const source = (
      await window.showOpenDialog({ title: "Import edited asset", canSelectMany: false })
    )?.[0];
    if (!source) {
      return;
    }
    let recipe = selected.entry.asset;
    if (!recipe) {
      const file = (
        await window.showOpenDialog({
          title:
            "Select explicit asset recipe JSON (format, version, mediaType, output/options/transforms)",
          filters: { JSON: ["json"] },
          canSelectMany: false,
        })
      )?.[0];
      if (!file) {
        return;
      }
      recipe = JSON.parse(
        fs.readFileSync(file.fsPath, "utf8"),
      ) as import("@uttori/asm-plugin-snes").OwnedAssetRecipe;
    }
    const input = await this.run("assetImport", {
      manifestFile: selected.manifestFile,
      id: selected.entry.id,
      sourceFile: source.fsPath,
      recipe,
    });
    await commands.executeCommand("vscode.open", Uri.file(input));
    void window.showInformationMessage(
      "Asset imported into owned inputs. Build validates its allocation and produces the modified ROM.",
    );
  }

  private async openReplacement(): Promise<void> {
    const selected = await this.chooseReplacement();
    if (selected) {
      await commands.executeCommand(
        "vscode.open",
        Uri.file(path.join(path.dirname(selected.manifestFile), selected.entry.input)),
      );
    }
  }

  /** External editors receive only the selected owned asset path, never a generated baseline file. */
  private async openAssetExternally(): Promise<void> {
    const selected = await this.chooseReplacement(["asset", "binary"]);
    if (!selected) {
      return;
    }
    const file = path.join(path.dirname(selected.manifestFile), selected.entry.input);
    if (!(await env.openExternal(Uri.file(file)))) {
      throw new Error(
        "No external application could open this asset. Choose an indexed-image editor through your operating system.",
      );
    }
  }

  private async removeReplacement(): Promise<void> {
    const selected = await this.chooseReplacement();
    if (!selected) {
      return;
    }
    const action = await window.showWarningMessage(
      `Remove ${selected.entry.id} from the modified ROM? Its input and prior manifest will be retained. References to Patch_${selected.entry.id} must be updated.`,
      { modal: true },
      "Remove Ownership",
    );
    if (action) {
      await this.run("replacementRemove", {
        manifestFile: selected.manifestFile,
        id: selected.entry.id,
      });
    }
  }

  /** Editable plans make allocation, fill and every pointer update concrete before applying them. */
  private async placementReview(): Promise<void> {
    const selected = await this.chooseReplacement();
    if (!selected) {
      return;
    }
    const project = loadRomModificationProject(selected.manifestFile);
    const file = path.join(path.dirname(selected.manifestFile), `placement-${Date.now()}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          manifestSha256: sourceExportSha256(fs.readFileSync(selected.manifestFile)),
          replacement: selected.entry.id,
          offset: selected.entry.offset,
          size: selected.entry.expected.length / 2,
          ...(selected.entry.fill === undefined ? {} : { fill: selected.entry.fill }),
          ...(project.expansion ? { expansion: project.expansion } : {}),
          pointers: [],
          instructions:
            "Set offset/size explicitly. Optional expansion: {size,fill}. Short binary/assets need fill. Add pointers: [{id,offset,width:2|3,bank (required for width 2),addend:0}]. No pointer discovery, checksum or ROM-header repair is implicit. Save, then run Apply ROM Allocation Plan.",
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    await window.showTextDocument(Uri.file(file));
  }

  private async placementApply(): Promise<void> {
    const manifestFile = await this.manifest();
    const editor = window.activeTextEditor;
    if (!manifestFile || !editor || editor.document.isDirty) {
      throw new Error("Open the saved allocation plan before applying it.");
    }
    const plan = JSON.parse(
      editor.document.getText(),
    ) as import("@uttori/asm-plugin-snes").RomPlacementPlan;
    const action = await window.showInformationMessage(
      `Apply allocation for ${plan.replacement} at ROM 0x${plan.offset.toString(16)}, ${plan.size} bytes, with ${plan.pointers.length} explicit pointer(s)?`,
      { modal: true },
      "Apply Allocation",
    );
    if (!action) {
      return;
    }
    await this.run("placementApply", { manifestFile, plan });
    await this.setTarget("modified");
    await commands.executeCommand("asm.build");
  }

  private async rebaseReview(): Promise<void> {
    const manifestFile = await this.manifest();
    if (!manifestFile) {
      return;
    }
    const target = await resolveTarget(this.context);
    if (!target) {
      return;
    }
    const destination = await window.showSaveDialog({
      title: "New rebased modification directory",
      defaultUri: Uri.file(
        path.join(path.dirname(path.dirname(manifestFile)), `modifications-rebased-${Date.now()}`),
      ),
    });
    if (!destination) {
      return;
    }
    const review = await this.run("rebaseReview", {
      manifestFile,
      sourceDirectory: target.sourceDirectory,
      romFile: target.romFile,
      directory: destination.fsPath,
    });
    await window.showTextDocument(Uri.file(review));
    void window.showInformationMessage(
      "Rebase draft retained base, incoming and owned ROMs. Resolve conflicts in resolutions. If symbols need reconciliation, edit the candidate inputs and run Refresh ROM Rebase Review before Accept ROM Rebase. Your active target has not changed.",
    );
  }

  private async rebaseRefresh(): Promise<void> {
    const editor = window.activeTextEditor;
    if (
      !editor ||
      editor.document.isDirty ||
      path.basename(editor.document.uri.fsPath) !== "rebase-review.json"
    ) {
      throw new Error("Open and save rebase-review.json before refreshing it.");
    }
    const reviewFile = editor.document.uri.fsPath;
    await this.run("rebaseRefresh", {
      reviewFile,
      reviewSha256: sourceExportSha256(fs.readFileSync(reviewFile)),
    });
    await window.showTextDocument(Uri.file(reviewFile));
    const review = JSON.parse(
      fs.readFileSync(reviewFile, "utf8"),
    ) as import("@uttori/asm-plugin-snes").RomRebaseReview;
    const first = review.editedInputs?.[0];
    if (first) {
      const original = path.join(path.dirname(reviewFile), ".old-owned", first);
      const edited = path.join(path.dirname(reviewFile), first);
      if (fs.existsSync(original) && fs.existsSync(edited)) {
        await commands.executeCommand(
          "vscode.diff",
          Uri.file(original),
          Uri.file(edited),
          "Reconciled rebase input",
        );
      }
    }
    void window.showInformationMessage(
      review.buildError ??
        "Candidate rebuilt. Review its updated output and editedInputs, then accept the rebase from rebase-review.json.",
    );
  }

  private async rebaseAccept(): Promise<void> {
    const editor = window.activeTextEditor;
    if (
      !editor ||
      editor.document.isDirty ||
      path.basename(editor.document.uri.fsPath) !== "rebase-review.json"
    ) {
      throw new Error("Open and save rebase-review.json before accepting it.");
    }
    const result = await this.run("rebaseAccept", { reviewFile: editor.document.uri.fsPath });
    await workspace
      .getConfiguration("asm")
      .update("modificationProject", result.manifestFile, ConfigurationTarget.Workspace);
    await this.setTarget("modified");
    this.buildCompleted(result.build);
    void window.showInformationMessage(
      "Rebased project verified and selected. The original modification project and its outputs remain available.",
    );
  }

  private async sourceReview(): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor || editor.document.isDirty) {
      throw new Error(
        "Save the generated source edit first so its exact bytes can be preserved and reviewed.",
      );
    }
    const sourceFile = editor.document.uri.fsPath;
    const manifestFile = await this.manifest();
    if (!manifestFile) {
      return;
    }
    const file = await this.run("sourceReview", { manifestFile, sourceFile });
    await window.showTextDocument(Uri.file(file));
    const review = JSON.parse(
      fs.readFileSync(file, "utf8"),
    ) as import("@uttori/asm-plugin-snes").SourceEditReview;
    await commands.executeCommand(
      "vscode.diff",
      Uri.file(review.baselineFile),
      Uri.file(review.draftFile),
      "Preserved generated source edit",
    );
    void window.showInformationMessage(
      review.unsupported ??
        "Supported edit preserved. Open review.json and run Import Reviewed Source Edit to transfer ownership and restore generated source.",
    );
  }

  private async sourceImport(): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor || editor.document.isDirty) {
      throw new Error("Open the saved source review.json before importing it.");
    }
    const reviewFile = editor.document.uri.fsPath;
    const review = JSON.parse(
      editor.document.getText(),
    ) as import("@uttori/asm-plugin-snes").SourceEditReview;
    if (review.format !== "uttori-source-edit-review" || review.unsupported) {
      throw new Error(review.unsupported ?? "Open a source edit review.");
    }
    const project = loadRomModificationProject(review.manifestFile);
    const sourceDirectory = path.resolve(
      path.dirname(review.manifestFile),
      project.baseline.sourceDirectory,
    );
    const target = await resolveTarget(this.context, { sourceDirectory });
    if (!target) {
      return;
    }
    const action = await window.showInformationMessage(
      `Import the reviewed ${review.metadata ? "metadata operation" : "ROM replacement"} and restore ${review.relative}? The exact draft remains saved.`,
      { modal: true },
      "Import Reviewed Edit",
    );
    if (!action) {
      return;
    }
    const result = await this.run("sourceImport", {
      reviewFile,
      reviewSha256: sourceExportSha256(fs.readFileSync(reviewFile)),
      target,
    });
    void window.showInformationMessage(result);
  }

  private async sourceRestore(): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor || editor.document.isDirty) {
      throw new Error("Open the saved source review.json before restoring it.");
    }
    const reviewFile = editor.document.uri.fsPath;
    const review = JSON.parse(
      editor.document.getText(),
    ) as import("@uttori/asm-plugin-snes").SourceEditReview;
    if (review.format !== "uttori-source-edit-review") {
      throw new Error("Choose a source edit review.");
    }
    const action = await window.showWarningMessage(
      `Restore ${review.relative} from the verified baseline? Your exact edit remains at ${review.draftFile}.`,
      { modal: true },
      "Restore Generated File",
    );
    if (!action) {
      return;
    }
    const result = await this.run("sourceRestore", {
      reviewFile,
      reviewSha256: sourceExportSha256(fs.readFileSync(reviewFile)),
    });
    void window.showInformationMessage(result.detail);
  }

  private async detachSource(): Promise<void> {
    // A saved review can be detached even when its live generated file fails integrity.
    const editor = window.activeTextEditor;
    let draft: { reviewFile: string; sha256: string } | undefined;
    if (
      editor &&
      !editor.document.isDirty &&
      path.basename(editor.document.uri.fsPath) === "review.json"
    ) {
      const value = JSON.parse(editor.document.getText()) as { format?: string };
      if (value.format === "uttori-source-edit-review") {
        draft = {
          reviewFile: editor.document.uri.fsPath,
          sha256: sourceExportSha256(fs.readFileSync(editor.document.uri.fsPath)),
        };
      }
    }
    const target = await resolveTarget(this.context);
    if (!target) {
      return;
    }
    const destination = await window.showSaveDialog({
      title: "New manually owned source directory",
      defaultUri: Uri.file(path.join(path.dirname(target.sourceDirectory), "detached-source")),
    });
    if (!destination) {
      return;
    }
    const entry = await this.run("sourceDetach", {
      sourceDirectory: target.sourceDirectory,
      romFile: target.romFile,
      directory: destination.fsPath,
      draft,
    });
    await window.showTextDocument(Uri.file(entry));
    void window.showInformationMessage(
      "Detached source created with manual ownership. An included source draft remains unverified. Open its directory as a workspace and use the configured assembly target. Its provenance file records retained baseline and plugin dependencies.",
    );
  }

  private async derive(): Promise<void> {
    const manifestFile = await this.manifest();
    if (!manifestFile) {
      return;
    }
    const destination = await window.showSaveDialog({
      title: "New derived analysis workspace directory",
      defaultUri: Uri.file(path.join(path.dirname(manifestFile), "derived-disassembly")),
    });
    if (!destination) {
      return;
    }
    const result = await this.run("modificationDerive", {
      manifestFile,
      outputDirectory: destination.fsPath,
    });
    await rememberSnesRom(this.context, result.rom, result.romFile);
    void window.showInformationMessage(
      `Created ${result.outputDirectory}. This project owns captures for the modified ROM. Baseline metadata was not migrated; relocated metadata requires reviewed address mappings.`,
    );
  }

  /** Cancellation crosses IPC only at safe operation boundaries; the last good build remains available.
   * @param {K} operation Worker operation discriminator.
   * @param {MaintenanceJobs[K]["input"]} input Compact paths and range settings.
   * @returns {Promise<MaintenanceJobs[K]["output"]>} Worker result after successful process exit.
   */
  private async run<K extends keyof MaintenanceJobs>(
    operation: K,
    input: MaintenanceJobs[K]["input"],
  ): Promise<MaintenanceJobs[K]["output"]> {
    if (!workspace.isTrusted) {
      throw new Error("ROM build operations require a trusted workspace.");
    }
    return window.withProgress(
      { location: ProgressLocation.Notification, title: "Assembly ROM project", cancellable: true },
      async (progress, token) => {
        const abort = new AbortController();
        const disposable = token.onCancellationRequested(() => abort.abort());
        try {
          return await this.#worker.run(operation, input, {
            maxMemoryMiB: workspace.getConfiguration("asm").get("analysis.maxMemoryMiB", 4096),
            signal: abort.signal,
            onProgress: (value) => {
              if (value.message) {
                progress.report({ message: value.message });
              }
            },
          });
        } finally {
          disposable.dispose();
        }
      },
    );
  }
  dispose(): void {
    this.#inputWatcher?.dispose();
    this.#worker.dispose();
    this.#status.dispose();
    for (const subscription of this.#subscriptions) {
      subscription.dispose();
    }
  }
}
