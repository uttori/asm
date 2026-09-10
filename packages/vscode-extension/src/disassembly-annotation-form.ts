import { Uri, ViewColumn, window, type WebviewPanel } from "vscode";

import { renderWebviewTemplate } from "./webview-template.js";

export interface DisassemblyAnnotationFields {
  readonly name: string;
  readonly comment: string;
  readonly inlineComment: string;
  readonly instructionComment: string;
}

export const parseDisassemblyAnnotationFields = (value: unknown): DisassemblyAnnotationFields => {
  if (!value || typeof value !== "object") throw new Error("Invalid annotation form.");
  const input = value as Record<string, unknown>;
  const fields = ["name", "comment", "inlineComment", "instructionComment"] as const;
  for (const field of fields) {
    if (typeof input[field] !== "string" || input[field].length > 65536)
      throw new Error(`Invalid or oversized ${field}.`);
  }
  return Object.fromEntries(
    fields.map((field) => [field, input[field]]),
  ) as unknown as DisassemblyAnnotationFields;
};

export interface DisassemblyAnnotationFormData {
  readonly location: string;
  readonly fields: DisassemblyAnnotationFields;
  readonly hasInstruction: boolean;
}

/**
 * Display the shell immediately, then initialize it after background address resolution.
 * @param {Uri} extensionUri Installed extension root containing the media assets.
 * @returns {object} Panel lifecycle and initialization controls.
 */
export const openDisassemblyAnnotationForm = (
  extensionUri: Uri,
): {
  panel: WebviewPanel;
  readonly disposed: boolean;
  initialize(
    data: DisassemblyAnnotationFormData,
    save: (fields: DisassemblyAnnotationFields) => Promise<void>,
    regenerate: () => Promise<void>,
  ): void;
  fail(error: unknown): void;
} => {
  const panel = window.createWebviewPanel(
    "uttori.disassemblyAnnotation",
    "Edit Disassembly Annotation",
    ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [Uri.joinPath(extensionUri, "media")],
    },
  );
  let disposed = false;
  let ready = false;
  let state: unknown;
  let save: ((fields: DisassemblyAnnotationFields) => Promise<void>) | undefined;
  let regenerate: (() => Promise<void>) | undefined;
  let saving = false;
  const publish = (): void => {
    if (ready && !disposed && state) void panel.webview.postMessage(state);
  };
  const fail = (error: unknown): void => {
    state = { type: "error", message: error instanceof Error ? error.message : String(error) };
    publish();
  };
  const listener = panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (!message || typeof message !== "object" || disposed) return;
    const input = message as Record<string, unknown>;
    if (input.type === "ready") {
      ready = true;
      publish();
      return;
    }
    if (saving) return;
    if (input.type === "cancel") {
      panel.dispose();
      return;
    }
    if (input.type !== "save" || !save || !regenerate) return;
    saving = true;
    try {
      const fields = parseDisassemblyAnnotationFields(input.fields);
      if (typeof input.regenerate !== "boolean") throw new Error("Invalid regeneration selection.");
      await save(fields);
      panel.dispose();
    } catch (error) {
      fail(error);
      saving = false;
      return;
    }
    if (input.regenerate) {
      try {
        await regenerate();
      } catch (error) {
        await window.showErrorMessage(
          `Annotation saved, but regeneration failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  });
  panel.onDidDispose(() => {
    disposed = true;
    listener.dispose();
  });
  panel.webview.html = renderWebviewTemplate(panel.webview, extensionUri, "annotation");
  return {
    panel,
    get disposed() {
      return disposed;
    },
    initialize(data, onSave, onRegenerate) {
      save = onSave;
      regenerate = onRegenerate;
      state = { type: "initialize", ...data };
      publish();
    },
    fail,
  };
};
