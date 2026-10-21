import type { LanguageClient } from "vscode-languageclient/node";

import { test } from "../../../tests/ava-helper.js";
import { host, resetHost, document } from "./helpers/editor-host.js";

const { AssetPreviewController } = await import("../src/asset-preview-controller.js");
const { Position, MarkdownString } = await import("vscode");

/** The preview controller consumes only this request port; the editor owns the actual LSP client. */
function isRequestClient(value: object): value is LanguageClient {
  return "sendRequest" in value && typeof value.sendRequest === "function";
}
function client(request: (...args: unknown[]) => Promise<unknown>): LanguageClient {
  const value = { sendRequest: request };
  if (!isRequestClient(value)) {
    throw new Error("Invalid client fixture.");
  }
  return value;
}
const token = () => ({
  isCancellationRequested: false,
  onCancellationRequested: () => ({ dispose() {} }),
});
const image = () => ({
  ok: true,
  preview: {
    kind: "image",
    format: "indexed",
    sourceBytes: 64,
    encodedBytes: 32,
    output: "tiles",
    thumbnailPngBase64: "eA==",
    composedPngBase64: "eA==",
    storagePngBase64: "eA==",
  },
});
const request = (doc: ReturnType<typeof document>) => ({
  uri: doc.uri.toString(),
  version: doc.version,
  line: 0,
});

test.beforeEach(() => resetHost());

test.serial(
  "preview requests follow root ownership and reject untrusted, stale and cancelled replies",
  async (t) => {
    const doc = document("/project/main.asm", 'includeasset("sprite.png")');
    const calls: unknown[][] = [];
    let respond = async (): Promise<unknown> => image();
    const owner = client(async (...args) => {
      calls.push(args);
      return respond();
    });
    const controller = new AssetPreviewController((uri) =>
      uri.fsPath.startsWith("/project/") ? owner : undefined,
    );
    t.teardown(() => controller.dispose());
    t.deepEqual(await controller.request(doc, 0), image());
    t.deepEqual(calls[0].slice(0, 2), ["asm/assetPreview", request(doc)]);
    t.is(await controller.request(document("/other/main.asm"), 0), undefined);
    host.trusted = false;
    t.is(await controller.request(doc, 0), undefined);
    host.trusted = true;
    t.is(await controller.request(document("/project/a.txt", "", "plaintext"), 0), undefined);
    const virtual = { ...doc, uri: doc.uri.with({ scheme: "uttori-source" }) };
    t.is(await controller.request(virtual, 0), undefined);
    respond = async () => {
      throw new Error("Server restarted");
    };
    t.is(await controller.request(doc, 0), undefined);
    respond = async () => {
      doc.version++;
      return image();
    };
    t.is(await controller.request(doc, 0), undefined);
    const cancelled = token();
    respond = async () => {
      cancelled.isCancellationRequested = true;
      return image();
    };
    t.is(await controller.request(doc, 0, cancelled), undefined);
  },
);

test.serial(
  "hover exposes a revision-bound command only for supported media and validates audio facts",
  async (t) => {
    const doc = document("/project/main.asm", 'prefix includeasset("sprite.png")');
    let response: unknown = image();
    const controller = new AssetPreviewController(() => client(async () => response));
    t.is(await controller.provideHover(doc, new Position(0, 0), token()), undefined);
    t.is(
      await controller.provideHover(
        document("/project/other.asm", "db 1"),
        new Position(0, 0),
        token(),
      ),
      undefined,
    );
    const hover = await controller.provideHover(doc, new Position(0, 10), token());
    const markdown = hover?.contents[0];
    t.truthy(markdown);
    if (!markdown || typeof markdown === "string" || !(markdown instanceof MarkdownString)) {
      throw new Error("Expected Markdown.");
    }
    t.true(markdown.value.includes("data:image/png;base64,eA=="));
    t.true(markdown.value.includes("command:asm.assetPreview.open?"));
    t.deepEqual(Reflect.get(markdown, "isTrusted"), { enabledCommands: ["asm.assetPreview.open"] });
    response = { ok: false, message: "No asset on this line." };
    t.deepEqual(
      (await controller.provideHover(doc, new Position(0, 10), token()))?.contents.map((value) =>
        value instanceof MarkdownString ? value.value : value,
      ),
      ["No asset on this line."],
    );
    for (const metadata of [
      undefined,
      { sampleRate: 32000, sourceSamples: 9, peakError: 4.2, rmsError: 1.25 },
      { sampleRate: -1, sourceSamples: 1.5, peakError: Infinity, rmsError: NaN },
    ]) {
      response = {
        ok: true,
        preview: {
          kind: "audio",
          format: "brr",
          sourceBytes: 64,
          encodedBytes: 9,
          output: "BRR",
          metadata,
          waveformPngBase64: "eA==",
        },
      };
      const result = (await controller.provideHover(doc, new Position(0, 10), token()))
        ?.contents[0];
      if (!(result instanceof MarkdownString)) {
        throw new Error("Expected audio Markdown.");
      }
      t.true(result.value.includes("Play source PCM and decoded BRR"));
      t.is(result.value.includes("Hz"), metadata?.sampleRate === 32000);
      t.false(/NaN|Infinity|-1 Hz/.test(result.value));
    }
    response = {
      ok: true,
      preview: { kind: "binary", format: "raw", sourceBytes: 1, encodedBytes: 1, output: "ROM" },
    };
    const binary = (await controller.provideHover(doc, new Position(0, 10), token()))?.contents[0];
    t.false(binary instanceof MarkdownString && binary.value.includes("command:"));
    host.trusted = false;
    t.is(await controller.provideHover(doc, new Position(0, 10), token()), undefined);
    controller.dispose();
  },
);

test.serial(
  "media commands reject arbitrary paths and obsolete document identities before opening a panel",
  async (t) => {
    const doc = document("/project/main.asm", "includeasset()");
    let response: unknown = image();
    const controller = new AssetPreviewController(() => client(async () => response));
    for (const argument of [
      undefined,
      null,
      [],
      {},
      { ...request(doc), uri: "https://example.invalid/asset" },
      { ...request(doc), version: "1" },
      { ...request(doc), line: -1 },
      { ...request(doc), line: 0.5 },
      { ...request(doc), line: 8 },
      { ...request(doc), version: 0 },
      { ...request(doc), uri: "file:///absent.asm" },
    ]) {
      await controller.open(argument);
    }
    for (response of [
      { ok: false, message: "Unavailable" },
      { ok: true, preview: { ...image().preview, kind: "binary" } },
    ]) {
      await controller.open(request(doc));
    }
    t.is(host.panels.length, 0);
    controller.dispose();
  },
);

test.serial(
  "image panels escape catalogue metadata, retain native pixels and close replaced media",
  async (t) => {
    const doc = document("/project/main.asm", "includeasset()");
    let width: unknown = 4;
    const controller = new AssetPreviewController(() =>
      client(async () => ({
        ok: true,
        preview: {
          ...image().preview,
          format: "som.palette.bgr555",
          output: "ROM <&\"'>",
          metadata: {
            previewWidth: width,
            paletteId: '<script>"',
            paletteUsers: [
              { atlas: "<bad>", segments: ["a&b"], role: "runtime-variant" },
              { atlas: "main", segments: ["tiles"] },
              null,
              {},
              { atlas: 1, segments: [] },
              { atlas: "invalid", segments: [1] },
            ],
          },
        },
      })),
    );
    await controller.open(request(doc));
    const first = host.panels[0];
    t.deepEqual(first.options, { enableScripts: false, retainContextWhenHidden: false });
    t.true(first.webview.html.includes("default-src 'none'"));
    t.true(first.webview.html.includes("width:32px;height:auto"));
    t.true(first.webview.html.includes("&lt;bad&gt;: a&amp;b (runtime variant)"));
    t.true(first.webview.html.includes("Native storage order"));
    t.false(first.webview.html.includes("<script>"));
    for (width of [0, 257, 2.5, "4"]) {
      host.activeEditor = { viewColumn: 2 };
      await controller.open(request(doc));
      t.false(host.panels.at(-1)!.webview.html.includes('style="image-rendering:pixelated;width:'));
    }
    t.true(first.disposed);
    controller.dispose();
    t.true(host.panels.at(-1)!.disposed);
  },
);

test.serial(
  "audio remains open through initial hidden events and stops after a visible panel is hidden",
  async (t) => {
    const doc = document("/project/main.asm", "includeasset()");
    let media = {
      kind: "audio",
      format: "som.brr.segment",
      sourceBytes: 32,
      encodedBytes: 9,
      output: "BRR",
      waveformPngBase64: "eA==",
      sourceWavBase64: "eA==",
      decodedWavBase64: "eA==",
    };
    const controller = new AssetPreviewController(() =>
      client(async () => ({ ok: true, preview: media })),
    );
    await controller.open(request(doc));
    const panel = host.panels[0];
    t.true(panel.webview.html.includes("slice of the BRR stream"));
    t.is(panel.webview.html.match(/<audio /g)?.length, 2);
    t.false(panel.webview.html.includes("autoplay"));
    panel.visibility(false);
    t.false(panel.disposed);
    panel.visibility(true);
    panel.visibility(false);
    t.true(panel.disposed);
    media = {
      ...media,
      format: "brr",
      waveformPngBase64: "",
      sourceWavBase64: "",
      decodedWavBase64: "",
    };
    await controller.open(request(doc));
    t.false(host.panels[1].webview.html.includes("<audio"));
    controller.dispose();
  },
);
