/** Hash-gated inline source annotations derived from native analysis projects. */
import * as path from "node:path";
import {
  buildInstructionAnalysisAnnotations,
  loadAnalysisProject,
  type InstructionAnalysisAnnotation,
} from "@uttori/asm-disassembler";
import {
  DecorationRangeBehavior,
  MarkdownString,
  Range,
  ThemeColor,
  window,
  type Disposable,
  type TextDocument,
  type TextEditor,
  type TextEditorDecorationType,
} from "vscode";
import {
  createInstructionAnnotationIndex,
  instructionAnnotationsForDebugRange,
  type InstructionAnnotationIndex,
} from "./analysis-annotation-index.js";
import {
  currentAnalysisSourcePath,
  findAnalysisDebugMapCandidates,
  type AnalysisDebugMapIdentity,
} from "./analysis-debug-maps.js";
import {
  formatInstructionAnnotationDetails,
  formatInstructionAnnotationSummary,
} from "./analysis-annotation-format.js";
import { findAnalysisProjectDirectories } from "./coverage-tree.js";

interface MappedAnnotation {
  readonly project: string;
  readonly annotation: InstructionAnalysisAnnotation;
}

interface LoadedAnnotations {
  readonly directory: string;
  readonly identity: AnalysisDebugMapIdentity;
  readonly index: InstructionAnnotationIndex;
}

const append = <Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void => {
  map.set(key, [...(map.get(key) ?? []), value]);
};

/** Maintains analysis suffixes on the active, byte-current mapped source editor. */
export class AnalysisAnnotationController implements Disposable {
  readonly #decoration: TextEditorDecorationType;
  #generation = 0;

  constructor() {
    this.#decoration = window.createTextEditorDecorationType({
      after: {
        color: new ThemeColor("editorCodeLens.foreground"),
        margin: "0 0 0 2em",
      },
      rangeBehavior: DecorationRangeBehavior.ClosedClosed,
    });
  }

  /**
   * Recomputes decorations for the active editor from hash-current project/map inputs.
   * @param {TextEditor | undefined} editor Active or explicitly selected editor.
   */
  refresh(editor: TextEditor | undefined = window.activeTextEditor): void {
    const generation = ++this.#generation;
    if (!editor || editor.document.uri.scheme !== "file") return;
    editor.setDecorations(this.#decoration, []);
    void this.#decorations(editor, generation).catch(() => {
      if (generation === this.#generation) editor.setDecorations(this.#decoration, []);
    });
  }

  /**
   * Clears annotations immediately when source bytes change; save triggers a fresh hash check.
   * @param {TextDocument} document Changed editor document.
   */
  documentChanged(document: TextDocument): void {
    const editor = window.activeTextEditor;
    if (!editor || editor.document !== document) return;
    ++this.#generation;
    editor.setDecorations(this.#decoration, []);
  }

  dispose(): void {
    ++this.#generation;
    this.#decoration.dispose();
  }

  async #decorations(editor: TextEditor, generation: number): Promise<void> {
    const currentFile = path.resolve(editor.document.uri.fsPath);
    const byLine = new Map<number, MappedAnnotation[]>();
    const loaded: LoadedAnnotations[] = [];
    for (const directory of await findAnalysisProjectDirectories()) {
      let project: ReturnType<typeof loadAnalysisProject>;
      try {
        project = loadAnalysisProject(directory);
      } catch {
        continue;
      }
      const identity = {
        target: project.manifest.target,
        romContentSha256: project.manifest.rom.contentSha256,
        romContentSize: project.manifest.rom.contentSize,
      };
      const projection = buildInstructionAnalysisAnnotations(project.manifest, project.shards);
      loaded.push({
        directory,
        identity,
        index: createInstructionAnnotationIndex(projection.instructions),
      });
    }
    if (loaded.length === 0) return;
    const candidates = await findAnalysisDebugMapCandidates(loaded.map(({ identity }) => identity));
    for (const { directory, identity, index } of loaded) {
      for (const candidate of candidates) {
        if (
          candidate.map.target !== identity.target ||
          candidate.map.output.sha256 !== identity.romContentSha256 ||
          candidate.map.output.size !== identity.romContentSize
        ) {
          continue;
        }
        const sourceIds = new Set(
          candidate.map.sources
            .filter((source) => {
              const resolved = currentAnalysisSourcePath(source, candidate);
              return resolved !== undefined && path.resolve(resolved) === currentFile;
            })
            .map(({ id }) => id),
        );
        if (sourceIds.size === 0) continue;
        for (const range of candidate.map.ranges) {
          if (!sourceIds.has(range.sourceId)) continue;
          for (const annotation of instructionAnnotationsForDebugRange(index, range)) {
            append(byLine, range.line, { project: path.basename(directory), annotation });
          }
        }
      }
    }
    if (generation !== this.#generation || window.activeTextEditor !== editor) return;
    const decorations = [...byLine]
      .filter(([line]) => line >= 1 && line <= editor.document.lineCount)
      .sort(([left], [right]) => left - right)
      .map(([line, entries]) => {
        const unique = new Map(
          entries.map((entry) => [`${entry.project}:${entry.annotation.id}`, entry]),
        );
        const values = [...unique.values()];
        const summaries = [
          ...new Set(
            values
              .map(({ annotation }) => formatInstructionAnnotationSummary(annotation, 160))
              .filter(Boolean),
          ),
        ];
        const summaryText = summaries.join(" | ");
        const hover = new MarkdownString();
        hover.appendMarkdown("**Uttori analysis**\n\n");
        for (const { project, annotation } of values) {
          hover.appendText(project);
          hover.appendMarkdown("\n\n");
          hover.appendCodeblock(formatInstructionAnnotationDetails(annotation), "text");
        }
        const targetLine = editor.document.lineAt(line - 1);
        return {
          range: new Range(line - 1, targetLine.text.length, line - 1, targetLine.text.length),
          hoverMessage: hover,
          renderOptions: {
            after: {
              contentText:
                summaries.length > 0
                  ? ` ; ${summaryText.slice(0, 319)}${summaryText.length > 319 ? "…" : ""}`
                  : "",
            },
          },
        };
      })
      .filter(({ renderOptions }) => renderOptions.after.contentText !== "");
    editor.setDecorations(this.#decoration, decorations);
  }
}
