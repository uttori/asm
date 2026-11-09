import type { ProjectLabel } from "./project-types.js";
/**
 * Validate a portable global assembly identifier without changing the user's spelling.
 * @param name Preferred assembly symbol.
 */
export declare const validateSourceLabelName: (name: string) => void;
/**
 * Legacy imported names retain their historical, deterministic export spelling.
 * @param name Native imported label name.
 * @returns Historical assembly spelling.
 */
export declare const legacySourceLabelName: (name: string) => string;
/**
 * Allocate names once for definitions, references, and editor navigation. Explicit names never
 * silently acquire a suffix. Reserve target-provided hardware/RAM names before emitting source.
 * @param labels Persisted native labels.
 * @param reserved Names already owned by the target/export.
 * @returns Stable label ids mapped to unique assembly names.
 */
export declare const projectSourceLabelNames: (labels: readonly ProjectLabel[], reserved?: Iterable<string>) => ReadonlyMap<string, string>;
//# sourceMappingURL=project-labels.d.ts.map