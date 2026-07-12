import * as fs from "fs";
import { CRC32 } from "./crc32.js";

let debug = (..._args: unknown[]): void => {};
/* c8 ignore next */
try { const { default: d } = await import("debug"); debug = d("Addr2Line"); } catch {}

/**
 * Reads a file from disk.
 * Returns the file content as a Buffer if successful; otherwise returns null.
 * @param {string} filename The path to the file to read.
 * @returns {Buffer | null} The file content as a Buffer, or null if the file cannot be read.
 */
function readFileContent(filename: string): Buffer | null {
  try {
    // console.log(`addr2line readFileContent: ${filename}`);
    return fs.readFileSync(filename);
  } catch (err) {
    debug(`Error reading file ${filename}:`, err);
    // Could not read file – return null so that fileCrc remains 0.
    return null;
  }
}

/**
 * Information mapping a rom address to a source file and line number.
 */
interface AddrToLineInfo {
  fileIdx: number;
  line: number;
  addr: number;
}

/**
 * Represents an entry for a source file, storing its name and its file contents' CRC.
 */
interface FileEntry {
  name: string;
  crc: number;
}

/**
 * Class to store address-to-line mappings for richer symbolic information.
 * During assembly, included files and information about generated assembly
 * should be added here, and then read back during symbol file generation.
 */
export class AddressToLineMapping {
  fileList: FileEntry[];
  filenameCrcs: number[];
  addrToLineInfo: AddrToLineInfo[];

  constructor() {
    this.fileList = [];
    this.filenameCrcs = [];
    this.addrToLineInfo = [];
  }

  /**
   * Clears all stored mappings and file information.
   */
  reset(): void {
    this.fileList = [];
    this.filenameCrcs = [];
    this.addrToLineInfo = [];
  }

  /**
   * Adds information linking an output ROM address to a source file and line number.
   * @param {string} filename The name of the source file.
   * @param {number} line The line number in the source file.
   * @param {number} addr The output ROM address.
   */
  includeMapping(filename: string, line: number, addr: number): void {
    // console.log(`addr2line includeMapping: ${filename} ${line} ${addr}`);
    const fileIdx = this.getFileIndex(filename);
    const newInfo: AddrToLineInfo = { fileIdx, line, addr };
    this.addrToLineInfo.push(newInfo);
  }

  /**
   * Retrieves the index of the file in the file list.
   * If the file is new, it reads the file to compute its CRC and adds it to the list.
   * @param {string} filename The source file name.
   * @returns {number} The index of the file in the internal list.
   */
  getFileIndex(filename: string): number {
    // console.log(`addr2line getFileIndex: ${filename}`);
    // Compute the CRC of the filename using its UTF-8 bytes.
    const filenameCrc = CRC32.compute(Buffer.from(filename, "utf8"));
    // console.log(`addr2line getFileIndex: ${filenameCrc}`);

    // Check if the file already exists in our records.
    for (let i = 0; i < this.filenameCrcs.length; i++) {
      if (this.filenameCrcs[i] === filenameCrc) {
        return i;
      }
    }

    // If the file is new, attempt to read it to compute its content CRC.
    let fileCrc = 0;
    const data = readFileContent(filename);
    if (data) {
      fileCrc = CRC32.compute(data);
    }

    // Add the new file information.
    this.fileList.push({ name: filename, crc: fileCrc });
    this.filenameCrcs.push(filenameCrc);

    return this.fileList.length - 1;
  }
}
