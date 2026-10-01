import { type SourceGenerationFile } from "./generation.js";
/** Immutable input copies travel with a pure generation; editable research files remain authoritative. */
export declare const SOURCE_INPUT_SNAPSHOT_FILE = ".uttori/generation-snapshot.json";
/** Serialize exact compact inputs, including original whitespace, without copying evidence or private ROMs. */
export declare function createSourceInputSnapshot(files: readonly SourceGenerationFile[]): SourceGenerationFile;
/** Decode an immutable snapshot for inspection/reproduction. This function never writes into the source checkout. */
export declare function readSourceInputSnapshot(bytes: Uint8Array): readonly SourceGenerationFile[];
//# sourceMappingURL=input-snapshot.d.ts.map