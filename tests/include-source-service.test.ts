import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "./ava-helper.js";
import { MemoryAssemblyFileProvider } from "../packages/core/src/file-provider.js";
import {
  IncludeSourceService,
  type IncludeSourceHost,
} from "../packages/core/src/services/include-source-service.js";
import { Assembler } from "./test-assembler.js";

const createHost = (
  files: Record<string, string | Uint8Array>,
  currentFile = "/proj/main.asm",
  currentMacroSourceFile?: string,
  followIncludes = true,
): IncludeSourceHost & {
  edges: Array<[string, string]>;
  executedFiles: string[];
  parsedSources: string[];
} => {
  const host = {
    currentFile,
    currentMacroSourceFile,
    includePaths: ["/proj"],
    includeStack: [],
    includedFiles: new Map(),
    followIncludes,
    fileProvider: new MemoryAssemblyFileProvider(files),
    edges: [] as Array<[string, string]>,
    executedFiles: [] as string[],
    parsedSources: [] as string[],
    programModelBuilder: {
      createIncludeNode: (file: string, source: string) => {
        host.parsedSources.push(source);
        return {
          type: "include" as const,
          file,
          commands: [],
        };
      },
    } as IncludeSourceHost["programModelBuilder"],
    lowerAndExecuteRuntimeNodes: () => {
      host.executedFiles.push(host.currentFile);
    },
    recordIncludeEdge: (fromFile: string, toFile: string) => {
      host.edges.push([fromFile, toFile]);
    },
  };
  return host;
};

test("include source service resolves incsrc relative to the defining macro file", (t) => {
  const host = createHost(
    {
      "/proj/main.asm": "",
      "/proj/snes.asm": "db $01",
    },
    "/proj/main.asm",
    "/proj/game/rommap.asm",
  );
  const service = new IncludeSourceService(host);

  t.is(service.resolveIncludePath("../snes.asm"), "/proj/snes.asm");
});

test("include source service reads binary and text files relative to source", (t) => {
  const host = createHost({
    "/proj/main.asm": "",
    "/proj/data.bin": new Uint8Array([0x01, 0x02]),
    "/proj/text.asm": "db $01",
  });
  const service = new IncludeSourceService(host);

  t.deepEqual(service.readFile("data.bin"), new Uint8Array([0x01, 0x02]));
  t.is(service.readFile("text.asm", "utf8"), "db $01");
  t.is(service.resolveIncludePath('"text.asm"'), "/proj/text.asm");
});

test("include source service marks, executes, records, and restores includes", (t) => {
  const host = createHost({
    "/proj/main.asm": "",
    "/proj/child.asm": "db $01",
  });
  const service = new IncludeSourceService(host);

  service.includeFile("child.asm");

  t.deepEqual(host.edges, [["/proj/main.asm", "/proj/child.asm"]]);
  t.deepEqual(host.executedFiles, ["/proj/child.asm"]);
  t.deepEqual(host.includedFiles.get("/proj/child.asm"), { included: true, guarded: false });
  t.is(host.currentFile, "/proj/main.asm");
  t.deepEqual(host.includeStack, []);
});

test("include source service memoizes text within one assembly snapshot", (t) => {
  const host = createHost({
    "/proj/main.asm": "",
    "/proj/child.asm": "db $01",
  });
  const service = new IncludeSourceService(host);

  service.beginAssemblySnapshot();
  service.assembleFile("child.asm");
  service.assembleFile("child.asm");

  t.deepEqual(host.parsedSources, ["db $01", "db $01"]);

  host.fileProvider = new MemoryAssemblyFileProvider({
    "/proj/main.asm": "",
    "/proj/child.asm": "db $02",
  });
  service.beginAssemblySnapshot();
  service.assembleFile("child.asm");

  t.deepEqual(host.parsedSources, ["db $01", "db $01", "db $02"]);
});

test("include source service enforces and resets include guards", (t) => {
  const host = createHost(
    {
      "/proj/main.asm": "",
      "/proj/child.asm": "db $01",
    },
    "/proj/child.asm",
  );
  const service = new IncludeSourceService(host);

  service.guardCurrentFile();
  host.currentFile = "/proj/main.asm";
  service.assembleFile("child.asm");
  t.deepEqual(host.executedFiles, []);

  service.resetGuards();
  service.assembleFile("child.asm");
  t.deepEqual(host.executedFiles, ["/proj/child.asm"]);
});

test("include source service records an edge without parsing when followIncludes is false", (t) => {
  const host = createHost(
    {
      "/proj/main.asm": "",
      "/proj/child.asm": "db $01",
    },
    "/proj/main.asm",
    undefined,
    false,
  );
  const service = new IncludeSourceService(host);

  service.assembleFile("child.asm");

  t.deepEqual(host.edges, [["/proj/main.asm", "/proj/child.asm"]]);
  t.deepEqual(host.executedFiles, []);
  t.deepEqual(host.parsedSources, []);
  t.is(host.currentFile, "/proj/main.asm");
  t.deepEqual(host.includeStack, []);
});

test("include source service rejects cycles and excessive nesting", (t) => {
  const host = createHost({
    "/proj/main.asm": "",
    "/proj/child.asm": "",
  });
  const service = new IncludeSourceService(host);

  t.throws(() => service.assembleFile("main.asm"), {
    message: "Recursive include detected for '/proj/main.asm'",
  });

  host.includeStack = Array.from({ length: 512 }, (_, index) => `/proj/file-${index}.asm`);
  t.throws(() => service.assembleFile("child.asm"), {
    message: "Recursion limit exceeded (512 levels)",
  });
});

test("include source service restores source state after read failures", (t) => {
  const host = createHost({
    "/proj/main.asm": "",
    "/proj/child.asm": "",
  });
  host.fileProvider.readTextFile = () => {
    throw new Error("read failed");
  };
  const service = new IncludeSourceService(host);

  t.throws(() => service.assembleFile("child.asm"), {
    message: "Failed to assemble include '/proj/child.asm': read failed",
  });
  t.is(host.currentFile, "/proj/main.asm");
  t.deepEqual(host.includeStack, []);
});

test("incsrc inside a nested macro is relative to the defining file", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "snes-asm-macro-incsrc-"));
  try {
    fs.mkdirSync(path.join(root, "Global"), { recursive: true });
    fs.mkdirSync(path.join(root, "SMRPG", "RomMap"), { recursive: true });
    const mainPath = path.join(root, "AssembleFile.asm");
    fs.writeFileSync(
      mainPath,
      ['incsrc "Global/Global_Macros.asm"', "%InitializeROM()", ""].join("\n"),
    );
    fs.writeFileSync(
      path.join(root, "Global", "Global_Macros.asm"),
      [
        "macro InitializeROM()",
        '  incsrc "../SMRPG/RomMap/ROM_Map.asm"',
        "  %LoadFiles()",
        "endmacro",
        "",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(root, "SMRPG", "RomMap", "ROM_Map.asm"),
      ["macro LoadFiles()", "  incsrc ../SNES_Macros.asm", "endmacro", ""].join("\n"),
    );
    fs.writeFileSync(path.join(root, "SMRPG", "SNES_Macros.asm"), "db $42\n");

    const assembler = new Assembler();
    assembler.setIncludePaths(["./", path.join(root, "Global"), path.join(root, "SMRPG")]);
    assembler.setCurrentFile(mainPath);
    const source = fs.readFileSync(mainPath, "utf8");
    for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
      assembler.activateStage(stage);
      assembler.setWritePosition(0x808000);
      for (const [lineNumber, line] of source.split("\n").entries()) {
        assembler.setCurrentLine(lineNumber);
        assembler.processCommand(line.trim());
      }
      assembler.finishPass();
    }

    t.is(
      assembler.macros.get("LoadFiles")?.sourceFile,
      path.join(root, "SMRPG", "RomMap", "ROM_Map.asm"),
    );
    t.deepEqual(Array.from(assembler.getBinaryOutput()), [0x42]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
