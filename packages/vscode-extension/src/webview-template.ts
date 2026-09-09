import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { Uri, type Webview } from "vscode";

/**
 * Load editable, packaged HTML with CSP-scoped URLs for its external assets.
 * @param {Webview} webview Hosted webview.
 * @param {Uri} extensionUri Installed extension root.
 * @param {"annotation" | "panel"} name Packaged template basename.
 * @returns {string} Complete HTML with escaped resource URLs.
 */
export const renderWebviewTemplate = (
  webview: Webview,
  extensionUri: Uri,
  name: "annotation" | "panel",
): string => {
  const asset = (file: string): Uri => Uri.joinPath(extensionUri, "media", file);
  const values: Record<string, string> = {
    cspSource: webview.cspSource,
    nonce: randomBytes(18).toString("base64"),
    styleUri: webview.asWebviewUri(asset(`${name}.css`)).toString(),
    scriptUri: webview.asWebviewUri(asset(`${name}.js`)).toString(),
  };
  return readFileSync(asset(`${name}.html`).fsPath, "utf8").replace(
    /{{(\w+)}}/g,
    (_match, key: string) => {
      if (!(key in values)) throw new Error(`Unknown webview template field '${key}'.`);
      return values[key].replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
    },
  );
};
