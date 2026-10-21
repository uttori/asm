import { Uri, window } from "vscode";

import type { SourceProjectSession } from "./session.js";

/** Capture selection owns no archive data; the worker imports bounded evidence under the shared project identity. */
export class SourceCaptureCoordinator {
  constructor(readonly session: SourceProjectSession) {}
  async select(
    captureUri?: Uri | readonly Uri[],
  ): Promise<
    | { capture: string; captures?: never }
    | { captures: readonly string[]; capture?: never }
    | undefined
  > {
    const root = this.session.root;
    let selected: readonly Uri[] | undefined;
    if (Array.isArray(captureUri)) {
      selected = captureUri;
    } else if (captureUri instanceof Uri) {
      selected = [captureUri];
    } else if (captureUri !== undefined) {
      throw new Error("Capture import requires a local file URI.");
    }
    selected ??= await window.showOpenDialog({
      title: "Import captures into source project",
      canSelectMany: true,
      canSelectFiles: true,
      canSelectFolders: false,
      filters: { "Capture archives": ["act2", "json"] },
    });
    if (!selected?.length) {
      return undefined;
    }
    if (selected.some((uri) => !(uri instanceof Uri) || uri.scheme !== "file")) {
      throw new Error("Capture import requires local file URIs.");
    }
    if (root !== this.session.root) {
      throw new Error("Selected project changed while choosing captures.");
    }
    // Preserve the single-file command result used by Stop Capture and Import Evidence.
    // Multiple selections use one worker and cancellation scope, with separate per-file commits.
    if (selected.length === 1) {
      return { capture: selected[0].fsPath };
    } else {
      return { captures: selected.map((uri) => uri.fsPath) };
    }
  }
}
