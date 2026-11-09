import { type SourceRepository } from "./git.js";
/**
 * Read immutable blobs in size-bounded batches, without consulting source files or staging.
 * Individual blobs are limited to 64 MiB; IPC batches target 16 MiB and at most 32 objects.
 * The returned buffers retain their batch allocations until the caller releases the map.
 */
export declare function readSourceBlobs(repository: SourceRepository, objects: readonly string[], signal?: AbortSignal): Promise<ReadonlyMap<string, Buffer>>;
//# sourceMappingURL=blobs.d.ts.map