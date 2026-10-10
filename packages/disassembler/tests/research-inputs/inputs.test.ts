import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import {
  RomImage,
  publishAnalysisProject,
  openAnalysisProjectStore,
  type AnalysisProject,
  type ProjectLabel,
  importRuntimeTraceSourceIntoProject,
  type RuntimeTraceSource,
  type IntervalAnnotation,
  changeResearchAnalysis,
} from "../../src/index.js";
import {
  readResearchInputs,
  writeResearchDocument,
  type ResearchDocument,
} from "../../src/research-inputs/inputs.js";
import { changeResearchSymbol, renameResearchSymbol } from "../../src/research-inputs/symbols.js";
import { sourceGit } from "../../src/source-project/git.js";
import { parseSourceProject } from "../../src/source-project/project.js";

function isAnnotation(value: unknown): value is IntervalAnnotation {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "classification" in value &&
    "start" in value &&
    "end" in value
  );
}

const label: ProjectLabel = {
  id: "label-entry",
  addressSpace: "rom.file",
  address: 0,
  name: "Entry",
  evidence: ["import-1"],
};

/** A tiny evidence store exercises the same projection transactions as the full captured project. */
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-research-"));
  const project: AnalysisProject = {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: 3,
      target: "fixture",
      rom: new RomImage(new Uint8Array(32768)).identity,
      mapping: { mapper: "fixture", source: "override", candidates: [] },
      addressSpaces: [{ id: "rom.file", name: "ROM", kind: "file", addressBits: 24 }],
    },
    shards: {
      analysis: [],
      annotations: [],
      labels: [label],
      comments: [],
      regions: [],
      runtime: [],
      imports: [],
      evidence: [{ id: "import-1", source: "import", sourceId: "fixture", confidence: "certain" }],
    },
  };
  const directory = path.join(root, ".uttori-local");
  publishAnalysisProject(directory, project);
  fs.writeFileSync(path.join(root, ".gitignore"), ".uttori-local/\n");
  const document: ResearchDocument = {
    format: "uttori-research",
    version: 1,
    project: "fixture",
    romSha256: project.manifest.rom.contentSha256,
    decisions: [
      {
        collection: "labels",
        id: label.id,
        value: { ...label, name: "RandomByte", sourceName: "RandomByte", aliases: ["Entry"] },
      },
    ],
  };
  writeResearchDocument(root, ".uttori/research/names.json", document, null);
  const read = () => readResearchInputs(root, [".uttori/research"], document);
  const store = openAnalysisProjectStore(directory);
  return { root, store, document, read };
}

test("research names follow Git branches and the SQLite index is rebuildable", async (t) => {
  const { root, store, document, read } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  await sourceGit(root, ["init", "-b", "main"]);
  await sourceGit(root, ["config", "user.name", "Fixture"]);
  await sourceGit(root, ["config", "user.email", "fixture@localhost"]);
  await sourceGit(root, ["add", "--all"]);
  await sourceGit(root, ["commit", "-m", "Name entry"]);
  t.true(store.transaction(() => store.synchronizeResearchInputs(read())));
  t.is(store.loadTable("labels")[0]!.sourceName, "RandomByte");
  const revision = store.revision();
  t.false(store.transaction(() => store.synchronizeResearchInputs(read())));
  t.is(store.revision(), revision);
  await sourceGit(root, ["switch", "-c", "alternate"]);
  writeResearchDocument(
    root,
    ".uttori/research/names.json",
    { ...document, decisions: [] },
    read().files[0]!.sha256,
  );
  await sourceGit(root, ["add", "--all"]);
  await sourceGit(root, ["commit", "-m", "Use imported name"]);
  store.transaction(() => store.synchronizeResearchInputs(read()));
  t.deepEqual(store.loadTable("labels"), [label]);
  await sourceGit(root, ["switch", "main"]);
  store.transaction(() => store.synchronizeResearchInputs(read()));
  t.is(store.loadTable("labels")[0]!.sourceName, "RandomByte");
  store.transaction(() => {
    store.suspendResearchInputs();
    store.synchronizeResearchInputs(read());
  });
  t.is(store.loadTable("labels")[0]!.sourceName, "RandomByte");
});

test("capture imports preserve the research overlay and idempotent reimport does not change its revision", async (t) => {
  const { root, store, read } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const research = read();
  store.transaction(() => store.synchronizeResearchInputs(research));
  const source: RuntimeTraceSource = {
    metadata: {
      format: "uttori-asm-instruction-trace",
      schemaVersion: 1,
      architecture: "fixture",
      addressSpace: "rom.file",
      romContentSha256: research.romSha256,
      producer: { id: "fixture", revision: "1" },
    },
    read: async (accept) => {
      accept({ sequenceStart: 1, addresses: [0], droppedEvents: 0, active: false });
    },
  };
  const context = { projectRomContentSha256: research.romSha256, sourceName: "fixture.act2" };
  const directory = path.join(root, ".uttori-local");
  await t.throwsAsync(importRuntimeTraceSourceIntoProject(source, directory, context), {
    message: /selected Git research/,
  });
  const imported = await importRuntimeTraceSourceIntoProject(source, directory, context, {
    research,
  });
  t.true(imported.changed);
  t.throws(() => store.assertCurrentAnalysis(), { message: /Captured evidence changed/ });
  t.is(store.loadTable("labels")[0]!.sourceName, "RandomByte");
  t.is(store.researchInputsIdentity(), research.hash);
  const revision = store.revision();
  const repeated = await importRuntimeTraceSourceIntoProject(source, directory, context, {
    research,
  });
  t.false(repeated.changed);
  t.is(store.revision(), revision);
  await t.throwsAsync(
    importRuntimeTraceSourceIntoProject(source, directory, context, {
      research,
      assertResearchCurrent: () => {
        throw new Error("Branch changed");
      },
    }),
    { message: /Branch changed/ },
  );
  t.is(store.revision(), revision);
});

test("research branch changes invalidate decoded code only when analysis inputs change", (t) => {
  const { root, store, read, document } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  store.transaction(() => store.synchronizeResearchInputs(read()));
  t.notThrows(() => store.assertCurrentAnalysis());
  const changed: ResearchDocument = {
    ...document,
    decisions: [
      ...document.decisions,
      {
        collection: "annotations",
        id: "manual:data",
        value: {
          id: "manual:data",
          addressSpace: "rom.file",
          start: 4,
          end: 8,
          classification: "data16",
          architecture: "fixture",
          evidence: ["import-1"],
        },
      },
    ],
  };
  writeResearchDocument(root, ".uttori/research/names.json", changed, read().files[0]!.sha256);
  store.transaction(() => store.synchronizeResearchInputs(read()));
  t.throws(() => store.sourceExportView(), { message: /Research classification/ });
  t.throws(() => store.callGraph(), { message: /Research classification/ });
  store.transaction(() => store.replaceResearchAnalysis(read(), { analysis: [] }));
  t.notThrows(() => store.assertCurrentAnalysis());
  writeResearchDocument(root, ".uttori/research/names.json", document, read().files[0]!.sha256);
  store.transaction(() => store.synchronizeResearchInputs(read()));
  t.throws(() => store.assertCurrentAnalysis(), { message: /Research classification/ });
});

test("new observations remain underneath Git decisions and survive removing an override", (t) => {
  const { root, store, document, read } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  store.transaction(() => store.synchronizeResearchInputs(read()));
  const imported = { ...label, name: "ImportedRandom" };
  store.transaction(() => {
    store.suspendResearchInputs();
    store.replaceTables({ labels: [imported] });
    store.synchronizeResearchInputs(read());
  });
  t.is(store.loadTable("labels")[0]!.sourceName, "RandomByte");
  writeResearchDocument(
    root,
    ".uttori/research/names.json",
    { ...document, decisions: [] },
    read().files[0]!.sha256,
  );
  store.transaction(() => store.synchronizeResearchInputs(read()));
  t.deepEqual(store.loadTable("labels"), [imported]);
});

test("analysis publication never promotes projected research records into observation shadows", (t) => {
  const { root, store, document, read } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const original = {
    id: "imported-note",
    addressSpace: "rom.file",
    address: 0,
    text: "Imported prose",
    evidence: ["import-1"],
  };
  const authored = { ...original, text: "Git research prose" };
  store.transaction(() => {
    store.replaceTables({ comments: [original] });
    store.publishManifest(store.manifest());
  });
  writeResearchDocument(
    root,
    ".uttori/research/names.json",
    {
      ...document,
      decisions: [
        ...document.decisions,
        { collection: "comments", id: original.id, value: authored },
      ],
    },
    read().files[0]!.sha256,
  );
  const research = read();
  store.transaction(() => store.synchronizeResearchInputs(research));
  store.transaction(() =>
    store.replaceResearchAnalysis(research, {
      comments: [authored, { ...original, id: "derived-note", text: "Derived prose" }],
      evidence: store.loadTable("evidence"),
    }),
  );
  t.is(
    store.loadTable("comments").find((record) => record.id === original.id)!.text,
    authored.text,
  );
  writeResearchDocument(
    root,
    ".uttori/research/names.json",
    { ...document, decisions: [] },
    read().files[0]!.sha256,
  );
  store.transaction(() => store.synchronizeResearchInputs(read()));
  t.deepEqual(
    store.loadTable("comments").find((record) => record.id === original.id),
    original,
  );
  t.true(store.loadTable("comments").some((record) => record.id === "derived-note"));
});

test("invalid research publication rolls back rows, baseline shadows, and revision", (t) => {
  const { root, store, document, read } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  store.transaction(() => store.synchronizeResearchInputs(read()));
  const before = store.loadTable("labels"),
    revision = store.revision();
  writeResearchDocument(
    root,
    ".uttori/research/names.json",
    {
      ...document,
      decisions: [
        {
          collection: "labels",
          id: label.id,
          value: { ...label, name: "Broken", evidence: ["missing"] },
        },
      ],
    },
    read().files[0]!.sha256,
  );
  t.throws(() => store.transaction(() => store.synchronizeResearchInputs(read())), {
    message: /missing evidence/,
  });
  t.deepEqual(store.loadTable("labels"), before);
  t.is(store.revision(), revision);
  writeResearchDocument(
    root,
    ".uttori/research/names.json",
    { ...document, decisions: [] },
    read().files[0]!.sha256,
  );
  store.transaction(() => store.synchronizeResearchInputs(read()));
  t.deepEqual(store.loadTable("labels"), [label]);
});

test("research documents reject competing locations, symlinks, and stale saves", (t) => {
  const { root, store, document, read } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  t.throws(() => writeResearchDocument(root, ".uttori/research/names.json", document, null), {
    message: /changed/,
  });
  writeResearchDocument(root, ".uttori/research/duplicate.json", document, null);
  t.throws(read, { message: /more than one authoring location/ });
  fs.unlinkSync(path.join(root, ".uttori/research/duplicate.json"));
  fs.symlinkSync(
    path.join(root, ".uttori/research/names.json"),
    path.join(root, ".uttori/research/link.json"),
  );
  t.throws(read, { message: /symlinks/ });
});

test("research growth is unrestricted unless the project explicitly selects resource ceilings", (t) => {
  const { root, store, document, read } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const empty = JSON.stringify({ ...document, decisions: [] });
  const padded = empty + " ".repeat(1024 * 1024);
  const nested = `.uttori/research/${"group/".repeat(40)}`;
  fs.mkdirSync(path.join(root, nested), { recursive: true });
  // Exercise large documents, aggregate volume, many files and deeply grouped research together.
  for (let index = 0; index < 513; index++) {
    fs.writeFileSync(path.join(root, nested, `${index}.json`), index < 33 ? padded : empty);
  }
  const snapshot = read();
  t.is(snapshot.files.length, 514);
  t.deepEqual(snapshot.decisions, document.decisions);
  t.is(snapshot.hash, readResearchInputs(root, [".uttori/research/names.json"], document).hash);
});

test("explicit research ceilings identify the path, actual amount, policy and configuration remedy", (t) => {
  const { root, store, document } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const relative = ".uttori/research/names.json";
  const size = fs.statSync(path.join(root, relative)).size;
  const read = (limits: Parameters<typeof readResearchInputs>[4], overlays?: Map<string, string>) =>
    readResearchInputs(root, [".uttori/research"], document, overlays, limits);
  t.notThrows(() => read({ researchDocumentBytes: size, researchBytes: size, researchFiles: 1 }));
  for (const field of ["researchDocumentBytes", "researchBytes"] as const) {
    const error = t.throws(() => read({ [field]: size - 1 }));
    t.true(error!.message.includes(path.join(root, relative)));
    t.true(error!.message.includes(size.toLocaleString("en-US")));
    t.true(error!.message.includes(`limits.${field}`));
    t.regex(error!.message, /Increase or remove.*\.uttori\/project\.json/);
  }
  const text = JSON.stringify({ ...document, decisions: [] });
  const overlays = new Map([[".uttori/research/unsaved.json", text]]);
  t.throws(() => read({ researchFiles: 1 }, overlays), {
    message: /unsaved\.json: 2 selected JSON files exceeds limits\.researchFiles \(1/,
  });
  t.throws(
    () => read({ researchDocumentBytes: size }, new Map([[relative, " ".repeat(size) + text]])),
    {
      message: /names\.json:.*limits\.researchDocumentBytes/,
    },
  );
  t.throws(() => read({ researchBytes: size }, overlays), {
    message: /unsaved\.json:.*bytes across selected documents.*limits\.researchBytes/,
  });
  for (const invalid of [0, -1, 0.5, Infinity, NaN]) {
    t.throws(() => read({ researchFiles: invalid }), { message: /positive safe integer/ });
  }
});

test("research file errors distinguish missing inputs, malformed JSON and invalid decisions", (t) => {
  const { root, store, document } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const relative = ".uttori/research/broken.json";
  t.throws(() => readResearchInputs(root, [relative], document), {
    message: /does not exist:.*broken\.json.*researchRoots/,
  });
  t.throws(() => readResearchInputs(root, ["missing-directory"], document), {
    message: /does not exist:.*missing-directory.*researchRoots/,
  });
  fs.writeFileSync(path.join(root, relative), "{broken");
  t.throws(() => readResearchInputs(root, [relative], document), {
    message: /Invalid research input.*broken\.json:/,
  });
  fs.writeFileSync(path.join(root, relative), JSON.stringify({ ...document, decisions: [null] }));
  t.throws(() => readResearchInputs(root, [relative], document), {
    message: /broken\.json: decisions\[0\]:.*known collection and stable ID/,
  });
});

test("project manifests accept only valid explicit research ceilings", (t) => {
  const configuration = {
    format: "uttori-source-project",
    version: 1,
    id: "fixture",
    target: "snes.sfc",
    romSha256: "a".repeat(64),
    sourceRoots: ["source"],
    researchRoots: [".uttori/research"],
    buildConfig: "source/uttori-asm.config.json",
    layout: ".uttori/layout.json",
    captures: ".uttori/captures.json",
  };
  const limits = { researchDocumentBytes: 2048, researchBytes: 4096, researchFiles: 2 };
  t.deepEqual(parseSourceProject({ ...configuration, limits }).limits, limits);
  for (const field of Object.keys(limits)) {
    t.throws(() => parseSourceProject({ ...configuration, limits: { [field]: 0 } }), {
      message: new RegExp(`limits\\.${field}.*positive safe integer`),
    });
  }
});

test("database authoring outside the research lifecycle is detected rather than silently lost", (t) => {
  const { root, store, read } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  store.transaction(() => store.synchronizeResearchInputs(read()));
  store.transaction(() => {
    store.replaceTables({ labels: [{ ...label, name: "DatabaseEdit" }] });
    store.publishManifest(store.manifest());
  });
  t.throws(() => store.transaction(() => store.synchronizeResearchInputs(read())), {
    message: /outside its authoring files/,
  });
  t.is(store.loadTable("labels")[0]!.name, "DatabaseEdit");
});

test("an import cannot commit while research decisions are suspended", (t) => {
  const { root, store, read } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  store.transaction(() => store.synchronizeResearchInputs(read()));
  const revision = store.revision();
  t.throws(() => store.transaction(() => store.suspendResearchInputs()), {
    message: /Reapply research/,
  });
  t.is(store.revision(), revision);
  t.is(store.loadTable("labels")[0]!.sourceName, "RandomByte");
  t.false(store.transaction(() => store.synchronizeResearchInputs(read())));
});

test("a persistent rename preserves symbol identity, aliases and provenance without writing SQLite", (t) => {
  const { root, store, read } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const before = read();
  const identity = {
    id: label.id,
    addressSpace: label.addressSpace,
    address: label.address,
    currentName: "RandomByte",
    evidence: label.evidence,
  };
  const edit = renameResearchSymbol(
    before,
    identity,
    "NextRandomByte",
    ".uttori/research/new.json",
  );
  t.is(edit.path, ".uttori/research/names.json");
  t.is(edit.symbol.id, label.id);
  t.deepEqual(edit.symbol.aliases, ["Entry", "RandomByte"]);
  t.deepEqual(store.loadTable("labels"), [label]);
  writeResearchDocument(root, edit.path, edit.document, edit.expectedSha256);
  store.transaction(() => store.synchronizeResearchInputs(read()));
  t.is(store.loadTable("labels")[0]!.sourceName, "NextRandomByte");
  t.throws(
    () =>
      renameResearchSymbol(
        read(),
        { ...identity, currentName: "NextRandomByte" },
        "Reserved",
        ".uttori/research/new.json",
        ["reserved"],
      ),
    { message: /already used/ },
  );
});

test("aliases, presentation suppression and entry-point removal are independent Git choices", (t) => {
  const { root, store, read } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const alias = changeResearchSymbol(read(), label.id, { kind: "aliases", aliases: ["OldRandom"] });
  writeResearchDocument(root, alias.path, alias.document, alias.expectedSha256);
  const suppress = changeResearchSymbol(read(), label.id, {
    kind: "suppression",
    suppressed: true,
  });
  t.deepEqual(suppress.symbol.aliases, ["OldRandom"]);
  t.deepEqual(suppress.symbol.evidence, label.evidence);
  t.is(suppress.symbol.analysisEntryPoint, undefined);
  writeResearchDocument(root, suppress.path, suppress.document, suppress.expectedSha256);
  const entry = changeResearchSymbol(read(), label.id, { kind: "entry-point", enabled: false });
  t.true(entry.symbol.suppressed);
  t.is(entry.symbol.sourceName, "RandomByte");
  t.false(entry.symbol.analysisEntryPoint);
  t.deepEqual(
    store.loadTable("labels"),
    [label],
    "Preparing and saving declarations never authors SQLite directly",
  );
  t.throws(
    () => changeResearchSymbol(read(), label.id, { kind: "aliases", aliases: ["same", "SAME"] }),
    { message: /Repeated alias/ },
  );
  t.throws(
    () => changeResearchSymbol(read(), label.id, { kind: "aliases", aliases: ["bad name"] }),
    { message: /global label/ },
  );
  t.throws(
    () => changeResearchSymbol(read(), "unknown", { kind: "suppression", suppressed: true }),
    { message: /existing label/ },
  );
});

test("Git analysis decisions preserve provenance, project only after saving, and reveal imported records on removal", (t) => {
  const { root, store, read } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const original: IntervalAnnotation = {
    id: "range",
    addressSpace: "rom.file",
    start: 0,
    end: 4,
    architecture: "snes.65816",
    classification: "data8",
    evidence: ["import-1"],
  };
  store.transaction(() => {
    store.replaceTables({ annotations: [original] });
    store.publishManifest(store.manifest());
  });
  const spaces = store.manifest().addressSpaces;
  const file = read().files[0];
  const first = changeResearchAnalysis(
    read(),
    {
      kind: "put",
      expectedDocumentSha256: file.sha256,
      path: file.path,
      collection: "annotations",
      value: {
        ...original,
        classification: "opcode",
        state: { e: false, m: true, x: false },
        points: ["in"],
      },
      reason: "Captured dispatch reaches this instruction with native 8-bit A and 16-bit X.",
    },
    spaces,
  );
  t.deepEqual(store.loadTable("annotations"), [original]);
  t.is(read().files[0].sha256, file.sha256, "proposals never save authoring files");
  writeResearchDocument(root, first.path, first.document, first.expectedSha256);
  const classified = first.document.decisions.find((item) => item.id === "range")?.value;
  if (!isAnnotation(classified)) {
    throw new Error("Expected an annotation decision.");
  }
  const second = changeResearchAnalysis(
    read(),
    {
      kind: "put",
      expectedDocumentSha256: read().files[0].sha256,
      path: file.path,
      collection: "annotations",
      value: { ...classified, state: { ...classified.state, carry: false }, evidence: [] },
      reason: "The caller clears carry before dispatch.",
    },
    spaces,
  );
  writeResearchDocument(root, second.path, second.document, second.expectedSha256);
  store.transaction(() => store.synchronizeResearchInputs(read()));
  const projected = store.loadTable("annotations")[0];
  t.deepEqual(projected.state, { e: false, m: true, x: false, carry: false });
  t.true(projected.evidence.includes("import-1"));
  t.is(projected.evidence.length, 3, "both manual reasons and the captured citation survive");
  t.throws(
    () =>
      changeResearchAnalysis(
        read(),
        {
          kind: "remove",
          collection: "annotations",
          id: "range",
          expectedDocumentSha256: file.sha256,
        },
        spaces,
      ),
    { message: /changed since selection/ },
  );
  const remove = changeResearchAnalysis(
    read(),
    {
      kind: "remove",
      collection: "annotations",
      id: "range",
      expectedDocumentSha256: read().files[0].sha256,
    },
    spaces,
  );
  writeResearchDocument(root, remove.path, remove.document, remove.expectedSha256);
  store.transaction(() => store.synchronizeResearchInputs(read()));
  t.deepEqual(store.loadTable("annotations"), [original]);
  t.is(store.loadTable("evidence").filter((item) => item.sourceId === "git-research").length, 2);
});

test("analysis research bounds, impossible state, duplicate targets and undeclared files fail before an edit", (t) => {
  const { root, store, read } = fixture();
  t.teardown(() => {
    store.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const file = read().files[0],
    spaces = store.manifest().addressSpaces;
  const base = {
    kind: "put" as const,
    expectedDocumentSha256: file.sha256,
    path: file.path,
    collection: "annotations" as const,
    reason: "Review the original instruction.",
    value: {
      id: "range",
      addressSpace: "rom.file",
      start: 0,
      end: 2,
      classification: "opcode" as const,
      architecture: "snes.65816",
      evidence: [],
    },
  };
  t.throws(
    () =>
      changeResearchAnalysis(read(), { ...base, value: { ...base.value, end: 0x1000001 } }, spaces),
    { message: /24-bit/ },
  );
  t.throws(
    () =>
      changeResearchAnalysis(
        read(),
        { ...base, value: { ...base.value, addressSpace: "other" } },
        spaces,
      ),
    { message: /declared project address space/ },
  );
  t.throws(
    () =>
      changeResearchAnalysis(
        read(),
        { ...base, value: { ...base.value, state: { e: true, m: false } } },
        spaces,
      ),
    { message: /emulation mode/ },
  );
  t.throws(() => changeResearchAnalysis(read(), { ...base, path: "../outside.json" }, spaces), {
    message: /existing research document/,
  });
  const targets = {
    kind: "put" as const,
    expectedDocumentSha256: file.sha256,
    path: file.path,
    collection: "analysis" as const,
    reason: "Decoded dispatch table.",
    value: {
      id: "targets",
      kind: "target-override" as const,
      addressSpace: "rom.file",
      address: 0,
      targets: [2, 4],
      evidence: [],
    },
  };
  t.throws(
    () =>
      changeResearchAnalysis(
        read(),
        { ...targets, value: { ...targets.value, targets: [2, 2] } },
        spaces,
      ),
    { message: /distinct indirect targets/ },
  );
  const edit = changeResearchAnalysis(read(), targets, spaces);
  writeResearchDocument(root, edit.path, edit.document, edit.expectedSha256);
  store.transaction(() => store.synchronizeResearchInputs(read()));
  t.deepEqual(
    store
      .loadTable("analysis")
      .find((item) => item.kind === "target-override" && item.id === "targets"),
    edit.document.decisions.find((item) => item.id === "targets")!.value,
  );
});
