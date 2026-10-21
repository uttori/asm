import fs from "node:fs";
import path from "node:path";
import { indexedSourceCodecs, } from "@uttori/asm-assets/source-codecs";
import { applySourceFileTransaction, assertSourcePath, sourceContentHash, parseSourceProject, } from "@uttori/asm-disassembler/source-project";
import { savedAssetSourceHost } from "./asset-interchange/service.js";
import { editAssetCall, locateAssetCall } from "./asset-source-edits.js";
/** Require a clean complete ROM oracle before and after any authoring representation switch. */
function assertBuild(build) {
    if (build.diagnostics.length) {
        throw new Error(build.diagnostics.map((item) => item.message).join("\n"));
    }
}
/** A current build proves only its consumed calls. Unassembled source files conservatively retain the old input. */
export function assetSourceAssemblyInventory(root) {
    // Editor URIs and native Git may spell the same macOS temporary root with different symlink prefixes.
    const absoluteRoot = fs.realpathSync(root);
    const project = parseSourceProject(JSON.parse(fs.readFileSync(path.join(absoluteRoot, ".uttori/project.json"), "utf8")));
    const files = [];
    let visited = 0;
    const visit = (directory, depth = 0) => {
        if (depth > 64) {
            throw new Error("Source conversion assembly discovery exceeds its directory depth budget.");
        }
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (++visited > 65536) {
                throw new Error("Source conversion assembly discovery exceeds its file budget.");
            }
            const file = path.join(directory, entry.name);
            if (entry.isSymbolicLink()) {
                files.push(file);
            }
            else if (entry.isDirectory()) {
                visit(file, depth + 1);
            }
            else if (/\.(asm|s|inc)$/i.test(entry.name)) {
                files.push(file);
            }
        }
    };
    for (const sourceRoot of project.sourceRoots) {
        visit(path.resolve(absoluteRoot, sourceRoot));
    }
    return files.toSorted();
}
/** Source hosts, adapters and representation registries are injected independently for future editor/format support. */
export class AssetSourceConversionService {
    adapters;
    host;
    codecs;
    constructor(adapters, host = savedAssetSourceHost, codecs = indexedSourceCodecs()) {
        this.adapters = adapters;
        this.host = host;
        this.codecs = codecs;
    }
    /** Resolve the saved evaluated call; menus and execution share the same semantic context rules. */
    async resolve(request, signal) {
        signal?.throwIfAborted();
        const build = await this.host.inspect(request.directory, undefined, signal);
        assertBuild(build);
        // Desktop URIs may use /var while native Git snapshots use /private/var on macOS.
        // Canonicalize the existing invocation file before comparing provider identities.
        const file = fs.realpathSync(path.resolve(build.root, request.file));
        const textBytes = build.snapshots.get(file);
        if (!textBytes) {
            throw new Error("The selected file is outside the current assembly context.");
        }
        const text = new TextDecoder("utf-8", { fatal: true }).decode(textBytes);
        const offsets = text.split(/(?<=\n)/);
        if (!Number.isSafeInteger(request.line) || request.line < 1 || request.line > offsets.length) {
            throw new Error("Conversion has an invalid cursor line.");
        }
        const cursor = offsets.slice(0, request.line - 1).join("").length;
        const matches = build.mapping.assets.filter((emission) => {
            if (build.mapping.fileList[emission.fileIdx]?.name !== file || !emission.conversion) {
                return false;
            }
            const syntax = locateAssetCall(text, emission.line);
            return cursor >= offsets.slice(0, emission.line - 1).join("").length && cursor <= syntax.end;
        });
        if (matches.length !== 1) {
            throw new Error("Asset conversion needs one unambiguous emitting include; repeated macro contexts require an explicit choice.");
        }
        const selected = matches[0];
        const source = build.mapping.fileList[selected.assetFileIdx].name;
        const sourceBytes = build.snapshots.get(source);
        if (!sourceBytes) {
            throw new Error("Asset source snapshot is missing.");
        }
        const current = this.codecs.identify(sourceBytes, { path: source });
        return { build, selected, source, current };
    }
    async prepare(request, signal) {
        const { build, selected, source, current } = await this.resolve(request, signal);
        const projectFile = path.join(build.root, ".uttori/project.json");
        const projectBytes = fs.readFileSync(projectFile);
        const inventory = assetSourceAssemblyInventory(build.root);
        const target = this.codecs.get(request.representation);
        if (current.id === target.id) {
            throw new Error(`Asset already uses ${target.id}.`);
        }
        const destination = request.destination
            ? path.resolve(build.root, request.destination)
            : source.replace(/\.[^.]+$/, target.extensions[0]);
        const name = (absolute) => {
            const relative = path.relative(build.root, absolute).split(path.sep).join("/");
            assertSourcePath(relative);
            return relative;
        };
        name(source);
        const destinationName = name(destination);
        if (fs.existsSync(destination)) {
            throw new Error(`Conversion destination already exists: ${destinationName}. Choose a different destination.`);
        }
        const adapters = this.adapters.filter((adapter) => adapter.supports(selected));
        if (adapters.length !== 1) {
            throw new Error(`No unambiguous source conversion adapter for '${selected.format}'.`);
        }
        const candidate = await adapters[0].prepare({
            build,
            selected,
            source,
            destination,
            codecs: this.codecs,
            representation: target.id,
            read: (absolute) => {
                const bytes = build.snapshots.get(absolute);
                if (!bytes) {
                    throw new Error(`Missing build resource snapshot: ${name(absolute)}.`);
                }
                return bytes.slice();
            },
        });
        signal?.throwIfAborted();
        let changes = [
            { path: destinationName, before: null, after: candidate.bytes },
            ...candidate.changes,
        ];
        const edits = new Map();
        for (const update of candidate.updates) {
            const absolute = build.mapping.fileList[update.emission.fileIdx].name;
            const before = build.snapshots.get(absolute);
            const entry = edits.get(absolute) ?? {
                before,
                text: new TextDecoder().decode(before),
                updates: [],
            };
            if (entry.updates.some((existing) => existing.emission.line === update.emission.line)) {
                throw new Error("Conversion has repeated source emission at one call.");
            }
            entry.updates.push(update);
            edits.set(absolute, entry);
        }
        for (const [absolute, entry] of edits) {
            for (const update of entry.updates.toSorted((a, b) => b.emission.line - a.emission.line)) {
                entry.text = editAssetCall(entry.text, locateAssetCall(entry.text, update.emission.line), {
                    path: update.path,
                    values: update.values,
                });
            }
            changes.push({
                path: name(absolute),
                before: entry.before,
                after: new TextEncoder().encode(entry.text),
            });
        }
        const seen = new Set();
        for (const change of changes) {
            assertSourcePath(change.path);
            if (seen.has(change.path)) {
                throw new Error(`Duplicate conversion change '${change.path}'.`);
            }
            seen.add(change.path);
        }
        // Preview creations/replacements first. Remaining active consumers can still resolve the old source;
        // its exact consumption tells us whether removal is safe, without guessing incbin/resource ownership.
        // Generation declarations are separately validated authoring metadata, not runtime assembly inputs.
        const overlays = new Map(changes
            .filter((item) => item.after !== null && item.path !== "asset-includes.json")
            .map((item) => [item.path, item.after]));
        const after = await this.host.inspect(request.directory, overlays, signal);
        assertBuild(after);
        if (!Buffer.from(after.output).equals(Buffer.from(build.output))) {
            throw new Error("Source conversion changed the complete current ROM; no files were published.");
        }
        const retained = new Set(candidate.retained ?? []);
        const unresolvedDeclarations = inventory.filter((file) => !build.snapshots.has(file));
        const incompleteScope = unresolvedDeclarations.length > 0;
        changes = changes.filter((change) => {
            if (change.after === null &&
                (incompleteScope || after.snapshots.has(path.resolve(build.root, change.path)))) {
                retained.add(change.path);
                return false;
            }
            return true;
        });
        const paths = [...new Map([...build.snapshots, [projectFile, projectBytes]])].map(([absolute, bytes]) => ({
            path: absolute,
            sha256: sourceContentHash(bytes),
        }));
        const plan = {
            source: name(source),
            destination: destinationName,
            outputSha256: sourceContentHash(build.output),
            changes,
            snapshots: paths,
            affected: candidate.updates.map(({ emission }) => ({
                file: name(build.mapping.fileList[emission.fileIdx].name),
                line: emission.line,
                format: emission.format,
            })),
            retained: [...retained],
            unresolvedDeclarations: unresolvedDeclarations.map(name),
            assemblyInventory: inventory,
        };
        this.assertFresh(build.root, plan);
        return plan;
    }
    /** Absence and all build dependencies are guarded again immediately before publication. */
    assertFresh(root, plan) {
        if (JSON.stringify(assetSourceAssemblyInventory(root)) !== JSON.stringify(plan.assemblyInventory)) {
            throw new Error("Assembly discovery changed during conversion; try again.");
        }
        for (const snapshot of plan.snapshots) {
            if (sourceContentHash(fs.readFileSync(path.resolve(root, snapshot.path))) !== snapshot.sha256) {
                throw new Error(`Source changed during conversion: ${snapshot.path}.`);
            }
        }
        for (const change of plan.changes) {
            const file = path.join(root, change.path);
            const exists = fs.existsSync(file);
            if ((change.before === null && exists) ||
                (change.before !== null &&
                    (!exists ||
                        sourceContentHash(fs.readFileSync(file)) !== sourceContentHash(change.before)))) {
                throw new Error(`Conversion has a stale or colliding source path: ${change.path}.`);
            }
        }
        const dirty = this.host
            .drafts?.()
            .filter((draft) => plan.snapshots.some((snapshot) => path.resolve(root, snapshot.path) === path.resolve(root, draft.path)) ||
            plan.changes.some((change) => path.resolve(root, change.path) === path.resolve(root, draft.path))) ?? [];
        if (dirty.length) {
            throw new Error(`Save relevant conversion drafts first: ${dirty.map((draft) => draft.path).join(", ")}. Drafts are preserved.`);
        }
    }
    /** Coordinated recoverability uses the shared journal; clean conversions have no separate review/apply lifecycle. */
    async convert(request, options = {}) {
        const plan = await this.prepare(request, options.signal);
        const opened = await this.host.open(request.directory);
        const root = opened.repository.root;
        await this.host.beforePublish?.([
            ...new Set([
                ...plan.snapshots.map((snapshot) => path.resolve(root, snapshot.path)),
                ...plan.changes.map((change) => path.join(root, change.path)),
            ]),
        ]);
        const transaction = applySourceFileTransaction(opened.repository, plan.changes, {
            ...options,
            validate: () => this.assertFresh(root, plan),
        });
        if (!options.stageOnly) {
            const published = await this.host.inspect(request.directory, undefined, options.signal);
            assertBuild(published);
            if (sourceContentHash(published.output) !== plan.outputSha256) {
                throw new Error("Published conversion no longer matches its validated ROM.");
            }
            await this.host.completed?.();
        }
        return { ...plan, transaction: transaction?.id };
    }
}
//# sourceMappingURL=asset-source-conversion.js.map