import fs from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "webview-template-test:vscode" };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "webview-template-test:vscode") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          import path from "node:path";
          export const Uri = {
            joinPath: (root, ...parts) => {
              const fsPath = path.join(root.fsPath, ...parts);
              return { fsPath, toString: () => "file://" + fsPath };
            },
          };
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { renderWebviewTemplate } = await import("../src/webview-template.js");
const extensionRoot = path.resolve("packages/vscode-extension");
const uri = (file: string) => ({ fsPath: file, toString: () => `file://${file}` });

const render = (
  name: "annotation" | "panel" | "disassembly",
  options: {
    root?: string;
    cspSource?: string;
    asWebviewUri?: (value: { fsPath: string }) => { toString(): string };
  } = {},
) => {
  const root = options.root ?? extensionRoot;
  const assets: string[] = [];
  const html = renderWebviewTemplate(
    {
      cspSource: options.cspSource ?? "https://webview.example",
      asWebviewUri:
        options.asWebviewUri ??
        ((value: { fsPath: string }) => {
          assets.push(path.relative(root, value.fsPath));
          return { toString: () => `https://webview.example/${path.basename(value.fsPath)}` };
        }),
    } as never,
    uri(root) as never,
    name,
  );
  return { html, assets };
};

const nonce = (html: string): string => {
  const values = [...html.matchAll(/nonce="([^"]+)"/g)].map((match) => match[1]);
  if (values.length === 0 || values.some((value) => value !== values[0])) {
    throw new Error("Expected a single shared script nonce.");
  }
  return values[0];
};

test("packaged templates fill CSP, shared nonce and media URLs", (t) => {
  for (const name of ["annotation", "panel", "disassembly"] as const) {
    const { html, assets } = render(name);
    t.false(html.includes("{{"));
    t.true(html.includes("style-src https://webview.example"));
    t.true(html.includes(`href="https://webview.example/${name}.css"`));
    t.true(html.includes(`src="https://webview.example/${name}.js"`));
    t.true(html.includes(`script-src 'nonce-${nonce(html)}'`));
    t.deepEqual(assets, [`media/${name}.css`, `media/${name}.js`]);
  }
  t.not(
    nonce(render("panel").html),
    nonce(render("panel").html),
    "cached HTML still gets a fresh nonce",
  );
});

test("attribute metacharacters in CSP and asset URLs are escaped", (t) => {
  const { html } = render("annotation", {
    cspSource: 'https://a.example/x?a=1&b=2<"',
    asWebviewUri: (value) => ({
      toString: () => `https://webview.example/${path.basename(value.fsPath)}?v=1&w=2<"`,
    }),
  });
  t.true(html.includes("style-src https://a.example/x?a=1&amp;b=2&lt;&quot;"));
  t.true(html.includes('href="https://webview.example/annotation.css?v=1&amp;w=2&lt;&quot;"'));
  t.true(html.includes('src="https://webview.example/annotation.js?v=1&amp;w=2&lt;&quot;"'));
  t.false(html.includes("{{"));
});

test("unknown template fields fail closed", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-webview-template-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "media"));
  fs.writeFileSync(path.join(root, "media", "panel.html"), "<html>{{cspSource}} {{bogus}}</html>");
  const error = t.throws(() => render("panel", { root }));
  t.true(
    error instanceof Error && error.message.includes("Unknown webview template field 'bogus'"),
  );
});
