import { checkedDeclaration, parseDeclarationNode, } from "../ir/declaration-node.js";
/**
 * Emits complete records through the normal writer (mapper, trace and debug
 * ownership included). The layout stage reserves the same width as emission.
 * Values and placement are checked at emission, once forward labels are known.
 * Array blocks own only sequencing state, never an independent write cursor.
 */
export class DataStructEngine {
    host;
    structs;
    table;
    constructor(host, structs) {
        this.host = host;
        this.structs = structs;
    }
    /** True while a dataStructs table block is open. */
    get inTable() {
        return this.table !== undefined;
    }
    /** Clears table sequencing state without validating row counts. */
    reset() {
        this.table = undefined;
    }
    /** Ensures no dataStructs table remains open at session end. */
    finish() {
        if (this.table) {
            throw new Error(`Missing endDataStructs for '${this.table.name}'.`);
        }
    }
    /** Bind a row's table name while retaining its parsed field values and source ranges. */
    bindRow(node) {
        if (!this.table) {
            throw new Error("dataStructs accepts only indexed records: [index] = { field = value }.");
        }
        return {
            kind: "dataStruct",
            reference: {
                name: this.table.name,
                index: node.index,
                text: `${this.table.name}[${node.indexText}]`,
            },
            fields: node.fields,
        };
    }
    /** Parses and opens a dataStructs table from directive words. */
    begin(words) {
        this.executeBegin(checkedDeclaration(parseDeclarationNode(words.join(" "), words)));
    }
    /** Enter a record table only after the referenced layout exists. */
    executeBegin(node) {
        if (this.table) {
            throw new Error("Nested dataStructs blocks are not supported.");
        }
        if (node?.kind !== "dataStructs" || !this.host.structs.has(node.name)) {
            throw new Error("dataStructs requires one previously defined struct name.");
        }
        this.table = { name: node.name, rows: 0 };
    }
    /** Closes the active table using the parsed end directive argument count. */
    end(words) {
        this.executeEnd(words.length - 1);
    }
    /** Closing a table checks its row invariant before releasing sequencing state. */
    executeEnd(argumentCount) {
        if (!this.table) {
            throw new Error("endDataStructs without dataStructs.");
        }
        if (argumentCount !== 0) {
            throw new Error("endDataStructs takes no arguments.");
        }
        if (this.table.rows === 0) {
            throw new Error("dataStructs must contain at least one record.");
        }
        this.table = undefined;
    }
    /**
     * Resolve an addressed record, keeping the established Asar index/stride rules.
     * @param reference Previously declared name with an unevaluated logical index.
     * @returns Layout and checked index.
     */
    resolveRecord(reference) {
        const definition = this.host.structs.get(reference.name);
        if (!definition) {
            throw new Error(`Unknown dataStruct record '${reference.text}'.`);
        }
        const index = reference.index === undefined ? 0 : this.host.operandResolver.getnum(reference.index);
        if (!Number.isSafeInteger(index) || index < 0) {
            throw new Error(`Invalid record index '${reference.text}'.`);
        }
        if (definition.indexRange) {
            const { first, count } = definition.indexRange;
            if (index < first || index >= first + count) {
                throw new Error(`Record index out of bounds: '${reference.text}'.`);
            }
        }
        return { definition, index };
    }
    fieldsFor(definition) {
        if (definition.parent || definition.extensionSize > 0) {
            throw new Error(`dataStruct does not initialize extended layouts ('${definition.name}'). Use raw data directives.`);
        }
        const fields = [...(definition.fields?.values() ?? [])].toSorted((a, b) => a.offset - b.offset);
        let end = 0;
        for (const field of fields) {
            if (field.offset !== end) {
                throw new Error(`Layout '${definition.name}' has overlapping or unnamed bytes. Name every byte before initialization.`);
            }
            end += field.width * field.count;
        }
        if (definition.align && end === definition.offset && end < definition.size) {
            if (definition.labels.has("__padding")) {
                throw new Error("The alignment padding name '__padding' is reserved.");
            }
            fields.push({
                name: "__padding",
                offset: end,
                width: 1,
                count: definition.size - end,
                array: true,
            });
            end = definition.size;
        }
        if (end !== definition.size || end < 1 || end > 0x10000) {
            throw new Error(`Layout '${definition.name}' must describe every byte and be between 1 and 65536 bytes.`);
        }
        return fields;
    }
    /** Emits one indexed struct row from parsed declaration words. */
    emit(words) {
        const node = checkedDeclaration(parseDeclarationNode(words.join(" "), words));
        if (node?.kind !== "dataStruct") {
            throw new Error("Expected dataStruct initializer.");
        }
        this.executeRecord(node);
    }
    /** Validate the entire typed record before committing bytes or field ownership. */
    executeRecord(node) {
        const reference = node.reference.text;
        const { definition, index } = this.resolveRecord(node.reference);
        const moduleBase = this.host.currentTargetBaseAddress - index * (definition.size + definition.extensionSize);
        this.host.recordModuleStructBase?.(definition.name, moduleBase);
        if (this.table?.next !== undefined && index !== this.table.next) {
            throw new Error(`Non-contiguous dataStructs index: expected ${this.table.next}, received ${index}.`);
        }
        const layout = this.fieldsFor(definition);
        const values = new Map(node.fields.map((field) => [field.name, field.value]));
        const names = new Set(layout.map((field) => field.name));
        for (const name of values.keys()) {
            if (!names.has(name)) {
                throw new Error(`Unknown initializer field '${definition.name}.${name}'.`);
            }
        }
        const bytes = [];
        const symbolic = [];
        const fields = [];
        for (const field of layout) {
            const value = values.get(field.name);
            const name = `${reference}.${field.name}`;
            if (value === undefined) {
                throw new Error(`Missing initializer field '${name}'.`);
            }
            if (field.array !== Array.isArray(value)) {
                throw new Error(`Field '${name}' requires ${field.array ? "an array" : "a scalar"}.`);
            }
            const items = Array.isArray(value) ? value : [value];
            if (items.length !== field.count) {
                throw new Error(`Field '${name}' requires ${field.count} value(s), received ${items.length}.`);
            }
            if (!this.host.canEmitBytes) {
                continue;
            }
            for (const [itemIndex, item] of items.entries()) {
                const expression = item.text;
                if (this.host.moduleIdentity !== undefined && this.host.compileLinkExpression) {
                    const compiled = this.host.compileLinkExpression(item.expression);
                    if (compiled.kind === "constant" &&
                        (compiled.value < 0 || compiled.value >= 2 ** (8 * field.width))) {
                        throw new Error(`Value '${expression}' for '${name}' does not fit an unsigned ${field.width * 8}-bit field.`);
                    }
                    if (field.width !== 1 && field.width !== 2 && field.width !== 3 && field.width !== 4) {
                        throw new Error("Symbolic struct fields require widths from 1 through 4.");
                    }
                    symbolic.push({ expression: compiled, width: field.width });
                    fields.push({
                        reference: field.array ? `${name}[${itemIndex}]` : name,
                        expression,
                        offset: bytes.length,
                        width: field.width,
                    });
                    bytes.push(...Array.from({ length: field.width }, () => 0));
                    continue;
                }
                const number = this.host.operandResolver.getnum(item.expression);
                if (!Number.isSafeInteger(number) || number < 0 || number >= 2 ** (8 * field.width)) {
                    throw new Error(`Value '${expression}' for '${name}' does not fit an unsigned ${field.width * 8}-bit field.`);
                }
                if (this.host.recordStructField) {
                    fields.push({
                        reference: field.array ? `${name}[${itemIndex}]` : name,
                        expression,
                        offset: bytes.length,
                        width: field.width,
                    });
                }
                for (let byte = 0; byte < field.width; byte++) {
                    bytes.push(Math.floor(number / 2 ** (8 * byte)) & 0xff);
                }
            }
        }
        if (this.host.canEmitBytes) {
            const expected = definition.base + index * (definition.size + definition.extensionSize);
            if (this.host.moduleIdentity === undefined &&
                this.host.currentTargetBaseAddress !== expected) {
                throw new Error(`dataStruct '${reference}' requires pc() == $${expected.toString(16).toUpperCase()}, received $${this.host.currentTargetBaseAddress.toString(16).toUpperCase()}.`);
            }
            // Validate the complete record before writing any byte of it.
            for (const field of fields) {
                this.host.recordStructField?.(field.reference, field.expression, field.offset, field.width);
            }
            if (this.host.moduleIdentity !== undefined && this.host.writeRelocation) {
                for (const field of symbolic) {
                    this.host.writeRelocation(field.expression, { width: field.width, minimum: 0 });
                }
            }
            else {
                this.host.outputWriter.writeBytes(bytes);
            }
        }
        else {
            this.host.outputWriter.step(definition.size);
        }
        if (this.table) {
            this.table.next = index + 1;
            this.table.rows++;
        }
    }
}
//# sourceMappingURL=data-struct-engine.js.map