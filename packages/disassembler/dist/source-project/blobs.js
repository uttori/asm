import { assertSourceObjectId, sourceGit } from "./git.js";
/**
 * Read immutable blobs in size-bounded batches, without consulting source files or staging.
 * Individual blobs are limited to 64 MiB; IPC batches target 16 MiB and at most 32 objects.
 * The returned buffers retain their batch allocations until the caller releases the map.
 */
export async function readSourceBlobs(repository, objects, signal) {
    const unique = [...new Set(objects)];
    const sizes = new Map();
    const result = new Map();
    for (const object of unique) {
        assertSourceObjectId(object);
    }
    // Inspect sizes first: a count limit alone can combine individually valid large
    // assets into an unbounded IPC allocation. Preserve the existing 64 MiB blob budget.
    for (let start = 0; start < unique.length; start += 256) {
        const batch = unique.slice(start, start + 256);
        const metadata = await sourceGit(repository.root, ["cat-file", "--batch-check"], {
            signal,
            input: `${batch.join("\n")}\n`,
        });
        const lines = metadata.stdout.toString("utf8").trimEnd().split("\n");
        if (lines.length !== batch.length) {
            throw new Error("Incomplete source blob inventory.");
        }
        for (const [index, line] of lines.entries()) {
            const [object, type, sizeText] = line.split(" ");
            const size = Number(sizeText);
            if (object !== batch[index] ||
                type !== "blob" ||
                !Number.isSafeInteger(size) ||
                size < 0 ||
                size > 64 * 1024 * 1024) {
                throw new Error("Invalid or oversized source blob.");
            }
            sizes.set(object, size);
        }
    }
    for (let start = 0; start < unique.length;) {
        const batch = [];
        let bytes = 0;
        while (start < unique.length && batch.length < 32) {
            const object = unique[start];
            const size = sizes.get(object);
            if (batch.length && bytes + size > 16 * 1024 * 1024) {
                break;
            }
            batch.push(object);
            bytes += size;
            start++;
        }
        const content = await sourceGit(repository.root, ["cat-file", "--batch"], {
            signal,
            input: `${batch.join("\n")}\n`,
            maxOutputBytes: bytes + batch.length * 128,
        });
        let cursor = 0;
        for (const object of batch) {
            const end = content.stdout.indexOf(10, cursor);
            const header = content.stdout.subarray(cursor, end).toString("utf8").split(" ");
            const size = sizes.get(object);
            // Length-framed parsing preserves arbitrary binary data, including embedded
            // newlines and NULs. Reject truncated or substituted object responses before use.
            if (end < cursor ||
                header[0] !== object ||
                header[1] !== "blob" ||
                Number(header[2]) !== size ||
                end + size + 1 >= content.stdout.length ||
                content.stdout[end + size + 1] !== 10) {
                throw new Error("Incomplete source blob stream.");
            }
            result.set(object, content.stdout.subarray(end + 1, end + size + 1));
            cursor = end + size + 2;
        }
        if (cursor !== content.stdout.length) {
            throw new Error("Unexpected trailing source blob bytes.");
        }
    }
    return result;
}
//# sourceMappingURL=blobs.js.map