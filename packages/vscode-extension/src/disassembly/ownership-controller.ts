import path from "node:path";

import { findManagedSourceFile, sourceExportSha256 } from "@uttori/asm-disassembler";
import {
  CodeAction,
  CodeActionKind,
  Hover,
  MarkdownString,
  Range,
  StatusBarAlignment,
  Uri,
  ViewColumn,
  commands,
  languages,
  window,
  workspace,
  type Disposable,
} from "vscode";

import {
  DisassemblyOwnershipResolver,
  ownershipReport,
  ownershipStatus,
  type DisassemblyOwnership,
} from "./ownership-data.js";
import { readOwnershipProjects } from "./ownership-projects.js";

/** Source selection captured before an inspector or asynchronous lookup changes editor focus. */
interface OwnershipSelection {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly sha256: string;
}

/** Context menus, status, quick fixes and the inspector all consume the same guarded resolver. */
export class DisassemblyOwnershipController implements Disposable {
  readonly #resolver = new DisassemblyOwnershipResolver();
  readonly #disposables: Disposable[] = [];
  readonly #status = window.createStatusBarItem(StatusBarAlignment.Right, 39);
  #generation = 0;
  #timer?: ReturnType<typeof setTimeout>;
  #disposed = false;

  constructor(readonly editAnnotation: (projectDirectory: string) => Promise<void>) {
    this.#status.name = "Disassembly Source Ownership";
    this.#status.command = "asm.disassembly.inspectOwnership";
    const selector = ["uttori-snes", "uttori-65xx"].map((language) => ({
      language,
      scheme: "file",
    }));
    this.#disposables.push(
      this.#status,
      commands.registerCommand(
        "asm.disassembly.inspectOwnership",
        (selection?: OwnershipSelection) => this.inspect(selection),
      ),
      commands.registerCommand(
        "asm.disassembly.editOwnedAnnotation",
        (selection?: OwnershipSelection) => this.edit(selection),
      ),
      commands.registerCommand(
        "asm.disassembly.openOwningInput",
        (selection?: OwnershipSelection) => this.openInput(selection),
      ),
      commands.registerCommand("asm.disassembly.showOwnedStatus", () =>
        this.maintenance("asm.disassembly.status"),
      ),
      commands.registerCommand("asm.disassembly.regenerateOwned", () =>
        this.maintenance("asm.disassembly.regenerate"),
      ),
      window.onDidChangeActiveTextEditor(() => this.refresh()),
      window.onDidChangeTextEditorSelection(() => this.refresh()),
      workspace.onDidChangeTextDocument(() => this.refresh()),
      languages.registerCodeActionsProvider(
        selector,
        {
          provideCodeActions: async (document, range, _context, token) => {
            const selection = {
              file: document.uri.fsPath,
              line: range.start.line + 1,
              column: range.start.character,
              sha256: sourceExportSha256(document.getText()),
            };
            const result = await this.resolve(selection);
            if (!result || token.isCancellationRequested) {
              return [];
            }
            const actions = [
              this.action(
                "Inspect disassembly ownership",
                "asm.disassembly.inspectOwnership",
                selection,
              ),
            ];
            if (workspace.isTrusted && result.canAnnotate) {
              actions.push(
                this.action(
                  "Edit owned metadata",
                  "asm.disassembly.editOwnedAnnotation",
                  selection,
                ),
              );
            }
            if (result.owners.some((owner) => owner.inputPath)) {
              actions.push(
                this.action("Open owning input", "asm.disassembly.openOwningInput", selection),
              );
            }
            return actions;
          },
        },
        { providedCodeActionKinds: [CodeActionKind.RefactorRewrite] },
      ),
      languages.registerHoverProvider(selector, {
        provideHover: async (document, position, token) => {
          const selection = {
            file: document.uri.fsPath,
            line: position.line + 1,
            column: position.character,
            sha256: sourceExportSha256(document.getText()),
          };
          const result = await this.resolve(selection);
          if (!result || token.isCancellationRequested) {
            return undefined;
          }
          const markdown = new MarkdownString();
          markdown.appendText(ownershipStatus(result));
          for (const owner of result.owners) {
            markdown.appendText(
              `\n\nOwner: ${owner.kind} · ${owner.name ?? owner.symbol ?? owner.id}`,
            );
          }
          const argument = encodeURIComponent(JSON.stringify([selection]));
          markdown.appendMarkdown(
            `\n\n[Inspect ownership](command:asm.disassembly.inspectOwnership?${argument})`,
          );
          markdown.isTrusted = { enabledCommands: ["asm.disassembly.inspectOwnership"] };
          return new Hover(markdown);
        },
      }),
    );
    const watcher = workspace.createFileSystemWatcher("**/*.{asm,json,sqlite,bin}");
    const invalidate = (): void => {
      this.#resolver.invalidate();
      this.refresh();
    };
    this.#disposables.push(
      watcher,
      watcher.onDidChange(invalidate),
      watcher.onDidCreate(invalidate),
      watcher.onDidDelete(invalidate),
    );
    this.refresh();
  }

  /** Debounce cursor movement, clear stale capabilities immediately, and discard late replies. */
  refresh(): void {
    const generation = ++this.#generation;
    if (this.#timer) {
      clearTimeout(this.#timer);
    }
    this.#status.hide();
    void this.contexts(undefined);
    const editor = window.activeTextEditor;
    if (!editor || !["uttori-snes", "uttori-65xx"].includes(editor.document.languageId)) {
      return;
    }
    this.#timer = setTimeout(() => {
      void this.resolve(this.selection(editor))
        .then(async (result) => {
          if (this.#disposed || generation !== this.#generation) {
            return;
          }
          await this.contexts(result);
          if (this.#disposed || generation !== this.#generation) {
            return;
          }
          if (!result) {
            return;
          }
          this.#status.text = `$(lock) ${ownershipStatus(result)}`;
          this.#status.tooltip =
            "Inspect the persistent owner. Source freshness does not verify a ROM build.";
          this.#status.show();
        })
        .catch((error: unknown) => {
          if (this.#disposed || generation !== this.#generation) {
            return;
          }
          this.#status.text = "$(warning) Disassembly ownership unavailable";
          this.#status.tooltip = String(error);
          this.#status.show();
        });
    }, 180);
  }

  /**
   * Select the originating file again before opening the native metadata editor.
   * @param {OwnershipSelection | undefined} selection Captured source selection, defaulting to the active editor.
   */
  private async edit(selection = this.selection()): Promise<void> {
    try {
      if (!workspace.isTrusted || !selection) {
        return;
      }
      const result = await this.resolve(selection);
      if (!result?.canAnnotate || !result.project) {
        throw new Error(
          "No editable native owner at this unchanged source location. Inspect ownership first.",
        );
      }
      await window.showTextDocument(Uri.file(selection.file), {
        selection: new Range(
          selection.line - 1,
          selection.column,
          selection.line - 1,
          selection.column,
        ),
      });
      await this.editAnnotation(result.project.directory);
    } catch (error) {
      await window.showErrorMessage(String(error));
    }
  }

  /**
   * Open a safe, export-relative metadata input; ambiguous owners are selected explicitly.
   * @param {OwnershipSelection | undefined} selection Captured source selection, defaulting to the active editor.
   */
  private async openInput(selection = this.selection()): Promise<void> {
    try {
      const result = await this.resolve(selection);
      if (!result) {
        return;
      }
      const inputs = [
        ...new Set(result.owners.flatMap((owner) => (owner.inputPath ? [owner.inputPath] : []))),
      ];
      let input: string | undefined = inputs[0];
      if (inputs.length > 1) {
        input = await window.showQuickPick(inputs, { title: "Open owning input" });
      }
      if (input) {
        await window.showTextDocument(Uri.file(path.join(result.managed.directory, input)));
      }
    } catch (error) {
      await window.showErrorMessage(String(error));
    }
  }

  /**
   * Scope maintenance to the source's owner instead of asking about unrelated workspace projects.
   * @param {string} command Existing status or regeneration command to invoke for the resolved project.
   * @param {OwnershipSelection | undefined} selection Source captured by an inspector, or the active editor.
   */
  private async maintenance(command: string, selection = this.selection()): Promise<void> {
    try {
      const result = await this.resolve(selection);
      if (!result?.project) {
        throw new Error(
          "No unique analysis project owns this source. Inspect ownership before continuing.",
        );
      }
      await commands.executeCommand(command, {
        projectDirectory: result.project.directory,
        sourceDirectory: result.managed.directory,
      });
    } catch (error) {
      await window.showErrorMessage(String(error));
    }
  }

  /**
   * The inspector is a read-only view; action buttons re-resolve the captured selection on use.
   * @param {OwnershipSelection | undefined} selection Captured source selection, defaulting to the active editor.
   */
  private async inspect(selection = this.selection()): Promise<void> {
    try {
      const result = await this.resolve(selection);
      if (!result || !selection) {
        await window.showInformationMessage(
          "This file is user-owned. No generated disassembly manifest owns it.",
        );
        return;
      }
      const panel = window.createWebviewPanel(
        "uttori.disassemblyOwnership",
        "Disassembly Ownership",
        ViewColumn.Beside,
        { enableScripts: true },
      );
      const escape = (text: string): string =>
        text
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;");
      const nonce = String(Date.now());
      const buttons = ['<button data-action="refresh">Refresh inspection</button>'];
      if (result.project) {
        buttons.push('<button data-action="status">Show full generation status</button>');
      }
      if (workspace.isTrusted && result.canAnnotate) {
        buttons.push('<button data-action="edit">Edit owned metadata</button>');
      }
      if (result.owners.some((owner) => owner.inputPath)) {
        buttons.push('<button data-action="input">Open owning input</button>');
      }
      panel.webview.html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'"><style nonce="${nonce}">body{font-family:var(--vscode-font-family);padding:20px}pre{white-space:pre-wrap;overflow-wrap:anywhere}button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:0;padding:8px 12px;margin:0 8px 8px 0}</style></head><body><h1>Disassembly ownership</h1><p>Generated source is a projection. Edit the owning record or input to preserve changes.</p><p>Inspection snapshot: ${escape(new Date().toISOString())}. Refresh to inspect subsequent edits.</p>${buttons.join("")}<pre>${escape(ownershipReport(result))}</pre><script nonce="${nonce}">const vscode=acquireVsCodeApi();document.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>vscode.postMessage({action:button.dataset.action})));</script></body></html>`;
      const listener = panel.webview.onDidReceiveMessage(async (message: unknown) => {
        const action = (message as { action?: string } | null)?.action;
        if (action === "refresh") {
          this.#resolver.invalidate();
          // Refresh deliberately adopts current text. Edit actions retain their original hash guard.
          try {
            const document = await workspace.openTextDocument(Uri.file(selection.file));
            panel.dispose();
            await this.inspect({ ...selection, sha256: sourceExportSha256(document.getText()) });
          } catch (error) {
            await window.showErrorMessage(String(error));
          }
        } else if (action === "edit") {
          await this.edit(selection);
        } else if (action === "input") {
          await this.openInput(selection);
        } else if (action === "status") {
          await this.maintenance("asm.disassembly.status", selection);
        }
      });
      panel.onDidDispose(() => {
        listener.dispose();
      });
      this.#disposables.push(panel);
    } catch (error) {
      await window.showErrorMessage(String(error));
    }
  }

  private selection(editor = window.activeTextEditor): OwnershipSelection | undefined {
    if (!editor || editor.document.uri.scheme !== "file") {
      return undefined;
    }
    return {
      file: editor.document.uri.fsPath,
      line: editor.selection.active.line + 1,
      column: editor.selection.active.character,
      sha256: sourceExportSha256(editor.document.getText()),
    };
  }

  /**
   * Resolve using the current buffer, never a caller-supplied record ID or stale capability flag.
   * @param {OwnershipSelection | undefined} selection Source coordinates and hash captured when an action was presented.
   * @returns {Promise<DisassemblyOwnership | undefined>} Current guarded ownership, or undefined outside managed source.
   */
  private async resolve(selection?: OwnershipSelection): Promise<DisassemblyOwnership | undefined> {
    if (
      !selection ||
      typeof selection.file !== "string" ||
      !Number.isSafeInteger(selection.line) ||
      selection.line < 1 ||
      !Number.isSafeInteger(selection.column) ||
      selection.column < 0
    ) {
      return undefined;
    }
    const document = await workspace.openTextDocument(Uri.file(selection.file));
    if (sourceExportSha256(document.getText()) !== selection.sha256) {
      throw new Error(
        "Source changed after this action was shown. Inspect the current selection again.",
      );
    }
    // Ordinary assembly files must not trigger workspace/database discovery on every hover.
    if (!findManagedSourceFile(selection.file)) {
      return undefined;
    }
    return this.#resolver.resolve(
      selection.file,
      document.getText(),
      selection.line,
      selection.column,
      document.isDirty,
      await readOwnershipProjects(),
    );
  }

  private action(title: string, command: string, selection: OwnershipSelection): CodeAction {
    const action = new CodeAction(title, CodeActionKind.RefactorRewrite);
    action.command = { title, command, arguments: [selection] };
    return action;
  }

  private async contexts(result?: DisassemblyOwnership): Promise<void> {
    await commands.executeCommand("setContext", "asm.disassembly.managed", Boolean(result));
    await commands.executeCommand(
      "setContext",
      "asm.disassembly.canRemoveName",
      Boolean(
        result?.canAnnotate &&
        result.owners.some((owner) => owner.kind === "label" || owner.kind === "function"),
      ),
    );
    await commands.executeCommand(
      "setContext",
      "asm.disassembly.canResetName",
      Boolean(result?.canAnnotate && result.owners.some((owner) => owner.kind === "label")),
    );
    await commands.executeCommand(
      "setContext",
      "asm.disassembly.canAnnotate",
      Boolean(result?.canAnnotate),
    );
    await commands.executeCommand(
      "setContext",
      "asm.disassembly.hasOwningInput",
      Boolean(result?.owners.some((owner) => owner.inputPath)),
    );
  }

  dispose(): void {
    this.#disposed = true;
    this.#generation++;
    if (this.#timer) {
      clearTimeout(this.#timer);
    }
    for (const disposable of this.#disposables) {
      disposable.dispose();
    }
  }
}
