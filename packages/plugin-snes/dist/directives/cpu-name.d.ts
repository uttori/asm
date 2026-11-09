/**
 * Maps a ca65 CPU name string to the SNES architecture id it should activate.
 * Returns `undefined` for names that are not SNES-owned CPU identifiers.
 * @param name CPU name as used in ca65 `.setcpu`.
 * @returns The resolved SNES architecture id.
 */
export declare function resolveSnesCpuName(name: string): string | undefined;
//# sourceMappingURL=cpu-name.d.ts.map