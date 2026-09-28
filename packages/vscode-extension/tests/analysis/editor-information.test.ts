import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  canonicalDebugMapJson,
  createDebugMap,
  validateDebugMap,
} from "@uttori/asm-core/debug-map";
import type { WorkspaceConfiguration } from "vscode";

import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import {
  INFORMATION_PRESETS,
  readEditorInformationConfiguration,
} from "../../src/editor-info/configuration.js";
import {
  compileTemplate,
  informationField,
  renderInformation,
  renderTemplate,
  templateRequirements,
  type LineInformation,
} from "../../src/editor-info/format.js";
import {
  EditorInformationProvider,
  type EditorInformationHost,
} from "../../src/editor-info/provider.js";

const fixture = (t: { teardown(callback: () => void): void }) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-information-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "main.asm");
  const source =
    "lorom\norg $808000\nRAM_EASTER_EGG_COUNTER = $7E002B\nLDA.w RAM_EASTER_EGG_COUNTER & $FFFF,x\nRTS\n";
  fs.writeFileSync(file, source);
  const assembler = new Assembler();
  assembler.assembleSource(source, file);
  const output = assembler.getBinaryOutput();
  const map = createDebugMap({
    target: "snes.sfc",
    output,
    mapping: assembler.addressToLineMapping,
    sourceRoot: directory,
  });
  const plain = new Assembler(undefined, { collectSourceMetadata: false });
  plain.assembleSource(source, file);
  const plainOutput = plain.getBinaryOutput();
  assembler.dispose();
  plain.dispose();
  const outputFile = path.join(directory, "main.sfc");
  const mapFile = outputFile + ".debug.json";
  fs.writeFileSync(outputFile, output);
  fs.writeFileSync(mapFile, JSON.stringify(map));
  return { directory, file, output, map, mapFile, plainOutput };
};

test("build snapshots supply bytes and the actual masked encoder value without a disassembly project", async (t) => {
  const { directory, file, mapFile, map, output, plainOutput } = fixture(t);
  t.deepEqual(output, plainOutput, "collecting metadata cannot change output bytes");
  t.deepEqual(validateDebugMap(map, output), []);
  let discovered = 0;
  let requests = 0;
  const provider = new EditorInformationProvider({
    discoverMaps: async () => {
      discovered++;
      return [{ file: mapFile, sourceRoots: [directory] }];
    },
    projects: async () => [],
    request: async () => {
      requests++;
      throw new Error("No database required");
    },
  });
  const requirements = templateRequirements(
    INFORMATION_PRESETS.authoring.parts.map(compileTemplate),
  );
  const first = await provider.lines(file, [{ start: 4, end: 5 }], requirements, new Set());
  t.is(first.size, 2);
  const info = first.get(4)![0];
  t.is(informationField("operand_value", info), "$002B");
  t.is(informationField("output_bytes", info), "BD 2B 00");
  t.is(informationField("output_size", info), "3");
  t.is(informationField("execution_observations", info), undefined);
  t.is(informationField("operand_value", first.get(5)![0]), undefined);
  await provider.lines(file, [{ start: 5, end: 5 }], requirements, new Set());
  t.is(discovered, 1);
  t.is(requests, 0);
  t.is((await provider.lines(file, [{ start: 4, end: 4 }], requirements, new Set([file]))).size, 0);
  fs.appendFileSync(file, "; edit\n");
  provider.invalidate();
  t.is((await provider.lines(file, [{ start: 4, end: 4 }], requirements, new Set())).size, 0);
});

test("count queries are selected lazily, reused across display changes, and qualified zero counts survive", async (t) => {
  const { directory, file, mapFile, map } = fixture(t);
  const calls: string[] = [];
  const host: EditorInformationHost = {
    discoverMaps: async () => [{ file: mapFile, sourceRoots: [directory] }],
    projects: async () => [
      {
        directory,
        manifest: {
          target: map.target,
          rom: { contentSha256: map.output.sha256, contentSize: map.output.size },
          addressSpaces: [{ id: "rom.file", kind: "file" }],
        } as any,
      },
    ],
    request: async <T>(_directory: string, operation: string, { ranges }: any): Promise<T> => {
      calls.push(operation);
      return ranges.map((range: any, rangeIndex: number) => ({
        rangeIndex,
        limited: false,
        locations: [
          {
            addressSpace: "rom.file",
            address: range.outputStart,
            executionCount: 0,
            outputOffsets: [range.outputStart],
          },
          {
            addressSpace: range.addressSpace,
            address: range.start,
            executionCount: 19,
            outputOffsets: [range.outputStart],
          },
        ],
      })) as T;
    },
  };
  const provider = new EditorInformationProvider(host);
  await provider.lines(
    file,
    [{ start: 5, end: 5 }],
    { counts: false, bytes: false, state: false },
    new Set(),
  );
  t.deepEqual(calls, []);
  const infos = await provider.lines(
    file,
    [{ start: 5, end: 5 }],
    { counts: true, bytes: false, state: false },
    new Set(),
  );
  t.is(informationField("execution_counts", infos.get(5)![0]), "0 / 19");
  await provider.lines(
    file,
    [{ start: 5, end: 5 }],
    { counts: true, bytes: true, state: false },
    new Set(),
  );
  t.deepEqual(calls, ["annotationSummary"]);
});

test("template grammar hides unavailable fragments, escapes literals, bounds complete output and rejects color syntax", (t) => {
  const info: LineInformation = {
    identity: "build",
    label: "build",
    ranges: [],
    instructions: [],
    locations: [],
  };
  t.is(renderTemplate(compileTemplate("operand=${operand_value}"), info), undefined);
  t.is(renderTemplate(compileTemplate("$${output_bytes}"), info), "${output_bytes}");
  t.throws(() => compileTemplate("${output_bytes:#ff00ff}"), { message: /Unknown/ });
  t.throws(() => compileTemplate("${missing}"), { message: /Unknown/ });
  t.throws(() => compileTemplate("${operand_value"), { message: /Unclosed/ });
  t.is(renderInformation([info], [compileTemplate("a".repeat(100))], " / ", 24).length, 24);
  const alternatives = {
    ...info,
    instructions: [
      { operands: [{ expression: "x", value: 0 }] },
      { operands: [{ expression: "x", value: 0 }] },
    ],
  } as unknown as LineInformation;
  t.is(informationField("operand_value", alternatives), undefined);
});

test("preset defaults preserve explicit empty arrays and legacy off; malformed settings report once to the host", (t) => {
  const values: Record<string, unknown> = {
    "editorInfo.preset": "authoring",
    "analysis.showAnnotations": false,
  };
  const config = {
    get: (key: string, fallback: unknown) => values[key] ?? fallback,
    inspect: (key: string) => ({ workspaceFolderValue: values[key] }),
  } as unknown as WorkspaceConfiguration;
  t.false(readEditorInformationConfiguration(config).inlineEnabled);
  t.is(readEditorInformationConfiguration(config).placement, "aligned");
  t.true(templateRequirements(readEditorInformationConfiguration(config).parts).bytes);
  values["editorInfo.inline.parts"] = [];
  t.deepEqual(readEditorInformationConfiguration(config).parts, []);
  values["editorInfo.inline.parts"] = ["${unknown}"];
  const resolved = readEditorInformationConfiguration(config);
  t.is(resolved.issues.length, 1);
  t.true(templateRequirements(resolved.parts).bytes);
  values["editorInfo.inline.parts"] = [];
  values["editorInfo.inline.color"] = "#FFA65C";
  t.is(readEditorInformationConfiguration(config).color, "#FFA65C");
  values["editorInfo.inline.color"] = "invalid color";
  const invalidColor = readEditorInformationConfiguration(config);
  t.is(invalidColor.color, "editorCodeLens.foreground");
  t.regex(invalidColor.issues[0], /asm\.editorInfo\.inline\.color/);
});

test("configuration changes hide old artifacts until a successful build republishes them", async (t) => {
  const { directory, file, mapFile } = fixture(t);
  const other = fixture(t);
  const provider = new EditorInformationProvider({
    discoverMaps: async () => [
      { file: mapFile, sourceRoots: [directory] },
      { file: other.mapFile, sourceRoots: [other.directory] },
    ],
    projects: async () => [],
    request: async () => {
      throw new Error("Unexpected database request");
    },
  });
  const requirements = { counts: false, bytes: false, state: false };
  t.is((await provider.lines(file, [{ start: 4, end: 4 }], requirements, new Set())).size, 1);
  provider.configurationChanged();
  t.is((await provider.lines(file, [{ start: 4, end: 4 }], requirements, new Set())).size, 0);
  provider.buildCompleted(mapFile, directory);
  t.is((await provider.lines(file, [{ start: 4, end: 4 }], requirements, new Set())).size, 1);
  t.is(
    (await provider.lines(other.file, [{ start: 4, end: 4 }], requirements, new Set())).size,
    0,
    "building one entry point cannot restore another entry point's stale settings",
  );
  provider.buildCompleted(other.mapFile, other.directory);
  t.is((await provider.lines(other.file, [{ start: 4, end: 4 }], requirements, new Set())).size, 1);
});

test("identical source and map fingerprints in different roots retain their own file identity", async (t) => {
  const a = fixture(t);
  const b = fixture(t);
  const provider = new EditorInformationProvider({
    discoverMaps: async () =>
      [a, b].map((entry) => ({ file: entry.mapFile, sourceRoots: [a.directory, b.directory] })),
    projects: async () => [],
    request: async () => {
      throw new Error("Unexpected database request");
    },
  });
  const requirements = { counts: false, bytes: false, state: false };
  const first = await provider.lines(a.file, [{ start: 4, end: 4 }], requirements, new Set());
  const second = await provider.lines(b.file, [{ start: 4, end: 4 }], requirements, new Set());
  t.is(first.get(4)?.length, 1);
  t.is(second.get(4)?.length, 1);
  t.not(first.get(4)![0].identity, second.get(4)![0].identity);
});

test("diagnostics identify a changed dependency for every editor in its build and clear after recovery", async (t) => {
  const { directory, file, mapFile, map } = fixture(t);
  const dependency = path.join(directory, "other.asm");
  fs.writeFileSync(dependency, "; one\n");
  const bytes = fs.readFileSync(dependency);
  const { fingerprint: _fingerprint, ...payload } = map;
  const updated = {
    ...payload,
    sources: [
      ...map.sources,
      {
        id: 100,
        path: "other.asm",
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    ],
  };
  fs.writeFileSync(
    mapFile,
    JSON.stringify({
      ...updated,
      fingerprint: {
        algorithm: "sha256",
        value: createHash("sha256").update(canonicalDebugMapJson(updated)).digest("hex"),
      },
    }),
  );
  const provider = new EditorInformationProvider({
    discoverMaps: async () => [{ file: mapFile, sourceRoots: [directory] }],
    projects: async () => [],
    request: async () => {
      throw new Error("Unexpected request");
    },
  });
  t.deepEqual(await provider.diagnostics(file, new Set()), []);
  t.regex(
    (await provider.diagnostics(file, new Set([dependency]))).join("\n"),
    /Unsaved dependency:.*other\.asm/,
  );
  fs.writeFileSync(dependency, "; two\n");
  provider.invalidate();
  t.is(
    (
      await provider.lines(
        file,
        [{ start: 4, end: 5 }],
        { counts: false, bytes: false, state: false },
        new Set(),
      )
    ).size,
    0,
  );
  const changed = (await provider.diagnostics(file, new Set())).join("\n");
  t.regex(changed, /Source differs from build:.*other\.asm.*SHA-256/);
  t.regex(changed, /Build Binary/);
  fs.writeFileSync(dependency, bytes);
  provider.invalidate();
  t.deepEqual(await provider.diagnostics(file, new Set()), []);
  fs.unlinkSync(dependency);
  provider.invalidate();
  t.regex(
    (await provider.diagnostics(file, new Set())).join("\n"),
    /Source missing or unreadable: other\.asm/,
  );
  provider.configurationChanged();
  t.regex((await provider.diagnostics(file, new Set())).join("\n"), /Build settings changed/);
});

test("diagnostics explain invalid maps, missing maps and mismatched binary output", async (t) => {
  const { directory, file, mapFile, map } = fixture(t);
  const provider = new EditorInformationProvider({
    discoverMaps: async () => [{ file: mapFile, sourceRoots: [directory] }],
    projects: async () => [],
    request: async () => {
      throw new Error("Unexpected request");
    },
  });
  fs.writeFileSync(mapFile, "{");
  t.regex((await provider.diagnostics(file, new Set())).join("\n"), /Cannot load build map/);
  fs.writeFileSync(mapFile, JSON.stringify({ ...map, target: "" }));
  provider.invalidate();
  t.regex((await provider.diagnostics(file, new Set())).join("\n"), /Invalid debug map/);
  fs.writeFileSync(mapFile, JSON.stringify(map));
  fs.writeFileSync(mapFile.replace(/\.debug\.json$/, ""), "stale");
  provider.invalidate();
  t.regex(
    (await provider.diagnostics(file, new Set())).join("\n"),
    /Output differs from build map/,
  );
  fs.unlinkSync(mapFile.replace(/\.debug\.json$/, ""));
  provider.invalidate();
  t.regex((await provider.diagnostics(file, new Set())).join("\n"), /Build output is missing/);
  const missing = new EditorInformationProvider({ ...provider.host, discoverMaps: async () => [] });
  t.regex((await missing.diagnostics(file, new Set())).join("\n"), /No current build map/);
});
