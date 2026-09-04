import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  deriveDisassemblerBenchmarkBudgets,
  type DisassemblerBenchmarkBudgetReport,
} from "./disassembler-benchmark-budget.js";

const root = path.resolve(import.meta.dirname, "..");
const reportArgument = process.argv[2];
const outputArgument = process.argv[3];
if (!reportArgument || !outputArgument) {
  throw new Error("Usage: derive-disassembler-budgets <report.json> <budgets.json>");
}
const reportPath = path.resolve(root, reportArgument);
const outputPath = path.resolve(root, outputArgument);
const bytes = fs.readFileSync(reportPath);
const report = JSON.parse(bytes.toString("utf8")) as DisassemblerBenchmarkBudgetReport;
// Bind the policy to the exact reviewed report bytes. Formatting or replacing the source report
// therefore requires an explicit regeneration and produces a visible provenance change.
const budgets = deriveDisassemblerBenchmarkBudgets(report, {
  path: path.relative(root, reportPath),
  sha256: createHash("sha256").update(bytes).digest("hex"),
});
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(budgets, null, 2)}\n`);
console.log(`Budgets: ${outputPath}`);
