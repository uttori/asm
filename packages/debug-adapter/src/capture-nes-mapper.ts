/** Reject invalid mapper dictionaries before exposing either graphics or CPU evidence. */
export function validateNesMapper(mapper: readonly number[]): void {
  if (
    mapper.length !== 18 ||
    ![0, 4].includes(mapper[0]) ||
    mapper[1] !== 0 ||
    mapper[2] > 7 ||
    mapper[3] > 1 ||
    mapper[4] > 1 ||
    mapper[13] > 1 ||
    mapper[14] > 1 ||
    mapper[15] > 1 ||
    mapper[17] > 1
  ) {
    throw new Error("Invalid NES mapper dictionary.");
  }
}
