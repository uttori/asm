import fs from "node:fs";
import path from "node:path";
import { assetRelativePath, assetSourcePath, assertAssetSourceBaseline, createAssetSourceBaseline, } from "./source-baseline.js";
/** Walk a complete generation without following links or special files.
 * @param {string} root Source generation directory.
 * @param {string} prefix Relative traversal prefix.
 * @param {readonly string[]} excluded Explicit directories outside the staged source scope.
 * @param {string[]} directories Optional output inventory, including empty directories.
 * @returns {string[]} Deterministically sorted project-relative file inventory.
 */
function inventory(root, prefix = "", excluded = [], directories) {
    return fs
        .readdirSync(path.join(root, prefix), { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name))
        .flatMap((entry) => {
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (excluded.includes(name)) {
            if (!entry.isDirectory()) {
                throw new Error(`Excluded path must be a directory: ${name}.`);
            }
            return [];
        }
        if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
            throw new Error(`Non-regular staged path: ${name}.`);
        }
        if (entry.isDirectory()) {
            directories?.push(name);
            return inventory(root, name, excluded, directories);
        }
        return [name];
    });
}
/** Verify both content and inventory; newly added source files must not disappear on publication.
 * @param {string} root Live source generation.
 * @param {AssetSourceBaseline} baseline Complete snapshot taken before staging.
 * @param {string} identity Expected independent host identity.
 * @param {readonly string[]} excluded Directories omitted from the original snapshot.
 * @returns {void} Throws if any live file was added, removed or edited.
 */
function assertGeneration(root, baseline, identity, excluded) {
    assertAssetSourceBaseline(root, baseline, identity);
    if (JSON.stringify(inventory(root, "", excluded).sort()) !==
        JSON.stringify(baseline.files.map((f) => f.path).sort())) {
        throw new Error("Live source inventory changed during staging.");
    }
}
/**
 * Copy a complete source generation beside its live root. New assets and exporter-generated
 * files may be created freely inside this isolated directory. The caller owns stage cleanup.
 * @param {string} root Existing real directory with no symlinks/special files.
 * @param {string} identity Host-selected project and adapter revision identity.
 * @param {readonly string[]} excludedDirectories External directories retained from the live generation; never inferred from game names.
 * @returns {AssetSourceStage} Isolated writable tree and original complete baseline.
 */
export function createAssetSourceStage(root, identity, excludedDirectories = []) {
    const absolute = fs.realpathSync(root);
    if (!fs.lstatSync(root).isDirectory()) {
        throw new Error("Stage source must be a real directory.");
    }
    const excluded = [...new Set(excludedDirectories.map(assetRelativePath))];
    if (excluded.some((name, i) => excluded.some((parent, j) => i !== j && name.startsWith(`${parent}/`)))) {
        throw new Error("Excluded source directories must not overlap.");
    }
    const directories = [];
    const files = inventory(absolute, "", excluded, directories);
    const size = files.reduce((sum, name) => sum + fs.statSync(assetSourcePath(absolute, name)).size, 0);
    if (size > 1024 ** 3) {
        throw new Error("Source stage exceeds one GiB; declare external directories explicitly.");
    }
    const sources = new Map(files.map((name) => [name, fs.readFileSync(assetSourcePath(absolute, name))]));
    const baseline = createAssetSourceBaseline(identity, sources);
    const directory = fs.mkdtempSync(path.join(path.dirname(absolute), `.${path.basename(absolute)}-stage-`));
    try {
        // Empty source directories are part of the usable project layout too.
        for (const name of directories) {
            fs.mkdirSync(path.join(directory, name), { recursive: true });
        }
        for (const name of files) {
            const target = path.join(directory, name);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(assetSourcePath(absolute, name), target);
        }
        assertGeneration(absolute, baseline, identity, excluded);
        assertGeneration(directory, baseline, identity, excluded);
        return { directory, baseline, excludedDirectories: excluded };
    }
    catch (error) {
        fs.rmSync(directory, { recursive: true, force: true });
        throw error;
    }
}
/**
 * Validate and publish a whole source generation, retaining the previous tree as recovery data.
 * The host must check generated manifests and assemble inside validate; failure leaves live
 * sources untouched. Offline operation is required: two directory renames are not crash-atomic
 * or atomic to concurrent readers. On failure, restore the previous tree if its path is free.
 * @param {string} root Live source directory, a sibling of the stage.
 * @param {AssetSourceStage} stage Complete staged generation including newly created files.
 * @param {string} identity Expected project/adapter identity independent of persisted metadata.
 * @param {(directory: string) => Promise<void> | void} validate Required host-specific integrity and build gates.
 * @returns {Promise<string>} Previous generation directory retained for explicit cleanup or recovery.
 */
export async function publishAssetSourceStage(root, stage, identity, validate) {
    const absolute = fs.realpathSync(root);
    const staged = fs.realpathSync(stage.directory);
    if (!fs.lstatSync(root).isDirectory() ||
        !fs.lstatSync(stage.directory).isDirectory() ||
        absolute === staged ||
        path.dirname(absolute) !== path.dirname(staged)) {
        throw new Error("Stage must be a distinct real sibling directory.");
    }
    if (typeof validate !== "function") {
        throw new Error("Stage publication requires a validation gate.");
    }
    const excluded = stage.excludedDirectories.map(assetRelativePath);
    assertGeneration(absolute, stage.baseline, identity, excluded);
    await validate(staged);
    inventory(staged); // A validation tool must not introduce links or special files.
    for (const name of excluded) {
        if (fs.existsSync(path.join(staged, name))) {
            throw new Error(`Stage shadows an external directory: ${name}.`);
        }
    }
    assertGeneration(absolute, stage.baseline, identity, excluded);
    const container = fs.mkdtempSync(path.join(path.dirname(absolute), `.${path.basename(absolute)}-previous-`));
    const previous = path.join(container, "source");
    let moved = false;
    const retained = [];
    try {
        fs.renameSync(absolute, previous);
        moved = true;
        // Detect a writer that changed the old generation between validation and rename.
        assertGeneration(previous, stage.baseline, identity, excluded);
        // Preserve large databases/captures without copying or replacing them. They are outside
        // source publication, and move with their existing contents into the new generation.
        for (const name of excluded) {
            const from = path.join(previous, name);
            if (!fs.existsSync(from)) {
                continue;
            }
            const target = path.join(staged, name);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.renameSync(from, target);
            retained.push(name);
        }
        if (fs.existsSync(absolute)) {
            throw new Error("Live source path was recreated during publication.");
        }
        fs.renameSync(staged, absolute);
        return previous;
    }
    catch (cause) {
        if (moved) {
            try {
                for (const name of retained.toReversed()) {
                    fs.renameSync(path.join(staged, name), path.join(previous, name));
                }
                if (fs.existsSync(absolute)) {
                    throw new Error("Concurrent source tree prevents recovery.");
                }
                fs.renameSync(previous, absolute);
            }
            catch (recovery) {
                throw new AggregateError([cause, recovery], `Stage recovery incomplete; previous sources remain at ${previous}.`);
            }
        }
        fs.rmdirSync(container);
        throw cause;
    }
}
//# sourceMappingURL=source-stage.js.map