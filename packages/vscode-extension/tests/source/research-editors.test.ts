import type { IntervalAnnotation } from "@uttori/asm-disassembler";
import { sourceContentHash } from "@uttori/asm-disassembler/source-project";
import type { SourceResearchResult, SourceResearchRequest } from "@uttori/asm-workflows/source";

import { test } from "../../../../tests/ava-helper.js";
import {
  SourceProcessClient,
  type SourceProcessOperation,
  type SourceProcessOptions,
} from "../../src/source/process-client.js";
import { document, host, pick, resetHost, type Pick } from "../helpers/editor-host.js";

const { editSourceResearch } = await import("../../src/source/research-editor.js");
const { editAnalysisResearch } = await import("../../src/source/analysis-editor.js");
const { Uri, Range, WorkspaceEdit } = await import("vscode");
const root = "/project";
const declaration = "research/native.json";
const before = '{"version":1}\n';
const sha256 = sourceContentHash(before);
const context = () => ({ root, buffers: [{ path: declaration, bytes: Buffer.from(before) }] });
const symbol = {
  id: "start",
  name: "Start",
  path: declaration,
  addressSpace: "snes.cpu",
  address: 0xc00000,
  aliases: ["Boot"],
  suppressed: false,
  entryPoint: false,
};
const range: IntervalAnnotation = {
  id: "code",
  addressSpace: "snes.cpu",
  architecture: "snes.65816",
  start: 0xc00000,
  end: 0xc00010,
  classification: "opcode",
  evidence: ["capture"],
};
type Selection = Extract<SourceResearchResult, { kind: "analysis" }>;
const selection = (): Selection => ({
  kind: "analysis",
  documents: [{ path: declaration, sha256 }],
  addressSpaces: [
    { id: "snes.cpu", name: "CPU", kind: "cpu", addressBits: 24 },
    { id: "rom", name: "ROM", kind: "file", addressBits: 24 },
    { id: "nes.cpu", name: "NES", kind: "cpu", addressBits: 16 },
  ],
  records: [
    { path: declaration, collection: "annotations", value: range },
    {
      path: declaration,
      collection: "analysis",
      value: {
        id: "targets",
        addressSpace: "snes.cpu",
        kind: "target-override",
        address: 0xc00010,
        targets: [0xc00000],
        evidence: ["capture"],
      },
    },
  ],
});

/** Keep production reply validation while replacing only child-process transport. */
function worker(reply: SourceResearchResult) {
  const client = new SourceProcessClient("unused-worker.mjs");
  const requests: SourceResearchRequest[] = [];
  let onEdit: (() => void) | undefined;
  client.run = new Proxy(client.run, {
    async apply(
      _target,
      _this,
      [operation, options]: [
        SourceProcessOperation,
        SourceProcessOptions & { readResult?: (value: unknown) => unknown },
      ],
    ) {
      if (operation.action !== "research") {
        throw new Error("Unexpected operation.");
      }
      const request = operation.research;
      let result = reply;
      if (request && "change" in request && request.change) {
        requests.push(request);
        onEdit?.();
        result = {
          kind: "edit",
          path: declaration,
          beforeSha256: sha256,
          before,
          after: '{"version":1,"edited":true}\n',
        };
      }
      return options.readResult ? options.readResult(result) : result;
    },
  });
  return {
    client,
    requests,
    beforeEdit(callback: () => void) {
      onEdit = callback;
    },
  };
}

test.beforeEach(() => {
  resetHost();
  document(`${root}/${declaration}`, before, "json");
});

test.serial(
  "symbol research edits preserve overlays and apply only after content and project checks",
  async (t) => {
    const service = worker({ kind: "symbols", symbols: [symbol] });
    for (const [action, expected] of [
      ["Edit Aliases", { kind: "aliases", aliases: ["Boot", "Main"] }],
      ["Suppress Generated Name", { kind: "suppression", suppressed: true }],
      ["Add Analysis Entry Point", { kind: "entry-point", enabled: true }],
    ] as const) {
      host.picks = [pick("Start"), pick(action)];
      host.inputs = [" Boot, , Main "];
      const result = await editSourceResearch(service.client, context);
      t.is(result?.kind, "edit");
      t.deepEqual(service.requests.at(-1), { symbolId: "start", change: expected });
      t.is(host.edits.at(-1)?.size, 1);
      t.is(host.documents[0].getText(), before);
    }
    host.picks = [pick("Start"), pick("Open Declaration")];
    t.is((await editSourceResearch(service.client, context))?.kind, "symbols");
    t.is(host.shown.at(-1)?.toString(), Uri.file(`${root}/${declaration}`).toString());
    for (const picks of [[], [pick("Start")], [pick("Start"), pick("Edit Aliases")]]) {
      host.picks = picks;
      host.inputs = [];
      const edits = host.edits.length;
      t.is(await editSourceResearch(service.client, context), undefined);
      t.is(host.edits.length, edits);
    }
    const request: SourceResearchRequest = {
      symbolId: "start",
      change: { kind: "entry-point", enabled: false },
    };
    host.trusted = false;
    await t.throwsAsync(editSourceResearch(service.client, context, request), {
      message: /trusted/,
    });
    host.trusted = true;
    await t.throwsAsync(
      editSourceResearch(service.client, () => undefined, request),
      { message: /Select/ },
    );
    let current = root;
    service.beforeEdit(() => {
      current = "/other";
    });
    await t.throwsAsync(
      editSourceResearch(service.client, () => ({ ...context(), root: current }), request),
      { message: /changed/ },
    );
    service.beforeEdit(() => {
      document(`${root}/unrelated.json`, "{}");
    });
    document(`${root}/${declaration}`, "other");
    // The first open buffer owns this URI; changing it invalidates the worker's content hash.
    const original = host.documents.shift();
    await t.throwsAsync(editSourceResearch(service.client, context, request), {
      message: /changed/,
    });
    if (!original) {
      throw new Error("Missing fixture document.");
    }
    host.documents.unshift(original);
    host.acceptEdit = false;
    await t.throwsAsync(editSourceResearch(service.client, context, request), {
      message: /rejected/,
    });
    service.client.dispose();
  },
);

test.serial(
  "source rename narrows declarations to the selected root and preserves cancellation",
  async (t) => {
    const service = worker({ kind: "symbols", symbols: [symbol] });
    const source = document(`${root}/main.asm`, "Start: nop");
    const info = (name: string, uri = source.uri) => ({
      name,
      location: { uri, range: new Range(0, 0, 0, 5) },
    });
    const rename = new WorkspaceEdit();
    rename.replace(source.uri, new Range(0, 0, 0, 5), "Main");
    host.commandResults.set("vscode.executeWorkspaceSymbolProvider", [
      info("Other"),
      info("Start", Uri.file("/other/main.asm")),
      info("Start", source.uri.with({ scheme: "virtual" })),
      info("Start"),
    ]);
    host.commandResults.set("vscode.executeDocumentRenameProvider", rename);
    for (const name of [undefined, "Start", "Main"]) {
      host.picks = [pick("Start"), pick("Rename Source Symbol…")];
      host.inputs = [name];
      const result = await editSourceResearch(service.client, context);
      t.is(result?.kind, name === "Main" ? "symbols" : undefined);
    }
    t.is(host.edits.length, 1);
    const validator = host.prompts.find((item) => item.title === "Rename Start")?.validateInput;
    t.truthy(validator?.("bad name"));
    t.is(validator?.("Main_2"), undefined);
    host.commandResults.set("vscode.executeWorkspaceSymbolProvider", [
      info("Start"),
      info("Start"),
    ]);
    host.picks = [pick("Start"), pick("Rename Source Symbol…")];
    t.is(await editSourceResearch(service.client, context), undefined);
    host.picks = [pick("Start"), pick("Rename Source Symbol…"), pick("Start")];
    host.inputs = ["Main"];
    host.acceptEdit = false;
    await t.throwsAsync(editSourceResearch(service.client, context), { message: /rejected/ });
    host.commandResults.set("vscode.executeDocumentRenameProvider", new WorkspaceEdit());
    host.picks = [pick("Start"), pick("Rename Source Symbol…"), pick("Start")];
    host.inputs = ["Main"];
    await t.throwsAsync(editSourceResearch(service.client, context), {
      message: /cannot be renamed/,
    });
    host.commandResults.delete("vscode.executeWorkspaceSymbolProvider");
    host.picks = [pick("Start"), pick("Rename Source Symbol…")];
    await t.throwsAsync(editSourceResearch(service.client, context), {
      message: /No current source declaration/,
    });
    service.client.dispose();
  },
);

/** Assert the persisted change rather than relying on which picker branch ran. */
function changed(service: ReturnType<typeof worker>) {
  const request = service.requests.at(-1);
  if (
    !request ||
    !("kind" in request) ||
    request.kind !== "analysis" ||
    request.change?.kind !== "put"
  ) {
    throw new Error("Expected an analysis put.");
  }
  return request.change;
}

test.serial(
  "analysis classification, targets, removal and open retain original identity and document revision",
  async (t) => {
    const service = worker(selection());
    host.picks = [pick("code"), pick("Edit classification"), pick("data16")];
    host.inputs = ["Observed table"];
    await editAnalysisResearch(service.client, context);
    t.deepEqual(changed(service), {
      kind: "put",
      collection: "annotations",
      expectedDocumentSha256: sha256,
      path: declaration,
      value: { ...range, classification: "data16" },
      reason: "Observed table",
    });
    for (const targets of ["$C00000, 0xc00002, 12", ""]) {
      host.picks = [pick("targets"), pick("Edit targets")];
      host.inputs = [targets, "Dispatch trace"];
      await editAnalysisResearch(service.client, context);
      const value = changed(service).value;
      t.deepEqual(
        "targets" in value ? value.targets : undefined,
        targets ? [0xc00000, 0xc00002, 12] : [],
      );
    }
    const validator = host.prompts.find(
      (item) => item.title === "Indirect targets · targets",
    )?.validateInput;
    t.truthy(validator?.("bad"));
    t.falsy(validator?.(""));
    t.is(validator?.("$10, 20"), undefined);
    for (const id of ["code", "targets"]) {
      host.picks = [pick(id), pick("Remove Research Override")];
      await editAnalysisResearch(service.client, context);
      t.deepEqual(service.requests.at(-1), {
        kind: "analysis",
        change: {
          kind: "remove",
          expectedDocumentSha256: sha256,
          collection: id === "code" ? "annotations" : "analysis",
          id,
        },
      });
    }
    host.picks = [pick("code"), pick("Open Declaration")];
    t.is((await editAnalysisResearch(service.client, context))?.kind, "analysis");
    t.is(host.shown.at(-1)?.toString(), Uri.file(`${root}/${declaration}`).toString());
    for (const picks of [
      [],
      [pick("code")],
      [pick("code"), pick("Edit classification")],
      [pick("targets"), pick("Edit targets")],
    ]) {
      host.picks = picks;
      host.inputs = [];
      const count = service.requests.length;
      t.is(await editAnalysisResearch(service.client, context), undefined);
      t.is(service.requests.length, count);
    }
    service.client.dispose();
  },
);

test.serial(
  "CPU assumptions enforce emulation width and preserve or remove individual register hints",
  async (t) => {
    const state = {
      e: false,
      m: false,
      x: false,
      carry: true,
      programBank: 0xc0,
      dataBank: 0x7e,
      directPage: 0x100,
      stackPointer: 0x1ff,
    };
    const initial = selection();
    const service = worker({
      ...initial,
      records: [{ path: declaration, collection: "annotations", value: { ...range, state } }],
    });
    const hint = { action: "state" as const, ids: [range.id] };
    for (const [field, choice, key, expected] of [
      ["E · emulation mode", "Emulation (8-bit M/X)", "e", true],
      ["E · emulation mode", "Native", "e", false],
      ["M · accumulator width", "8-bit", "m", true],
      ["X · index width", "16-bit", "x", false],
      ["Carry", "Clear", "carry", false],
      ["Carry", "Unknown · remove this assumption", "carry", undefined],
    ] as const) {
      host.picks = [pick(field), pick(choice)];
      host.inputs = ["CPU observation"];
      await editAnalysisResearch(service.client, context, undefined, hint);
      const value = changed(service).value;
      if (!("state" in value) || !value.state) {
        throw new Error("Expected CPU state.");
      }
      t.deepEqual(Reflect.get(value.state, key), expected);
      if (key === "e" && expected) {
        t.deepEqual(value.state, { ...state, e: true, m: true, x: true });
      }
    }
    for (const [field, key, maximum] of [
      ["Program bank", "programBank", "$FF"],
      ["Data bank", "dataBank", "$FF"],
      ["Direct page", "directPage", "$FFFF"],
      ["Stack pointer", "stackPointer", "$FFFF"],
    ] as const) {
      for (const input of [maximum, ""]) {
        host.picks = [pick(field)];
        host.inputs = [input, "CPU observation"];
        await editAnalysisResearch(service.client, context, undefined, hint);
        const value = changed(service).value;
        if (!("state" in value) || !value.state) {
          throw new Error("Expected CPU state.");
        }
        t.deepEqual(
          Reflect.get(value.state, key),
          input ? Number(input.replace("$", "0x")) : undefined,
        );
        const validate = host.prompts.at(-2)?.validateInput;
        t.truthy(validate?.("$10000"));
        t.falsy(validate?.(""));
        t.is(validate?.("$00"), undefined);
      }
    }
    for (const picks of [[], [pick("Carry")], [pick("Direct page")]]) {
      host.picks = picks;
      host.inputs = [];
      t.is(await editAnalysisResearch(service.client, context, undefined, hint), undefined);
    }
    host.picks = [pick("Direct page")];
    host.inputs = ["invalid"];
    await t.throwsAsync(editAnalysisResearch(service.client, context, undefined, hint), {
      message: /Invalid CPU register/,
    });
    service.client.dispose();
  },
);

test.serial(
  "new analysis ranges and NES indirect targets retain physical mapping identity",
  async (t) => {
    const service = worker(selection());
    host.picks = [pick("Classify a Range…"), pick(declaration), pick("ROM"), pick("graphics")];
    host.inputs = ["$100", "$110", "snes.65816", "Graphics evidence"];
    await editAnalysisResearch(service.client, context, undefined, {
      action: "classification",
      ids: [],
      range: { start: 0x100, end: 0x110 },
    });
    const value = changed(service).value;
    t.deepEqual(value, {
      id: "manual.range.rom.100.110",
      addressSpace: "rom",
      architecture: "snes.65816",
      start: 0x100,
      end: 0x110,
      classification: "graphics",
      evidence: [],
    });
    const mapping = { state: { prgMode: 0, r6: 2, r7: 3 }, fileOffset: 0x1000 };
    host.picks = [pick("Set Indirect Targets…"), pick(declaration), pick("NES")];
    host.inputs = ["$8000", JSON.stringify(mapping), "$9000", "Banked trace"];
    await editAnalysisResearch(service.client, context);
    const target = changed(service).value;
    t.deepEqual(target.mapping, mapping);
    t.true(target.id.startsWith("manual.targets.nes.cpu.8000."));
    t.is(changed(service).collection, "analysis");
    const validate = host.prompts.find(
      (item) => item.title === "Original NES mapper selection",
    )?.validateInput;
    t.truthy(validate?.("{"));
    t.truthy(validate?.("{}"));
    t.is(validate?.(JSON.stringify(mapping)), undefined);
    for (const title of ["Range start", "Range end (exclusive)"]) {
      const check = host.prompts.find((item) => item.title === title)?.validateInput;
      t.truthy(check?.("invalid"));
      t.truthy(check?.("$FFFFFFFF"));
      t.is(check?.("$10"), undefined);
    }
    t.truthy(host.prompts.find((item) => item.title === "Architecture")?.validateInput?.(" "));
    t.truthy(
      host.prompts
        .find((item) => item.title === "Reason for the research decision")
        ?.validateInput?.(" "),
    );
    service.client.dispose();
  },
);

test.serial(
  "analysis creation cancellation and stale project selection never publish an edit",
  async (t) => {
    const service = worker(selection());
    const picks: (Pick | undefined)[] = [
      pick("Classify a Range…"),
      pick(declaration),
      pick("CPU"),
      pick("data8"),
    ];
    for (const [pickCount, inputs] of [
      [1, []],
      [2, []],
      [3, []],
      [3, ["$10"]],
      [3, ["$10", "$20"]],
      [3, ["$10", "$20", "snes.65816"]],
      [4, ["$10", "$20", "snes.65816"]],
    ] as const) {
      host.picks = picks.slice(0, pickCount);
      host.inputs = [...inputs];
      t.is(await editAnalysisResearch(service.client, context), undefined);
      t.is(service.requests.length, 0);
    }
    let reads = 0;
    host.picks = [pick("code"), pick("Remove Research Override")];
    await t.throwsAsync(
      editAnalysisResearch(service.client, () => (++reads === 1 ? context() : undefined)),
      { message: /changed/ },
    );
    host.trusted = false;
    await t.throwsAsync(editAnalysisResearch(service.client, context), { message: /trusted/ });
    service.client.dispose();
  },
);
