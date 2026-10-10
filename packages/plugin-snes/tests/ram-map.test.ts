import { test } from "../../../tests/ava-helper.js";
import {
  canonicalSnesWramAddress,
  emptySnesRamMap,
  renderSnesRamDefines,
  renderSnesRamMapSchema,
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
      .filter((line) => /^RAM_[\dA-Z_]+ = \$/.test(line))
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

test("RAM definition source citations are opt-in without discarding descriptive notes", (t) => {
  const variables = validateSnesRamMap(
    map([
      {
        name: "RAM_SNOW_AMOUNT",
        address: "$7ECFF7",
        category: "Party",
        description: "Snow amount",
        notes: [
          "Secret of Mana information.txt:L401.",
          "information.txt:L415-L425; RoomCharacter in disassembly/struct-map.json.",
        ],
      },
      {
        name: "RAM_SNOW_MODE",
        address: "$7ECFF8",
        description: "Snow mode.",
        size: 2,
        notes: [
          "Values are still under investigation.",
          "See manual.txt:L12 for the provisional values.",
          "research/weather.md",
          "weather.asm:L20-L30.",
        ],
        sources: ["  Weather capture\nframe 42.  "],
      },
    ]),
  );
  const source = renderSnesRamDefines(variables);
  t.false(source.includes("struct-map.json"));
  t.false(source.includes("ram-map.json"));
  t.regex(source, /^RAM_SNOW_AMOUNT = \$7ECFF7 ; Party — Snow amount\.$/m);
  t.regex(
    source,
    /^RAM_SNOW_MODE = \$7ECFF8 ; Snow mode\. Size: 2 bytes\. Values are still under investigation\. See manual\.txt:L12 for the provisional values\.$/m,
  );
  t.is(renderSnesRamDefines(variables, { includeSourceInformation: false }), source);
  const withSources = renderSnesRamDefines(variables, { includeSourceInformation: true });
  t.regex(
    withSources,
    /^RAM_SNOW_AMOUNT = \$7ECFF7 ; Party — Snow amount Secret of Mana information\.txt:L401\. information\.txt:L415-L425; RoomCharacter in disassembly\/struct-map\.json\.$/m,
  );
  t.true(
    withSources.includes("research/weather.md weather.asm:L20-L30. Weather capture frame 42."),
  );
  // Presentation must never delete citations from the validated metadata.
  t.deepEqual(variables[0].notes, [
    "Secret of Mana information.txt:L401.",
    "information.txt:L415-L425; RoomCharacter in disassembly/struct-map.json.",
  ]);
  t.deepEqual(variables[1].sources, ["Weather capture frame 42."]);
});

test("RAM-map comment configuration and explicit sources are validated and documented", (t) => {
  const file = emptySnesRamMap();
  t.false(file.includeSourceInformation);
  const schema = JSON.parse(renderSnesRamMapSchema());
  t.is(schema.properties.includeSourceInformation.type, "boolean");
  t.false(schema.properties.includeSourceInformation.default);
  t.is(schema.properties.variables.items.properties.sources.type, "array");
  for (const includeSourceInformation of ["false", 1, null, []]) {
    t.throws(() => validateSnesRamMap({ ...file, includeSourceInformation }), {
      message: /includeSourceInformation must be a boolean/,
    });
  }
  for (const sources of ["manual.txt", [42], ["  "], null]) {
    t.throws(() =>
      validateSnesRamMap(
        map([{ name: "RAM_SNOW_AMOUNT", address: "$7ECFF7", description: "Snow amount", sources }]),
      ),
    );
  }
});

test("CPU WRAM mirrors resolve to their canonical bank-7E addresses", (t) => {
  t.is(canonicalSnesWramAddress(0x001847), 0x7e1847);
  t.is(canonicalSnesWramAddress(0x801847), 0x7e1847);
  t.is(canonicalSnesWramAddress(0x7e1847), 0x7e1847);
  t.is(canonicalSnesWramAddress(0x402000), undefined);
});

test("SRAM map entries require an explicit memory kind and stay inside a cartridge window", (t) => {
  const entry = {
    name: "SRAM_LAST_SELECTED_FILE",
    address: "$307FFF",
    memory: "sram",
    description: "Persistent zero-based file index, outside save-record checksums.",
  };
  const variables = validateSnesRamMap(map([entry]));
  t.is(variables[0].memory, "sram");
  t.regex(renderSnesRamDefines(variables), /^SRAM_LAST_SELECTED_FILE = \$307FFF ; Persistent/m);
  t.throws(() => validateSnesRamMap(map([{ ...entry, memory: undefined }])), {
    message: /outside canonical SNES WRAM/,
  });
  t.throws(() => validateSnesRamMap(map([{ ...entry, memory: "rom" }])), {
    message: /must be 'wram' or 'sram'/,
  });
  t.throws(() => validateSnesRamMap(map([{ ...entry, size: 2 }])), {
    message: /Invalid size/,
  });
  for (const address of ["$C00000", "$7E1000", "$3060000", "$305FFF", "$308000"]) {
    t.throws(() => validateSnesRamMap(map([{ ...entry, address }])));
  }
  for (const address of [0x306000, 0xb07fff, 0x700000, 0xf07fff]) {
    t.is(validateSnesRamMap(map([{ ...entry, address }]))[0].address, address);
  }
});
