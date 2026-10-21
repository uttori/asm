import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Run only against the preserved pre-migration checkout; never refresh expectations from migrated code. */
const root = process.env.AST_BASELINE_ROOT;
if (!root || !process.argv[2])
  throw new Error(
    "Set AST_BASELINE_ROOT to the pre-migration checkout and supply an output JSON path.",
  );
const importSource = (relative) => import(pathToFileURL(path.join(root, relative)).href);
const { Assembler } = await importSource("packages/core/src/index.ts");
const { createSnesAssemblerEnvironment } = await importSource(
  "packages/plugin-snes/src/assembler.ts",
);
const environment = await createSnesAssemblerEnvironment();
const fixture = JSON.parse(
  fs.readFileSync(new URL("./ast-b8-b10-compatibility.json", import.meta.url), "utf8"),
);
const hash = (value) => createHash("sha256").update(value).digest("hex");
for (const [file, expected] of Object.entries(fixture.sourceHashes)) {
  if (hash(fs.readFileSync(path.join(root, file))) !== expected)
    throw new Error("Baseline source identity mismatch: " + file);
}
const cases = [];
for (const { cpu, source, options } of fixture.cases) {
  const a = new Assembler({ environment, target: "snes.sfc", targetOptions: options });
  const calls = [],
    trace = [];
  const builtin = a.mathCore.callBuiltInFunction;
  a.mathCore.callBuiltInFunction = (name, args) => {
    if (name === "pc") calls.push([a.traceStage, a.currentTargetAddress]);
    return builtin(name, args);
  };
  a.setTraceListener((event) => trace.push(event));
  let error = null;
  try {
    a.assembleSource(source, "ast-snes.asm");
  } catch (cause) {
    error = {
      message: cause.message,
      name: cause.name,
      code: cause.code ?? null,
      location: cause.location ?? null,
      severity: cause.severity ?? null,
      source: { file: a.currentFile, line: a.currentLine },
      stage: a.traceStage,
    };
  }
  const bytes = a.getBinaryOutput();
  const metadata = {
    ranges: a.addressToLineMapping.serializableRanges(),
    instructions: a.addressToLineMapping.instructions,
    definitions: a.symbolDefinitions,
    references: a.symbolReferences,
    labels: [...a.labelTable.entries()],
    trace,
  };
  cases.push({
    cpu,
    source,
    options,
    result: {
      byteLength: bytes.length,
      bytesHash: hash(bytes),
      calls,
      error,
      metadataHashes: Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [key, hash(JSON.stringify(value))]),
      ),
    },
  });
  a.dispose();
}
fs.writeFileSync(process.argv[2], JSON.stringify({ ...fixture, cases }, null, 2) + "\n");
