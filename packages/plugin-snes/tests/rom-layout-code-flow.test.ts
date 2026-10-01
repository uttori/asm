import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import { inspectSnesSource } from "../src/disassembler/source-build.js";
import { createSnesAssemblerEnvironment } from "../src/index.js";

/** Assemble each case independently; declarations cannot invent boundaries absent from emitted instructions. */
test("movable leaf code proves width transitions, branch joins and exit contracts", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-code-flow-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const environment = await createSnesAssemblerEnvironment();
  const inspect = (
    body: string,
    size: number,
    exitState?: { e: boolean; m: boolean; x: boolean },
  ) => {
    fs.writeFileSync(
      path.join(root, "main.asm"),
      `hirom\norg $C00000\nRoutine:\n${body}\nRoutineEnd:\n`,
    );
    return inspectSnesSource({
      root,
      entrySource: "main.asm",
      environment,
      expectedSize: size,
      targetOptions: { checksumEnabled: false },
      states: [{ offset: 0, e: false, m: true, x: true }],
      placements: {
        logicalAddress: (offset) => 0xc00000 + offset,
        references: [],
        objects: [
          {
            id: "routine",
            kind: "code",
            start: 0,
            length: size,
            originalStart: 0,
            originalEnd: size,
            alignment: 1,
            bankSize: 0x10000,
            movable: true,
            referencesComplete: true,
            closedControlFlow: true,
            returnInstruction: "RTL",
            startSymbol: "Routine",
            endSymbol: "RoutineEnd",
            exitState,
          },
        ],
      },
    });
  };
  const valid = inspect("REP #$20\nLDA.w #$1234\nSEP #$20\nRTL", 8);
  t.deepEqual([...valid.output], [0xc2, 0x20, 0xa9, 0x34, 0x12, 0xe2, 0x20, 0x6b]);
  t.deepEqual(valid.diagnostics, []);
  t.deepEqual(
    inspect("REP #$20\nLDA.w #$1234\nRTL", 6, { e: false, m: false, x: true }).diagnostics,
    [],
  );
  t.true(
    inspect("REP #$20\nLDA.w #$1234\nRTL", 6).diagnostics.some((item) =>
      /exit state/.test(item.message),
    ),
  );
  t.true(
    inspect("BNE Join\nREP #$20\nJoin:\nLDA.b #$01\nRTL", 7).diagnostics.some((item) =>
      /paths disagree/.test(item.message),
    ),
  );
  t.true(
    inspect("BRA Routine+1\nRTL", 3).diagnostics.some((item) =>
      /instruction boundary/.test(item.message),
    ),
  );
  t.true(
    inspect("JMP $C00080", 3).diagnostics.some((item) => /leaves the block/.test(item.message)),
  );
  t.true(inspect("JMP ($0080)", 3).diagnostics.some((item) => /unsupported/.test(item.message)));
  t.true(inspect("db $EA\nRTL", 2).diagnostics.some((item) => /contiguous/.test(item.message)));
  t.true(inspect("RTL\nNOP", 2).diagnostics.some((item) => /reachable/.test(item.message)));
  t.deepEqual(inspect("PHA\nPLA\nRTL", 3).diagnostics, []);
  t.true(inspect("PHA\nRTL", 2).diagnostics.some((item) => /unbalanced stack/.test(item.message)));
  t.true(
    inspect("PLA\nRTL", 2).diagnostics.some((item) => /caller's saved frame/.test(item.message)),
  );
  t.true(inspect("RTS", 1).diagnostics.some((item) => /RTL convention/.test(item.message)));
  t.true(
    inspect("BNE Join\nPHA\nJoin:\nRTL", 4).diagnostics.some((item) =>
      /paths disagree/.test(item.message),
    ),
  );
});
