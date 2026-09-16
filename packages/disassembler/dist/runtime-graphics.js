/** Permute the low VRAM word-address bit groups selected by VMAIN's full-graphic mapping.
 * @param {number} address Sixteen-bit VMADD word address.
 * @param {number} mapping Two-bit VMAIN mapping selector.
 * @returns {number} Mapped word address, before the emulator's physical VRAM mask.
 */
const mapVram = (address, mapping) => {
    if (mapping === 0)
        return address;
    const bits = mapping + 4;
    const lowMask = (1 << bits) - 1;
    const blockMask = (1 << (bits + 3)) - 1;
    return (address & ~blockMask) | ((address & lowMask) << 3) | ((address >> bits) & 7);
};
/** Interpret a validated, complete ordered SNES bus stream without assuming power-on PPU state.
 * Reads advance the relevant port pointers/flip-flops but are not reported as writes. OAM
 * tracking requires observed forced blank and a subsequent address reset: rendering can reset
 * its pointer internally, and the two ares PPUs redirect active-display OAM differently.
 * @returns {object} Session-local accumulator; the importer owns validation and publication.
 */
export const createRuntimeGraphicsAccumulator = () => {
    let forcedBlank = null;
    let vmain = null;
    let vramAddress = 0;
    let vramKnown = 0;
    let cgramAddress = null;
    let cgramHigh = null;
    let cgramLatch = {
        value: null,
        sourceSequence: null,
    };
    // Bit zero of OAM's base address is always zero; the remaining bits need both address registers.
    let oamBase = 0;
    let oamKnown = 1;
    let oamAddress = null;
    let oamLatch = {
        value: null,
        sourceSequence: null,
    };
    const activity = new Map();
    const writes = [];
    let omittedWrites = 0;
    /** Advance after the selected low/high port, including reads and rendering-suppressed writes.
     * @param {number} byte Low port zero or high port one.
     * @returns {void} Invalidates partial address knowledge when an unknown carry/increment is possible.
     */
    const advanceVram = (byte) => {
        if (vmain === null)
            vramKnown = 0;
        else if (byte === vmain >> 7) {
            if (vramKnown === 0xffff)
                vramAddress = (vramAddress + [1, 32, 128, 128][vmain & 3]) & 0xffff;
            else
                vramKnown = 0;
        }
    };
    /** CGRAM reads and writes share a flip-flop; only the high phase increments the color index.
     * @returns {void} Preserves unknown phase/address instead of guessing alignment.
     */
    const advanceCgram = () => {
        if (cgramHigh === null)
            cgramAddress = null;
        else {
            if (cgramHigh && cgramAddress !== null)
                cgramAddress = (cgramAddress + 1) & 0xff;
            cgramHigh = !cgramHigh;
        }
    };
    /** Accumulate all writes while retaining only a bounded example list.
     * @param {RuntimeGraphicsWrite} write Fresh interpretation with at most two candidate bytes.
     * @returns {void} Updates fixed actor/channel/target groups.
     */
    const record = (write) => {
        const key = `${write.actor}:${write.channel}:${write.target}`;
        let group = activity.get(key);
        if (!group) {
            group = {
                actor: write.actor,
                channel: write.channel,
                target: write.target,
                portWrites: 0,
                addressed: 0,
                latched: 0,
                unknown: 0,
                byteTargets: 0,
                knownValueTargets: 0,
            };
            activity.set(key, group);
        }
        group.portWrites++;
        group[write.status]++;
        group.byteTargets += write.bytes.length;
        group.knownValueTargets += write.bytes.filter((byte) => byte.value !== null).length;
        // Each validated stream count fits a safe integer, but a paired write emits two candidates.
        if (!Number.isSafeInteger(group.byteTargets))
            throw new Error("Graphics byte count exceeds the safe range.");
        if (writes.length < 64)
            writes.push(write);
        else
            omittedWrites++;
    };
    /** Consume actual bus operations, recognizing PPU mirrors only in banks 00–3f and 80–bf.
     * @param {RuntimeBusAccess} access Validated access in global capture order.
     * @returns {void} Mutates bounded PPU state and reports only writes to graphics data ports.
     */
    const push = (access) => {
        if ((access.address & 0x400000) !== 0)
            return;
        const port = access.address & 0xffff;
        if (port < 0x2100 || port > 0x213f)
            return;
        const { value } = access;
        if (access.direction === "read") {
            if (port === 0x2139 || port === 0x213a)
                advanceVram(port - 0x2139);
            else if (port === 0x213b)
                advanceCgram();
            else if (port === 0x2138 && oamAddress !== null)
                oamAddress = (oamAddress + 1) & 0x3ff;
            return;
        }
        switch (port) {
            case 0x2100:
                // INIDISP can reset OAM on the first vblank line, even when bit 7 stays set.
                // Bus timestamps alone do not pin the accurate PPU's synchronization phase.
                forcedBlank = (value & 0x80) !== 0;
                oamAddress = null;
                return;
            case 0x2102:
            case 0x2103:
                if (port === 0x2102) {
                    oamBase = (oamBase & 0x200) | (value << 1);
                    oamKnown |= 0x1fe;
                }
                else {
                    oamBase = (oamBase & 0x1ff) | ((value & 1) << 9);
                    oamKnown |= 0x200;
                }
                oamAddress = forcedBlank === true && oamKnown === 0x3ff ? oamBase : null;
                return;
            case 0x2115:
                vmain = value;
                return;
            case 0x2116:
                vramAddress = (vramAddress & 0xff00) | value;
                vramKnown |= 0xff;
                return;
            case 0x2117:
                vramAddress = (vramAddress & 0xff) | (value << 8);
                vramKnown |= 0xff00;
                return;
            case 0x2121:
                cgramAddress = value;
                cgramHigh = false;
                return;
        }
        if (port !== 0x2118 && port !== 0x2119 && port !== 0x2122 && port !== 0x2104)
            return;
        const data = { value, sourceSequence: access.sequence };
        const base = {
            sequence: access.sequence,
            actor: access.actor,
            channel: access.channel,
            port,
            value,
            forcedBlank,
        };
        if (port === 0x2118 || port === 0x2119) {
            const byte = port - 0x2118;
            if (vmain !== null && vramKnown === 0xffff) {
                const address = mapVram(vramAddress, (vmain >> 2) & 3) * 2 + byte;
                record({ ...base, target: "vram", status: "addressed", bytes: [{ address, ...data }] });
            }
            else
                record({
                    ...base,
                    target: "vram",
                    status: "unknown",
                    reason: "missing-vram-registers",
                    bytes: [],
                });
            advanceVram(byte);
        }
        else if (port === 0x2122) {
            if (cgramHigh === false) {
                cgramLatch = data;
                record({ ...base, target: "cgram", status: "latched", bytes: [] });
            }
            else if (cgramHigh === true && cgramAddress !== null) {
                record({
                    ...base,
                    target: "cgram",
                    status: "addressed",
                    bytes: [
                        { address: cgramAddress * 2, ...cgramLatch },
                        { address: cgramAddress * 2 + 1, ...data, value: value & 0x7f },
                    ],
                });
            }
            else {
                // An unknown phase might have replaced the low-byte latch with this write.
                cgramLatch = { value: null, sourceSequence: null };
                record({
                    ...base,
                    target: "cgram",
                    status: "unknown",
                    reason: "missing-cgram-state",
                    bytes: [],
                });
            }
            advanceCgram();
        }
        else if (oamAddress === null) {
            // Rendering/unknown alignment may have replaced the write latch. Address-register
            // writes do not reset that latch, so invalidate its data independently of the pointer.
            oamLatch = { value: null, sourceSequence: null };
            record({ ...base, target: "oam", status: "unknown", reason: "missing-oam-state", bytes: [] });
        }
        else {
            const address = oamAddress;
            oamAddress = (address + 1) & 0x3ff;
            if ((address & 1) === 0)
                oamLatch = data;
            if (address & 0x200) {
                // The high table writes immediately and mirrors every 32 bytes. Even high-table
                // writes also replace the latch later consumed by an odd low-table write.
                record({
                    ...base,
                    target: "oam",
                    status: "addressed",
                    bytes: [{ address: 0x200 | (address & 0x1f), ...data }],
                });
            }
            else if (address & 1) {
                record({
                    ...base,
                    target: "oam",
                    status: "addressed",
                    bytes: [
                        { address: address - 1, ...oamLatch },
                        { address, ...data },
                    ],
                });
            }
            else
                record({ ...base, target: "oam", status: "latched", bytes: [] });
        }
    };
    return {
        push,
        finish: () => ({
            model: "snes-ppu-ports-v1",
            activity: [...activity.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([, group]) => group),
            writes,
            omittedWrites,
        }),
    };
};
//# sourceMappingURL=runtime-graphics.js.map