/**
 * Detaches acyclic syntax records and arrays before giving a plugin ownership.
 * Syntax contains only plain data, including optional undefined fields; copying
 * it directly also works in browser hosts without a structuredClone global.
 */
export declare function clonePluginSyntax<T>(value: T): T;
//# sourceMappingURL=syntax-snapshot.d.ts.map