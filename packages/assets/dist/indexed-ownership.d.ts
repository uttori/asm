import { type IndexedPixels } from "./indexed-edit.js";
/** Native resource identity and exact exported values. Tile zero and blank tiles are ordinary owners. */
export interface IndexedOwner extends IndexedPixels {
    /** Stable native owner identity in the baseline inventory. */
    readonly id: string;
    /** Palette slots this owner may store in its index buffer. */
    readonly allowedIndexes: readonly number[];
    /** Defaults to true. False retains visible known artwork whose native inverse or source attribution is unproven. */
    readonly editable?: boolean;
}
/** One authorized display encoding. IDs and mapping come from a private baseline, never pixel equality. */
export interface IndexedOwnerView extends IndexedPixels {
    /** Stable view identity referenced by reconciliation candidates. */
    readonly id: string;
    /** Native owner id whose pixels this view displays. */
    readonly owner: string;
    /** Display slot to native slot; null or absent entries are not representable. */
    readonly indexMap: readonly (number | null)[];
    /** Mirror display columns when mapping to native storage. */
    readonly flipX?: boolean;
    /** Mirror display rows when mapping to native storage. */
    readonly flipY?: boolean;
}
/** Complete fixed inventories. Unused native owners remain present even if no selected view uses them. */
export interface IndexedOwnership {
    /** Complete native owner inventory for one indexed asset. */
    readonly owners: readonly IndexedOwner[];
    /** Authorized display views referencing owners by id. */
    readonly views: readonly IndexedOwnerView[];
}
/** A complete owned replacement is emitted once per changed owner, after all aliases agree. */
export interface IndexedOwnerChange {
    /** Native owner id receiving a full index replacement. */
    readonly owner: string;
    /** Proposed native index buffer after reconciling all contributing views. */
    readonly indexes: Uint8Array;
}
/** Exact candidate pixels resolved by durable view ID; imported mappings cannot widen authority. */
export interface IndexedViewCandidate extends IndexedPixels {
    /** View id whose display pixels are being reconciled. */
    readonly id: string;
}
/** Reconstruct persisted authority without trusting a JSON type assertion or imported native mappings. */
export declare function readIndexedOwnership(value: unknown): IndexedOwnership;
/** Validate persisted authority as rigorously as imported values, before any candidate reconciliation. */
export declare function validateIndexedOwnership(snapshot: IndexedOwnership): void;
/**
 * Reconcile only changed pixels relative to each view's own baseline. Unchanged aliases
 * contribute no proposal; equal/disjoint proposals coalesce and contradictions reject
 * the whole result with both view IDs. Duplicate-looking native owners stay independent.
 */
export declare function reconcileIndexedViews(snapshot: IndexedOwnership, candidates: readonly IndexedViewCandidate[]): IndexedOwnerChange[];
//# sourceMappingURL=indexed-ownership.d.ts.map