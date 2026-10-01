import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import { createSnesAssemblerEnvironment } from "../src/assembler.js";
import { buildSnesSource } from "../src/disassembler/source-build.js";

test("stable raw slices preserve consumed edits and reject bytes orphaned by new source", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-raw-consumption-"));
  const environment = await createSnesAssemblerEnvironment();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "raw"));
  const raw = path.join(root, "raw/000000.bin");
  const original = Uint8Array.from([1, 2, 3, 4]);
  fs.writeFileSync(raw, original);
  fs.writeFileSync(
    path.join(root, "main.asm"),
    'hirom\norg $C00000\nincbin "raw/000000.bin":$00..$02\ndb $03, $04\n',
  );
  const options = {
    root,
    entrySource: "main.asm",
    environment,
    targetOptions: { checksumEnabled: false },
    expectedSize: 4,
    rawBlocks: { directory: "raw", original, blockSize: 4 },
    outputDirectory: path.join(root, "build"),
    toolchainSha256: "a".repeat(64),
    configurationSha256: "b".repeat(64),
  };
  const baseline = buildSnesSource(options);
  t.deepEqual([...fs.readFileSync(baseline.outputFile)], [1, 2, 3, 4]);
  const debug = JSON.parse(fs.readFileSync(baseline.debugMapFile, "utf8"));
  t.is(debug.assets[0].inputStart, 0);
  t.is(debug.assets[0].inputEnd, 2);
  fs.writeFileSync(raw, Uint8Array.from([1, 9, 3, 4]));
  const changed = buildSnesSource(options);
  t.deepEqual([...fs.readFileSync(changed.outputFile)], [1, 9, 3, 4]);
  t.true(changed.verification.checks.includes("edited-raw-byte-consumption"));
  fs.writeFileSync(raw, Uint8Array.from([1, 9, 8, 4]));
  t.throws(() => buildSnesSource(options), {
    message: /1 edited raw byte.*\+\$2.*no longer consumed/,
  });
  t.deepEqual([...fs.readFileSync(changed.outputFile)], [1, 9, 3, 4]);
});
