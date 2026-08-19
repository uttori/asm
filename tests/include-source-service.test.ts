import { test } from "./ava-helper.js";
import { createMemoryAssemblyFileProvider } from "../src/file-provider.js";
import {
  IncludeSourceService,
  type IncludeSourceHost,
} from "../src/services/include-source-service.js";

const createHost = (
  files: Record<string, string | Uint8Array>,
  currentFile = "mem:/main.asm",
): IncludeSourceHost & {
  edges: Array<[string, string]>;
  executedFiles: string[];
  parsedSources: string[];
} => {
  const host = {
    currentFile,
    currentMacroSourceFile: undefined,
    includePaths: ["mem:/"],
    includeStack: [],
    includedFiles: new Map(),
    fileProvider: createMemoryAssemblyFileProvider(files),
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

test("include source service reads binary and text files relative to source", t => {
  const host = createHost({
    "mem:/main.asm": "",
    "mem:/data.bin": new Uint8Array([0x01, 0x02]),
    "mem:/text.asm": "db $01",
  });
  const service = new IncludeSourceService(host);

  t.deepEqual(service.readFile("data.bin"), new Uint8Array([0x01, 0x02]));
  t.is(service.readFile("text.asm", "utf8"), "db $01");
  t.is(service.resolveIncludePath('"text.asm"'), "mem:/text.asm");
});

test("include source service marks, executes, records, and restores includes", t => {
  const host = createHost({
    "mem:/main.asm": "",
    "mem:/child.asm": "db $01",
  });
  const service = new IncludeSourceService(host);

  service.includeFile("child.asm");

  t.deepEqual(host.edges, [["mem:/main.asm", "mem:/child.asm"]]);
  t.deepEqual(host.executedFiles, ["mem:/child.asm"]);
  t.deepEqual(host.includedFiles.get("mem:/child.asm"), { included: true, guarded: false });
  t.is(host.currentFile, "mem:/main.asm");
  t.deepEqual(host.includeStack, []);
});

test("include source service memoizes text within one assembly snapshot", t => {
  const host = createHost({
    "mem:/main.asm": "",
    "mem:/child.asm": "db $01",
  });
  const service = new IncludeSourceService(host);

  service.beginAssemblySnapshot();
  service.assembleFile("child.asm");
  service.assembleFile("child.asm");

  t.deepEqual(host.parsedSources, ["db $01", "db $01"]);

  host.fileProvider = createMemoryAssemblyFileProvider({
    "mem:/main.asm": "",
    "mem:/child.asm": "db $02",
  });
  service.beginAssemblySnapshot();
  service.assembleFile("child.asm");

  t.deepEqual(host.parsedSources, ["db $01", "db $01", "db $02"]);
});

test("include source service enforces and resets include guards", t => {
  const host = createHost({
    "mem:/main.asm": "",
    "mem:/child.asm": "db $01",
  }, "mem:/child.asm");
  const service = new IncludeSourceService(host);

  service.guardCurrentFile();
  host.currentFile = "mem:/main.asm";
  service.assembleFile("child.asm");
  t.deepEqual(host.executedFiles, []);

  service.resetGuards();
  service.assembleFile("child.asm");
  t.deepEqual(host.executedFiles, ["mem:/child.asm"]);
});

test("include source service rejects cycles and excessive nesting", t => {
  const host = createHost({
    "mem:/main.asm": "",
    "mem:/child.asm": "",
  });
  const service = new IncludeSourceService(host);

  t.throws(() => service.assembleFile("main.asm"), {
    message: "Recursive include detected for 'mem:/main.asm'",
  });

  host.includeStack = Array.from({ length: 512 }, (_, index) => `mem:/file-${index}.asm`);
  t.throws(() => service.assembleFile("child.asm"), {
    message: "Recursion limit exceeded (512 levels)",
  });
});

test("include source service restores source state after read failures", t => {
  const host = createHost({
    "mem:/main.asm": "",
    "mem:/child.asm": "",
  });
  host.fileProvider.readTextFile = () => {
    throw new Error("read failed");
  };
  const service = new IncludeSourceService(host);

  t.throws(() => service.assembleFile("child.asm"), {
    message: "Failed to assemble include 'mem:/child.asm': read failed",
  });
  t.is(host.currentFile, "mem:/main.asm");
  t.deepEqual(host.includeStack, []);
});
