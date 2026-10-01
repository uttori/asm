import { commands, type ExtensionContext } from "vscode";

import type { PngDocument } from "../src/assets/png-document.js";
import { PngEditor } from "../src/assets/png-editor.js";
import type { EmulatorRuntimeBinding } from "../src/debug/session.js";
import { activate as activateExtension } from "../src/extension.js";
import { SourceController } from "../src/source/controller.js";

export { deactivate } from "../src/extension.js";

// This separate test entry wraps the production composition, including its shared
// draft registry. The release entry never includes these inspection commands.
const documents = new Map<string, PngDocument>();
const builds: { root: string; outputSha256: string; debugMapFingerprint: string }[] = [];
const observed = new WeakSet<SourceController>();
const select = SourceController.prototype.select;
SourceController.prototype.select = async function (root) {
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
    commands.registerCommand("uttori.tests.builds", () => [...builds]),
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
