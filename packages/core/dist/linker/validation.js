import { integer, isRecord, list, record, textValue } from "./value.js";
const binaryOperators = new Set([
    "+",
    "-",
    "*",
    "/",
    "%",
    "**",
    "<<",
    ">>",
    "&",
    "|",
    "^",
    "<",
    ">",
    "<=",
    ">=",
    "=",
    "==",
    "!=",
    "&&",
    "||",
]);
const unaryOperators = new Set(["-", "~", "low", "high", "bank"]);
/** Bound expression depth and node count before recursive linking; arbitrary object tags are never executable. */
export function assertLinkExpression(value, depth = 0, budget = { nodes: 0 }) {
    if (depth > 128 || ++budget.nodes > 100000) {
        throw new Error("Link expression exceeds nesting/node limits.");
    }
    const node = record(value, "Link expression");
    switch (node.kind) {
        case "constant":
            integer(node.value, "Link constant", -Number.MAX_SAFE_INTEGER);
            return;
        case "symbol":
            textValue(node.name, "Symbol name");
            if (node.module !== undefined) {
                textValue(node.module, "Symbol module");
            }
            return;
        case "section":
            textValue(node.module, "Section module");
            textValue(node.section, "Section name");
            integer(node.offset, "Section offset", 0, 0x1000000);
            return;
        case "unary":
            if (!unaryOperators.has(String(node.operator))) {
                throw new Error("Unknown unary link operator.");
            }
            assertLinkExpression(node.argument, depth + 1, budget);
            return;
        case "binary":
            if (!binaryOperators.has(String(node.operator))) {
                throw new Error("Unknown binary link operator.");
            }
            assertLinkExpression(node.left, depth + 1, budget);
            assertLinkExpression(node.right, depth + 1, budget);
            return;
        default:
            throw new Error("Unknown link expression kind.");
    }
}
/** Syntax metadata is deliberately JSON-only; functions and session-owned state cannot cross the object boundary. */
function syntaxValue(value, depth = 0) {
    if (depth > 128) {
        throw new Error("Syntax metadata exceeds nesting limit.");
    }
    if (value === null ||
        typeof value === "string" ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value))) {
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item) => syntaxValue(item, depth + 1));
        return;
    }
    if (isRecord(value) && Object.getPrototypeOf(value) === Object.prototype) {
        Object.values(value).forEach((item) => syntaxValue(item, depth + 1));
        return;
    }
    throw new Error("Invalid syntax metadata.");
}
/** Validates source-location records embedded in link metadata. */
function source(value) {
    const node = record(value, "Source occurrence");
    textValue(node.file, "Source file");
    textValue(node.architecture, "Source architecture");
    integer(node.line, "Source line", 1);
}
/** Validate all externally supplied records, cross-section extents, and non-overlapping fixup ownership. */
export function assertAssemblyModule(input) {
    const module = record(input, "Assembly module");
    textValue(module.id, "Module identity");
    textValue(module.target, "Target");
    record(module.targetOptions, "Target options");
    const sections = new Map();
    for (const item of list(module.sections, "Sections")) {
        const section = record(item, "Section");
        const name = textValue(section.name, "Section name");
        if (sections.has(name)) {
            throw new Error(`Duplicate section '${name}'.`);
        }
        if (!["code", "data", "bss"].includes(String(section.kind))) {
            throw new Error("Invalid section kind.");
        }
        const size = integer(section.size, "Section size", 0, 0x1000000);
        integer(section.alignment, "Section alignment", 1, 0x1000000);
        textValue(section.addressSpace, "Section address space");
        if (!(section.bytes instanceof Uint8Array) ||
            section.bytes.length !== (section.kind === "bss" ? 0 : size)) {
            throw new Error(`Section '${name}' payload extent mismatch.`);
        }
        sections.set(name, { size, bss: section.kind === "bss" });
    }
    const expression = (value) => {
        assertLinkExpression(value);
        const own = (node) => {
            if ((node.kind === "symbol" || node.kind === "section") &&
                node.module !== undefined &&
                node.module !== module.id) {
                throw new Error("Module expressions cannot reference another module's private namespace.");
            }
            if (node.kind === "section" &&
                (!sections.has(node.section) || node.offset > sections.get(node.section).size)) {
                throw new Error("Expression refers outside its owning section.");
            }
            if (node.kind === "unary") {
                own(node.argument);
            }
            if (node.kind === "binary") {
                own(node.left);
                own(node.right);
            }
        };
        own(value);
    };
    const position = (node, size) => {
        const name = textValue(node.section, "Section reference");
        const section = sections.get(name);
        const offset = integer(node.offset, "Section offset");
        if (!section || offset + size > section.size) {
            throw new Error(`Record outside section '${name}'.`);
        }
        return name;
    };
    const names = new Set();
    for (const item of list(module.symbols, "Symbols")) {
        const symbol = record(item, "Symbol");
        const name = textValue(symbol.name, "Symbol name");
        if (names.has(name)) {
            throw new Error(`Duplicate symbol '${name}'.`);
        }
        names.add(name);
        source(symbol.source);
        if (!["local", "export", "import"].includes(String(symbol.visibility))) {
            throw new Error("Invalid symbol visibility.");
        }
        if (symbol.visibility === "import") {
            if (symbol.value !== undefined) {
                throw new Error("An import cannot define a value.");
            }
        }
        else {
            expression(symbol.value);
        }
    }
    const writes = new Map();
    for (const item of list(module.fixups, "Fixups")) {
        const fixup = record(item, "Fixup");
        const encoding = record(fixup.encoding, "Relocation encoding");
        const width = integer(encoding.width, "Field width", 1, 4);
        const name = position(fixup, width);
        if (sections.get(name)?.bss) {
            throw new Error("BSS cannot contain a fixup.");
        }
        source(fixup.source);
        expression(fixup.expression);
        if (encoding.kind !== undefined &&
            (typeof encoding.kind !== "string" ||
                !["absolute", "relative", "programBank", "dataBank", "directPage", "upperPage"].includes(encoding.kind))) {
            throw new Error("Unknown relocation kind.");
        }
        if (encoding.endianness !== undefined &&
            encoding.endianness !== "little" &&
            encoding.endianness !== "big") {
            throw new Error("Unknown relocation endianness.");
        }
        for (const key of ["signed", "truncate"]) {
            if (encoding[key] !== undefined && typeof encoding[key] !== "boolean") {
                throw new Error(`Invalid ${key} flag.`);
            }
        }
        for (const key of ["minimum", "maximum"]) {
            if (encoding[key] !== undefined) {
                integer(encoding[key], key, -Number.MAX_SAFE_INTEGER);
            }
        }
        for (const key of ["addressWidth", "wrapWidth"]) {
            if (encoding[key] !== undefined) {
                integer(encoding[key], key, 1, 52);
            }
        }
        if (encoding.alignment !== undefined) {
            integer(encoding.alignment, "Field alignment", 1);
        }
        if (encoding.constraint !== undefined && encoding.constraint !== "powerOfTwo") {
            throw new Error("Unknown relocation constraint.");
        }
        if (encoding.kind === "relative" && encoding.pc === undefined) {
            throw new Error("Relative fixup requires a PC basis.");
        }
        if (encoding.pc !== undefined) {
            position(record(encoding.pc, "PC basis"), 0);
        }
        if (encoding.state !== undefined) {
            syntaxValue(encoding.state);
        }
        for (const rule of list(encoding.checks ?? [], "Relocation checks")) {
            const check = record(rule, "Relocation check");
            expression(check.expression);
            for (const key of ["minimum", "maximum"]) {
                if (check[key] !== undefined) {
                    integer(check[key], key, -Number.MAX_SAFE_INTEGER);
                }
            }
            if (check.alignment !== undefined) {
                integer(check.alignment, "Check alignment", 1);
            }
        }
        const ranges = writes.get(name) ?? [];
        const start = integer(fixup.offset, "Fixup offset");
        ranges.push({ start, end: start + width });
        writes.set(name, ranges);
    }
    // Sort intervals once instead of allocating a byte-sized ownership bitmap for every section.
    for (const ranges of writes.values()) {
        ranges.sort((a, b) => a.start - b.start);
        for (let i = 1; i < ranges.length; i++) {
            if (ranges[i].start < ranges[i - 1].end) {
                throw new Error("Overlapping relocation fields.");
            }
        }
    }
    for (const key of ["ranges", "fields", "assets", "instructions"]) {
        for (const item of list(module[key], key)) {
            const node = record(item, key);
            source(node.source);
            position(node, integer(node.size, `${key} size`));
            if (key === "ranges" &&
                !["instruction", "data", "asset", "reservation"].includes(String(node.kind))) {
                throw new Error("Invalid range kind.");
            }
            if (key === "fields") {
                textValue(node.reference, "Field reference");
                textValue(node.expression, "Field expression");
            }
            if (key === "assets") {
                textValue(node.inputPath, "Asset input");
                textValue(node.format, "Asset format");
                textValue(node.part, "Asset part");
                if (node.conversion !== undefined) {
                    syntaxValue(node.conversion);
                }
                if (node.inputStart !== undefined) {
                    integer(node.inputStart, "Asset input start");
                }
                if (node.inputEnd !== undefined) {
                    integer(node.inputEnd, "Asset input end");
                }
            }
            if (key === "instructions") {
                textValue(node.form, "Instruction form");
                syntaxValue(node.state);
            }
            if (node.details !== undefined) {
                syntaxValue(node.details);
            }
        }
    }
    const dependencies = new Set();
    for (const item of list(module.dependencies, "Dependencies")) {
        const dependency = record(item, "Dependency");
        const path = textValue(dependency.path, "Dependency path");
        if (dependencies.has(path)) {
            throw new Error("Duplicate dependency identity.");
        }
        dependencies.add(path);
        if (dependency.size !== undefined) {
            integer(dependency.size, "Dependency size");
        }
        if (dependency.crc32 !== undefined) {
            integer(dependency.crc32, "Dependency CRC32", 0, 0xffffffff);
        }
        if (typeof dependency.sha256 !== "string" || !/^[\da-f]{64}$/.test(dependency.sha256)) {
            throw new Error("Dependency SHA-256 is invalid.");
        }
    }
}
//# sourceMappingURL=validation.js.map