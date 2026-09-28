/**
 * Measure source columns using the editor's tab stops.
 * @param {string} text Source line.
 * @param {number} tabSize Editor tab width.
 * @returns {number} Monospaced display columns.
 */
export const informationSourceColumns = (text: string, tabSize: number): number => {
  const width = Number.isSafeInteger(tabSize) && tabSize > 0 ? tabSize : 4;
  let columns = 0;
  for (const character of text) {
    columns += character === "\t" ? width - (columns % width) : 1;
  }
  return columns;
};

/**
 * Align short lines at the preferred column and keep long lines' suffixes after their source.
 * A long data declaration must not push every nearby instruction's information offscreen.
 * @param {string} source Annotated source line.
 * @param {number} tabSize Editor tab width.
 * @param {number} column Preferred zero-based overlay column.
 * @returns {number} Non-overlapping margin in monospace columns, at least three.
 */
export const informationOverlayGap = (source: string, tabSize: number, column = 80): number =>
  Math.max(3, column - informationSourceColumns(source, tabSize));
