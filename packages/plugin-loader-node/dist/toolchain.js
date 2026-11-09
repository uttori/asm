import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
/**
 * Accepts a JSON object. Arrays and null are not package manifests.
 * @param value Parsed JSON.
 * @returns True when `value` is a non-array object.
 */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * Reads a package.json dependency map. A missing map contributes no dependencies.
 * @param value `dependencies` or `optionalDependencies`.
 * @param root Package directory, used in the error.
 * @returns Dependency names. Values are ignored except for object shape.
 */
function dependencyMap(value, root) {
    if (value === undefined) {
        return {};
    }
    if (!isRecord(value)) {
        throw new Error(`Tool package dependency map is invalid: ${root}`);
    }
    return value;
}
/** Source-mode and packaged entry points both resolve to an owning package, never to repository HEAD. */
function packageRoot(file) {
    let directory = path.dirname(file);
    while (!fs.existsSync(path.join(directory, "package.json"))) {
        const parent = path.dirname(directory);
        if (parent === directory) {
            throw new Error(`Tool module has no package identity: ${file}`);
        }
        directory = parent;
    }
    return fs.realpathSync(directory);
}
/** Hex SHA-256 digest; strings hash as UTF-8. */
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
/**
 * Hash owning packages and installed runtime dependencies, including dirty source, encoders and native
 * modules. Hosts include their own entry point so bundled code is covered as well. This is conservative:
 * source and built output both contribute; no version string alone is accepted as a content identity.
 */
export function fingerprintNodeToolchain(moduleFiles, bundles = []) {
    const seen = new Set();
    const packages = [];
    let totalBytes = 0, totalFiles = 0;
    const visitPackage = (root) => {
        if (seen.has(root)) {
            return;
        }
        seen.add(root);
        const packageFile = path.join(root, "package.json");
        const parsed = JSON.parse(fs.readFileSync(packageFile, "utf8"));
        if (!isRecord(parsed) ||
            typeof parsed.name !== "string" ||
            !parsed.name ||
            typeof parsed.version !== "string" ||
            !parsed.version) {
            throw new Error(`Tool package needs a name and version: ${root}`);
        }
        const dependencies = dependencyMap(parsed.dependencies, root);
        const optionalDependencies = dependencyMap(parsed.optionalDependencies, root);
        const files = [];
        const visit = (directory) => {
            for (const entry of fs
                .readdirSync(directory, { withFileTypes: true })
                .toSorted((a, b) => Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)))) {
                // File browsers update these display caches independently of executable package contents.
                // Including them makes an unchanged build/session appear stale merely by opening a folder.
                if ([".DS_Store", "Thumbs.db", "desktop.ini"].includes(entry.name)) {
                    continue;
                }
                if ([
                    "node_modules",
                    ".git",
                    ".tokensave",
                    "coverage",
                    "tests",
                    "test",
                    "fixtures",
                    "docs",
                ].includes(entry.name)) {
                    continue;
                }
                const file = path.join(directory, entry.name);
                if (entry.isDirectory()) {
                    visit(file);
                }
                else if (entry.isFile()) {
                    totalBytes += fs.statSync(file).size;
                    if (++totalFiles > 50000 || totalBytes > 512 * 1024 * 1024) {
                        throw new Error("Toolchain fingerprint exceeds its package budget.");
                    }
                    files.push({
                        path: path.relative(root, file).split(path.sep).join("/"),
                        sha256: hash(fs.readFileSync(file)),
                    });
                }
                else if (entry.isSymbolicLink()) {
                    throw new Error(`Tool packages must contain regular files: ${file}`);
                }
            }
        };
        visit(root);
        packages.push({
            name: parsed.name,
            version: parsed.version,
            sha256: hash(canonicalJson(files)),
        });
        const resolve = createRequire(packageFile).resolve;
        for (const dependency of Object.keys({
            ...dependencies,
            ...optionalDependencies,
        }).toSorted()) {
            // Reading package contents does not select a require/import entry point. Import-only and
            // subpath-only packages can deliberately omit the CommonJS root export.
            const directory = resolve
                .paths(dependency)
                ?.map((base) => path.join(base, dependency))
                .find((candidate) => fs.existsSync(path.join(candidate, "package.json")));
            if (directory) {
                visitPackage(fs.realpathSync(directory));
                continue;
            }
            let entry;
            try {
                entry = resolve(dependency);
            }
            catch (error) {
                if (Object.hasOwn(optionalDependencies, dependency)) {
                    continue;
                }
                throw new Error(`Cannot fingerprint runtime dependency ${dependency} of ${parsed.name}.`, {
                    cause: error,
                });
            }
            visitPackage(packageRoot(entry));
        }
    };
    for (const file of moduleFiles) {
        visitPackage(packageRoot(file.startsWith("file:") ? fileURLToPath(file) : path.resolve(file)));
    }
    // A self-contained host bundle already contains its runtime dependencies. Installed VSIX files
    // intentionally have no node_modules; traversing their development package manifest is incorrect.
    for (const file of bundles) {
        const resolved = file.startsWith("file:") ? fileURLToPath(file) : path.resolve(file);
        const stat = fs.lstatSync(resolved);
        if (!stat.isFile() || stat.size > 512 * 1024 * 1024) {
            throw new Error("Invalid toolchain bundle.");
        }
        packages.push({
            name: `bundle:${path.basename(resolved)}`,
            version: "content",
            sha256: hash(fs.readFileSync(resolved)),
        });
    }
    packages.sort((a, b) => Buffer.compare(Buffer.from(`${a.name}@${a.version}:${a.sha256}`), Buffer.from(`${b.name}@${b.version}:${b.sha256}`)));
    const identity = { node: process.version, packages };
    return { ...identity, sha256: hash(canonicalJson(identity)) };
}
//# sourceMappingURL=toolchain.js.map