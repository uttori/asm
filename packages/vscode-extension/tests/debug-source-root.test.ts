import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { AddressToLineMapping, createDebugMap } from "@uttori/asm-core";

import { test } from "../../../tests/ava-helper.js";
import { resolveDebugSourceRoot } from "../src/debug-source-root.js";

test("debug source-root discovery supports a generated project opened from its parent", (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-debug-source-root-"));
  t.teardown(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const project = path.join(workspace, "disassembly");
  const source = path.join(project, "banks", "bank-003.asm");
  const program = path.join(project, "build", "rebuilt-content.sfc");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.mkdirSync(path.dirname(program), { recursive: true });
  fs.writeFileSync(source, "org $C30000\nnop\n");
  fs.writeFileSync(program, Uint8Array.of(0xea));
  const mapping = new AddressToLineMapping();
  mapping.includeByte(source, 2, "snes.65816", "snes.cpu", 0xc3_0000, 0x03_0000);

  const projectRelativeMap = createDebugMap({
    target: "snes.sfc",
    output: Uint8Array.of(0xea),
    mapping,
    sourceRoot: project,
  });
  t.is(
    resolveDebugSourceRoot({
      map: projectRelativeMap,
      configuredRoot: workspace,
      debugMapFile: `${program}.debug.json`,
      programFile: program,
      workspaceRoot: workspace,
    }),
    project,
  );

  const workspaceRelativeMap = createDebugMap({
    target: "snes.sfc",
    output: Uint8Array.of(0xea),
    mapping,
    sourceRoot: workspace,
  });
  t.is(
    resolveDebugSourceRoot({
      map: workspaceRelativeMap,
      configuredRoot: workspace,
      debugMapFile: `${program}.debug.json`,
      programFile: program,
      workspaceRoot: workspace,
    }),
    workspace,
  );
});
