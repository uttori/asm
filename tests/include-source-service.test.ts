import { test } from "./ava-helper.js";
import { MemoryAssemblyFileProvider } from "../src/file-provider.js";
import {
  IncludeSourceService,
  type IncludeSourceHost,
} from "../src/services/include-source-service.js";

const createHost = (
  files: Record<string, string | Uint8Array>,
  currentFile = "/proj/main.asm",
): IncludeSourceHost & {
  edges: Array<[string, string]>;
  executedFiles: string[];
  parsedSources: string[];
} => {
  const host = {
    currentFile,
    currentMacroSourceFile: undefined,
    includePaths: ["/proj"],
    includeStack: [],
    includedFiles: new Map(),
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

test("include source service reads binary and text files relative to source", t => {
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

test("include source service marks, executes, records, and restores includes", t => {
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

test("include source service memoizes text within one assembly snapshot", t => {
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

test("include source service enforces and resets include guards", t => {
  const host = createHost({
    "/proj/main.asm": "",
    "/proj/child.asm": "db $01",
  }, "/proj/child.asm");
  const service = new IncludeSourceService(host);

  service.guardCurrentFile();
  host.currentFile = "/proj/main.asm";
  service.assembleFile("child.asm");
  t.deepEqual(host.executedFiles, []);

  service.resetGuards();
  service.assembleFile("child.asm");
  t.deepEqual(host.executedFiles, ["/proj/child.asm"]);
});

test("include source service rejects cycles and excessive nesting", t => {
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

test("include source service restores source state after read failures", t => {
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
