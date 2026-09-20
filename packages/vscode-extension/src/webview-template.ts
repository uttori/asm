import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { Uri, type Webview } from "vscode";

/**
 * Packaged UTF-8 HTML keyed by absolute filesystem path for the extension-host lifetime; cached
 * files are not reread until reload.
 */
const htmlCache = new Map<string, string>();

/**
 * Escape ampersands, double quotes, and opening angle brackets for double-quoted HTML attribute
 * values.
 * @param {string} value The value to escape.
 * @returns {string} The escaped value.
 */
const escapeAttribute = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

/**
 * Read packaged UTF-8 HTML once per filesystem path and retain it for the extension-host
 * lifetime; filesystem failures propagate.
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
 * @param {"annotation" | "panel" | "disassembly"} name Packaged template basename.
 * @returns {string} Complete HTML with escaped resource URLs.
 * @see https://code.visualstudio.com/api/references/vscode-api#Webview.asWebviewUri
 * @see https://code.visualstudio.com/api/references/vscode-api#Webview.cspSource
 * @see https://code.visualstudio.com/api/extension-guides/webview#content-security-policy
 */
export const renderWebviewTemplate = (
  webview: Webview,
  extensionUri: Uri,
  name: "annotation" | "panel" | "disassembly",
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
