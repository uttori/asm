import fs from "node:fs/promises";
import path from "node:path";

import {
  assetSourceAssemblyInventory,
  type AssetSourceConversionPlan,
} from "@uttori/asm-cli/asset-source";
import { sourceContentHash } from "@uttori/asm-disassembler";
import { workspace, WorkspaceEdit, Uri, Range, type TextDocument } from "vscode";

/** Publish one native undo unit after the worker has staged recovery bytes. Existing text buffers must be clean. */
export async function applyAssetSourceEdit(
  root: string,
  plan: AssetSourceConversionPlan,
  validateEditors: (paths: readonly string[]) => void,
): Promise<void> {
  const paths = [
    ...plan.snapshots.map((item) => path.resolve(root, item.path)),
    ...plan.changes.map((item) => path.resolve(root, item.path)),
  ];
  const edit = new WorkspaceEdit();
  const documents: TextDocument[] = [];
  for (const snapshot of plan.snapshots) {
    if (
      sourceContentHash(await fs.readFile(path.resolve(root, snapshot.path))) !== snapshot.sha256
    ) {
      throw new Error(
        `Source changed before editor publication: ${snapshot.path}. Recover the staged conversion.`,
      );
    }
  }
  for (const change of plan.changes) {
    const uri = Uri.file(path.resolve(root, change.path));
    let current: Uint8Array | null = null;
    try {
      current = await fs.readFile(uri.fsPath);
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
    if (
      (current === null) !== (change.before === null) ||
      (current && change.before && sourceContentHash(current) !== sourceContentHash(change.before))
    ) {
      throw new Error(
        `Source changed before editor publication: ${change.path}. Recover the staged conversion.`,
      );
    }
    if (change.before === null) {
      edit.createFile(uri, { overwrite: false, contents: change.after! });
    } else if (change.after === null) {
      edit.deleteFile(uri, { recursive: false, ignoreIfNotExists: false });
    } else {
      // Conversion adapters replace assembly/declaration text only. Binary source switches use create/remove
      // so VS Code owns their file undo, rather than a text decoder silently corrupting native resources.
      if (!/\.(asm|s|inc|json)$/i.test(change.path)) {
        throw new Error(`Native editor publication cannot replace opaque file '${change.path}'.`);
      }
      const document = await workspace.openTextDocument(uri);
      const text = new TextDecoder("utf-8", { fatal: true }).decode(change.after);
      edit.replace(
        uri,
        new Range(document.positionAt(0), document.positionAt(document.getText().length)),
        text,
      );
      documents.push(document);
    }
  }
  // A newly added unassembled declaration can make retiring the old source unsafe even when all consumed bytes are unchanged.
  if (
    JSON.stringify(assetSourceAssemblyInventory(root)) !== JSON.stringify(plan.assemblyInventory)
  ) {
    throw new Error(
      "Assembly discovery changed before editor publication. Recover the staged conversion.",
    );
  }
  validateEditors(paths);
  if (!(await workspace.applyEdit(edit, { isRefactoring: true }))) {
    throw new Error("Native source conversion edit was declined. Recover the staged conversion.");
  }
  // Only these initially clean documents belong to the conversion. Saving makes the normal build consume
  // the same native undo unit; unrelated documents and custom-editor drafts are never saved here.
  for (const document of documents) {
    if (!(await document.save())) {
      throw new Error(`Save '${document.uri.fsPath}' and recover the staged conversion.`);
    }
  }
}
