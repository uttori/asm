import { test } from "../../../../tests/ava-helper.js";
import { host, resetHost, pick } from "../helpers/editor-host.js";

const { AnalysisEvidenceInspector } = await import("../../src/analysis/evidence-inspector.js");
const choices = () => ({
  shards: {
    analysis: [],
    annotations: [{ id: "code" }],
    labels: [],
    comments: [],
    regions: [],
    runtime: [],
    evidence: [],
    imports: [],
  },
});
const explanation = {
  shard: "annotations",
  record: { id: "code", start: 0 },
  evidence: [{ id: "capture" }],
  referencedBy: ["function:main"],
  referencedByTotal: 7,
  conflicts: [{ id: "conflict" }],
};

test.beforeEach(() => resetHost());

test.serial(
  "evidence inspection keeps the selected store and reports bounded reverse references",
  async (t) => {
    host.projects = ["/selected/evidence"];
    host.picks = [pick("code")];
    host.analysisRequest = async (_root, action) =>
      action === "evidenceChoices" ? choices() : explanation;
    await new AnalysisEvidenceInspector().explainEvidence();
    t.deepEqual(host.requests, [
      ["/selected/evidence", "evidenceChoices"],
      [
        "/selected/evidence",
        "explainEvidence",
        { evidenceRecord: { kind: "annotations", id: "code" } },
      ],
    ]);
    const rendered = host.documents[0].getText();
    t.true(rendered.includes("Showing 1 of 7 references."));
    for (const value of [
      "/selected/evidence",
      '"id": "capture"',
      '"id": "conflict"',
      "function:main",
    ]) {
      t.true(rendered.includes(value));
    }
    t.is(host.edits.length, 0);
    t.is(host.shown.length, 1);
  },
);

test.serial("project discovery and cancelled pickers never query a different store", async (t) => {
  const inspector = new AnalysisEvidenceInspector();
  await inspector.explainEvidence();
  t.deepEqual(host.errors, ["No native analysis project was found."]);
  host.projects = ["/first/store", "/second/store"];
  await inspector.explainEvidence();
  t.is(host.requests.length, 0);
  host.picks = [(items) => items[1], undefined];
  host.analysisRequest = async () => choices();
  await inspector.explainEvidence();
  t.is(host.requests[0][0], "/second/store");
  t.is(host.documents.length, 0);
  host.projects = ["/only/store"];
  host.picks = [pick("code")];
  host.analysisRequest = async (_root, action) =>
    action === "evidenceChoices"
      ? choices()
      : {
          shard: "annotations",
          record: { id: "code" },
          evidence: [],
          referencedBy: [],
          conflicts: [],
        };
  await inspector.explainEvidence();
  const text = host.documents[0].getText();
  t.true(text.includes("No direct evidence ids"));
  t.true(text.includes("No project records reference"));
  t.true(text.includes("No persisted conflict"));
  t.false(text.includes("Showing"));
});

test.serial(
  "empty selections explain their scope without creating an inspection document",
  async (t) => {
    host.projects = ["/evidence"];
    host.analysisRequest = async () => ({
      shards: Object.fromEntries(Object.keys(choices().shards).map((key) => [key, []])),
    });
    const inspector = new AnalysisEvidenceInspector();
    await inspector.explainEvidence();
    await inspector.explainEvidence();
    t.true(host.infos[0].includes("selected project"));
    t.true(host.infos[1].includes("selected project"));
    t.is(host.documents.length, 0);
  },
);

test.serial(
  "invalid evidence replies and worker failures surface diagnostics without publishing a document",
  async (t) => {
    const inspector = new AnalysisEvidenceInspector();
    host.projects = ["/selected/evidence"];
    for (const invalid of [
      null,
      {},
      { shards: {} },
      { ...choices(), shards: { ...choices().shards, annotations: [null] } },
      { ...choices(), shards: { ...choices().shards, annotations: [{ id: 1 }] } },
    ]) {
      host.analysisRequest = async () => invalid;
      await inspector.explainEvidence();
      t.true(host.errors.at(-1)?.includes("choices are unavailable"));
    }
    for (const invalid of [
      null,
      {},
      { ...explanation, record: null },
      { ...explanation, referencedBy: [2] },
      { ...explanation, referencedByTotal: "7" },
      { ...explanation, conflicts: {} },
    ]) {
      host.picks = [pick("code")];
      host.analysisRequest = async (_root, action) =>
        action === "evidenceChoices" ? choices() : invalid;
      await inspector.explainEvidence();
      t.true(host.errors.at(-1)?.includes("explanation is unavailable"));
    }
    for (const error of [new Error("Store closed"), "cancelled"]) {
      host.analysisRequest = async () => {
        // Worker transports can reject with a non-Error payload.
        // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- Exercise malformed transport rejection.
        return Promise.reject(error);
      };
      await inspector.explainEvidence();
      t.true(host.errors.at(-1)?.includes(String(error).replace("Error: ", "")));
    }
    t.is(host.documents.length, 0);
    t.is(host.edits.length, 0);
  },
);
