import fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { sourceContentHash } from "../internal/source-inputs.js";
export { sourceContentHash } from "../internal/source-inputs.js";
import { acquireFileLease } from "../internal/durable-files.js";
import { assertSourceObjectId, assertSourcePath, sourceGit } from "./git.js";
import { registerSourcePinOwner } from "./pins.js";
import { createSourceScratch } from "./scratch.js";
/** Generated metadata describes the baseline, never a restriction on editing working files. */
export const SOURCE_GENERATION_FILE = ".uttori/generation.json";
function isGenerationFileMode(value) {
    return value === "100644" || value === "100755";
}
/**
 * Verify pure payload bytes from Git itself, in bounded batches. Reading a descriptor alone would
 * allow a customized source commit to be used accidentally as the next generation's parent.
 */
export async function verifySourceGeneration(repository, commit) {
    const descriptor = await generationAt(repository, commit);
    const listing = await sourceGit(repository.root, ["ls-tree", "-r", "-z", commit]);
    const entries = listing.stdout
        .toString("utf8")
        .split("\0")
        .filter(Boolean)
        .map((line) => {
        const tab = line.indexOf("\t");
        const [mode, type, blob] = line.slice(0, tab).split(" ");
        const name = line.slice(tab + 1);
        assertSourcePath(name);
        if (type !== "blob" || !isGenerationFileMode(mode)) {
            throw new Error("Pure generations contain regular files only.");
        }
        return { path: name, mode, blob };
    })
        .filter((entry) => entry.path !== SOURCE_GENERATION_FILE)
        .toSorted((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
    const files = [];
    for (let start = 0; start < entries.length; start += 32) {
        const batch = entries.slice(start, start + 32);
        const result = await sourceGit(repository.root, ["cat-file", "--batch"], {
            input: batch.map((entry) => entry.blob + "\n").join(""),
        });
        let cursor = 0;
        for (const entry of batch) {
            const end = result.stdout.indexOf(10, cursor);
            const [oid, type, sizeText] = result.stdout.subarray(cursor, end).toString("utf8").split(" ");
            const size = Number(sizeText);
            if (end < 0 ||
                oid !== entry.blob ||
                type !== "blob" ||
                !Number.isSafeInteger(size) ||
                size < 0 ||
                end + size + 1 >= result.stdout.length) {
                throw new Error("Incomplete Git generation blob stream.");
            }
            files.push({
                ...entry,
                sha256: sourceContentHash(result.stdout.subarray(end + 1, end + 1 + size)),
            });
            cursor = end + size + 2;
        }
    }
    const hash = sourceContentHash(canonicalJson(files.map((entry) => ({
        path: entry.path,
        executable: entry.mode === "100755",
        sha256: entry.sha256,
    }))));
    // oxlint-disable-next-line security/detect-possible-timing-attacks
    if (hash !== descriptor.payloadSha256) {
        throw new Error("Pure generation payload differs from its descriptor. Do not use edited source as a generation parent.");
    }
    return { descriptor, files };
}
/** Each worktree owns its pins even when another worktree prepares the identical immutable commit. */
export function sourceCandidateRef(repository, commit) {
    assertSourceObjectId(commit);
    return `refs/uttori/candidates/${sourceContentHash(repository.gitDirectory).slice(0, 24)}-${commit}`;
}
/** Retain an immutable generation per worktree until preparation supersedes it or a merge accepts it. */
export async function pinSourceCandidate(repository, commit, signal) {
    const ref = sourceCandidateRef(repository, commit);
    await registerSourcePinOwner(repository);
    fs.mkdirSync(repository.stateDirectory, { recursive: true });
    const lease = acquireFileLease(path.join(repository.stateDirectory, "candidate.lock"));
    try {
        const refs = (await sourceGit(repository.root, ["for-each-ref", "--format=%(refname)", "refs/uttori/candidates/"], { signal })).stdout
            .toString("utf8")
            .split("\n");
        if (refs.includes(ref)) {
            const pinned = (await sourceGit(repository.root, ["rev-parse", ref], { signal })).stdout
                .toString()
                .trim();
            if (pinned !== commit) {
                throw new Error("Candidate ref changed outside the source workflow.");
            }
            return ref;
        }
        await sourceGit(repository.root, ["update-ref", "--no-deref", ref, commit, "0".repeat(commit.length)], {
            signal,
        });
        return ref;
    }
    finally {
        lease.release();
    }
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isSha256(value) {
    return typeof value === "string" && /^[\da-f]{64}$/.test(value);
}
function isGenerationInputs(value) {
    if (!isRecord(value)) {
        return false;
    }
    return (typeof value.project === "string" &&
        /^[\w.-]+$/.test(value.project) &&
        isSha256(value.romSha256) &&
        isSha256(value.evidenceSha256) &&
        isSha256(value.researchSha256) &&
        isSha256(value.toolchainSha256) &&
        isSha256(value.optionsSha256) &&
        (value.captureCatalogSha256 === undefined || isSha256(value.captureCatalogSha256)));
}
/** Validate all externally loaded identity fields before using a descriptor for ancestry selection. */
export function parseSourceGeneration(value) {
    if (!isRecord(value)) {
        throw new Error("Invalid source generation descriptor.");
    }
    const inputs = value.inputs;
    const project = isRecord(inputs) ? inputs.project : undefined;
    if (value.format !== "uttori-source-generation" ||
        !isRecord(inputs) ||
        typeof project !== "string" ||
        !/^[\w.-]+$/.test(project)) {
        throw new Error("Invalid source generation descriptor.");
    }
    const payloadSha256 = value.payloadSha256;
    const id = value.id;
    if (!isGenerationInputs(inputs) || !isSha256(payloadSha256) || !isSha256(id)) {
        throw new Error("Invalid source generation content identity.");
    }
    if (sourceContentHash(canonicalJson({ inputs, payloadSha256 })) !== id) {
        throw new Error("Source generation descriptor identity mismatch.");
    }
    return { format: "uttori-source-generation", inputs, payloadSha256, id };
}
/** Read generation metadata from an immutable commit, never the edited worktree. */
export async function generationAt(repository, commit) {
    assertSourceObjectId(commit);
    const result = await sourceGit(repository.root, ["show", `${commit}:${SOURCE_GENERATION_FILE}`]);
    return parseSourceGeneration(JSON.parse(result.stdout.toString("utf8")));
}
/**
 * Write a pure generation using an alternate index. The user's files and staging area are never
 * checked out or changed. The renderer must finish pure-ROM validation before calling this function.
 */
export async function retainSourceGeneration(repository, options) {
    if (options.parent) {
        assertSourceObjectId(options.parent);
        const { descriptor: prior } = await verifySourceGeneration(repository, options.parent);
        if (prior.inputs.project !== options.inputs.project ||
            prior.inputs.romSha256 !== options.inputs.romSha256) {
            throw new Error("A generation parent must belong to the same project and original ROM.");
        }
    }
    const names = new Set();
    const files = [...options.files].toSorted((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
    for (const file of files) {
        assertSourcePath(file.path);
        const normalized = file.path.normalize("NFC").toLowerCase();
        if (names.has(normalized) || normalized === SOURCE_GENERATION_FILE) {
            throw new Error(`Duplicate or reserved generation path: ${file.path}`);
        }
        names.add(normalized);
    }
    const payloadSha256 = sourceContentHash(canonicalJson(files.map((file) => ({
        path: file.path,
        executable: file.executable ?? false,
        sha256: sourceContentHash(file.bytes),
    }))));
    const descriptor = parseSourceGeneration({
        format: "uttori-source-generation",
        inputs: options.inputs,
        payloadSha256,
        id: sourceContentHash(canonicalJson({ inputs: options.inputs, payloadSha256 })),
    });
    fs.mkdirSync(repository.stateDirectory, { recursive: true });
    const scratch = createSourceScratch(repository, "generation");
    const indexFile = path.join(scratch.directory, "index");
    const blobsDirectory = path.join(scratch.directory, "blobs");
    const gitOptions = { indexFile, signal: options.signal };
    try {
        if (options.parent && (await generationAt(repository, options.parent)).id === descriptor.id) {
            const tree = (await sourceGit(repository.root, ["rev-parse", `${options.parent}^{tree}`])).stdout
                .toString("utf8")
                .trim();
            const ref = await pinSourceCandidate(repository, options.parent, options.signal);
            return { commit: options.parent, tree, ref, descriptor };
        }
        await sourceGit(repository.root, ["read-tree", "--empty"], gitOptions);
        const payload = [
            ...files,
            {
                path: SOURCE_GENERATION_FILE,
                bytes: Buffer.from(canonicalJson(descriptor)),
                executable: false,
            },
        ];
        // Batch raw blobs through Git to avoid a subprocess per exported asset. Numeric temporary
        // names avoid path quoting ambiguity; --no-filters keeps repository attributes out of G1.
        fs.mkdirSync(blobsDirectory);
        for (let index = 0; index < payload.length; index++) {
            options.signal?.throwIfAborted();
            fs.writeFileSync(path.join(blobsDirectory, String(index)), payload[index].bytes);
        }
        const blobs = (await sourceGit(blobsDirectory, [
            `--git-dir=${repository.gitDirectory}`,
            "hash-object",
            "-w",
            "--no-filters",
            "--stdin-paths",
        ], {
            ...gitOptions,
            input: payload.map((_, index) => `${index}\n`).join(""),
        })).stdout
            .toString("utf8")
            .trim()
            .split("\n");
        if (blobs.length !== payload.length) {
            throw new Error("Git returned an incomplete generation blob inventory.");
        }
        const entries = payload.map((file, index) => {
            const blob = blobs[index];
            assertSourceObjectId(blob);
            const mode = file.executable ? "100755" : "100644";
            return `${mode} ${blob}\t${file.path}\0`;
        });
        await sourceGit(repository.root, ["update-index", "-z", "--index-info"], {
            ...gitOptions,
            input: entries.join(""),
        });
        const tree = (await sourceGit(repository.root, ["write-tree"], gitOptions)).stdout
            .toString("utf8")
            .trim();
        const parents = options.parent ? ["-p", options.parent] : [];
        // Repeated preparation can begin from the same accepted parent while the user edits. Reuse
        // matching retained output rather than adding timestamp-only commits for identical inputs.
        const matching = await sourceGit(repository.root, [
            "log",
            "--all",
            "--format=%H",
            "--fixed-strings",
            `--grep=Uttori-Generation: ${descriptor.id}`,
        ], gitOptions);
        for (const existing of matching.stdout.toString("utf8").trim().split("\n").filter(Boolean)) {
            const ancestry = (await sourceGit(repository.root, ["rev-list", "--parents", "-n", "1", existing], gitOptions)).stdout
                .toString("utf8")
                .trim()
                .split(" ");
            const existingTree = (await sourceGit(repository.root, ["rev-parse", `${existing}^{tree}`], gitOptions)).stdout
                .toString("utf8")
                .trim();
            if (existingTree === tree && ancestry.slice(1).join(" ") === (options.parent ?? "")) {
                const ref = await pinSourceCandidate(repository, existing, options.signal);
                return { commit: existing, tree, ref, descriptor };
            }
        }
        const commit = (await sourceGit(repository.root, ["commit-tree", tree, ...parents], {
            ...gitOptions,
            input: `Generate ${options.inputs.project}\n\nUttori-Generation: ${descriptor.id}\n`,
        })).stdout
            .toString("utf8")
            .trim();
        const ref = await pinSourceCandidate(repository, commit, options.signal);
        return { commit, tree, ref, descriptor };
    }
    finally {
        scratch.dispose();
    }
}
/** Find the accepted pure parent in ordinary source ancestry; a descriptor alone is not a GC root. */
export async function acceptedSourceGeneration(repository, sourceCommit) {
    const current = await generationAt(repository, sourceCommit);
    const result = await sourceGit(repository.root, [
        "log",
        sourceCommit,
        "--format=%H",
        "--fixed-strings",
        `--grep=Uttori-Generation: ${current.id}`,
    ]);
    for (const candidate of result.stdout.toString("utf8").trim().split("\n").filter(Boolean)) {
        const { descriptor } = await verifySourceGeneration(repository, candidate);
        if (descriptor.id === current.id) {
            return candidate;
        }
    }
    throw new Error("The accepted generation is missing from source ancestry. Restore the full merge history before regenerating.");
}
//# sourceMappingURL=generation.js.map