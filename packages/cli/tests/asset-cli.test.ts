import { test } from "../../../tests/ava-helper.js";
import { parseAssetCliArguments } from "../src/asset-interchange/cli.js";

test("asset commands select saved files explicitly and apply only a reviewed ID", (t) => {
  t.deepEqual(
    parseAssetCliArguments([
      "export",
      "project",
      "--adapter=som.sprite.native",
      "--selection",
      "selection.json",
      "--document",
      "file.aseprite",
      "--manifest",
      "file.json",
    ]),
    {
      action: "asset-export",
      directory: "project",
      adapter: "som.sprite.native",
      selection: "selection.json",
      document: "file.aseprite",
      manifest: "file.json",
    },
  );
  t.deepEqual(
    parseAssetCliArguments([
      "apply",
      "--document",
      "saved.aseprite",
      "--manifest",
      "file.json",
      "--review",
      "a".repeat(64),
      "--",
      "--project",
    ]),
    {
      action: "asset-apply",
      directory: "--project",
      document: "saved.aseprite",
      manifest: "file.json",
      review: "a".repeat(64),
    },
  );
  t.is(parseAssetCliArguments(["--help"]), undefined);
});

test("asset commands reject ambiguous paths, missing values and unsupported flags", (t) => {
  for (const args of [
    ["import", "project"],
    ["review", "project", "second"],
    ["review", "project", "--adapter", "som.sprite.native"],
    ["review", "project", "--document", "first", "--document", "second"],
    ["apply", "project", "--document", "saved", "--manifest", "manifest"],
    ["export", "project", "--selection", "--manifest"],
  ]) {
    t.throws(() => parseAssetCliArguments(args));
  }
});

test("asset commands preserve presentation, recovery and explicit cleanup policy", (t) => {
  for (const presentation of ["tilemap", "raster", "indexed-png"] as const) {
    t.is(
      parseAssetCliArguments([
        "export",
        "project",
        "--adapter",
        "som.sprite.native",
        "--selection",
        "selection.json",
        "--document",
        "saved",
        "--manifest",
        "manifest",
        "--presentation",
        presentation,
      ])?.action,
      "asset-export",
    );
  }
  t.deepEqual(parseAssetCliArguments(["recover", "project", "--direction=before"]), {
    action: "asset-recover",
    directory: "project",
    direction: "before",
  });
  t.deepEqual(
    parseAssetCliArguments([
      "cleanup",
      "--policy",
      "retire.json",
      "--review",
      "a".repeat(64),
      "--",
      "--help",
    ]),
    { action: "asset-cleanup", directory: "--help", policy: "retire.json", review: "a".repeat(64) },
  );
  for (const args of [
    ["recover", "project", "--direction", "unknown"],
    ["cleanup", "project", "--document", "saved"],
    ["review", "project", "--presentation", "raster"],
  ]) {
    t.throws(() => parseAssetCliArguments(args));
  }
});
