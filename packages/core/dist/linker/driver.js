import { AddressToLineMapping } from "../addressToLine.js";
import { createDebugMap } from "../debug-map.js";
import { allocateSections } from "./layout.js";
import { decodeLibrary } from "./library.js";
import { decodeObject } from "./object.js";
import { assertLinkRecipe } from "./recipe.js";
import { applyRelocations } from "./relocations.js";
import { allocationKey, LinkSymbols } from "./symbols.js";
import { LinkError } from "./types.js";
import { artifactHash, stableJson } from "./value.js";
export const LINKER_VERSION = "1";
/** Resolve libraries, allocate contributions, patch fields, finalize once, and produce matching owned artifacts. */
export function linkObjects(options) {
    options.signal?.throwIfAborted();
    assertLinkRecipe(options.recipe);
    if (options.toolchainSha256 !== undefined && !/^[a-f0-9]{64}$/.test(options.toolchainSha256)) {
        throw new LinkError("toolchain-identity", "Toolchain identity must be a SHA-256 digest.");
    }
    const recipe = structuredClone(options.recipe);
    const objects = options.objects.map((bytes) => Uint8Array.from(bytes));
    const archives = (options.libraries ?? []).map((bytes) => Uint8Array.from(bytes));
    const modules = objects.map(decodeObject);
    const libraries = archives.map(decodeLibrary);
    const exports = new Map();
    const moduleIds = new Set();
    const pending = [];
    const requested = new Set();
    const globals = new Set((recipe.symbols ?? []).map((symbol) => symbol.name));
    const request = (name) => {
        if (!requested.has(name)) {
            requested.add(name);
            pending.push(name);
        }
    };
    const accept = (module) => {
        if (module.target !== recipe.target) {
            throw new LinkError("target-mismatch", `Module '${module.id}' targets '${module.target}', recipe targets '${recipe.target}'.`);
        }
        if (moduleIds.has(module.id)) {
            throw new LinkError("duplicate-module", `Duplicate module identity '${module.id}'.`);
        }
        moduleIds.add(module.id);
        for (const symbol of module.symbols) {
            if (symbol.value) {
                externalNames(symbol.value, request);
            }
            if (symbol.visibility === "import") {
                request(symbol.name);
            }
            if (symbol.visibility !== "export") {
                continue;
            }
            if (exports.has(symbol.name) || globals.has(symbol.name)) {
                throw new LinkError("duplicate-symbol", `Duplicate global '${symbol.name}' from '${exports.get(symbol.name) ?? "recipe"}' and '${module.id}'.`, symbol.source);
            }
            exports.set(symbol.name, module.id);
        }
        for (const fixup of module.fixups) {
            externalNames(fixup.expression, request);
            for (const check of fixup.encoding.checks ?? []) {
                externalNames(check.expression, request);
            }
        }
    };
    modules.forEach(accept);
    for (const symbol of recipe.symbols ?? []) {
        if ("expression" in symbol) {
            externalNames(symbol.expression, request);
        }
    }
    for (const assertion of recipe.assertions ?? []) {
        externalNames(assertion.expression, request);
    }
    const providers = new Map();
    libraries.forEach((library, libraryIndex) => {
        for (const [name, members] of library.index) {
            if (!providers.has(name)) {
                providers.set(name, { library: libraryIndex, member: members[0] });
            }
        }
    });
    const selectedMembers = [];
    // A work queue reaches a fixed point across archives, including cyclic/inter-library imports.
    // The merged index preserves first-provider order and avoids scanning every library per request.
    for (const name of pending) {
        options.signal?.throwIfAborted();
        if (exports.has(name) || globals.has(name)) {
            continue;
        }
        const provider = providers.get(name);
        if (!provider) {
            const importer = modules
                .flatMap((module) => module.symbols)
                .find((symbol) => symbol.visibility === "import" && symbol.name === name);
            throw new LinkError("unresolved-symbol", `No object or library exports '${name}'.`, importer?.source);
        }
        const member = libraries[provider.library].members[provider.member];
        accept(member.module);
        modules.push(member.module);
        selectedMembers.push({
            library: provider.library,
            name: member.name,
            module: member.module.id,
            sha256: member.sha256,
        });
    }
    options.signal?.throwIfAborted();
    const layout = allocateSections(modules, recipe);
    const symbols = new LinkSymbols(modules, recipe, layout.allocations);
    const finalSymbols = symbols.all();
    for (const assertion of recipe.assertions ?? []) {
        if (symbols.evaluate(assertion.expression) === 0) {
            throw new LinkError("assertion", assertion.message);
        }
    }
    applyRelocations(layout.output, modules, recipe, symbols);
    const policy = options.target;
    if (policy && policy.target !== recipe.target) {
        throw new LinkError("target-mismatch", "Link target policy does not match the recipe.");
    }
    policy?.validate?.(modules, recipe, layout.allocations);
    if (recipe.checksumPolicy === "recompute") {
        if (!policy?.finalize) {
            throw new LinkError("target-finalization", "Checksum recomputation requires an explicit target finalizer.");
        }
        policy.finalize(layout.output, recipe);
    }
    options.signal?.throwIfAborted();
    const inputSha256 = artifactHash(stableJson({
        version: LINKER_VERSION,
        toolchainSha256: options.toolchainSha256 ?? null,
        objects: objects.map(artifactHash),
        libraries: archives.map(artifactHash),
        recipe,
        target: policy
            ? { target: policy.target, revision: policy.revision, options: policy.options ?? {} }
            : null,
    }));
    return {
        output: layout.output,
        debugMap: linkedDebugMap(modules, symbols, layout.output, recipe.target),
        inputSha256,
        symbols: finalSymbols,
        allocations: layout.allocations,
        regions: layout.regions,
        selectedMembers,
        dependencies: modules.flatMap((module) => module.dependencies.map((dependency) => ({ module: module.id, ...dependency }))),
    };
}
/** Library reachability includes recipe expressions; module-local leaves never select archive members. */
function externalNames(expression, accept) {
    if (expression.kind === "symbol" && expression.module === undefined) {
        accept(expression.name);
    }
    if (expression.kind === "unary") {
        externalNames(expression.argument, accept);
    }
    if (expression.kind === "binary") {
        externalNames(expression.left, accept);
        externalNames(expression.right, accept);
    }
}
/** Build the existing debugger format entirely from object receipts, without reading source paths again. */
function linkedDebugMap(modules, symbols, output, target) {
    const mapping = new AddressToLineMapping();
    const sourceIds = new Map();
    const dependencies = new Map(modules.map((module) => [
        module.id,
        new Map(module.dependencies.map((input) => [input.path, input])),
    ]));
    const sourceId = (module, path) => {
        const key = allocationKey(module.id, path);
        let id = sourceIds.get(key);
        if (id === undefined) {
            const dependency = dependencies.get(module.id)?.get(path);
            if (!dependency) {
                throw new LinkError("source-metadata", `Module '${module.id}' has no dependency receipt for '${path}'.`);
            }
            id = mapping.fileList.length;
            mapping.fileList.push({
                name: path,
                sha256: dependency.sha256,
                size: dependency.size ?? 0,
                crc: dependency.crc32 ?? 0,
            });
            sourceIds.set(key, id);
        }
        return id;
    };
    for (const module of modules) {
        for (const dependency of module.dependencies) {
            sourceId(module, dependency.path);
        }
        for (const range of module.ranges) {
            const allocation = symbols.allocations.get(allocationKey(module.id, range.section));
            mapping.ranges.push({
                fileIdx: sourceId(module, range.source.file),
                line: range.source.line,
                architecture: range.source.architecture,
                addressSpace: allocation.addressSpace,
                start: allocation.runAddress + range.offset,
                end: allocation.runAddress + range.offset + range.size,
                ...(allocation.outputOffset === undefined
                    ? {}
                    : {
                        outputStart: allocation.outputOffset + range.offset,
                        outputEnd: allocation.outputOffset + range.offset + range.size,
                    }),
            });
        }
        const fixups = new Map();
        for (const fixup of module.fixups) {
            const entries = fixups.get(fixup.section) ?? [];
            entries.push(fixup);
            fixups.set(fixup.section, entries);
        }
        for (const entries of fixups.values()) {
            entries.sort((a, b) => a.offset - b.offset);
        }
        for (const instruction of module.instructions) {
            const allocation = symbols.allocations.get(allocationKey(module.id, instruction.section));
            mapping.instructions.push({
                fileIdx: sourceId(module, instruction.source.file),
                line: instruction.source.line,
                architecture: instruction.source.architecture,
                addressSpace: allocation.addressSpace,
                address: allocation.runAddress + instruction.offset,
                size: instruction.size,
                form: instruction.form,
                operands: instructionOperands(fixups.get(instruction.section) ?? [], instruction.offset, instruction.size, symbols),
                state: instruction.state,
                ...(allocation.outputOffset === undefined
                    ? {}
                    : { outputOffset: allocation.outputOffset + instruction.offset }),
            });
        }
        for (const field of module.fields) {
            const allocation = symbols.allocations.get(allocationKey(module.id, field.section));
            if (allocation.outputOffset === undefined) {
                continue;
            }
            mapping.structFields.push({
                fileIdx: sourceId(module, field.source.file),
                line: field.source.line,
                reference: field.reference,
                expression: field.expression,
                size: field.size,
                outputOffset: allocation.outputOffset + field.offset,
                address: allocation.runAddress + field.offset,
                architecture: field.source.architecture,
                addressSpace: allocation.addressSpace,
            });
        }
        for (const asset of module.assets) {
            const allocation = symbols.allocations.get(allocationKey(module.id, asset.section));
            mapping.assets.push({
                fileIdx: sourceId(module, asset.source.file),
                assetFileIdx: sourceId(module, asset.inputPath),
                line: asset.source.line,
                address: allocation.runAddress + asset.offset,
                size: asset.size,
                ...(asset.inputStart !== undefined ? { inputStart: asset.inputStart } : {}),
                ...(asset.inputEnd !== undefined ? { inputEnd: asset.inputEnd } : {}),
                format: asset.format,
                part: asset.part,
                transforms: asset.conversion?.transforms.map((transform) => transform.id) ?? [],
                ...(asset.conversion ? { conversion: asset.conversion } : {}),
                ...(allocation.outputOffset === undefined
                    ? {}
                    : { outputOffset: allocation.outputOffset + asset.offset }),
            });
        }
    }
    return createDebugMap({ target, output, mapping });
}
/** Binary search keeps operand attribution bounded when a section contains many data-table relocations. */
function instructionOperands(fixups, start, size, symbols) {
    let low = 0, high = fixups.length;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (fixups[middle].offset < start) {
            low = middle + 1;
        }
        else {
            high = middle;
        }
    }
    const result = [];
    for (let index = low; index < fixups.length && fixups[index].offset < start + size; index++) {
        const fixup = fixups[index];
        result.push({
            expression: expressionDisplay(fixup.expression),
            value: symbols.evaluate(fixup.expression, fixup.source),
        });
    }
    return result;
}
/** This spelling is display-only; the linker executes typed records, never generated expression text. */
function expressionDisplay(expression) {
    switch (expression.kind) {
        case "constant":
            return String(expression.value);
        case "symbol":
            return expression.name;
        case "section":
            return `${expression.module}:${expression.section}+$${expression.offset.toString(16)}`;
        case "unary":
            return `${expression.operator}(${expressionDisplay(expression.argument)})`;
        case "binary":
            return `(${expressionDisplay(expression.left)} ${expression.operator} ${expressionDisplay(expression.right)})`;
        default:
            throw new LinkError("expression", "Unknown expression in debug metadata.");
    }
}
//# sourceMappingURL=driver.js.map