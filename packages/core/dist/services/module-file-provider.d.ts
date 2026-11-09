import type { AssemblyFileProvider, AssemblyFileResolutionOptions, AssemblyFileStat } from "../file-provider.js";
/** Own every consumed module input across passes, including virtual documents and converter resources. */
export declare class ModuleFileProvider implements AssemblyFileProvider {
    private readonly provider;
    /** Immutable byte snapshots retained for the current build pass. */
    readonly snapshots: Map<string, Uint8Array<ArrayBufferLike>>;
    private bytes;
    constructor(provider: AssemblyFileProvider);
    /** A new assembly observes fresh inputs; later passes share the first successful read. */
    beginBuild(): void;
    /** Inline entry source is consumed outside the provider but belongs to the same dependency receipt. */
    recordSource(filename: string, bytes: Uint8Array): void;
    /** Retained snapshots share one input-size ceiling, regardless of the read path. */
    private retain;
    /** Delegates path resolution to the wrapped provider without caching. */
    resolvePath(filename: string, options?: AssemblyFileResolutionOptions): string | undefined;
    /** Delegates file metadata queries to the wrapped provider. */
    stat(filename: string): AssemblyFileStat;
    /** Copies at both boundaries prevent providers or converter callbacks from mutating retained inputs. */
    readFile(filename: string): Uint8Array;
    /** Decodes a retained snapshot using the same copy-on-read boundary as binary reads. */
    readTextFile(filename: string, encoding?: BufferEncoding): string;
}
//# sourceMappingURL=module-file-provider.d.ts.map