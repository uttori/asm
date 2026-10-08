/** A producer-verified graphics port operation. Timing stays in the immutable capture archive.
 * Physical CPU offsets use the domain named by offsetStateField in instruction snapshots
 * (NES prg0 excludes both header and trainer). They are never inferred from a bus PC.
 */
export interface RuntimeGraphicsFact {
    readonly addressSpace: string;
    readonly address: number;
    readonly pc: number;
    readonly actor: string;
    readonly context: "instruction" | "interrupt" | "unattributed";
    readonly direction: "read" | "write";
    readonly value: number;
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