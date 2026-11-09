import { type LinkOptions, type LinkResult } from "./types.js";
/** Link-result schema version stamped into emitted artifacts. */
export declare const LINKER_VERSION = "1";
/** Resolve libraries, allocate contributions, patch fields, finalize once, and produce matching owned artifacts. */
export declare function linkObjects(options: LinkOptions): LinkResult;
//# sourceMappingURL=driver.d.ts.map