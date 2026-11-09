/**
 * A producer-verified graphics port operation. Timing stays in the immutable capture archive.
 * Physical CPU offsets use the domain named by offsetStateField in instruction snapshots
 * (NES prg0 excludes both header and trainer). They are never inferred from a bus PC.
 */
export interface RuntimeGraphicsFact {
    /** Bus address space of the accessed graphics port. */
    readonly addressSpace: string;
    /** Port address within addressSpace. */
    readonly address: number;
    /** Bus PC of the accessing instruction; never used to infer a physical offset. */
    readonly pc: number;
    /** Producer-named bus actor that performed the access. */
    readonly actor: string;
    /** Whether the access came from ordinary execution, an interrupt, or an unknown source. */
    readonly context: "instruction" | "interrupt" | "unattributed";
    /** Port access direction; only writes may carry an effect. */
    readonly direction: "read" | "write";
    /** Byte transferred through the port (0-255). */
    readonly value: number;
    /** Physical CPU offset of the instruction in the named snapshot domain, or null when unmapped. */
    readonly cpuMapping: {
        readonly offsetStateField: string;
        readonly physicalOffset: number;
    } | null;
    /** Actual storage effects; blocked writes have no byte destinations. */
    readonly effect: {
        readonly target: string;
        readonly outcome: "written" | "blocked";
        readonly bytes: readonly {
            readonly offset: number;
            readonly value: number;
        }[];
    } | null;
}
/** Validate target-neutral storage facts at every import and decode boundary. */
export declare function isRuntimeGraphicsFact(value: unknown): value is RuntimeGraphicsFact;
//# sourceMappingURL=runtime-graphics-fact.d.ts.map