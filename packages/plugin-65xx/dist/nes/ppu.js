import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { decodeNesPPUState, validateNesMapper, readCaptureFileHeader, recoverCaptureFile, } from "@uttori/asm-debug-adapter";
import { DEFAULT_RUNTIME_TRACE_MAX_BYTES, verifyRuntimeCaptureCompanion, } from "@uttori/asm-disassembler";
/** NPP1 is a halted graphics view, not a save state or a rendered frame. */
export const NES_PPU_SNAPSHOT_BYTES = 13056;
/** Validate and copy an NPP1 buffer so later caller mutations cannot alter the view. */
export function decodeNesPPUSnapshot(bytes) {
    const b = Buffer.from(bytes);
    if (b.length !== NES_PPU_SNAPSHOT_BYTES ||
        b.toString("ascii", 0, 4) !== "NPP1" ||
        b.readUInt16LE(4) !== 1 ||
        b.readUInt16LE(6) !== 256 ||
        b.readUInt32LE(8) !== b.length ||
        b.readUInt32LE(12) ||
        b.readUInt16LE(26) > 340 ||
        ![262, 312].includes(b.readUInt16LE(30)) ||
        b.readUInt16LE(28) >= b.readUInt16LE(30) ||
        b[45] > 1 ||
        ![12, 15, 16].includes(b[46]) ||
        ![4, 5].includes(b[47]) ||
        b.subarray(48, 64).some(Boolean) ||
        b.readUInt16LE(82) ||
        b.subarray(88, 96).some(Boolean) ||
        b.subarray(112, 128).some(Boolean) ||
        b.subarray(224, 256).some(Boolean)) {
        throw new Error("Invalid NES PPU snapshot header.");
    }
    const mapper = [...b.subarray(64, 82)];
    validateNesMapper(mapper);
    const mappings = [];
    for (let slot = 0; slot < 12; slot++) {
        const at = 128 + slot * 8, kind = b[at], writable = b[at + 1], offset = b.readUInt32LE(at + 4);
        if (kind < 1 ||
            kind > 3 ||
            writable > 1 ||
            b.readUInt16LE(at + 2) ||
            offset % 1024 ||
            (kind === 1 && writable !== 0) ||
            (kind !== 1 && writable !== 1) ||
            (kind === 3 && offset >= 2048) ||
            (slot < 8 && kind === 3) ||
            (slot >= 8 && kind !== 3)) {
            throw new Error("Invalid NES PPU window mapping.");
        }
        mappings.push({
            space: ["chr-rom", "chr-ram", "ciram"][kind - 1],
            offset,
            writable: !!writable,
        });
    }
    if (b.subarray(12544, 12576).some((value) => value > 63) ||
        !b.readBigUInt64LE(96) ||
        !b.readBigUInt64LE(104)) {
        throw new Error("Invalid NES palette or clock.");
    }
    const physical = b.readUInt32LE(84);
    return {
        cycle: String(b.readBigUInt64LE(16)),
        pc: b.readUInt16LE(24),
        pcPrgOffset: physical === 0xffffffff ? null : physical,
        dot: b.readUInt16LE(26),
        scanline: b.readUInt16LE(28),
        scanlines: b.readUInt16LE(30),
        clock: {
            numerator: String(b.readBigUInt64LE(96)),
            denominator: String(b.readBigUInt64LE(104)),
        },
        state: decodeNesPPUState(b, 32),
        control: b[42],
        mask: b[43],
        status: b[44],
        mapper,
        mappings,
        patterns: b.subarray(256, 8448),
        nametables: b.subarray(8448, 12544),
        palette: b.subarray(12544, 12576),
        oam: b.subarray(12576, 12832),
        secondaryOam: b.subarray(12832, 12864),
        colors: b.subarray(12864),
    };
}
/** Decode a pixel from planar NES tiles; callers supply a mapped 8 KiB pattern view. */
function tilePixel(patterns, tile, x, y) {
    const at = tile * 16 + y;
    return ((patterns[at] >> (7 - x)) & 1) | (((patterns[at + 8] >> (7 - x)) & 1) << 1);
}
/** Indexed graphics views preserve hardware palette codes; no display/scheduler work is performed. */
export function renderNesPPUViews(snapshot) {
    const patterns = new Uint8Array(256 * 128), nametables = new Uint8Array(512 * 480), sprites = new Uint8Array(128 * 128);
    const palette = (index) => {
        if ((index & 3) === 0) {
            index = 0;
        }
        const value = snapshot.palette[index];
        return snapshot.mask & 1 ? value & 0x30 : value;
    };
    for (let tile = 0; tile < 512; tile++) {
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                patterns[(Math.floor(tile / 32) * 8 + y) * 256 + (tile % 32) * 8 + x] = palette(tilePixel(snapshot.patterns, tile, x, y));
            }
        }
    }
    for (let table = 0; table < 4; table++) {
        for (let ty = 0; ty < 30; ty++) {
            for (let tx = 0; tx < 32; tx++) {
                const tile = snapshot.nametables[table * 1024 + ty * 32 + tx] + (snapshot.control & 16 ? 256 : 0);
                const attributes = snapshot.nametables[table * 1024 + 960 + (ty >> 2) * 8 + (tx >> 2)];
                const bank = (attributes >> (((ty & 2) << 1) | (tx & 2))) & 3;
                for (let y = 0; y < 8; y++) {
                    for (let x = 0; x < 8; x++) {
                        const px = (table % 2) * 256 + tx * 8 + x, py = Math.floor(table / 2) * 240 + ty * 8 + y;
                        const pixel = tilePixel(snapshot.patterns, tile, x, y);
                        nametables[py * 512 + px] = palette(pixel ? bank * 4 + pixel : 0);
                    }
                }
            }
        }
    }
    sprites.fill(palette(0));
    const height = snapshot.control & 32 ? 16 : 8;
    for (let sprite = 0; sprite < 64; sprite++) {
        const tile = snapshot.oam[sprite * 4 + 1], attributes = snapshot.oam[sprite * 4 + 2];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < 8; x++) {
                const sy = attributes & 128 ? height - 1 - y : y, sx = attributes & 64 ? 7 - x : x;
                let selected = tile + (snapshot.control & 8 ? 256 : 0);
                if (height === 16) {
                    selected = (tile & 1) * 256 + (tile & 254) + (sy >> 3);
                }
                const pixel = tilePixel(snapshot.patterns, selected, sx, sy & 7);
                const px = (sprite % 8) * 16 + x, py = Math.floor(sprite / 8) * 16 + y;
                sprites[py * 128 + px] = palette(pixel ? 16 + (attributes & 3) * 4 + pixel : 0);
            }
        }
    }
    return { patterns, nametables, sprites };
}
/** Reject wrong cartridges, incomplete files and excessive distinct destinations before publishing a report. */
export async function summarizeNesPPUCapture(file, options) {
    const limits = { ...options, maxBytes: options.maxBytes ?? DEFAULT_RUNTIME_TRACE_MAX_BYTES };
    const header = await readCaptureFileHeader(file, limits);
    if (header.scope !== "nes.cpu-bus-ppu" ||
        header.romFileSha256 !== options.romFileSha256 ||
        header.romContentSha256 !== options.romContentSha256) {
        throw new Error("NES PPU capture scope or cartridge identity mismatch.");
    }
    const hash = async () => {
        const h = createHash("sha256");
        for await (const bytes of createReadStream(file, { signal: options.signal })) {
            if (!Buffer.isBuffer(bytes)) {
                throw new Error("Expected binary PPU capture data.");
            }
            h.update(bytes);
        }
        return h.digest("hex");
    };
    const archiveSha256 = await hash();
    let events = 0, blockedWrites = 0;
    const timeline = {
        fetches: 0,
        a12Edges: 0,
        mapperWrites: 0,
        irqEdges: 0,
        irqPins: [],
    };
    const actors = { cpu: 0, "oam-dma": 0, "dmc-dma": 0, "dma-dummy": 0 };
    const registerAccesses = {};
    const writes = new Map();
    const result = await recoverCaptureFile(file, (chunk) => {
        if (chunk.scope !== "nes.cpu-bus-ppu") {
            throw new Error("NES PPU capture scope changed.");
        }
        for (const event of chunk.events) {
            events++;
            if ("timeline" in event) {
                if (event.timeline === "fetch") {
                    timeline.fetches++;
                }
                if (event.timeline === "a12") {
                    timeline.a12Edges++;
                }
                if (event.timeline === "mapper-write") {
                    timeline.mapperWrites++;
                }
                if (event.timeline === "irq-pin") {
                    timeline.irqEdges++;
                    if (timeline.irqPins.length === 1024) {
                        timeline.irqPins.shift();
                    }
                    timeline.irqPins.push({
                        sequence: event.sequence,
                        deviceCycle: event.deviceCycle,
                        asserted: event.cpuIrq,
                        dot: event.dot,
                        scanline: event.scanline,
                    });
                }
                continue;
            }
            options.onBusEvent?.(event);
            actors[event.actor]++;
            if (event.address >= 0x2000 && event.address < 0x4000) {
                const key = `${event.direction}:$${(0x2000 + (event.address & 7)).toString(16)}`;
                registerAccesses[key] = (registerAccesses[key] ?? 0) + 1;
            }
            if (event.effect?.outcome === "blocked") {
                blockedWrites++;
            }
            for (const byte of event.effect?.bytes ?? []) {
                const target = event.effect.target, key = `${target}:${byte.offset}`;
                const previous = writes.get(key);
                if (!previous && writes.size >= 262144) {
                    throw new Error("NES PPU destination budget exceeded.");
                }
                writes.set(key, {
                    target,
                    ...byte,
                    count: (previous?.count ?? 0) + 1,
                    pc: event.pc,
                    pcPrgOffset: event.pcPrgOffset,
                    sequence: event.sequence,
                    cycle: event.cycle,
                });
            }
        }
    }, limits);
    if (!result.complete ||
        JSON.stringify(result.header) !== JSON.stringify(header) ||
        (await hash()) !== archiveSha256) {
        throw new Error("NES PPU capture is incomplete or changed during analysis.");
    }
    await verifyRuntimeCaptureCompanion(file, result, options.signal);
    return {
        header,
        archiveSha256,
        events,
        actors,
        registerAccesses,
        writes: [...writes.values()].toSorted((a, b) => a.target.localeCompare(b.target) || a.offset - b.offset),
        blockedWrites,
        timeline,
    };
}
/** Self-contained offline view. Snapshot panels are storage visualizations, not a reconstructed frame. */
export function nesPPUHtml(snapshot, identity = {}) {
    const views = renderNesPPUViews(snapshot);
    const data = JSON.stringify({
        identity,
        cycle: snapshot.cycle,
        pc: snapshot.pc,
        pcPrgOffset: snapshot.pcPrgOffset,
        dot: snapshot.dot,
        scanline: snapshot.scanline,
        state: snapshot.state,
        mappings: snapshot.mappings,
        colors: [...snapshot.colors],
        palette: [...snapshot.palette],
        oam: [...snapshot.oam],
        views: Object.fromEntries(Object.entries(views).map(([key, bytes]) => [key, Buffer.from(bytes).toString("base64")])),
    }).replaceAll("<", "\\u003c");
    return `<!doctype html><html><meta charset="utf-8"><title>NES PPU evidence</title><style>body{font:16px system-ui;background:#10141d;color:#eef2fa;margin:32px}canvas{image-rendering:pixelated;max-width:100%;border:1px solid #526079}section{margin:24px 0}pre{white-space:pre-wrap;font:13px monospace}h1{font-size:28px}</style><h1>NES PPU evidence</h1><p>Halted storage view. Pattern tables, four nametables and OAM tiles use the captured mapper and palette. These panels do not reproduce mid-frame scrolling, sprite evaluation or the final composited screen.</p><section><h2>Mapped pattern tables</h2><canvas id="patterns" width="256" height="128" style="width:768px"></canvas></section><section><h2>Nametables</h2><canvas id="nametables" width="512" height="480" style="width:768px"></canvas></section><section><h2>OAM tiles (64 sprites)</h2><canvas id="sprites" width="128" height="128" style="width:512px"></canvas></section><h2>Coordinates and provenance</h2><pre id="details"></pre><script>const data=${data};for(const [key,encoded] of Object.entries(data.views)){const c=document.getElementById(key),ctx=c.getContext('2d'),pixels=atob(encoded),out=ctx.createImageData(c.width,c.height);for(let i=0;i<pixels.length;i++){const code=pixels.charCodeAt(i);out.data.set(data.colors.slice(code*3,code*3+3),i*4);out.data[i*4+3]=255}ctx.putImageData(out,0,0)}const {views,colors,...details}=data;document.getElementById('details').textContent=JSON.stringify(details,null,2);</script></html>`;
}
//# sourceMappingURL=ppu.js.map