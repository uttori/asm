let debug = (..._) => { };
try {
    const { default: d } = await import("debug");
    debug = d("ArchSuperFX");
}
catch { }
export class ArchSuperFX {
    assembler;
    constructor(assembler) {
        this.assembler = assembler;
    }
    /**
     * Processes a SuperFX assembly instruction.
     * @param {string[]} words The tokenized instruction.
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    asblock_superfx(words) {
        debug("asblock_superfx", words);
        const opcode = words[0].toUpperCase();
        const rawOperand = words.length > 1 ? words.slice(1).join(" ") : "";
        // Expand the operand using the new method that returns both expanded operand and its length
        const { expanded: operand, length: operandLength } = this.assembler.expandOperand(rawOperand);
        debug("asblock_superfx operand expanded", operand, "expected length:", operandLength);
        debug("asblock_superfx opcode", opcode);
        debug("asblock_superfx operand", operand);
        // Handle single-word opcodes (e.g., NOP, STOP, etc.)
        if (this.handleSingleWordOpcode(opcode)) {
            return true;
        }
        if (this.handleTwoWordOpcode(opcode, operand)) {
            return true;
        }
        // Split into args for instructions with multiple operands
        const args = operand.split(",").map((arg) => arg.trim());
        if (args.length === 1) {
            // Single argument instructions
            return this.handleOneOperandOpcode(opcode, args[0], operandLength);
        }
        else if (args.length === 2) {
            return this.handleTwoOperandOpcode(opcode, args[0], args[1]);
        }
        return false;
    }
    /**
     * Handles single-word (no-operand) opcodes for SuperFX.
     * @param {string} opcode - the opcode
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    handleSingleWordOpcode(opcode) {
        debug("handleSingleWordOpcode", opcode);
        // Simple single-byte instructions
        const singleOpcodes = {
            STOP: 0x00,
            NOP: 0x01,
            CACHE: 0x02,
            LSR: 0x03,
            ROL: 0x04,
            LOOP: 0x3C,
            ALT1: 0x3D,
            ALT2: 0x3E,
            ALT3: 0x3F,
            PLOT: 0x4C,
            SWAP: 0x4D,
            COLOR: 0x4E,
            NOT: 0x4F,
            MERGE: 0x70,
            SBK: 0x90,
            SEX: 0x95,
            ASR: 0x96,
            ROR: 0x97,
            LOB: 0x9E,
            FMULT: 0x9F,
            HIB: 0xC0,
            GETC: 0xDF,
            GETB: 0xEF,
        };
        const extendedOpcodes = [
            { mnemonic: "RPIX", prefix: 0x3D, opcode: 0x4C },
            { mnemonic: "CMODE", prefix: 0x3D, opcode: 0x4E },
            { mnemonic: "DIV2", prefix: 0x3D, opcode: 0x96 },
            { mnemonic: "LMULT", prefix: 0x3D, opcode: 0x9F },
            { mnemonic: "GETBH", prefix: 0x3D, opcode: 0xEF },
            { mnemonic: "RAMB", prefix: 0x3E, opcode: 0xDF },
            { mnemonic: "GETBL", prefix: 0x3E, opcode: 0xEF },
            { mnemonic: "ROMB", prefix: 0x3F, opcode: 0xDF },
            { mnemonic: "GETBS", prefix: 0x3F, opcode: 0xEF },
        ];
        // Check simple single-byte opcodes
        if (opcode in singleOpcodes) {
            this.assembler.write1(singleOpcodes[opcode]);
            return true;
        }
        // Check two-byte extended opcodes
        for (const cmd of extendedOpcodes) {
            if (opcode === cmd.mnemonic) {
                this.assembler.write1(cmd.prefix);
                this.assembler.write1(cmd.opcode);
                return true;
            }
        }
        return false;
    }
    /**
     * Handles two-word opcodes (one opcode + one operand).
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    handleTwoWordOpcode(opcode, operand) {
        debug("handleTwoWordOpcode", opcode, operand);
        // For instructions like "TO Rn", "ADD Rn", "CMP Rn", etc., we parse the second token carefully.
        // In the original C++ code, the logic was embedded in the big if-else block. We'll replicate that.
        // If there's a comma, let's split it for further analysis
        const args = operand.split(",").map((a) => a.trim());
        if (args.length === 1) {
            // Single argument instructions
            return this.handleOneOperandOpcode(opcode, args[0], this.getOperandLength(args[0]));
        }
        else if (args.length === 2) {
            return this.handleTwoOperandOpcode(opcode, args[0], args[1]);
        }
        return false;
    }
    /**
     * Handles instructions with a single operand (e.g., "TO R1", "BRA label").
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @param {number} operandLength - the length of the operand
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    handleOneOperandOpcode(opcode, operand, operandLength) {
        debug("handleOneOperandOpcode", opcode, operand, operandLength);
        // Mapping for short branches (8-bit offset)
        const shortBranchMap = {
            "BRA": 0x05,
            "BEQ": 0x03,
            "BNE": 0x04,
            "BPL": 0x06,
            "BMI": 0x07,
            "BCC": 0x08,
            "BCS": 0x09,
            "BVC": 0x0A,
            "BVS": 0x0B,
        };
        if (opcode in shortBranchMap) {
            const branchOpcode = shortBranchMap[opcode];
            // We interpret the operand as an address for branching
            // If the user wants an 8-bit offset, we allow direct or label
            const val = this.assembler.getnum(operand);
            // Use operandLength determined by expandOperand
            if (operandLength === 1) {
                // direct offset
                this.assembler.write1(branchOpcode);
                this.assembler.write1(val & 0xff);
            }
            else {
                // relative
                const pc = this.assembler.snespos & 0xffffff;
                const offset = (val - (pc + 2)) & 0xff;
                this.assembler.write1(branchOpcode);
                this.assembler.write1(offset);
            }
            return true;
        }
        // Attempt to parse the operand as register
        const regR = this.getRegister(operand, "r");
        const regHash = this.getRegister(operand, "hash");
        const regParr = this.getRegister(operand, "parr");
        // Potential second-level variants for ALT instructions
        // Example: "ADC Rn" => write1(0x3D), write1(0x50 + n)
        // "TO Rn", "WITH Rn", etc.
        if (regR !== null) {
            // handle instructions that take a single Rn
            switch (opcode) {
                case "TO":
                    this.assembler.write1(0x10 + regR);
                    return true;
                case "WITH":
                    this.assembler.write1(0x20 + regR);
                    return true;
                case "ADD":
                    this.assembler.write1(0x50 + regR);
                    return true;
                case "SUB":
                    this.assembler.write1(0x60 + regR);
                    return true;
                case "AND":
                    this.rangeCheck(1, regR, 15);
                    this.assembler.write1(0x70 + regR);
                    return true;
                case "MULT":
                    this.assembler.write1(0x80 + regR);
                    return true;
                case "JMP":
                    this.rangeCheck(8, regR, 13);
                    this.assembler.write1(0x90 + regR);
                    return true;
                case "FROM":
                    this.assembler.write1(0xB0 + regR);
                    return true;
                case "OR":
                    this.rangeCheck(1, regR, 15);
                    this.assembler.write1(0xC0 + regR);
                    return true;
                case "INC":
                    this.rangeCheck(0, regR, 14);
                    this.assembler.write1(0xD0 + regR);
                    return true;
                case "DEC":
                    this.rangeCheck(0, regR, 14);
                    this.assembler.write1(0xE0 + regR);
                    return true;
                // ALT1 variants (0x3D prefix)
                case "ADC":
                    // 0x3D, then 0x50 + reg
                    this.assembler.write1(0x3D);
                    this.assembler.write1(0x50 + regR);
                    return true;
                case "SBC":
                    this.assembler.write1(0x3D);
                    this.assembler.write1(0x60 + regR);
                    return true;
                case "BIC":
                    this.rangeCheck(1, regR, 15);
                    this.assembler.write1(0x3D);
                    this.assembler.write1(0x70 + regR);
                    return true;
                case "UMULT":
                    this.assembler.write1(0x3D);
                    this.assembler.write1(0x80 + regR);
                    return true;
                case "LJMP":
                    this.rangeCheck(8, regR, 13);
                    this.assembler.write1(0x3D);
                    this.assembler.write1(0x90 + regR);
                    return true;
                case "XOR":
                    this.rangeCheck(1, regR, 15);
                    this.assembler.write1(0x3D);
                    this.assembler.write1(0xC0 + regR);
                    return true;
                case "CMP":
                    // prefix 0x3F, then 0x60 + reg
                    this.assembler.write1(0x3F);
                    this.assembler.write1(0x60 + regR);
                    return true;
            }
        }
        if (regHash !== null) {
            // e.g. LINK #n
            if (opcode === "LINK") {
                // range(1, reg, 4)
                this.rangeCheck(1, regHash, 4);
                this.assembler.write1(0x90 + regHash);
                return true;
            }
            // ALT2 prefix (0x3E) logic, e.g. ADD #n => 0x3E  0x50 + n
            switch (opcode) {
                case "ADD":
                    this.assembler.write1(0x3E);
                    this.assembler.write1(0x50 + regHash);
                    return true;
                case "SUB":
                    this.assembler.write1(0x3E);
                    this.assembler.write1(0x60 + regHash);
                    return true;
                case "AND":
                    this.rangeCheck(1, regHash, 15);
                    this.assembler.write1(0x3E);
                    this.assembler.write1(0x70 + regHash);
                    return true;
                case "MULT":
                    this.assembler.write1(0x3E);
                    this.assembler.write1(0x80 + regHash);
                    return true;
                case "OR":
                    this.rangeCheck(1, regHash, 15);
                    this.assembler.write1(0x3E);
                    this.assembler.write1(0xC0 + regHash);
                    return true;
                // ALT3 prefix
                case "ADC":
                    this.assembler.write1(0x3F);
                    this.assembler.write1(0x50 + regHash);
                    return true;
                case "BIC":
                    this.rangeCheck(1, regHash, 15);
                    this.assembler.write1(0x3F);
                    this.assembler.write1(0x70 + regHash);
                    return true;
                case "UMULT":
                    this.assembler.write1(0x3F);
                    this.assembler.write1(0x80 + regHash);
                    return true;
                case "XOR":
                    this.rangeCheck(1, regHash, 15);
                    this.assembler.write1(0x3F);
                    this.assembler.write1(0xC0 + regHash);
                    return true;
            }
        }
        if (regParr !== null) {
            // e.g. STW (Rn), LDW (Rn)
            switch (opcode) {
                case "STW":
                    this.rangeCheck(0, regParr, 11);
                    this.assembler.write1(0x30 + regParr);
                    return true;
                case "LDW":
                    this.rangeCheck(0, regParr, 11);
                    this.assembler.write1(0x40 + regParr);
                    return true;
                case "STB":
                    this.rangeCheck(0, regParr, 11);
                    this.assembler.write1(0x3D);
                    this.assembler.write1(0x30 + regParr);
                    return true;
                case "LDB":
                    this.rangeCheck(0, regParr, 11);
                    this.assembler.write1(0x3D);
                    this.assembler.write1(0x40 + regParr);
                    return true;
            }
        }
        return false;
    }
    /**
     * Handles instructions with two operands (e.g., MOVE r1, r2).
     * @param {string} opcode - the opcode
     * @param {string} leftOp - the left operand
     * @param {string} rightOp - the right operand
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    handleTwoOperandOpcode(opcode, leftOp, rightOp) {
        debug("handleTwoOperandOpcode", { opcode, leftOp, rightOp });
        // e.g. "MOVE Rn, Rm", "MOVES Rn, Rm", etc.
        const reg1r = this.getRegister(leftOp, "r");
        const reg1parr = this.getRegister(leftOp, "parr");
        const reg2r = this.getRegister(rightOp, "r");
        const reg2parr = this.getRegister(rightOp, "parr");
        debug("handleTwoOperandOpcode", { reg1r, reg1parr, reg2r, reg2parr });
        // Rn, Rm combos
        if (reg1r !== null && reg2r !== null) {
            switch (opcode) {
                case "MOVE":
                    // write1(0x20+reg2); write1(0x10+reg1)
                    this.assembler.write1(0x20 + reg2r);
                    this.assembler.write1(0x10 + reg1r);
                    return true;
                case "MOVES":
                    // write1(0x20+reg1); write1(0xB0+reg2)
                    this.assembler.write1(0x20 + reg1r);
                    this.assembler.write1(0xB0 + reg2r);
                    return true;
            }
        }
        // Rn, #imm combos
        if (reg1r !== null && rightOp.startsWith("#")) {
            const immVal = this.assembler.getnum(rightOp.slice(1)) & 0xffff;
            switch (opcode) {
                case "IBT":
                    // => 0xA0+reg1, then immVal
                    this.assembler.write1(0xA0 + reg1r);
                    this.assembler.write1(immVal & 0xff);
                    return true;
                case "IWT":
                    // => 0xF0+reg1, then immVal (lo, hi)
                    this.assembler.write1(0xF0 + reg1r);
                    this.assembler.write1(immVal & 0xff);
                    this.assembler.write1((immVal >> 8) & 0xff);
                    return true;
                case "MOVE":
                    // If immediate < 0x80 or >= 0xFF80 => 8-bit
                    if (immVal < 0x80 || immVal >= 0xff80) {
                        // prefix 0xA0+reg1
                        this.assembler.write1(0xA0 + reg1r);
                        this.assembler.write1(immVal & 0xff);
                    }
                    else {
                        // prefix 0xF0+reg1, 16-bit
                        this.assembler.write1(0xF0 + reg1r);
                        this.assembler.write1(immVal & 0xff);
                        this.assembler.write1((immVal >> 8) & 0xff);
                    }
                    return true;
            }
        }
        // (Rn), Rm combos
        if (reg1parr !== null && reg2r !== null) {
            switch (opcode) {
                case "MOVEB":
                    // ...
                    if (reg1parr === 0) {
                        // e.g. MOVEB (r0), rX => 0x3D  0x30 + reg2?
                        this.assembler.write1(0x3D);
                        this.assembler.write1(0x30 + reg2r);
                        return true;
                    }
                    else {
                        // MOVEB (rN), rM => 0xB0+ reg1 then 0x3D  then 0x30+ reg2
                        // Simplified version of code
                        this.assembler.write1(0xB0 + reg1parr);
                        this.assembler.write1(0x3D);
                        this.assembler.write1(0x30 + reg2r);
                        return true;
                    }
                case "MOVEW":
                    // ...
                    if (reg1parr === 0) {
                        this.assembler.write1(0x30 + reg2r);
                    }
                    else {
                        this.assembler.write1(0xB0 + reg1parr);
                        this.assembler.write1(0x30 + reg2r);
                    }
                    return true;
            }
        }
        // Rn, (Rm) combos
        if (reg1r !== null && reg2parr !== null) {
            switch (opcode) {
                case "MOVEB":
                    if (reg2parr === 0) {
                        this.assembler.write1(0x3D);
                        this.assembler.write1(0x40 + reg1r);
                        return true;
                    }
                    else {
                        this.assembler.write1(0x10 + reg1r);
                        this.assembler.write1(0x3D);
                        this.assembler.write1(0x40 + reg2parr);
                        return true;
                    }
                case "MOVEW":
                    if (reg2parr === 0) {
                        this.assembler.write1(0x40 + reg1r);
                        return true;
                    }
                    else {
                        this.assembler.write1(0x10 + reg1r);
                        this.assembler.write1(0x40 + reg2parr);
                        return true;
                    }
            }
        }
        // Rn, (imm)
        // e.g. "MOVE R0, (0x1234)" or "SMS (0x40), R3"
        if (reg1r !== null && leftOp.toLowerCase().startsWith("r")) {
            const addrVal = this.assembler.getnum(rightOp);
            switch (opcode) {
                case "LM":
                    // => 0x3D, 0xF0 + reg1, then lo, hi
                    this.assembler.write1(0x3D);
                    this.assembler.write1(0xF0 + reg1r);
                    this.assembler.write2(addrVal);
                    return true;
                case "LMS":
                    // short addressing check
                    if (this.checkShortAddr(addrVal)) {
                        this.assembler.write1(0x3D);
                        this.assembler.write1(0xA0 + reg1r);
                        this.assembler.write1(addrVal >> 1);
                        return true;
                    }
                    return true; // might not do anything else if fail
                case "MOVE":
                    if (addrVal & 1 || addrVal >= 0x200) {
                        // 0x3D, 0xF0+reg, lo, hi
                        this.assembler.write1(0x3D);
                        this.assembler.write1(0xF0 + reg1r);
                        this.assembler.write2(addrVal);
                    }
                    else {
                        // 0x3D, 0xA0+reg, lo
                        this.assembler.write1(0x3D);
                        this.assembler.write1(0xA0 + reg1r);
                        this.assembler.write1(addrVal & 0xff);
                    }
                    return true;
                case "LEA":
                    // => 0xF0+ reg, lo, hi
                    this.assembler.write1(0xF0 + reg1r);
                    this.assembler.write1(addrVal & 0xff);
                    this.assembler.write1((addrVal >> 8) & 0xff);
                    return true;
            }
        }
        // (imm), Rn
        if (reg2r !== null && rightOp.startsWith("R")) {
            if (leftOp.startsWith("(") && leftOp.endsWith(")")) {
                const addrVal = this.assembler.getnum(leftOp);
                switch (opcode) {
                    case "SM":
                        this.assembler.write1(0x3E);
                        this.assembler.write1(0xF0 + reg2r);
                        this.assembler.write2(addrVal);
                        return true;
                    case "SMS":
                        if (this.checkShortAddr(addrVal)) {
                            this.assembler.write1(0x3E);
                            this.assembler.write1(0xA0 + reg2r);
                            this.assembler.write1(addrVal >> 1);
                            return true;
                        }
                        return true;
                    case "MOVE":
                        if (addrVal & 1 || addrVal >= 0x200) {
                            this.assembler.write1(0x3E);
                            this.assembler.write1(0xF0 + reg2r);
                            this.assembler.write2(addrVal);
                        }
                        else {
                            this.assembler.write1(0x3E);
                            this.assembler.write1(0xA0 + reg2r);
                            this.assembler.write1(addrVal & 0xff);
                        }
                        return true;
                }
            }
        }
        return false;
    }
    /**
     * Attempts to parse a register from a string, e.g. "r0", "(r3)", "#3".
     * @param str the operand string
     * @param type "r" | "parr" | "hash"
     * @returns register number or null if it doesn't match
     */
    getRegister(str, type) {
        // reg_parr => (rN)
        // reg_r => rN
        // reg_hash => #N
        // Return null if parse fails
        const index = 0;
        if (type === "parr") {
            // Must start with '('
            if (!str.startsWith("(")) {
                return null;
            }
            str = str.slice(1); // skip '('
            if (!/^r\d{1,2}\)/i.test(str)) {
                return null;
            }
            // skip 'r'
            if (str[0].toLowerCase() !== "r") {
                return null;
            }
            str = str.slice(1);
            // parse digit
            const regnum = this.parseRegisterNumber(str.replace(/\)$/, "")); // remove trailing ')'
            if (regnum === -1) {
                return null;
            }
            return regnum;
        }
        if (type === "r") {
            // Must start with 'r'
            if (!str.toLowerCase().startsWith("r")) {
                return null;
            }
            const regnum = this.parseRegisterNumber(str.slice(1));
            if (regnum === -1) {
                return null;
            }
            return regnum;
        }
        if (type === "hash") {
            if (!str.startsWith("#")) {
                return null;
            }
            const regnum = this.parseRegisterNumber(str.slice(1));
            if (regnum === -1) {
                return null;
            }
            return regnum;
        }
        return null;
    }
    /**
     * Parses the register number. E.g. '5', '10', '15'. Returns -1 if invalid.
     * @param str
     */
    parseRegisterNumber(str) {
        // e.g. '10' => r10
        // valid registers are 0..15, but we also need to check for weird digits
        const match = str.match(/^\d{1,2}$/);
        if (!match) {
            return -1;
        }
        const value = parseInt(str, 10);
        if (value < 0 || value > 15) {
            return -1;
        }
        return value;
    }
    /**
     * Raises an error if `mid < min` or `mid > max`.
     * @param min
     * @param mid
     * @param max
     */
    rangeCheck(min, mid, max) {
        if (mid < min || mid > max) {
            throw new Error(`Register out of valid range ${min}-${max}: ${mid}`);
        }
    }
    /**
     * For "LMS" or "SMS" short addressing forms, we need to ensure the address is
     * even and in range [0x000..0x1FE].
     * @param {number} num - the address
     * @returns {boolean} True if the address is valid, false otherwise.
     */
    checkShortAddr(num) {
        debug("checkShortAddr", num);
        if (num % 2 !== 0 || num < 0 || num > 0x1FE) {
            throw new Error(`Invalid short address ${num}. Must be even and in range 0..0x1FE`);
        }
        return true;
    }
    /**
     * Returns an approximate operand length (1 or 2) by checking the operand format.
     * This is a simple approximation for short vs. relative addressing.
     * @param operand
     */
    getOperandLength(operand) {
        // This is a simplified logic: if it looks hex with 2 digits, assume 1; else 2
        // If there's a label, or more digits, we guess 2.
        // You can refine as needed.
        const simpleHex2 = /^\$[\dA-Fa-f]{2}$/;
        if (simpleHex2.test(operand)) {
            return 1;
        }
        return 2;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXJjaFN1cGVyRlguanMiLCJzb3VyY2VSb290IjoiL1VzZXJzL21hdHRoZXcvdXR0b3JpL3NuZXMtYXNtLWpzLyIsInNvdXJjZXMiOlsic3JjL0FyY2hTdXBlckZYLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLElBQUksS0FBSyxHQUFHLENBQUMsR0FBRyxDQUFZLEVBQUUsRUFBRSxHQUFFLENBQUMsQ0FBQztBQUNwQyxJQUFJLENBQUM7SUFDSCxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzdDLEtBQUssR0FBRyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDM0IsQ0FBQztBQUFDLE1BQU0sQ0FBQyxDQUFBLENBQUM7QUFFVixNQUFNLE9BQU8sV0FBVztJQUNkLFNBQVMsQ0FBWTtJQUU3QixZQUFZLFNBQW9CO1FBQzlCLElBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO0lBQzdCLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksZUFBZSxDQUFDLEtBQWU7UUFDcEMsS0FBSyxDQUFDLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRWhDLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUN0QyxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUVwRSw0RkFBNEY7UUFDNUYsTUFBTSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzlGLEtBQUssQ0FBQyxrQ0FBa0MsRUFBRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFFdEYsS0FBSyxDQUFDLHdCQUF3QixFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3hDLEtBQUssQ0FBQyx5QkFBeUIsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUUxQyxxREFBcUQ7UUFDckQsSUFBSSxJQUFJLENBQUMsc0JBQXNCLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUN4QyxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUM5QyxPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFFRCwwREFBMEQ7UUFDMUQsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBRXpELElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUN0QiwrQkFBK0I7WUFDL0IsT0FBTyxJQUFJLENBQUMsc0JBQXNCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQztRQUNyRSxDQUFDO2FBQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzdCLE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0QsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxzQkFBc0IsQ0FBQyxNQUFjO1FBQ25DLEtBQUssQ0FBQyx3QkFBd0IsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUV4QyxrQ0FBa0M7UUFDbEMsTUFBTSxhQUFhLEdBQThCO1lBQy9DLElBQUksRUFBRSxJQUFJO1lBQ1YsR0FBRyxFQUFFLElBQUk7WUFDVCxLQUFLLEVBQUUsSUFBSTtZQUNYLEdBQUcsRUFBRSxJQUFJO1lBQ1QsR0FBRyxFQUFFLElBQUk7WUFDVCxJQUFJLEVBQUUsSUFBSTtZQUNWLElBQUksRUFBRSxJQUFJO1lBQ1YsSUFBSSxFQUFFLElBQUk7WUFDVixJQUFJLEVBQUUsSUFBSTtZQUNWLElBQUksRUFBRSxJQUFJO1lBQ1YsSUFBSSxFQUFFLElBQUk7WUFDVixLQUFLLEVBQUUsSUFBSTtZQUNYLEdBQUcsRUFBRSxJQUFJO1lBQ1QsS0FBSyxFQUFFLElBQUk7WUFDWCxHQUFHLEVBQUUsSUFBSTtZQUNULEdBQUcsRUFBRSxJQUFJO1lBQ1QsR0FBRyxFQUFFLElBQUk7WUFDVCxHQUFHLEVBQUUsSUFBSTtZQUNULEdBQUcsRUFBRSxJQUFJO1lBQ1QsS0FBSyxFQUFFLElBQUk7WUFDWCxHQUFHLEVBQUUsSUFBSTtZQUNULElBQUksRUFBRSxJQUFJO1lBQ1YsSUFBSSxFQUFFLElBQUk7U0FDWCxDQUFDO1FBV0YsTUFBTSxlQUFlLEdBQXFCO1lBQ3hDLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUU7WUFDaEQsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtZQUNqRCxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFO1lBQ2hELEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUU7WUFDakQsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtZQUVqRCxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxF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