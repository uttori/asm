import type { IndexedDocumentCel as AsepriteCel, IndexedDocument as AsepriteDocument } from "./indexed-document.js";
export type { IndexedDocumentMetadata as AsepriteMetadata, IndexedDocumentLayer as AsepriteLayer, IndexedDocumentTileset as AsepriteTileset, IndexedDocumentCel as AsepriteCel, IndexedDocumentFrame as AsepriteFrame, IndexedDocumentTag as AsepriteTag, IndexedDocument as AsepriteDocument, } from "./indexed-document.js";
/** Resolved cel payload after following linked references. */
type CelPayload = Exclude<AsepriteCel, {
    kind: "linked";
}>;
/** Resolve links once with a bounded iterative walk. Forward links, missing targets and cycles are explicit. */
export declare function resolveAsepriteCels(document: AsepriteDocument): ReadonlyMap<AsepriteCel, CelPayload>;
/** Validate structure and all allocation/work counts. Equal copied payloads count separately; links count once. */
export declare function validateAsepriteDocument(document: AsepriteDocument): void;
/** Encode deterministic structure with embedded tile storage and stable metadata attachment order. */
export declare function encodeAsepriteDocument(document: AsepriteDocument, signal?: AbortSignal): Promise<Uint8Array>;
/** Decode saved sources synchronously in Node or a browser, without editor subprocesses or source writes. */
export declare function decodeAsepriteDocumentSync(bytes: Uint8Array): AsepriteDocument;
/** Parse with cancellable streaming inflation; validations are shared with synchronous assembly. */
export declare function decodeAsepriteDocument(bytes: Uint8Array, signal?: AbortSignal): Promise<AsepriteDocument>;
//# sourceMappingURL=aseprite-document.d.ts.map