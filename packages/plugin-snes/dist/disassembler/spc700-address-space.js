import { createHash } from "node:crypto";
/** Project address-space id for the SPC700's private 64 KiB memory bus. */
export const SPC700_ARAM_ADDRESS_SPACE = "snes.spc700.aram";
/** Native-project descriptor for SPC700 ARAM addresses. */
export const SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR = Object.freeze({
    id: SPC700_ARAM_ADDRESS_SPACE,
    name: "SPC700 ARAM",
    addressBits: 16,
    kind: "memory",
});
/** Immutable contiguous ARAM image used by standalone SPC700 analysis. */
export class Spc700AramImage {
    /** First 16-bit ARAM address represented by the image. */
    loadAddress;
    /** Lowercase hex SHA-256 of the image bytes, fixed at construction. */
    contentSha256;
    #bytes;
    /**
     * Copies the bytes and validates that they fit contiguously below `$10000`.
     * @param bytes Contiguous bytes copied into the image.
     * @param [loadAddress] First 16-bit ARAM address represented by `bytes`.
     */
    constructor(bytes, loadAddress = 0) {
        if (!Number.isInteger(loadAddress) || loadAddress < 0 || loadAddress > 0xffff) {
            throw new Error("SPC700 ARAM loadAddress must be a 16-bit unsigned integer.");
        }
        if (bytes.length > 0x10000 || loadAddress + bytes.length > 0x10000) {
            throw new Error("SPC700 ARAM images must fit contiguously within the 16-bit address space.");
        }
        this.#bytes = Uint8Array.from(bytes);
        this.loadAddress = loadAddress;
        this.contentSha256 = createHash("sha256").update(this.#bytes).digest("hex");
    }
    /**
     * Number of represented ARAM bytes.
     * @returns Backing-image length.
     */
    get length() {
        return this.#bytes.length;
    }
    /**
     * Returns a defensive copy of the represented bytes.
     * @returns Copied image bytes.
     */
    bytes() {
        return this.#bytes.slice();
    }
    /**
     * Reads one byte by 16-bit ARAM address.
     * @param address SPC700 memory address.
     * @returns Byte value, or `undefined` outside the image.
     */
    readByte(address) {
        const identity = this.identifyAddress(address);
        return identity ? this.#bytes[identity.imageOffset] : undefined;
    }
    /**
     * Maps a represented ARAM address to its backing-image offset.
     * @param address SPC700 memory address.
     * @returns Address identity when represented.
     */
    identifyAddress(address) {
        if (!Number.isInteger(address) || address < this.loadAddress) {
            return undefined;
        }
        const imageOffset = address - this.loadAddress;
        if (address > 0xffff || imageOffset >= this.length) {
            return undefined;
        }
        return { addressSpace: SPC700_ARAM_ADDRESS_SPACE, address, imageOffset };
    }
    /**
     * Maps a backing-image offset to its 16-bit ARAM address.
     * @param imageOffset Offset in the contiguous backing image.
     * @returns Address identity when represented.
     */
    identifyOffset(imageOffset) {
        if (!Number.isInteger(imageOffset) || imageOffset < 0 || imageOffset >= this.length) {
            return undefined;
        }
        return {
            addressSpace: SPC700_ARAM_ADDRESS_SPACE,
            address: this.loadAddress + imageOffset,
            imageOffset,
        };
    }
}
//# sourceMappingURL=spc700-address-space.js.map