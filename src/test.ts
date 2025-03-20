
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
const cliScript = "./src/cli.ts"; // Path to your CLI script
const testsDir = path.join(process.cwd(), "./src/tests");
const expectedDir = path.join(process.cwd(), "./src/tests_tmp_app");
const targetRom = path.join(process.cwd(), "./src/dummy_rom.sfc");

/**
 * Get the size and checksum of a file.
 * @param {string} filePath The path to the file to get the stats of.
 * @returns {{size: number, checksum: string}} The size and checksum of the file.
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

/**
 * Run a test for a given base filename (without extension).
 * @param {string} baseName The base filename (without extension) to run the test for.
 * @returns {TestResult} The result of the test.
 */
function runTest(baseName: string): TestResult {
  const asmFile = path.join(testsDir, `${baseName}.asm`);
  const outputFile = path.join(testsDir, `${baseName}.sfc`);
  const expectedFile = path.join(expectedDir, `${baseName}.asm.sfc`);

  const command = `bun ${cliScript} ${asmFile} ${outputFile} ${targetRom}`;
  console.log(`\nRunning: ${command}`);

  let runError: string | undefined = undefined;
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error: unknown) {
    runError = error instanceof Error ? error.message : String(error);
    console.error(`Error running command for ${baseName}:`, runError);
  }

  const outputStats = getFileStats(outputFile);
  const expectedStats = getFileStats(expectedFile);

  const fileSizeMismatch = outputStats.size !== expectedStats.size;
  const checksumMismatch = outputStats.checksum !== expectedStats.checksum;
  const overallPassed = !fileSizeMismatch && !checksumMismatch;

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

/**
 * Main loop: iterate over .asm files in testsDir (or a single test if provided)
 */
function main() {
  const args = process.argv.slice(2);
  let asmFiles: string[];

  if (args.length > 0 && args[0].trim() !== "") {
    // If a test name is provided, run that single test.
    asmFiles = [`${args[0]}.asm`];
  } else {
    // Otherwise, run all tests, sorted ascending by filename.
    asmFiles = fs
      .readdirSync(testsDir)
      .filter((f) => f.endsWith(".asm"))
      .sort((a, b) => a.localeCompare(b));
  }

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

  // Prepare summary table with separate columns for file size and checksum mismatches.
  const summary = results
    .filter(r => r.expectedSize !== 0)
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

  const passCount = results.filter((r) => r.overallPassed).length;
  const failCount = results.length - passCount;
  console.log(`\nSummary: ${passCount} passed, ${failCount} failed.`);
  if (failCount > 0) {
    process.exit(1);
  }
}

main();
