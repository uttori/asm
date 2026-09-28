# @uttori/asm-assets

Portable, synchronous asset conversion primitives. The package accepts supplied bytes and
does not read a ROM, create files, run an assembler, or load SQLite. `./node` is the only
entry point that reads or writes the filesystem.

The package provides native SNES tile, palette, tilemap and BRR **block** algorithms,
raw and JSON model importers, structured data, exact byte transforms, PNG-to-native
image conversion, and mono PCM WAVE-to-BRR encoding. Native BRR block editing preserves encoded nibbles;
WAVE-to-BRR sample encoding reports an explicit lossy fidelity record.

The [Secret of Mana plugin](plugins/secret-of-mana/README.md) demonstrates
game-specific compression and graphics formats on top of these primitives. It includes
the deterministic `som.lz` transform, `som.tile.actor3bpp`, reversible gridded
`som.sprite.frames` atlases, `som.palette.bgr555` shared ROM palettes with 8×8 swatch
previews, and the native-stream-preserving `som.boss.graphics` PNG
format. The [frame-atlas guide](plugins/secret-of-mana/README.md#frame-aware-sprite-atlases)
explains the sidecar map and the steps for a new sprite; other game
compressions can use the same plugin registration pattern without entering the generic
SNES codecs.

The SNES assembler now accepts these formats through `includeAsset(...)`. See the
[source syntax and runnable assembly example](https://github.com/uttori/asm/blob/master/packages/plugin-snes/ASSET-INCLUSION.md).

```ts
import { AssetRegistry, convertAsset } from "@uttori/asm-assets";
import { jsonImporter } from "@uttori/asm-assets/data";
import { snesNativeEncoders } from "@uttori/asm-assets/snes";

const registry = new AssetRegistry().registerImporter(jsonImporter);
for (const encoder of snesNativeEncoders) registry.registerEncoder(encoder);

const source = new TextEncoder().encode(
  JSON.stringify({
    kind: "snes-palette-bgr555",
    colors: [{ red: 1, green: 2, blue: 3, unusedHighBit: 1 }],
  }),
);
const result = convertAsset(registry, {
  source: { bytes: source, mediaType: "application/json" },
  format: "snes.palette.bgr555",
});
// result.outputs.palette.bytes is Uint8Array [0x41, 0x8c].
```

The returned output bytes are owned copies. Inputs are snapshotted before import; plugins
cannot modify caller buffers. Native model encoders accept no options and reject values
that would be truncated. Structured record edits preserve unknown bits and padding when
given raw backing bytes; new records require explicit zero padding. `transformBytes`
checks each transform by decoding its result back to the exact input; old compressed-token
identity is a separate ROM-edit policy.

## PNG conversion

Register `pngImporter` and `withImageEncoders(snesNativeEncoders)` from the public
`./image` and `./snes` subpaths. The [runnable PNG example](examples/png-to-snes.ts)
converts a colored 16×16 indexed fixture to named `tiles`, `palette`, `tilemap`, and `preview`
outputs using `snes.tile.4bpp`. The same path covers planar 2/3/4/8bpp and Mode 7
tiles. The preview is raw row-major RGBA8 with dimensions in output metadata.

Indexed PNGs default to their embedded palette. Truecolor and grayscale PNGs require
`palette: "auto"` or a named resource such as `palette: "art.palette.json"` with a
matching `resources` entry. External JSON uses `{ "version": 1, "colors": [[r,g,b], ...],
"transparentIndex": 0 }`. The full source palette, duplicate entries, original indexes,
and optional reversible external permutation are checked before encoding. Every RGB8
channel must occur exactly in the selected BGR555 expansion table:
`paletteExpansion: "bit-replicate"` (default) or `"scale-floor"`. Partial alpha,
unrepresentable color, lossy palette merging, non-8-pixel dimensions, and a second
palette bank are errors. There is no quantization, rescaling, or automatic tile deduplication.

`layout.tileOrder` is `"row-major"` (default), `"column-major"`, or `"blocks"`.
Blocks currently require `blockSize: [2,2]`, a block traversal, row direction, and
the `"tl-bl-br-tr"` or `"tl-tr-bl-br"` quadrant permutation. `tilemap` options set
`layout`, `startTileIndex`, `paletteBank`, `priority`, and flips; flips are inverted in
tile bytes to keep displayed pixels exact. A full BG map uses 32×32 screen blocks.
`encodeBgScreenMap` and `decodeBgScreenMap` handle maps with repeated tile references;
`encodeMode7MapLayout` distinguishes a full 128×128 map from partial uploads.

The PNG importer uses `@uttori/data-tools` 4.1.0 for its chunk model, then validates
CRC and bounds and reconstructs indexed/Adam7 scanlines exactly. Supported input is
indexed 1/2/4/8-bit, grayscale 1/2/4/8-bit, RGB8, grayscale-alpha8, and RGBA8.
Sixteen-bit PNG is explicitly rejected. Conversion is synchronous and browser safe.

## Indexed authoring helpers

The browser-safe `./image` helpers operate on palette **indexes**, without inferring
identity from matching colors or pixels:

- `extractIndexedRegion(image, region)` copies any rectangular region, reverses display
  flips and optionally maps indexes. Missing/null map entries reject an encountered color.
- `renderIndexedPlacements(sources, placements, viewport, background?)` composes named
  sources in array order (back to front), with signed origins, flips and per-placement
  mappings. Source transparency defaults to index zero, accepts another index, or `null`
  for fully opaque placement. Out-of-bounds placements fail; backgrounds are copied.
- `expandIndexedGrid(block)` derives placements from arbitrary rectangular cells, explicit
  columns, block origin and flips. Whole-block flips reverse cell order and cell pixels
  together; repeated sources retain independent placement identities.
- `rewriteIndexedPng(bytes, edit)` changes pixels and/or same-length RGBA
  palettes without remapping slots, even when colors are identical. Palette-only edits
  preserve compressed IDAT bytes and Adam7 encoding. Pixel edits retain bit depth and
  emit unfiltered, noninterlaced packed rows. Explicit `dimensions` changes require a
  complete replacement index plane. No-op edits preserve every byte.

These helpers do not assume 8×8 tiles, 16-color banks, BGR555, native frame records,
ROM addresses or a particular game. Indexed extraction/rendering is bounded to one
megapixel, 65,536 placements and 64 million processed placement pixels. PNG edits
use the existing importer's bounds. PNG safe-to-copy ancillary chunks survive edits;
unsafe ancillary chunks survive only when named in `preserveChunks` after the caller
validates their format-specific meaning.

`applyAssetFileChanges(changes)` from `./node` accepts existing file paths and exact
`before`/`after` bytes. It checks stale snapshots and duplicate/non-regular paths,
stages every replacement, then publishes via same-filesystem renames. A later failure
rolls back earlier writes without overwriting an intervening edit. Failed recovery
retains backups and reports their paths. This is **not crash-atomic**, and readers
can see intermediate files. Creation, deletion, schema migrations and ROM allocation
remain host responsibilities. Game-specific tools must also validate all read
dependencies and generated-file ownership before calling it.

`createAssetSourceBaseline(identity, sources)` and `assertAssetSourceBaseline(root,
baseline, expectedIdentity)` persist relative paths, sizes and SHA-256 fingerprints
across editing sessions. The host supplies a project/codec identity and validates the
complete dependency set; fingerprints do not discover missing dependencies themselves.
Paths cannot escape the source root or traverse symlinks.

For changes that add sources or regenerate an export, `createAssetSourceStage(root,
identity, excludedDirectories?)` copies a bounded (one GiB) source tree to a sibling
stage, including empty directories. External analysis/capture directories must be
explicitly excluded by the host. `publishAssetSourceStage(root, stage, identity,
validate)` requires a validation callback, checks the live baseline and file inventory,
publishes the staged generation and retains the previous generation for recovery.
Excluded directories move with their current contents; a stage cannot shadow them.
This requires offline publication: directory renames are neither crash-atomic nor
atomic to concurrent readers. Failed recovery reports retained source paths. Exporter
regeneration, manifest integrity, assembly and approved ROM differences remain host
policy; the generic helper does not assume a game or a generated-file format.

## WAVE-to-BRR conversion

Register `waveImporter` and `withAudioEncoder(snesNativeEncoders)` from `./audio`.
The [runnable WAVE example](examples/wav-to-brr.ts) uses a mono PCM16 fixture with a
`smpl` loop. `snes.brr` returns headerless nine-byte BRR blocks plus a `reviewWav`
output decoded at the source rate. Metadata carries sample rate, source/padded counts,
loop byte offset, peak/RMS error, SNR when defined, and repeated-loop error. BRR bytes
themselves contain no playback rate or loop address.

The first input subset is little-endian RIFF/WAVE mono PCM8 or PCM16, including odd
chunk padding and one forward `smpl` loop. PCM8 becomes signed PCM16 exactly, with no
resampling or gain. `padding: "reject"` (default) requires whole 16-sample blocks;
`padding: "zero"` reports appended samples. `loop` defaults to the source loop, or
accepts `false`, `"source"`, or exclusive sample-frame `{ start, end }`. A loop must
start on a block boundary and end at the original tail. Float, compressed, multichannel,
and malformed RIFF input are rejected. The deterministic encoder evaluates integer
predictors/ranges and checks its result with an independent integer decoder.

## Native ID mapping

| Current ROM codec ID                                            | New byte/model encoder ID                                 |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| `snes.asset.tile.2bpp` / `.3bpp` / `.4bpp` / `.8bpp` / `.mode7` | `snes.tile.2bpp` / `.3bpp` / `.4bpp` / `.8bpp` / `.mode7` |
| `snes.asset.palette.bgr555`                                     | `snes.palette.bgr555`                                     |
| `snes.asset.tilemap.bg` / `.mode7`                              | `snes.tilemap.bg` / `.mode7`                              |
| `snes.asset.brr`                                                | `snes.brr`                                                |

Existing analysis-project declarations retain their old IDs, versions, and options. The
disassembler resolves known v1 native IDs only for display; it does not run the former ROM
codec wrappers or silently migrate persisted project records.

## Entry points

`@uttori/asm-assets` contains registry contracts. `./snes`, `./data`, `./compression`,
`./preview`, `./image`, and `./audio` are browser-safe. `./node` provides optional file
reads and coordinated file replacement. `./image` exports the PNG importer, layout helpers, and normalized image models;
`./audio` exports the WAVE importer, BRR PCM codec, WAVE preview writer, and audio model.
Secret of Mana codecs stay on their own subpaths: `./secret-of-mana/lz`,
`./secret-of-mana/som-asset-plugin`, `./secret-of-mana/som-frame-atlas`,
`./secret-of-mana/som-room-assets`, and `./secret-of-mana/som-sprite-palettes`.
