import { normalizeAddressForWidth } from "../address-width.js";
import { bindDataOperand, parseDataList } from "../ir/data-node.js";
import { parseDeclarationNode } from "../ir/declaration-node.js";
import { parseDirectiveExpression } from "../ir/directive-arguments.js";
import { literalDataOperands } from "../ir/statement-node.js";
/** Shared directive handlers for org, data, and character mapping commands. */
export class DirectiveRuntimeService {
    host;
    constructor(host) {
        this.host = host;
    }
    /**
     * Handles character mapping like `"A" = 0x42` and assigns the value to the character in `characterMappings`.
     * @param words The character mapping command words.
     * @throws {Error} If the format is incorrect.
     */
    handleCharacterMapping(words) {
        // This public token entry preserves its arity diagnostic before invoking the shared grammar.
        if (words.length !== 3) {
            throw new Error("Character mapping requires format: 'char' = value");
        }
        const declaration = parseDeclarationNode(words.join(" "), words);
        if (declaration?.kind === "invalid") {
            throw new Error(declaration.message);
        }
        if (declaration?.kind !== "character") {
            throw new Error("Character mapping requires format: 'char' = value");
        }
        const value = this.host.operandResolver.getnum(declaration.expression);
        this.host.characterMappings.set(declaration.character, value);
    }
    /**
     * Processes a string and maps characters to their corresponding values in `characterMappings`.
     * If a character is not found in `characterMappings`, its charCode is used instead.
     * @param input The string to process.
     * @returns An array of numbers representing the mapped characters.
     */
    processStringWithMapping(input) {
        return Array.from(input).map((char) => this.host.characterMappings.get(char) ?? char.charCodeAt(0));
    }
    /**
     * Handles `org`.
     * @param params The directive parameters.
     */
    handleOrg(params) {
        if (params.length !== 1) {
            throw new Error("ORG requires a single address parameter.");
        }
        this.executeOrg(parseDirectiveExpression(params[0], false), params[0]);
    }
    /** ORG uses mathematical evaluation, including grouped fractions, before checking the target range. */
    executeOrg(expression, spelling) {
        let address;
        try {
            address = this.host.operandResolver.deps.evaluateMath(expression);
        }
        catch {
            throw new Error(`Invalid ORG address: ${spelling}`);
        }
        if (Number.isNaN(address) || address < 0 || address > 2 ** this.host.addressWidth - 1) {
            throw new Error(`Invalid ORG address: ${spelling}`);
        }
        this.host.setWritePosition(address);
    }
    /**
     * Handles data directives.
     * @param type The data directive keyword.
     * @param params The directive parameters.
     */
    handleDataDirective(type, params, numeric) {
        if (!Array.isArray(params) || params.length === 0) {
            throw new Error(`${type.toUpperCase()} directive requires at least one parameter.`);
        }
        // Support SNASM-style aliases while keeping one canonical byte-width table.
        if (type.toLowerCase() === "dc.b") {
            type = "db";
        }
        else if (type.toLowerCase() === "dc.w") {
            type = "dw";
        }
        else if (type.toLowerCase() === "dc.l") {
            type = "dl";
        }
        const lengthMap = {
            db: 1,
            dw: 2,
            dl: 3,
            dd: 4,
        };
        const len = lengthMap[type.toLowerCase()];
        if (!len) {
            throw new Error(`Invalid data directive: ${type}`);
        }
        const statement = numeric ?? {
            width: len,
            operands: parseDataList(params.join(" ")),
        };
        this.executeDataStatement(statement);
    }
    /** Resolve each element at its write cursor; sizing binds lists but never evaluates numeric values. */
    executeDataStatement(statement, estimateOnly = this.host.isDefinitionCollectionStage) {
        if (statement.literalData) {
            if (statement.literalData.length === 0 || statement.literalData.length % 6 !== 0) {
                throw new Error("Invalid literal data syntax.");
            }
            if (estimateOnly) {
                this.host.step((statement.literalData.length / 6) * statement.width);
            }
            else {
                // These nodes are parsed literal occurrences: no define/list binding or speculative reads
                // remain. Numeric observation still runs at each original write cursor through getnum.
                for (const operand of literalDataOperands(statement.literalData)) {
                    this.writeDataExpression(statement.width, operand.expression);
                }
            }
            if (this.host.collectSourceMetadata) {
                this.host.addAddressToLine(normalizeAddressForWidth(this.host.currentTargetBaseAddress, this.host.addressWidth));
            }
            return;
        }
        if (!statement.operands.length) {
            throw new Error(`${(statement.emptyDirective ?? ["", "db", "dw", "dl", "dd"][statement.width]).toUpperCase()} directive requires at least one parameter.`);
        }
        let estimatedItems = 0;
        const pending = [...statement.operands].toReversed();
        while (pending.length) {
            const original = pending.pop();
            let entries;
            try {
                entries = bindDataOperand(original, (fragment) => this.host.defineEngine.resolveFragment(fragment));
            }
            catch (cause) {
                if (!estimateOnly) {
                    throw cause;
                }
                estimatedItems++;
                continue;
            }
            if (entries.length !== 1) {
                for (let index = entries.length - 1; index >= 0; index--) {
                    pending.push(entries[index]);
                }
                continue;
            }
            const entry = entries[0];
            if (entry.expression.type === "string") {
                let value = entry.expression.value;
                try {
                    value = this.host.defineEngine.resolveDefinesInStringLiteral(value);
                }
                catch (cause) {
                    if (!estimateOnly) {
                        throw cause;
                    }
                }
                if (estimateOnly) {
                    estimatedItems += value.length;
                }
                else {
                    for (const character of this.processStringWithMapping(value)) {
                        this.writeDataByLength(statement.width, character);
                    }
                }
            }
            else if (estimateOnly) {
                estimatedItems++;
            }
            else {
                this.writeDataExpression(statement.width, entry.expression);
            }
        }
        if (estimateOnly) {
            this.host.step(estimatedItems * statement.width);
        }
        if (this.host.collectSourceMetadata) {
            this.host.addAddressToLine(normalizeAddressForWidth(this.host.currentTargetBaseAddress, this.host.addressWidth));
        }
    }
    /**
     * Writes a value using the data directive byte width.
     * @param len The byte width.
     * @param value The value to write.
     */
    writeDataByLength(len, value) {
        if (typeof len !== "number") {
            len = Number.parseInt(len, 10);
            if (Number.isNaN(len)) {
                throw new Error("writeDataByLength: len is NaN");
            }
        }
        switch (len) {
            case 1:
                this.host.write1(value);
                break;
            case 2:
                this.host.write2(value);
                break;
            case 3:
                this.host.write3(value);
                break;
            case 4:
                this.host.write4(value);
                break;
            default:
                throw new Error(`Unsupported data length ${len}`);
        }
    }
    /** Keep expression ownership until the writer can decide between an immediate scalar and a fixup. */
    writeDataExpression(width, expression) {
        if (this.host.moduleIdentity !== undefined && this.host.writeExpression) {
            this.host.writeExpression(expression, width);
        }
        else {
            this.writeDataByLength(width, this.host.operandResolver.getnum(expression));
        }
    }
    /**
     * Estimates data size with the same expansion order as emission, without resolving final values.
     * @param len Bytes per numeric item (1–4). String characters each occupy one item.
     * @param params Source operands, including defines that may expand to data lists.
     */
    estimateDataDirectiveSize(len, params) {
        if (len !== 1 && len !== 2 && len !== 3 && len !== 4) {
            throw new Error(`Unsupported data length ${len}`);
        }
        this.executeDataStatement({ width: len, operands: parseDataList(params.join(" ")) }, true);
    }
    /**
     * Pushes the current PC state.
     */
    handlePushPC() {
        if (this.host.pushpcnum >= 256) {
            throw new Error("PushPC stack overflow.");
        }
        // Save both logical and base cursors. `base` can decouple emitted PC from
        // the visible logical address, so restoring only one pair would corrupt later
        // layout.
        this.host.pushpcStack.push({
            currentTargetAddress: this.host.currentTargetAddress,
            currentTargetStartAddress: this.host.currentTargetStartAddress,
            currentTargetBaseAddress: this.host.currentTargetBaseAddress,
            currentTargetBaseStartAddress: this.host.currentTargetBaseStartAddress,
        });
        this.host.pushpcnum++;
    }
    /**
     * Restores the previous PC state.
     */
    handlePullPC() {
        if (this.host.pushpcnum === 0) {
            throw new Error("PullPC without PushPC.");
        }
        const state = this.host.pushpcStack.pop();
        // Restore exactly the state captured by `pushpc`. Directives such as
        // `incbin -> label` depend on this to resume emission at the original site.
        if (state) {
            this.host.currentTargetAddress = state.currentTargetAddress;
            this.host.currentTargetStartAddress = state.currentTargetStartAddress;
            this.host.currentTargetBaseAddress = state.currentTargetBaseAddress;
            this.host.currentTargetBaseStartAddress = state.currentTargetBaseStartAddress;
        }
        this.host.pushpcnum--;
    }
}
//# sourceMappingURL=directive-runtime-service.js.map