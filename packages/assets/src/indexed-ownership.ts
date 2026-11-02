import { validateIndexedPixels, type IndexedPixels } from "./indexed-edit.js";
import { ASSET_LIMITS, boundedSum } from "./limits.js";
import { integer } from "./validation.js";

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

/** Persisted inventories require plain records before any native mapping is read. */
const isObject = (input: unknown): input is Record<string, unknown> =>
  !!input && typeof input === "object" && !Array.isArray(input);
/** Parsed primitives and arrays cannot carry native owner/view declarations. */
const object = (input: unknown): Record<string, unknown> => {
  if (!isObject(input)) {
    throw new Error("Invalid ownership record.");
  }
  return input;
};
/** Check field types without copying the pixel buffer; inventory validation bounds its dimensions later. */
const pixels = (input: Record<string, unknown>): IndexedPixels & { readonly id: string } => {
  if (
    typeof input.id !== "string" ||
    typeof input.width !== "number" ||
    typeof input.height !== "number" ||
    !(input.indexes instanceof Uint8Array)
  ) {
    throw new Error("Invalid ownership pixels.");
  }
  return { id: input.id, width: input.width, height: input.height, indexes: input.indexes };
};

/** Reconstruct persisted authority without trusting a JSON type assertion or imported native mappings. */
export function readIndexedOwnership(value: unknown): IndexedOwnership {
  const input = object(value);
  const slotMaps = new WeakMap<object, readonly (number | null)[]>();
  if (
    !Array.isArray(input.owners) ||
    !Array.isArray(input.views) ||
    input.owners.length > ASSET_LIMITS.owners ||
    input.views.length > ASSET_LIMITS.owners
  ) {
    throw new Error("Invalid ownership inventory.");
  }
  const owners = input.owners.map((item): IndexedOwner => {
    const entry = object(item);
    if (
      !Array.isArray(entry.allowedIndexes) ||
      entry.allowedIndexes.length > 256 ||
      (entry.editable !== undefined && typeof entry.editable !== "boolean")
    ) {
      throw new Error("Invalid allowed slots.");
    }
    const allowedIndexes = entry.allowedIndexes.map((slot): number => {
      if (typeof slot !== "number") {
        throw new Error("Invalid allowed slot.");
      }
      return slot;
    });
    const { id, width, height, indexes } = pixels(entry);
    return { id, width, height, indexes, allowedIndexes, editable: entry.editable };
  });
  const views = input.views.map((item): IndexedOwnerView => {
    const entry = object(item);
    if (
      typeof entry.owner !== "string" ||
      !Array.isArray(entry.indexMap) ||
      entry.indexMap.length > 256 ||
      (entry.flipX !== undefined && typeof entry.flipX !== "boolean") ||
      (entry.flipY !== undefined && typeof entry.flipY !== "boolean")
    ) {
      throw new Error("Invalid ownership view.");
    }
    let indexMap = slotMaps.get(entry.indexMap);
    if (!indexMap) {
      indexMap = entry.indexMap.map((slot: unknown): number | null => {
        if (slot !== null && typeof slot !== "number") {
          throw new Error("Invalid ownership slot map.");
        }
        return slot;
      });
      // One palette map can serve the full inventory without allocating 256 entries per view.
      slotMaps.set(entry.indexMap, indexMap);
    }
    const { id, width, height, indexes } = pixels(entry);
    return {
      id,
      width,
      height,
      indexes,
      owner: entry.owner,
      indexMap,
      flipX: entry.flipX,
      flipY: entry.flipY,
    };
  });
  const result = { owners, views };
  validateIndexedOwnership(result);
  return result;
}

/** Stable opaque identities have a bounded UTF-8 representation in file/baseline metadata. */
function identity(id: string): void {
  if (typeof id !== "string" || id.length < 1 || new TextEncoder().encode(id).length > 1024) {
    throw new Error("Invalid indexed ownership identity.");
  }
}

/** Undo native H/V display reflection; display palette mapping is independent of geometry. */
function nativeOffset(view: IndexedOwnerView, offset: number): number {
  const x = offset % view.width;
  const y = Math.floor(offset / view.width);
  const nx = view.flipX ? view.width - 1 - x : x;
  const ny = view.flipY ? view.height - 1 - y : y;
  return ny * view.width + nx;
}

/** Fail on unmapped/invalid display slots, including slots whose RGB happens to match another. */
function nativeSlot(view: IndexedOwnerView, slot: number, owner: IndexedOwner): number {
  const mapped = view.indexMap.at(slot);
  if (mapped === undefined || mapped === null || !owner.allowedIndexes.includes(mapped)) {
    throw new Error(`View ${view.id}: unmapped or forbidden display slot ${slot}.`);
  }
  return mapped;
}

/** Validate persisted authority as rigorously as imported values, before any candidate reconciliation. */
export function validateIndexedOwnership(snapshot: IndexedOwnership): void {
  integer(snapshot.owners.length, "Owner count", 1, ASSET_LIMITS.owners);
  integer(snapshot.views.length, "View count", 1, ASSET_LIMITS.owners);
  const owners = new Map<string, IndexedOwner>();
  let bytes = 0;
  for (const owner of snapshot.owners) {
    identity(owner.id);
    if (owners.has(owner.id)) {
      throw new Error(`Duplicate owner ${owner.id}.`);
    }
    validateIndexedPixels(owner);
    if (owner.editable !== undefined && typeof owner.editable !== "boolean") {
      throw new Error(`Owner ${owner.id}: invalid edit authority.`);
    }
    bytes = boundedSum(bytes, owner.indexes.length, ASSET_LIMITS.decodedBytes, "Ownership payload");
    integer(owner.allowedIndexes.length, "Allowed slot count", 1, 256);
    const allowed = new Set(owner.allowedIndexes);
    if (allowed.size !== owner.allowedIndexes.length) {
      throw new Error(`Owner ${owner.id}: duplicate allowed slot.`);
    }
    for (const slot of allowed) {
      integer(slot, "Native slot", 0, 255);
    }
    if (owner.indexes.some((slot) => !allowed.has(slot))) {
      throw new Error(`Owner ${owner.id}: forbidden baseline slot.`);
    }
    owners.set(owner.id, owner);
  }
  const ids = new Set<string>();
  for (const view of snapshot.views) {
    identity(view.id);
    if (ids.has(view.id)) {
      throw new Error(`Duplicate view ${view.id}.`);
    }
    ids.add(view.id);
    const owner = owners.get(view.owner);
    validateIndexedPixels(view);
    bytes = boundedSum(bytes, view.indexes.length, ASSET_LIMITS.decodedBytes, "Ownership payload");
    if (!owner || owner.width !== view.width || owner.height !== view.height) {
      throw new Error(`View ${view.id}: missing owner or incompatible dimensions.`);
    }
    for (const flag of [view.flipX, view.flipY]) {
      if (flag !== undefined && typeof flag !== "boolean") {
        throw new Error(`View ${view.id}: invalid reflection.`);
      }
    }
    integer(view.indexMap.length, "Display slot map", 1, 256);
    for (const slot of view.indexMap) {
      if (slot !== null) {
        integer(slot, "Mapped native slot", 0, 255);
      }
    }
    for (let i = 0; i < view.indexes.length; i++) {
      if (nativeSlot(view, view.indexes[i], owner) !== owner.indexes[nativeOffset(view, i)]) {
        throw new Error(`View ${view.id}: inconsistent private baseline.`);
      }
    }
  }
}

/**
 * Reconcile only changed pixels relative to each view's own baseline. Unchanged aliases
 * contribute no proposal; equal/disjoint proposals coalesce and contradictions reject
 * the whole result with both view IDs. Duplicate-looking native owners stay independent.
 */
export function reconcileIndexedViews(
  snapshot: IndexedOwnership,
  candidates: readonly IndexedViewCandidate[],
): IndexedOwnerChange[] {
  validateIndexedOwnership(snapshot);
  if (candidates.length !== snapshot.views.length) {
    throw new Error("Indexed view inventory changed.");
  }
  const views = new Map(snapshot.views.map((view) => [view.id, view]));
  const owners = new Map(snapshot.owners.map((owner) => [owner.id, owner]));
  const seen = new Set<string>();
  const changes = new Map<string, { indexes: Uint8Array; contributors: Uint32Array }>();
  let candidateBytes = 0;
  let proposalBytes = 0;
  candidates.forEach((candidate, viewIndex) => {
    const view = views.get(candidate.id);
    if (!view || seen.has(candidate.id)) {
      throw new Error(`Missing, unknown or duplicate view ${candidate.id}.`);
    }
    seen.add(candidate.id);
    validateIndexedPixels(candidate);
    candidateBytes = boundedSum(
      candidateBytes,
      candidate.indexes.length,
      ASSET_LIMITS.decodedBytes,
      "Candidate payload",
    );
    if (candidate.width !== view.width || candidate.height !== view.height) {
      throw new Error(`View ${view.id}: dimensions changed.`);
    }
    const owner = owners.get(view.owner)!;
    for (let offset = 0; offset < candidate.indexes.length; offset++) {
      const slot = candidate.indexes[offset];
      const proposed = nativeSlot(view, slot, owner);
      if (slot === view.indexes[offset]) {
        continue;
      }
      // Known display pixels remain useful even when a capture or overlapping emission has no proven source inverse.
      if (owner.editable === false) {
        throw new Error(`Owner ${owner.id}: artwork is read-only.`);
      }
      const native = nativeOffset(view, offset);
      // Display aliases cannot turn changed saved artwork into a silently discarded no-op.
      if (proposed === owner.indexes[native]) {
        throw new Error(
          `View ${view.id}: changed slot aliases the unchanged native pixel ${native}.`,
        );
      }
      let change = changes.get(owner.id);
      if (!change) {
        proposalBytes = boundedSum(
          proposalBytes,
          owner.indexes.length * 5,
          ASSET_LIMITS.decodedBytes,
          "Native proposal payload",
        );
        change = {
          indexes: owner.indexes.slice(),
          contributors: new Uint32Array(owner.indexes.length),
        };
        changes.set(owner.id, change);
      }
      const contributor = change.contributors[native];
      if (contributor && change.indexes[native] !== proposed) {
        throw new Error(
          `Owner ${owner.id} pixel ${native}: conflicting views ${candidates[contributor - 1].id} and ${view.id}.`,
        );
      }
      change.indexes[native] = proposed;
      change.contributors[native] = viewIndex + 1;
    }
  });
  // Native inventory order makes output deterministic even when saved storage order changes.
  return snapshot.owners.flatMap((owner) => {
    const change = changes.get(owner.id);
    return change ? [{ owner: owner.id, indexes: change.indexes }] : [];
  });
}
