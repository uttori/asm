import path from "node:path";

import { sourceContentHash } from "@uttori/asm-disassembler/source-project";
import type { SourceResearchRequest, SourceResearchResult } from "@uttori/asm-workflows/source";
import {
  commands,
  Range,
  Uri,
  window,
  workspace,
  WorkspaceEdit,
  type SymbolInformation,
} from "vscode";

import type { SourceProcessClient } from "./process-client.js";
import { readResearchResult } from "./result-readers.js";

/** Selected source context is reread before application; unsaved research buffers support repeated edits. */
export interface ResearchEditorContext {
  readonly root: string;
  readonly buffers: readonly { readonly path: string; readonly bytes: Uint8Array }[];
}

/** Prepare in a worker, then apply one content-checked native edit without saving, committing or indexing it. */
export async function editSourceResearch(
  worker: SourceProcessClient,
  context: () => ResearchEditorContext | undefined,
  request?: SourceResearchRequest,
): Promise<SourceResearchResult | undefined> {
  if (!workspace.isTrusted) {
    throw new Error("Research edits require a trusted workspace.");
  }
  const initial = context();
  if (!initial) {
    throw new Error("Select a Git source project first.");
  }
  const run = (research?: SourceResearchRequest) =>
    worker.run(
      {
        action: "research",
        directory: initial.root,
        overlays: initial.buffers,
        research,
      },
      { maxMemoryMiB: 512, readResult: readResearchResult },
    );
  if (!request) {
    const result = await run();
    if (result.kind !== "symbols") {
      throw new Error("Research service returned an invalid symbol list.");
    }
    const choice = await window.showQuickPick(
      result.symbols.map((symbol) => ({
        label: symbol.name,
        description: `${symbol.addressSpace}:$${symbol.address.toString(16).toUpperCase()} · ${symbol.id}`,
        detail: symbol.path,
        symbol,
      })),
      { title: "Research Symbol", matchOnDescription: true },
    );
    if (!choice) {
      return undefined;
    }
    const symbol = choice.symbol;
    const action = await window.showQuickPick(
      [
        {
          label: "Rename Source Symbol…",
          action: "rename",
          detail: "F2 updates source references and the persistent research name together.",
        },
        {
          label: "Open Declaration",
          action: "open",
          detail: "Edit names, evidence and notes as ordinary JSON.",
        },
        {
          label: "Edit Aliases",
          action: "aliases",
          detail: "Keep alternative research names without renaming source.",
        },
        {
          label: symbol.suppressed ? "Restore Generated Name" : "Suppress Generated Name",
          action: "suppression",
          detail: "Changes the next generation; retains evidence and analysis seeding.",
        },
        {
          label: symbol.entryPoint ? "Remove Analysis Entry Point" : "Add Analysis Entry Point",
          action: "entry-point",
          detail:
            "Changes analysis seeding; retains the presentation name and captured observations.",
        },
      ],
      { title: symbol.name },
    );
    if (!action) {
      return undefined;
    }
    if (action.action === "rename") {
      const matches = (
        (await commands.executeCommand<SymbolInformation[] | undefined>(
          "vscode.executeWorkspaceSymbolProvider",
          symbol.name,
        )) ?? []
      ).filter(
        (item) =>
          item.name === symbol.name &&
          item.location.uri.scheme === "file" &&
          item.location.uri.fsPath.startsWith(initial.root + path.sep),
      );
      const selected =
        matches.length === 1
          ? matches[0]
          : (
              await window.showQuickPick(
                matches.map((item) => ({
                  label: item.name,
                  description: path.relative(initial.root, item.location.uri.fsPath),
                  item,
                })),
                { title: "Source declaration to rename" },
              )
            )?.item;
      if (!selected) {
        if (!matches.length) {
          throw new Error(
            "No current source declaration matches this research name. Generate source or open its declaration before renaming.",
          );
        }
        return undefined;
      }
      const name = await window.showInputBox({
        title: `Rename ${symbol.name}`,
        value: symbol.name,
        validateInput: (value) =>
          /^[A-Z_a-z]\w*$/.test(value) ? undefined : "Enter an assembly identifier.",
      });
      if (name === undefined || name === symbol.name) {
        return undefined;
      }
      await workspace.openTextDocument(selected.location.uri);
      const edit = await commands.executeCommand<WorkspaceEdit | undefined>(
        "vscode.executeDocumentRenameProvider",
        selected.location.uri,
        selected.location.range.start,
        name,
      );
      if (context()?.root !== initial.root || !edit?.size) {
        throw new Error(
          "The selected project changed or its declaration cannot be renamed. Refresh and retry.",
        );
      }
      if (!(await workspace.applyEdit(edit))) {
        throw new Error("The editor rejected the source rename. Refresh and retry.");
      }
      await window.showTextDocument(selected.location.uri);
      return result;
    }
    if (action.action === "open") {
      await window.showTextDocument(Uri.file(path.join(initial.root, symbol.path)));
      return result;
    }
    if (action.action === "aliases") {
      const aliases = await window.showInputBox({
        title: `Aliases for ${symbol.name}`,
        prompt: "Comma-separated names; leave empty to remove aliases.",
        value: symbol.aliases.join(", "),
      });
      if (aliases === undefined) {
        return undefined;
      }
      request = {
        symbolId: symbol.id,
        change: {
          kind: "aliases",
          aliases: aliases
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean),
        },
      };
    } else if (action.action === "suppression") {
      request = {
        symbolId: symbol.id,
        change: { kind: "suppression", suppressed: !symbol.suppressed },
      };
    } else {
      request = {
        symbolId: symbol.id,
        change: { kind: "entry-point", enabled: !symbol.entryPoint },
      };
    }
  }
  const result = await run(request);
  if (result.kind !== "edit") {
    throw new Error("Research service did not produce an edit.");
  }
  const document = await workspace.openTextDocument(Uri.file(path.join(initial.root, result.path)));
  if (
    context()?.root !== initial.root ||
    sourceContentHash(document.getText()) !== result.beforeSha256
  ) {
    throw new Error("The selected project or research changed. Prepare the edit again.");
  }
  const edit = new WorkspaceEdit();
  edit.replace(
    document.uri,
    new Range(document.positionAt(0), document.positionAt(document.getText().length)),
    result.after,
  );
  if (!(await workspace.applyEdit(edit))) {
    throw new Error("The editor rejected the research edit. Refresh the declaration and retry.");
  }
  await window.showTextDocument(document);
  return result;
}
