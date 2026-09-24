# Including assets in SNES assembly

`includeAsset(path, format, optionName: value, ...)` converts a source-relative file and emits one named byte stream at the current assembly address. It runs in normal API and CLI builds. [The runnable fixture source](examples/include-assets.asm) emits 4 bpp tiles, their palette and tilemap, then a BRR sample. The same bytes are available through the standalone [`@uttori/asm-assets` API](https://github.com/uttori/asm/blob/master/packages/assets/README.md).

```asm
TitleTiles:
  includeAsset("art/title.png", "snes.tile.4bpp", palette: "art/title.palette.json", layout: { tileOrder: "row-major" })
TitlePalette:
  includeAsset("art/title.png", "4bpp", palette: "art/title.palette.json", output: "palette")
TitleMap:
  includeAsset("art/title.png", "4bpp", palette: "art/title.palette.json", output: "tilemap")
BellSample:
  includeAsset("audio/bell.wav", "snes.brr", loop: false, padding: "reject")
BellSampleEnd:
```

The first two arguments are strings. Following arguments are named and may contain strings, booleans, finite numeric expressions, arrays, or objects. Numeric expressions may use constants and defines, but cannot depend on labels or layout. Names are case insensitive for the directive and format aliases; file paths and string values retain their case. Duplicate or unknown options fail. `output` defaults to the format's primary output (`tiles` for graphics, `brr` for audio). `4bpp` is an SNES alias for `snes.tile.4bpp`; full IDs select their format explicitly.

PNG conversion is exact and rejects unrepresentable colors, alpha, or dimensions. An external palette is a JSON resource read through the assembly file provider; `"embedded"` or `"auto"` selects the other supported palette policies. `layout` controls tile order independently of depth. `tilemap` controls BG map attributes. The tile, palette, and map are separate output parts and require separate statements. WAVE conversion accepts mono PCM8 or PCM16 and produces lossy BRR; sample rate and loop offset are metadata in the standalone result, not bytes prepended to the emitted BRR stream.

`compress` selects a registered lossless transform after `output` selection. A single ID may use `compressOptions: { ... }`; an array uses ordered `{ id, options }` records. Each transform must decode back to the exact preceding bytes. `maxSize` rejects a final stream larger than the given byte count. Alignment, labels, mapping, freespace, and output writes follow ordinary assembly rules. Binary and resource inputs are snapshotted for one build; the next build reads changed files.

Assembler plugins register custom converters with `registerAssetFormat` and lossless compressors with `registerAssetTransform`. Both declare an ID, implementation version, and compatible target IDs; short aliases are scoped to those targets. A format's `resourcePaths(options)` declares every extra file it needs before conversion. Its `convert(source, options, resources)` receives only supplied bytes and returns named outputs. A transform supplies `encode` and `decode`; assembly verifies exact recovery before emitting transformed bytes. Duplicate IDs and ambiguous aliases fail during plugin setup.
