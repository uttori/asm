/** Local rendered-webview audit. Open the printed loopback URL; no editor/project state is modified. */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { transform } from "esbuild";

import { buildHomeSnapshot } from "../packages/vscode-extension/src/project/home-model.ts";
import { sourceWorkflow } from "../packages/vscode-extension/src/source/workflow.ts";

const media = path.resolve("packages/vscode-extension/media");
const output = path.resolve(".verification/incoming-accessibility");
const source = buildHomeSnapshot({
  trusted: true,
  watch: false,
  indexReady: true,
  status: {
    fileCount: 36,
    symbolCount: 65000,
    referenceCount: 12,
    errorCount: 0,
    lastReindexRootCount: 1,
    lastReindexCachedRoots: 0,
    lastReindexAnalyzedRoots: 1,
    entryPoints: [],
    includePaths: [],
  },
  source: {
    root: "/example",
    name: "Accessibility review",
    branch: "main",
    dirty: true,
    target: "snes.sfc",
    candidate: "candidate",
    previewed: false,
    workflow: sourceWorkflow({ candidate: true }),
    capturePhase: "idle",
    incoming: Array.from({ length: 288 }, (_, index) => ({
      path: `disassembly/assets/a-long-directory-name/bank-${index}.asm`,
      status: "M",
      conflict: index === 200,
      additions: 3,
      deletions: 2,
      left: `left-${index}`,
      right: `right-${index}`,
      title: `Diff ${index}`,
    })),
  },
});
source.health.coverage = {
  remaining: 50,
  converted: 50,
  total: 100,
  remainingPercent: 50,
  convertedPercent: 50,
  freshness: "stale",
  reason: "Saved source changed since the last successful build.",
};
/** Fixed fixtures cover source, assembly settings, recovery, palette and pixel-editing controls. */
const fixtures = {
  source: { name: "home", data: { type: "snapshot", ...source } },
  assembly: {
    name: "home",
    data: {
      type: "snapshot",
      ...source,
      mode: "assembly",
      incoming: undefined,
      assembly: {
        targets: [{ id: "snes", displayName: "SNES" }],
        architectures: [{ id: "65816", displayName: "65816" }],
        target: "snes",
        architecture: "65816",
        output: "game.sfc",
        entryPoints: ["boot.asm"],
        includePaths: ["lib"],
      },
    },
  },
  recovery: {
    name: "home",
    data: {
      type: "snapshot",
      ...source,
      recovery: {
        kind: "merging",
        stripe: "merging",
        label: "Resolve conflicts",
        reason: "Resolve conflicts before finishing regeneration.",
        primary: { command: "asm.source.abort", title: "Abort regeneration" },
        secondary: [],
      },
    },
  },
  palette: {
    name: "palette",
    data: {
      type: "palette",
      version: 1,
      palettes: [{ id: "example", name: "Example", firstIndex: 0, words: ["0000", "7FFF"] }],
    },
  },
  png: {
    name: "indexed-png",
    data: {
      type: "image",
      version: 1,
      width: 4,
      height: 2,
      palette: [
        [0, 0, 0, 0],
        [255, 255, 255, 255],
      ],
      indexes: Buffer.from([0, 1, 0, 1, 0, 1, 0, 1]).toString("base64"),
      regions: [
        { x: 0, y: 0, width: 2, height: 2, label: "Example tile", paletteStart: 0, uses: 1 },
      ],
    },
  },
};
/** Theme tokens approximate VS Code defaults; installed-editor checks still verify the active theme. */
const theme =
  ":root{--vscode-font-size:13px;--vscode-font-family:system-ui;--vscode-foreground:#ccc;--vscode-descriptionForeground:#ccc;--vscode-sideBar-background:#252526;--vscode-focusBorder:#007fd4;--vscode-button-background:#0078d4;--vscode-button-foreground:#fff;--vscode-button-secondaryBackground:#313131;--vscode-button-secondaryForeground:#ccc;--vscode-input-background:#313131;--vscode-input-foreground:#ccc;--vscode-dropdown-background:#313131;--vscode-dropdown-foreground:#ccc;--vscode-textLink-foreground:#4daafc;--vscode-icon-foreground:#ccc;--vscode-gitDecoration-modifiedResourceForeground:#e2c08d;--vscode-gitDecoration-addedResourceForeground:#81b88b;--vscode-errorForeground:#f48771;--vscode-progressBar-background:#0e70c0}body{background:#252526}";

/**
 * Serve explicit fixtures/assets and store bounded test evidence.
 * @param request Loopback audit request.
 * @param response Browser response; failures are handled by the server wrapper.
 * @returns Completes when the response has been written.
 */
async function handle(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/report" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 1_000_000) {
        response.writeHead(413).end();
        return;
      }
    }
    const report: unknown = JSON.parse(body);
    if (
      !report ||
      typeof report !== "object" ||
      !("results" in report) ||
      !Array.isArray(report.results) ||
      !("failures" in report) ||
      !Array.isArray(report.failures)
    ) {
      response.writeHead(400).end();
      return;
    }
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(
      path.join(output, "browser-report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      `Saved ${report.results.length} rendered checks; failures: ${report.failures.length}`,
    );
    response.end("Saved");
    return;
  }
  const key = url.pathname.slice(1);
  const fixture = Object.entries(fixtures).find(([name]) => name === key)?.[1];
  if (fixture) {
    const { name, data } = fixture;
    let html = fs.readFileSync(path.join(media, `${name}.html`), "utf8");
    const bootstrap = `<style>${theme}</style><script nonce="audit">window.acquireVsCodeApi=()=>({getState:()=>undefined,setState:()=>{},postMessage:(message)=>window.auditMessages.push(message)});window.auditMessages=[];window.addEventListener('load',()=>window.postMessage(${JSON.stringify(data).replaceAll("<", "\\u003c")},location.origin));</script><script nonce="audit" src="/axe.min.js"></script>`;
    html = html
      .replaceAll("{{nonce}}", "audit")
      .replaceAll("{{cspSource}}", "'self' 'unsafe-inline'")
      .replaceAll("{{styleUri}}", `/media/${name}.css`)
      .replaceAll("{{scriptUri}}", `/media/${name}.js`)
      .replace("</head>", bootstrap + "</head>");
    response.setHeader("Content-Type", "text/html");
    response.end(html);
    return;
  }
  if (url.pathname === "/axe.min.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(fs.readFileSync("node_modules/axe-core/axe.min.js"));
    return;
  }
  if (url.pathname === "/audit.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(
      (
        await transform(fs.readFileSync("scripts/webview-accessibility-browser.ts", "utf8"), {
          loader: "ts",
          format: "esm",
        })
      ).code,
    );
    return;
  }
  if (/^\/media\/(home|palette|indexed-png)\.(css|js)$/.test(url.pathname)) {
    response.setHeader(
      "Content-Type",
      url.pathname.endsWith(".js") ? "text/javascript" : "text/css",
    );
    response.end(fs.readFileSync(path.join(media, path.basename(url.pathname))));
    return;
  }
  if (url.pathname !== "/") {
    response.writeHead(404).end();
    return;
  }
  response.setHeader("Content-Type", "text/html");
  response.end(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Webview accessibility audit</title></head><body><main><h1>Webview accessibility audit</h1><p id="status" role="status">Running rendered checks…</p><pre id="results"></pre><iframe title="Webview under test" style="width:320px;height:620px;border:1px solid #888"></iframe></main><script type="module" src="/audit.js"></script></body></html>',
  );
}
const server = http.createServer((request, response) => {
  void handle(request, response).catch((error: unknown) => {
    console.error(error);
    response.writeHead(500).end("Audit server failed");
  });
});
server.listen(4178, "127.0.0.1", () =>
  console.log("Open http://127.0.0.1:4178 to run rendered accessibility checks."),
);
