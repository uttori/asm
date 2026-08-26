import { test } from "./ava-helper.js";

import {
  formatAddressForWidth,
  maximumAddressForWidth,
  normalizeAddressForWidth,
} from "../packages/core/src/address-width.js";
import { formatTraceEvent } from "../packages/core/src/debug-tracing.js";

test("address-width helpers normalize and format target-sized addresses", (t) => {
  t.is(maximumAddressForWidth(16), 0xffff);
  t.is(maximumAddressForWidth(20), 0xfffff);
  t.is(normalizeAddressForWidth(0x12345, 16), 0x2345);
  t.is(normalizeAddressForWidth(-1, 20), 0xfffff);
  t.is(formatAddressForWidth(0x123, 16), "0123");
  t.is(formatAddressForWidth(0x12345, 20), "12345");
  t.is(formatAddressForWidth(0x808000, 24), "808000");
});

test("address-width helpers reject invalid widths and non-integer addresses", (t) => {
  t.throws(() => maximumAddressForWidth(0), { message: /Address width/ });
  t.throws(() => maximumAddressForWidth(54), { message: /Address width/ });
  t.throws(() => normalizeAddressForWidth(1.5, 16), { message: /finite integer/ });
});

test("trace formatting uses event target width", (t) => {
  const formatted = formatTraceEvent({
    type: "command-start",
    stage: "emitProgram",
    arch: "65xx.6502",
    file: "main.asm",
    line: 1,
    raw: "nop",
    normalized: "nop",
    logicalAddress: 0x123,
    addressWidth: 16,
    outputOffset: 0x123,
  });

  t.regex(formatted, /addr=\$0123/);
  t.notRegex(formatted, /addr=\$000123/);
});
