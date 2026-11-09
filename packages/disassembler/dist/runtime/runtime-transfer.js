/** Narrow parsed JSON to a plain object record. */
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Accept finite integers for register and counter fields. */
function isInteger(value) {
    return typeof value === "number" && Number.isInteger(value);
}
/** Read one bounded register field from a transfer configuration object. */
const readRegister = (configuration, field, maximum, message) => {
    const count = configuration[field];
    if (!(isInteger(count) && count >= 0 && count <= maximum)) {
        throw new Error(message);
    }
    return count;
};
/**
 * Normalize boundary fields for deterministic hashing. Common event ordering is validated by the importer.
 * @param marker Untrusted marker from a transport-neutral source.
 * @returns Canonical marker. Inconsistent counts/configuration throw.
 */
export const validateRuntimeTransferBoundary = (marker) => {
    if (!isRecord(marker) || !isRecord(marker.configuration)) {
        throw new Error("Invalid transfer boundary attribution or count.");
    }
    const configuration = marker.configuration;
    const actor = marker.actor;
    const channel = marker.channel;
    const boundary = marker.boundary;
    const transferId = marker.transferId;
    const pc = marker.pc;
    const context = marker.context;
    const transferred = marker.transferred;
    const sequence = marker.sequence;
    const ordinal = marker.ordinal;
    const cycle = marker.cycle;
    const hcounter = marker.hcounter;
    const vcounter = marker.vcounter;
    if ((actor !== "dma" && actor !== "hdma") ||
        !(isInteger(channel) && channel >= 0 && channel <= 7) ||
        (boundary !== "begin" && boundary !== "complete" && boundary !== "interrupted") ||
        typeof transferId !== "string" ||
        !/^(0|[1-9]\d{0,19})$/.test(transferId) ||
        BigInt(transferId) > 0xffffffffffffffffn ||
        !(isInteger(pc) && pc >= 0 && pc <= 0xffffff) ||
        (context !== "unattributed" &&
            context !== "instruction" &&
            context !== "interrupt" &&
            context !== "wait" &&
            context !== "stop") ||
        !(isInteger(transferred) && transferred >= 0 && transferred <= 65536) ||
        typeof sequence !== "string" ||
        typeof ordinal !== "string" ||
        typeof cycle !== "string" ||
        !isInteger(hcounter) ||
        !isInteger(vcounter)) {
        throw new Error("Invalid transfer boundary attribution or count.");
    }
    const dmap = readRegister(configuration, "dmap", 255, "Invalid transfer byte register.");
    const bbad = readRegister(configuration, "bbad", 255, "Invalid transfer byte register.");
    const a1b = readRegister(configuration, "a1b", 255, "Invalid transfer byte register.");
    const dasb = readRegister(configuration, "dasb", 255, "Invalid transfer byte register.");
    const ntlr = readRegister(configuration, "ntlr", 255, "Invalid transfer byte register.");
    const a1t = readRegister(configuration, "a1t", 65535, "Invalid transfer word register.");
    const das = readRegister(configuration, "das", 65535, "Invalid transfer word register.");
    const a2a = readRegister(configuration, "a2a", 65535, "Invalid transfer word register.");
    const flags = readRegister(configuration, "flags", 15, "Invalid transfer channel flags.");
    if (boundary === "begin") {
        if (transferId !== sequence || transferred !== 0) {
            throw new Error("Invalid transfer begin identity.");
        }
    }
    else if (BigInt(transferId) >= BigInt(sequence) || transferred < 1) {
        throw new Error("Invalid transfer end identity.");
    }
    if (actor === "hdma" && (boundary === "interrupted" || transferred > 4)) {
        throw new Error("Invalid HDMA payload-burst boundary.");
    }
    return {
        kind: "transfer",
        sequence,
        ordinal,
        cycle,
        transferId,
        pc,
        boundary,
        actor,
        channel,
        context,
        hcounter,
        vcounter,
        transferred,
        configuration: { dmap, bbad, a1t, a1b, das, dasb, a2a, ntlr, flags },
    };
};
/**
 * Correlate explicit boundaries with payload accesses using at most sixteen open windows.
 * @returns Streaming accumulator. Finish preserves partial windows at capture edges.
 */
export const createRuntimeTransferAccumulator = () => {
    const open = new Map();
    const activity = new Map();
    const windows = [];
    let omittedWindows = 0;
    /**
     * Retain all aggregate counts while bounding the report's example list.
     * @param window Closed or explicitly partial observed window.
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
        if (window.begin && window.end) {
            group.attemptedSlots += window.end.transferred;
        }
        if (!Number.isSafeInteger(group.attemptedSlots)) {
            throw new Error("Transfer slot total exceeds the safe integer range.");
        }
        if (windows.length < 64) {
            windows.push(window);
        }
        else {
            omittedWindows++;
        }
    };
    return {
        /**
         * Attach only DMA/HDMA payload events. Table/pointer fetches remain separate bus evidence.
         * @param event Already validated ordered event.
         */
        push: (event) => {
            if (event.actor === "cpu") {
                return;
            }
            const marker = "kind" in event;
            if (!marker && event.phase !== "dma" && event.phase !== "hdma-transfer") {
                return;
            }
            const key = `${event.actor}:${event.channel}`;
            let current = open.get(key);
            if (marker && event.boundary === "begin") {
                if (current) {
                    throw new Error("Transfer began before the previous channel window ended.");
                }
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
                if (event.direction === "read") {
                    current.reads++;
                }
                else {
                    current.writes++;
                }
                const maximum = event.actor === "dma" ? 65536 : 4;
                if (current.reads > maximum || current.writes > maximum) {
                    throw new Error("Transfer window exceeds the native payload bound.");
                }
                return;
            }
            const expectedId = current.begin?.transferId ?? "0";
            if (event.transferId !== expectedId) {
                throw new Error("Transfer end does not match its observed begin.");
            }
            if (current.reads > event.transferred || current.writes > event.transferred) {
                throw new Error("Transfer contains more observed accesses than attempted byte slots.");
            }
            if (current.begin) {
                // In this SNES scope, A-bus register suppression and B-bus WRAM conflict
                // suppression cannot both apply to one slot. At least one access survives.
                if (current.reads + current.writes < event.transferred) {
                    throw new Error("Transfer is missing bus accesses inside its observed boundaries.");
                }
                const configuration = current.begin.configuration;
                let expected = configuration.das || 65536;
                if (event.actor === "hdma") {
                    expected = [1, 2, 2, 4, 4, 4, 2, 4][configuration.dmap & 7];
                }
                if ((event.boundary === "complete" && event.transferred !== expected) ||
                    event.transferred > expected) {
                    throw new Error("Transfer completion disagrees with its starting configuration.");
                }
            }
            let status = "leading-partial";
            if (current.begin) {
                status = event.boundary === "complete" ? "complete" : "interrupted";
            }
            retain({ ...current, end: event, status });
            open.delete(key);
        },
        /**
         * Close remaining windows without claiming completion or an attempted slot count.
         * @returns Bounded report with exact lifetime window counts.
         */
        finish: () => {
            for (const current of open.values()) {
                retain({ ...current, status: current.begin ? "trailing-partial" : "both-partial" });
            }
            open.clear();
            return {
                activity: [...activity.entries()]
                    .toSorted(([a], [b]) => a.localeCompare(b))
                    .map(([, value]) => value),
                windows,
                omittedWindows,
            };
        },
    };
};
//# sourceMappingURL=runtime-transfer.js.map