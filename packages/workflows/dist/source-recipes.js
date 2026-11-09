import { canonicalJson } from "@uttori/asm-core/canonical-json";
/** Reuse one shared target configuration, or combine disjoint authored Asar contributions into a single gap-preserving layout. */
export function mergeModuleRecipes(recipes) {
    const first = recipes.at(0);
    if (!first) {
        throw new Error("Source modules did not provide a link recipe. Supply an explicit recipe.");
    }
    const firstJson = canonicalJson(first);
    if (recipes.every((recipe) => canonicalJson(recipe) === firstJson)) {
        return structuredClone(first);
    }
    const regions = [];
    const placements = [];
    const names = new Set();
    let end = 0;
    let fillByte = 255;
    for (const recipe of recipes) {
        if (recipe.target !== first.target ||
            canonicalJson(recipe.targetOptions ?? {}) !== canonicalJson(first.targetOptions ?? {}) ||
            recipe.symbols?.length ||
            recipe.assertions?.length ||
            recipe.assumptions?.length) {
            throw new Error("Module-derived target configurations disagree; supply an explicit combined recipe.");
        }
        for (const region of recipe.regions) {
            if (region.outputOffset !== undefined) {
                end = Math.max(end, region.outputOffset + region.size);
            }
            if (region.name.startsWith("__source_gap_")) {
                fillByte = region.fillByte ?? fillByte;
                continue;
            }
            if (names.has(region.name)) {
                const previous = regions.find((entry) => entry.name === region.name);
                if (region.name === "__source_header" &&
                    canonicalJson(previous) === canonicalJson(region)) {
                    continue;
                }
                throw new Error(`Duplicate module-derived region '${region.name}'.`);
            }
            names.add(region.name);
            regions.push(region);
            fillByte = region.fillByte ?? fillByte;
        }
        placements.push(...recipe.placements);
    }
    let cursor = 0;
    const storage = regions
        .filter((region) => region.outputOffset !== undefined)
        .toSorted((a, b) => a.outputOffset - b.outputOffset || a.size - b.size);
    for (const region of storage) {
        const offset = region.outputOffset;
        if (region.size && offset < cursor) {
            throw new Error("Module-derived source extents overlap; use an explicit disjoint recipe or the absolute patch workflow.");
        }
        if (offset > cursor) {
            regions.push({
                name: `__source_gap_${cursor}`,
                start: 0,
                size: offset - cursor,
                outputOffset: cursor,
                fillByte,
            });
        }
        cursor = Math.max(cursor, offset + region.size);
    }
    if (end > cursor) {
        regions.push({
            name: `__source_gap_${cursor}`,
            start: 0,
            size: end - cursor,
            outputOffset: cursor,
            fillByte,
        });
    }
    return {
        ...first,
        regions,
        placements,
        checksumPolicy: recipes.some((recipe) => recipe.checksumPolicy === "recompute")
            ? "recompute"
            : "preserve",
    };
}
//# sourceMappingURL=source-recipes.js.map