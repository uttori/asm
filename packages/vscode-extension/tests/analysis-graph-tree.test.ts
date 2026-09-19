import { registerHooks } from "node:module";

import type { AnalysisCallGraph } from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";

const SHA = "ab".repeat(32);

const host = {
  projectDirectories: ["/fixture/analysis"] as string[],
  request: async (_directory: string, _operation: string): Promise<unknown> => {
    throw new Error("unhandled");
  },
};

(globalThis as { __uttoriAnalysisGraphTreeTest?: typeof host }).__uttoriAnalysisGraphTreeTest =
  host;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "analysis-graph-tree-test:vscode" };
    }
    const parent = context.parentURL ?? "";
    const fromGraph =
      parent.includes("analysis-graph-tree.ts") || parent.includes("analysis-graph-tree.js");
    if (fromGraph && specifier === "./analysis-worker-client.js") {
      return { shortCircuit: true, url: "analysis-graph-tree-test:worker" };
    }
    if (fromGraph && specifier === "./coverage-tree.js") {
      return { shortCircuit: true, url: "analysis-graph-tree-test:coverage" };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "analysis-graph-tree-test:vscode") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          export class EventEmitter {
            event = () => {};
            fire() {}
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
          export const Uri = {
            file: (file) => ({ fsPath: file, scheme: "file", toString: () => "file://" + file }),
          };
        `,
      };
    }
    if (url === "analysis-graph-tree-test:worker") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriAnalysisGraphTreeTest;
          export const analysisWorker = () => ({
            request: (...args) => host.request(...args),
          });
        `,
      };
    }
    if (url === "analysis-graph-tree-test:coverage") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriAnalysisGraphTreeTest;
          export const findAnalysisProjectDirectories = async () => host.projectDirectories;
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { AnalysisGraphProvider } = await import("../src/analysis-graph-tree.js");

const manifest = {
  target: "snes.sfc",
  mapping: { mapper: "lorom" },
  rom: { contentSha256: SHA, contentSize: 1024 },
};

const graph: AnalysisCallGraph = {
  functions: [
    {
      id: "fn:main",
      addressSpace: "snes.cpu",
      address: 0x80_8000,
      source: "entry",
      labels: [{ id: "lbl", name: "Main" }],
      nodeIds: ["n1"],
      outputOffsets: [0],
      incomingCallIds: ["call:1"],
      outgoingCallIds: ["call:1"],
      unresolvedIds: ["unres:1"],
      evidence: [],
    },
  ],
  calls: [
    {
      id: "call:1",
      edgeKind: "call",
      addressSpace: "snes.cpu",
      fromAddress: 0x80_8000,
      toAddress: 0x80_8010,
      fromNodeId: "n1",
      callerFunctionIds: ["fn:main"],
      calleeFunctionIds: ["fn:main"],
      fromOutputOffsets: [0],
      toOutputOffsets: [16],
      indirect: false,
      evidence: [],
    },
  ],
  unresolved: [
    {
      id: "unres:1",
      addressSpace: "snes.cpu",
      address: 0x80_8020,
      flowKind: "jump",
      indirect: true,
      reason: "dynamic",
      nodeIds: ["n2"],
      ownerFunctionIds: ["fn:main"],
      outputOffsets: [],
      evidence: [],
    },
  ],
  orphanCallIds: ["orphan-call"],
  orphanUnresolvedIds: [],
};

const target = {
  projectDirectory: "/fixture/analysis",
  target: "snes.sfc",
  romContentSha256: SHA,
  romContentSize: 1024,
  addressSpace: "snes.cpu",
  address: 0x80_8000,
  outputOffsets: [0],
  architectureHints: ["snes.65816"],
  recordIds: ["fn:main", "n1"],
};

test.beforeEach(() => {
  host.projectDirectories = ["/fixture/analysis"];
  host.request = async () => {
    throw new Error("unhandled");
  };
});

test.serial(
  "AnalysisGraphProvider expands projects, functions, calls, unresolved and orphans",
  async (t) => {
    host.request = async (_directory, operation) => {
      if (operation === "manifest") {
        return manifest;
      }
      if (operation === "graph") {
        return { graph, hints: { [`snes.cpu:${0x80_8000}`]: ["snes.65816"] } };
      }
      throw new Error(operation);
    };
    const provider = new AnalysisGraphProvider();
    const [root] = await provider.getChildren();
    t.is(root.label, "analysis");
    t.is(provider.getTreeItem(root).command?.command, "vscode.open");
    t.is(provider.getTreeItem(root).contextValue, "analysisGraph");
    const groups = await provider.getChildren(root);
    t.deepEqual(
      groups.map((node) => node.label),
      ["Functions", "Call edges", "Unresolved flow", "Ownership diagnostics"],
    );
    const [fn] = await provider.getChildren(groups[0]);
    t.is(fn.label, "Main");
    t.is(provider.getTreeItem(fn).command?.command, "asm.analysis.navigate");
    t.is(provider.getTreeItem(fn).contextValue, "analysisGraphLocation");
    t.deepEqual(provider.navigationTarget(fn)?.architectureHints, ["snes.65816"]);
    const [incoming, outgoing, unresolved] = await provider.getChildren(fn);
    t.is(incoming.description, "1");
    t.true((await provider.getChildren(incoming))[0]?.label.startsWith("← "));
    t.true((await provider.getChildren(outgoing))[0]?.label.startsWith("→ "));
    t.is((await provider.getChildren(unresolved))[0]?.label, "$808020 jump");
    const [call] = await provider.getChildren(groups[1]);
    t.true(call.label.includes("→"));
    t.is(
      (await provider.getChildren(groups[2]))[0]?.id,
      "analysis-graph:/fixture/analysis:unresolved:unres:1",
    );
    t.is((await provider.getChildren(groups[3]))[0]?.label, "orphan-call");
  },
);

test.serial("navigationTarget accepts valid identities and rejects incomplete ones", (t) => {
  const provider = new AnalysisGraphProvider();
  t.deepEqual(provider.navigationTarget(target), target);
  t.deepEqual(provider.navigationTarget({ navigationTarget: target }), target);
  t.is(provider.navigationTarget({ ...target, romContentSha256: "A".repeat(64) }), undefined);
  t.is(provider.navigationTarget({ ...target, projectDirectory: "" }), undefined);
  t.is(provider.navigationTarget({ navigationTarget: { bad: true } }), undefined);
  t.is(provider.navigationTarget(null), undefined);
  t.is(provider.navigationTarget(1), undefined);
});

test.serial("manifest failures, graph load errors and function paging", async (t) => {
  const provider = new AnalysisGraphProvider();
  host.request = async () => {
    throw new Error("manifest down");
  };
  const [errorRoot] = await provider.getChildren();
  t.is(errorRoot.description, "could not load analysis project");
  t.true(errorRoot.tooltip?.includes("manifest down"));
  t.is(provider.getTreeItem(errorRoot).command?.command, "vscode.open");

  host.request = async (_directory, operation) => {
    if (operation === "manifest") {
      return manifest;
    }
    // oxlint-disable-next-line typescript/only-throw-error
    throw "graph down";
  };
  const [root] = await provider.getChildren();
  t.is((await provider.getChildren(root))[0]?.label, "Could not load graph");

  const functions = Array.from({ length: 201 }, (_, index) => ({
    id: `fn:${index}`,
    addressSpace: "cpu",
    address: index,
    source: "analysis",
    labels: [],
    nodeIds: [],
    outputOffsets: [],
    incomingCallIds: [],
    outgoingCallIds: [],
    unresolvedIds: [],
    evidence: [],
  }));
  host.request = async (_directory, operation) => {
    if (operation === "manifest") {
      return manifest;
    }
    if (operation === "graph") {
      return {
        graph: {
          functions,
          calls: [],
          unresolved: [],
          orphanCallIds: [],
          orphanUnresolvedIds: [],
        },
        hints: {},
      };
    }
    throw new Error(operation);
  };
  provider.refresh();
  const [pagedRoot] = await provider.getChildren();
  const [functionsGroup] = await provider.getChildren(pagedRoot);
  const pages = await provider.getChildren(functionsGroup);
  t.is(pages.length, 2);
  t.is(pages[0]?.label, "1–200");
  t.is(pages[1]?.label, "201–201");
  t.is((await provider.getChildren(pages[0])).length, 200);
  t.is((await provider.getChildren(pages[1]))[0]?.label, "fn:200");
});
