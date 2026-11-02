import type { AssemblyFileProvider, AssemblyFileResolutionOptions, AssemblyFileStat } from "../file-provider.js";
/** Own every consumed module input across passes, including virtual documents and converter resources. */
export declare class ModuleFileProvider implements AssemblyFileProvider {
    private readonly provider;
    readonly snapshots: Map<string, Uint8Array<ArrayBufferLike>>;
    private bytes;
    constructor(provider: AssemblyFileProvider);
    /** A new assembly observes fresh inputs; later passes share the first successful read. */
    beginBuild(): void;
    /** Inline entry source is consumed outside the provider but belongs to the same dependency receipt. */
    recordSource(filename: string, bytes: Uint8Array): void;
    /** Retained snapshots share one input-size ceiling, regardless of the read path. */
    private retain;
    resolvePath(filename: string, options?: AssemblyFileResolutionOptions): string | undefined;
    stat(filename: string): AssemblyFileStat;
    /** Copies at both boundaries prevent providers or converter callbacks from mutating retained inputs. */
    readFile(filename: string): Uint8Array;
    readTextFile(filename: string, encoding?: BufferEncoding): string;
}
//# sourceMappingURL=module-file-provider.d.ts.map