import { createHash } from "node:crypto";
import fs from "node:fs";

import { Assembler } from "@uttori/asm-core";

import { test } from "../../../tests/ava-helper.js";
import {
  create65xxAssemblerEnvironment,
  Arch65xx,
  nmos6502Cpu,
  hudsonHuC6280Cpu,
  mitsubishiM740Cpu,
  RAW_65XX_TARGET_ID,
} from "../src/index.js";
import { assertTyped65xx } from "./helpers/typed-execution.js";

const environment = await create65xxAssemblerEnvironment();
interface CompatibilityCase {
  cpu: string;
  source: string;
  target: string;
  result: unknown;
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isCase = (value: unknown): value is CompatibilityCase =>
  isRecord(value) &&
  typeof value.cpu === "string" &&
  typeof value.source === "string" &&
  typeof value.target === "string" &&
  isRecord(value.result);
const fixture: unknown = JSON.parse(
  fs.readFileSync(new URL("./fixtures/ast-b7-compatibility.json", import.meta.url), "utf8"),
);
if (!isRecord(fixture) || !Array.isArray(fixture.cases) || !fixture.cases.every(isCase)) {
  throw new Error("Invalid frozen 65xx compatibility fixture.");
}

/** Hash full metadata independently of byte/effect/error assertions to keep the frozen corpus bounded. */
const hash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

for (const [index, entry] of fixture.cases.entries()) {
  test(`typed 65xx retains pre-B7 behavior ${index + 1}: ${entry.cpu} ${entry.source.split("\n").at(-1)}`, (t) => {
    const assembler = new Assembler({
      environment,
      target: entry.target,
      architecture: entry.cpu,
      targetOptions: { origin: 0x8000 },
    });
    t.teardown(() => assembler.dispose());
    const calls: [string, number][] = [];
    const trace: unknown[] = [];
    const builtin = assembler.mathCore.callBuiltInFunction;
    assembler.mathCore.callBuiltInFunction = (name, args) => {
      if (name === "pc") {
        calls.push([assembler.traceStage, assembler.currentTargetAddress]);
      }
      return builtin(name, args);
    };
    assembler.setTraceListener((event) => trace.push(event));
    let error: { message: string; stage: string } | null = null;
    assertTyped65xx(assembler, () => {
      try {
        assembler.assembleSource("org $8000\n" + entry.source, "ast-65xx.asm");
      } catch (cause) {
        if (!(cause instanceof Error)) {
          throw cause;
        }
        error = { message: cause.message, stage: assembler.traceStage };
      }
    });
    t.deepEqual(
      {
        bytes: [...assembler.getBinaryOutput()],
        calls,
        error,
        metadataHashes: {
          ranges: hash(assembler.addressToLineMapping.serializableRanges()),
          instructions: hash(assembler.addressToLineMapping.instructions),
          definitions: hash(assembler.symbolDefinitions),
          labels: hash([...assembler.labelTable.entries()]),
          trace: hash(trace),
        },
      },
      {
        ...entry.result,
        // B11 adds exact ranges and excludes register pseudo-references. Encoding, diagnostics,
        // layout and trace still compare with the untouched pre-migration oracle.
        metadataHashes: Object.fromEntries(
          Object.entries(entry.result.metadataHashes).filter(([key]) => key !== "references"),
        ),
      },
      entry.source,
    );
  });
}

for (const [cpu, source, expected] of [
  [nmos6502Cpu, "lda #$12\nbne +\nnop\n+", [0xa9, 0x12, 0xd0, 1, 0xea]],
  [hudsonHuC6280Cpu, "tii $1234,$5678,$abcd", [0x73, 0x34, 0x12, 0x78, 0x56, 0xcd, 0xab]],
  [mitsubishiM740Cpu, "jsr $ff12", [0x22, 0x12]],
] as const) {
  test(`public word encoder delegates to typed selection: ${cpu.id}`, (t) => {
    const assembler = new Assembler({
      environment,
      target: RAW_65XX_TARGET_ID,
      architecture: cpu.id,
      targetOptions: { origin: 0x8000 },
    });
    t.teardown(() => assembler.dispose());
    const encoder = new Arch65xx(
      {
        operands: {
          getnum: (expression) => assembler.operandResolver.getnum(expression),
          getCurrentAddress: () => assembler.currentTargetAddress,
        },
        emission: {
          write1: (value) => assembler.write1(value),
          write2: (value) => assembler.write2(value),
          write3: (value) => assembler.write3(value),
          writeByte: (value) => assembler.write1(value),
          writeBytes: (values) => assembler.outputWriter.writeBytes(values),
          writeValue: (value, width, endian) =>
            assembler.outputWriter.writeValue(value, width, endian),
        },
        sizing: { getCurrentAddress: () => assembler.currentTargetAddress },
        branches: {
          enforceResolvedLabels: () => assembler.enforceResolvedLabels,
          findNextLabel: (name, address) => assembler.symbolScope.findNextLabel(name, address),
          findPreviousLabel: (name, address) =>
            assembler.symbolScope.findPreviousLabel(name, address),
        },
        diagnostics: { error: (message) => new Error(message) },
      },
      cpu,
    );
    assembler.assembleSource("org $8000\n" + source);
    // Exercise the public source facade against the same final symbol table and output origin.
    assembler.outputBytes = [];
    assembler.setWritePosition(0x8000);
    for (const line of source.split("\n")) {
      if (line === "+") {
        continue;
      }
      t.true(encoder.encode(line.split(/\s+/)));
    }
    t.deepEqual([...assembler.getBinaryOutput()], [...expected]);
    t.true(encoder.getInstructionCatalog().length > 0);
    t.is(encoder.estimateSize([]), 0);
    t.true(encoder.encode([]));
  });
}
