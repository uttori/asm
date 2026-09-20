import { maximumAddressForWidth } from "../address-width.js";
import { setCommandKind } from "../ir/normalized-command.js";
import { DataStructEngine } from "./data-struct-engine.js";
export class StructEngine {
    host;
    data;
    constructor(host) {
        this.host = host;
        this.data = new DataStructEngine(host, this);
    }
    /**
     * Handles a struct mode command.
     * @param {NormalizedCommand} command The command to handle.
     * @returns {boolean} `true` if the command was handled, `false` otherwise.
     */
    handleStructMode(command) {
        const currentStruct = this.host.currentStruct;
        if (!currentStruct) {
            return false;
        }
        const { words } = command;
        const keyword = words[0] ?? "";
        if (keyword.startsWith(".")) {
            const hasColon = keyword.endsWith(":");
            const labelName = keyword.replace(/:$/, "").substring(1);
            const declaration = words.slice(1).join(" ");
            // oxlint-disable-next-line security/detect-unsafe-regex -- Width, spaces and bracketed count do not overlap.
            const typed = declaration.match(/^(db|dw|dl|dd)(?:\s*\[([^\]]+)])?$/i);
            if (typed) {
                const width = ["db", "dw", "dl", "dd"].indexOf(typed[1].toLowerCase()) + 1;
                const count = typed[2] === undefined ? 1 : this.host.operandResolver.getnum(typed[2]);
                if (!Number.isSafeInteger(count) || count < 1 || count * width > 0x10000) {
                    throw new Error(`Invalid array length for '${currentStruct.name}.${labelName}'.`);
                }
                if (currentStruct.labels.has(labelName)) {
                    throw new Error(`Duplicate typed field '${currentStruct.name}.${labelName}'.`);
                }
                (currentStruct.fields ??= new Map()).set(labelName, {
                    name: labelName,
                    offset: currentStruct.offset,
                    width,
                    count,
                    array: typed[2] !== undefined,
                });
            }
            else if (/^(db|dw|dl|dd)\b/i.test(declaration)) {
                throw new Error(`Invalid typed field '${currentStruct.name}.${labelName}': ${declaration}`);
            }
            currentStruct.labels.set(labelName, currentStruct.offset);
            this.host.recordSymbolDefinition("structMember", labelName, {
                value: currentStruct.offset,
                containerName: currentStruct.name,
            });
            if (typed) {
                const field = currentStruct.fields.get(labelName);
                currentStruct.offset += field.width * field.count;
            }
            else if (words[1]?.toLowerCase() === "skip") {
                if (words.length !== 3) {
                    throw new Error(`skip directive in struct requires exactly one parameter: ${words.length}`);
                }
                const skipAmount = this.host.operandResolver.getnum(words[2]);
                // Preserve skip's historical layout behavior. Initializers accept a
                // positive named skip only as an explicit list of raw bytes.
                if (Number.isSafeInteger(skipAmount) && skipAmount > 0) {
                    currentStruct.fields?.set(labelName, {
                        name: labelName,
                        offset: currentStruct.offset,
                        width: 1,
                        count: skipAmount,
                        array: true,
                    });
                }
                currentStruct.offset += skipAmount;
            }
            void hasColon;
            setCommandKind(command, "structCommand");
            return true;
        }
        if (keyword.toLowerCase() === "endstruct") {
            this.handleEndStruct(words);
            setCommandKind(command, "structCommand");
            return true;
        }
        setCommandKind(command, "structCommand");
        return true;
    }
    /**
     * Handles a struct command.
     * @param {string[]} words The words of the command.
     */
    handleStruct(words) {
        if (words.length < 2) {
            throw new Error("Struct definition requires at least two parameters.");
        }
        const structName = words[1];
        let base;
        let parent;
        if (words.length === 2) {
            base = 0;
        }
        else if (words[2].toLowerCase() === "extends") {
            if (words.length < 4) {
                throw new Error("Struct extension must specify a parent struct.");
            }
            parent = words[3];
            const parentStruct = this.host.structs.get(parent);
            if (!parentStruct) {
                throw new Error(`Parent struct '${parent}' not defined.`);
            }
            base = parentStruct.base;
        }
        else {
            base = this.host.operandResolver.getnum(words[2]);
            if (base < 0 || base > maximumAddressForWidth(this.host.addressWidth)) {
                throw new Error(`Invalid logical address for struct: ${words[2]}`);
            }
        }
        this.host.enterStructDefinition(base);
        this.host.currentStruct = {
            name: structName,
            base,
            offset: 0,
            size: 0,
            labels: new Map(),
            fields: new Map(),
            parent,
            extensionSize: 0,
        };
        this.host.recordSymbolDefinition("struct", structName, { value: base });
    }
    /**
     * Handles an endstruct command.
     * @param {string[]} words The words of the command.
     */
    handleEndStruct(words) {
        const currentStruct = this.host.currentStruct;
        if (!currentStruct) {
            throw new Error("endstruct encountered but not inside a struct definition.");
        }
        let align;
        let count;
        let first = 0;
        const seen = new Set();
        for (let index = 1; index < words.length; index += 2) {
            const option = words[index].toLowerCase();
            if (!["align", "count", "firstindex"].includes(option) ||
                seen.has(option) ||
                words[index + 1] === undefined) {
                if (words[1]?.toLowerCase() === "align") {
                    throw new Error("endstruct align requires a single alignment parameter.");
                }
                throw new Error("endstruct accepts [align value] [count value] [firstindex value].");
            }
            seen.add(option);
            const value = this.host.operandResolver.getnum(words[index + 1]);
            if (!Number.isSafeInteger(value) || value < (option === "firstindex" ? 0 : 1)) {
                throw new Error(option === "align" ? "Alignment must be at least 1." : `Invalid endstruct ${option}.`);
            }
            if (option === "align") {
                align = value;
            }
            else if (option === "count") {
                count = value;
            }
            else {
                first = value;
            }
        }
        if (seen.has("firstindex") && count === undefined) {
            throw new Error("endstruct firstindex requires count.");
        }
        if (count !== undefined) {
            if (!Number.isSafeInteger(first + count)) {
                throw new Error("Struct index range exceeds integer precision.");
            }
            currentStruct.indexRange = { first, count };
        }
        let finalSize = currentStruct.offset;
        if (align !== undefined) {
            finalSize = Math.ceil(finalSize / align) * align;
            currentStruct.align = align;
        }
        currentStruct.size = finalSize;
        if (currentStruct.parent) {
            const parentName = currentStruct.parent;
            const parentStruct = this.host.structs.get(parentName);
            if (!parentStruct) {
                throw new Error(`Parent struct '${parentName}' not defined.`);
            }
            const extSize = currentStruct.size;
            if (extSize > parentStruct.extensionSize) {
                parentStruct.extensionSize = extSize;
            }
            this.host.structs.set(`${parentName}.${currentStruct.name}`, currentStruct);
            this.host.structs.set(currentStruct.name, currentStruct);
        }
        else {
            this.host.structs.set(currentStruct.name, currentStruct);
        }
        this.host.restoreStructDefinition();
        this.host.currentStruct = null;
    }
    /**
     * Checks whether a reference starts with a known struct name.
     * @param {string} labelRef The reference to inspect.
     * @returns {boolean} Whether the reference belongs to a known struct.
     */
    hasStructReference(labelRef) {
        // Indices may be decimal (`obj[2]`) or asar hex (`DMA[$00].Parameters`).
        // oxlint-disable-next-line security/detect-unsafe-regex -- Anchored segments use non-overlapping separators.
        if (!/^[A-Z_a-z]\w*(?:\[[^\]]+])?(?:\.[A-Z_a-z]\w*(?:\[[^\]]+])?)*$/.test(labelRef)) {
            return false;
        }
        if (this.host.structs.has(labelRef)) {
            return true;
        }
        const dotIndex = labelRef.indexOf(".");
        const bracketIndex = labelRef.indexOf("[");
        let rootEnd = Math.min(dotIndex, bracketIndex);
        if (dotIndex === -1) {
            rootEnd = bracketIndex;
        }
        else if (bracketIndex === -1) {
            rootEnd = dotIndex;
        }
        const root = rootEnd === -1 ? labelRef : labelRef.slice(0, rootEnd);
        return root.length > 0 && this.host.structs.has(root);
    }
    /**
     * Resolves a struct label.
     * @param {string} labelRef The label to resolve.
     * @returns {number} The resolved address.
     */
    resolveStructLabel(labelRef) {
        const refParts = labelRef.split(".");
        if (refParts.length === 2 && !labelRef.includes("[")) {
            const parentName = refParts[0];
            const parentDef = this.host.structs.get(parentName);
            if (parentDef) {
                const extensionDef = this.host.structs.get(labelRef);
                if (extensionDef?.parent === parentName) {
                    return parentDef.base + parentDef.size;
                }
            }
        }
        const directStruct = this.host.structs.get(labelRef);
        if (directStruct) {
            return directStruct.base;
        }
        let arrayIndex = 0;
        let candidate = labelRef;
        let extraMember = "";
        // First `[...]` is the array index. Hardware-register structs use hex
        // (`DMA[$00].Parameters`). Decimal `obj[2]` still works via getnum.
        const arrayMatch = candidate.match(/^(.*?)\[([^\]]+)](.*)$/);
        if (arrayMatch) {
            candidate = arrayMatch[1];
            arrayIndex = this.host.operandResolver.getnum(arrayMatch[2]);
            extraMember = arrayMatch[3];
            if (extraMember.startsWith(".")) {
                extraMember = extraMember.substring(1);
            }
        }
        const parts = candidate.split(".");
        for (let i = parts.length; i >= 1; i--) {
            const potential = parts.slice(0, i).join(".");
            if (!this.host.structs.has(potential)) {
                continue;
            }
            const def = this.host.structs.get(potential);
            if (!def) {
                continue;
            }
            const memberPart = parts.slice(i).join(".");
            const memberName = memberPart + (extraMember ? (memberPart ? "." : "") + extraMember : "");
            const baseStructSize = def.size;
            let effectiveSize = baseStructSize;
            if (def.align) {
                effectiveSize = Math.ceil(baseStructSize / def.align) * def.align;
            }
            // Arrays of a parent struct must reserve enough room for whichever child
            // extension is largest, otherwise `parent[n].ext.member` resolves into
            // the wrong element once an extension increases the total record size.
            const maxExtensionSize = def.extensionSize;
            if (maxExtensionSize > 0) {
                effectiveSize += maxExtensionSize;
            }
            if (memberName.trim() === "") {
                if (arrayIndex !== 0) {
                    return def.base + arrayIndex * effectiveSize;
                }
                return def.base;
            }
            const memberParts = memberName.split(".");
            const topLevelMember = memberParts[0];
            if (!def.labels.has(topLevelMember)) {
                const childStruct = this.host.structs.get(topLevelMember);
                if (childStruct && childStruct.parent === potential) {
                    const childMemberName = memberParts.slice(1).join(".");
                    // Extended members such as `obj[19].ext.index` still live inside the
                    // parent array element. Reusing `ext[19].index` would scale by the
                    // extension size alone and drop the parent object stride.
                    const childReference = `${topLevelMember}${childMemberName ? `.${childMemberName}` : ""}`;
                    const childOffset = this.resolveStructLabel(childReference) - childStruct.base;
                    return def.base + arrayIndex * effectiveSize + childOffset;
                }
                throw new Error(`Member '${topLevelMember}' not defined in struct '${potential}'.`);
            }
            const offset = def.labels.get(topLevelMember);
            if (offset === undefined) {
                throw new Error(`Member '${topLevelMember}' not defined in struct '${potential}'.`);
            }
            let finalAddress;
            if (def.parent) {
                const parentDef = this.host.structs.get(def.parent);
                if (!parentDef) {
                    throw new Error(`Parent struct '${def.parent}' not defined for extension '${potential}'.`);
                }
                let parentSize = parentDef.size;
                if (parentDef.align) {
                    parentSize = Math.ceil(parentSize / parentDef.align) * parentDef.align;
                }
                if (arrayIndex === 0) {
                    finalAddress = parentDef.base + parentSize + offset;
                }
                else {
                    finalAddress = parentDef.base + parentSize + arrayIndex * def.size + offset;
                }
            }
            else {
                finalAddress = def.base + arrayIndex * effectiveSize + offset;
            }
            return finalAddress;
        }
        throw new Error(`Struct not defined in reference: ${labelRef}`);
    }
}
//# sourceMappingURL=struct-engine.js.map