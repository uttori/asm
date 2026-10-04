import { commands, type ExtensionContext } from "vscode";

import type { PngDocument } from "../src/assets/png-document.js";
import { PngEditor } from "../src/assets/png-editor.js";
import type { EmulatorRuntimeBinding } from "../src/debug/session.js";
import { activate as activateExtension } from "../src/extension.js";
import { SourceController } from "../src/source/controller.js";
import { SourceProcessClient, type SourceProcessOperation } from "../src/source/process-client.js";

export { deactivate } from "../src/extension.js";

// This separate test entry wraps the production composition, including its shared
// draft registry. The release entry never includes these inspection commands.
const documents = new Map<string, PngDocument>();
const builds: { root: string; outputSha256: string; debugMapFingerprint: string }[] = [];
const observed = new WeakSet<SourceController>();
const sources = new Set<SourceController>();
/** One-shot saved-input mutation after worker completion, before controller acceptance. */
let buildMutation: { path: string; append: string } | undefined;
const run = SourceProcessClient.prototype.run;
SourceProcessClient.prototype.run = async function <T>(
  operation: SourceProcessOperation,
  options: Parameters<SourceProcessClient["run"]>[1],
): Promise<T> {
  const execute = run.bind(this);
  const result = await execute<T>(operation, options);
  if (operation.action === "build" && buildMutation) {
    const mutation = buildMutation;
    buildMutation = undefined;
    const controller = [...sources].find((source) => source.root === operation.directory);
    if (!controller) {
      throw new Error("No controller for the build mutation.");
    }
    const file = path.join(operation.directory, mutation.path);
    const bytes = await fs.readFile(file);
    // Wait for the actual production watcher, so an unchanged rewrite reproduces the event-counter
    // false rejection deterministically rather than relying on arbitrary editor startup timing.
    let listener: { dispose(): void } | undefined;
    let timer: NodeJS.Timeout | undefined;
    const changed = new Promise<void>((resolve, reject) => {
      listener = controller.onDidChangeSavedInput(() => resolve());
      timer = setTimeout(
        () => reject(new Error("Source watcher did not observe the test write.")),
        5000,
      );
    });
    try {
      await fs.writeFile(file, Buffer.concat([bytes, Buffer.from(mutation.append)]));
      await changed;
    } finally {
      clearTimeout(timer);
      listener?.dispose();
    }
  }
  return result;
};
const select = SourceController.prototype.select;
SourceController.prototype.select = async function (root) {
  sources.add(this);
  if (!observed.has(this)) {
    observed.add(this);
    this.onDidBuild(({ root: selected, build }) =>
      builds.push({
        root: selected,
        outputSha256: build.verification.outputSha256,
        debugMapFingerprint: build.debugMapFingerprint,
      }),
    );
  }
  await select.call(this, root);
};
const resolveEditor = PngEditor.prototype.resolveCustomEditor;
PngEditor.prototype.resolveCustomEditor = function (document, panel) {
  documents.set(document.uri.fsPath, document);
  document.onDidDispose(() => documents.delete(document.uri.fsPath));
  resolveEditor.call(this, document, panel);
};

/** Drive a real production custom document without adding hooks to shipped editor code. */
export function activate(context: ExtensionContext): void {
  context.subscriptions.push(
    commands.registerCommand("uttori.tests.sourceTree", async () => {
      const source = sources.values().next().value;
      if (!source) {
        throw new Error("No production source controller selected.");
      }
      await source.refresh();
      return source.getChildren().flatMap((row) =>
        [row, ...source.getChildren(row)].map((item) => ({
          label: item.label,
          command: item.command?.command,
          description: item.description,
          collapsibleState: item.collapsibleState,
        })),
      );
    }),
    // Reproduce workspace-state restoration without adding a mutation hook to release code.
    commands.registerCommand("uttori.tests.sourceCandidate", (root: string, candidate?: string) =>
      context.workspaceState.update(`source.candidate:${root}`, candidate),
    ),
    commands.registerCommand("uttori.tests.builds", () => [...builds]),
    commands.registerCommand("uttori.tests.buildMutation", (file: string, append = "") => {
      buildMutation = { path: file, append };
    }),
    commands.registerCommand(
      "uttori.tests.runtime",
      (folder: string, binding: EmulatorRuntimeBinding) =>
        context.globalState.update("uttoriAsm.emulatorRuntimeBindings.v1", { [folder]: binding }),
    ),
    commands.registerCommand("uttori.tests.png", async (file: string, paint?: number) => {
      const document = documents.get(file);
      if (!document) {
        return undefined;
      }
      if (paint !== undefined) {
        const region = document.guidance?.regions[0];
        const pixel = region ? region.y * document.image.width + region.x : 0;
        document.paint({ version: document.version, index: paint, pixels: [pixel] });
      }
      return { dirty: document.dirty, bytes: await document.snapshot() };
    }),
  );
  activateExtension(context);
}
import fs from "node:fs/promises";
import path from "node:path";
