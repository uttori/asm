/** Retain only the declared source generation and inputs, never the potentially enormous analysis database.
 * @param {string} root Owning modification project.
 * @param {string} sourceDirectory Verified generated source root.
 * @param {string} romFile Original ROM including its optional copier header.
 * @param {Uint8Array} interfaceBytes Verified symbols/types include.
 * @returns {string} Relative immutable snapshot directory. An incomplete snapshot is never referenced by a manifest.
 */
export declare function retainModificationBaseline(root: string, sourceDirectory: string, romFile: string, interfaceBytes: Uint8Array): string;
//# sourceMappingURL=modification-baseline.d.ts.map