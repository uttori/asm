import test from "ava";

import { parseAresTraceDetails } from "../src/trace-details.js";

const state = [1, 2, 3, 0x1ff, 0, 0, 0x7e, 0x2000, 0x30, 0]
  .map((n) => n.toString(16).padStart(4, "0"))
  .join("");
const row = `00000000007e2000,${state},8d1821,2,0000000000002118ab117;`;
test("rich RSP parser preserves bytes, CPU state, DMA channel, and both kinds of memory loss", (t) => {
  const batch = parseAresTraceDetails(`1:5:4:3:${row}`, 16);
  t.deepEqual(batch.addresses, [0x7e2000]);
  t.deepEqual(batch.details?.[0]?.bytes, [0x8d, 0x18, 0x21]);
  t.is(batch.details?.[0]?.state.pb, 0x7e);
  t.deepEqual(batch.details?.[0]?.memoryAccesses, [
    {
      addressSpace: "snes.cpu",
      address: 0x2118,
      value: 0xab,
      access: "write",
      width: 1,
      actor: "dma",
      channel: 7,
    },
  ]);
  t.is(batch.details?.[0]?.droppedMemoryAccesses, 2);
  t.is(batch.unattributedMemoryAccesses, 3);
  t.deepEqual(parseAresTraceDetails("0:1:0:0:", 1).details, []);
});
test("rich RSP parser rejects malformed, oversized, and inconsistent observations", (t) => {
  for (const packet of [
    `1:0:0:0:${row}`,
    `1:1:0:0:${row.replace("7e2000", "7f2000")}`,
    `1:1:0:0:${row.slice(0, -1)}`,
    `1:1:0:0:${row.replace("ab117", "ab118")}`,
    `1:1:0:0:${row.replace("8d1821", "0011223344")}`,
    `1:1:0:0:${row.repeat(241)}`,
    `1:ffffffffffffffff:0:0:${row}`,
  ])
    t.throws(() => parseAresTraceDetails(packet, 16));
  t.throws(() => parseAresTraceDetails(`1:1:0:0:${row.repeat(2)}`, 1));
});
