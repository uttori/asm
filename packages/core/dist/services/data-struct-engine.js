import { setCommandWords } from "../ir/normalized-command.js";
import { splitCommandIntoWords } from "./command-text-service.js";
import { parseStructInitializer, splitInitializerList } from "./struct-initializer.js";
/**
 * Emits complete records through the normal writer (mapper, trace and debug
 * ownership included). The layout stage reserves the same width as emission;
 * values and placement are checked at emission, once forward labels are known.
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
    get inTable() {
        return this.table !== undefined;
    }
    reset() {
        this.table = undefined;
    }
    finish() {
        if (this.table)
            throw new Error(`Missing endDataStructs for '${this.table.name}'.`);
    }
    /**
     * Rewrite a row into a normal directive so it retains source/trace ownership.
     * @param {NormalizedCommand} command Per-dispatch mutable command, never the cached node.
     */
    prepareRow(command) {
        const text = command.command.trim();
        if (/^enddatastructs\b/i.test(text))
            return;
        const match = text.match(/^\[([^\]]+)]\s*=\s*({.*})$/s);
        if (!this.table || !match) {
            throw new Error("dataStructs accepts only indexed records: [index] = { field = value }.");
        }
        const rewritten = `dataStruct ${this.table.name}[${match[1]}], ${match[2]}`;
        setCommandWords(command, splitCommandIntoWords(rewritten), rewritten);
    }
    begin(words) {
        if (this.table)
            throw new Error("Nested dataStructs blocks are not supported.");
        if (words.length !== 2 || !this.host.structs.has(words[1])) {
            throw new Error("dataStructs requires one previously defined struct name.");
        }
        this.table = { name: words[1], rows: 0 };
    }
    end(words) {
        if (!this.table)
            throw new Error("endDataStructs without dataStructs.");
        if (words.length !== 1)
            throw new Error("endDataStructs takes no arguments.");
        if (this.table.rows === 0)
            throw new Error("dataStructs must contain at least one record.");
        this.table = undefined;
    }
    /**
     * Resolve an addressed record, keeping the established Asar index/stride rules.
     * @param {string} reference Previously declared name with an optional logical index.
     * @returns {{ definition: StructDefinition; index: number }} Layout and checked index.
     */
    resolveRecord(reference) {
        // oxlint-disable-next-line security/detect-unsafe-regex -- Name and index have disjoint delimiters.
        const match = reference.match(/^([A-Z_a-z][\w.]*)(?:\[([^\]]+)])?$/);
        const definition = match && this.host.structs.get(match[1]);
        if (!match || !definition)
            throw new Error(`Unknown dataStruct record '${reference}'.`);
        const index = match[2] === undefined ? 0 : this.host.operandResolver.getnum(match[2]);
        if (!Number.isSafeInteger(index) || index < 0)
            throw new Error(`Invalid record index '${reference}'.`);
        if (definition.indexRange) {
            const { first, count } = definition.indexRange;
            if (index < first || index >= first + count)
                throw new Error(`Record index out of bounds: '${reference}'.`);
        }
        return { definition, index };
    }
    fieldsFor(definition) {
        if (definition.parent || definition.extensionSize > 0) {
            throw new Error(`dataStruct does not initialize extended layouts ('${definition.name}'); use raw data directives.`);
        }
        const fields = [...(definition.fields?.values() ?? [])].sort((a, b) => a.offset - b.offset);
        let end = 0;
        for (const field of fields) {
            if (field.offset !== end)
                throw new Error(`Layout '${definition.name}' has overlapping or unnamed bytes; name every byte before initialization.`);
            end += field.width * field.count;
        }
        if (definition.align && end === definition.offset && end < definition.size) {
            if (definition.labels.has("__padding"))
                throw new Error("The alignment padding name '__padding' is reserved.");
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
    emit(words) {
        const args = splitInitializerList(words.slice(1).join(" "));
        if (args.length !== 2)
            throw new Error("dataStruct syntax: dataStruct Record[index], { field = value }.");
        const [reference, literal] = args;
        const { definition, index } = this.resolveRecord(reference);
        if (this.table?.next !== undefined && index !== this.table.next) {
            throw new Error(`Non-contiguous dataStructs index: expected ${this.table.next}, received ${index}.`);
        }
        const layout = this.fieldsFor(definition);
        const values = parseStructInitializer(literal);
        const names = new Set(layout.map((field) => field.name));
        for (const name of values.keys()) {
            if (!names.has(name))
                throw new Error(`Unknown initializer field '${definition.name}.${name}'.`);
        }
        const bytes = [];
        for (const field of layout) {
            const value = values.get(field.name);
            const name = `${reference}.${field.name}`;
            if (value === undefined)
                throw new Error(`Missing initializer field '${name}'.`);
            if (field.array !== Array.isArray(value))
                throw new Error(`Field '${name}' requires ${field.array ? "an array" : "a scalar"}.`);
            const items = typeof value === "string" ? [value] : value;
            if (items.length !== field.count)
                throw new Error(`Field '${name}' requires ${field.count} value(s), received ${items.length}.`);
            if (!this.host.canEmitBytes)
                continue;
            for (const expression of items) {
                const number = this.host.operandResolver.getnum(expression);
                if (!Number.isSafeInteger(number) || number < 0 || number >= 2 ** (8 * field.width)) {
                    throw new Error(`Value '${expression}' for '${name}' does not fit an unsigned ${field.width * 8}-bit field.`);
                }
                for (let byte = 0; byte < field.width; byte++)
                    bytes.push(Math.floor(number / 2 ** (8 * byte)) & 0xff);
            }
        }
        if (this.host.canEmitBytes) {
            const expected = this.structs.resolveStructLabel(reference);
            if (this.host.currentTargetBaseAddress !== expected) {
                throw new Error(`dataStruct '${reference}' requires pc() == $${expected.toString(16).toUpperCase()}, received $${this.host.currentTargetBaseAddress.toString(16).toUpperCase()}.`);
            }
            // Validate the complete record before writing any byte of it.
            this.host.outputWriter.writeBytes(bytes);
        }
        else
            this.host.outputWriter.step(definition.size);
        if (this.table) {
            this.table.next = index + 1;
            this.table.rows++;
        }
    }
}
//# sourceMappingURL=data-struct-engine.js.map