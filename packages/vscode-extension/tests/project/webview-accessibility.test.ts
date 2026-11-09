import fs from "node:fs";

import { Window, type HTMLElement, type HTMLInputElement, type HTMLButtonElement } from "happy-dom";

import { test } from "../../../../tests/ava-helper.js";
import { buildHomeSnapshot, type HomeSnapshot } from "../../src/project/home-model.js";
import { sourceWorkflow } from "../../src/source/workflow.js";

/** Exercise the shipped scripts against a DOM; layout and native key activation are checked in the browser receipt. */
function webview(name: string) {
  // Only checked-in application scripts are evaluated; no external HTML or script is accepted.
  const window = new Window({
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  });
  const messages: Record<string, unknown>[] = [];
  window.document.write(fs.readFileSync(`packages/vscode-extension/media/${name}.html`, "utf8"));
  window.document.querySelectorAll("script").forEach((node) => node.remove());
  Object.assign(window, {
    acquireVsCodeApi: () => ({
      postMessage: (message: Record<string, unknown>) => messages.push(message),
      getState: () => undefined,
      setState: () => {},
    }),
  });
  // Canvas drawing is irrelevant to the message/keyboard contract and has no native implementation in this DOM.
  Object.assign(window.HTMLCanvasElement.prototype, {
    getContext: () => ({ fillRect() {}, clearRect() {}, strokeRect() {}, putImageData() {} }),
  });
  Object.assign(window, {
    ImageData: class {
      data: Uint8ClampedArray;
      constructor(width: number, height: number) {
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    },
  });
  window.eval(fs.readFileSync(`packages/vscode-extension/media/${name}.js`, "utf8"));
  return {
    window,
    messages,
    document: window.document,
    post: (data: unknown) => window.dispatchEvent(new window.MessageEvent("message", { data })),
    key: (key: string) =>
      window.document.activeElement.dispatchEvent(
        new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      ),
    close: () => window.happyDOM.abort(),
  };
}

/** A realistic source snapshot keeps the host's complete incoming payload in the webview test. */
function sourceSnapshot(): HomeSnapshot {
  return buildHomeSnapshot({
    trusted: true,
    watch: false,
    indexReady: false,
    status: {
      fileCount: 0,
      symbolCount: 0,
      referenceCount: 0,
      errorCount: 0,
      lastReindexRootCount: 0,
      lastReindexCachedRoots: 0,
      lastReindexAnalyzedRoots: 0,
      entryPoints: [],
      includePaths: [],
    },
    source: {
      root: "/games/example",
      branch: "main",
      dirty: false,
      target: "snes.sfc",
      name: "Example",
      candidate: "candidate",
      previewed: false,
      workflow: sourceWorkflow({ candidate: true }),
      capturePhase: "idle",
      incoming: Array.from({ length: 288 }, (_, index) => ({
        path: `bank-${index}.asm`,
        status: "M",
        conflict: index === 150,
        additions: 3,
        deletions: 2,
        left: `left-${index}`,
        right: `right-${index}`,
        title: `Diff ${index}`,
      })),
    },
  });
}

test("Home exposes 288 semantic file buttons, navigates boundaries, and opens the last diff", async (t) => {
  const h = webview("home");
  t.teardown(h.close);
  h.post({ type: "snapshot", ...sourceSnapshot() });
  const list = h.document.querySelector<HTMLElement>("#incoming-files")!;
  const rows = list.querySelectorAll("button");
  t.is(rows.length, 288);
  t.is(list.tagName, "UL");
  t.is(list.getAttribute("aria-labelledby"), "incoming-title");
  t.is(rows[150].querySelector(".sr-only")?.textContent, ", Conflict");
  t.is(
    rows[287].querySelector(".sr-only")?.textContent,
    ", Modified, 3 lines added, 2 lines deleted",
  );
  list.focus();
  h.key("ArrowDown");
  t.is(h.document.activeElement, rows[0]);
  h.key("End");
  t.is(h.document.activeElement, rows[287]);
  h.key("ArrowDown");
  t.is(h.document.activeElement, rows[287]);
  h.key("Home");
  h.key("ArrowUp");
  t.is(h.document.activeElement, rows[0]);
  rows[287].click();
  t.deepEqual(h.messages.at(-1), {
    type: "diff",
    left: "left-287",
    right: "right-287",
    title: "Diff 287",
  });
});

test("Home preserves file focus and scroll through snapshots and action replies without stealing outside focus", (t) => {
  const h = webview("home");
  t.teardown(h.close);
  const snapshot = sourceSnapshot();
  h.post({ type: "snapshot", ...snapshot });
  h.document.querySelectorAll<HTMLButtonElement>(".home-file")[200].focus();
  h.document.getElementById("incoming-files")!.scrollTop = 4321;
  const focused = h.document.activeElement;
  h.post({ type: "snapshot", ...snapshot });
  t.is(
    h.document.activeElement,
    focused,
    "identical refreshes retain the DOM and screen reader browse position",
  );
  snapshot.health.index.files = 1;
  h.post({ type: "snapshot", ...snapshot });
  t.is(h.document.activeElement.getAttribute("data-focus-key"), "diff:bank-200.asm");
  t.is(h.document.getElementById("incoming-files")!.scrollTop, 4321);
  h.post({ type: "actionComplete", command: "diff", error: "Could not open diff" });
  t.is(h.document.activeElement.getAttribute("data-focus-key"), "diff:bank-200.asm");
  t.is(h.document.querySelector('[role="status"]')?.textContent, "Could not open diff");
  snapshot.incoming!.files = [];
  snapshot.incoming!.total = 0;
  h.post({ type: "snapshot", ...snapshot });
  t.not(h.document.activeElement, h.document.body);
  h.document.activeElement.blur();
  h.post({ type: "snapshot", ...snapshot });
  t.is(h.document.activeElement, h.document.body);
});

test("Home discards a candidate from its main controls and offers Prepare without the old diff", (t) => {
  const h = webview("home");
  t.teardown(h.close);
  const snapshot = sourceSnapshot();
  h.post({ type: "snapshot", ...snapshot });
  const discard = h.document.querySelector<HTMLButtonElement>(
    '[data-focus-key="command:asm.source.discard:[]"]',
  )!;
  t.truthy(discard);
  t.is(discard.closest("#more-actions"), null);
  discard.focus();
  discard.click();
  t.deepEqual(h.messages.at(-1), { type: "command", command: "asm.source.discard", args: [] });
  h.post({
    type: "snapshot",
    ...snapshot,
    candidate: undefined,
    incoming: undefined,
    canDiscard: false,
    next: { command: "asm.source.prepare", title: "2. Prepare Regeneration" },
  });
  t.is(h.document.querySelector("#incoming-files"), null);
  t.is(h.document.querySelector('[data-focus-key="command:asm.source.discard:[]"]'), null);
  const prepare = h.document.querySelector<HTMLButtonElement>(
    '[data-focus-key="command:asm.source.prepare:[]"]',
  )!;
  t.false(prepare.disabled);
  prepare.click();
  t.deepEqual(h.messages.at(-1), { type: "command", command: "asm.source.prepare", args: [] });
});

test("Home hides discard when the workflow is busy or merging and disables it without trust", (t) => {
  const h = webview("home");
  t.teardown(h.close);
  const snapshot = sourceSnapshot();
  const selector = '[data-focus-key="command:asm.source.discard:[]"]';
  h.post({ type: "snapshot", ...snapshot, trusted: false });
  t.true(h.document.querySelector<HTMLButtonElement>(selector)!.disabled);
  for (const sourcePhase of ["busy", "merging"]) {
    h.post({ type: "snapshot", ...snapshot, sourcePhase, canDiscard: false });
    t.is(h.document.querySelector(selector), null);
  }
});

test("Home disclosures expose state, keep focus and preserve an unsubmitted settings draft", (t) => {
  const h = webview("home");
  t.teardown(h.close);
  const snapshot = sourceSnapshot();
  h.post({ type: "snapshot", ...snapshot });
  const more = h.document.querySelector<HTMLElement>("#more-toggle")!;
  more.focus();
  more.click();
  t.is(h.document.activeElement.id, "more-toggle");
  t.is(h.document.activeElement.getAttribute("aria-expanded"), "true");
  h.document.querySelector<HTMLElement>(":focus")?.click();
  t.is(h.document.querySelector<HTMLElement>("#more-actions")?.hidden, true);
  const assembly = {
    ...snapshot,
    mode: "assembly",
    incoming: undefined,
    assembly: {
      targets: [],
      architectures: [],
      target: "snes",
      architecture: "65816",
      output: "game.sfc",
      entryPoints: ["boot.asm"],
      includePaths: ["lib"],
    },
  };
  h.post({ type: "snapshot", ...assembly });
  h.document.querySelector<HTMLElement>("#settings-toggle")!.focus();
  h.document.querySelector<HTMLElement>(":focus")!.click();
  t.is(h.document.activeElement.getAttribute("aria-expanded"), "true");
  const output = h.document.querySelector<HTMLInputElement>("#buildOutput")!;
  output.focus();
  output.value = "unfinished.sfc";
  output.setSelectionRange(2, 5);
  h.post({ type: "snapshot", ...assembly });
  const replacement = h.document.querySelector<HTMLInputElement>("#buildOutput")!;
  t.is(h.document.activeElement, replacement);
  t.is(replacement.value, "unfinished.sfc");
  t.is(replacement.selectionStart, 2);
  t.is(
    h.document.querySelector('[aria-label="Remove boot.asm from entry points"]')?.textContent,
    "Remove",
  );
});

test("Palette selection and document updates retain swatch focus and expose color words", (t) => {
  const h = webview("palette");
  t.teardown(h.close);
  const data = {
    type: "palette",
    version: 1,
    palettes: [{ id: "test", name: "Test", firstIndex: 0, words: ["0000", "7FFF"] }],
  };
  h.post(data);
  const slot = h.document.querySelector<HTMLButtonElement>('[data-slot="1"]')!;
  slot.focus();
  slot.click();
  t.is(h.document.activeElement.getAttribute("aria-label"), "Slot 1: $7FFF");
  t.is(h.document.activeElement.getAttribute("aria-pressed"), "true");
  h.post({ ...data, version: 2 });
  t.is(h.document.activeElement.getAttribute("data-slot"), "1");
  const apply = h.document.querySelector<HTMLButtonElement>("#apply")!;
  apply.focus();
  const submit = () =>
    h.document
      .getElementById("edit")!
      .dispatchEvent(new h.window.Event("submit", { cancelable: true }));
  submit();
  submit();
  t.is(h.document.activeElement, apply, "pending palette edits retain keyboard focus");
  t.is(h.messages.filter((message) => message.type === "edit").length, 1);
  h.post({ type: "error", text: "Retry this edit" });
  t.is(apply.getAttribute("aria-disabled"), "false");
  t.is(h.document.activeElement, apply);
});

test("PNG keyboard editor reads pixels and submits bounded, versioned edits with the same tile restrictions as pointer strokes", (t) => {
  const h = webview("indexed-png");
  t.teardown(h.close);
  const palette = Array.from({ length: 32 }, (_, index) => [index, index, index, 255]);
  const data = {
    type: "image",
    version: 7,
    width: 4,
    height: 2,
    palette,
    indexes: Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]).toString("base64"),
    regions: [{ label: "Tile A", x: 1, y: 0, width: 2, height: 1, paletteStart: 16, uses: 2 }],
  };
  h.post(data);
  const x = h.document.querySelector<HTMLInputElement>("#pixel-x")!;
  const y = h.document.querySelector<HTMLInputElement>("#pixel-y")!;
  const inspect = () => x.dispatchEvent(new h.window.Event("input", { bubbles: true }));
  const submit = () =>
    h.document
      .getElementById("pixel-edit")!
      .dispatchEvent(new h.window.Event("submit", { bubbles: true, cancelable: true }));
  const paintCount = () => h.messages.filter((message) => message.type === "paint").length;
  x.value = "1";
  y.value = "0";
  inspect();
  t.true(
    h.document
      .getElementById("pixel-info")!
      .textContent.includes("palette slot 1, RGBA 1, 1, 1, 255"),
  );
  t.true(
    h.document.getElementById("pixel-info")!.textContent.includes("Tile A, slots 16 through 31"),
  );
  const slot = h.document.querySelector<HTMLButtonElement>('[data-slot="17"]')!;
  slot.focus();
  slot.click();
  t.is(h.document.activeElement.getAttribute("data-slot"), "17");
  submit();
  t.deepEqual(h.messages.at(-1), { type: "paint", version: 7, pixels: [1], index: 17 });
  submit();
  t.is(paintCount(), 1, "pending edits cannot be duplicated");
  h.post({ type: "error", text: "Version changed" });
  x.value = "0";
  inspect();
  submit();
  t.is(paintCount(), 1, "padding stays uneditable");
  for (const invalid of ["", "-1", "4", "1.5"]) {
    x.value = invalid;
    inspect();
    submit();
    t.is(paintCount(), 1, `invalid column ${invalid}`);
  }
  x.value = "1";
  h.post({
    ...data,
    version: 8,
    regions: [
      { ...data.regions[0], paletteStart: 0 },
      { ...data.regions[0], x: 3, width: 1 },
    ],
  });
  submit();
  t.is(paintCount(), 1, "wrong palette group is rejected");
  h.document.querySelector<HTMLButtonElement>('[data-slot="0"]')!.click();
  submit();
  t.deepEqual(h.messages.at(-1), { type: "paint", version: 8, pixels: [1], index: 0 });
});
