import { test } from "../../../tests/ava-helper.js";

import {
  canonicalSnesWramAddress,
  renderSnesRamDefines,
  validateSnesRamMap,
} from "../src/disassembler/ram-map.js";

const map = (variables: readonly unknown[]): unknown => ({
  format: "uttori-asm-snes-ram-map",
  schemaVersion: 1,
  variables,
});

test("SNES RAM maps normalize, sort, and render documented definitions", (t) => {
  const variables = validateSnesRamMap(
    map([
      {
        name: "RAM_RING_MENU_MODE",
        address: "$7E1847",
        category: "Menu",
        description: "Selects the active ring-menu mode.",
        notes: ["Values are still under investigation."],
      },
      {
        name: "RAM_EXIT_DESTINATION",
        address: "0x7E00DC",
        size: 2,
        category: "Map transition",
        description: "Destination map identifier for the pending exit.",
      },
    ]),
  );
  t.deepEqual(
    variables.map(({ name, address, size }) => ({ name, address, size })),
    [
      { name: "RAM_EXIT_DESTINATION", address: 0x7e00dc, size: 2 },
      { name: "RAM_RING_MENU_MODE", address: 0x7e1847, size: 1 },
    ],
  );
  const source = renderSnesRamDefines(variables);
  t.regex(
    source,
    /^RAM_EXIT_DESTINATION = \$7E00DC ; Map transition — Destination map identifier for the pending exit\. Size: 2 bytes\.$/m,
  );
  t.regex(
    source,
    /^RAM_RING_MENU_MODE = \$7E1847 ; Menu — Selects the active ring-menu mode\. Values are still under investigation\.$/m,
  );
  t.true(
    source
      .split("\n")
      .filter((line) => /^RAM_[A-Z0-9_]+ = \$/.test(line))
      .every((line) => / ; \S/.test(line)),
  );
});

test("SNES RAM maps reject ambiguous and unsafe records", (t) => {
  t.throws(
    () =>
      validateSnesRamMap(
        map([
          { name: "RAM_ONE", address: "$7E1000", description: "First alias." },
          { name: "RAM_TWO", address: "$7E1000", description: "Second alias." },
        ]),
      ),
    { message: /Duplicate RAM-map address/ },
  );
  t.throws(
    () =>
      validateSnesRamMap(
        map([{ name: "bad name", address: "$7E1000", description: "Invalid name." }]),
      ),
    { message: /assembler identifier/ },
  );
  t.throws(
    () =>
      validateSnesRamMap(map([{ name: "RAM_ROM", address: "$C00000", description: "Not WRAM." }])),
    { message: /outside canonical SNES WRAM/ },
  );
  t.throws(
    () =>
      validateSnesRamMap(
        map([
          { name: "RAM_RANGE", address: "$7E1000", size: 2, description: "A range." },
          { name: "RAM_INSIDE", address: "$7E1001", description: "Overlaps the range." },
        ]),
      ),
    { message: /overlap/ },
  );
});

test("CPU WRAM mirrors resolve to their canonical bank-7E addresses", (t) => {
  t.is(canonicalSnesWramAddress(0x001847), 0x7e1847);
  t.is(canonicalSnesWramAddress(0x801847), 0x7e1847);
  t.is(canonicalSnesWramAddress(0x7e1847), 0x7e1847);
  t.is(canonicalSnesWramAddress(0x402000), undefined);
});
