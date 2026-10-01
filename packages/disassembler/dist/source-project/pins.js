import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { acquireFileLease, durableReplace } from "../internal/durable-files.js";
import { sourceGit } from "./git.js";
const ownerId = (gitDirectory) => createHash("sha256").update(gitDirectory).digest("hex").slice(0, 24);
/** Resolve shared administrative state through Git so linked worktrees share only the pin registry. */
async function registry(repository) {
    const common = (await sourceGit(repository.root, ["rev-parse", "--path-format=absolute", "--git-common-dir"])).stdout
        .toString()
        .replace(/\n$/, "");
    return { common, directory: path.join(common, "uttori-source", "pin-owners") };
}
/** Persist ownership before publishing a candidate/preview ref; unknown historical pins are never guessed. */
export async function registerSourcePinOwner(repository) {
    const { directory } = await registry(repository);
    const id = ownerId(repository.gitDirectory);
    const file = path.join(directory, `${id}.json`);
    const expected = JSON.stringify({
        format: "uttori-source-pin-owner-v1",
        gitDirectory: repository.gitDirectory,
    });
    if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === expected) {
        return;
    }
    const lease = acquireFileLease(path.join(directory, "registry.lock"));
    try {
        if (fs.existsSync(file) && fs.readFileSync(file, "utf8") !== expected) {
            throw new Error("Source pin ownership changed unexpectedly.");
        }
        durableReplace(file, expected);
    }
    finally {
        lease.release();
    }
}
/** Validate a bounded registry record and prove its linked-worktree administration no longer exists. */
function retiredOwnerFile(common, directory, id) {
    const file = path.join(directory, `${id}.json`);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.size > 4096) {
        throw new Error("Unknown owner");
    }
    const owner = JSON.parse(fs.readFileSync(file, "utf8"));
    if (owner.format !== "uttori-source-pin-owner-v1" ||
        typeof owner.gitDirectory !== "string" ||
        ownerId(owner.gitDirectory) !== id ||
        path.dirname(owner.gitDirectory) !== path.join(common, "worktrees") ||
        fs.existsSync(owner.gitDirectory)) {
        throw new Error("Owner still exists or cannot be proven removed");
    }
    return file;
}
/**
 * Release only pins whose registered linked-worktree administration was removed by Git.
 * Missing mounts, moved repositories, main-worktree pins and unrecognized refs are preserved.
 */
export async function pruneSourcePins(repository) {
    const { common, directory } = await registry(repository);
    const lease = acquireFileLease(path.join(directory, "registry.lock"));
    const result = { removed: [], retained: [] };
    try {
        const listing = (await sourceGit(repository.root, [
            "for-each-ref",
            "--format=%(refname) %(objectname) %(symref)",
            "refs/uttori/candidates/",
            "refs/uttori/previews/",
        ])).stdout
            .toString()
            .trim();
        for (const line of listing.split("\n").filter(Boolean)) {
            const [ref, commit, symbolicTarget] = line.split(" ");
            const match = /^refs\/uttori\/(?:candidates\/([\da-f]{24})-[\da-f]{40,64}|previews\/([\da-f]{24}))$/.exec(ref);
            const id = match?.[1] ?? match?.[2];
            if (!id || symbolicTarget) {
                result.retained.push(ref);
                continue;
            }
            try {
                retiredOwnerFile(common, directory, id);
                // Compare-and-delete refuses an external ref replacement during cleanup.
                await sourceGit(repository.root, ["update-ref", "--no-deref", "-d", ref, commit]);
                result.removed.push(ref);
            }
            catch {
                result.retained.push(ref);
            }
        }
        // Inspect records too: a killed worker may have deleted the last ref before its registry
        // record. Explicitly discarded candidates can likewise leave an owner with no remaining refs.
        for (const name of fs.readdirSync(directory)) {
            const id = /^([\da-f]{24})\.json$/.exec(name)?.[1];
            if (id && !result.retained.some((ref) => ref.includes(id))) {
                try {
                    fs.unlinkSync(retiredOwnerFile(common, directory, id));
                }
                catch {
                    // Current worktrees, unknown records, and failures retain their registry information.
                }
            }
        }
        return result;
    }
    finally {
        lease.release();
    }
}
//# sourceMappingURL=pins.js.map