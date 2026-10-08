import { test } from "../../../tests/ava-helper.js";
import type { AssetFormatContribution } from "../src/plugin/contracts.js";
import {
  resolveAssetResourceSnapshot,
  assetSourceMediaType,
} from "../src/services/asset-resource-snapshot.js";

const source = { bytes: Uint8Array.of(7), mediaType: "image/x-example" };
const format: AssetFormatContribution = {
  id: "example.native",
  version: "1.0.0",
  targets: ["snes.sfc"],
  convert: () => ({ primaryOutput: "data", outputs: { data: { bytes: Uint8Array.of(0) } } }),
};

test("resource closure isolates callbacks and retains declaring-file identity and representation hints", (t) => {
  const binding = Uint8Array.of(8);
  const palette = Uint8Array.of(9);
  const paths = new Map([
    ["model/binding.json", binding],
    ["shared/palette.bin", palette],
  ]);
  const reads: string[] = [];
  const snapshot = resolveAssetResourceSnapshot(
    {
      ...format,
      sourceRepresentations: [
        { id: "example", mediaType: source.mediaType, extensions: [".example"] },
      ],
      resourceDependencies(input, options, resources) {
        t.is(input.bytes[0], 7);
        input.bytes[0] = 99;
        t.is(options.owner, 1);
        (options as Record<string, unknown>).owner = 2;
        if (Object.hasOwn(resources, "binding")) {
          t.is(resources.binding.bytes[0], 8);
          resources.binding.bytes[0] = 99;
          return [
            { key: "binding", path: "model/binding.json" },
            {
              key: "palette",
              path: "../shared/palette.bin",
              relativeTo: "binding",
              mediaType: "application/x-palette",
            },
          ];
        }
        return [{ key: "binding", path: "model/binding.json" }];
      },
    },
    source,
    { owner: 1 },
    {
      resolve(name, parent) {
        if (parent) {
          t.is(parent, "model/binding.json");
          t.is(name, "../shared/palette.bin");
          return "shared/palette.bin";
        }
        return paths.has(name) ? name : undefined;
      },
      read(name) {
        reads.push(name);
        return paths.get(name)!;
      },
      mediaType: (name) => assetSourceMediaType(name),
    },
  );
  t.deepEqual(reads, ["model/binding.json", "shared/palette.bin"]);
  t.is(snapshot.paths.palette, "shared/palette.bin");
  t.is(snapshot.resources.palette.mediaType, "application/x-palette");
  t.is(binding[0], 8);
  t.is(source.bytes[0], 7);
});

test("resource closure rejects recursive relative declarations and changing identities", (t) => {
  const host = {
    resolve: (name: string) => name,
    read: () => Uint8Array.of(1),
    mediaType: () => "application/json",
  };
  t.throws(
    () =>
      resolveAssetResourceSnapshot(
        {
          ...format,
          resourceDependencies(_source, _options, resources) {
            return Object.hasOwn(resources, "binding")
              ? [{ key: "recursive", path: "binding.json", relativeTo: "binding" }]
              : [{ key: "binding", path: "binding.json" }];
          },
        },
        source,
        {},
        host,
      ),
    { message: /Resource dependency cycle/ },
  );
  t.throws(
    () =>
      resolveAssetResourceSnapshot(
        {
          ...format,
          resourceDependencies: (_source, _options, resources) => [
            {
              key: "binding",
              path: Object.hasOwn(resources, "binding") ? "other.json" : "binding.json",
            },
          ],
        },
        source,
        {},
        host,
      ),
    { message: /Conflicting resource identity/ },
  );
});

test("resource closure bounds dynamically expanding depth", (t) => {
  const host = {
    resolve: (name: string) => name,
    read: () => Uint8Array.of(1),
    mediaType: () => "application/json",
  };
  t.throws(
    () =>
      resolveAssetResourceSnapshot(
        {
          ...format,
          resourceDependencies: (_source, _options, resources) => [
            {
              key: String(Object.keys(resources).length),
              path: String(Object.keys(resources).length),
            },
          ],
        },
        source,
        {},
        host,
      ),
    { message: /resource discovery depth limit/ },
  );
});
