import { test } from "../../../../tests/ava-helper.js";
import {
  analyzeStaticControlFlow,
  type StaticAnalysisAdapter,
  type StaticDecodeResult,
  type StaticInstruction,
} from "../../src/index.js";

const instruction = (
  address: number,
  size: number,
  flow: StaticInstruction["flow"],
  targets: StaticInstruction["targets"] = [],
): StaticInstruction => ({
  specificationId: `fixture.${address}`,
  address,
  fileOffset: address,
  size,
  opcode: address,
  mnemonic: flow.kind,
  mode: "fixture",
  effects: [],
  flow,
  targets,
});

const adapter = (
  decode: (address: number, state: number) => StaticDecodeResult,
): StaticAnalysisAdapter<number> => ({
  backingSize: 16,
  decode,
  transfer: (_instruction, state) => state,
  join: (left, right) => (left === right ? left : -1),
  stateKey: String,
});

test("generic static analysis follows calls, branches, returns, and evidence paths", (t) => {
  const result = analyzeStaticControlFlow(
    adapter((address) => {
      if (address === 0) {
        return {
          kind: "instruction",
          instruction: instruction(0, 1, { kind: "call", fallthrough: true }, [
            { kind: "call", address: 4 },
          ]),
        };
      }
      if (address === 1) {
        return {
          kind: "instruction",
          instruction: instruction(1, 1, { kind: "conditionalBranch", fallthrough: true }, [
            { kind: "branch", address: 3 },
          ]),
        };
      }
      if (address === 3 || address === 4) {
        return {
          kind: "instruction",
          instruction: instruction(address, 1, { kind: "return", fallthrough: false }),
        };
      }
      return {
        kind: "instruction",
        instruction: instruction(address, 1, { kind: "stop", fallthrough: false }),
      };
    }),
    [{ id: "reset", address: 0, kind: "vector", state: 1, evidence: ["vector"] }],
  );

  t.is(result.status, "complete");
  t.true(result.nodes.some((node) => node.address === 4 && node.context.length === 1));
  t.true(result.edges.some((edge) => edge.kind === "call" && edge.toAddress === 4));
  t.true(result.edges.some((edge) => edge.kind === "return" && edge.toAddress === 1));
  t.true(result.edges.some((edge) => edge.kind === "branch" && edge.toAddress === 3));
  t.true(result.functions.some((candidate) => candidate.address === 4));
  t.true(result.nodes.every((node) => node.evidencePath.length > 0));
  t.is(result.coverage.reachedBytes, 5);
});

test("generic static analysis retains boundary, ambiguity, and indirect-flow conflicts", (t) => {
  const result = analyzeStaticControlFlow(
    adapter((address, state) => {
      if (address === 6) {
        return {
          kind: "instruction",
          instruction: instruction(6, 1, { kind: "jump", fallthrough: false, indirect: true }, [
            { kind: "jump", indirect: true, explanation: "unknown table" },
          ]),
        };
      }
      if (address === 8 && state < 0) {
        return { kind: "ambiguous", reason: "width conflict", requiredState: ["m"] };
      }
      return {
        kind: "instruction",
        instruction: instruction(address, address === 0 ? 2 : 1, {
          kind: "stop",
          fallthrough: false,
        }),
      };
    }),
    [
      { id: "wide", address: 0, kind: "manual", state: 1, evidence: ["a"] },
      { id: "overlap", address: 1, kind: "manual", state: 1, evidence: ["b"] },
      { id: "indirect", address: 6, kind: "manual", state: 1, evidence: ["c"] },
      { id: "state-a", address: 8, kind: "manual", state: 1, evidence: ["d"] },
      { id: "state-b", address: 8, kind: "manual", state: 2, evidence: ["e"] },
    ],
  );

  t.true(result.conflicts.some((conflict) => conflict.kind === "instruction-boundary"));
  t.true(result.conflicts.some((conflict) => conflict.kind === "state-ambiguity"));
  t.deepEqual(
    result.unresolved.map((flow) => flow.address),
    [6],
  );
  t.false(result.nodes.some((node) => node.address === 8));
});

test("generic static analysis applies target overrides and reports deterministic limits", (t) => {
  const recursive = adapter((address) => ({
    kind: "instruction",
    instruction: instruction(address, 1, { kind: "call", fallthrough: false }, [
      { kind: "call", address },
    ]),
  }));
  const result = analyzeStaticControlFlow(
    recursive,
    [{ id: "entry", address: 2, kind: "configured", state: 1, evidence: ["entry"] }],
    { maxCallDepth: 1, maxWorkItems: 4 },
  );
  t.is(result.status, "incomplete");
  t.true(result.incompleteReasons.some((reason) => reason.kind === "call-context-limit"));

  const overridden = analyzeStaticControlFlow(
    adapter((address) => ({
      kind: "instruction",
      instruction: instruction(address, 1, { kind: "jump", fallthrough: false, indirect: true }, [
        { kind: "jump", indirect: true },
      ]),
    })),
    [{ id: "entry", address: 2, kind: "configured", state: 1, evidence: ["entry"] }],
    {
      maxWorkItems: 2,
      targetOverrides: [{ id: "manual-target", address: 2, targets: [7], evidence: ["manual"] }],
    },
  );
  t.true(overridden.edges.some((edge) => edge.override === "manual-target"));
  t.false(overridden.unresolved.some((flow) => flow.address === 2));
});

test("generic static analysis accepts compatible CPU mirrors without a boundary conflict", (t) => {
  const result = analyzeStaticControlFlow(
    adapter((address) => ({
      kind: "instruction",
      instruction: {
        ...instruction(address, 1, { kind: "stop", fallthrough: false }),
        fileOffset: 5,
      },
    })),
    [
      { id: "mirror-a", address: 8, kind: "manual", state: 1, evidence: ["a"] },
      { id: "mirror-b", address: 12, kind: "manual", state: 1, evidence: ["b"] },
    ],
  );
  t.is(result.nodes.length, 2);
  t.false(result.conflicts.some((conflict) => conflict.kind === "instruction-boundary"));
  t.is(result.coverage.reachedBytes, 1);
});
