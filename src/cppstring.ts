// libstr.ts

// --- Helper constants and functions ---

// The char_props table from C++
// Each element is a number (0–255) corresponding to the C++ unsigned char values.
export const char_props: number[] = [
    // 0x0
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x80,0x80,0x00,0x00,0x80,0x00,0x00,
    // 0x10
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    // 0x20
    0x80,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    // 0x30   !"#$%&'()*+,-./
    0x41,0x41,0x41,0x41,0x41,0x41,0x41,0x41,0x41,0x41,0x00,0x00,0x00,0x00,0x00,0x00,
    // 0x40   0123456789:;<=>?
    0x00,0x23,0x23,0x23,0x23,0x23,0x23,0x22,0x22,0x22,0x22,0x22,0x22,0x22,0x22,0x22,
    // 0x50   @ABCDEFGHIJKLMNO
    0x22,0x22,0x22,0x22,0x22,0x22,0x22,0x22,0x22,0x22,0x22,0x00,0x00,0x00,0x00,0x08,
    // 0x60   PQRSTUVWXYZ[\]^_
    0x00,0x25,0x25,0x25,0x25,0x25,0x25,0x24,0x24,0x24,0x24,0x24,0x24,0x24,0x24,0x24,
    // 0x70   `abcdefghijklmno
    0x24,0x24,0x24,0x24,0x24,0x24,0x24,0x24,0x24,0x24,0x24,0x00,0x00,0x00,0x00,0x00,
    // 0x80   pqrstuvwxyz{|}~
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    // 0x90
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    // 0xA0
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    // 0xB0
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    // 0xC0
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    // 0xD0
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    // 0xE0
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    // 0xF0
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
];

// Bitwise functions for character conversion using the char_props table.
export function to_lower(c: number): number {
    return c | (char_props[c] & 0x20);
}

export function to_upper(c: number): number {
    return c & ~(char_props[c] & 0x20);
}

export function is_space(c: number): boolean {
    return (char_props[c] & 0x80) !== 0;
}

export function is_digit(c: number): boolean {
    return (char_props[c] & 0x40) !== 0;
}

export function is_alpha(c: number): boolean {
    return (char_props[c] & 0x20) !== 0;
}

export function is_lower(c: number): boolean {
    return (char_props[c] & 0x04) !== 0;
}

export function is_upper(c: number): boolean {
    return (char_props[c] & 0x02) !== 0;
}

export function is_alnum(c: number): boolean {
    return (char_props[c] & 0x60) !== 0;
}

export function is_ualpha(c: number): boolean {
    return (char_props[c] & 0x28) !== 0;
}

export function is_ualnum(c: number): boolean {
    return (char_props[c] & 0x68) !== 0;
}

export function is_xdigit(c: number): boolean {
    return (char_props[c] & 0x01) !== 0;
}

// Returns a duplicate of a string.
export function duplicate_string(str: string): string {
    return str.slice(0);
}

// Copies up to copy_length characters from source.
export function copy(source: string, copy_length: number): string {
    return source.substr(0, copy_length);
}

export function min_val(a: number, b: number): number {
    return a > b ? b : a;
}

export function bit_round(v: number): number {
    v--;
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    v++;
    return v;
}

// --- File I/O and UTF-8 helper functions ---

// Stub for warning; in your project you may replace this with a proper warning/exception mechanism.
export function asar_throw_warning(arg0: number, warning_id: string, ...args: any[]): void {
    console.warn("Warning:", warning_id, ...args);
}

// For virtual file system functions we declare stubs.
// (You can supply implementations or adjust as needed.)
export const INVALID_VIRTUAL_FILE_HANDLE: any = null;
declare const filesystem: {
    open_file: (fname: string, basepath: string) => any,
    get_file_size: (file: any) => number,
    read_file: (file: any, data: Buffer, offset: number, length: number) => number,
    close_file: (file: any) => void,
};

// Checks for a UTF-8 BOM at the start of a string; returns the number of bytes to skip.
export function check_bom(str: string): number {
    if (str.length >= 3 &&
        str.charCodeAt(0) === 0xEF &&
        str.charCodeAt(1) === 0xBB &&
        str.charCodeAt(2) === 0xBF) {
        asar_throw_warning(0, "warning_id_byte_order_mark_utf8");
        return 3;
    }
    return 0;
}

// Reads a single UTF-8 codepoint from inp (given as string) starting at index 0.
// Returns the number of characters consumed (as UTF-8 bytes) and sets codepoint via an object.
export function utf8_val(inp: string): { codepoint: number, length: number } {
    const c = inp.charCodeAt(0);
    let val: number;
    if (c < 0x80) {
        return { codepoint: c, length: 1 };
    } else if (c > 0xC1 && c < 0xF5) {
        const cont_byte_count = (c >= 0xF0) ? 3 : (c >= 0xE0) ? 2 : 1;
        val = c & ((1 << (6 - cont_byte_count)) - 1);
        let i = 1;
        for (; i <= cont_byte_count; i++) {
            const next = inp.charCodeAt(i);
            if ((next & 0xC0) !== 0x80) {
                return { codepoint: -1, length: 0 };
            }
            val = (val << 6) | (next & 0x3F);
        }
        // Validate codepoint
        if ((inp.charCodeAt(i) & 0xC0) === 0x80 ||
            val > 0x10FFFF ||
            (cont_byte_count === 3 && val < 0x1000) ||
            (cont_byte_count === 2 && val < 0x800) ||
            (cont_byte_count === 1 && val < 0x80) ||
            (val >= 0xD800 && val <= 0xDFFF)) {
            return { codepoint: -1, length: 0 };
        }
        return { codepoint: val, length: 1 + cont_byte_count };
    }
    return { codepoint: -1, length: 0 };
}

// Checks if a string is valid UTF-8. (Assumes the string is a binary–encoded string.)
export function is_valid_utf8(inp: string): boolean {
    let i = 0;
    while (i < inp.length) {
        const { codepoint, length } = utf8_val(inp.substring(i));
        if (codepoint === -1 || length === 0) return false;
        i += length;
    }
    return true;
}

// --- File reading functions ---

// Reads a file using the virtual file system.
// (Replace the implementation with your actual virtual file system code as needed.)
export function readfile(fname: string, basepath: string): string | null {
    const myfile = filesystem.open_file(fname, basepath);
    if (myfile === INVALID_VIRTUAL_FILE_HANDLE) return null;
    const datalen = filesystem.get_file_size(myfile);
    // Using Buffer to simulate binary reading
    const buf = Buffer.alloc(datalen + 1);
    const readCount = filesystem.read_file(myfile, buf, 0, datalen);
    buf[readCount] = 0;
    filesystem.close_file(myfile);
    let data = buf.toString("binary");
    let inpos = 0;
    let out = "";
    inpos += check_bom(data.substring(inpos));
    while (inpos < data.length) {
        if (data[inpos] !== '\r') out += data[inpos];
        inpos++;
    }
    if (!is_valid_utf8(out)) {
        asar_throw_warning(0, "warning_id_feature_deprecated", "non-UTF-8 source files",
            "Re-save the file as UTF-8 in a text editor of choice and avoid using non-ASCII characters in Asar versions < 2.0");
    }
    return out;
}

// Reads a file directly using Node.js file system.
import * as fs from "fs";
export function readfilenative(fname: string): string | null {
    try {
        let data = fs.readFileSync(fname, { encoding: "binary" });
        let inpos = 0;
        let out = "";
        inpos += check_bom(data.substring(inpos));
        while (inpos < data.length) {
            if (data[inpos] !== '\r') out += data[inpos];
            inpos++;
        }
        if (!is_valid_utf8(out)) {
            asar_throw_warning(0, "warning_id_feature_deprecated", "non-UTF-8 source files",
                "Re-save the file as UTF-8 in a text editor of choice and avoid using non-ASCII characters in Asar versions < 2.0");
        }
        return out;
    } catch (e) {
        return null;
    }
}

// Reads a file and returns its data and length.
export function readfileData(fname: string, basepath: string): { data: string, len: number } | null {
    const myfile = filesystem.open_file(fname, basepath);
    if (!myfile) return null;
    const datalen = filesystem.get_file_size(myfile);
    // In TS we simply read the entire file as a string.
    // (Replace with your own file I/O if needed.)
    const buf = Buffer.alloc(datalen);
    const readCount = filesystem.read_file(myfile, buf, 0, datalen);
    filesystem.close_file(myfile);
    return { data: buf.toString(), len: readCount };
}

// --- CString Class ---
//
// This class is a TypeScript translation of the C++ "string" class.
// In TypeScript we simply store the string in a private property.
// Many methods (such as length, assign, replace, etc.) are provided.
// Note that operator overloads in C++ have been converted to methods.
export class CString {
    private _data: string;

    // Constructors
    constructor();
    constructor(newstr: string);
    constructor(newstr: string, newlen: number);
    constructor(old?: any, newlen?: any) {
        if (old === undefined) {
            // Default constructor
            this._data = "";
        } else if (typeof old === "string" && newlen === undefined) {
            // Construct from a C-string
            this._data = "";
            this.assign(old);
        } else if (typeof old === "string" && typeof newlen === "number") {
            // Construct from a string and a length
            this._data = "";
            this.assign(old.substring(0, newlen));
        } else if (old instanceof CString) {
            // Copy constructor
            this._data = "";
            this.assign(old.data());
        } else {
            this._data = "";
        }
    }

    // Returns the underlying string data.
    data(): string {
        return this._data;
    }

    // Alias for data(); in C++ these might return raw char* pointers.
    temp_raw(): string {
        return this._data;
    }
    raw(): string {
        return this._data;
    }

    // Returns the length of the string.
    length(): number {
        return this._data.length;
    }

    // Sets the length of the string.
    // In this TS version, if new length is less than current, we truncate.
    // (If greater, we leave it unchanged.)
    set_length(length: number): void {
        if (length < this._data.length) {
            this._data = this._data.substring(0, length);
        }
        // (In C++ this would affect allocated/inlined storage.)
    }

    // Truncates the string to newlen.
    truncate(newlen: number): void {
        this.resize(newlen);
    }

    // Assigns a new string.
    assign(newstr: string): void;
    assign(newstr: CString): void;
    assign(newstr: any, end?: number): void {
        if (newstr instanceof CString) {
            this.assign(newstr.data());
        } else {
            if (newstr === null || newstr === undefined) newstr = "";
            if (end !== undefined) {
                this.resize(end);
                // In C++ a memory copy would occur.
                this._data = newstr.substring(0, end);
            } else {
                this._data = newstr;
            }
        }
    }

    // Appends another string (or CString) to this string.
    append(other: string | CString): this {
        let otherStr = (other instanceof CString) ? other.data() : other;
        this._data = this._data + otherStr;
        return this;
    }

    // Returns a new CString which is the concatenation of this string and a character.
    plus(right: string): CString {
        const ret = new CString(this);
        ret.append(right);
        return ret;
    }

    // Equality comparisons.
    equals(right: string | CString): boolean {
        let rightStr = (right instanceof CString) ? right.data() : right;
        return this._data === rightStr;
    }
    notEquals(right: string | CString): boolean {
        return !this.equals(right);
    }

    // Replace occurrences of 'instr' with 'outstr'.
    // If all is false, only the first occurrence is replaced.
    replace(instr: string, outstr: string, all: boolean = true): this {
        if (!all) {
            const idx = this._data.indexOf(instr);
            if (idx === -1) return this;
            this._data = this._data.substring(0, idx) + outstr + this._data.substring(idx + instr.length);
            return this;
        }
        // Replace all occurrences until none remain.
        while (this._data.indexOf(instr) !== -1) {
            this._data = this._data.split(instr).join(outstr);
        }
        return this;
    }

    // qreplace: similar to replace but skips over quoted parts.
    qreplace(instr: string, outstr: string, all: boolean = true): this {
        if (this._data.indexOf(instr) === -1) return this;
        if (this._data.indexOf('"') === -1 && this._data.indexOf("'") === -1) {
            return this.replace(instr, outstr, all);
        }
        let replaced = false;
        let result = "";
        let i = 0;
        while (i < this._data.length) {
            const ch = this._data[i];
            if (ch === '"' || ch === "'") {
                // Copy quoted segment as-is.
                const quote = ch;
                result += ch;
                i++;
                while (i < this._data.length && this._data[i] !== quote) {
                    // Handle doubled quote (special case)
                    if (i + 1 < this._data.length && this._data[i] === quote && this._data[i + 1] === quote) {
                        result += quote;
                        i += 2;
                    } else {
                        result += this._data[i++];
                    }
                }
                if (i < this._data.length) {
                    result += this._data[i++];
                }
            } else if (this._data.substr(i, instr.length) === instr) {
                replaced = true;
                result += outstr;
                i += instr.length;
                if (!all) {
                    result += this._data.substring(i);
                    break;
                }
            } else {
                result += this._data[i++];
            }
        }
        if (replaced) {
            this._data = result;
        }
        return this;
    }

    // Conversion to string.
    toString(): string {
        return this.data();
    }

    // Conversion to boolean (true if non-empty).
    valueOf(): boolean {
        return this.length() > 0;
    }

    // resize: in this TS version we simply truncate or leave as is.
    resize(new_length: number): void {
        if (new_length < this._data.length) {
            this._data = this._data.substring(0, new_length);
        } else if (new_length > this._data.length) {
            // In C++ this would allocate more space; here we simply pad with empty string.
            // (You could pad with spaces if desired.)
        }
        // Always ensure “null termination” is implicit.
    }
}

// For convenience, an alias similar to the C++ macro STR.
export function STR(newstr: string | CString): CString {
    if (newstr instanceof CString) return newstr;
    return new CString(newstr);
}

// --- Other string utility functions ---

// Remove surrounding quotes from a string, if they exist.
// Returns the dequoted string or null if an error occurs.
export function dequote(str: string): string | null {
    if (str[0] !== '"') return str;
    let inpos = 1;
    let out = "";
    while (true) {
        if (inpos >= str.length) return null;
        if (str[inpos] === '"') {
            if (inpos + 1 < str.length && str[inpos + 1] === '"') {
                inpos++;
            } else if (inpos + 1 === str.length) {
                break;
            } else {
                return null;
            }
        }
        out += str[inpos++];
    }
    return out;
}

// Searches for key in str while ignoring quoted sections.
// Returns the index of the first occurrence or -1 if not found.
export function strqpchr(str: string, key: string): number {
    let i = 0;
    while (i < str.length) {
        const ch = str[i];
        if (ch === '"' || ch === "'") {
            const quote = ch;
            i++;
            while (i < str.length && str[i] !== quote) { i++; }
            if (i < str.length) i++;
        } else if (ch === key) {
            return i;
        } else {
            i++;
        }
    }
    return -1;
}

// Searches for key in str (as a substring) while ignoring quoted sections.
// Returns the index or -1 if not found.
export function strqpstr(str: string, key: string): number {
    let i = 0;
    while (i < str.length) {
        const ch = str[i];
        if (ch === '"' || ch === "'") {
            const quote = ch;
            i++;
            while (i < str.length && str[i] !== quote) { i++; }
            if (i < str.length) i++;
        } else if (str.substr(i, key.length) === key) {
            return i;
        } else {
            i++;
        }
    }
    return -1;
}

// Reverse search for key in str while ignoring quotes.
export function strqrchr(str: string, key: string): number {
    let ret = -1;
    let i = 0;
    while (i < str.length) {
        const ch = str[i];
        if (ch === '"' || ch === "'") {
            const quote = ch;
            i++;
            while (i < str.length && str[i] !== quote) { i++; }
            if (i < str.length) i++;
        } else {
            if (ch === key) ret = i;
            i++;
        }
    }
    return ret;
}

// Returns a new CString constructed from the first len characters of str.
export function substr(str: string, len: number): CString {
    return new CString(str.substring(0, len));
}

// Convert a number to a hexadecimal CString.
// If width is not provided, the width is chosen based on the value.
export function hex(value: number, width?: number): string {
//   console.log('hex', value, width)
  if (value === undefined) {
    console.error('hex no value!');
    return ''
  }
    if (width !== undefined) {
        let s = value.toString(16).toUpperCase();
        return s.padStart(width, "0");
    } else {
        if (value <= 0x000000FF)
          return value.toString(16).toUpperCase().padStart(2, "0");
        else if (value <= 0x0000FFFF)
          return value.toString(16).toUpperCase().padStart(4, "0");
        else if (value <= 0x00FFFFFF)
          return value.toString(16).toUpperCase().padStart(6, "0");
        else
          return value.toString(16).toUpperCase().padStart(8, "0");
    }
}

export function hex0(value: number): CString {
    return new CString(value.toString(16).toUpperCase());
}
export function hex2(value: number): CString {
    return new CString(value.toString(16).toUpperCase().padStart(2, "0"));
}
export function hex3(value: number): CString {
    return new CString(value.toString(16).toUpperCase().padStart(3, "0"));
}
export function hex4(value: number): CString {
    return new CString(value.toString(16).toUpperCase().padStart(4, "0"));
}
export function hex5(value: number): CString {
    return new CString(value.toString(16).toUpperCase().padStart(5, "0"));
}
export function hex6(value: number): CString {
    return new CString(value.toString(16).toUpperCase().padStart(6, "0"));
}
export function hex8(value: number): CString {
    return new CString(value.toString(16).toUpperCase().padStart(8, "0"));
}

// Convert a number to a decimal CString.
export function dec(value: number): CString {
    return new CString(value.toString());
}

// Convert a double to a string with 100 digits of precision and trim trailing zeros.
export function ftostr(value: number): CString {
    let s = value.toFixed(100);
    // Remove trailing zeros and possibly the dot.
    s = s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
    return new CString(s);
}

// Same as above but with variable precision.
export function ftostrvar(value: number, precision: number): CString {
    if (precision < 0) precision = 0;
    if (precision > 100) precision = 100;
    let s = value.toFixed(precision);
    s = s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
    return new CString(s);
}

// Checks if str begins with key, case-insensitively.
export function stribegin(str: string, key: string): boolean {
    return str.substring(0, key.length).toLowerCase() === key.toLowerCase();
}

// Checks if str ends with key, case-insensitively.
export function striend(str: string, key: string): boolean {
    return str.substring(str.length - key.length).toLowerCase() === key.toLowerCase();
}

// Case-insensitive compare with uppercase conversion.
export function stricmpwithupper(word1: string, word2: string): boolean {
    // Returns true if different.
    return word1.toUpperCase() !== word2;
}

// Case-insensitive compare with lowercase conversion.
export function stricmpwithlower(word1: string, word2: string): boolean {
    return word1.toLowerCase() !== word2;
}

// Searches for a pattern in a string ignoring case.
export function stristr(string_: string, pattern: string): string | null {
    if (!pattern) return string_;
    const lowerString = string_.toLowerCase();
    const lowerPattern = pattern.toLowerCase();
    const index = lowerString.indexOf(lowerPattern);
    return index !== -1 ? string_.substring(index) : null;
}

// --- Functions for splitting strings ---

// Splits a string by key; if key is not found, returns an array with the original string.
export function nsplit(str: string, key: string, maxlen: number = 0): string[] {
    if (str.indexOf(key) === -1) {
        return [str];
    }
    let parts = str.split(key);
    // The maxlen parameter in the original code limits the allocation size.
    // Here we ignore it (or you may slice the array if needed).
    return parts;
}

// Splits a string by key while respecting quotes.
export function qnsplit(str: string, key: string, maxlen: number = 0): string[] {
    if (str.indexOf('"') === -1 && str.indexOf("'") === -1) return nsplit(str, key, maxlen);
    let parts: string[] = [];
    let current = "";
    let i = 0;
    while (i < str.length) {
        if (str[i] === '"' || str[i] === "'") {
            const quote = str[i];
            current += str[i++];
            while (i < str.length && str[i] !== quote) {
                current += str[i++];
            }
            if (i < str.length) {
                current += str[i++];
            }
        } else if (str.substr(i, key.length) === key) {
            parts.push(current);
            current = "";
            i += key.length;
        } else {
            current += str[i++];
        }
    }
    parts.push(current);
    return parts;
}

// Splits a string by key while skipping over both quoted sections and parenthesized sections.
export function qpnsplit(str: string, key: string, maxlen: number = 0): string[] {
    let parts: string[] = [];
    let current = "";
    let i = 0;
    let parenDepth = 0;
    while (i < str.length) {
        const ch = str[i];
        if (ch === '"' || ch === "'") {
            const quote = ch;
            current += ch;
            i++;
            while (i < str.length && str[i] !== quote) {
                current += str[i++];
            }
            if (i < str.length) {
                current += str[i++];
            }
        } else if (ch === '(') {
            parenDepth++;
            current += ch;
            i++;
        } else if (ch === ')') {
            parenDepth = Math.max(parenDepth - 1, 0);
            current += ch;
            i++;
        } else if (parenDepth === 0 && str.substr(i, key.length) === key) {
            parts.push(current);
            current = "";
            i += key.length;
        } else {
            current += ch;
            i++;
        }
    }
    parts.push(current);
    return parts;
}

// Inline split functions as aliases.
export function split(str: string, key: string): string[] {
    return nsplit(str, key);
}
export function qsplit(str: string, key: string): string[] {
    return qnsplit(str, key);
}
export function qpsplit(str: string, key: string): string[] {
    return qpnsplit(str, key);
}
export function split1(str: string, key: string): string[] {
    return nsplit(str, key, 2);
}
export function qsplit1(str: string, key: string): string[] {
    return qnsplit(str, key, 2);
}
export function qpsplit1(str: string, key: string): string[] {
    return qpnsplit(str, key, 2);
}

// --- Functions to trim or strip strings ---

export function strip_prefix(str: CString, c: string, multi: boolean = false): CString {
    let s = str.data();
    if (!multi) {
        if (s[0] === c) {
            return new CString(s.substring(1));
        }
        return str;
    }
    let i = 0;
    while (i < s.length && s[i] === c) { i++; }
    return new CString(s.substring(i));
}

export function strip_suffix(str: CString, c: string, multi: boolean = false): CString {
    let s = str.data();
    if (!multi) {
        if (s[s.length - 1] === c) {
            return new CString(s.substring(0, s.length - 1));
        }
        return str;
    }
    let i = s.length - 1;
    while (i >= 0 && s[i] === c) { i--; }
    return new CString(s.substring(0, i + 1));
}

export function strip_both(str: CString, c: string, multi: boolean = false): CString {
    return strip_suffix(strip_prefix(str, c, multi), c, multi);
}

export function strip_whitespace(str: CString): CString {
    let s = str.data();
    // Trim trailing whitespace (space and tab)
    let i = s.length - 1;
    while (i >= 0 && (s[i] === ' ' || s[i] === '\t')) { i--; }
    s = s.substring(0, i + 1);
    // Trim leading whitespace
    i = 0;
    while (i < s.length && (s[i] === ' ' || s[i] === '\t')) { i++; }
    s = s.substring(i);
    return new CString(s);
}

// itrim: trims matching left and right substrings from a string.
export function itrim(input: CString, left: string, right: string, multi: boolean = false): CString {
    let s = input.data();
    // Remove right side substrings.
    let rightlen = right.length;
    let totallen = s.length;
    if (rightlen && rightlen <= totallen) {
        let nukeright = true;
        do {
            nukeright = true;
            if (s.substring(s.length - rightlen).toLowerCase() === right.toLowerCase()) {
                s = s.substring(0, s.length - rightlen);
            } else {
                nukeright = false;
            }
        } while (multi && nukeright && rightlen <= s.length);
    }
    // Remove left side substrings.
    let leftlen = left.length;
    if (!multi && leftlen === 1 && s[0] === left[0]) {
        s = s.substring(1);
    } else {
        let nukeleft = true;
        do {
            nukeleft = (s.substring(0, leftlen).toLowerCase() === left.toLowerCase());
            if (nukeleft) s = s.substring(leftlen);
        } while (multi && nukeleft);
    }
    return new CString(s);
}

// Uppercase conversion.
export function upper(old: CString): CString {
    return new CString(old.data().toUpperCase());
}

// Lowercase conversion.
export function lower(old: CString): CString {
    return new CString(old.data().toLowerCase());
}

// --- getconnectedlines ---
// Returns the number of connected lines (minus one) and concatenates them into out.
// This function assumes that a trailing '\' means the next line is connected.
export function getconnectedlines(lines: string[], startline: number, out: CString): number {
    let result = "";
    let count = 1;
    for (let i = startline; i < lines.length; i++) {
        let line = lines[i];
        let linelen = line.length;
        let found = false;
        for (let j = linelen - 1; j >= 0; j--) {
            if (line[j] !== ' ' && line[j] !== '\t' && line[j] !== ';') {
                if (line[j] === '\\') {
                    count++;
                    result += line.substring(0, j);
                    found = true;
                    break;
                } else {
                    result += line.substring(0, j + 1);
                    out.assign(result);
                    return count - 1;
                }
            }
        }
        if (!found) {
            result += line.substring(0, 1);
            out.assign(result);
            return count - 1;
        }
    }
    out.assign(result);
    return count - 1;
}

/**
 * A simple skipParen function: if the character at index i is '(',
 * then skip until the matching ')'.
 *
 * @param s The input string.
 * @param i The current index.
 * @returns The new index after the closing parenthesis, or -1 if unmatched.
 */
export function skipParen(s: string, i: number): number {
  if (s.charAt(i) !== '(') return i;
  i++; // skip '('
  let level = 1;
  while (i < s.length) {
    if (s.charAt(i) === '(') {
      level++;
    } else if (s.charAt(i) === ')') {
      level--;
      if (level === 0) {
        return i + 1;
      }
    }
    i++;
  }
  return -1;
}


/**
 * Checks that all parentheses in `str` are matched.
 * Returns true if all parentheses are properly closed.
 */
export function confirmqpar(str: string): boolean {
  let i = 0;
  while (i < str.length) {
    if (str.charAt(i) === '(') {
      const newIndex = skipParen(str, i);
      if (newIndex === -1) return false;
      i = newIndex;
    } else {
      i++;
    }
  }
  return true;
}
