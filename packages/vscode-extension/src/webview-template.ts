import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { Uri, type Webview } from "vscode";

/** Cache of HTML templates for reuse. */
const htmlCache = new Map<string, string>();

/**
 * Escape an attribute value for use in an HTML attribute.
 * @param {string} value The value to escape.
 * @returns {string} The escaped value.
 */
const escapeAttribute = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

/**
 * Read a template file from the cache or the file system.
 * @param {Uri} file The URI of the template file.
 * @returns {string} The contents of the template file.
 */
const readTemplate = (file: Uri): string => {
  const cached = htmlCache.get(file.fsPath);
  if (cached !== undefined) {
    return cached;
  }
  const html = readFileSync(file.fsPath, "utf8");
  htmlCache.set(file.fsPath, html);
  return html;
};

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
    cspSource: escapeAttribute(webview.cspSource),
    nonce: escapeAttribute(randomBytes(18).toString("base64")),
    styleUri: escapeAttribute(webview.asWebviewUri(asset(`${name}.css`)).toString()),
    scriptUri: escapeAttribute(webview.asWebviewUri(asset(`${name}.js`)).toString()),
  };
  return readTemplate(asset(`${name}.html`)).replace(/{{(\w+)}}/g, (_match, key: string) => {
    if (!(key in values)) {
      throw new Error(`Unknown webview template field '${key}'.`);
    }
    return values[key];
  });
};
