import { registerHooks } from "node:module";

import type { LanguageClient } from "vscode-languageclient/node";

import { test } from "../../../../tests/ava-helper.js";

function isLanguageClient(value: object): value is LanguageClient {
  return "sendRequest" in value && typeof value.sendRequest === "function";
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vscode") {
      return { shortCircuit: true, url: "outline-tree-test:vscode" };
    }
    if (specifier === "vscode-languageclient") {
      return { shortCircuit: true, url: "outline-tree-test:lsp" };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "outline-tree-test:vscode") {
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
          export class Range {
            constructor(startLine, startCharacter, endLine, endCharacter) {
              this.start = { line: startLine, character: startCharacter };
              this.end = { line: endLine, character: endCharacter };
            }
          }
          export const Uri = {
            parse: (value) => ({ fsPath: value.replace(/^file:\\/\\//, ""), toString: () => value, scheme: "file" }),
          };
        `,
      };
    }
    if (url === "outline-tree-test:lsp") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          export const SymbolKind = {
            Namespace: 3,
            Function: 12,
            Constant: 14,
            Struct: 23,
            Field: 8,
            Variable: 13,
          };
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { ProjectOutlineProvider } = await import("../../src/project/outline-tree.js");
const { ThemeIcon } = await import("vscode");

const client = (sendRequest: (method: string, ...rest: unknown[]) => unknown): LanguageClient => {
  const stub = { sendRequest };
  if (!isLanguageClient(stub)) {
    throw new Error("language client stub");
  }
  return stub;
};

const range = (
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number,
) => ({
  start: { line: startLine, character: startCharacter },
  end: { line: endLine, character: endCharacter },
});

test("getChildren returns [] when the language client is missing or throws", async (t) => {
  t.deepEqual(await new ProjectOutlineProvider(() => undefined).getChildren(), []);
  t.deepEqual(
    await new ProjectOutlineProvider(() =>
      client(async () => {
        throw new Error("offline");
      }),
    ).getChildren(),
    [],
  );
});

test("loadRoots maps entry, file, orphanGroup and include nodes with lazy file symbols", async (t) => {
  const provider = new ProjectOutlineProvider(() =>
    client(async () => [
      {
        id: "entry",
        label: "boot.asm",
        detail: "entry",
        kind: "entry",
        uri: "file:///boot.asm",
        children: [
          {
            id: "file:boot",
            label: "boot.asm",
            kind: "file",
            uri: "file:///boot.asm",
            children: [{ id: "inc", label: "inc.asm", kind: "include", uri: "file:///inc.asm" }],
          },
        ],
      },
      {
        id: "orphans",
        label: "Orphans",
        kind: "orphanGroup",
        children: [
          { id: "file:unused", label: "unused.asm", kind: "file", uri: "file:///unused.asm" },
        ],
      },
      { id: "loose-include", label: "lib.asm", kind: "include" },
    ]),
  );
  const roots = await provider.getChildren();
  t.deepEqual(
    roots.map((node) => ({
      id: node.id,
      collapsible: node.collapsible,
      icon: node.icon.id,
      symbolUri: node.symbolUri,
      includeCount: node.includeChildren?.length,
      childIds: node.children?.map((child) => child.id),
    })),
    [
      {
        id: "entry",
        collapsible: true,
        icon: "folder-library",
        symbolUri: undefined,
        includeCount: undefined,
        childIds: ["file:boot"],
      },
      {
        id: "orphans",
        collapsible: true,
        icon: "folder",
        symbolUri: undefined,
        includeCount: undefined,
        childIds: ["file:unused"],
      },
      {
        id: "loose-include",
        collapsible: false,
        icon: "link",
        symbolUri: undefined,
        includeCount: undefined,
        childIds: [],
      },
    ],
  );
  const file = roots[0].children![0];
  t.is(file.symbolUri, "file:///boot.asm");
  t.is(file.icon.id, "file");
  t.is(file.includeChildren?.[0]?.kind, "include");
  t.is(file.children, undefined);
  t.is(provider.getTreeItem(file).contextValue, "file");
  t.is(provider.getTreeItem(roots[2]).contextValue, "symbol");
});

test("getTreeItem opens vscode.open with a Range only when uri and range are present", (t) => {
  const provider = new ProjectOutlineProvider(() => undefined);
  const withRange = provider.getTreeItem({
    id: "sym",
    label: "Main",
    collapsible: false,
    icon: new ThemeIcon("symbol-method"),
    uri: "file:///boot.asm",
    range: range(1, 2, 3, 4),
  });
  t.is(withRange.command?.command, "vscode.open");
  t.is(withRange.command?.arguments?.[1]?.selection.start.line, 1);
  t.is(withRange.command?.arguments?.[1]?.selection.start.character, 2);
  t.is(withRange.command?.arguments?.[1]?.selection.end.line, 3);
  t.is(withRange.command?.arguments?.[1]?.selection.end.character, 4);
  const withoutRange = provider.getTreeItem({
    id: "file",
    label: "boot.asm",
    collapsible: true,
    icon: new ThemeIcon("file"),
    uri: "file:///boot.asm",
    symbolUri: "file:///boot.asm",
  });
  t.deepEqual(withoutRange.command?.arguments, [withoutRange.resourceUri]);
  t.is(withoutRange.command?.arguments?.length, 1);
  const bare = provider.getTreeItem({
    id: "group",
    label: "Orphans",
    collapsible: true,
    icon: new ThemeIcon("folder"),
  });
  t.is(bare.command, undefined);
});

test("getChildren(file) loads document symbols and include children", async (t) => {
  const provider = new ProjectOutlineProvider(() =>
    client(async (method: string) => {
      if (method === "asm/projectOutline") {
        return [
          {
            id: "file:boot",
            label: "boot.asm",
            kind: "file",
            uri: "file:///boot.asm",
            children: [{ id: "inc", label: "inc.asm", kind: "include", uri: "file:///inc.asm" }],
          },
        ];
      }
      if (method === "textDocument/documentSymbol") {
        return [
          {
            name: "Main",
            kind: 12,
            detail: "entry",
            range: range(0, 0, 10, 0),
            selectionRange: range(1, 0, 1, 4),
            children: [{ name: "Helper", kind: 12, range: range(2, 0, 4, 0) }],
          },
        ];
      }
      return null;
    }),
  );
  const [file] = await provider.getChildren();
  const children = await provider.getChildren(file);
  t.deepEqual(
    children.map((node) => ({ id: node.id, label: node.label, collapsible: node.collapsible })),
    [
      { id: "file:boot:0", label: "Main", collapsible: true },
      { id: "inc", label: "inc.asm", collapsible: false },
    ],
  );
  t.deepEqual(provider.getTreeItem(children[0]).command?.arguments?.[1]?.selection.start, {
    line: 1,
    character: 0,
  });
  t.is((await provider.getChildren(children[0]))[0]?.label, "Helper");
  const offline = new ProjectOutlineProvider(() =>
    client(async (method: string) => {
      if (method === "asm/projectOutline") {
        return [{ id: "file:x", label: "x.asm", kind: "file", uri: "file:///x.asm", children: [] }];
      }
      throw new Error("symbols offline");
    }),
  );
  const [offlineFile] = await offline.getChildren();
  t.deepEqual(await offline.getChildren(offlineFile), []);
});

test("symbol kinds map to ThemeIcon ids", async (t) => {
  const kinds: Array<[number, string]> = [
    [3, "symbol-namespace"],
    [12, "symbol-method"],
    [14, "symbol-constant"],
    [23, "symbol-struct"],
    [8, "symbol-field"],
    [13, "symbol-variable"],
    [1, "symbol-misc"],
  ];
  const provider = new ProjectOutlineProvider(() =>
    client(async (method: string) => {
      if (method === "asm/projectOutline") {
        return [{ id: "file:k", label: "k.asm", kind: "file", uri: "file:///k.asm" }];
      }
      return kinds.map(([kind], index) => ({
        name: String(kind),
        kind,
        range: range(index, 0, index, 1),
      }));
    }),
  );
  const [file] = await provider.getChildren();
  const icons = (await provider.getChildren(file)).map((node) => node.icon.id);
  t.deepEqual(
    icons,
    kinds.map(([, icon]) => icon),
  );
});
