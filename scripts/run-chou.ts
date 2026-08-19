
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { createHash } from "crypto";

interface TestResult {
  test: string;
  commandRan: string;
  runError?: string;
  outputSize: number;
  expectedSize: number;
  fileSizeMismatch: boolean;
  outputChecksum: string;
  expectedChecksum: string;
  checksumMismatch: boolean;
  overallPassed: boolean;
}

// Directories and file paths
const testsDir = path.join(process.cwd(), "./fixtures/integration/chou");
const targetRom = path.join(testsDir, "test.sfc");
const checksumMode = "simple";

/**
 * Helper: Get file stats (size and checksum). If the file doesn't exist,
 * assume size is 0 and checksum is that of a 0-byte file.
 * @param {string} filePath The path to the file to get the stats of.
 * @returns {{ size: number; checksum: string }} The size and checksum of the file.
 */
function getFileStats(filePath: string): { size: number; checksum: string } {
  if (!fs.existsSync(filePath)) {
    return {
      size: 0,
      checksum: createHash("sha256").update(Buffer.alloc(0)).digest("hex")
    };
  }
  const size = fs.statSync(filePath).size;
  const checksum = createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  return { size, checksum };
}

// Run CLI command for a given base filename (without extension)
/**
 * @param {string} baseName The base name of the file to run the test on.
 * @returns {TestResult} The result of the test.
 */
function runTest(baseName: string): TestResult {
  const asmFile = path.join(testsDir, `${baseName}.asm`);
  const outputFile = path.join(testsDir, `${baseName.toLowerCase()}.sfc`);
  const temporaryOutputFile = path.join(testsDir, `.${baseName.toLowerCase()}.tmp.sfc`);
  const expectedFile = path.join(testsDir, "Chou Makaimura (Japan).sfc");

  // Build separately so a failed or interrupted run cannot delete the last
  // known-good fixture used by the integration tests.
  if (fs.existsSync(temporaryOutputFile)) {
    fs.rmSync(temporaryOutputFile);
  }

  const command = `npm run cli -- ${asmFile} ${temporaryOutputFile} ${targetRom} --checksum-mode=${checksumMode}`;
  console.log(`\nRunning: ${command}`);

  let runError: string | undefined = undefined;
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    runError = error instanceof Error ? error.message : String(error);
    console.error(`Error running command for ${baseName}:`, runError);
  }

  const outputStats = getFileStats(temporaryOutputFile);
  const expectedStats = getFileStats(expectedFile);

  const fileSizeMismatch = outputStats.size !== expectedStats.size;
  const checksumMismatch = outputStats.checksum !== expectedStats.checksum;
  const overallPassed = !fileSizeMismatch && !checksumMismatch;

  if (overallPassed) {
    fs.copyFileSync(temporaryOutputFile, outputFile);
    fs.rmSync(temporaryOutputFile);
  }

  return {
    test: baseName,
    commandRan: command,
    runError,
    outputSize: outputStats.size,
    expectedSize: expectedStats.size,
    fileSizeMismatch,
    outputChecksum: outputStats.checksum,
    expectedChecksum: expectedStats.checksum,
    checksumMismatch,
    overallPassed
  };
}

// Main loop: iterate over .asm files in testsDir (or a single test if provided)
/**
 *
 */
function main() {
  const _args = process.argv.slice(2);
  const asmFiles: string[] = ["Chou.asm"];

  const results: TestResult[] = [];
  for (const file of asmFiles) {
    const baseName = path.basename(file, ".asm");
    console.log(`\n--- Testing ${baseName} ---`);
    const result = runTest(baseName);
    if (result.overallPassed) {
      console.log(`${baseName}: PASS`);
    } else {
      console.error(`${baseName}: FAIL`);
    }
    results.push(result);
  }

  console.log("results", results);
  // Prepare summary table with separate columns for file size and checksum mismatches.
  const summary = results
    // .filter(r => r.expectedSize !== 0)
    .map((r) => ({
      Test: r.test,
      "Output Size": r.outputSize,
      "Expected Size": r.expectedSize,
      "Size Mismatch": r.fileSizeMismatch ? "❌" : "✅",
      "Output Checksum": r.outputChecksum.slice(0, 8) + "...",
      "Expected Checksum": r.expectedChecksum.slice(0, 8) + "...",
      "Checksum Mismatch": r.checksumMismatch ? "❌" : "✅",
      Overall: r.overallPassed ? "✅" : "❌"
    }));

  console.log("\nTest Results Summary:");
  console.table(summary);
}

main();
