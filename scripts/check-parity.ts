/**
 * Run parser vs legacy fixture comparison and print results. Exits when done.
 * Usage: npm run check-parity  (or node --import=tsimp scripts/check-parity.ts)
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const resultPath = path.join(PROJECT_ROOT, "parity-result.txt");

function writeResult(text: string): void {
  fs.writeFileSync(resultPath, text + "\n", "utf8");
}

async function main(): Promise<void> {
  const { Assembler } = await import("../src/assembler.js");
  const { compileSourceWithParser } = await import("../src/parser/compile-with-parser.js");

  const FIXTURES_DIR = path.resolve(PROJECT_ROOT, "src/tests");
  const TARGET_ROM_PATH = path.resolve(PROJECT_ROOT, "src/dummy_rom.sfc");
  const EMPTY_SHA256 = createHash("sha256").update(Buffer.alloc(0)).digest("hex");
  const hashBuffer = (buffer: Buffer): string => createHash("sha256").update(buffer).digest("hex");

  function assembleLegacy(fixtureName: string): Buffer {
    const sourcePath = path.resolve(FIXTURES_DIR, `${fixtureName}.asm`);
    const source = fs.readFileSync(sourcePath, "utf8");
    const targetRom = fs.existsSync(TARGET_ROM_PATH) ? new Uint8Array(fs.readFileSync(TARGET_ROM_PATH)) : undefined;
    const assembler = new Assembler(targetRom);
    assembler.setIncludePaths(["./", path.dirname(sourcePath)]);
    assembler.setCurrentFile(sourcePath);
    for (const pass of [0, 1, 2]) {
      assembler.setPass(pass);
      source.split("\n").forEach((line, i) => {
        assembler.setCurrentLine(i);
        assembler.assembleblock(line.trim());
      });
      assembler.finishPass();
    }
    return Buffer.from(assembler.getBinaryOutput());
  }

  function assembleParser(fixtureName: string): Buffer {
    const sourcePath = path.resolve(FIXTURES_DIR, `${fixtureName}.asm`);
    const source = fs.readFileSync(sourcePath, "utf8");
    const targetRom = fs.existsSync(TARGET_ROM_PATH) ? new Uint8Array(fs.readFileSync(TARGET_ROM_PATH)) : undefined;
    const out = compileSourceWithParser(source, {
      targetRom,
      sourcePath,
      includePaths: ["./", path.dirname(sourcePath)]
    });
    return Buffer.from(out);
  }

  const fixtureNames = fs.readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".asm"))
    .map((f) => path.basename(f, ".asm"))
    .sort((a, b) => a.localeCompare(b));

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const name of fixtureNames) {
    let legacyErr: string | undefined;
    let parserErr: string | undefined;
    let legacyBuf: Buffer | null = null;
    let parserBuf: Buffer | null = null;
    try {
      legacyBuf = assembleLegacy(name);
    } catch (e) {
      legacyErr = e instanceof Error ? e.message : String(e);
    }
    try {
      parserBuf = assembleParser(name);
    } catch (e) {
      parserErr = e instanceof Error ? e.message : String(e);
    }
    const legacyHash = legacyBuf ? hashBuffer(legacyBuf) : EMPTY_SHA256;
    const parserHash = parserBuf ? hashBuffer(parserBuf) : EMPTY_SHA256;
    const ok = !parserErr && legacyHash === parserHash;
    if (ok) {
      passed++;
    } else {
      failed++;
      failures.push(
        `${name}: parserErr=${parserErr ?? "none"} legacyHash=${legacyHash.slice(0, 8)} parserHash=${parserHash.slice(0, 8)}`
      );
    }
  }

  const lines = [
    `Parser parity: ${passed} passed, ${failed} failed (of ${fixtureNames.length})`,
    ...failures.map((f) => "  " + f)
  ];
  const out = lines.join("\n");
  console.log(out);
  writeResult(out);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  try {
    writeResult("Error: " + msg);
  } catch {
    fs.writeFileSync("parity-error.txt", msg, "utf8");
  }
  console.error(msg);
  process.exit(1);
});
