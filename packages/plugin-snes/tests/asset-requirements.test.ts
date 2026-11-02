import { test } from "../../../tests/ava-helper.js";
import {
  parseSnesAssetRequirements,
  verifySnesAssetRequirements,
} from "../src/disassembler/asset-requirements.js";
import { validateSnesStructMap } from "../src/disassembler/struct-map.js";

/** Synthetic ownership covers physical bytes independently of any game or private ROM. */
const catalog = {
  ...validateSnesStructMap({
    format: "uttori-asm-snes-struct-map",
    schemaVersion: 1,
    structures: [
      { id: "Color", size: 2, fields: [{ name: "word", offset: 0, size: 2, type: "dw" }] },
    ],
    bindings: [
      { name: "Palette", structure: "Color", address: 0xc00020, fileOffset: 0x20, count: 4 },
      { name: "RamColors", structure: "Color", address: 0x7e1000, count: 4 },
    ],
  }),
  sourceBytes: new Uint8Array(),
};
const requirements = parseSnesAssetRequirements([
  { structure: "Color", format: "palette.codec", options: { section: "colors" } },
]);
const directive = 'includeAsset("../palette.json", "palette.codec", section: "colors")';

test("required codecs accept adjacent slices and larger shared owners", (t) => {
  t.notThrows(() =>
    verifySnesAssetRequirements(
      requirements,
      [
        { start: 0x1e, end: 0x24, directive },
        { start: 0x24, end: 0x2a, directive },
      ],
      catalog,
    ),
  );
  t.notThrows(() =>
    verifySnesAssetRequirements(requirements, [{ start: 0x20, end: 0x28, directive }], catalog),
  );
});

test("one missing byte or a wrong codec/section blocks generation", (t) => {
  for (const entries of [
    [],
    [{ start: 0x20, end: 0x27, directive }],
    [
      { start: 0x20, end: 0x23, directive },
      { start: 0x24, end: 0x28, directive },
    ],
    [{ start: 0x20, end: 0x28, directive: directive.replace('"palette.codec"', '"raw"') }],
    [{ start: 0x20, end: 0x28, directive: directive.replace('"colors"', '"triggers"') }],
    [
      {
        start: 0x20,
        end: 0x28,
        directive: 'includeAsset("palette.codec", "raw", section: "colors")',
      },
    ],
  ]) {
    t.throws(() => verifySnesAssetRequirements(requirements, entries, catalog), {
      message: /Palette.*ROM \$/,
    });
  }
});

test("optional policy remains backward compatible, while malformed contracts fail closed", (t) => {
  t.deepEqual(parseSnesAssetRequirements(undefined), []);
  t.notThrows(() => verifySnesAssetRequirements([], [], undefined));
  t.throws(() => verifySnesAssetRequirements(requirements, [], undefined), {
    message: /struct-map/,
  });
  for (const value of [
    {},
    [null],
    [{ structure: "Color" }],
    [{ structure: "Color", format: "codec", options: { section: 1 } }],
    [
      { structure: "Color", format: "codec" },
      { structure: "Color", format: "other" },
    ],
  ])
    {t.throws(() => parseSnesAssetRequirements(value));}
});
