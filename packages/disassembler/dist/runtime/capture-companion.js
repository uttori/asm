import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { canonicalEquals } from "@uttori/asm-core/canonical-json";
import { verifyCaptureContext } from "@uttori/asm-debug-adapter";
/**
 * A present companion is part of the import's integrity boundary. Bind its verified artifacts to
 * the primary archive's exact session and terminal count; a different capture of the same ROM
 * is insufficient. Bare captures remain valid when no companion was recorded.
 */
export async function verifyRuntimeCaptureCompanion(file, recovery, signal) {
    const directory = `${file}.context`;
    const stat = await lstat(directory).catch((error) => {
        if (error.code === "ENOENT") {
            return undefined;
        }
        throw error;
    });
    if (!stat) {
        return;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error("Capture companion must be a regular directory.");
    }
    const manifestFile = path.join(directory, "manifest.json");
    if ((await lstat(manifestFile)).size > 1048576) {
        throw new Error("Capture companion manifest exceeds its size budget.");
    }
    const before = await readFile(manifestFile, "utf8");
    const manifest = JSON.parse(before);
    if (!recovery.complete ||
        manifest.archive !== path.basename(file) ||
        manifest.scope !== recovery.header.scope ||
        manifest.boundaries?.session !== recovery.header.session ||
        manifest.boundaries.end?.eventThrough !== recovery.eventThrough) {
        throw new Error("Capture companion does not match this archive's scope, session, or final event boundary.");
    }
    await verifyCaptureContext(directory, recovery.header, signal);
    const boundaries = JSON.parse(await readFile(path.join(directory, "boundaries.json"), "utf8"));
    if (!canonicalEquals(boundaries, manifest.boundaries) ||
        (await readFile(manifestFile, "utf8")) !== before) {
        throw new Error("Capture companion changed or its manifest and boundary artifact disagree.");
    }
}
//# sourceMappingURL=capture-companion.js.map