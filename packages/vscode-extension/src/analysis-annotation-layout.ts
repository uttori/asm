import type { InstructionAnalysisAnnotation } from "@uttori/asm-disassembler";

/**
 * Measure source columns using the editor's tab stops.
 * @param {string} text Source line.
 * @param {number} tabSize Editor tab width.
 * @returns {number} Monospaced display columns.
 */
export const annotationSourceColumns = (text: string, tabSize: number): number => {
  const width = Number.isSafeInteger(tabSize) && tabSize > 0 ? tabSize : 4;
  let columns = 0;
  for (const character of text) columns += character === "\t" ? width - (columns % width) : 1;
  return columns;
};

/**
 * Choose one overlay column beyond every annotated line, with a readable minimum gap.
 * @param {readonly string[]} lines Annotated source lines.
 * @param {number} tabSize Editor tab width.
 * @param {number} minimumColumn Preferred minimum overlay column.
 * @returns {number} Shared zero-based display column.
 */
export const annotationOverlayColumn = (
  lines: readonly string[],
  tabSize: number,
  minimumColumn = 80,
): number =>
  lines.reduce(
    (column, text) => Math.max(column, annotationSourceColumns(text, tabSize) + 3),
    minimumColumn,
  );

/**
 * Color by the most actionable evidence; text and hover retain the full meaning.
 * @param {readonly InstructionAnalysisAnnotation[]} annotations Annotations on one source line.
 * @returns {string} Theme color identifier.
 */
export const annotationOverlayColor = (
  annotations: readonly InstructionAnalysisAnnotation[],
): string => {
  if (annotations.some((annotation) => annotation.stateTransitions.length > 0))
    return "editorWarning.foreground";
  if (
    annotations.some(
      (annotation) =>
        annotation.executionCount > 0 ||
        annotation.runtimeCoverage.length > 0 ||
        annotation.memoryAccesses.length > 0 ||
        annotation.stateObservations.some(({ source }) => source === "runtime"),
    )
  )
    return "debugIcon.startForeground";
  return "editorInfo.foreground";
};
