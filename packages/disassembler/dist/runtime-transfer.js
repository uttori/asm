/** Normalize boundary fields for deterministic hashing; common event ordering is validated by the importer.
 * @param {RuntimeTransferBoundary} marker Untrusted marker from a transport-neutral source.
 * @returns {RuntimeTransferBoundary} Canonical marker; inconsistent counts/configuration throw.
 */
export const validateRuntimeTransferBoundary = (marker) => {
    const { configuration: c } = marker;
    if (!c ||
        !["dma", "hdma"].includes(marker.actor) ||
        !Number.isInteger(marker.channel) ||
        marker.channel < 0 ||
        marker.channel > 7 ||
        !["begin", "complete", "interrupted"].includes(marker.boundary) ||
        typeof marker.transferId !== "string" ||
        !/^(0|[1-9]\d{0,19})$/.test(marker.transferId) ||
        BigInt(marker.transferId) > 0xffffffffffffffffn ||
        !Number.isInteger(marker.pc) ||
        marker.pc < 0 ||
        marker.pc > 0xffffff ||
        !["unattributed", "instruction", "interrupt", "wait", "stop"].includes(marker.context) ||
        !Number.isInteger(marker.transferred) ||
        marker.transferred < 0 ||
        marker.transferred > 65536)
        throw new Error("Invalid transfer boundary attribution or count.");
    for (const field of ["dmap", "bbad", "a1b", "dasb", "ntlr"])
        if (!Number.isInteger(c[field]) || c[field] < 0 || c[field] > 255)
            throw new Error("Invalid transfer byte register.");
    for (const field of ["a1t", "das", "a2a"])
        if (!Number.isInteger(c[field]) || c[field] < 0 || c[field] > 65535)
            throw new Error("Invalid transfer word register.");
    if (!Number.isInteger(c.flags) || c.flags < 0 || c.flags > 15)
        throw new Error("Invalid transfer channel flags.");
    if (marker.boundary === "begin") {
        if (marker.transferId !== marker.sequence || marker.transferred !== 0)
            throw new Error("Invalid transfer begin identity.");
    }
    else if (BigInt(marker.transferId) >= BigInt(marker.sequence) || marker.transferred < 1)
        throw new Error("Invalid transfer end identity.");
    if (marker.actor === "hdma" && (marker.boundary === "interrupted" || marker.transferred > 4))
        throw new Error("Invalid HDMA payload-burst boundary.");
    return {
        kind: "transfer",
        sequence: marker.sequence,
        ordinal: marker.ordinal,
        cycle: marker.cycle,
        transferId: marker.transferId,
        pc: marker.pc,
        boundary: marker.boundary,
        actor: marker.actor,
        channel: marker.channel,
        context: marker.context,
        hcounter: marker.hcounter,
        vcounter: marker.vcounter,
        transferred: marker.transferred,
        configuration: {
            dmap: c.dmap,
            bbad: c.bbad,
            a1t: c.a1t,
            a1b: c.a1b,
            das: c.das,
            dasb: c.dasb,
            a2a: c.a2a,
            ntlr: c.ntlr,
            flags: c.flags,
        },
    };
};
/** Correlate explicit boundaries with payload accesses using at most sixteen open windows.
 * @returns {object} Streaming accumulator; finish preserves partial windows at capture edges.
 */
export const createRuntimeTransferAccumulator = () => {
    const open = new Map();
    const activity = new Map();
    const windows = [];
    let omittedWindows = 0;
    /** Retain all aggregate counts while bounding the report's example list.
     * @param {RuntimeTransferWindow} window Closed or explicitly partial observed window.
     */
    const retain = (window) => {
        const key = `${window.actor}:${window.channel}`;
        let group = activity.get(key);
        if (!group) {
            group = {
                actor: window.actor,
                channel: window.channel,
                complete: 0,
                interrupted: 0,
                leadingPartial: 0,
                trailingPartial: 0,
                bothPartial: 0,
                attemptedSlots: 0,
                reads: 0,
                writes: 0,
            };
            activity.set(key, group);
        }
        const fields = {
            complete: "complete",
            interrupted: "interrupted",
            "leading-partial": "leadingPartial",
            "trailing-partial": "trailingPartial",
            "both-partial": "bothPartial",
        };
        group[fields[window.status]]++;
        group.reads += window.reads;
        group.writes += window.writes;
        if (window.begin && window.end)
            group.attemptedSlots += window.end.transferred;
        if (!Number.isSafeInteger(group.attemptedSlots))
            throw new Error("Transfer slot total exceeds the safe integer range.");
        if (windows.length < 64)
            windows.push(window);
        else
            omittedWindows++;
    };
    return {
        /** Attach only DMA/HDMA payload events; table/pointer fetches remain separate bus evidence.
         * @param {RuntimeBusAccess | RuntimeTransferBoundary} event Already validated ordered event.
         */
        push: (event) => {
            if (event.actor === "cpu")
                return;
            const marker = "kind" in event;
            if (!marker && event.phase !== "dma" && event.phase !== "hdma-transfer")
                return;
            const key = `${event.actor}:${event.channel}`;
            let current = open.get(key);
            if (marker && event.boundary === "begin") {
                if (current)
                    throw new Error("Transfer began before the previous channel window ended.");
                open.set(key, {
                    actor: event.actor,
                    channel: event.channel,
                    begin: event,
                    reads: 0,
                    writes: 0,
                });
                return;
            }
            if (!current) {
                current = { actor: event.actor, channel: event.channel, reads: 0, writes: 0 };
                open.set(key, current);
            }
            if (!marker) {
                if (event.direction === "read")
                    current.reads++;
                else
                    current.writes++;
                const maximum = event.actor === "dma" ? 65536 : 4;
                if (current.reads > maximum || current.writes > maximum)
                    throw new Error("Transfer window exceeds the native payload bound.");
                return;
            }
            const expectedId = current.begin?.transferId ?? "0";
            if (event.transferId !== expectedId)
                throw new Error("Transfer end does not match its observed begin.");
            if (current.reads > event.transferred || current.writes > event.transferred)
                throw new Error("Transfer contains more observed accesses than attempted byte slots.");
            if (current.begin) {
                // In this SNES scope, A-bus register suppression and B-bus WRAM conflict
                // suppression cannot both apply to one slot. At least one access survives.
                if (current.reads + current.writes < event.transferred)
                    throw new Error("Transfer is missing bus accesses inside its observed boundaries.");
                const configuration = current.begin.configuration;
                let expected = configuration.das || 65536;
                if (event.actor === "hdma")
                    expected = [1, 2, 2, 4, 4, 4, 2, 4][configuration.dmap & 7];
                if ((event.boundary === "complete" && event.transferred !== expected) ||
                    event.transferred > expected)
                    throw new Error("Transfer completion disagrees with its starting configuration.");
            }
            let status = "leading-partial";
            if (current.begin)
                status = event.boundary === "complete" ? "complete" : "interrupted";
            retain({ ...current, end: event, status });
            open.delete(key);
        },
        /** Close remaining windows without claiming completion or an attempted slot count.
         * @returns {RuntimeTransferSummary} Bounded report with exact lifetime window counts.
         */
        finish: () => {
            for (const current of open.values())
                retain({ ...current, status: current.begin ? "trailing-partial" : "both-partial" });
            open.clear();
            return {
                activity: [...activity.entries()]
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([, value]) => value),
                windows,
                omittedWindows,
            };
        },
    };
};
//# sourceMappingURL=runtime-transfer.js.map