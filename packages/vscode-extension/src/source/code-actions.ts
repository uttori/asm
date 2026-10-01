import path from "node:path";

import { CodeAction, CodeActionKind, languages, Uri, workspace, type Disposable } from "vscode";

/** Quick fixes open the relevant declaration or prepare a reviewed edit; they never silently move bytes. */
export function registerSourceCodeActions(
  context: () => { root: string; layout: string } | undefined,
): Disposable {
  return languages.registerCodeActionsProvider(
    { scheme: "file" },
    {
      provideCodeActions(document, _range, requested) {
        const project = context();
        if (!project) {
          return [];
        }
        const relative = path.relative(project.root, document.uri.fsPath);
        if (
          relative === ".." ||
          relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative)
        ) {
          return [];
        }
        const diagnostics = requested.diagnostics.filter((item) => item.source === "Uttori source");
        if (!diagnostics.length) {
          return [];
        }
        const actions: CodeAction[] = [];
        const append = (title: string, command: string, args: unknown[] = []): void => {
          const action = new CodeAction(title, CodeActionKind.QuickFix);
          action.command = { title, command, arguments: args };
          action.diagnostics = diagnostics;
          if (!workspace.isTrusted && command !== "vscode.open") {
            action.disabled = {
              reason: "Trust this workspace before executing source operations.",
            };
          }
          actions.push(action);
        };
        const codes = new Set(
          diagnostics.map((item) => (typeof item.code === "object" ? item.code.value : item.code)),
        );
        if (["fixed-extent", "placement", "bank-crossing"].some((code) => codes.has(code))) {
          append("Review relocation for a declared object…", "asm.source.relocate");
        }
        if (
          [
            "fixed-extent",
            "placement",
            "bank-crossing",
            "reference",
            "overlap",
            "control-flow",
            "unknown-cpu-state",
            "instruction-width",
            "output-size",
            "expansion",
          ].some((code) => codes.has(code))
        ) {
          append("Open layout and reference contracts", "vscode.open", [
            Uri.file(path.join(project.root, project.layout)),
          ]);
        }
        append("Build and check source again", "asm.source.build");
        return actions;
      },
    },
    { providedCodeActionKinds: [CodeActionKind.QuickFix] },
  );
}
