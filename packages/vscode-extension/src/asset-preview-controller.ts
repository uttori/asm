import {
  Hover,
  MarkdownString,
  ViewColumn,
  window,
  workspace,
  type CancellationToken,
  type Disposable,
  type Position,
  type TextDocument,
  type WebviewPanel,
} from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";

/** Request parameters contain only source identity; the server resolves every asset path. */
interface AssetPreviewRequest {
  readonly uri: string;
  readonly version: number;
  readonly line: number;
}

/** Small media result from the bounded language-server worker. */
interface AssetPreviewResult {
  readonly kind: "image" | "audio" | "binary";
  readonly sourceBytes: number;
  readonly encodedBytes: number;
  readonly format: string;
  readonly output: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly thumbnailPngBase64?: string;
  readonly composedPngBase64?: string;
  readonly storagePngBase64?: string;
  readonly waveformPngBase64?: string;
  readonly sourceWavBase64?: string;
  readonly decodedWavBase64?: string;
}

type AssetPreviewResponse =
  | { readonly ok: true; readonly preview: AssetPreviewResult }
  | { readonly ok: false; readonly message: string };

/** Escape metadata before inserting it into a script-free webview.
 * @param {string} value Untrusted display text.
 * @returns {string} HTML-safe text.
 */
function escapeHtml(value: string): string {
  return value.replace(/["&'<>]/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return replacements[character];
  });
}

/** Accept only plain catalogue use labels before rendering plugin metadata as HTML.
 * @param {unknown} value Untrusted preview metadata entry.
 * @returns {boolean} Whether the entry has displayable atlas and segment labels.
 */
function isPaletteUser(
  value: unknown,
): value is { atlas: string; segments: string[]; role?: string } {
  if (!value || typeof value !== "object") {
    return false;
  }
  const user = value as Record<string, unknown>;
  return (
    typeof user.atlas === "string" &&
    Array.isArray(user.segments) &&
    user.segments.every((segment: unknown) => typeof segment === "string")
  );
}

/** Keep command arguments local to the current source revision, with no asset URI in Markdown.
 * @param {AssetPreviewRequest} request Current source identity.
 * @returns {string} Restricted VS Code command URI.
 */
function openLink(request: AssetPreviewRequest): string {
  return `command:asm.assetPreview.open?${encodeURIComponent(JSON.stringify([request]))}`;
}

/** Show only validated numeric encoder facts in Markdown; metadata can come from a plugin.
 * @param {Readonly<Record<string, unknown>> | undefined} metadata Encoder output metadata.
 * @returns {string} Compact audio details or an empty string.
 */
function audioDetails(metadata: Readonly<Record<string, unknown>> | undefined): string {
  if (!metadata) {
    return "";
  }
  const details: string[] = [];
  const sampleRate = metadata.sampleRate;
  if (typeof sampleRate === "number" && Number.isSafeInteger(sampleRate) && sampleRate > 0) {
    details.push(`${sampleRate.toLocaleString()} Hz`);
  }
  const sourceSamples = metadata.sourceSamples;
  if (
    typeof sourceSamples === "number" &&
    Number.isSafeInteger(sourceSamples) &&
    sourceSamples >= 0
  ) {
    details.push(`${sourceSamples.toLocaleString()} samples`);
  }
  const peakError = metadata.peakError;
  if (typeof peakError === "number" && Number.isFinite(peakError) && peakError >= 0) {
    details.push(`peak error ${peakError.toFixed(0)}`);
  }
  const rmsError = metadata.rmsError;
  if (typeof rmsError === "number" && Number.isFinite(rmsError) && rmsError >= 0) {
    details.push(`RMS error ${rmsError.toFixed(1)}`);
  }
  return details.join(" · ");
}

/** Preview hovers and explicit media playback share a single request and version check. */
export class AssetPreviewController implements Disposable {
  #panel: WebviewPanel | undefined;

  constructor(readonly client: () => LanguageClient | undefined) {}

  /** Return media only while the same text revision remains open.
   * @param {TextDocument} document Open assembly source.
   * @param {number} line Zero-based statement line.
   * @param {CancellationToken} [token] Hover cancellation.
   * @returns {Promise<AssetPreviewResponse | undefined>} Current preview response.
   */
  async request(
    document: TextDocument,
    line: number,
    token?: CancellationToken,
  ): Promise<AssetPreviewResponse | undefined> {
    const active = this.client();
    if (
      !active ||
      document.uri.scheme !== "file" ||
      !workspace.isTrusted ||
      !["uttori-snes", "uttori-65xx"].includes(document.languageId)
    ) {
      return undefined;
    }
    const version = document.version;
    const request: AssetPreviewRequest = { uri: document.uri.toString(), version, line };
    try {
      const response = await active.sendRequest<AssetPreviewResponse>(
        "asm/assetPreview",
        request,
        token,
      );
      if (token?.isCancellationRequested || document.version !== version) {
        return undefined;
      }
      return response;
    } catch {
      return undefined;
    }
  }

  /** Append a compact image or waveform preview to an asset-call hover.
   * @param {TextDocument} document Open assembly source.
   * @param {Position} position Hover cursor.
   * @param {CancellationToken} token Hover cancellation.
   * @returns {Promise<Hover | undefined>} Current preview hover.
   */
  async provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
  ): Promise<Hover | undefined> {
    const line = document.lineAt(position.line).text;
    const start = /\bincludeasset\s*\(/i.exec(line)?.index;
    if (start === undefined || position.character < start) {
      return undefined;
    }
    const response = await this.request(document, position.line, token);
    if (!response) {
      return undefined;
    }
    const markdown = new MarkdownString();
    markdown.isTrusted = { enabledCommands: ["asm.assetPreview.open"] };
    if (!response.ok) {
      markdown.appendText(response.message);
      return new Hover(markdown);
    }
    const preview = response.preview;
    markdown.appendMarkdown(
      `**${preview.format}** · ${preview.sourceBytes.toLocaleString()} source bytes · ` +
        `${preview.encodedBytes.toLocaleString()} ${preview.output} bytes\n\n`,
    );
    if (preview.kind === "audio") {
      const details = audioDetails(preview.metadata);
      if (details) {
        markdown.appendMarkdown(`${details}\n\n`);
      }
    }
    const thumbnail = preview.thumbnailPngBase64 ?? preview.waveformPngBase64;
    if (thumbnail) {
      markdown.appendMarkdown(`![Asset preview](data:image/png;base64,${thumbnail})\n\n`);
    }
    if (preview.kind === "image" || preview.kind === "audio") {
      const label =
        preview.kind === "image" ? "Open full asset preview" : "Play source PCM and decoded BRR";
      markdown.appendMarkdown(
        `[${label}](${openLink({
          uri: document.uri.toString(),
          version: document.version,
          line: position.line,
        })})`,
      );
    }
    return new Hover(markdown);
  }

  /** Open media only from a fresh trusted command, never from arbitrary command URI payloads.
   * @param {unknown} argument Parsed command URI argument.
   * @returns {Promise<void>} Completes after panel content is ready.
   */
  async open(argument: unknown): Promise<void> {
    if (!argument || typeof argument !== "object") {
      return;
    }
    const request = argument as Partial<AssetPreviewRequest>;
    if (
      typeof request.uri !== "string" ||
      typeof request.version !== "number" ||
      !Number.isSafeInteger(request.line) ||
      (request.line as number) < 0 ||
      !request.uri.startsWith("file:")
    ) {
      return;
    }
    const document = workspace.textDocuments.find((item) => item.uri.toString() === request.uri);
    if (
      !document ||
      !["uttori-snes", "uttori-65xx"].includes(document.languageId) ||
      document.version !== request.version ||
      request.line! >= document.lineCount
    ) {
      return;
    }
    const response = await this.request(document, request.line!);
    if (!response?.ok || document.version !== request.version) {
      return;
    }
    const media = response.preview;
    if (media.kind !== "image" && media.kind !== "audio") {
      return;
    }
    this.#panel?.dispose();
    const panel = window.createWebviewPanel(
      "asm.assetPreview",
      "Asset Preview",
      {
        viewColumn: window.activeTextEditor?.viewColumn ?? ViewColumn.Active,
        preserveFocus: false,
      },
      { enableScripts: false, retainContextWhenHidden: false },
    );
    this.#panel = panel;
    panel.onDidDispose(() => {
      if (this.#panel === panel) {
        this.#panel = undefined;
      }
    });
    let wasVisible = panel.visible;
    panel.onDidChangeViewState((event) => {
      if (event.webviewPanel.visible) {
        wasVisible = true;
      } else if (wasVisible) {
        // Only a panel that was actually shown can be hidden. Its disposal stops audio;
        // an initial visibility event during creation must not close the new player.
        event.webviewPanel.dispose();
      }
    });
    const description = `${escapeHtml(media.format)} · ${media.encodedBytes} ${escapeHtml(media.output)} bytes`;
    let body = `<h1>${description}</h1>`;
    if (media.kind === "image") {
      if (
        typeof media.metadata?.paletteId === "string" &&
        Array.isArray(media.metadata.paletteUsers)
      ) {
        const users = (media.metadata.paletteUsers as unknown[])
          .filter(isPaletteUser)
          .map(
            (user) =>
              `<li>${escapeHtml(user.atlas)}: ${escapeHtml(user.segments.join(", "))}${user.role === "runtime-variant" ? " (runtime variant)" : ""}</li>`,
          )
          .join("");
        body += `<h2>ROM palette $${escapeHtml(media.metadata.paletteId)}</h2><ul>${users}</ul>`;
      }
      if (media.composedPngBase64) {
        // A ROM palette may be a 4-column sprite row or a wider background group.
        // Keep the native grid aspect ratio while enlarging each source pixel equally.
        let paletteStyle = "";
        if (media.format === "som.palette.bgr555") {
          const width = media.metadata?.previewWidth;
          if (
            typeof width === "number" &&
            Number.isSafeInteger(width) &&
            width > 0 &&
            width <= 256
          ) {
            paletteStyle = ` style="image-rendering:pixelated;max-width:100%;width:${width * 8}px;height:auto"`;
          }
        }
        body += `<h2>Composed image</h2><img alt="Composed asset"${paletteStyle} src="data:image/png;base64,${media.composedPngBase64}">`;
      }
      if (media.storagePngBase64) {
        body += `<h2>Native storage order</h2><img alt="Native storage order" src="data:image/png;base64,${media.storagePngBase64}">`;
      }
    } else {
      if (media.format === "som.brr.segment") {
        body +=
          "<p>This ROM bank contains a slice of the BRR stream. Playback uses the complete source because the split may fall inside a BRR block.</p>";
      }
      if (media.waveformPngBase64) {
        body += `<img alt="Source waveform" src="data:image/png;base64,${media.waveformPngBase64}">`;
      }
      if (media.sourceWavBase64) {
        body += `<h2>Source PCM</h2><audio controls preload="none" src="data:audio/wav;base64,${media.sourceWavBase64}"></audio>`;
      }
      if (media.decodedWavBase64) {
        body += `<h2>Decoded BRR</h2><audio controls preload="none" src="data:audio/wav;base64,${media.decodedWavBase64}"></audio>`;
      }
    }
    panel.webview.html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; media-src data:; style-src 'unsafe-inline'"><style>body{font:13px sans-serif;padding:16px}img{max-width:100%;image-rendering:pixelated}audio{display:block;width:100%}</style></head><body>${body}</body></html>`;
  }

  /** Dispose the panel to stop any active audio element. */
  dispose(): void {
    this.#panel?.dispose();
    this.#panel = undefined;
  }
}
