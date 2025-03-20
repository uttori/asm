import fs from "node:fs";
import path from "node:path";
import { Arch65816 } from "./Arch65816.js";
import { ArchSPC700 } from "./ArchSPC700.js";
import { AddressToLineMapping } from "./addr2line.js";
import { MathCore } from "./mathcore.js";
import { ArchSuperFX } from "./ArchSuperFX.js";
import { CRC32 } from "./crc32.js";
let debug = (..._) => { };
/* c8 ignore next */
// if (process.env.UTTORI_DATA_DEBUG || true) {
try {
    const { default: d } = await import("debug");
    debug = d("Assembler");
}
catch { }
export class Assembler {
    snespos = 0;
    realsnespos = 0;
    startpos = 0;
    realstartpos = 0;
    bytes = 0;
    mapper = "lorom"; // Possible values: lorom, hirom, exlorom, exhirom, sa1rom, sfxrom, bigsa1rom, norom
    sa1banks = [0 << 20, 1 << 20, -1, -1, 2 << 20, 3 << 20, -1, -1];
    romdata = []; // Placeholder for ROM
    romlen = 0;
    default_freespacebyte = 0x00;
    pass = 0;
    numif = 0;
    numtrue = 0;
    whileStatus = [];
    condStack = [];
    namespaceStack = [];
    currentNamespace = "";
    // Macro definition state:
    inMacroDefinition = false;
    currentMacroName = "";
    currentMacroParams = [];
    currentMacroBody = [];
    // Macros are stored in the macros map (MacroDefinition is defined above)
    macros = new Map();
    mathCore;
    moreonlinecond = true;
    addressToLineMapping = new AddressToLineMapping();
    currentFile = "";
    currentLine = 0;
    defines = new Map();
    // Character mapping support
    characterMappings = new Map();
    currentTable = null;
    inFunctionDefinition = false;
    functionDefinitionLines = [];
    arch65816;
    archSPC700;
    archSuperFX;
    // Add a new property for architecture in the class:
    arch = "65816";
    pushpcStack = [];
    pushpcnum = 0;
    labelTable = new Map();
    /** Track multiple `+` labels */
    forwardLabels = {};
    /** Track multiple `-` labels */
    backwardLabels = {};
    padUnit = 1;
    padbyte = [];
    structs = new Map();
    currentStruct = null;
    savedPCStack = [];
    fillbyte = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // initialize fill pattern
    targetRom;
    // Add a static property to hold our CRC table.
    static crcTable = null;
    includedFiles = new Set();
    includeGuardedFiles = new Set();
    includeStack = [];
    includePaths = ["./"];
    commandBuffer = ""; // Class-wide buffer for command concatenation
    // Replace the existing loop tracking with a more structured approach
    loopStack = []; // Stack of active loop blocks being built
    currentLoop = null; // Reference to the loop block currently being constructed
    collectingLoop = false; // Flag to indicate we're collecting loop commands
    loopNestingLevel = 0; // Current nesting level for loops
    constructor(targetRom) {
        this.targetRom = targetRom ?? [];
        this.arch65816 = new Arch65816(this);
        this.archSPC700 = new ArchSPC700(this);
        this.archSuperFX = new ArchSuperFX(this);
        this.mathCore = new MathCore();
        this.mathCore.delegate = this.mathCoreDelegate.bind(this);
    }
    mathCoreDelegate = (operation, ...args) => {
        debug("mathCoreDelegate", { operation, args });
        switch (operation) {
            case "resolveLabel": {
                try {
                    return this.getLabelValue(args[0], false);
                }
                catch (e) {
                    // If not found as a label, check if it's defined as a struct.
                    if (this.structs.has(args[0])) {
                        // Return the identifier as a string for built-in functions that expect one.
                        return args[0];
                    }
                    throw e;
                }
            }
            case "snestopc": {
                return this.snestopc(args[0]);
            }
            case "pctosnes": {
                return this.pctosnes(args[0]);
            }
            case "pc": {
                return this.snespos;
            }
            case "realbase": {
                return this.realsnespos;
            }
            case "defined": {
                try {
                    // TODO: This is no longer working as expected.
                    this.getLabelValue(args[0], false);
                    return 1; // Label exists
                }
                catch (e) {
                    // Check if it's a defined struct
                    if (this.structs.has(args[0])) {
                        return 1; // Struct exists
                    }
                    // Not found as a label or struct
                    return 0;
                }
            }
            case "sizeof": {
                return this.getObjectSize(args[0], true);
            }
            case "objectsize": {
                return this.getObjectSize(args[0]);
            }
            case "datasize": {
                return this.getObjectSize(args[0]);
            }
            case "filesize": {
                try {
                    const stats = fs.statSync(args[0]);
                    return stats.size;
                }
                catch (error) {
                    debug(`Could not get filesize for '${args[0]}'`, error);
                    throw error;
                }
            }
            case "getfilestatus": {
                try {
                    // Check if file exists and is readable
                    try {
                        fs.accessSync(args[0], fs.constants.R_OK);
                        return 0; // File exists and is readable
                    }
                    catch (e) {
                        return 2; // File exists but can't be read
                    }
                }
                catch (e) {
                    return 1; // File doesn't exist
                }
            }
            case "read1":
            case "read2":
            case "read3":
            case "read4":
            case "readfile1":
            case "readfile2":
            case "readfile3":
            case "readfile4":
            case "canread":
            case "canread1":
            case "canread2":
            case "canread3":
            case "canread4":
            case "canreadfile1":
            case "canreadfile2":
            case "canreadfile3":
            case "canreadfile4":
            case "canreadfile":
            default: {
                throw new Error(`delegate ${operation} not implemented`);
            }
        }
    };
    /**
     * Advances memory position while handling bank crossing.
     * @param {number} num - The number of bytes to advance.
     */
    step(num) {
        if (num === 0) {
            return;
        }
        if (num < 0) {
            throw new Error("step num is negative");
        }
        // debug("step", num);
        this.snespos = (this.snespos & 0xff000000) | this.fixsnespos(this.snespos & 0xffffff, num);
        this.realsnespos = (this.realsnespos & 0xff000000) | this.fixsnespos(this.realsnespos & 0xffffff, num);
        this.startpos = this.snespos;
        this.realstartpos = this.realsnespos;
        this.bytes += num;
    }
    /**
     * Writes a single byte to ROM.
     * @param {number} num - The byte to write.
     */
    write1_65816(num) {
        // if (num !== 0x00) {
        // debug("write1_65816", num.toString(16));
        // }
        if (Number.isNaN(num)) {
            throw Error("write1_65816 num is NaN");
        }
        this.verifysnespos();
        // Use fixsnespos to handle bank wrapping for the real SNES position
        const wrappedPos = this.fixsnespos(this.realsnespos & 0xFFFFFF);
        // Preserve the bank byte (high byte) while using the wrapped position
        const bankByte = this.realsnespos & 0xFF000000;
        const newPos = bankByte | wrappedPos;
        const pcpos = this.snestopc(newPos & 0xFFFFFF);
        // debug("write1_65816 pcpos", pcpos.toString(16));
        // debug('write1_65816 this.pass', this.pass);
        if (this.pass === 2) {
            this.romdata[pcpos] = num & 0xFF;
            // debug("write1_65816 romdata[pcpos]", this.romdata[pcpos].toString(16));
            if (pcpos >= this.romdata.length) {
                debug("write1_65816 pcpos >= romdata.length", pcpos, this.romdata.length);
                if (pcpos - this.romdata.length > 0) {
                    this.fillRomData(this.romdata.length, this.default_freespacebyte, pcpos - this.romdata.length);
                }
                this.romlen = pcpos + 1;
            }
        }
        this.step(1);
    }
    /**
     * Fills a section of ROM data with a value.
     * @param {number} start The starting address.
     * @param {number} value The value to fill with.
     * @param {number} length The length of the section to fill.
     */
    fillRomData(start, value, length) {
        debug("fillRomData", start, value, length);
        for (let i = 0; i < length; i++) {
            this.romdata[start + i] = value;
        }
    }
    /**
     * Picks the appropriate instruction handler based on architecture.
     * @param {string[]} words The words to pick.
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    asblock_pick(words) {
        debug("asblock_pick", words);
        debug("asblock_pick arch", this.arch);
        if (words.length === 0) {
            return true;
        }
        // In pass 0, allow forward references by returning a dummy value.
        if (this.pass === 0) {
            return true;
        }
        if (this.arch === "spc700") {
            return this.asblock_spc700(words);
        }
        else if (this.arch === "superfx") {
            // (Implement superfx handling if needed)
            // For now, fallback to 65816 handling.
            if (this.asblock_superfx(words)) {
                return true;
            }
            return false;
        }
        else if (this.arch === "65816") {
            if (this.asblock_65816(words)) {
                return true;
            }
            else {
                return false;
            }
        }
        return true;
    }
    /**
     * Placeholder for architecture-specific instruction handling.
     * @param {string[]} words - The words to pick.
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    asblock_spc700(words) {
        debug("asblock_spc700", words);
        if (!this.archSPC700.asblock_spc700(words)) {
            throw new Error(`Unknown instruction: ${words[0]}`);
        }
        return true;
    }
    asblock_superfx(words) {
        debug("asblock_superfx", words);
        if (!this.archSuperFX.asblock_superfx(words)) {
            throw new Error(`Unknown instruction: ${words[0]}`);
        }
        return true;
    }
    asblock_65816(words) {
        debug("asblock_65816", words);
        if (!this.arch65816.asblock_65816(words)) {
            throw new Error(`Unknown instruction: ${words[0]}`);
        }
        return true;
    }
    /**
     * Writes 1, 2, 3, or 4 bytes to ROM.
     * @param {number} num - The byte to write.
     */
    write1(num) {
        this.write1_65816(num);
    }
    write2(num) {
        this.write1(num & 0xFF);
        this.write1((num >> 8) & 0xFF);
    }
    write3(num) {
        this.write1(num & 0xFF);
        this.write1((num >> 8) & 0xFF);
        this.write1((num >> 16) & 0xFF);
    }
    write4(num) {
        this.write1(num & 0xFF);
        this.write1((num >> 8) & 0xFF);
        this.write1((num >> 16) & 0xFF);
        this.write1((num >> 24) & 0xFF);
    }
    /**
     * Reads 1, 2, or 3 bytes from ROM.
     * @param {number} insnespos - The SNES address to read from.
     * @returns {number} The byte read from ROM.
     */
    read1(insnespos) {
        const addr = this.snestopc(insnespos);
        if (addr < 0 || addr + 1 > this.romlen) {
            return -1;
        }
        return this.romdata[addr];
    }
    read2(insnespos) {
        const addr = this.snestopc(insnespos);
        if (addr < 0 || addr + 2 > this.romlen) {
            return -1;
        }
        return this.romdata[addr] | (this.romdata[addr + 1] << 8);
    }
    read3(insnespos) {
        const addr = this.snestopc(insnespos);
        if (addr < 0 || addr + 3 > this.romlen) {
            return -1;
        }
        return this.romdata[addr] | (this.romdata[addr + 1] << 8) | (this.romdata[addr + 2] << 16);
    }
    assembleblock(block) {
        // debug('assembleblock', block);
        if (!block.trim()) {
            return;
        }
        const lines = block.split("\n");
        const processedLines = [];
        for (let line of lines) {
            line = line.trim();
            if (!line)
                continue;
            // Strip any inline comments and trim the line
            line = this.removeInlineComment(line).trim();
            if (!line)
                continue;
            if (line.endsWith("\\")) {
                debug("processMultiLineOperators line ends with \\", line);
                this.commandBuffer += line.slice(0, -1); // Remove `\` and concatenate
            }
            else if (line.endsWith(",")) {
                debug("processMultiLineOperators line ends with ,", line);
                this.commandBuffer += line; // Keep `,` in concatenation
            }
            else {
                processedLines.push(this.commandBuffer + line);
                this.commandBuffer = "";
            }
        }
        // Don't process remaining buffer here - it will be handled in the next call
        // if (this.commandBuffer) processedLines.push(this.commandBuffer);
        block = processedLines.join("\n");
        const words = block.trim().split(/\s+/);
        if (words.length === 0) {
            debug("assembler assembleblock no words", { words });
            return;
        }
        // Handle single-line operator `:`
        const splitCommands = block.split(/\s:\s/);
        for (const command of splitCommands) {
            this.processCommand(command.trim());
        }
    }
    removeInlineComment(line) {
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                inQuote = !inQuote;
            }
            else if (!inQuote && ch === ";") {
                return line.substring(0, i).trim();
            }
        }
        return line.trim();
    }
    /**
     * Processes a single command from `assembleblock`.
     * @param {string} command - The command to process.
     */
    processCommand(command) {
        if (command.trim() === "")
            return;
        debug("processCommand", { command }, this.snespos, "/", this.snespos.toString(16));
        // If we're in a loop body and not processing an inner loop or endfor, store the command
        if (this.collectingLoop && !command.match(/^\s*(for|while|endfor|endwhile)/i)) {
            // We're inside a loop block - collect the command instead of immediately processing it
            if (this.currentLoop) {
                this.currentLoop.commands.push(command);
            }
            return;
        }
        // Parse for loop definitions
        if (command.match(/^\s*for\s+/i)) {
            this.beginLoopCollection("for", command);
            return;
        }
        // Parse while loop definitions
        if (command.match(/^\s*while\s+/i)) {
            this.beginLoopCollection("while", command);
            return;
        }
        // Handle endfor
        if (command.match(/^\s*endfor/i)) {
            this.endLoopCollection("for");
            return;
        }
        // Handle endwhile
        if (command.match(/^\s*endwhile/i)) {
            this.endLoopCollection("while");
            return;
        }
        // If we already started a function definition, gather more lines if the last line ended with "\"
        if (this.inFunctionDefinition) {
            // Remove trailing backslash if present
            if (command.trimEnd().endsWith("\\")) {
                this.functionDefinitionLines.push(command.trimEnd().slice(0, -1));
            }
            else {
                // This is the final line in the function definition
                this.functionDefinitionLines.push(command.trim());
                // Now parse the complete definition
                const fullDefinition = this.functionDefinitionLines.join(" ");
                this.functionDefinitionLines = [];
                this.inFunctionDefinition = false;
                this.parseFunctionDefinition(fullDefinition);
            }
            return;
        }
        // Check for the special test directive comment.
        // The test file is marked by a line that is exactly ";`+"
        if (command.trim().startsWith(";`+")) {
            debug("Test file directive detected; loading target ROM and setting ROM length to 512 KB.");
            const testRomSize = 512 * 1024; // 512 KB
            this.romlen = testRomSize;
            // If a target ROM data buffer is provided (assume it's stored in this.targetRom)
            if (this.targetRom && this.targetRom.length > 0) {
                // Copy up to testRomSize bytes from targetRom into our romdata array.
                for (let i = 0; i < Math.min(testRomSize, this.targetRom.length); i++) {
                    this.romdata[i] = this.targetRom[i];
                }
            }
            // No further processing needed for this line.
            return;
        }
        // First remove any inline comment (ignoring semicolons inside quotes)
        command = this.removeInlineComment(command);
        // Split by whitespace, but preserve quoted strings
        let words = this.splitCommandIntoWords(command);
        if (words.length === 0)
            return;
        const keyword = words[0];
        // Handle character mappings (both inside and outside tables)
        if (words.length === 3 && words[1] === "=" && (words[0].startsWith("'") || words[0].startsWith('"'))) {
            this.handleCharacterMapping(words);
            return;
        }
        // Function Definition Mode
        if (keyword.toLowerCase().startsWith("function ")) {
            // If it ends with "\" we keep collecting
            if (keyword.endsWith("\\")) {
                this.inFunctionDefinition = true;
                this.functionDefinitionLines.push(keyword.slice(0, -1));
            }
            else {
                // Single-line definition
                this.parseFunctionDefinition(keyword);
            }
            return;
        }
        // Macro Definition Mode
        if (this.inMacroDefinition) {
            if (command.trim().toLowerCase() === "endmacro") {
                // Finalize macro definition only on pass 0.
                if (this.pass === 0) {
                    let variadic = false;
                    if (this.currentMacroParams.length > 0 &&
                        this.currentMacroParams[this.currentMacroParams.length - 1] === "...") {
                        variadic = true;
                        this.currentMacroParams.pop();
                    }
                    const macroDef = {
                        name: this.currentMacroName,
                        params: this.currentMacroParams,
                        variadic,
                        body: this.currentMacroBody
                    };
                    if (this.macros.has(macroDef.name)) {
                        // If already defined on pass 0, that's an error.
                        throw new Error(`Macro '${macroDef.name}' is already defined.`);
                    }
                    this.macros.set(macroDef.name, macroDef);
                    debug(`Defined macro '${macroDef.name}' with params [${macroDef.params.join(", ")}]${variadic ? " (variadic)" : ""}.`);
                }
                // On later passes (or after definition), simply exit macro-definition mode.
                this.inMacroDefinition = false;
                this.currentMacroName = "";
                this.currentMacroParams = [];
                this.currentMacroBody = [];
                return;
            }
            else {
                // On pass 0, collect macro body lines; on later passes ignore them.
                if (this.pass === 0) {
                    this.currentMacroBody.push(command.trim());
                }
                return;
            }
        }
        // Start Macro Definition
        if (command.trim().toLowerCase().startsWith("macro ")) {
            // Expect a header like: macro mov(target, source)
            const headerRegex = /^macro\s+(\w+)\((.*)\)$/i;
            const match = command.trim().match(headerRegex);
            if (!match) {
                throw new Error("Invalid macro header: " + command.trim());
            }
            this.currentMacroName = match[1].trim();
            const paramsStr = match[2].trim();
            this.currentMacroParams = paramsStr ? paramsStr.split(",").map(s => s.trim()) : [];
            this.inMacroDefinition = true;
            debug(`Started macro definition for '${this.currentMacroName}' with params [${this.currentMacroParams.join(", ")}].`);
            return;
        }
        // Define a set of directives that must always be processed (i.e. that update the condition stack)
        const conditionDirectives = new Set([
            "if", "elseif", "else", "endif",
            "while", "endwhile", "for", "endfor"
        ]);
        // Check if we are inside a false conditional block.
        // (If any entry in condStack is false then overall condition is false.)
        const currentCond = this.condStack.length === 0 ? true : this.condStack.every(entry => entry.cond);
        if (!currentCond && !conditionDirectives.has(keyword)) {
            debug(`processCommand ❎ Skipping command "${command}" because condition is false.`);
            return;
        }
        // If the command starts with "!", handle it appropriately
        if (command.trim().startsWith("!")) {
            // Check if it's a define declaration (contains =, +=, :=, etc.)
            if (command.includes("=")) {
                this.handleDefineCommand(command);
                this.addAddressToLine(this.realsnespos & 0xFFFFFF);
            }
            else {
                // It's a standalone define reference, resolve it and process the result
                const defineName = command.trim().substring(1); // Remove the !
                if (!this.defines.has(defineName)) {
                    throw new Error(`Error: Define '${defineName}' not found.`);
                }
                // Get the define's value and process it as a command
                const defineValue = this.defines.get(defineName);
                debug(`Processing standalone define !${defineName} with value: ${defineValue}`);
                this.processCommand(defineValue);
            }
            return;
        }
        // If command starts with "%" then it's a macro invocation.
        if (keyword.startsWith("%")) {
            const invocation = words.join(" ").substring(1);
            this.callMacro(invocation);
            return;
        }
        // If we're in struct mode, intercept struct member commands.
        if (this.currentStruct) {
            debug("processCommand currentStruct keyword", keyword);
            // A member label starts with a dot.
            if (keyword.startsWith(".")) {
                // Check if this is a label definition or just a label reference
                const hasColon = keyword.endsWith(":");
                // For example: ".PosY:" – remove the colon and the dot
                const labelName = keyword.replace(/:$/, "").substring(1);
                // Record this label's offset within the struct.
                this.currentStruct.labels.set(labelName, this.currentStruct.offset);
                debug(`processCommand struct "${this.currentStruct.name}": defined member "${labelName}" at offset ${this.currentStruct.offset} hasColon=${hasColon}`);
                // A skip command inside a struct adds to the current offset.
                if (words[1]?.toLowerCase() === "skip") {
                    if (words.length !== 3) {
                        throw new Error(`skip directive in struct requires exactly one parameter: ${words.length}`);
                    }
                    const skipAmount = this.getnum(words[2]);
                    this.currentStruct.offset += skipAmount;
                    debug(`processCommand struct "${this.currentStruct.name}": skipAmount ${skipAmount}, offset now ${this.currentStruct.offset}`);
                    return;
                }
                else {
                    // IMPORTANT: NEVER increment the offset for:
                    // 1. Any label that ends with a colon (organizational labels)
                    // 2. Unless it's followed by a skip command
                    if (hasColon && words.length === 1) {
                        debug(`processCommand struct "${this.currentStruct.name}": not incrementing offset for organizational label "${labelName}"`);
                    }
                    else if (!hasColon) {
                        // If there's no colon, this is a label used in an expression, not a declaration
                        debug(`processCommand struct "${this.currentStruct.name}": not incrementing offset for label reference "${labelName}"`);
                    }
                    else {
                        // This is a label followed by something other than skip - we should not increment for nested structs
                        debug(`processCommand struct "${this.currentStruct.name}": not incrementing offset for struct member "${labelName}" with ${words.length} words`);
                    }
                    // Do NOT increment the offset for ANY labels inside structs (removed the offset increment)
                    // The only way to increase the offset should be with skip directives
                }
            }
            // End the struct
            if (keyword.toLowerCase() === "endstruct") {
                this.handleEndStruct(words);
            }
            // Other commands inside a struct might be allowed.
            // For now, assume only labels and skip commands appear.
            return;
        }
        // Not in struct mode. Process regular commands.
        if (keyword.toLowerCase() === "struct") {
            this.handleStruct(words);
            return;
        }
        if (keyword.toLowerCase() === "endstruct") {
            this.handleEndStruct(words);
            return;
        }
        // New: support for incbin.
        if (keyword.toLowerCase() === "incbin") {
            this.handleIncbin(words);
            return;
        }
        // New: handle fillbyte (and fillword, filllong, filldword)
        if (keyword === "fillbyte" ||
            keyword === "fillword" ||
            keyword === "filllong" ||
            keyword === "filldword") {
            debug(`processCommand ${keyword}`, words);
            let len;
            if (keyword === "fillbyte")
                len = 1;
            else if (keyword === "fillword")
                len = 2;
            else if (keyword === "filllong")
                len = 3;
            else if (keyword === "filldword")
                len = 4;
            else
                throw new Error("Unrecognized fillbyte directive.");
            if (words.length !== 2) {
                throw new Error(`${keyword.toUpperCase()} directive requires exactly one parameter.`);
            }
            const val = this.getnum(this.resolvedefines(words[1]));
            debug(`processCommand ${keyword} value`, val);
            // Optionally warn if a label is used here.
            // Fill our fill pattern array in 12-byte blocks.
            for (let i = 0; i < 12; i += len) {
                let tmpVal = val;
                for (let j = 0; j < len; j++) {
                    this.fillbyte[i + j] = tmpVal & 0xFF;
                    tmpVal >>>= 8;
                }
            }
            return; // done processing this line.
        }
        // New: handle "fill" command.
        if (keyword === "fill") {
            debug("processCommand fill", words);
            // Syntax: fill {number_of_bytes}
            if (words.length !== 2) {
                throw new Error("FILL directive requires exactly one parameter (number of bytes to fill).");
            }
            const count = this.getnum(this.resolvedefines(words[1]));
            for (let i = 0; i < count; i++) {
                this.write1(this.fillbyte[i % 12]);
            }
            this.addAddressToLine(this.realsnespos & 0xFFFFFF);
            return;
        }
        // Handle non-relative (named) labels that use the colon syntax.
        // (Dynamic labels get their value from the current PC.)
        // Check if the first token ends with a colon.
        while (words.length > 0 && keyword.endsWith(":")) {
            debug("non-relative (named) label assignment", words);
            // Remove the colon to get the label name.
            const labelName = keyword.slice(0, -1);
            // Define the label at the current SNES position.
            this.setLabel(labelName);
            // Remove the label token.
            words.shift();
        }
        if (words.length === 0)
            return;
        // Handle static label assignment
        // Format: LabelName = <expression>
        if (words.length === 3 && words[1] === "=") {
            debug("static label assignment", words);
            const labelName = keyword;
            const expr = words[2];
            // First, resolve any defines in the expression.
            const resolvedExpr = this.resolvedefines(expr);
            // Try to evaluate it as a math expression.
            let value = this.mathCore.math(resolvedExpr);
            // If evaluation fails (i.e. not a numeric literal), try to resolve it as a label.
            if (Number.isNaN(value)) {
                value = this.getLabelValue(resolvedExpr, true);
            }
            // Mark this label as static.
            debug("static label assignment value", value);
            this.setLabel(labelName, value, true);
            // Record mapping and finish.
            this.addAddressToLine(this.realsnespos & 0xFFFFFF);
            return;
        }
        let resolved = "";
        // Capture the starting PC (before processing this command)
        const startPC = this.realsnespos & 0xFFFFFF;
        // Ensure proper condition handling
        if (!this.moreonlinecond && !["elseif", "else", "endif", "endwhile"].includes(keyword.toLowerCase())) {
            return;
        }
        // TODO: inmacro is external and resolvedefines is external
        // RPG Hacker: Fix issue where defines in elseifs weren't resolving correctly
        if (keyword.toLowerCase() === "elseif" && this.numtrue + 1 === this.numif) {
            const tmp = command; //this.macros.inmacro ? this.macros.replace_macro_args(command) : command;
            resolved = this.resolvedefines(tmp);
            words = resolved.trim().split(/\s+/);
        }
        switch (keyword) {
            case "incsrc": {
                if (words.length !== 2) {
                    throw new Error("incsrc requires exactly one filename parameter");
                }
                const filename = words[1];
                this.assemblefile(filename, false);
                break;
            }
            case "include": {
                this.handleInclude("include", words[1], false);
                break;
            }
            case "includeonce": {
                this.handleInclude("include", words[1], true);
                break;
            }
            case "padbyte":
            case "padword":
            case "padlong":
            case "paddword": {
                debug(`${keyword}`, words);
                // Determine the length from the command name.
                let len;
                if (keyword === "padbyte")
                    len = 1;
                else if (keyword === "padword")
                    len = 2;
                else if (keyword === "padlong")
                    len = 3;
                else if (keyword === "paddword")
                    len = 4;
                else
                    throw new Error("Unrecognized pad directive.");
                if (words.length !== 2) {
                    throw new Error(`${keyword.toUpperCase()} directive requires exactly one parameter.`);
                }
                const val = this.getnum(this.resolvedefines(words[1]));
                debug(`${keyword} val`, val);
                // Save the pad unit (i.e. number of bytes in the pad pattern)
                this.padUnit = len;
                // Fill the first len entries of the pad pattern array.
                for (let i = 0; i < len; i++) {
                    this.padbyte[i] = (val >> (8 * i)) & 0xFF;
                }
                break;
            }
            case "pad": {
                debug("pad", words);
                // The pad command writes the pad pattern until the PC reaches a target SNES address.
                let gap;
                if (words.length === 1) {
                    // Pad to next bank boundary
                    const currentBank = (this.snespos & 0xFF0000);
                    const bankOffset = (this.snespos & 0xFFFF);
                    const nextBank = bankOffset === 0xFFFF ? currentBank + 0x10000 : currentBank + 0x10000 - bankOffset;
                    debug("pad next bank", nextBank, "/", nextBank.toString(16));
                    words.push("$" + nextBank.toString(16));
                    // gap = nextBank - this.snespos;
                    gap = nextBank;
                }
                else if (words.length === 2) {
                    // We must convert the target SNES address into a PC offset.
                    const targetSNES = this.getnum(words[1]);
                    const targetPC = this.snestopc(targetSNES);
                    if (targetPC < 0) {
                        throw new Error(`Target SNES address ${targetSNES.toString(16)} does not map to ROM.`);
                    }
                    const currentPC = this.snestopc(this.snespos);
                    if (targetPC <= currentPC) {
                        debug("pad targetPC <= currentPC, nothing to pad", targetPC, "<=", currentPC);
                        // Nothing to pad.
                        return;
                    }
                    gap = targetPC - currentPC;
                }
                debug("pad gap (PC offset):", gap, "/", gap.toString(16));
                // Write the pad pattern using the previously defined padUnit.
                for (let i = 0; i < gap; i++) {
                    this.write1(this.padbyte[i % this.padUnit]);
                }
                this.addAddressToLine(this.realsnespos & 0xFFFFFF);
                break;
            }
            case "base": {
                if (words.length !== 2) {
                    throw new Error("BASE directive requires exactly one parameter.");
                }
                const param = words[1].toLowerCase();
                if (param === "off") {
                    // Reset base: use the 'real' positions
                    this.snespos = this.realsnespos;
                    this.startpos = this.realstartpos;
                    // Optionally, you might want to log this event:
                    debug("BASE turned off. snespos and startpos reset to their real values.");
                }
                else {
                    // Parse the parameter as a number.
                    const num = this.getnum(param);
                    if (num > 0xFFFFFF) {
                        throw new Error(`Invalid base address: ${param}. Must be within 24 bits.`);
                    }
                    // In ASAR, a forward label isn't allowed here.
                    // (If you have a forward label flag, you might check it here.)
                    this.snespos = num;
                    this.startpos = num;
                    debug(`BASE set to ${param} (${num}).`);
                }
                break;
            }
            case "fastrom":
                // Removed but in the tests
                break;
            case "lorom":
                this.mapper = "lorom";
                break;
            case "hirom":
                this.mapper = "hirom";
                break;
            case "exlorom":
                this.mapper = "exlorom";
                break;
            case "exhirom":
                this.mapper = "exhirom";
                break;
            case "sfxrom":
                this.mapper = "sfxrom";
                break;
            case "norom":
                this.mapper = "norom";
                // For norom, you might disable checksum fix:
                // if (!this.force_checksum_fix) this.checksum_fix_enabled = false;
                break;
            case "fullsa1rom":
                this.mapper = "bigsa1rom";
                break;
            case "sa1rom": {
                if (words.length > 1) {
                    // Expect a parameter in the form "X,Y,Z,W" where each X is a single digit.
                    const parts = words[1].split(",");
                    if (parts.length !== 4) {
                        throw new Error("Invalid SA1ROM mapper specification. Expected 4 comma-separated values.");
                    }
                    this.sa1banks = [];
                    this.sa1banks[0] = (parseInt(parts[0], 10)) << 20;
                    this.sa1banks[1] = (parseInt(parts[1], 10)) << 20;
                    this.sa1banks[4] = (parseInt(parts[2], 10)) << 20;
                    this.sa1banks[5] = (parseInt(parts[3], 10)) << 20;
                }
                else {
                    // Use default bank values.
                    this.sa1banks = [];
                    this.sa1banks[0] = 0 << 20;
                    this.sa1banks[1] = 1 << 20;
                    this.sa1banks[4] = 2 << 20;
                    this.sa1banks[5] = 3 << 20;
                }
                this.mapper = "sa1rom";
                break;
            }
            case "+":
            case "-":
                this.handleRelativeLabel(command);
                break;
            case "if":
                this.handleIf(words.slice(1));
                break;
            case "elseif":
                this.handleElseIf(words.slice(1));
                break;
            case "else":
                this.handleElse();
                break;
            case "endif":
                this.handleEndIf();
                break;
            case "while":
                this.handleWhile(words.slice(1));
                break;
            case "endwhile":
                this.handleEndWhile();
                break;
            case "for":
                this.handleFor(words.slice(1));
                break;
            case "endfor":
                this.handleEndFor();
                break;
            case "namespace":
                this.handleNamespace(words.slice(1));
                break;
            case "pushns":
                this.handlePushNamespace();
                break;
            case "pullns":
                this.handlePullNamespace();
                break;
            case "org":
                this.handleOrg(words.slice(1));
                break;
            case "db":
            case "dw":
            case "dl":
            case "dd":
            case "dc.b":
            case "dc.w":
            case "dc.l": {
                this.handleDataDirective(keyword, words.slice(1));
                break;
            }
            case "pushpc": {
                this.handlePushPC();
                break;
            }
            case "pullpc": {
                this.handlePullPC();
                break;
            }
            case "arch": {
                this.handleArch(words.slice(1));
                break;
            }
            case "check":
            case "dpbase":
            case "warnings":
            case "print":
            case "freecode":
            case "freespace":
            case "freedata":
            case "autoclean":
            case "autoclear":
            case "freespacebyte":
            case "prot":
            case "table":
            case "optimize":
            case "includefrom":
                debug(`${keyword} unsupported`, words.slice(1));
                break;
            default: {
                if (keyword.startsWith(";")) {
                    // debug(`handleInstruction comment: ${words.join(" ")}`);
                }
                else if (keyword === "") {
                    // debug(`handleInstruction white space: ${words.join(" ")}`);
                }
                else {
                    const wasOpcode = this.asblock_pick(words);
                    if (!wasOpcode) {
                        debug("💥 assembler processCommand unknown operation", keyword);
                    }
                }
                break;
            }
        }
        // Determine how many bytes were written in this command.
        const commandSize = (this.realsnespos & 0xFFFFFF) - startPC;
        debug("processCommand bytes written", commandSize);
        this.addAddressToLine(this.realsnespos & 0xFFFFFF);
    }
    /**
     * Handles the ARCH command.
     * @param {string[]} words - The words from the ARCH command.
     * @throws {Error} If the ARCH command requires an architecture parameter.
     */
    handleArch(words) {
        debug("handleArch", words);
        if (words.length < 2) {
            throw new Error("ARCH command requires an architecture parameter.");
        }
        const archParam = words[1].toLowerCase();
        if (archParam === "65816") {
            this.arch = "65816";
            // (Reinitialize or update arch65816 if needed)
        }
        else if (archParam === "spc700") {
            this.arch = "spc700";
        }
        else if (archParam === "superfx") {
            this.arch = "superfx";
        }
        else {
            throw new Error("Unsupported architecture: " + archParam);
        }
    }
    /**
     * Parses a function definition of the form:
     *   function name(param1, param2...) = expression
     * Possibly spanning multiple lines joined by backslashes.
     * @param {string} defLine - The function definition line.
     */
    parseFunctionDefinition(defLine) {
        // Set the string to parse in mathCore
        this.mathCore.str = defLine;
        // Call the parseFunctionDefinition method without arguments
        this.mathCore.parseFunctionDefinition();
    }
    /**
     * Expands and calls a macro invocation.
     * The invocation is expected to be in the form:
     *   macroName(arg1, arg2, ...)
     * @param {string} invocation The macro invocation to expand and call.
     */
    callMacro(invocation) {
        debug("callMacro", invocation);
        // Use a regex to extract macro name and arguments.
        const invocationRegex = /^(\w+)\((.*)\)$/;
        const match = invocation.match(invocationRegex);
        if (!match) {
            throw new Error(`Invalid macro invocation: ${invocation}`);
        }
        const macroName = match[1].trim();
        const argsString = match[2].trim();
        // Parse arguments handling quoted strings properly
        const args = [];
        if (argsString) {
            debug("callMacro argsString =", argsString);
            let currentArg = "";
            let inQuotes = false;
            let i = 0;
            while (i < argsString.length) {
                const char = argsString[i];
                // Handle escaped quotes inside quoted strings
                if (char === '"' && inQuotes && argsString[i + 1] === '"') {
                    currentArg += '"';
                    i += 2; // Skip both quote characters
                    continue;
                }
                // Toggle quote state
                if (char === '"') {
                    inQuotes = !inQuotes;
                    i++;
                    continue;
                }
                // If we hit a comma outside of quotes, we've reached the end of an argument
                if (char === "," && !inQuotes) {
                    args.push(currentArg.trim());
                    currentArg = "";
                    i++;
                    continue;
                }
                // Add the current character to the argument
                currentArg += char;
                i++;
            }
            // Add the last argument if there is one
            if (currentArg.trim() || args.length > 0) {
                args.push(currentArg.trim());
            }
        }
        if (!this.macros.has(macroName)) {
            throw new Error(`Macro '${macroName}' is not defined.`);
        }
        const macroDef = this.macros.get(macroName);
        if (!macroDef) {
            throw new Error(`Macro '${macroName}' is not defined.`);
        }
        // Validate argument counts.
        if (!macroDef.variadic && args.length !== macroDef.params.length) {
            throw new Error(`Macro '${macroName}' expects ${macroDef.params.length} parameters, but got ${args.length}.`);
        }
        if (macroDef.variadic && args.length < macroDef.params.length) {
            throw new Error(`Macro '${macroName}' expects at least ${macroDef.params.length} parameters, but got ${args.length}.`);
        }
        debug("callMacro args =", args);
        // Build a mapping for fixed parameters.
        const fixedArgs = new Map();
        for (let i = 0; i < macroDef.params.length; i++) {
            fixedArgs.set(macroDef.params[i], args[i]);
        }
        // The remaining arguments (if any) are variadic.
        const variadicArgs = macroDef.variadic ? args.slice(macroDef.params.length) : [];
        const variadicCount = variadicArgs.length;
        // Expand each line of the macro body.
        for (const line of macroDef.body) {
            const expandedLine = this.expandMacroLine(line, fixedArgs, variadicArgs, variadicCount);
            // Process the expanded line just as if it were written in the source.
            this.assembleblock(expandedLine);
        }
    }
    /**
     * Expands a macro line by substituting fixed parameters (<param>) and variadic parameters (<...[expr]>),
     * then resolves any remaining defines.
     * @param {string} line The macro line to expand.
     * @param {Map<string, string>} fixedArgs A map of fixed parameters to their values.
     * @param {string[]} variadicArgs An array of variadic arguments.
     * @param {number} variadicCount The number of variadic arguments.
     * @returns {string} The expanded macro line.
     */
    expandMacroLine(line, fixedArgs, variadicArgs, variadicCount) {
        debug("expandMacroLine", line, fixedArgs, variadicArgs, variadicCount);
        let expanded = line;
        // Replace fixed parameters of the form <param>
        expanded = expanded.replace(/<(\w+)>/g, (match, paramName) => {
            if (fixedArgs.has(paramName)) {
                // Optionally, run the argument through resolvedefines.
                return this.resolvedefines(fixedArgs.get(paramName));
            }
            return match;
        });
        // Replace variadic parameters of the form <...[{math}]>
        expanded = expanded.replace(/<(?:\.{3}|…)\[([^\]]+)]>/g, (match, expr) => {
            // Resolve defines inside the math expression.
            const resolvedExpr = this.resolvedefines(expr);
            let index = this.mathCore.math(resolvedExpr);
            if (isNaN(index)) {
                throw new Error(`Invalid variadic index expression: ${expr}`);
            }
            index = Math.floor(index);
            if (index < 0 || index >= variadicCount) {
                throw new Error(`Variadic index ${index} out of range (0..${variadicCount - 1}).`);
            }
            return variadicArgs[index];
        });
        // Replace sizeof(...) with the number of variadic arguments.
        expanded = expanded.replace(/sizeof\(\.{3}\)/g, variadicCount.toString());
        // Finally, resolve any remaining defines.
        expanded = this.resolvedefines(expanded);
        debug("expandMacroLine = ", expanded);
        return expanded;
    }
    /**
     * Handles define commands.
     * Example:
     * @example
     * !identifier = value // Basic assignment
     * !identifier += value // Append to existing value
     * !identifier := value // Resolve defines in the value
     * !identifier #= value // Evaluate as math expression
     * !identifier ?= value // Only assign if not already defined
     * @param {string} command The define command to handle.
     */
    handleDefineCommand(command) {
        debug("handleDefineCommand", command);
        // Remove the leading "!" and trim.
        const line = command.substring(1).trim();
        // Use a regex to split into identifier, operator, and value.
        const match = line.match(/^(\w+)\s*(=|\+=|:=|#=|\?=)\s*(.*)$/);
        if (!match) {
            throw new Error(`Invalid define syntax: ${command}`);
        }
        const identifier = match[1];
        const operator = match[2];
        let value = match[3].trim();
        // If the value is enclosed in double quotes, remove them.
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
        }
        // For the ":=" operator, resolve any defines in the value immediately.
        if (operator === ":=") {
            value = this.resolvedefines(value);
        }
        // For the "#=" operator, evaluate the value as a math expression.
        if (operator === "#=") {
            // First resolve any defines inside the expression.
            value = this.resolvedefines(value);
            const result = this.mathCore.math(value);
            /* c8 ignore next 3 */
            if (Number.isNaN(result)) {
                throw new Error(`Math evaluation failed in define "#=" for expression: ${value}`);
            }
            // Convert to string (you may choose your own format, here decimal is used)
            value = result.toString();
        }
        // For the "?=" operator, only assign if not already defined.
        if (operator === "?=") {
            if (this.defines.has(identifier)) {
                return;
            }
        }
        // For the "+=" operator, append to any existing value.
        if (operator === "+=") {
            const existing = this.defines.get(identifier) || "";
            value = existing + value;
        }
        // Check if the value is a math expression that needs to be evaluated
        if (value.includes("+") || value.includes("-") || value.includes("*") || value.includes("/") ||
            value.includes("&") || value.includes("|") || value.includes("^") ||
            value.includes("<<") || value.includes(">>") || value.includes("(")) {
            try {
                // First resolve any defines inside the expression
                const resolvedValue = this.resolvedefines(value);
                // Then evaluate the math expression
                const result = this.mathCore.math(resolvedValue);
                if (!Number.isNaN(result)) {
                    // Only use the result if it's a valid number
                    value = "$" + result.toString(16).toUpperCase();
                    debug(`handleDefineCommand evaluated math expression in define: ${resolvedValue} = ${value}`);
                }
            }
            catch (error) {
                /* c8 ignore next 3 */
                // If evaluation fails, keep the original value
                debug(`handleDefineCommand math evaluation skipped for expression: ${value}`);
            }
        }
        // Assign the define.
        this.defines.set(identifier, value);
        debug(`handleDefineCommand define set: !${identifier} ${operator} ${value}`);
    }
    /**
     * Handles `+` and `-` relative labels correctly using SNES memory position.
     * @param {string} label The label to handle.
     * @returns {number} The address of the label.
     */
    handleRelativeLabel(label) {
        debug("handleRelativeLabel", label);
        const depth = label.length;
        const isPositive = label.startsWith("+");
        const snesAddress = this.snespos;
        if (this.pass > 0) {
            // Search in stored labels
            if (isPositive) {
                if (!this.forwardLabels[depth] || this.forwardLabels[depth].length === 0) {
                    throw new Error(`Error: Undefined forward label '${label}'.`);
                }
            }
            else {
                if (!this.backwardLabels[depth] || this.backwardLabels[depth].length === 0) {
                    throw new Error(`Error: Undefined backward label '${label}'.`);
                }
            }
            return snesAddress;
        }
        // Pass 0: Store labels properly
        if (isPositive) {
            if (!this.forwardLabels[depth])
                this.forwardLabels[depth] = [];
            this.forwardLabels[depth].push(snesAddress);
        }
        else {
            if (!this.backwardLabels[depth])
                this.backwardLabels[depth] = [];
            this.backwardLabels[depth].push(snesAddress);
        }
        return snesAddress;
    }
    /**
     * Finds the next occurrence of a `+` label based on SNES memory position.
     * @param {string} label The label to find.
     * @returns {number} The address of the next label.
     */
    findNextLabel(label) {
        debug("findNextLabel", label);
        const depth = label.length; // Number of `+` signs
        const currentAddress = this.snespos;
        // **Pass 0: Don't resolve labels yet, just track**
        if (this.pass === 0) {
            return 0; // Temporary placeholder value, will be resolved in Pass 2
        }
        // **Pass 2: Resolve properly**
        if (!this.forwardLabels[depth] || this.forwardLabels[depth].length === 0) {
            throw new Error(`Error: No + label '${label}' found after ${currentAddress.toString(16)}.`);
        }
        // **Find the first label that is AFTER the current address**
        const possibleTargets = this.forwardLabels[depth].filter(addr => addr > currentAddress);
        if (possibleTargets.length === 0) {
            throw new Error(`Error: No + label '${label}' found after ${currentAddress.toString(16)}.`);
        }
        debug("findNextLabel possibleTargets", possibleTargets);
        return Math.min(...possibleTargets); // Return the closest one
    }
    /**
     * Finds the previous occurrence of a `-` label based on SNES memory position.
     * @param {string} label The label to find.
     * @returns {number} The address of the previous label.
     */
    findPreviousLabel(label) {
        debug("findPreviousLabel", label);
        const depth = label.length; // Number of `-` signs
        const currentAddress = this.snespos;
        // **Pass 0: Don't resolve labels yet, just track**
        if (this.pass === 0) {
            return 0; // Temporary placeholder, will be resolved in Pass 2
        }
        // **Pass 2: Resolve properly**
        if (!this.backwardLabels[depth] || this.backwardLabels[depth].length === 0) {
            throw new Error(`Error: No - label '${label}' found before ${currentAddress.toString(16)}.`);
        }
        // **Find the first label that is BEFORE the current address**
        const possibleTargets = this.backwardLabels[depth].filter(addr => addr < currentAddress);
        if (possibleTargets.length === 0) {
            throw new Error(`Error: No - label '${label}' found before ${currentAddress.toString(16)}.`);
        }
        debug("findPreviousLabel possibleTargets", possibleTargets);
        return Math.max(...possibleTargets); // Return the closest one
    }
    /**
     * Handles setting a label in the assembler.
     * @param {string} label - The label to set.
     * @param {number} value - The value to set the label to.
     * @param {boolean} isStatic - Whether the label is static.
     */
    setLabel(label, value, isStatic = false) {
        debug("setLabel", { label, value, isStatic });
        const fullLabel = this.currentNamespace ? `${this.currentNamespace}:${label}` : label;
        const addr = (value !== undefined) ? value : this.snespos;
        if (this.pass === 0) {
            debug("setLabel pass 0", { fullLabel, addr, addrHex: addr.toString(16), isStatic });
            if (this.labelTable.has(fullLabel)) {
                debug(`setLabel ⚠️ Warning: Label '${fullLabel}' redefined.`);
            }
            this.labelTable.set(fullLabel, { value: addr, isStatic });
        }
        else if (this.pass === 1) {
            debug("setLabel pass 1", { fullLabel, addr, addrHex: addr.toString(16), isStatic });
            this.labelTable.set(fullLabel, { value: addr, isStatic });
        }
        else if (this.pass === 2) {
            if (!this.labelTable.has(fullLabel)) {
                throw new Error(`Error: Label '${fullLabel}' used but not defined.`);
            }
            debug("setLabel pass 2", { fullLabel, addr, addrHex: addr.toString(16), isStatic });
            // Optionally, you might check that a label expected to be static actually is.
            const entry = this.labelTable.get(fullLabel);
            if (isStatic && !entry.isStatic) {
                throw new Error(`Error: Label '${fullLabel}' is not static and cannot be used in conditionals.`);
            }
        }
        else {
            throw new Error(`Error: Label '${fullLabel}' used in pass ${this.pass}.`);
        }
    }
    /**
     * Retrieves the address of a stored label.
     * @param {string} label The label to retrieve the value of.
     * @param {boolean} requireStatic Whether the label must be static.
     * @returns {number} The value of the label.
     */
    getLabelValue(label, requireStatic) {
        debug("getLabelValue", { label, requireStatic });
        const fullLabel = this.currentNamespace ? `${this.currentNamespace}:${label}` : label;
        debug("getLabelValue fullLabel", fullLabel);
        // debug("getLabelValue labelTable", this.labelTable);
        if (!this.labelTable.has(fullLabel)) {
            // In pass 0, allow forward references by returning a dummy value.
            // if (this.pass === 0) {
            //   debug('getLabelValue =', 0)
            //   return 0;
            // }
            return 0;
        }
        const entry = this.labelTable.get(fullLabel);
        if (requireStatic && !entry.isStatic) {
            throw new Error(`Error: Non-static label '${label}' used in conditional.`);
        }
        debug("getLabelValue =", entry.value, "/", entry.value.toString(16));
        return entry.value;
    }
    /**
     * Handles `for` loops.
     * @param {string[]} condition - The condition for the loop.
     */
    handleFor(condition) {
        if (this.pass === 0)
            return; // Skip in pass 0
        // Build the original for statement to pass to the new method
        const forStatement = `for ${condition.join(" ")}`;
        this.beginLoopCollection("for", forStatement);
    }
    /**
     * Handles the end of a `for` loop.
     */
    handleEndFor() {
        if (this.pass === 0)
            return; // Skip in pass 0
        this.endLoopCollection("for");
    }
    /**
     * Adds a mapping of the current address to the source line number.
     * @param {number} address The SNES address to add to the mapping.
     */
    addAddressToLine(address) {
        if (this.pass === 2) {
            this.addressToLineMapping.includeMapping(this.currentFile, this.currentLine + 1, address);
        }
    }
    /**
     * Handles `if` statements.
     * @param {string[]} condition The condition for the if statement.
     */
    handleIf(condition) {
        debug("handleIf", condition);
        const conditionStr = condition.join(" ");
        const conditionResult = this.evaluateExpression(conditionStr);
        // Push an "if" entry with an additional flag to indicate if this branch was taken
        this.condStack.push({
            type: "if",
            cond: conditionResult,
            branchTaken: conditionResult // Track if this or any subsequent branch was taken
        });
        // Update the global flag (all conditions must be true to run commands).
        this.moreonlinecond = this.condStack.every(entry => entry.cond);
    }
    /**
     * Handles `elseif` statements.
     * @param {string[]} condition The condition for the elseif statement.
     */
    handleElseIf(condition) {
        debug("handleElseIf", condition);
        // Ensure we are inside an if block.
        if (this.condStack.length === 0 || this.condStack[this.condStack.length - 1].type !== "if") {
            throw new Error("Misplaced elseif");
        }
        // Get the current conditional context
        const current = this.condStack[this.condStack.length - 1];
        // If any previous branch in this if-block was already taken,
        // or if the current condition is false, set cond to false
        if (current.branchTaken) {
            // A previous branch was already taken, so this elseif should be skipped
            current.cond = false;
        }
        else {
            // No branch taken yet, evaluate this condition
            const conditionStr = condition.join(" ");
            const conditionResult = this.evaluateExpression(conditionStr);
            current.cond = conditionResult;
            // If this condition is true, mark that a branch has been taken
            if (conditionResult) {
                current.branchTaken = true;
            }
        }
        this.moreonlinecond = this.condStack.every(entry => entry.cond);
    }
    /**
     * Handles `else` statements.
     */
    handleElse() {
        debug("handleElse");
        if (this.condStack.length === 0 || this.condStack[this.condStack.length - 1].type !== "if") {
            throw new Error("Misplaced else");
        }
        // Get the current conditional context
        const current = this.condStack[this.condStack.length - 1];
        // Only enter the else block if no previous branch was taken
        if (current.branchTaken) {
            current.cond = false;
        }
        else {
            current.cond = true;
            current.branchTaken = true;
        }
        this.moreonlinecond = this.condStack.every(entry => entry.cond);
    }
    /**
     * Handles the end of an `if` statement.
     */
    handleEndIf() {
        debug("handleEndIf");
        if (this.condStack.length === 0 || this.condStack[this.condStack.length - 1].type !== "if") {
            throw new Error("Misplaced endif");
        }
        this.condStack.pop();
        this.moreonlinecond = this.condStack.every(entry => entry.cond);
    }
    /**
     * Handles `while` loops.
     * @param {string[]} condition - The condition for the loop.
     */
    handleWhile(condition) {
        if (this.pass === 0)
            return; // Skip in pass 0
        // Build the original while statement to pass to the new method
        const whileStatement = `while ${condition.join(" ")}`;
        this.beginLoopCollection("while", whileStatement);
    }
    /**
     * Handles the end of a `while` loop.
     */
    handleEndWhile() {
        if (this.pass === 0)
            return; // Skip in pass 0
        this.endLoopCollection("while");
    }
    /**
     * Handles `org` directive to set SNES memory location.
     * @param {string[]} params - The parameters for the org directive.
     */
    handleOrg(params) {
        debug("handleOrg", params);
        if (params.length !== 1) {
            throw new Error("ORG requires a single address parameter.");
        }
        const addressStr = params[0].trim();
        let addr = 0;
        // Support both `$` (hex) and standard decimal
        if (addressStr.startsWith("$")) {
            addr = parseInt(addressStr.substring(1), 16);
        }
        else {
            addr = parseInt(addressStr, 10);
        }
        debug("handleOrg addr", addr, addr.toString(16));
        if (isNaN(addr) || addr < 0 || addr > 0xFFFFFF) {
            throw new Error(`Invalid ORG address: ${params[0]}`);
        }
        this.snespos = addr;
        this.realsnespos = addr;
        this.startpos = addr;
        this.realstartpos = addr;
    }
    /**
     * Handles `db`, `dw`, `dl`, `dd` directives for defining data.
     * @param {string} type - The type of data directive.
     * @param {string[]} params - The parameters for the data directive.
     */
    handleDataDirective(type, params) {
        debug("handleDataDirective", type, params);
        if (!Array.isArray(params) || params.length === 0) {
            throw new Error(`${type.toUpperCase()} directive requires at least one parameter.`);
        }
        if (this.pass === 0) {
            debug("handleDataDirective pass 0, skipping");
            return;
        }
        // Support for SNASM-style data directives.
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
            "db": 1,
            "dw": 2,
            "dl": 3,
            "dd": 4,
        };
        const len = lengthMap[type.toLowerCase()];
        if (!len) {
            throw new Error(`Invalid data directive: ${type}`);
        }
        // Split by comma to correctly handle multiple values
        const values = params.join(" ").split(",").map(val => val.trim());
        for (let value of values) {
            if (value.startsWith('"') || value.startsWith("'")) {
                debug("handleDataDirective string literals", value);
                // Handle string literals
                const unquoted = value.slice(1, -1);
                debug("handleDataDirective string literal unquoted", unquoted);
                // Use character mapping for each character
                const mappedChars = this.processStringWithMapping(unquoted);
                for (const charValue of mappedChars) {
                    this.writeDataByLength(len, charValue);
                }
            }
            else {
                debug("handleDataDirective numeric values", value);
                // Handle numeric values
                if (value.startsWith("#")) {
                    console.warn("Warning: # before numbers in db/dw/... is deprecated. Remove the #.");
                    value = value.substring(1);
                }
                // First resolve any defines in the expression so that tokens like "FillCount" are replaced.
                const resolved = this.resolvedefines(value);
                // Check if this is a struct reference (e.g., "sprite.x_pos")
                let num;
                try {
                    const structValue = this.resolveStructLabel(resolved);
                    debug("handleDataDirective struct reference", { resolved, structValue });
                    if (typeof structValue === "number" && !Number.isNaN(structValue)) {
                        num = structValue;
                        debug("handleDataDirective using struct value", num);
                        this.writeDataByLength(len, num);
                        continue;
                    }
                }
                catch (error) {
                    debug("handleDataDirective struct resolution failed, trying math evaluation");
                    // If struct resolution fails, continue with normal evaluation
                    num = this.mathCore.math(resolved);
                }
                if (Number.isNaN(num)) {
                    // As a fallback, try to look up a label (this assumes it's a static label).
                    num = this.getLabelValue(resolved, true);
                }
                debug("handleDataDirective numeric num", num);
                if (Number.isNaN(num)) {
                    debug("handleDataDirective unable to determine value:", num);
                    throw new Error("Unable to determine value:");
                }
                this.writeDataByLength(len, num);
            }
        }
        this.addAddressToLine(this.realsnespos & 0xFFFFFF);
    }
    /**
     * Writes data of the specified length.
     * @param {number} len The length of the data to write.
     * @param {number} value The value to write.
     */
    writeDataByLength(len, value) {
        debug("writeDataByLength", { len, value });
        // TODO Why is len a string here sometimes?
        if (typeof len !== "number") {
            len = Number.parseInt(len, 10);
            if (Number.isNaN(len)) {
                throw new Error("writeDataByLength: len is NaN");
            }
        }
        debug("writeDataByLength", { len: len.toString(16), value: value.toString(16) });
        switch (len) {
            case 1:
                this.write1(value);
                break;
            case 2:
                this.write2(value);
                break;
            case 3:
                this.write3(value);
                break;
            case 4:
                this.write4(value);
                break;
            default:
                throw new Error(`Unsupported data length ${len}`);
        }
    }
    /**
     * Pushes the current namespace.
     */
    handlePushNamespace() {
        debug("handlePushNamespace");
        this.namespaceStack.push(this.currentNamespace);
    }
    /**
     * Restores the previous namespace.
     */
    handlePullNamespace() {
        debug("handlePullNamespace");
        if (this.namespaceStack.length === 0) {
            throw new Error("pullns without pushns");
        }
        this.currentNamespace = this.namespaceStack.pop();
    }
    /**
     * Handles `namespace` definitions.
     * @param {string[]} params - The parameters for the namespace directive.
     */
    handleNamespace(params) {
        debug("handleNamespace", params);
        if (params.length === 0) {
            this.currentNamespace = "";
            return;
        }
        const action = params[0].toLowerCase();
        if (action === "off") {
            this.currentNamespace = "";
        }
        else {
            this.currentNamespace = params[0];
        }
    }
    /**
     * Pushes the current PC onto the pushpcStack.
     */
    handlePushPC() {
        debug("handlePushPC");
        if (this.pushpcnum >= 256) {
            throw new Error("PushPC stack overflow.");
        }
        this.pushpcStack.push({
            snespos: this.snespos,
            startpos: this.startpos,
            realsnespos: this.realsnespos,
            realstartpos: this.realstartpos,
        });
        this.pushpcnum++;
    }
    /**
     * Restores the previous PC.
     */
    handlePullPC() {
        debug("handlePullPC");
        if (this.pushpcnum === 0) {
            throw new Error("PullPC without PushPC.");
        }
        const state = this.pushpcStack.pop();
        this.snespos = state.snespos;
        this.startpos = state.startpos;
        this.realsnespos = state.realsnespos;
        this.realstartpos = state.realstartpos;
        this.pushpcnum--;
    }
    /**
     * Handles `struct` definitions.
     * @param {string[]} words The parameters for the struct directive.
     */
    handleStruct(words) {
        debug("handleStruct", words);
        // Syntax:
        // struct {identifier} {snes_address}      OR
        // struct {extension_identifier} extends {parent_identifier}
        if (words.length < 3) {
            throw new Error("Struct definition requires at least two parameters.");
        }
        const structName = words[1];
        let base;
        let parent;
        if (words[2].toLowerCase() === "extends") {
            // Format: struct ExtensionName extends ParentName
            if (words.length < 4) {
                throw new Error("Struct extension must specify a parent struct.");
            }
            parent = words[3];
            // Look up the parent struct – it must exist.
            if (!this.structs.has(parent)) {
                throw new Error(`Parent struct '${parent}' not defined.`);
            }
            // For an extension, we use the parent's base.
            base = this.structs.get(parent).base;
        }
        else {
            // Otherwise, words[2] is the SNES address.
            base = this.getnum(words[2]);
            if (base < 0 || base > 0xFFFFFF) {
                throw new Error(`Invalid SNES address for struct: ${words[2]}`);
            }
        }
        // Save current PC before changing it.
        this.savedPCStack.push(this.snespos);
        // Set the base for the struct.
        this.snespos = base;
        this.startpos = base;
        this.realsnespos = base;
        this.realstartpos = base;
        // Create a new struct definition with an initial offset of zero.
        this.currentStruct = {
            name: structName,
            base,
            offset: 0,
            size: 0, // will be set in endstruct
            labels: new Map(),
            parent,
        };
        debug(`handleStruct entered struct mode: ${structName}, base ${base.toString(16)}` +
            (parent ? `, extending ${parent}` : ""));
    }
    /**
     * Handles the end of a struct definition.
     * @param {string[]} words The parameters for the endstruct directive.
     */
    handleEndStruct(words) {
        debug("handleEndStruct", words);
        if (!this.currentStruct) {
            throw new Error("endstruct encountered but not inside a struct definition.");
        }
        // Optionally, words might be: endstruct align {num}
        let align;
        if (words.length >= 2 && words[1].toLowerCase() === "align") {
            if (words.length !== 3) {
                throw new Error("endstruct align requires a single alignment parameter.");
            }
            align = this.getnum(words[2]);
            if (align < 1) {
                throw new Error("Alignment must be at least 1.");
            }
        }
        // Final computed size is the current offset.
        let finalSize = this.currentStruct.offset;
        if (align !== undefined) {
            // Round up to the next multiple of align.
            finalSize = Math.ceil(finalSize / align) * align;
            this.currentStruct.align = align;
        }
        debug("handleEndStruct finalSize", finalSize);
        this.currentStruct.size = finalSize;
        // If this is an extension struct, update the parent's extensionSize.
        if (this.currentStruct.parent) {
            const parentName = this.currentStruct.parent;
            const parentStruct = this.structs.get(parentName);
            const extSize = this.currentStruct.size;
            // If parent's extensionSize is not defined or this extension is larger, update it.
            if (!parentStruct.extensionSize || extSize > parentStruct.extensionSize) {
                parentStruct.extensionSize = extSize;
            }
            // Also register this extension's labels under a combined name,
            // for example "Parent.Extension.Member" if desired.
            // (For simplicity we can also store the extension as a separate entry.)
            this.structs.set(`${parentName}.${this.currentStruct.name}`, this.currentStruct);
            debug(`handleEndStruct defined extension struct: "${this.currentStruct.name}" extending "${parentName}", size ${finalSize}`);
        }
        else {
            // Normal (non-extension) struct: store it by its name.
            this.structs.set(this.currentStruct.name, this.currentStruct);
            debug(`handleEndStruct defined struct: "${this.currentStruct.name}", size ${finalSize}`);
        }
        // Restore the previous PC.
        if (this.savedPCStack.length > 0) {
            this.snespos = this.savedPCStack.pop();
            this.startpos = this.snespos;
            this.realsnespos = this.snespos;
            this.realstartpos = this.snespos;
        }
        // Clear current struct.
        this.currentStruct = null;
    }
    /**
     * Resolves a struct label reference to its base address.
     * @param {string} labelRef The label reference to resolve.
     * @returns {number} The resolved base address.
     */
    resolveStructLabel(labelRef) {
        debug("resolveStructLabel", labelRef);
        // First check if the reference contains dots that might indicate a parent-extension relationship
        const refParts = labelRef.split(".");
        if (refParts.length === 2 && !labelRef.includes("[")) {
            debug("resolveStructLabel parent.extension reference", refParts);
            // This could be a parent.extension reference
            const parentName = refParts[0];
            const extensionName = refParts[1];
            // Check if parent exists
            if (this.structs.has(parentName)) {
                const parentDef = this.structs.get(parentName);
                // Check if the extension exists as a struct
                if (this.structs.has(labelRef) && this.structs.get(labelRef).parent === parentName) {
                    // This is a valid parent.extension reference
                    // Return the parent's base address + parent's size
                    debug(`resolveStructLabel parent.extension reference: ${parentName}.${extensionName}, base=${parentDef.base}, size=${parentDef.size}`);
                    return parentDef.base + parentDef.size;
                }
            }
        }
        // Next, if the entire reference exists in our struct map, assume it's a full struct reference.
        if (this.structs.has(labelRef)) {
            debug("resolveStructLabel found entire reference =", labelRef);
            return this.structs.get(labelRef).base;
        }
        // Example labelRef: "ObjectList.PosY" or "ObjectList[2].PosY"
        // Check if an array index is specified, e.g. "TestStruct.NewStruct[2].new"
        // Otherwise, check if an array index is specified, e.g. "TestStruct[2].member"
        let arrayIndex = 0;
        let candidate = labelRef;
        let extraMember = "";
        const arrayRegex = /^(.*?)\[(\d+)](.*)$/;
        const arrayMatch = candidate.match(arrayRegex);
        if (arrayMatch) {
            candidate = arrayMatch[1];
            arrayIndex = Number.parseInt(arrayMatch[2], 10);
            extraMember = arrayMatch[3];
            if (extraMember.startsWith(".")) {
                extraMember = extraMember.substring(1);
            }
        }
        debug("resolveStructLabel candidate", candidate);
        debug("resolveStructLabel arrayIndex", arrayIndex);
        debug("resolveStructLabel extraMember", extraMember);
        // Split candidate by dot
        const parts = candidate.split(".");
        // Try to find the longest prefix that is a defined struct.
        for (let i = parts.length; i >= 1; i--) {
            const potential = parts.slice(0, i).join(".");
            if (this.structs.has(potential)) {
                const def = this.structs.get(potential);
                // Everything after the prefix (plus any extraMember from an array index) is the member name.
                const memberPart = parts.slice(i).join(".");
                const memberName = memberPart + (extraMember ? (memberPart ? "." : "") + extraMember : "");
                // Calculate the effective struct size, accounting for extensions and alignment
                const baseStructSize = def.size;
                let effectiveSize = baseStructSize;
                // Check if the struct has an alignment that would affect its effective size
                if (def.align) {
                    // Adjust to the next multiple of the alignment
                    const alignedSize = Math.ceil(baseStructSize / def.align) * def.align;
                    debug(`resolveStructLabel struct has alignment: ${def.align}, adjusting size from ${baseStructSize} to ${alignedSize}`);
                    effectiveSize = alignedSize;
                }
                // Find the largest extension of this struct
                let maxExtensionSize = 0;
                for (const [_structName, structDef] of this.structs.entries()) {
                    if (structDef.parent === potential && structDef.size > maxExtensionSize) {
                        maxExtensionSize = structDef.size;
                    }
                }
                // If we have extensions, add the largest one's size to our effective size
                if (maxExtensionSize > 0) {
                    debug(`resolveStructLabel maxExtensionSize: ${maxExtensionSize}, adding to effectiveSize: ${effectiveSize} -> ${effectiveSize + maxExtensionSize}`);
                    effectiveSize += maxExtensionSize;
                }
                // If no member was specified, this is a reference to the struct itself.
                // But we still need to account for array indexing.
                if (memberName.trim() === "") {
                    if (arrayIndex > 0) {
                        // For array indexing without a member, return base + (index * size)
                        const arrayAddress = def.base + (arrayIndex * effectiveSize);
                        debug(`resolveStructLabel array indexing without member: ${def.base} + (${arrayIndex} * ${effectiveSize}) = ${arrayAddress}`);
                        return arrayAddress;
                    }
                    else {
                        debug("resolveStructLabel no memberName =", def.base, "/", def.base.toString(16));
                        return def.base;
                    }
                }
                // Print all struct labels for debugging
                debug("resolveStructLabel struct labels for", potential);
                for (const [key, value] of def.labels.entries()) {
                    debug(`  ${key}: ${value}`);
                }
                // When accessing a nested member, we need to parse the member path to get the correct offset
                // For example: for "DMA.size" we need just the offset of "size"
                // and NOT include the sizes of "size_low" and "size_high"
                const memberParts = memberName.split(".");
                const topLevelMember = memberParts[0];
                // Check if the top-level member exists in the struct
                if (!def.labels.has(topLevelMember)) {
                    throw new Error(`Member '${topLevelMember}' not defined in struct '${potential}'.`);
                }
                // Get the offset of the top-level member only
                const offset = def.labels.get(topLevelMember);
                // Debug the exact member we're looking up and its offset
                debug(`resolveStructLabel looking up member "${topLevelMember}" with offset ${offset}`);
                let finalAddress;
                if (def.parent) {
                    debug("resolveStructLabel parent", def.parent);
                    const parentDef = this.structs.get(def.parent);
                    if (!parentDef) {
                        throw new Error(`Parent struct '${def.parent}' not defined for extension '${potential}'.`);
                    }
                    // Determine parent's aligned size if it has alignment
                    let parentSize = parentDef.size;
                    if (parentDef.align) {
                        parentSize = Math.ceil(parentSize / parentDef.align) * parentDef.align;
                        debug(`resolveStructLabel parent has alignment: ${parentDef.align}, adjusted size: ${parentSize}`);
                    }
                    // For extension struct array members, we need to:
                    // 1. Start at the base address
                    // 2. Add parent size once (to get to the extension part)
                    // 3. For array indexing, multiply index by the extension size only
                    // 4. Add offset to the specific member
                    if (arrayIndex === 0) {
                        // For the first instance, we need to add the parent size to get to the extension
                        finalAddress = parentDef.base + parentSize + offset;
                        debug(`resolveStructLabel extension struct with no array: ${parentDef.base} + ${parentSize} + ${offset} = ${finalAddress}`);
                    }
                    else {
                        // For array indexing, use parent size once plus array index * extension size
                        finalAddress = parentDef.base + parentSize + (arrayIndex * def.size) + offset;
                        debug(`resolveStructLabel extension struct with array: ${parentDef.base} + ${parentSize} + (${arrayIndex} * ${def.size}) + ${offset} = ${finalAddress}`);
                    }
                }
                else {
                    // For regular structs, use the aligned struct size for array indexing
                    debug("resolveStructLabel no parent finalAddress:", def.base, "+", "(", arrayIndex, "*", effectiveSize, ")", "+", offset);
                    finalAddress = def.base + (arrayIndex * effectiveSize) + offset;
                }
                debug("resolveStructLabel =", finalAddress, "/", finalAddress.toString(16));
                return finalAddress;
            }
        }
        throw new Error(`Struct not defined in reference: ${labelRef}`);
    }
    /**
     * Evaluates a range expression and returns the result.
     * @param {string} expr The expression to evaluate.
     * @returns {number} The result of the expression.
     */
    evaluateRangeExpression(expr) {
        debug("assemlber evaluateRangeExpression", expr);
        expr = expr.trim();
        // Try evaluating the expression numerically.
        try {
            const result = this.mathCore.math(expr);
            if (result && !Number.isNaN(result)) {
                return result;
            }
        }
        catch (error) { }
        // If that fails, assume it's a static label.
        // (Pass 'true' to require that the label be static.)
        return this.getLabelValue(expr, true);
    }
    /**
     * Handles the `incbin` directive.
     * @param {string[]} words The words from the `incbin` directive.
     */
    handleIncbin(words) {
        debug("handleIncbin", words);
        // Check for deprecated target syntax with "->"
        let targetLocationSpecified = false;
        let targetLocation = null;
        const arrowIndex = words.indexOf("->");
        if (arrowIndex !== -1) {
            targetLocationSpecified = true;
            if (arrowIndex + 1 >= words.length) {
                throw new Error("incbin '->' syntax requires a target location.");
            }
            targetLocation = words[arrowIndex + 1];
            debug("handleIncbin arrow syntax targetLocation", targetLocation);
            // Remove the arrow and target from the tokens
            words = words.slice(0, arrowIndex);
        }
        // Parse filename and range
        const filenameWithRange = words[1];
        debug("handleIncbin filenameWithRange", filenameWithRange);
        let filename;
        let rangeStr = null;
        const colonIndex = filenameWithRange.indexOf(":");
        if (colonIndex !== -1) {
            filename = filenameWithRange.substring(0, colonIndex);
            rangeStr = filenameWithRange.substring(colonIndex + 1);
        }
        else {
            filename = filenameWithRange;
        }
        // Remove quotes from filename if present
        filename = filename.replace(/^"(.*)"$/, "$1");
        // Read the file
        const fileData = this.readFile(filename);
        if (!fileData) {
            throw new Error(`Failed to read file: ${filename}`);
        }
        // Determine range to copy
        let startOffset = 0;
        let endOffset = fileData.length;
        if (rangeStr) {
            // Use new ".." syntax if present, otherwise try deprecated "-" syntax
            let parts;
            if (rangeStr.indexOf("..") !== -1) {
                parts = rangeStr.split("..");
            }
            else if (rangeStr.indexOf("-") !== -1) {
                parts = rangeStr.split("-");
            }
            else {
                throw new Error(`Invalid range specification: ${rangeStr}`);
            }
            if (parts[0] === "" || parts[1] === "") {
                throw new Error(`Invalid range specification: ${rangeStr}`);
            }
            startOffset = this.evaluateRangeExpression(parts[0]);
            endOffset = this.evaluateRangeExpression(parts[1]);
            // A value of 0 for endOffset means "until EOF"
            if (endOffset === 0) {
                endOffset = fileData.length;
            }
        }
        if (startOffset > endOffset || startOffset < 0 || startOffset > fileData.length) {
            throw new Error(`Start offset ${startOffset} out of bounds for file ${filename}`);
        }
        if (endOffset < startOffset || endOffset > fileData.length) {
            throw new Error(`End offset ${endOffset} out of bounds for file ${filename}`);
        }
        const incbinData = fileData.slice(startOffset, endOffset);
        debug(`handleIncbin copying ${incbinData.length} bytes from '${filename}' (offset ${startOffset} to ${endOffset}) at ${this.snespos.toString(16)} (PC: ${this.snestopc(this.realsnespos & 0xFFFFFF).toString(16)})`);
        if (targetLocationSpecified) {
            debug("handleIncbin targetLocation", targetLocation);
            // Save current position
            this.handlePushPC();
            let targetAddress;
            // Check if target location starts with $ or is a valid number
            if (/^\$?[\dA-Fa-f]+$/.test(targetLocation)) {
                // Handle as numeric address
                targetAddress = this.getnum(targetLocation);
                debug("handleIncbin targetAddress", targetAddress);
                // Set the position for numeric address
                this.snespos = targetAddress;
                this.realsnespos = targetAddress;
                this.startpos = targetAddress;
                this.realstartpos = targetAddress;
            }
            else {
                // Handle as label name
                if (this.pass === 0) {
                    debug("handleIncbin targetLocation is label, pass 0");
                    // On pass 0, create a freespace block first
                    // this.handleFreespace("freespace", ["align"]);
                    // Now that freespace has set snespos, we can set the label
                    this.setLabel(targetLocation, this.snespos);
                    // Don't write data on pass 0
                    this.handlePullPC();
                    return;
                }
                else {
                    // On later passes, look up the label's address
                    targetAddress = this.getLabelValue(targetLocation, false);
                    debug("handleIncbin targetAddress", targetAddress);
                    this.snespos = targetAddress;
                    this.realsnespos = targetAddress;
                    this.startpos = targetAddress;
                    this.realstartpos = targetAddress;
                }
            }
            // Write the data
            for (const byte of incbinData) {
                this.write1(byte);
            }
            // Restore original position
            this.handlePullPC();
        }
        else {
            // Normal incbin: write at current position
            for (const byte of incbinData) {
                this.write1(byte);
            }
        }
        this.addAddressToLine(this.realsnespos & 0xFFFFFF);
    }
    /**
     * Sets the paths to search for included files.
     * @param {string[]} paths The paths to search for included files.
     */
    setIncludePaths(paths) {
        this.includePaths = paths;
    }
    /**
     * Evaluates an expression for conditionals (if, while).
     * @param {string} expression - The expression to evaluate.
     * @returns {boolean} True if the expression is true, false otherwise.
     */
    evaluateExpression(expression) {
        debug("evaluateExpression", expression);
        // Resolve defines so tokens like "!FOO" get replaced.
        const resolvedExpr = this.resolvedefines(expression);
        debug("evaluateExpression resolvedExpr", resolvedExpr);
        let result;
        try {
            result = this.mathCore.math(resolvedExpr);
        }
        catch (e) {
            throw new Error(`Error evaluating expression "${expression}" (resolved to "${resolvedExpr}"): ${e}`);
        }
        // In our assembler, a condition is true if the result is nonzero.
        debug("evaluateExpression result", result, "=>", result !== 0);
        debug("evaluateExpression =", result !== 0);
        return result !== 0;
    }
    /**
     * Resolves all define replacements in a given string.
     * @param {string} input The string to resolve defines in.
     * @returns {string} The string with defines resolved.
     */
    resolvedefines(input) {
        debug("resolvedefines", input);
        debug("resolvedefines defines", this.defines);
        let result = "";
        let index = 0;
        // Special case for expressions with != operator
        // This prevents issues with != being misinterpreted as a define
        if (input.includes("!=")) {
            debug("resolvedefines != operator found in", input);
            // Process each part of the expression separately
            const parts = input.split("!=");
            const resolvedParts = parts.map(part => this.resolvedefines(part.trim()));
            return resolvedParts.join("!=");
        }
        if ((input.startsWith("sizeof(") || input.startsWith("objectsize(")) && input.endsWith(")")) {
            debug("resolvedefines sizeof found, skipping", input);
            return input;
        }
        // Helper function to look up a variable name with priority for loop variables
        const lookupVariable = (varName) => {
            debug("resolvedefines lookupVariable", varName);
            // First check if this variable is directly defined
            const defineValue = this.defines.get(varName);
            if (defineValue !== undefined) {
                debug(`resolvedefines found variable ${varName} with value ${defineValue}`);
                return defineValue;
            }
            // Check active loops from innermost to outermost (for backward compatibility)
            for (let i = this.whileStatus.length - 1; i >= 0; i--) {
                const loop = this.whileStatus[i];
                if (loop.is_for && loop.for_variable === varName) {
                    debug(`resolvedefines found loop variable ${varName} with value ${loop.for_cur}`);
                    return loop.for_cur.toString();
                }
            }
            // Not found - return undefined
            return undefined;
        };
        // Special case for direct variable reference like "!i"
        if (input.startsWith("!") && !input.includes(" ") && !input.includes("=")) {
            const varName = input.substring(1);
            const value = lookupVariable(varName);
            if (value !== undefined) {
                return value;
            }
        }
        // Process any explicit !defines
        while (index < input.length) {
            const char = input[index];
            if (char === "\\" && input[index + 1] === "\\") {
                debug("resolvedefines double slash", input);
                result += "\\";
                index += 2;
            }
            else if (char === "\\" && input[index + 1] === "!") {
                debug("resolvedefines \\!define", input);
                result += "!";
                index += 2;
            }
            else if (char === "!") {
                debug("resolvedefines !define", input);
                let defineName = "";
                index++; // skip the !
                if (input[index] === "{") {
                    index++;
                    let unprocessedName = "";
                    let braces = 1;
                    while (index < input.length) {
                        if (input[index] === "{")
                            braces++;
                        if (input[index] === "}")
                            braces--;
                        if (braces === 0)
                            break;
                        unprocessedName += input[index++];
                    }
                    if (braces !== 0)
                        throw new Error("Error: Mismatched braces in define name.");
                    index++; // skip the closing }
                    defineName = this.resolvedefines(unprocessedName);
                    debug("resolvedefines !define defineName", defineName);
                }
                else {
                    while (index < input.length && /\w/.test(input[index])) {
                        defineName += input[index++];
                    }
                    debug("resolvedefines !define defineName", defineName);
                }
                // Look up the variable using our helper function
                const value = lookupVariable(defineName);
                if (value === undefined) {
                    throw new Error(`Define '${defineName}' not found.`);
                }
                else {
                    result += value;
                }
            }
            else {
                result += char;
                index++;
            }
        }
        debug("resolvedefines result =", { result });
        return result;
    }
    /**
     * Gets a numeric value from an operand.
     * @param {string} operand The operand to get the numeric value of.
     * @returns {number} The numeric value of the operand.
     */
    getnum(operand) {
        debug("getnum", operand);
        // Remove whitespace
        operand = operand.trim();
        // First, expand any defines.
        operand = this.resolvedefines(operand);
        // If immediate, strip the '#' but keep everything else
        if (operand.startsWith("#")) {
            operand = operand.substring(1).trim();
        }
        // If the operand does not start with a literal indicator,
        // assume it is a label or a struct reference.
        if (!operand.match(/^[\d$%]/)) {
            // If it contains a dot or an opening bracket, treat it as a struct reference.
            if (operand.indexOf(".") !== -1 || operand.indexOf("[") !== -1) {
                try {
                    const addr = this.resolveStructLabel(operand);
                    debug("getnum (struct resolved) =", addr);
                    return addr;
                }
                catch (e) {
                    // Fall back to a normal label lookup.
                    const labelValue = this.getLabelValue(operand, false);
                    debug("getnum (label resolved) =", labelValue, "/", labelValue.toString(16));
                    return labelValue;
                }
            }
            else if (/^\w+$/.test(operand)) {
                // Otherwise, treat the operand as a label.
                const labelValue = this.getLabelValue(operand, false);
                debug("getnum (label resolved) =", labelValue, "/", labelValue.toString(16));
                return labelValue;
            }
        }
        // Otherwise, assume the operand is a literal math expression.
        const value = this.mathCore.math(operand);
        debug("getnum (literal) =", value, "/", value.toString(16));
        return value;
    }
    /**
     * Sets the current pass of assembly.
     * @param {number} pass - The pass number to set.
     */
    setPass(pass) {
        debug("🏁 setPass", pass);
        this.pass = pass;
    }
    /**
     * Completes the current pass, performing any necessary cleanup.
     */
    finishPass() {
        // TODO Make an option
        if (this.targetRom && this.targetRom.length > 0) {
            this.updateHeaderAndCRC32();
        }
    }
    /**
     * Sets the current file being processed.
     * @param {string} filename - The filename to set.
     */
    setCurrentFile(filename) {
        debug("setCurrentFile", filename);
        this.currentFile = filename;
        this.currentLine = 0;
    }
    /**
     * Sets the current line number.
     * @param {number} line - The line number to set.
     */
    setCurrentLine(line) {
        // debug('setCurrentLine', line);
        this.currentLine = line;
    }
    /**
     * Writes a block of data to ROM.
     * @param {number} start The starting address of the block to write.
     * @param {number} value The byte value to write.
     * @param {number} [length] The length of the block to write.
     */
    writeDataBytes(start, value, length = 1) {
        debug("writeDataBytes", { start, value, length });
        if (typeof start !== "number" || typeof value !== "number" || typeof length !== "number") {
            throw new Error("writeDataBytes requires a number for start, value, and length");
        }
        if (value > 0xFF) {
            debug("writeDataBytes 💥 value must be less than 0xFF", value);
        }
        debug("writeDataBytes before this.romdata.length", this.romdata.length, "/", this.romdata.length.toString(16));
        for (let i = 0; i < length; i++) {
            this.romdata[start + i] = value & 0xFF;
        }
        debug("writeDataBytes after this.romdata.length", this.romdata.length, "/", this.romdata.length.toString(16));
    }
    /**
     * Expands ROM size and fills it with a specified byte.
     * @param {number} newSize The new size of the ROM.
     * @param {number} fsByte The byte value to fill the ROM with.
     */
    expandRom(newSize, fsByte) {
        debug("expandRom", { newSize, fsByte });
        if (typeof newSize !== "number" || typeof fsByte !== "number") {
            throw new Error("expandRom requires a number for newSize and fsByte");
        }
        if (newSize > this.romdata.length) {
            this.writeDataBytes(this.romlen, fsByte, newSize - this.romlen);
            this.romlen = newSize;
        }
        else {
            debug("expandRom newSize <= this.romdata.length, no expansion needed");
        }
    }
    /**
     * Checks if a given ROM region is empty.
     * @param {number} start - The starting address of the region to check.
     * @param {number} size - The size of the region to check.
     * @param {number} fsByte - The byte value to check for.
     * @returns {boolean} True if the region is empty, false otherwise.
     */
    isBlockEmpty(start, size, fsByte) {
        debug("isBlockEmpty", { start, size, fsByte });
        for (let i = 0; i < size; i++) {
            if (this.romdata[start + i] !== fsByte) {
                debug("isBlockEmpty false:", this.romdata[start + i], "!==", fsByte);
                return false;
            }
        }
        return true;
    }
    /**
     * Expands an operand string into its expanded form and determines its expected length.
     * @param {string} operand The operand to expand.
     * @returns {{ expanded: string; length: number }} An object containing the expanded operand and its expected length.
     */
    expandOperand(operand) {
        debug("expandOperand", operand);
        let expanded = operand.trim();
        let expectedLength = 2; // Default to 2 bytes for most operands
        let forceTwoBytes = false; // Flag to force 2 bytes for bank operations
        try {
            expanded = this.resolvedefines(expanded);
        }
        catch (e) {
            debug("expandOperand not a define");
        }
        debug("expandOperand: after resolvedefines:", { expanded });
        try {
            expanded = `$${this.resolveStructLabel(expanded).toString(16).toUpperCase()}`;
        }
        catch (e) {
            debug("expandOperand not a struct label");
        }
        debug("expandOperand: after resolveStructLabel:", { expanded });
        // Check for bank shorthand operations before any other processing
        if (expanded.includes("<:") || expanded.includes("bank(") || expanded.includes("bankbyte(")) {
            forceTwoBytes = true;
            debug("expandOperand detected bank operation, forcing 2 bytes");
        }
        // Try to resolve label references before processing specific addressing modes
        // This handles cases like "label", "label,x", "[label]", etc.
        expanded = this.tryResolveLabelInOperand(expanded);
        debug("expandOperand: after label resolution:", { expanded });
        // Process the operand based on addressing mode
        if (expanded.startsWith("#")) {
            // Immediate mode
            debug("expandOperand immediate mode", expanded);
            const inner = expanded.substring(1).trim();
            // Check for bank operations in the inner expression
            if (inner.includes("<:") || inner.includes("bank(") || inner.includes("bankbyte(")) {
                forceTwoBytes = true;
                debug("expandOperand detected bank operation in immediate mode, forcing 2 bytes");
            }
            // Evaluate the inner expression if it's a hex value or numeric expression
            if (inner.startsWith("$")) {
                expectedLength = this.determineValueLength(inner.substring(1), forceTwoBytes);
            }
            else {
                try {
                    const value = this.getnum(inner);
                    expectedLength = this.determineValueLength(value, forceTwoBytes);
                    // Format the value as a hex literal and reconstruct immediate operand
                    const literal = "$" + value.toString(16).toUpperCase();
                    expanded = "#" + literal;
                }
                catch (e) {
                    debug(`Failed to evaluate immediate expression: ${inner}`);
                }
            }
        }
        else if (expanded.includes(",")) {
            // Indexed addressing mode
            debug("expandOperand indexed mode", expanded);
            if (expanded.startsWith("$")) {
                const hexPart = expanded.substring(1, expanded.indexOf(","));
                expectedLength = this.determineValueLength(hexPart);
            }
        }
        else if (expanded.startsWith("[") && expanded.endsWith("]")) {
            // Indirect addressing mode
            debug("expandOperand indirect addressing mode", expanded);
            expectedLength = 2;
        }
        else if (expanded.startsWith("$")) {
            // Direct addressing mode
            debug("expandOperand direct addressing mode", expanded);
            const hexPart = expanded.substring(1);
            expectedLength = this.determineValueLength(hexPart);
        }
        else {
            // Other modes (likely labels)
            debug("expandOperand other mode", expanded);
            expectedLength = 2; // Default for labels
        }
        // Evaluate math expressions
        if (this.isMathExpression(expanded)) {
            try {
                const resolvedValue = this.resolvedefines(expanded);
                const result = this.mathCore.math(resolvedValue);
                if (!Number.isNaN(result)) {
                    expanded = "$" + result.toString(16).toUpperCase();
                    expectedLength = this.determineValueLength(result, forceTwoBytes);
                    debug(`Evaluated math expression in define: ${resolvedValue} = ${expanded}`);
                }
            }
            catch (error) {
                debug(`Math evaluation skipped for expression: ${expanded}`);
            }
        }
        // Force 2 bytes if needed
        if (forceTwoBytes) {
            expectedLength = 2;
        }
        debug("expandOperand =", expanded, "length =", expectedLength);
        return { expanded, length: expectedLength };
    }
    /**
     * Determines the expected length based on a numeric value
     * @param {string|number} value The value to check (either hex string or numeric)
     * @param {boolean} [forceTwoBytes] Whether to force 2 bytes
     * @returns {number} The expected length in bytes
     */
    determineValueLength(value, forceTwoBytes) {
        debug("determineValueLength", value, forceTwoBytes);
        // Validate input
        if (typeof value !== "string" && typeof value !== "number") {
            throw new Error(`Invalid value type for length determination: ${typeof value}`);
        }
        if (Number.isNaN(value)) {
            throw new Error(`Invalid value for length determination: ${value}`);
        }
        if (typeof value === "string" && value.trim() === "") {
            return 1;
        }
        if (forceTwoBytes) {
            return 2;
        }
        // Convert the value to a hex string and handle each case
        let hexString;
        if (typeof value === "number") {
            // Convert number to hex string WITHOUT leading zeros
            hexString = value.toString(16).toUpperCase();
        }
        else if (typeof value === "string") {
            // If already a string, strip any '$' prefix if present
            hexString = value.startsWith("$") ? value.substring(1) : value;
        }
        // Get the length based on number of hex digits (2 hex digits = 1 byte)
        if (hexString.length <= 2) {
            return 1; // 1 byte (zero page)
        }
        else if (hexString.length <= 4) {
            return 2; // 2 bytes (absolute)
        }
        else {
            return 3; // 3 bytes (long)
        }
    }
    /**
     * Checks if a string contains math operators
     * @param {string} expression - The expression to check
     * @returns {boolean} True if the expression contains math operators
     */
    isMathExpression(expression) {
        if (!expression || typeof expression !== "string") {
            return false;
        }
        return expression.includes("+") ||
            expression.includes("-") ||
            expression.includes("*") ||
            expression.includes("/") ||
            expression.includes("&") ||
            expression.includes("|") ||
            expression.includes("^") ||
            expression.includes("<<") ||
            expression.includes(">>") ||
            expression.includes("(");
    }
    /**
     * Helper method to try resolving labels in different addressing modes
     * @param {string} operand - The operand to process
     * @returns {string} The operand with labels resolved to their values
     */
    tryResolveLabelInOperand(operand) {
        debug("tryResolveLabelInOperand", operand);
        // Handle immediate mode (#label)
        if (operand.startsWith("#")) {
            const inner = operand.substring(1).trim();
            if (!inner.match(/^[\d$%(]/) && !inner.includes(",")) {
                try {
                    const labelValue = this.getLabelValue(inner, false);
                    if (labelValue !== 0 || this.labelTable.has(inner) || this.labelTable.has(`${this.currentNamespace}:${inner}`)) {
                        debug("tryResolveLabelInOperand immediate mode", inner, "labelValue", labelValue, "/", labelValue.toString(16).toUpperCase());
                        return "#$" + labelValue.toString(16).toUpperCase();
                    }
                }
                catch (e) {
                    debug(`tryResolveLabelInOperand label resolution failed for immediate: ${inner}`);
                }
            }
            return operand;
        }
        // Handle indirect mode ([label])
        if (operand.startsWith("[") && operand.endsWith("]")) {
            const inner = operand.substring(1, operand.length - 1).trim();
            if (!inner.match(/^[\d$%(]/) && !inner.includes(",")) {
                try {
                    const labelValue = this.getLabelValue(inner, false);
                    if (labelValue !== 0 || this.labelTable.has(inner) || this.labelTable.has(`${this.currentNamespace}:${inner}`)) {
                        return "[$" + labelValue.toString(16).toUpperCase() + "]";
                    }
                }
                catch (e) {
                    debug(`tryResolveLabelInOperand label resolution failed for indirect: ${inner}`);
                }
            }
            return operand;
        }
        // Handle indexed mode (label,x or label,y or label,s)
        if (operand.includes(",")) {
            const lastCommaIndex = operand.lastIndexOf(",");
            const basePart = operand.substring(0, lastCommaIndex).trim();
            const indexPart = operand.substring(lastCommaIndex).trim(); // Includes the comma
            if (!basePart.match(/^[\d$%(]/)) {
                try {
                    const labelValue = this.getLabelValue(basePart, false);
                    if (labelValue !== 0 || this.labelTable.has(basePart) || this.labelTable.has(`${this.currentNamespace}:${basePart}`)) {
                        return "$" + labelValue.toString(16).toUpperCase() + indexPart;
                    }
                }
                catch (e) {
                    debug(`tryResolveLabelInOperand label resolution failed for indexed: ${basePart}`);
                }
            }
            return operand;
        }
        // Handle direct label (no special characters)
        if (!operand.match(/^[\d#$%([]/) && !operand.includes(",")) {
            try {
                const labelValue = this.getLabelValue(operand, false);
                if (labelValue !== 0 || this.labelTable.has(operand) || this.labelTable.has(`${this.currentNamespace}:${operand}`)) {
                    return "$" + labelValue.toString(16).toUpperCase();
                }
            }
            catch (e) {
                debug(`tryResolveLabelInOperand label resolution failed for direct: ${operand}`);
            }
        }
        return operand;
    }
    /**
     * Gets the size of a struct or extension.
     * @param {string} identifier The identifier of the struct or extension.
     * @param {boolean} [baseOnly] If true, returns only the base size without extensions.
     * @returns {number} The size of the struct or extension.
     * @throws {Error} If the struct or extension doesn't exist.
     */
    getObjectSize(identifier, baseOnly = false) {
        debug("getObjectSize", identifier, baseOnly);
        // For backwards compatibility, remove surrounding quotes.
        if (identifier.startsWith('"') && identifier.endsWith('"')) {
            identifier = identifier.substring(1, identifier.length - 1);
        }
        if (!this.structs.has(identifier)) {
            throw new Error(`Struct '${identifier}' doesn't exist.`);
        }
        const def = this.structs.get(identifier);
        // If baseOnly is true, always return just the base size
        if (baseOnly) {
            debug("getObjectSize (baseOnly) =", def.size);
            return def.size;
        }
        // For non-extended structs, objectsize is the base size plus the extension size (if any).
        // For an extension, objectsize is just its own size.
        let value = 0;
        if (!def.parent) {
            value = def.size + (def.extensionSize || 0);
        }
        else {
            value = def.size;
        }
        debug("getObjectSize =", value);
        return value;
    }
    /**
     * Updates the header checksum (16-bit) and CRC32.
     * For LoROM, the header is at 0x7FC0; for HiROM (and exhirom) at 0xFFC0.
     */
    updateHeaderAndCRC32() {
        debug("updateHeaderAndCRC32");
        let headerOffset;
        // TODO: Validate header offset for other mappers.
        if (this.mapper === "lorom") {
            headerOffset = 0x7FC0;
        }
        else if (this.mapper === "hirom" || this.mapper === "exhirom") {
            headerOffset = 0xFFC0;
        }
        else {
            // For other mappers we choose a default (or skip header update)
            headerOffset = 0xFFC0;
        }
        if (this.romlen < headerOffset + 0x20) {
            debug("ROM too small for header update.");
            return;
        }
        // Calculate the 16-bit checksum (the sum of all bytes modulo 0x10000).
        let checksum = 0;
        for (let i = 0; i < this.romlen; i++) {
            checksum = (checksum + (this.romdata[i] & 0xFF)) & 0xFFFF;
        }
        const complement = (~checksum) & 0xFFFF;
        // In a SNES header the checksum complement is typically stored at offset 0x1C
        // and the checksum at offset 0x1E (relative to the header base).
        this.romdata[headerOffset + 0x1C] = complement & 0xFF;
        this.romdata[headerOffset + 0x1D] = (complement >> 8) & 0xFF;
        this.romdata[headerOffset + 0x1E] = checksum & 0xFF;
        this.romdata[headerOffset + 0x1F] = (checksum >> 8) & 0xFF;
        // Now compute the CRC32 of the entire ROM.
        const crc32 = CRC32.compute(this.romdata);
        debug(`Header updated: Checksum = 0x${checksum.toString(16).toUpperCase()}, Complement = 0x${complement.toString(16).toUpperCase()}, CRC32 = 0x${crc32.toString(16).toUpperCase()}`);
    }
    /**
     * Returns the compiled binary output.
     * @returns {Uint8Array} The compiled binary output.
     */
    getBinaryOutput = () => {
        return new Uint8Array(this.romdata.slice(0, this.romdata.length));
    };
    /**
     * Reads a file and returns its contents as a Uint8Array or string.
     * @param {string} filePath The path to the file to read.
     * @param {BufferEncoding} [encoding] Optional encoding. If provided, returns a string.
     * @returns {Uint8Array | string} The contents of the file as a Uint8Array or string.
     * @throws {Error} If the file is not found or cannot be read.
     */
    readFile(filePath, encoding) {
        debug("readFile", filePath, encoding);
        try {
            // Get the directory of the current file.
            const currentDir = this.currentFile ? path.dirname(this.currentFile) : process.cwd();
            // Resolve the full path relative to the current file.
            const fullPath = path.resolve(currentDir, filePath);
            debug("readFile:", fullPath);
            if (encoding) {
                // Return as string if encoding is provided
                return fs.readFileSync(fullPath, encoding);
            }
            else {
                // Return as Uint8Array if no encoding
                const buffer = fs.readFileSync(fullPath);
                return new Uint8Array(buffer);
            }
        }
        catch (error) {
            debug("Error reading file:", error);
            throw new Error(`Error reading file: ${filePath}`);
        }
    }
    /**
     * Resolves the path of an included file.
     * @param {string} filename The filename to resolve.
     * @returns {string} The resolved path.
     * @throws {Error} If the file is not found.
     */
    resolveIncludePath = (filename) => {
        debug("resolveIncludePath", filename);
        // Strip quotes if present
        if ((filename.startsWith('"') && filename.endsWith('"')) ||
            (filename.startsWith("'") && filename.endsWith("'")) ||
            (filename.startsWith("`") && filename.endsWith("`"))) {
            filename = filename.slice(1, -1);
        }
        // If absolute path, try directly
        if (path.isAbsolute(filename)) {
            debug("resolveIncludePath absolute", filename);
            if (fs.existsSync(filename)) {
                return filename;
            }
        }
        // Try relative to current file
        const currentDir = path.dirname(this.currentFile);
        let tryPath = path.resolve(currentDir, filename);
        debug("resolveIncludePath tryPath", tryPath);
        if (fs.existsSync(tryPath)) {
            return tryPath;
        }
        // Try include paths
        for (const includePath of this.includePaths) {
            tryPath = path.resolve(includePath, filename);
            if (fs.existsSync(tryPath)) {
                return tryPath;
            }
        }
        throw new Error(`Could not find file: ${filename}`);
    };
    /**
     * Handles the include command, adding the current file to the guarded set if once is true.
     * @param {string} command The command to handle.
     * @param {string} filename The filename to include.
     * @param {boolean} once Whether the file should be included once.
     * @throws {Error} If the file is included again while command ===.
     */
    handleInclude = (command, filename, once = false) => {
        debug("handleInclude", command, filename, once);
        // Mark file as included
        this.includedFiles.add(filename);
        this.assemblefile(filename, true);
        // Add current file to guarded set if once is true
        if (once) {
            debug("handleInclude once", this.currentFile);
            this.includeGuardedFiles.add(this.currentFile);
        }
    };
    /**
     * Assembles a file, handling include guards and recursion limits.
     * @param {string} filename The filename to assemble.
     * @param {boolean} isInclude Whether the file is being included.
     * @throws {Error} If the recursion limit is exceeded or the file is included again.
     */
    assemblefile = (filename, isInclude) => {
        debug("assemblefile", filename, isInclude);
        const resolvedPath = this.resolveIncludePath(filename);
        // Check for include guards
        if (this.includeGuardedFiles.has(resolvedPath)) {
            debug("assemblefile include guard hit, skipping");
            return;
        }
        // Check for recursion limit
        if (this.includeStack.length >= 512) {
            throw new Error("Recursion limit exceeded (512 levels)");
        }
        // Save current state
        const previousFile = this.currentFile;
        this.includeStack.push(previousFile);
        // Read and process the file
        try {
            // TODO: Use readFile instead of fs.readFileSync
            const content = fs.readFileSync(resolvedPath, "utf8");
            this.currentFile = resolvedPath;
            // Process the file line by line
            const lines = content.split("\n");
            for (const line of lines) {
                this.processCommand(line);
            }
        }
        catch (error) {
            debug("assemblefile error 💥", error);
        }
        finally {
            // Restore state
            this.currentFile = this.includeStack.pop() || "";
        }
    };
    /**
     * Handles character mapping like `"A" = 0x42` and assigns the value to the character in `characterMappings`.
     * @param {string[]} words The processed words to use as key, `=`, value.
     * @throws {Error} If the format is incorrect.
     */
    handleCharacterMapping(words) {
        debug("handleCharacterMapping", words);
        if (words.length !== 3) {
            throw new Error("Character mapping requires format: 'char' = value");
        }
        const char = words[0].replace(/["']/g, "");
        const value = this.getnum(words[2]);
        this.characterMappings.set(char, value);
    }
    /**
     * Processes a string and maps characters to their corresponding values in `characterMappings`.
     * If a character is not found in `characterMappings`, its charCode is used instead.
     * @param {string} input The string to process.
     * @returns {number[]} An array of numbers representing the mapped characters.
     */
    processStringWithMapping(input) {
        return Array.from(input).map(char => this.characterMappings.get(char) ?? char.charCodeAt(0));
    }
    /**
     * Splits a command into words, preserving quoted strings.
     * @param {string} command - The command to split.
     * @returns {string[]} - The command split into words.
     */
    splitCommandIntoWords(command) {
        const words = [];
        let currentWord = "";
        let inQuotes = false;
        let quoteChar = "";
        for (let i = 0; i < command.trim().length; i++) {
            const char = command.trim()[i];
            // Handle quotes
            if ((char === '"' || char === "'") && (i === 0 || command.trim()[i - 1] !== "\\")) {
                if (!inQuotes) {
                    // Starting a quoted section
                    inQuotes = true;
                    quoteChar = char;
                    currentWord += char;
                }
                else if (char === quoteChar) {
                    // Ending a quoted section
                    inQuotes = false;
                    currentWord += char;
                }
                else {
                    // Different quote character inside quotes
                    currentWord += char;
                }
            }
            else if (/\s/.test(char) && !inQuotes) {
                // Whitespace outside quotes - end current word
                if (currentWord) {
                    words.push(currentWord);
                    currentWord = "";
                }
            }
            else {
                // Regular character
                currentWord += char;
            }
        }
        // Add the last word if there is one
        if (currentWord) {
            words.push(currentWord);
        }
        return words;
    }
    /**
     * Converts a SNES address to a PC offset.
     * Returns -1 if the address is invalid.
     * @param {number} addr - The SNES address to convert.
     * @returns {number} The PC offset.
     */
    snestopc = (addr) => {
        if (addr < 0 || addr > 0xFFFFFF)
            return -1; // not 24-bit
        if (this.mapper === "lorom") {
            // The low pages ($0000-$7FFF) of banks 70-7D are reserved for SRAM.
            if ((addr & 0xFE0000) === 0x7E0000 || // WRAM
                (addr & 0x408000) === 0x000000 || // hardware registers, RAM mirrors, etc.
                (addr & 0x708000) === 0x700000 // SRAM (low parts of banks 70-7D)
            ) {
                return -1;
            }
            addr = ((addr & 0x7F0000) >> 1) | (addr & 0x7FFF);
            return addr;
        }
        if (this.mapper === "hirom") {
            if ((addr & 0xFE0000) === 0x7E0000 ||
                (addr & 0x408000) === 0x000000) {
                return -1;
            }
            return addr & 0x3FFFFF;
        }
        if (this.mapper === "exlorom") {
            if ((addr & 0xF00000) === 0x700000 ||
                (addr & 0x408000) === 0x000000) {
                return -1;
            }
            if (addr & 0x800000) {
                addr = ((addr & 0x7F0000) >> 1) | (addr & 0x7FFF);
            }
            else {
                addr = (((addr & 0x7F0000) >> 1) | (addr & 0x7FFF)) + 0x400000;
            }
            return addr;
        }
        if (this.mapper === "exhirom") {
            if ((addr & 0xFE0000) === 0x7E0000 ||
                (addr & 0x408000) === 0x000000) {
                return -1;
            }
            if ((addr & 0xC00000) !== 0xC00000) {
                return (addr & 0x3FFFFF) | 0x400000;
            }
            return addr & 0x3FFFFF;
        }
        if (this.mapper === "sfxrom") {
            // Emulate GSU1 – extra ROM data is not supported in SuperFX mode.
            if ((addr & 0x600000) === 0x600000 ||
                (addr & 0x408000) === 0x000000 ||
                (addr & 0x800000) === 0x800000) {
                return -1;
            }
            if (addr & 0x400000) {
                return addr & 0x3FFFFF;
            }
            else {
                return ((addr & 0x7F0000) >> 1) | (addr & 0x7FFF);
            }
        }
        if (this.mapper === "sa1rom") {
            if ((addr & 0x408000) === 0x008000) {
                return this.sa1banks[(addr & 0xE00000) >> 21] | ((addr & 0x1F0000) >> 1) | (addr & 0x007FFF);
            }
            if ((addr & 0xC00000) === 0xC00000) {
                return this.sa1banks[((addr & 0x100000) >> 20) | ((addr & 0x200000) >> 19)] | (addr & 0x0FFFFF);
            }
            return -1;
        }
        if (this.mapper === "bigsa1rom") {
            if ((addr & 0xC00000) === 0xC00000) {
                return (addr & 0x3FFFFF) | 0x400000;
            }
            if ((addr & 0xC00000) === 0x000000 || (addr & 0xC00000) === 0x800000) {
                if ((addr & 0x008000) === 0) {
                    return -1;
                }
                return ((addr & 0x800000) >> 2) | ((addr & 0x3F0000) >> 1) | (addr & 0x7FFF);
            }
            return -1;
        }
        if (this.mapper === "norom") {
            return addr;
        }
        return -1;
    };
    /**
     * Converts a PC offset to a SNES address.
     * Returns -1 if the address is invalid.
     * @param {number} addr - The PC offset to convert.
     * @returns {number} The SNES address.
     */
    pctosnes = (addr) => {
        if (addr < 0)
            return -1;
        if (this.mapper === "lorom") {
            if (addr >= 0x400000)
                return -1;
            addr = (((addr << 1) & 0x7F0000) | (addr & 0x7FFF)) | 0x8000;
            return addr | 0x800000;
        }
        if (this.mapper === "hirom") {
            if (addr >= 0x400000)
                return -1;
            return addr | 0xC00000;
        }
        if (this.mapper === "exlorom") {
            if (addr >= 0x800000)
                return -1;
            if (addr & 0x400000) {
                addr -= 0x400000;
                addr = (((addr << 1) & 0x7F0000) | (addr & 0x7FFF)) | 0x8000;
                return addr;
            }
            else {
                addr = (((addr << 1) & 0x7F0000) | (addr & 0x7FFF)) | 0x8000;
                return addr | 0x800000;
            }
        }
        if (this.mapper === "exhirom") {
            if (addr >= 0x800000)
                return -1;
            if (addr & 0x400000)
                return addr;
            return addr | 0xC00000;
        }
        if (this.mapper === "sa1rom") {
            if (addr >= 0x800000)
                return -1;
            for (let i = 0; i < 8; i++) {
                if (this.sa1banks[i] === (addr & 0x700000)) {
                    return 0x008000 | (i << 21) | (((addr & 0x0F8000)) << 1) | (addr & 0x7FFF);
                }
            }
            /* c8 ignore next 2 */
            return -1;
        }
        if (this.mapper === "bigsa1rom") {
            if (addr >= 0x800000) {
                return -1;
            }
            if ((addr & 0x400000) === 0x400000) {
                return addr | 0xC00000;
            }
            if ((addr & 0x600000) === 0x000000) {
                return ((addr << 1) & 0x3F0000) | 0x8000 | (addr & 0x7FFF);
            }
            if ((addr & 0x600000) === 0x200000) {
                return 0x800000 | (((addr << 1) & 0x3F0000)) | 0x8000 | (addr & 0x7FFF);
            }
            /* c8 ignore next 2 */
            return -1;
        }
        if (this.mapper === "sfxrom") {
            if (addr >= 0x200000)
                return -1;
            return (((addr << 1) & 0x7F0000) | (addr & 0x7FFF)) | 0x8000;
        }
        if (this.mapper === "norom") {
            return addr;
        }
        return -1;
    };
    /**
     * Ensures the SNES position is valid, and resets it if it's not.
     */
    verifysnespos() {
        // debug(`verifysnespos: snespos: ${this.snespos.toString(16)} realsnespos: ${this.realsnespos.toString(16)}`);
        if (this.snespos < 0 || this.realsnespos < 0) {
            debug("verifysnespos 💥 missing ORG directive, resetting SNES position");
            this.snespos = 0x008000;
            this.realsnespos = 0x008000;
            this.startpos = 0x008000;
            this.realstartpos = 0x008000;
        }
    }
    /**
     * Adjusts memory addresses based on the ROM type.
     * @param {number} inaddr The address to adjust.
     * @param {number} step The number of bytes to step.
     * @returns {number} The adjusted address.
     */
    fixsnespos(inaddr, step = 0) {
        // Calculate the new address after adding the step
        const newAddr = inaddr + step;
        // Check if we're crossing a bank boundary (if the bank number changes)
        if ((inaddr & 0xFF0000) !== (newAddr & 0xFF0000)) {
            switch (this.mapper) {
                case "lorom":
                    // Keep the bank byte but wrap the address and add 0x8000
                    return (newAddr & 0xFF0000) | ((newAddr & 0xFFFF) + 0x8000);
                case "hirom":
                    if ((inaddr & 0x400000) === 0) {
                        return (newAddr & 0xFF0000) | ((newAddr & 0xFFFF) + 0x8000);
                    }
                    return newAddr;
                case "exlorom":
                case "bigsa1rom":
                    return this.pctosnes(this.snestopc(inaddr) + step);
                case "exhirom":
                    if ((inaddr & 0x400000) === 0) {
                        return (newAddr & 0xFF0000) | ((newAddr & 0xFFFF) + 0x8000);
                    }
                    return newAddr;
                case "sfxrom":
                    if ((inaddr & 0x400000) === 0) {
                        return (newAddr & 0xFF0000) | ((newAddr & 0xFFFF) + 0x8000);
                    }
                    return newAddr;
                case "sa1rom":
                    if ((inaddr & 0x400000) === 0) {
                        return (newAddr & 0xFF0000) | ((newAddr & 0xFFFF) + 0x8000);
                    }
                    return newAddr;
                case "norom":
                    return newAddr;
                default:
                    throw new Error(`Unknown mapper type: ${this.mapper}`);
            }
        }
        else {
            // No bank crossing, just return the new address
            return newAddr;
        }
    }
    /**
     * Begins the collection of loop commands.
     * @param {string} type The type of loop to begin ("for" or "while").
     * @param {string} command The command to begin the loop with.
     */
    beginLoopCollection(type, command) {
        debug("beginLoopCollection", type, command);
        // Check for inline for loop with colon separators
        if (type === "for" && command.includes(":")) {
            // This is an inline for loop like "for i = 0..5 : db 1 : endfor"
            const parts = command.split(":");
            const forDeclaration = parts[0].trim();
            const forMatch = forDeclaration.match(/^\s*for\s+(\w+)\s*=\s*([^.]+)\.\.([^\s:]+)/i);
            if (forMatch) {
                const variable = forMatch[1];
                const startExpr = forMatch[2].trim();
                const endExpr = forMatch[3].trim();
                // Process the inline for loop directly without collecting
                const start = this.getnum(this.resolvedefines(startExpr));
                const end = this.getnum(this.resolvedefines(endExpr));
                // Save the original variable value before we modify it
                const originalValue = this.defines.get(variable);
                // Execute the inline loop
                if (start < end) {
                    for (let i = start; i < end; i++) {
                        // Set the variable
                        this.defines.set(variable, i.toString());
                        // Process each command in the inline for loop
                        for (let j = 1; j < parts.length; j++) {
                            const cmd = parts[j].trim();
                            if (cmd !== "endfor") {
                                this.processCommand(cmd);
                            }
                        }
                    }
                }
                // Restore original value
                if (originalValue !== undefined) {
                    debug(`beginLoopCollection restoring ${variable} to ${originalValue}`);
                    this.defines.set(variable, originalValue);
                }
                else {
                    debug(`beginLoopCollection deleting ${variable}`);
                    this.defines.delete(variable);
                }
                return; // Skip the normal loop collection
            }
        }
        // Regular non-inline loop
        // Create a new loop block
        const newLoop = {
            type,
            condition: command,
            commands: [],
            startLine: this.currentLine
        };
        // Extract variable name for for loops
        if (type === "for") {
            const forMatch = command.match(/^\s*for\s+(\w+)\s*=\s*([^.]+)\.\.([^\s:]+)/i);
            if (forMatch) {
                newLoop.variable = forMatch[1];
                // Pre-parse start and end (optional, can be done during execution)
                try {
                    const startExpr = forMatch[2].trim();
                    const endExpr = forMatch[3].trim();
                    newLoop.start = this.getnum(this.resolvedefines(startExpr));
                    newLoop.end = this.getnum(this.resolvedefines(endExpr));
                }
                catch (e) {
                    /* c8 ignore next 3 */
                    // We'll parse these again during execution, so errors here are non-fatal
                    debug("Could not pre-parse for loop range:", e);
                }
            }
        }
        // If we're already collecting a loop, nest this one inside the current one
        if (this.collectingLoop && this.currentLoop) {
            this.currentLoop.commands.push(newLoop);
            this.loopStack.push(this.currentLoop);
        }
        this.currentLoop = newLoop;
        this.collectingLoop = true;
        this.loopNestingLevel++;
    }
    /**
     * Ends the collection of loop commands and executes the loop.
     * @param {string} type The type of loop to end ("for" or "while").
     */
    endLoopCollection(type) {
        if (!this.collectingLoop || !this.currentLoop) {
            debug(`endLoopCollection unexpected end${type} without matching ${type}`);
            return;
        }
        if (this.currentLoop.type !== type) {
            debug(`endLoopCollection mismatched loop types: expected end${this.currentLoop.type}, got end${type}`);
            return;
        }
        // Set the end line for this loop block
        this.currentLoop.endLine = this.currentLine;
        // If we have a parent loop in the stack, pop back to it
        if (this.loopStack.length > 0) {
            // Save a reference to the finished loop before switching to parent
            // No need to store it since we'll reference it from the parent's commands
            this.currentLoop = this.loopStack.pop() || null;
            // We don't execute the nested loop right away - it will be executed
            // when its parent loop is executed
        }
        else {
            // No parent loop - execute this complete loop
            const loopToExecute = this.currentLoop;
            this.currentLoop = null;
            this.collectingLoop = false;
            // Execute the complete top-level loop
            this.executeLoopBlock(loopToExecute);
        }
        this.loopNestingLevel--;
    }
    /**
     * Executes a complete loop block with all its nested commands.
     * @param {LoopBlock} loopBlock The loop block to execute.
     */
    executeLoopBlock(loopBlock) {
        debug("executeLoopBlock", loopBlock);
        if (loopBlock.type === "for") {
            this.executeForLoop(loopBlock);
        }
        else if (loopBlock.type === "while") {
            this.executeWhileLoop(loopBlock);
        }
    }
    /**
     * Executes a for loop block.
     * @param {LoopBlock} forBlock The for loop block to execute.
     */
    executeForLoop(forBlock) {
        debug("executeForLoop", forBlock);
        // Parse the for loop condition
        const forMatch = forBlock.condition.match(/^\s*for\s+(\w+)\s*=\s*([^.]+)\.\.([^\s:]+)/i);
        if (!forMatch) {
            debug("executeForLoop invalid for loop syntax:", forBlock.condition);
            return;
        }
        const variable = forBlock.variable || forMatch[1];
        const startExpr = forMatch[2].trim();
        const endExpr = forMatch[3].trim();
        // Evaluate start and end expressions
        const startDefinesResolved = this.resolvedefines(startExpr);
        const endDefinesResolved = this.resolvedefines(endExpr);
        const start = this.getnum(startDefinesResolved);
        const end = this.getnum(endDefinesResolved);
        // Save the original variable value before we modify it
        const originalValue = this.defines.get(variable);
        // Only process the loop if start < end
        if (start < end) {
            // Loop through the range and process commands for each iteration
            for (let i = start; i < end; i++) {
                // Set our loop counter directly in defines map
                this.defines.set(variable, i.toString());
                // Process each command in the loop body
                for (const cmd of forBlock.commands) {
                    if (typeof cmd === "string") {
                        // Process the command with our variable set in the defines map
                        this.processCommand(cmd);
                    }
                    else {
                        // Execute nested loops
                        this.executeLoopBlock(cmd);
                    }
                }
            }
        }
        // Restore the original variable value or delete if it didn't exist
        if (originalValue !== undefined) {
            this.defines.set(variable, originalValue);
        }
        else {
            this.defines.delete(variable);
        }
    }
    /**
     * Executes a while loop block.
     * @param {LoopBlock} whileBlock The while loop block to execute.
     */
    executeWhileLoop(whileBlock) {
        debug("executeWhileLoop", whileBlock);
        // Extract the condition expression
        const condMatch = whileBlock.condition.match(/^\s*while\s+(.+)/i);
        if (!condMatch) {
            debug("executeWhileLoop invalid while loop syntax:", whileBlock.condition);
            return;
        }
        const conditionExpr = condMatch[1].trim();
        let iteration = 0;
        const MAX_ITERATIONS = 10000; // Safety limit to prevent infinite loops
        // Track variables modified in the loop body
        const loopVars = new Set();
        const originalValues = new Map();
        // Continue looping as long as the condition evaluates to true
        while (this.evaluateExpression(conditionExpr) && iteration < MAX_ITERATIONS) {
            // Process each command in the loop body
            for (const cmd of whileBlock.commands) {
                if (typeof cmd === "string") {
                    // Check if this is a variable definition
                    if (this.isDefineStatement(cmd)) {
                        const varName = this.getDefineVariable(cmd);
                        if (varName && !loopVars.has(varName)) {
                            // First time seeing this variable in the loop
                            loopVars.add(varName);
                            // Save its original value
                            originalValues.set(varName, this.defines.get(varName));
                        }
                    }
                    // Process the command
                    this.processCommand(cmd);
                }
                else {
                    // Execute nested loops
                    this.executeLoopBlock(cmd);
                }
            }
            iteration++;
        }
        if (iteration >= MAX_ITERATIONS) {
            debug("executeWhileLoop while loop exceeded maximum iteration limit. Possible infinite loop detected.");
        }
        // Restore original variable values
        for (const [varName, value] of originalValues.entries()) {
            if (value !== undefined) {
                debug(`executeWhileLoop setting ${varName} to ${value}`);
                this.defines.set(varName, value);
            }
            else {
                debug(`executeWhileLoop delete entry for ${varName}`);
                this.defines.delete(varName);
            }
        }
    }
    /**
     * Checks if a line is a define statement.
     * @param {string} line The line to check.
     * @returns {boolean} True if the line is a define statement, false otherwise.
     */
    isDefineStatement(line) {
        const trimmed = line.trim();
        return trimmed.startsWith("!") &&
            !trimmed.startsWith("! ") &&
            trimmed.includes("=");
    }
    /**
     * Extracts the variable name from a define statement.
     * @param {string} line The line to extract the variable name from.
     * @returns {string | undefined} The variable name or null if the line is not a define statement.
     */
    getDefineVariable(line) {
        const match = line.trim().match(/^!([A-Z_a-z]\w*)\s*=/);
        return match ? match[1] : undefined;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZW1ibGVyLmpzIiwic291cmNlUm9vdCI6Ii9Vc2Vycy9tYXR0aGV3L3V0dG9yaS9zbmVzLWFzbS1qcy8iLCJzb3VyY2VzIjpbInNyYy9hc3NlbWJsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE1BQU0sU0FBUyxDQUFBO0FBQ3hCLE9BQU8sSUFBSSxNQUFNLFdBQVcsQ0FBQTtBQUM1QixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDM0MsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGlCQUFpQixDQUFBO0FBQzVDLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDekMsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQy9DLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFbkMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEdBQUUsQ0FBQyxDQUFDO0FBQ3pCLG9CQUFvQjtBQUNwQiwrQ0FBK0M7QUFDL0MsSUFBSSxDQUFDO0lBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7QUFBQyxDQUFDO0FBQUMsTUFBTSxDQUFDLENBQUEsQ0FBQztBQTBEdEYsTUFBTSxPQUFPLFNBQVM7SUFDYixPQUFPLEdBQVcsQ0FBQyxDQUFDO0lBQ3BCLFdBQVcsR0FBVyxDQUFDLENBQUM7SUFDeEIsUUFBUSxHQUFXLENBQUMsQ0FBQztJQUNyQixZQUFZLEdBQVcsQ0FBQyxDQUFDO0lBQ3pCLEtBQUssR0FBVyxDQUFDLENBQUM7SUFFbEIsTUFBTSxHQUFXLE9BQU8sQ0FBQyxDQUFDLG9GQUFvRjtJQUM5RyxR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