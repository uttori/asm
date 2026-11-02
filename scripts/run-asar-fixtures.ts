import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import { Assembler } from "@uttori/asm-core";
import { createSnesAssemblerEnvironment, SNES_TARGET_ID } from "@uttori/asm-plugin-snes";

/** Full emitted-output comparison. Missing golden files represent fixtures with no emitted bytes. */
interface FixtureResult {
  readonly fixture: string;
  readonly bytes: number;
  readonly expectedBytes: number;
  readonly sha256: string;
  readonly expectedSha256: string;
  readonly passed: boolean;
  readonly error?: string;
}

const root = path.join(process.cwd(), "fixtures/asar");
const tests = path.join(root, "tests");
const environment = await createSnesAssemblerEnvironment();
const baseImage = new Uint8Array(fs.readFileSync(path.join(root, "dummy_rom.sfc")));
const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/**
 * Compare the assembler's emitted bytes with one complete golden output.
 * The dummy ROM supplies read directives only. CLI --base-image deliberately preserves an entire
 * patched ROM, which has a different length and checksum contract from these emitted-byte fixtures.
 * @param fixture Discovered top-level .asm filename.
 * @returns Byte length, hash, and any assembly error. No output files are written.
 */
function compare(fixture: string): FixtureResult {
  const sourceFile = path.join(tests, fixture);
  const expectedFile = path.join(root, "expected", `${fixture}.sfc`);
  const expected = fs.existsSync(expectedFile) ? fs.readFileSync(expectedFile) : Buffer.alloc(0);
  const assembler = new Assembler({
    environment,
    target: SNES_TARGET_ID,
    baseImage,
    collectSourceMetadata: false,
  });
  let output = Buffer.alloc(0);
  let error: string | undefined;
  try {
    assembler.setIncludePaths([process.cwd(), tests]);
    assembler.setCurrentFile(sourceFile);
    assembler.assembleProgram(
      assembler.buildProgramModel(fs.readFileSync(sourceFile, "utf8"), sourceFile, 0),
    );
    output = Buffer.from(assembler.getBinaryOutput());
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  } finally {
    assembler.dispose();
  }
  const sha256 = hash(output);
  const expectedSha256 = hash(expected);
  return {
    fixture,
    bytes: output.length,
    expectedBytes: expected.length,
    sha256,
    expectedSha256,
    passed: output.length === expected.length && sha256 === expectedSha256,
    ...(error === undefined ? {} : { error }),
  };
}

const available = fs
  .readdirSync(tests)
  .filter((name) => name.endsWith(".asm"))
  .toSorted();
const requested = process.argv[2];
const fixtures = requested ? [`${requested}.asm`] : available;
for (const fixture of fixtures) {
  if (!available.includes(fixture)) {
    throw new Error(`Unknown Asar fixture '${fixture}'.`);
  }
}
const results = fixtures.map(compare);
for (const result of results) {
  console.log(
    `${result.passed ? "PASS" : "FAIL"} ${result.fixture}: ${result.bytes} bytes, ${result.sha256}`,
  );
  if (!result.passed) {
    console.error(
      `Expected ${result.expectedBytes} bytes, ${result.expectedSha256}. ${result.error ?? ""}`,
    );
  }
}
const failed = results.filter((result) => !result.passed).length;
console.log(`${results.length - failed} fixture byte comparisons passed, ${failed} failed.`);
process.exitCode = failed ? 1 : 0;
