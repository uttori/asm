import path from "node:path";
import { rasterInterchangeAtlas } from "@uttori/asm-assets/raster-interchange";
/** Native image options fully describe simple fixed rasters, so no game-specific mapping sidecar is needed. */
export const rasterSourceConversionAdapter = {
    id: "indexed.raster",
    supports: (emission) => emission.format.startsWith("snes.tile."),
    async prepare(context) {
        const source = context.read(context.source);
        const current = context.codecs.identify(source, { path: context.source });
        const document = current.decode(source);
        // This adapter owns one fixed raster. Extra frames/layers cannot be silently flattened during representation changes.
        rasterInterchangeAtlas(document);
        const related = context.build.mapping.assets.filter((emission) => context.build.mapping.fileList[emission.assetFileIdx].name === context.source);
        if (related.some((emission) => !this.supports(emission) || !emission.conversion)) {
            throw new Error("Raster source has consumers outside the native image adapter.");
        }
        return {
            bytes: await context.codecs.get(context.representation).encode(document),
            changes: [
                {
                    path: path.relative(context.build.root, context.source).split(path.sep).join("/"),
                    before: source,
                    after: null,
                },
            ],
            updates: related.map((emission) => ({
                emission,
                path: path
                    .relative(path.dirname(context.build.mapping.fileList[emission.fileIdx].name), context.destination)
                    .split(path.sep)
                    .join("/"),
                values: {},
            })),
            retained: [],
        };
    },
};
//# sourceMappingURL=raster-adapter.js.map