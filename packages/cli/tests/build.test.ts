import { test } from "../../../tests/ava-helper.js";
import { parseAssemblyBuildArguments } from "../src/build.js";
import { parseCliArguments } from "../src/index.js";

test("native CLI commands require explicit modes and stable module identities", (t) => {
  t.deepEqual(
    parseAssemblyBuildArguments(["assemble-object", "main.asm", "--module", "main"], "/project"),
    {
      action: "assemble-object",
      directory: "/project",
      source: "main.asm",
      output: "main.uobj",
      module: "main",
    },
  );
  t.deepEqual(
    parseAssemblyBuildArguments(["library", "routines.ulib", "a.uobj", "b.uobj"], "/project"),
    {
      action: "library",
      directory: "/project",
      output: "routines.ulib",
      objects: ["a.uobj", "b.uobj"],
    },
  );
  t.deepEqual(parseAssemblyBuildArguments(["build", "build.json"], "/project"), {
    action: "build-linked",
    directory: "/project",
    manifest: "build.json",
  });
  t.deepEqual(parseAssemblyBuildArguments(["link", "build.json"], "/project"), {
    action: "link",
    directory: "/project",
    manifest: "build.json",
  });
  for (const argv of [
    ["assemble-object", "main.asm"],
    ["assemble-object", "main.asm", "--module"],
    ["assemble-object", "main.asm", "--module=one", "--module=two"],
    ["library", "only.ulib"],
    ["library", "out.ulib", "a.uobj", "--debug"],
    ["link", "build.json", "--config", "other.json"],
    ["build", "build.json", "ignored.json"],
  ]) {
    t.throws(() => parseAssemblyBuildArguments(argv, "/project"));
  }
  t.is(parseCliArguments(["main.asm"]).command, "assemble");
  t.is(parseCliArguments(["assemble", "main.asm"]).command, "assemble");
});

test("object CLI accepts option equals syntax and escaped positional paths", (t) => {
  t.deepEqual(
    parseAssemblyBuildArguments(
      [
        "assemble-object",
        "--module=main",
        "--config=tools/config.json",
        "--",
        "--input.asm",
        "--output.uobj",
      ],
      "/project",
    ),
    {
      action: "assemble-object",
      directory: "/project",
      source: "--input.asm",
      output: "--output.uobj",
      module: "main",
      config: "tools/config.json",
    },
  );
});

test("object source adapters are explicit and rejected on unrelated CLI operations", (t) => {
  for (const sourceAdapter of ["asar", "ca65"]) {
    t.deepEqual(
      parseAssemblyBuildArguments(
        ["assemble-object", "main.asm", "--module=main", `--source-adapter=${sourceAdapter}`],
        "/project",
      ),
      {
        action: "assemble-object",
        directory: "/project",
        source: "main.asm",
        output: "main.uobj",
        module: "main",
        sourceAdapter,
      },
    );
  }
  t.throws(() =>
    parseAssemblyBuildArguments(
      ["assemble-object", "main.asm", "--module=main", "--source-adapter=unknown"],
      "/project",
    ),
  );
  t.throws(() =>
    parseAssemblyBuildArguments(["link", "build.json", "--source-adapter=asar"], "/project"),
  );
});
