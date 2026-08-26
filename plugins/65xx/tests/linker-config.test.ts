import { test } from "../../../tests/ava-helper.js";

import { parseLd65Config } from "../src/linker-config.js";

const zeldaConfig = `MEMORY
{
    ROM_00: start = $8000, size = $4000, file = %O, fill = yes, fillval = $FF ;
    ROM_01: start = $8000, size = $4000, file = %O, fill = yes, fillval = $FF ;
    RAM_01_CODE: start = $6C90, size = $1270, file = "", fill = yes, fillval = $FF ;
    ROM_07: start = $C000, size = $4000, file = %O, fill = yes, fillval = $FF ;
}

SEGMENTS
{
    BANK_00_00: load = ROM_00, type = ro, start = $8D60 ;
    BANK_01_00: load = ROM_01, type = ro ;
    BANK_01_CODE: load = ROM_01, type = ro, run = RAM_01_CODE, define = yes ;
    BANK_07_00: load = ROM_07, type = ro ;
}

SYMBOLS
{
    __BANK_01_CODE_RUN_END__: type = export, value = __BANK_01_CODE_RUN__+__BANK_01_CODE_SIZE__;
}
`;

test("parseLd65Config maps sequential %O file offsets and RAM overlays", (t) => {
  const config = parseLd65Config(zeldaConfig);
  t.is(config.imageSize, 0xc000);
  t.is(config.memories.get("ROM_00")?.fileOffset, 0);
  t.is(config.memories.get("ROM_01")?.fileOffset, 0x4000);
  t.is(config.memories.get("RAM_01_CODE")?.fileOffset, -1);
  t.is(config.memories.get("RAM_01_CODE")?.start, 0x6c90);
  t.is(config.memories.get("ROM_07")?.fileOffset, 0x8000);
  t.is(config.memories.get("ROM_07")?.start, 0xc000);

  const overlay = config.segments.get("BANK_01_CODE");
  t.truthy(overlay);
  t.is(overlay?.load, "ROM_01");
  t.is(overlay?.run, "RAM_01_CODE");
  t.true(overlay?.define);
  t.is(overlay?.start, undefined);

  t.is(config.segments.get("BANK_00_00")?.start, 0x8d60);
  t.is(config.symbols[0]?.name, "__BANK_01_CODE_RUN_END__");
});
