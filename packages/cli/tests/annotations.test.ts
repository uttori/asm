import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "../../../tests/ava-helper.js";
import {
  applyDisassemblyAnnotationEdit,
  commitAnalysisProjectTransaction,
  loadAnalysisProjectSnapshot,
} from "@uttori/asm-disassembler";
import { runCli } from "../src/index.js";

test("friendly function names and all comment placements survive reanalysis and byte-identical regeneration", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-annotated-rom-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const rom = path.join(directory, "fixture.sfc");
  const project = path.join(directory, "analysis");
  const source = path.join(directory, "source");
  const bytes = new Uint8Array(0x40000).fill(0xff);
  // HiROM RESET calls the exact routine from the annotation workflow.
  bytes.set([0x22, 0x2c, 0x00, 0xc3, 0xdb], 0x8000);
  bytes.set([0x8b, 0xab, 0x6b], 0x3002c);
  bytes[0xfffc] = 0x00;
  bytes[0xfffd] = 0x80;
  fs.writeFileSync(rom, bytes);
  t.is(await runCli(["disassemble", rom, project, "--mapper=hirom", "--header-size=0"]), 0);
  t.is(await runCli(["analyze", project, "--rom", rom]), 0);
  t.is(await runCli(["export", project, source, "--rom", rom]), 0);
  const bankFile = path.join(source, "banks/bank-003.asm");
  t.regex(fs.readFileSync(bankFile, "utf8"), /Fn_C3002C:/);
  const snapshot = loadAnalysisProjectSnapshot(project);
  t.false(snapshot.shards.labels.some((label) => label.address === 0xc3002c));
  const applied = applyDisassemblyAnnotationEdit(snapshot, {
    addressSpace: "snes.cpu",
    address: 0xc3002c,
    labelId: "manual.apu",
    name: "APU_IPL_Bootstrap",
    comment: "Initialize communication.\nPreserve caller state.",
    inlineComment: "Bootstrap entry",
    instructionCommentId: "manual.apu.phb",
    instructionComment: "Save the data bank",
    evidenceId: "manual.apu.evidence",
    sourceId: "test.annotations",
  });
  commitAnalysisProjectTransaction(project, snapshot.revision, applied.project);
  t.is(await runCli(["analyze", project, "--rom", rom]), 0);
  t.is(await runCli(["export", project, source, "--rom", rom]), 0);
  const bank = fs.readFileSync(bankFile, "utf8");
  t.regex(
    bank,
    /; Initialize communication\.\n; Preserve caller state\.\nAPU_IPL_Bootstrap: ; Bootstrap entry/,
  );
  t.regex(bank, /PHB ; Save the data bank/);
  t.false(bank.includes("L_APU_IPL_Bootstrap:"));
  t.false(bank.includes("Fn_C3002C:"));
  t.regex(
    fs.readFileSync(path.join(source, "banks/bank-000.asm"), "utf8"),
    /JSL\.l APU_IPL_Bootstrap/,
  );
  t.is(await runCli(["verify-roundtrip", source, "--rom", rom]), 0);
  t.deepEqual(fs.readFileSync(path.join(source, "build/rebuilt.sfc")), Buffer.from(bytes));
  const first = fs.readFileSync(path.join(source, "generated-files.json"), "utf8");
  t.is(await runCli(["export", project, source, "--rom", rom]), 0);
  t.is(fs.readFileSync(path.join(source, "generated-files.json"), "utf8"), first);
  t.deepEqual(JSON.parse(fs.readFileSync(path.join(source, "annotation-report.json"), "utf8")), {
    issues: [],
  });
  const current = loadAnalysisProjectSnapshot(project);
  commitAnalysisProjectTransaction(project, current.revision, {
    manifest: current.manifest,
    shards: {
      ...current.shards,
      analysis: current.shards.analysis.filter(
        (record) => record.kind !== "cfg-node" || record.address !== 0xc3002c,
      ),
      comments: [
        ...current.shards.comments,
        {
          id: "unmapped",
          addressSpace: "snes.cpu",
          address: 0x7e0000,
          text: "Keep this unmapped note",
          evidence: [],
        },
      ],
    },
  });
  // This scenario intentionally deletes a decoded instruction. Keep the code
  // preservation guard covered before opting in to test the comment fallback.
  t.is(await runCli(["export", project, source, "--rom", rom]), 1);
  t.is(await runCli(["export", project, source, "--rom", rom, "--allow-code-regression"]), 0);
  t.regex(
    fs.readFileSync(bankFile, "utf8"),
    /; \[Instruction comment; instruction unavailable\] Save the data bank/,
  );
  const report = JSON.parse(
    fs.readFileSync(path.join(source, "annotation-report.json"), "utf8"),
  ) as { issues: Array<{ id: string; reason: string }> };
  t.deepEqual(
    report.issues.map(({ id }) => id),
    ["manual.apu.phb", "unmapped"],
  );
  t.is(loadAnalysisProjectSnapshot(project).shards.comments.length, 2);
  t.is(await runCli(["verify-roundtrip", source, "--rom", rom]), 0);
});

test("bank-local calls, jumps, and relative branches retain their encoded widths with friendly names", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-annotation-widths-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const rom = path.join(directory, "fixture.sfc");
  const project = path.join(directory, "analysis");
  const source = path.join(directory, "source");
  const bytes = new Uint8Array(0x8000).fill(0xff);
  bytes.set([0x20, 0x10, 0x80, 0xd0, 0xfb, 0x4c, 0x10, 0x80]);
  bytes[0x10] = 0x60;
  bytes[0x7ffc] = 0x00;
  bytes[0x7ffd] = 0x80;
  fs.writeFileSync(rom, bytes);
  t.is(await runCli(["disassemble", rom, project, "--mapper=lorom", "--header-size=0"]), 0);
  t.is(await runCli(["analyze", project, "--rom", rom]), 0);
  for (const [address, name] of [
    [0x008000, "MainLoop"],
    [0x008010, "ReturnHelper"],
  ] as const) {
    const snapshot = loadAnalysisProjectSnapshot(project);
    const applied = applyDisassemblyAnnotationEdit(snapshot, {
      addressSpace: "snes.cpu",
      address,
      labelId: `manual.${name}`,
      name,
      evidenceId: `manual.evidence.${name}`,
      sourceId: "test.annotations",
    });
    commitAnalysisProjectTransaction(project, snapshot.revision, applied.project);
  }
  t.is(await runCli(["export", project, source, "--rom", rom]), 0);
  const bank = fs.readFileSync(path.join(source, "banks/bank-000.asm"), "utf8");
  t.regex(bank, /JSR\.w .*ReturnHelper/);
  t.regex(bank, /JMP\.w .*ReturnHelper/);
  t.regex(bank, /BNE MainLoop/);
  t.is(await runCli(["verify-roundtrip", source, "--rom", rom]), 0);
  t.deepEqual(fs.readFileSync(path.join(source, "build/rebuilt.sfc")), Buffer.from(bytes));
});
