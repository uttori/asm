import { test } from "../../../../tests/ava-helper.js";
import { buildHomeSnapshot, sourceHomeProjection } from "../../src/project/home-model.js";
import { sourceWorkflow } from "../../src/source/workflow.js";

const emptyStatus = {
  fileCount: 0,
  symbolCount: 0,
  referenceCount: 0,
  errorCount: 0,
  lastReindexRootCount: 0,
  lastReindexCachedRoots: 0,
  lastReindexAnalyzedRoots: 0,
  entryPoints: [],
  includePaths: [],
};

test("empty LSP still names a source project from disk identity", (t) => {
  const snapshot = buildHomeSnapshot({
    trusted: true,
    watch: false,
    workspaceName: "workspace",
    status: emptyStatus,
    indexReady: false,
    source: {
      root: "/games/secret-of-mana",
      name: "secret-of-mana",
      branch: "main",
      dirty: false,
      target: "snes.sfc",
      previewed: false,
      workflow: sourceWorkflow({ analysisReady: true }),
      incoming: [],
      capturePhase: "idle",
    },
  });
  t.is(snapshot.mode, "source");
  t.is(snapshot.name, "secret-of-mana");
  t.is(snapshot.targetLabel, "SNES");
  t.false(snapshot.indexReady);
  t.is(snapshot.next?.command, "asm.source.prepare");
  t.is(snapshot.health.coverage, undefined);
  t.is(sourceHomeProjection(snapshot).build, undefined);
});

test("source Home merges conversion coverage with index counts", (t) => {
  const snapshot = buildHomeSnapshot({
    trusted: true,
    watch: false,
    status: { ...emptyStatus, fileCount: 12, symbolCount: 40, errorCount: 2 },
    indexReady: true,
    source: {
      root: "/games/secret-of-mana",
      name: "secret-of-mana",
      branch: "main",
      dirty: false,
      target: "snes.sfc",
      previewed: false,
      workflow: sourceWorkflow({ analysisReady: true }),
      incoming: [],
      capturePhase: "idle",
      coverage: {
        summary: {
          version: 1,
          inputSha256: "a".repeat(64),
          coverage: {
            romSha256: "b".repeat(64),
            totalBytes: 200,
            remainingBytes: 50,
            convertedBytes: 150,
          },
        },
        freshness: { status: "current", reason: "Saved source matches." },
      },
    },
  });
  t.is(snapshot.health.index.files, 12);
  t.is(snapshot.health.index.errors, 2);
  t.is(snapshot.health.coverage?.remainingPercent, 25);
  t.is(snapshot.health.coverage?.freshness, "current");
});

test("assembly Home skips the stepper and conversion meter", (t) => {
  const snapshot = buildHomeSnapshot({
    trusted: true,
    watch: true,
    workspaceName: "slideshow",
    status: {
      ...emptyStatus,
      target: "snes.sfc",
      architecture: "snes.65816",
      buildOutput: "game.sfc",
    },
    indexReady: false,
  });
  t.is(snapshot.mode, "assembly");
  t.is(snapshot.steps, undefined);
  t.is(snapshot.health.coverage, undefined);
  t.is(snapshot.health.outputPath, "game.sfc");
  t.true(snapshot.watch);
});

test("unpreviewed incoming stays collapsed", (t) => {
  const snapshot = buildHomeSnapshot({
    trusted: true,
    watch: false,
    status: emptyStatus,
    indexReady: false,
    source: {
      root: "/games/secret-of-mana",
      name: "secret-of-mana",
      branch: "main",
      dirty: false,
      target: "snes.sfc",
      candidate: "deadbeef",
      previewed: false,
      workflow: sourceWorkflow({ candidate: true }),
      incoming: Array.from({ length: 20 }, (_, index) => ({
        path: `bank-${index}.asm`,
        status: "M",
        conflict: false,
        left: "left",
        right: "right",
        title: "diff",
      })),
      capturePhase: "idle",
    },
  });
  t.is(snapshot.incoming?.previewed, false);
  t.is(snapshot.incoming?.total, 20);
  t.is(snapshot.incoming?.shown, 0);
  t.true(sourceHomeProjection(snapshot).incoming.collapsed);
});
