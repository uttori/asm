import { linkBinary, linkConstant, linkInteger, linkUnary, } from "../ir/link-expression.js";
import { LinkError } from "./types.js";
/** Independent module/section namespaces cannot collide even when names contain punctuation. */
export const allocationKey = (module, section) => JSON.stringify([module, section]);
/** Placement-dependent arithmetic is evaluated once per symbol, with an explicit cycle stack. */
export class LinkSymbols {
    recipe;
    allocations;
    modules = new Map();
    exports = new Map();
    recipeSymbols = new Map();
    bySection = new Map();
    cache = new Map();
    active = new Set();
    stack = [];
    constructor(modules, recipe, allocations) {
        this.recipe = recipe;
        this.allocations = new Map(allocations.map((allocation) => [
            allocationKey(allocation.module, allocation.section),
            allocation,
        ]));
        for (const allocation of allocations) {
            const entries = this.bySection.get(allocation.section) ?? [];
            entries.push(allocation);
            this.bySection.set(allocation.section, entries);
        }
        for (const module of modules) {
            if (this.modules.has(module.id)) {
                throw new LinkError("duplicate-module", `Duplicate module identity '${module.id}'.`);
            }
            this.modules.set(module.id, new Map(module.symbols.map((symbol) => [symbol.name, symbol])));
            for (const symbol of module.symbols) {
                if (symbol.visibility !== "export") {
                    continue;
                }
                const previous = this.exports.get(symbol.name);
                if (previous) {
                    throw new LinkError("duplicate-symbol", `Duplicate export '${symbol.name}' in '${previous.module}' and '${module.id}'.`, symbol.source);
                }
                this.exports.set(symbol.name, { module: module.id, symbol });
            }
        }
        for (const symbol of recipe.symbols ?? []) {
            if (this.recipeSymbols.has(symbol.name) || this.exports.has(symbol.name)) {
                throw new LinkError("duplicate-symbol", `Duplicate recipe/global symbol '${symbol.name}'.`);
            }
            this.recipeSymbols.set(symbol.name, symbol);
        }
    }
    /** Section definitions use run addresses; load symbols are explicitly recipe-derived. */
    section(module, section, offset = 0) {
        const allocation = this.allocations.get(allocationKey(module, section));
        if (!allocation || offset < 0 || offset > allocation.size) {
            throw new LinkError("section-reference", `Invalid section position '${module}:${section}+${offset}'.`);
        }
        return linkInteger(allocation.runAddress + offset);
    }
    evaluate(expression, source, depth = 0) {
        try {
            if (depth > 128) {
                throw new Error("Link expression nesting exceeds 128.");
            }
            switch (expression.kind) {
                case "constant":
                    return expression.value;
                case "section":
                    return this.section(expression.module, expression.section, expression.offset);
                case "symbol":
                    return this.resolve(expression.name, expression.module);
                case "unary": {
                    const result = linkUnary(expression.operator, linkConstant(this.evaluate(expression.argument, source, depth + 1)));
                    if (result.kind !== "constant") {
                        throw new Error("Unresolved unary expression.");
                    }
                    return result.value;
                }
                case "binary": {
                    // Logical operands remain pure, but a determined result need not evaluate an unreachable division.
                    const left = this.evaluate(expression.left, source, depth + 1);
                    if (expression.operator === "&&" && left === 0) {
                        return 0;
                    }
                    if (expression.operator === "||" && left !== 0) {
                        return 1;
                    }
                    const result = linkBinary(expression.operator, linkConstant(left), linkConstant(this.evaluate(expression.right, source, depth + 1)));
                    if (result.kind !== "constant") {
                        throw new Error("Unresolved binary expression.");
                    }
                    return result.value;
                }
                default:
                    throw new LinkError("expression", "Unknown link expression kind.");
            }
        }
        catch (error) {
            if (error instanceof LinkError && (error.source || !source)) {
                throw error;
            }
            const code = error instanceof LinkError ? error.code : "expression";
            throw new LinkError(code, error instanceof Error ? error.message : String(error), source);
        }
    }
    /** Globals bind only exports/recipe symbols. Locals require their owning module identity. */
    resolve(name, module) {
        const key = JSON.stringify([module ?? null, name]);
        const cached = this.cache.get(key);
        if (cached !== undefined) {
            return cached;
        }
        if (this.active.has(key)) {
            throw new LinkError("symbol-cycle", `Cyclic symbol expression: ${[...this.stack, key].join(" -> ")}`);
        }
        if (this.stack.length >= 128) {
            throw new LinkError("symbol-depth", "Symbol dependency nesting exceeds 128.");
        }
        this.active.add(key);
        this.stack.push(key);
        try {
            let value;
            if (module !== undefined) {
                const symbol = this.modules.get(module)?.get(name);
                if (!symbol) {
                    throw new LinkError("unresolved-symbol", `Undefined local '${module}:${name}'.`);
                }
                if (symbol.visibility === "import") {
                    value = this.resolve(name);
                }
                else if (symbol.value) {
                    value = this.evaluate(symbol.value, symbol.source);
                }
                else {
                    throw new LinkError("unresolved-symbol", `Symbol '${module}:${name}' has no definition.`, symbol.source);
                }
            }
            else {
                const exported = this.exports.get(name);
                const recipe = this.recipeSymbols.get(name);
                if (exported) {
                    value = this.resolve(name, exported.module);
                }
                else if (recipe) {
                    value = this.recipeValue(recipe);
                }
                else {
                    throw new LinkError("unresolved-symbol", `Undefined external symbol '${name}'.`);
                }
            }
            this.cache.set(key, linkInteger(value));
            return value;
        }
        finally {
            this.stack.pop();
            this.active.delete(key);
        }
    }
    /** Resolve every selected definition/import, so hidden cycles or unused explicit imports cannot escape validation. */
    all() {
        const symbols = [];
        for (const [module, table] of this.modules) {
            for (const symbol of table.values()) {
                const value = this.resolve(symbol.name, module);
                if (symbol.visibility !== "import") {
                    symbols.push({
                        name: symbol.name,
                        module,
                        visibility: symbol.visibility,
                        value,
                        source: symbol.source,
                    });
                }
            }
        }
        for (const name of this.recipeSymbols.keys()) {
            symbols.push({ name, visibility: "recipe", value: this.resolve(name) });
        }
        return symbols;
    }
    recipeValue(symbol) {
        if ("expression" in symbol) {
            return this.evaluate(symbol.expression);
        }
        const allocations = this.bySection.get(symbol.section) ?? [];
        if (!allocations.length) {
            // A configured but unused optional section has zero extent at its selected region's beginning.
            const placement = this.recipe.placements.find((entry) => entry.section === symbol.section);
            if (!placement) {
                throw new LinkError("section-reference", `Recipe symbol '${symbol.name}' names an unconfigured section.`);
            }
            const region = this.recipe.regions.find((entry) => entry.name === (symbol.property === "load" ? placement.load : placement.run));
            if (!region) {
                throw new LinkError("section-reference", `Recipe symbol '${symbol.name}' has no region.`);
            }
            return symbol.property === "size" ? 0 : (placement.start ?? region.start);
        }
        const first = allocations[0];
        const last = allocations.at(-1);
        switch (symbol.property) {
            case "load":
                return first.loadAddress;
            case "run":
                return first.runAddress;
            case "size":
                return last.runAddress + last.size - first.runAddress;
            case "runEnd":
                return last.runAddress + last.size;
            default:
                throw new LinkError("section-reference", "Unknown derived symbol property.");
        }
    }
}
//# sourceMappingURL=symbols.js.map