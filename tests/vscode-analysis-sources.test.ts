import vm from "node:vm";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { test } from "./ava-helper.js";
import type {
  AnalysisSourcesProvider,
  AnalysisSourcesTreeNode,
} from "../packages/vscode-extension/src/analysis-sources-tree.js";
import type { AnalysisEvidenceSource } from "@uttori/asm-disassembler";

const bundle = await build({
  entryPoints: ["packages/vscode-extension/src/analysis-sources-tree.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  plugins: [
    {
      name: "sources-host",
      setup(builder) {
        builder.onResolve(
          { filter: /^(vscode|\.\/analysis-worker-client\.js|\.\/coverage-tree\.js)$/ },
          ({ path }) => ({ path, namespace: "host" }),
        );
        builder.onLoad({ filter: /.*/, namespace: "host" }, ({ path }) => ({
          contents: `module.exports = globalThis.host[${JSON.stringify(path)}];`,
        }));
      },
    },
  ],
});

test("Sources lists metadata immediately, pages on demand, navigates qualified locations and resets comparisons", async (t) => {
  const sources: AnalysisEvidenceSource[] = ["chest", "idle"].map((name) => ({
    id: name,
    name: `${name}.json`,
    names: [`${name}.json`],
    kinds: ["runtime"],
    sha256: (name === "chest" ? "a" : "b").repeat(64),
    evidenceIds: [name],
    reports: [],
  }));
  const calls: {
    operation: string;
    options?: { baselineIds?: string[]; offset?: number; sourceId?: string };
  }[] = [];
  const picks: { picked?: boolean; sourceId?: string }[][] = [];
  let selection: unknown[] | undefined = [];
  const host = {
    vscode: {
      EventEmitter: class {
        event = () => {};
        fire() {}
        dispose() {}
      },
      ThemeIcon: class {
        constructor(readonly id: string) {}
      },
      TreeItem: class {
        constructor(
          readonly label: string,
          readonly collapsibleState: number,
        ) {}
      },
      TreeItemCollapsibleState: { None: 0, Collapsed: 1 },
      window: {
        showQuickPick: async (items: (typeof picks)[number]) => {
          picks.push(items);
          return selection;
        },
        showErrorMessage: async (message: string) => t.fail(message),
        showInformationMessage: async () => {},
      },
    },
    "./coverage-tree.js": { findAnalysisProjectDirectories: async () => ["/fixture/analysis"] },
    "./analysis-worker-client.js": {
      analysisWorker: () => ({
        request: async (
          _directory: string,
          operation: string,
          options?: (typeof calls)[number]["options"],
        ) => {
          calls.push({ operation, options });
          const manifest = {
            target: "snes.sfc",
            rom: { contentSha256: "a".repeat(64), contentSize: 1024 },
          };
          if (operation === "sources") return { manifest, sources };
          if (operation === "sourceSummary")
            return {
              manifest,
              comparison: {
                source: sources[0],
                baseline: options?.baselineIds?.length === 0 ? [] : [sources[1]],
                instructionCount: 450,
                uniqueInstructionCount: 450,
                sharedInstructionCount: 0,
                knownCodeBytes: 450,
                codeRangeCount: 1,
                unknownSizeInstructions: 0,
                functionCount: 0,
                unownedInstructions: 450,
                ambiguousInstructions: 0,
                uniqueMemoryCount: 0,
                contributionCount: 0,
                notes: ["capture loss note"],
              },
            };
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
      }),
    },
  };
  const module = { exports: {} };
  const context = vm.createContext({
    module,
    host,
    exports: {},
    require: createRequire(import.meta.url),
  });
  vm.runInContext(bundle.outputFiles[0].text, context);
  const Provider = (module.exports as { AnalysisSourcesProvider: typeof AnalysisSourcesProvider })
    .AnalysisSourcesProvider;
  const provider = new Provider();
  t.teardown(() => provider.dispose());
  let roots = await provider.getChildren();
  t.deepEqual(
    roots.map(({ label }) => label),
    ["chest.json", "idle.json"],
  );
  t.deepEqual(
    calls.map(({ operation }) => operation),
    ["sources"],
  );
  t.is(provider.getTreeItem(roots[0]).contextValue, "analysisSource");
  const children = await provider.getChildren(roots[0]);
  const unique = children.find(({ label }) => label === "Unique instructions")!;
  t.is(provider.getTreeItem(unique).description, "450");
  const pages = await provider.getChildren(unique);
  t.deepEqual(
    pages.map(({ label }) => label),
    ["1–200", "201–400", "401–450"],
  );
  t.is(calls.filter(({ operation }) => operation === "sourceEntries").length, 0);
  const entries = await provider.getChildren(pages[1]);
  t.is(calls.at(-1)?.options?.offset, 200);
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
  await provider.compare(roots[0]);
  t.is(picks[0].length, 1);
  t.true(picks[0][0].picked);
  roots = await provider.getChildren();
  t.regex(roots[0].description!, /custom comparison/);
  await provider.getChildren(roots[0]);
  t.deepEqual(
    JSON.parse(JSON.stringify(calls.at(-1)?.options?.baselineIds)),
    [],
    "an empty baseline means show all, not reset to default",
  );
  selection = undefined;
  await provider.compare(roots[0]);
  t.false(picks[1][0].picked, "custom selections survive refresh and cancelled pickers");
  await provider.resetComparison(roots[0]);
  roots = await provider.getChildren();
  await provider.getChildren(roots[0]);
  t.is(calls.at(-1)?.options?.baselineIds, undefined);
  t.false(roots[0].description!.includes("custom comparison"));
  const notes = (await provider.getChildren(roots[0])).find(
    ({ label }) => label === "Capture notes & interpretation",
  ) as AnalysisSourcesTreeNode;
  t.is((await provider.getChildren(notes))[0].label, "capture loss note");
});
