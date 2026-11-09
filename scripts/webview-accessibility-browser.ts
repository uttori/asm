/* Browser-side audit of the shipped webview assets. This module is served by check-webview-accessibility.ts. */
import type { AxeResults, RunOptions } from "axe-core";

declare global {
  /** APIs installed by the local audit fixture before the shipped script loads. */
  interface Window {
    /** The scanner runs inside each fixture so computed styles belong to that document. */
    axe: { run(context: Document, options: RunOptions): Promise<AxeResults> };
    /** Outbound editor messages retained by the test-only VS Code API stub. */
    auditMessages: Record<string, unknown>[];
  }
}
const frame = document.querySelector("iframe");
if (!frame) {
  throw new Error("Missing webview fixture frame.");
}
const results: { name: string; passed?: boolean; detail?: string; incomplete?: string[] }[] = [];
const failures: { name: string; detail: string }[] = [];
/** Record every assertion in a durable receipt, including failures instead of aborting the audit early. */
function check(name: string, passed: boolean, detail = "") {
  results.push({ name, passed, detail });
  if (!passed) {
    failures.push({ name, detail });
  }
  document.getElementById("results")!.textContent = JSON.stringify(results, null, 2);
}
/**
 * Let message rendering and browser layout settle before measuring or scanning.
 * @returns Resolves after two animation frames.
 */
const settle = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
try {
  for (const name of ["source", "assembly", "recovery", "palette", "png"]) {
    await new Promise((resolve) => {
      frame.addEventListener("load", resolve, { once: true });
      frame.src = `/${name}`;
    });
    await settle();
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    if (!win || !doc) {
      throw new Error("Missing fixture document.");
    }
    doc.getElementById("settings-toggle")?.click();
    doc.getElementById("more-toggle")?.click();
    await settle();
    if (name === "source") {
      const list = doc.getElementById("incoming-files")!;
      check("288 rendered file buttons", list.querySelectorAll("button").length === 288);
      check(
        "Incoming has bounded vertical overflow",
        list.scrollHeight > list.clientHeight &&
          ["auto", "scroll"].includes(win.getComputedStyle(list).overflowY),
      );
      list.focus();
      list.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }),
      );
      await settle();
      const last = list.querySelector<HTMLButtonElement>("li:last-child button")!;
      check("End focuses file 288", doc.activeElement === last);
      const bounds = last.getBoundingClientRect();
      const container = list.getBoundingClientRect();
      check(
        "Last file is visibly scrolled into view",
        bounds.bottom <= container.bottom + 1 && bounds.top >= container.top - 1,
      );
      last.click();
      check("Last diff retains its identity", win.auditMessages.at(-1)?.right === "right-287");
      list.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }),
      );
      check("Home returns to first file", doc.activeElement === list.querySelector("button"));
    }
    for (const width of [320, 200]) {
      frame.style.width = `${width}px`;
      await settle();
      check(
        `${name}: no horizontal clipping at ${width}px`,
        doc.documentElement.scrollWidth <= width + 1,
        `scroll width ${doc.documentElement.scrollWidth}`,
      );
      if (name === "source") {
        const root = doc.getElementById("root")!;
        const page = doc.scrollingElement!;
        const contentBottom = root.getBoundingClientRect().bottom + win.scrollY;
        const padding = Number.parseFloat(win.getComputedStyle(doc.body).paddingBottom);
        // An absolute screen-reader label can escape the list's overflow clip even
        // when the list itself reports a bounded height. Measure the whole page too.
        check(
          `Home: no overflow below its content at ${width}px`,
          page.scrollHeight <= Math.max(page.clientHeight, Math.ceil(contentBottom + padding)) + 1,
          `page height ${page.scrollHeight}, content bottom ${contentBottom + padding}`,
        );
      }
    }
    frame.style.width = "320px";
    await settle();
    frame.style.width = "640px";
    doc.documentElement.style.zoom = "2";
    await settle();
    check(
      `${name}: 200% zoom reflows without horizontal clipping`,
      doc.documentElement.scrollWidth <= 640,
      `scroll width ${doc.documentElement.scrollWidth}`,
    );
    doc.documentElement.style.zoom = "1";
    frame.style.width = "320px";
    for (const theme of ["dark", "light", "high-contrast"]) {
      const light = theme === "light";
      const contrast = theme === "high-contrast";
      let background = "#252526";
      let foreground = "#cccccc";
      let control = "#313131";
      let link = "#4daafc";
      let accent = "#0078d4";
      if (light) {
        background = "#ffffff";
        foreground = "#333333";
        control = "#eeeeee";
        link = "#005fb8";
      } else if (contrast) {
        background = "#000000";
        foreground = "#ffffff";
        control = "#000000";
        link = "#ffff00";
        accent = "#000000";
      }
      const tokens = {
        foreground,
        descriptionForeground: foreground,
        "sideBar-background": background,
        "input-background": control,
        "input-foreground": foreground,
        "dropdown-background": control,
        "dropdown-foreground": foreground,
        "button-secondaryBackground": control,
        "button-secondaryForeground": foreground,
        "icon-foreground": foreground,
        "textLink-foreground": link,
        "button-background": accent,
        "gitDecoration-addedResourceForeground": foreground,
        "gitDecoration-modifiedResourceForeground": foreground,
        errorForeground: foreground,
      };
      for (const [token, value] of Object.entries(tokens)) {
        doc.documentElement.style.setProperty(`--vscode-${token}`, value);
      }
      doc.body.style.background = background;
      await settle();
      const scan = await win.axe.run(doc, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
        },
      });
      check(
        `${name} ${theme}: axe WCAG 2.2 AA and best practices`,
        scan.violations.length === 0,
        JSON.stringify(
          scan.violations.map(({ id, nodes }) => ({
            id,
            count: nodes.length,
            examples: nodes
              .slice(0, 3)
              .map((node) => ({ target: node.target, reason: node.failureSummary })),
          })),
        ),
      );
      results.push({
        name: `${name} ${theme}: manual review required by axe`,
        incomplete: scan.incomplete.map(({ id }) => id),
        detail: JSON.stringify(
          scan.incomplete.map(({ id, nodes }) => ({
            id,
            count: nodes.length,
            examples: nodes
              .slice(0, 2)
              .map((node) => ({ target: node.target, reason: node.failureSummary })),
          })),
        ),
      });
    }
  }
} catch (error) {
  check("Audit completed without runtime errors", false, String(error));
}
const report = {
  checkedAt: new Date().toISOString(),
  browser: navigator.userAgent,
  results,
  failures,
};
await fetch("/report", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(report),
});
document.getElementById("status")!.textContent =
  `${failures.length ? "FAILED" : "PASSED"}: ${results.filter((result) => "passed" in result).length} rendered checks, ${failures.length} failures. Manual screen reader and native keyboard verification is required.`;
document.getElementById("results")!.textContent = JSON.stringify(report, null, 2);
