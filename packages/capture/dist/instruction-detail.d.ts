/** Bytes and state captured at execution time for the address at the same batch index. */
export interface CaptureInstructionDetail {
    readonly bytes: readonly number[];
    readonly state: Readonly<Record<string, string | number | boolean>>;
    readonly droppedMemoryAccesses?: number;
    readonly memoryAccesses?: readonly {
        readonly addressSpace: string;
        readonly address: number;
        readonly access: "read" | "write" | "fetch";
        readonly width: number;
        readonly value?: number;
        readonly actor?: "cpu" | "dma" | "hdma";
        readonly channel?: number;
    }[];
}
//# sourceMappingURL=instruction-detail.d.ts.map