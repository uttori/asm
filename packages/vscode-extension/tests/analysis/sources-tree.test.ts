import { registerHooks } from "node:module";

import type { AnalysisEvidenceSource } from "@uttori/asm-disassembler";

import { test } from "../../../../tests/ava-helper.js";
import type { AnalysisSourcesProvider } from "../../src/analysis/sources-tree.js";

const host = {
  calls: [] as {
    operation: string;
    options?: { offset?: number; sourceId?: string };
  }[],
  sources: [] as AnalysisEvidenceSource[],
};

Object.assign(globalThis, { __uttoriAnalysisSourcesTest: host });

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "analysis-sources-test:vscode" };
    }
    if (
      typeof context.parentURL === "string" &&
      /[/\\]analysis[/\\]sources-tree\.(ts|js|mts|mjs)/.test(context.parentURL)
    ) {
      if (specifier === "./coverage-tree.js") {
        return { shortCircuit: true, url: "analysis-sources-test:coverage-tree" };
      }
      if (specifier === "./worker-client.js") {
        return { shortCircuit: true, url: "analysis-sources-test:worker-client" };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "analysis-sources-test:vscode") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          export class EventEmitter {
            event = () => {};
            fire() {}
            dispose() {}
          }
          export class ThemeIcon {
            constructor(id) { this.id = id; }
          }
          export class TreeItem {
            constructor(label, collapsibleState) {
              this.label = label;
              this.collapsibleState = collapsibleState;
            }
          }
          export const TreeItemCollapsibleState = { None: 0, Collapsed: 1 };
        `,
      };
    }
    if (url === "analysis-sources-test:coverage-tree") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          export const findAnalysisProjectDirectories = async () => ["/fixture/analysis"];
        `,
      };
    }
    if (url === "analysis-sources-test:worker-client") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriAnalysisSourcesTest;
          export const analysisWorker = () => ({
            request: async (_directory, operation, options) => {
              host.calls.push({ operation, options });
              const manifest = {
                target: "snes.sfc",
                rom: { contentSha256: "a".repeat(64), contentSize: 1024 },
              };
              if (operation === "sources") {
                return { manifest, sources: host.sources };
              }
              if (operation === "sourceSummary") {
                return {
                  manifest,
                  summary: {
                    source: host.sources[0],
                    instructionCount: 450,
                    memoryCount: 0,
                    contributionCount: 0,
                  },
                };
              }
              return [
                {
                  id: "pc",
                  label: "$C3002C",
                  description: "snes.cpu",
                  detail: "Captured bytes: A9 01",
                  addressSpace: "snes.cpu",
                  address: 0xc3002c,
                  architecture: "snes.65816",
                  outputOffsets: [0x3002c],
                  recordIds: ["node"],
                },
              ];
            },
          });
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { AnalysisSourcesProvider: Provider } = await import("../../src/analysis/sources-tree.js");

test("Sources lists metadata immediately, pages on demand, navigates qualified locations", async (t) => {
  host.sources = ["capture-a", "capture-b"].map((name) => ({
    id: name,
    name: `${name}.json`,
    names: [`${name}.json`],
    kinds: ["runtime"],
    sha256: (name === "capture-a" ? "a" : "b").repeat(64),
    evidenceIds: [name],
    reports: [],
  }));
  host.calls = [];
  const provider = new Provider() as AnalysisSourcesProvider;
  t.teardown(() => provider.dispose());
  const roots = await provider.getChildren();
  t.deepEqual(
    roots.map(({ label }) => label),
    ["capture-a.json", "capture-b.json"],
  );
  t.deepEqual(
    host.calls.map(({ operation }) => operation),
    ["sources"],
  );
  t.is(provider.getTreeItem(roots[0]).contextValue, "analysisSource");
  const children = await provider.getChildren(roots[0]);
  const unique = children.find(({ label }) => label === "Observed instructions")!;
  t.is(provider.getTreeItem(unique).description, "450");
  const pages = await provider.getChildren(unique);
  t.deepEqual(
    pages.map(({ label }) => label),
    ["1–200", "201–400", "401–450"],
  );
  t.is(host.calls.filter(({ operation }) => operation === "sourceEntries").length, 0);
  const entries = await provider.getChildren(pages[1]);
  t.is(host.calls.at(-1)?.options?.offset, 200);
  const navigation = provider.getTreeItem(entries[0]).command!;
  t.is(navigation.command, "asm.analysis.navigate");
  t.deepEqual(JSON.parse(JSON.stringify(navigation.arguments?.[0])), {
    projectDirectory: "/fixture/analysis",
    target: "snes.sfc",
    romContentSha256: "a".repeat(64),
    romContentSize: 1024,
    addressSpace: "snes.cpu",
    address: 0xc3002c,
    outputOffsets: [0x3002c],
    architectureHints: ["snes.65816"],
    recordIds: ["node"],
  });
  t.false(children.some(({ label }) => label === "Compared with"));
  const notes = children.find(({ label }) => label === "Capture notes & interpretation");
  if (!notes) {
    throw new Error("missing capture notes");
  }
  t.deepEqual(await provider.getChildren(notes), []);
});
