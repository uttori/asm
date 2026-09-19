import { registerHooks } from "node:module";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";

const host = {
  posted: [] as unknown[],
  errors: [] as string[],
  saves: 0,
  regenerates: 0,
  receive: undefined as ((message: unknown) => Promise<void> | void) | undefined,
  onDispose: undefined as (() => void) | undefined,
  messageDisposed: false,
};

(
  globalThis as { __uttoriDisassemblyAnnotationFormTest?: typeof host }
).__uttoriDisassemblyAnnotationFormTest = host;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "disassembly-annotation-form-test:vscode" };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "disassembly-annotation-form-test:vscode") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          import path from "node:path";
          const host = globalThis.__uttoriDisassemblyAnnotationFormTest;
          export const ViewColumn = { Beside: 2 };
          export const Uri = {
            joinPath: (root, ...parts) => {
              const fsPath = path.join(root.fsPath, ...parts);
              return { fsPath, toString: () => "file://" + fsPath };
            },
          };
          export const window = {
            showErrorMessage: async (message) => { host.errors.push(message); },
            createWebviewPanel: (_id, _title, _column, _options) => {
              const panel = {
                webview: {
                  html: "",
                  cspSource: "https://webview.example",
                  asWebviewUri: (value) => ({
                    toString: () => "https://webview.example/" + path.basename(value.fsPath),
                  }),
                  postMessage: async (message) => { host.posted.push(message); },
                  onDidReceiveMessage: (callback) => {
                    host.receive = callback;
                    return { dispose() { host.messageDisposed = true; } };
                  },
                },
                dispose() { host.onDispose?.(); },
                onDidDispose: (callback) => {
                  host.onDispose = callback;
                  return { dispose() {} };
                },
              };
              return panel;
            },
          };
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { openDisassemblyAnnotationForm, parseDisassemblyAnnotationFields } =
  await import("../src/disassembly-annotation-form.js");

const extensionUri = {
  fsPath: path.resolve("packages/vscode-extension"),
  toString: () => "file://extension",
};
const fields = {
  name: "Main",
  comment: "c",
  inlineComment: "i",
  instructionComment: "k",
};
const data = { location: "$808000", fields, hasInstruction: true };

const deliver = async (message: unknown) => {
  await host.receive?.(message);
};

test.beforeEach(() => {
  host.posted = [];
  host.errors = [];
  host.saves = 0;
  host.regenerates = 0;
  host.receive = undefined;
  host.onDispose = undefined;
  host.messageDisposed = false;
});

test("parseDisassemblyAnnotationFields accepts valid input and rejects bad payloads", (t) => {
  t.deepEqual(parseDisassemblyAnnotationFields(fields), fields);
  t.throws(() => parseDisassemblyAnnotationFields(null), { message: "Invalid annotation form." });
  t.throws(() => parseDisassemblyAnnotationFields(1), { message: "Invalid annotation form." });
  t.throws(() => parseDisassemblyAnnotationFields({ ...fields, comment: undefined }), {
    message: "Invalid or oversized comment.",
  });
  t.throws(() => parseDisassemblyAnnotationFields({ ...fields, name: "x".repeat(65537) }), {
    message: "Invalid or oversized name.",
  });
});

test.serial("initialize publishes after ready", async (t) => {
  const form = openDisassemblyAnnotationForm(extensionUri as never);
  t.false(form.panel.webview.html.includes("{{"));
  t.true(form.panel.webview.html.includes("Edit annotation"));
  form.initialize(
    data,
    async () => {},
    async () => {},
  );
  t.deepEqual(host.posted, []);
  await deliver({ type: "ready" });
  t.deepEqual(host.posted.at(-1), { type: "initialize", ...data });
  const later = openDisassemblyAnnotationForm(extensionUri as never);
  await deliver({ type: "ready" });
  later.initialize(
    data,
    async () => {},
    async () => {},
  );
  t.deepEqual(host.posted.at(-1), { type: "initialize", ...data });
});

test.serial("cancel disposes the panel and later messages are ignored", async (t) => {
  const form = openDisassemblyAnnotationForm(extensionUri as never);
  form.initialize(
    data,
    async () => {
      host.saves += 1;
    },
    async () => {},
  );
  await deliver({ type: "ready" });
  await deliver({ type: "cancel" });
  t.true(form.disposed);
  t.true(host.messageDisposed);
  await deliver({ type: "save", fields, regenerate: false });
  t.is(host.saves, 0);
});

test.serial("ignores messages while saving and invalid regenerate selections", async (t) => {
  const form = openDisassemblyAnnotationForm(extensionUri as never);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  form.initialize(
    data,
    async () => {
      host.saves += 1;
      await gate;
    },
    async () => {
      host.regenerates += 1;
    },
  );
  await deliver({ type: "ready" });
  const pending = deliver({ type: "save", fields, regenerate: false });
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
  await deliver({ type: "save", fields, regenerate: true });
  await deliver({ type: "cancel" });
  t.is(host.saves, 1);
  t.is(host.regenerates, 0);
  t.false(form.disposed);
  release();
  await pending;
  t.true(form.disposed);

  const retry = openDisassemblyAnnotationForm(extensionUri as never);
  retry.initialize(
    data,
    async () => {
      host.saves += 1;
    },
    async () => {},
  );
  await deliver({ type: "ready" });
  await deliver({ type: "save", fields, regenerate: "yes" });
  t.deepEqual(host.posted.at(-1), { type: "error", message: "Invalid regeneration selection." });
  t.false(retry.disposed);
});

test.serial("save then regenerate error shows a message; fail publishes errors", async (t) => {
  const form = openDisassemblyAnnotationForm(extensionUri as never);
  form.initialize(
    data,
    async () => {
      host.saves += 1;
    },
    async () => {
      host.regenerates += 1;
      throw new Error("boom");
    },
  );
  await deliver({ type: "ready" });
  await deliver({ type: "save", fields, regenerate: true });
  t.is(host.saves, 1);
  t.is(host.regenerates, 1);
  t.true(form.disposed);
  t.deepEqual(host.errors, ["Annotation saved, but regeneration failed: boom"]);

  const other = openDisassemblyAnnotationForm(extensionUri as never);
  await deliver({ type: "ready" });
  other.fail(new Error("nope"));
  other.fail("raw");
  t.deepEqual(host.posted.slice(-2), [
    { type: "error", message: "nope" },
    { type: "error", message: "raw" },
  ]);
});
