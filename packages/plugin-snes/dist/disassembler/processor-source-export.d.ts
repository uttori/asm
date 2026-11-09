import type { RomImage } from "@uttori/asm-disassembler";
import { Spc700AramImage } from "./spc700-address-space.js";
import type { Spc700UploadStream } from "./spc700-upload.js";
import { SuperFxRomImage } from "./superfx-address-space.js";
/**
 * Renders a standalone ARAM image as byte-exact native SPC700 source.
 * @param image ARAM bytes and load address.
 * @returns Native source that recreates the payload.
 */
export declare const renderSpc700AramSource: (image: Spc700AramImage) => string;
/**
 * Renders an explicitly parsed NSPC stream as byte-exact native embedded-block source.
 * @param rom Source ROM containing the payload bytes.
 * @param stream Validated upload-stream structure.
 * @returns Native source that recreates the stream.
 */
export declare const renderSpc700UploadSource: (rom: RomImage, stream: Spc700UploadStream) => string;
/**
 * Renders a contiguous GSU program image as byte-exact native SuperFX source.
 * @param image GSU bytes and logical load address.
 * @returns Native source that recreates the program image.
 */
export declare const renderSuperFxRomSource: (image: SuperFxRomImage) => string;
//# sourceMappingURL=processor-source-export.d.ts.map