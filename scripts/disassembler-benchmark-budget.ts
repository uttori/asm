import type { OperationBenchmarkAggregate } from "./benchmark-report.js";

const MEBIBYTE = 1_048_576;

/**
 * Versioned, host-scoped budget file derived from one retained benchmark report.
 * The policy records its source identity and formula so a performance limit cannot be loosened by
 * an unreviewed ad hoc command-line threshold or applied to an incomparable runtime class.
 */
export interface DisassemblerBenchmarkBudgets {
  readonly schemaVersion: 1;
  readonly suite: "uttori-asm-disassembler";
  readonly sourceReport: {
    readonly path: string;
    readonly sha256: string;
  };
  readonly environment: {
    readonly platform: string;
    readonly arch: string;
    readonly nodeMajor: number;
    readonly cpuModel: string;
  };
  readonly policy: {
    readonly wallTime: {
      readonly aggregate: "median";
      readonly sourceStatistic: "p95";
      readonly multiplier: number;
      readonly minimumHeadroomMs: number;
    };
    readonly boundaryRss: {
      readonly aggregate: "max";
      readonly sourceStatistic: "max";
      readonly multiplier: number;
      readonly minimumHeadroomBytes: number;
      readonly roundingBytes: number;
    };
  };
  readonly fixtures: readonly {
    readonly id: string;
    readonly operations: readonly {
      readonly id: string;
      readonly maxMedianWallMs: number;
      readonly maxBoundaryRssBytes: number;
    }[];
  }[];
}

/** Minimal report structure consumed by budget derivation and evaluation. */
export interface DisassemblerBenchmarkBudgetReport {
  readonly suite: string;
  readonly environment: {
    readonly node: string;
    readonly platform: string;
    readonly arch: string;
    readonly cpuModel: string;
  };
  readonly benchmarks: readonly {
    readonly fixture: { readonly id: string };
    readonly operations: readonly {
      readonly id: string;
      readonly aggregate: OperationBenchmarkAggregate;
    }[];
  }[];
}

/** One measured regression or missing policy entry. */
export interface DisassemblerBenchmarkBudgetViolation {
  readonly fixtureId: string;
  readonly operationId: string;
  readonly metric: "median-wall-ms" | "boundary-rss-bytes" | "missing-budget";
  readonly actual?: number;
  readonly limit?: number;
}

const nodeMajor = (version: string): number => {
  const match = /^v?(\d+)/.exec(version);
  if (!match) throw new Error(`Cannot read the Node major version from '${version}'.`);
  return Number(match[1]);
};

const roundUp = (value: number, quantum: number): number => Math.ceil(value / quantum) * quantum;

/**
 * Derives deterministic budgets from a retained report and a documented variance formula.
 * @param {DisassemblerBenchmarkBudgetReport} report Stable measured report.
 * @param {{ readonly path: string; readonly sha256: string }} sourceReport Report provenance.
 * @returns {DisassemblerBenchmarkBudgets} Host-scoped time and memory policy.
 */
export const deriveDisassemblerBenchmarkBudgets = (
  report: DisassemblerBenchmarkBudgetReport,
  sourceReport: { readonly path: string; readonly sha256: string },
): DisassemblerBenchmarkBudgets => {
  if (report.suite !== "uttori-asm-disassembler") {
    throw new Error(`Unsupported benchmark suite '${report.suite}'.`);
  }
  // Policy invariant: these are documented variance allowances, not target performance guesses.
  // Re-derive the complete checked-in policy from a reviewed report if any value changes.
  const wallTimeMultiplier = 1.5;
  const minimumHeadroomMs = 20;
  const boundaryRssMultiplier = 1.15;
  const minimumHeadroomBytes = 64 * MEBIBYTE;
  const roundingBytes = 16 * MEBIBYTE;
  return {
    schemaVersion: 1,
    suite: "uttori-asm-disassembler",
    sourceReport,
    environment: {
      platform: report.environment.platform,
      arch: report.environment.arch,
      nodeMajor: nodeMajor(report.environment.node),
      cpuModel: report.environment.cpuModel,
    },
    policy: {
      wallTime: {
        aggregate: "median",
        sourceStatistic: "p95",
        multiplier: wallTimeMultiplier,
        minimumHeadroomMs,
      },
      boundaryRss: {
        aggregate: "max",
        sourceStatistic: "max",
        multiplier: boundaryRssMultiplier,
        minimumHeadroomBytes,
        roundingBytes,
      },
    },
    fixtures: report.benchmarks.map(({ fixture, operations }) => ({
      id: fixture.id,
      operations: operations.map(({ id, aggregate }) => ({
        id,
        maxMedianWallMs: Math.ceil(
          Math.max(
            aggregate.wallMs.p95 * wallTimeMultiplier,
            aggregate.wallMs.p95 + minimumHeadroomMs,
          ),
        ),
        maxBoundaryRssBytes: roundUp(
          Math.max(
            aggregate.boundaryMaxRssBytes.max * boundaryRssMultiplier,
            aggregate.boundaryMaxRssBytes.max + minimumHeadroomBytes,
          ),
          roundingBytes,
        ),
      })),
    })),
  };
};

/**
 * Refuses to apply host-specific budgets to a different runtime class.
 * @param {DisassemblerBenchmarkBudgetReport} report Measured report environment.
 * @param {DisassemblerBenchmarkBudgets} budgets Host-scoped policy.
 */
export const assertDisassemblerBudgetEnvironment = (
  report: DisassemblerBenchmarkBudgetReport,
  budgets: DisassemblerBenchmarkBudgets,
): void => {
  if (budgets.schemaVersion !== 1 || budgets.suite !== "uttori-asm-disassembler") {
    throw new Error("Unsupported disassembler benchmark budget format.");
  }
  const actual = {
    platform: report.environment.platform,
    arch: report.environment.arch,
    nodeMajor: nodeMajor(report.environment.node),
    cpuModel: report.environment.cpuModel,
  };
  for (const key of ["platform", "arch", "nodeMajor", "cpuModel"] as const) {
    if (actual[key] !== budgets.environment[key]) {
      throw new Error(
        `Benchmark budget environment mismatch for ${key}: expected '${budgets.environment[key]}', received '${actual[key]}'.`,
      );
    }
  }
};

/**
 * Evaluates only fixture/operation pairs present in a measured report.
 * @param {DisassemblerBenchmarkBudgetReport} report Measured aggregates.
 * @param {DisassemblerBenchmarkBudgets} budgets Limits derived from a retained baseline.
 * @returns {readonly DisassemblerBenchmarkBudgetViolation[]} Deterministically ordered failures.
 */
export const evaluateDisassemblerBenchmarkBudgets = (
  report: DisassemblerBenchmarkBudgetReport,
  budgets: DisassemblerBenchmarkBudgets,
): readonly DisassemblerBenchmarkBudgetViolation[] => {
  assertDisassemblerBudgetEnvironment(report, budgets);
  const limits = new Map(
    budgets.fixtures.flatMap((fixture) =>
      fixture.operations.map((operation) => [`${fixture.id}\0${operation.id}`, operation] as const),
    ),
  );
  const violations: DisassemblerBenchmarkBudgetViolation[] = [];
  for (const benchmark of report.benchmarks) {
    for (const operation of benchmark.operations) {
      const limit = limits.get(`${benchmark.fixture.id}\0${operation.id}`);
      if (!limit) {
        // Fail closed: a newly added measurement must receive a reviewed derived budget before the
        // gate can pass; silently skipping it would leave the new hot path unprotected.
        violations.push({
          fixtureId: benchmark.fixture.id,
          operationId: operation.id,
          metric: "missing-budget",
        });
        continue;
      }
      if (operation.aggregate.wallMs.median > limit.maxMedianWallMs) {
        violations.push({
          fixtureId: benchmark.fixture.id,
          operationId: operation.id,
          metric: "median-wall-ms",
          actual: operation.aggregate.wallMs.median,
          limit: limit.maxMedianWallMs,
        });
      }
      if (operation.aggregate.boundaryMaxRssBytes.max > limit.maxBoundaryRssBytes) {
        violations.push({
          fixtureId: benchmark.fixture.id,
          operationId: operation.id,
          metric: "boundary-rss-bytes",
          actual: operation.aggregate.boundaryMaxRssBytes.max,
          limit: limit.maxBoundaryRssBytes,
        });
      }
    }
  }
  return violations;
};
