export class LibMisc {
  /**
   * Returns the minimum of given numbers.
   */
  static min(...values: number[]): number {
    return Math.min(...values);
  }

  /**
   * Returns the smallest positive number from the given list.
   */
  static posMin(...values: number[]): number {
    return values.filter(v => v >= 0).reduce((min, val) => (val < min ? val : min), Infinity);
  }

  /**
   * Rounds up to the nearest power of two.
   * Equivalent to `bitround()` from C++.
   */
  static bitRound(x: number): number {
    if (x <= 0) return 1;
    x--;
    x |= x >> 1;
    x |= x >> 2;
    x |= x >> 4;
    x |= x >> 8;
    x |= x >> 16;
    return x + 1;
  }

  /**
   * Force constant equivalent. Since TypeScript does not have
   * constexpr-like behavior, we just return a constant value.
   */
  static forceConst<T extends number>(n: T): T {
    return n;
  }
}
