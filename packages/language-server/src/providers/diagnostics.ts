/**
 * Converts core analysis snapshots and current source text into LSP response payloads.
 * File arguments are filesystem paths; protocol positions/ranges use zero-based UTF-16 columns.
 * Providers repair normalized analysis spans against raw editor text without rebuilding the index.
 */

import { pathToFileURL } from "node:url";

import type { AssemblyDiagnostic, AssemblyDiagnosticSeverity } from "@uttori/asm-core";
import {
  sourceOriginLocations,
  sourceOccurrenceRange,
  type SourceOccurrence,
  type WorkspaceIndex,
} from "@uttori/asm-core/tooling";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

import { locationRange } from "../core.js";
import { toRange, lineFallbackRange } from "./spans.js";

/**
 * Maps an assembler diagnostic severity to an LSP severity.
 * @param {AssemblyDiagnosticSeverity} severity The assembler severity.
 * @returns {DiagnosticSeverity} The LSP severity.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#diagnostic
 */
export function toDiagnosticSeverity(severity: AssemblyDiagnosticSeverity): DiagnosticSeverity {
  switch (severity) {
    case "warning":
      return DiagnosticSeverity.Warning;
    case "info":
      return DiagnosticSeverity.Information;
    case "error":
    default:
      return DiagnosticSeverity.Error;
  }
}

/**
 * Builds LSP diagnostics for a file.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @returns {Diagnostic[]} The LSP diagnostics.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#diagnostic
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#publishdiagnostics-notification-arrow_left
 */
export function diagnosticsFor(index: WorkspaceIndex, file: string): Diagnostic[] {
  const originRange = (location: SourceOccurrence) =>
    sourceOccurrenceRange(location, index.getFileText(location.file)?.split("\n")[location.line]);
  return index.getDiagnostics(file).map((diagnostic: AssemblyDiagnostic) => {
    const origin = diagnostic.location.origin;
    let range = locationRange(diagnostic.location);
    if (
      origin?.kind === "macro" &&
      origin.template.file === diagnostic.location.file &&
      origin.template.line === diagnostic.location.line
    ) {
      // Expanded arguments can be longer than their placeholders. Their generated offsets
      // cannot index the original line; point at the body and link the argument separately.
      range = originRange(origin.template);
    }
    const result = Diagnostic.create(
      range ? toRange(range) : lineFallbackRange(diagnostic.location.line),
      diagnostic.message,
      toDiagnosticSeverity(diagnostic.severity),
      diagnostic.code,
      "uttori-asm",
    );
    const related = sourceOriginLocations(diagnostic.location.origin);
    if (related.length) {
      result.relatedInformation = related.map(({ message, location }) => ({
        message,
        location: {
          uri: pathToFileURL(location.file).toString(),
          range: toRange(
            originRange(location) ?? {
              start: { line: location.line, character: 0 },
              end: { line: location.line, character: 1 },
            },
          ),
        },
      }));
    }
    return result;
  });
}
