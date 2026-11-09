import fs from "node:fs";
import path from "node:path";
import { parseSourceProject } from "@uttori/asm-disassembler/source-project";
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
//# sourceMappingURL=asset-source-inventory.js.map