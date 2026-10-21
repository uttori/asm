import { createHash } from "node:crypto";
import fs from "node:fs";

import { Assembler } from "@uttori/asm-core";
import { copySyntaxValue } from "@uttori/asm-core/plugin";

import { test } from "../../../tests/ava-helper.js";
import { createSnesAssemblerEnvironment } from "../src/assembler.js";
import { assertTypedSnes } from "./helpers/typed-execution.js";

const environment = await createSnesAssemblerEnvironment();
interface CompatibilityCase {
  cpu: string;
  source: string;
  options: Record<string, unknown>;
  result: unknown;
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isCase = (value: unknown): value is CompatibilityCase =>
  record(value) &&
  typeof value.cpu === "string" &&
  typeof value.source === "string" &&
  record(value.options) &&
  record(value.result);
const fixture: unknown = JSON.parse(
  fs.readFileSync(new URL("./fixtures/ast-b8-b10-compatibility.json", import.meta.url), "utf8"),
);
if (!record(fixture) || !Array.isArray(fixture.cases) || !fixture.cases.every(isCase)) {
  throw new Error("Invalid frozen SNES compatibility fixture.");
}
/** Full output is hashed so zero-filled origins do not inflate the checked-in fixture. */
const hash = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
for (const [index, entry] of fixture.cases.entries()) {
  test(`typed SNES compatibility ${index + 1}: ${entry.cpu} ${entry.source.split("\n").at(-1)}`, (t) => {
    const assembler = new Assembler({
      environment,
      target: "snes.sfc",
      targetOptions: entry.options,
    });
    t.teardown(() => assembler.dispose());
    const calls: [string, number][] = [],
      trace: unknown[] = [];
    const builtin = assembler.mathCore.callBuiltInFunction;
    assembler.mathCore.callBuiltInFunction = (name, args) => {
      if (name === "pc") {
        calls.push([assembler.traceStage, assembler.currentTargetAddress]);
      }
      return builtin(name, args);
    };
    assembler.setTraceListener((event) => trace.push(event));
    let error: unknown = null;
    assertTypedSnes(assembler, () => {
      try {
        assembler.assembleSource(entry.source, "ast-snes.asm");
      } catch (cause) {
        if (!(cause instanceof Error)) {
          throw cause;
        }
        error = {
          message: cause.message,
          name: cause.name,
          code: "code" in cause ? cause.code : null,
          location: "location" in cause ? (cause.location ?? null) : null,
          severity: "severity" in cause ? (cause.severity ?? null) : null,
          source: { file: assembler.currentFile, line: assembler.currentLine },
          stage: assembler.traceStage,
        };
      }
    });
    const bytes = assembler.getBinaryOutput();
    const metadata = {
      ranges: assembler.addressToLineMapping.serializableRanges(),
      instructions: assembler.addressToLineMapping.instructions,
      definitions: assembler.symbolDefinitions,
      labels: [...assembler.labelTable.entries()],
      trace,
    };
    t.deepEqual(
      {
        byteLength: bytes.length,
        bytesHash: hash(bytes),
        calls,
        error: JSON.parse(JSON.stringify(error)),
        metadataHashes: Object.fromEntries(
          Object.entries(metadata).map(([key, value]) => [key, hash(JSON.stringify(value))]),
        ),
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

for (const cpu of ["65816", "spc700", "superfx"]) {
  test(`typed ${cpu} independently expected Asar opcode vectors`, (t) => {
    const source = fs.readFileSync(
      new URL(`../../../fixtures/asar/tests/arch-${cpu}.asm`, import.meta.url),
      "utf8",
    );
    // These literal vectors predate the typed encoders and are independent of the shared opcode tables.
    const expected = Buffer.from(
      source
        .split(/\n\s*\n/)[0]
        .split("\n")
        .filter((line) => line.startsWith(";`"))
        .map((line) => line.slice(2).replace(/\s+/g, ""))
        .join(""),
      "hex",
    );
    const assembler = new Assembler({ environment, target: "snes.sfc" });
    t.teardown(() => assembler.dispose());
    assertTypedSnes(assembler, () => assembler.assembleSource(source, `arch-${cpu}.asm`));
    t.deepEqual(assembler.getBinaryOutput().slice(0, expected.length), new Uint8Array(expected));
  });
}

for (const cpu of ["65816", "spc700", "superfx"]) {
  test(`typed ${cpu} syntax is detached, immutable and portable`, (t) => {
    const grammar = environment.getArchitecture("snes." + cpu)!.operandGrammar!;
    for (const text of ["", "#$12", "($12,x)", "($12,s),y", "!operand", "a,pc()", "r1,#7"]) {
      const syntax = grammar.parse("LDA", text);
      t.true(Object.isFrozen(syntax));
      t.is(grammar.parse("LDA", text), syntax);
      t.deepEqual(copySyntaxValue(syntax), JSON.parse(JSON.stringify(syntax)));
    }
  });
}
