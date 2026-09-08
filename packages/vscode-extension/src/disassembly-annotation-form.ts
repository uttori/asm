import { randomBytes } from "node:crypto";
import { ViewColumn, window, type WebviewPanel } from "vscode";

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

const escape = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/**
 * A local multiline form. User text is escaped and messages are validated again in the host.
 * @param {string} location Qualified address and project display text.
 * @param {DisassemblyAnnotationFields} initial Saved annotation values.
 * @param {boolean} hasInstruction Whether an inline instruction comment can be edited.
 * @param {Function} save Validates and transactionally persists submitted fields.
 * @param {Function} regenerate Explicit post-save source-regeneration action.
 * @returns {WebviewPanel} Disposable annotation form.
 */
export const openDisassemblyAnnotationForm = (
  location: string,
  initial: DisassemblyAnnotationFields,
  hasInstruction: boolean,
  save: (fields: DisassemblyAnnotationFields) => Promise<void>,
  regenerate: () => Promise<void>,
): WebviewPanel => {
  const panel = window.createWebviewPanel(
    "uttori.disassemblyAnnotation",
    "Edit Disassembly Annotation",
    ViewColumn.Beside,
    { enableScripts: true, localResourceRoots: [] },
  );
  const nonce = randomBytes(18).toString("base64");
  panel.webview.html = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:20px;max-width:760px}
label{display:block;margin:20px 0 6px}input,textarea{box-sizing:border-box;width:100%;padding:8px;color:var(--vscode-input-foreground);background:var(--vscode-input-background);border:1px solid var(--vscode-input-border,transparent);font:var(--vscode-editor-font-size) var(--vscode-editor-font-family)}
textarea{resize:vertical}button{margin:20px 8px 0 0;padding:8px 12px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:0;cursor:pointer}button:disabled{opacity:.6;cursor:default}
small{display:block;color:var(--vscode-descriptionForeground);margin-top:6px}pre{white-space:pre-wrap;padding:12px;background:var(--vscode-textCodeBlock-background)}#error{white-space:pre-wrap;color:var(--vscode-errorForeground)}
</style></head><body><h2>Edit Disassembly Annotation</h2><p>${escape(location)}</p>
<form id="annotation"><label for="name">Label name</label><input id="name" value="${escape(initial.name)}" maxlength="256" autocomplete="off">
<small>Leave empty for an instruction comment only. Names and comments survive regeneration.</small>
<label for="comment">Comment above the label</label><textarea id="comment" rows="6">${escape(initial.comment)}</textarea>
<label for="inlineComment">Comment beside the label</label><input id="inlineComment" value="${escape(initial.inlineComment)}">
<label for="instructionComment">Comment beside the instruction</label><input id="instructionComment" value="${escape(initial.instructionComment)}" ${hasInstruction ? "" : "disabled"}>
${hasInstruction ? "" : "<small>No accepted instruction starts here. Label comments are still available.</small>"}
<label>Preview</label><pre id="preview"></pre><p id="error" role="alert"></p>
<button type="submit">Save Annotation</button><button type="button" id="regenerate">Save and Regenerate</button><button type="button" id="cancel">Cancel</button></form>
<script nonce="${nonce}">
const vscode=acquireVsCodeApi();const ids=['name','comment','inlineComment','instructionComment'];
const fields=()=>Object.fromEntries(ids.map(id=>[id,document.getElementById(id).value]));
function preview(){const f=fields();document.getElementById('preview').textContent=[...f.comment.split(/\\r?\\n/).filter((v,i,a)=>v||a.length>1).map(v=>'; '+v),...(f.name?[f.name+':'+(f.inlineComment?' ; '+f.inlineComment:'')]:[]),...(f.instructionComment?['  <instruction> ; '+f.instructionComment]:[])].join('\\n');}
ids.forEach(id=>document.getElementById(id).addEventListener('input',preview));preview();
function submit(regenerate){document.querySelectorAll('button').forEach(b=>b.disabled=true);document.getElementById('error').textContent='';vscode.postMessage({type:'save',fields:fields(),regenerate});}
document.getElementById('annotation').addEventListener('submit',e=>{e.preventDefault();submit(false)});
document.getElementById('regenerate').addEventListener('click',()=>submit(true));
document.getElementById('cancel').addEventListener('click',()=>vscode.postMessage({type:'cancel'}));
window.addEventListener('message',e=>{if(e.data.type==='error'){document.getElementById('error').textContent=e.data.message;document.querySelectorAll('button').forEach(b=>b.disabled=false)}});
</script></body></html>`;
  let saving = false;
  const listener = panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (!message || typeof message !== "object" || saving) return;
    const input = message as Record<string, unknown>;
    if (input.type === "cancel") {
      panel.dispose();
      return;
    }
    if (input.type !== "save") return;
    saving = true;
    try {
      const fields = parseDisassemblyAnnotationFields(input.fields);
      if (typeof input.regenerate !== "boolean") throw new Error("Invalid regeneration selection.");
      await save(fields);
      panel.dispose();
    } catch (error) {
      await panel.webview.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
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
    listener.dispose();
  });
  return panel;
};
