import * as fs from "fs";
import { CRC32 } from "./crc32.js";
/**
 * Reads a file from disk.
 * Returns the file content as a Buffer if successful; otherwise returns null.
 * @param {string} filename The path to the file to read.
 * @returns {Buffer | null} The file content as a Buffer, or null if the file cannot be read.
 */
function readFileContent(filename) {
    try {
        // console.log(`addr2line readFileContent: ${filename}`);
        return fs.readFileSync(filename);
    }
    catch (err) {
        console.error(`Error reading file ${filename}:`, err);
        // Could not read file – return null so that fileCrc remains 0.
        return null;
    }
}
/**
 * Class to store address-to-line mappings for richer symbolic information.
 * During assembly, included files and information about generated assembly
 * should be added here, and then read back during symbol file generation.
 */
export class AddressToLineMapping {
    fileList;
    filenameCrcs;
    addrToLineInfo;
    constructor() {
        this.fileList = [];
        this.filenameCrcs = [];
        this.addrToLineInfo = [];
    }
    /**
     * Clears all stored mappings and file information.
     */
    reset() {
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
    includeMapping(filename, line, addr) {
        // console.log(`addr2line includeMapping: ${filename} ${line} ${addr}`);
        const fileIdx = this.getFileIndex(filename);
        const newInfo = { fileIdx, line, addr };
        this.addrToLineInfo.push(newInfo);
    }
    /**
     * Retrieves the index of the file in the file list.
     * If the file is new, it reads the file to compute its CRC and adds it to the list.
     * @param {string} filename The source file name.
     * @returns {number} The index of the file in the internal list.
     */
    getFileIndex(filename) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRkcjJsaW5lLmpzIiwic291cmNlUm9vdCI6Ii9Vc2Vycy9tYXR0aGV3L3V0dG9yaS9zbmVzLWFzbS1qcy8iLCJzb3VyY2VzIjpbInNyYy9hZGRyMmxpbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDekIsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVuQzs7Ozs7R0FLRztBQUNILFNBQVMsZUFBZSxDQUFDLFFBQWdCO0lBQ3ZDLElBQUksQ0FBQztRQUNILHlEQUF5RDtRQUN6RCxPQUFPLEVBQUUsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFDYixPQUFPLENBQUMsS0FBSyxDQUFDLHNCQUFzQixRQUFRLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN0RCwrREFBK0Q7UUFDL0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0FBQ0gsQ0FBQztBQW1CRDs7OztHQUlHO0FBQ0gsTUFBTSxPQUFPLG9CQUFvQjtJQUN2QixRQUFRLENBQWM7SUFDdEIsWUFBWSxDQUFXO0lBQ3ZCLGNBQWMsQ0FBbUI7SUFFekM7UUFDRSxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztRQUNuQixJQUFJLENBQUMsWUFBWSxHQUFHLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztJQUMzQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLO1FBQ0gsSUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7UUFDbkIsSUFBSSxDQUFDLFlBQVksR0FBRyxFQUFFLENBQUM7UUFDdkIsSUFBSSxDQUFDLGNBQWMsR0FBRyxFQUFFLENBQUM7SUFDM0IsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsY0FBYyxDQUFDLFFBQWdCLEVBQUUsSUFBWSxFQUFFLElBQVk7UUFDekQsd0VBQXdFO1FBQ3hFLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDNUMsTUFBTSxPQUFPLEdBQW1CLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUN4RCxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxZQUFZLENBQUMsUUFBZ0I7UUFDM0Isc0RBQXNEO1FBQ3RELHlEQUF5RDtRQUN6RCxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDakUseURBQXlEO1FBRXpELG1EQUFtRDtRQUNuRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNsRCxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUssV0FBVyxFQUFFLENBQUM7Z0JBQ3pDLE9BQU8sQ0FBQyxDQUFDO1lBQ1gsQ0FBQztRQUNILENBQUM7UUFFRCxxRUFBcUU7UUFDckUsSUFBSSxPQUFPLEdBQUcsQ0FBQyxDQUFDO1FBQ2hCLE1BQU0sSUFBSSxHQUFHLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN2QyxJQUFJLElBQUksRUFBRSxDQUFDO1lBQ1QsT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDaEMsQ0FBQztRQUVELGdDQUFnQztRQUNoQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDckQsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFcEMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDbEMsQ0FBQztDQUNGIn0=