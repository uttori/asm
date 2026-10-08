import { executeAssetSourceOperation, } from "../asset-source/operations.js";
import { executeAssetOperation } from "./operations.js";
/** Saved-document commands are distinct from source capture import; apply requires the exact reviewed plan ID. */
export const assetUsage = `Usage:
  uttori-asm asset convert <project> --file <assembly.asm> --line <one-based-line> --to aseprite|indexed-png [--destination <relative-path>]
  uttori-asm asset export <project> --adapter <id> --selection <selection.json> --document <file> --manifest <file.json> [--presentation tilemap|raster|indexed-png]
  uttori-asm asset review <project> --document <saved-file> --manifest <file.json>
  uttori-asm asset apply <project> --document <saved-file> --manifest <file.json> --review <review-id>
  uttori-asm asset recover <project> --direction before|after
  uttori-asm asset cleanup <project> --policy <retire.json> [--review <cleanup-plan-id>]

Source conversion adapters: som.sprite.native, indexed.raster
Saved-file interchange adapters: som.sprite.native, som.room.native
After conversion, edit/save the active source and run the normal build.
Export never replaces existing output files. Review prints the proposed files, consumers and plan ID.
Save source/editor drafts first. For interchange apply, re-export current source for the next editing round.
Use --help for help and -- before project paths beginning with --.`;
/** Parse without reading files. Reject duplicate/inapplicable flags so a typo cannot silently change the selected workflow. */
export function parseAssetCliArguments(argv) {
    if (argv[0] === "--help") {
        return undefined;
    }
    const action = argv[0];
    if (action !== "export" &&
        action !== "review" &&
        action !== "apply" &&
        action !== "recover" &&
        action !== "cleanup" &&
        action !== "convert") {
        throw new Error("Expected asset convert, export, review, apply, recover or cleanup.");
    }
    const allowed = new Set();
    if (action === "convert") {
        for (const flag of ["--file", "--line", "--to", "--destination"]) {
            allowed.add(flag);
        }
    }
    else if (action === "recover") {
        allowed.add("--direction");
    }
    else if (action === "cleanup") {
        allowed.add("--policy");
        allowed.add("--review");
    }
    else {
        allowed.add("--document");
        allowed.add("--manifest");
    }
    if (action === "export") {
        allowed.add("--adapter");
        allowed.add("--selection");
        allowed.add("--presentation");
    }
    if (action === "apply") {
        allowed.add("--review");
    }
    const values = new Map(), positional = [];
    let ended = false;
    for (let index = 1; index < argv.length; index++) {
        const token = argv[index];
        if (!ended && token === "--help") {
            return undefined;
        }
        if (!ended && token === "--") {
            ended = true;
            continue;
        }
        if (!ended && token.startsWith("--")) {
            const equals = token.indexOf("="), flag = equals < 0 ? token : token.slice(0, equals);
            if (!allowed.has(flag) || values.has(flag)) {
                throw new Error(`Unknown, duplicate or inapplicable asset option ${flag}.`);
            }
            const value = equals < 0 ? argv[++index] : token.slice(equals + 1);
            if (!value || (equals < 0 && value.startsWith("--"))) {
                throw new Error(`Missing value for ${flag}.`);
            }
            values.set(flag, value);
        }
        else {
            positional.push(token);
        }
    }
    if (positional.length !== 1) {
        throw new Error("Select exactly one source project.");
    }
    const required = (flag) => {
        const value = values.get(flag);
        if (!value) {
            throw new Error(`Missing required asset option ${flag}.`);
        }
        return value;
    };
    if (action === "convert") {
        const line = Number(required("--line"));
        if (!Number.isSafeInteger(line) || line < 1) {
            throw new Error("Conversion line must be a positive one-based integer.");
        }
        return {
            action: "asset-convert",
            directory: positional[0],
            file: required("--file"),
            line,
            representation: required("--to"),
            destination: values.get("--destination"),
        };
    }
    if (action === "recover") {
        const direction = required("--direction");
        if (direction !== "before" && direction !== "after") {
            throw new Error("Expected before or after recovery direction.");
        }
        return { action: "asset-recover", directory: positional[0], direction };
    }
    if (action === "cleanup") {
        return {
            action: "asset-cleanup",
            directory: positional[0],
            policy: required("--policy"),
            ...(values.has("--review") ? { review: required("--review") } : {}),
        };
    }
    const common = {
        directory: positional[0],
        document: required("--document"),
        manifest: required("--manifest"),
    };
    if (action === "export") {
        const presentation = values.get("--presentation");
        if (presentation !== undefined &&
            presentation !== "tilemap" &&
            presentation !== "raster" &&
            presentation !== "indexed-png") {
            throw new Error("Expected tilemap, raster or indexed-png presentation.");
        }
        return {
            ...common,
            action: "asset-export",
            adapter: required("--adapter"),
            selection: required("--selection"),
            ...(presentation ? { presentation } : {}),
        };
    }
    if (action === "review") {
        return { ...common, action: "asset-review" };
    }
    return { ...common, action: "asset-apply", review: required("--review") };
}
/** Thin installed command host; both CLI and editor dispatch the same saved-source operation implementation. */
export async function runAssetCli(argv) {
    try {
        const operation = parseAssetCliArguments(argv);
        if (!operation) {
            console.log(assetUsage);
        }
        else {
            if (operation.action === "asset-convert") {
                const result = await executeAssetSourceOperation(operation);
                if (!result) {
                    throw new Error("Conversion returned no result.");
                }
                console.log(JSON.stringify({
                    source: "source" in result ? result.source : undefined,
                    destination: "destination" in result ? result.destination : undefined,
                    outputSha256: result.outputSha256,
                    transaction: result.transaction,
                    affected: "affected" in result ? result.affected : undefined,
                    retained: "retained" in result ? result.retained : undefined,
                    unresolvedDeclarations: "unresolvedDeclarations" in result ? result.unresolvedDeclarations : undefined,
                }, null, 2));
            }
            else {
                console.log(JSON.stringify(await executeAssetOperation(operation), null, 2));
            }
        }
        return 0;
    }
    catch (error) {
        console.error(`Asset operation failed: ${error instanceof Error ? error.message : String(error)}\n\n${assetUsage}`);
        return 1;
    }
}
//# sourceMappingURL=cli.js.map