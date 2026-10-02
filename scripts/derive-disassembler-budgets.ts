import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import type { OperationBenchmarkAggregate } from "./benchmark-report.js";
import {
  deriveDisassemblerBenchmarkBudgets,
  type DisassemblerBenchmarkBudgetReport,
} from "./disassembler-benchmark-budget.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`Report field ${key} must be a string.`);
  }
  return value;
}

function readStatistics(value: unknown, label: string) {
  if (
    !isRecord(value) ||
    typeof value.min !== "number" ||
    typeof value.median !== "number" ||
    typeof value.p95 !== "number" ||
    typeof value.max !== "number" ||
    typeof value.medianAbsoluteDeviation !== "number"
  ) {
    throw new Error(
      `Report statistic ${label} must contain numeric min, median, p95, max, and MAD.`,
    );
  }
  return {
    min: value.min,
    median: value.median,
    p95: value.p95,
    max: value.max,
    medianAbsoluteDeviation: value.medianAbsoluteDeviation,
  };
}

function readAggregate(value: unknown): OperationBenchmarkAggregate {
  if (!isRecord(value)) {
    throw new Error("Operation aggregate must be an object.");
  }
  return {
    wallMs: readStatistics(value.wallMs, "wallMs"),
    baselineRssBytes: readStatistics(value.baselineRssBytes, "baselineRssBytes"),
    baselineHeapUsedBytes: readStatistics(value.baselineHeapUsedBytes, "baselineHeapUsedBytes"),
    endRssBytes: readStatistics(value.endRssBytes, "endRssBytes"),
    endHeapUsedBytes: readStatistics(value.endHeapUsedBytes, "endHeapUsedBytes"),
    boundaryMaxRssBytes: readStatistics(value.boundaryMaxRssBytes, "boundaryMaxRssBytes"),
    boundaryMaxHeapUsedBytes: readStatistics(
      value.boundaryMaxHeapUsedBytes,
      "boundaryMaxHeapUsedBytes",
    ),
    rssDeltaBytes: readStatistics(value.rssDeltaBytes, "rssDeltaBytes"),
    heapUsedDeltaBytes: readStatistics(value.heapUsedDeltaBytes, "heapUsedDeltaBytes"),
  };
}

function readReport(value: unknown): DisassemblerBenchmarkBudgetReport {
  if (!isRecord(value) || typeof value.suite !== "string" || !isRecord(value.environment)) {
    throw new Error("Disassembler benchmark report is invalid.");
  }
  if (!Array.isArray(value.benchmarks)) {
    throw new Error("Disassembler benchmark report is missing benchmarks.");
  }
  const environment = value.environment;
  return {
    suite: value.suite,
    environment: {
      node: readString(environment, "node"),
      platform: readString(environment, "platform"),
      arch: readString(environment, "arch"),
      cpuModel: readString(environment, "cpuModel"),
    },
    benchmarks: value.benchmarks.map((benchmark, index) => {
      if (
        !isRecord(benchmark) ||
        !isRecord(benchmark.fixture) ||
        !Array.isArray(benchmark.operations)
      ) {
        throw new Error(`Benchmark ${index} is invalid.`);
      }
      return {
        fixture: { id: readString(benchmark.fixture, "id") },
        operations: benchmark.operations.map((operation, operationIndex) => {
          if (!isRecord(operation)) {
            throw new Error(`Benchmark ${index} operation ${operationIndex} is invalid.`);
          }
          return {
            id: readString(operation, "id"),
            aggregate: readAggregate(operation.aggregate),
          };
        }),
      };
    }),
  };
}

const root = path.resolve(import.meta.dirname, "..");
const reportArgument = process.argv[2];
const outputArgument = process.argv[3];
if (!reportArgument || !outputArgument) {
  throw new Error("Usage: derive-disassembler-budgets <report.json> <budgets.json>");
}
const reportPath = path.resolve(root, reportArgument);
const outputPath = path.resolve(root, outputArgument);
const bytes = fs.readFileSync(reportPath);
const parsedReport: unknown = JSON.parse(bytes.toString("utf8"));
const report = readReport(parsedReport);
// Bind the policy to the exact reviewed report bytes. Formatting or replacing the source report
// therefore requires an explicit regeneration and produces a visible provenance change.
const budgets = deriveDisassemblerBenchmarkBudgets(report, {
  path: path.relative(root, reportPath),
  sha256: createHash("sha256").update(bytes).digest("hex"),
});
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(budgets, null, 2)}\n`);
console.log(`Budgets: ${outputPath}`);
