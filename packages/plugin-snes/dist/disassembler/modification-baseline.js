import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { assetSourcePath } from "@uttori/asm-assets/node";
import { durableReplace, loadSourceExportManifest, sourceExportSha256, validateSourceExportFiles, validateSourceExportInputs, } from "@uttori/asm-disassembler";
/** Retain only the declared source generation and inputs, never the potentially enormous analysis database.
 * @param {string} root Owning modification project.
 * @param {string} sourceDirectory Verified generated source root.
 * @param {string} romFile Original ROM including its optional copier header.
 * @param {Uint8Array} interfaceBytes Verified symbols/types include.
 * @returns {string} Relative immutable snapshot directory. An incomplete snapshot is never referenced by a manifest.
 */
export function retainModificationBaseline(root, sourceDirectory, romFile, interfaceBytes) {
    const manifestBytes = fs.readFileSync(path.join(sourceDirectory, "generated-files.json"));
    const manifest = loadSourceExportManifest(sourceDirectory);
    validateSourceExportFiles(sourceDirectory, manifest);
    validateSourceExportInputs(sourceDirectory, manifest);
    let relative = `.baselines/${sourceExportSha256(manifestBytes)}`;
    let destination = path.join(root, relative);
    if (fs.existsSync(destination)) {
        try {
            // A process may exit after snapshot completion but before its manifest commit. Reuse only exact, complete bytes.
            if (!fs
                .readFileSync(path.join(destination, "source/generated-files.json"))
                .equals(manifestBytes) ||
                sourceExportSha256(fs.readFileSync(path.join(destination, "baseline.sfc"))) !==
                    manifest.rom.sha256 ||
                !fs.readFileSync(path.join(destination, "baseline-interface.asm")).equals(interfaceBytes)) {
                throw new Error("Incomplete retained snapshot.");
            }
            validateSourceExportFiles(path.join(destination, "source"), manifest);
            validateSourceExportInputs(path.join(destination, "source"), manifest);
            return relative;
        }
        catch {
            // Preserve an interrupted or externally changed snapshot, and publish a new verified copy beside it.
            relative += `-${randomUUID()}`;
            destination = path.join(root, relative);
        }
    }
    fs.mkdirSync(destination, { recursive: true });
    for (const name of new Set([
        ...manifest.files.map((entry) => entry.path),
        ...(manifest.inputs ?? []).map((entry) => entry.path),
    ])) {
        const from = assetSourcePath(sourceDirectory, name);
        const to = path.join(destination, "source", name);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        durableReplace(to, fs.readFileSync(from));
    }
    durableReplace(path.join(destination, "source/generated-files.json"), manifestBytes);
    durableReplace(path.join(destination, "baseline.sfc"), fs.readFileSync(romFile));
    durableReplace(path.join(destination, "baseline-interface.asm"), interfaceBytes);
    validateSourceExportFiles(path.join(destination, "source"), manifest);
    validateSourceExportInputs(path.join(destination, "source"), manifest);
    if (sourceExportSha256(fs.readFileSync(path.join(destination, "baseline.sfc"))) !==
        manifest.rom.sha256) {
        throw new Error("ROM changed while retaining baseline.");
    }
    // Child file writes flush their own directories; also retain the new generation's parent entry.
    const parent = fs.openSync(path.dirname(destination), "r");
    try {
        fs.fsyncSync(parent);
    }
    finally {
        fs.closeSync(parent);
    }
    return relative;
}
//# sourceMappingURL=modification-baseline.js.map