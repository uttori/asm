import { test } from "../../../../tests/ava-helper.js";
import { validateAnalysisOwnership } from "../../src/model/analysis-ownership.js";
import type { AnalysisControlFlowNodeRecord } from "../../src/model/project-types.js";

/** Only ownership fields participate here; ordinary record bounds are checked by project validation. */
const node = (id: string, functionEntry?: string, evidencePredecessor?: string) =>
  ({
    id,
    kind: "cfg-node",
    addressSpace: "snes.cpu",
    functionEntry,
    evidencePredecessor,
  }) as AnalysisControlFlowNodeRecord;

test("compact ownership validates long paths once and rejects dangling, cyclic or mixed owners", (t) => {
  const records = [node("entry", "entry")];
  for (let index = 1; index <= 10000; index++) {
    records.push(node(`step:${index}`, "entry", records.at(-1)!.id));
  }
  t.notThrows(() => validateAnalysisOwnership(records));
  t.throws(() => validateAnalysisOwnership([node("dangling", "missing")]), {
    message: /invalid function entry/,
  });
  t.throws(
    () =>
      validateAnalysisOwnership([
        node("entry", "entry"),
        node("a", "entry", "b"),
        node("b", "entry", "a"),
      ]),
    { message: /cyclic/ },
  );
  t.throws(
    () =>
      validateAnalysisOwnership([
        node("entry", "entry"),
        node("other", "other"),
        node("a", "entry", "other"),
      ]),
    { message: /invalid evidence predecessor/ },
  );
  t.throws(() => validateAnalysisOwnership([node("a", undefined, "b")]), {
    message: /without function ownership/,
  });
});
