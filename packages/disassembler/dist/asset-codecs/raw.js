import { createHash } from "node:crypto";
import { byteArray, decodedObject, defaultAssetPath, optionsFor, readExactAssetBytes, stringOption, } from "./common.js";
/** Stable id of the built-in byte-preserving raw/incbin codec. */
export const RAW_ASSET_CODEC_ID = "uttori.asset.raw";
/** Raw bytes extracted as an incbin-ready binary file. */
export const rawAssetCodec = Object.freeze({
    id: RAW_ASSET_CODEC_ID,
    version: "1.0.0",
    sizeBounds: { minimum: 1 },
    inspect: ({ request }) => {
        if (request.length === undefined) {
            throw new Error(`Raw asset '${request.id}' requires an exact length.`);
        }
        return { size: request.length, metadata: { sourceForm: "incbin" } };
    },
    decode: (context) => {
        const bytes = readExactAssetBytes(context);
        const options = optionsFor(context);
        const path = stringOption(options, "path", defaultAssetPath(context.request.id, "bin"));
        const mediaType = stringOption(options, "mediaType", "application/octet-stream");
        return {
            value: {
                kind: "raw",
                bytes: [...bytes],
                sha256: createHash("sha256").update(bytes).digest("hex"),
            },
            files: [{ path, mediaType, bytes }],
        };
    },
    encode: ({ decoded, request }) => {
        const value = decodedObject(decoded.value, request.id);
        return Uint8Array.from(byteArray(value.bytes, `Raw asset '${request.id}' bytes`));
    },
});
//# sourceMappingURL=raw.js.map