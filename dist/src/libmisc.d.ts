export declare class LibMisc {
    /**
     * Returns the minimum of given numbers.
     */
    static min(...values: number[]): number;
    /**
     * Returns the smallest positive number from the given list.
     */
    static posMin(...values: number[]): number;
    /**
     * Rounds up to the nearest power of two.
     * Equivalent to `bitround()` from C++.
     */
    static bitRound(x: number): number;
    /**
     * Force constant equivalent. Since TypeScript does not have
     * constexpr-like behavior, we just return a constant value.
     */
    static forceConst<T extends number>(n: T): T;
}
//# sourceMappingURL=libmisc.d.ts.map