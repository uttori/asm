import type { AssetEncoder, AssetImporter } from "./registry.js";
export { type ScalarArrayOptions, decodeScalarArray, encodeScalarArray } from "./data-scalar.js";
export { type StructField, type StructLayout, type StructRecords, decodeStructRecords, encodeStructRecords, type PointerTableOptions, decodePointerTable, encodePointerTable, type IndexTableOptions, decodeIndexTable, encodeIndexTable, } from "./data-structured.js";
export { type SingleByteTextOptions, type SingleByteText, decodeSingleByteText, encodeSingleByteText, } from "./data-text.js";
/** Raw byte importer copies input so the result is independent of host buffers. */
export declare const rawImporter: AssetImporter;
/** Identity encoder for files or independently assembled code images. */
export declare const rawEncoder: AssetEncoder;
/** JSON authoring input for native models; validation belongs to the selected encoder. */
export declare const jsonImporter: AssetImporter;
//# sourceMappingURL=data.d.ts.map