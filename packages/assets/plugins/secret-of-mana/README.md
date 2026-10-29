# Secret of Mana asset plugin

[`som-asset-plugin.ts`](../../../game-secret-of-mana/src/assembly.ts) is a complete game plugin for the SNES
assembler target. It registers `som.tile.actor3bpp`, an indexed PNG conversion built on
`@uttori/asm-assets/image` and `/snes`, `som.sprite.frames` for framed 4bpp sprites,
`som.boss.graphics` for the mask-expanded boss sheets, playable WAVE formats `som.brr.pcm` and
`som.brr.segment`, `som.palette.bgr555` for shared ROM palettes, and `som.lz`, a reversible transform backed by
[`som-lz.ts`](../../src/secret-of-mana/som-lz.ts). The LZ implementation handles the game's six boot/graphics
distance-mask modes and returns the exact consumed stream extent. Room map-piece and
metatile compression have separate grammars and are not registered as `som.lz`.

`som.world.rle` handles a world-map row independently of those formats. Its `size`
option defaults to 512 output tiles (valid range 1–65536). Bytes below `$C0` are
literal tile IDs; `$C0–$FF` repeat the following tile `(token & 63) + 1` times.
The decoder rejects truncated streams, row overruns and trailing bytes. Encoding
escapes high tile IDs and splits runs at 64. All 512 USA-ROM rows reproduce their
original encoding exactly; callers should still retain native streams for other
ROM revisions whose token choices may differ.

`som.boss.tilemap` handles the bank-C1 streams referenced by background-backed boss
poses. Its required `size` is the exact even expanded byte count (2–65534), normally
`width * height * 2`. A zero storage tag is raw data; every nonzero tag selects the
MSB-first mask grammar that copies the byte two outputs earlier for clear bits.
Both history bytes start at zero. Unlike boss tile graphics, tilemaps stop within
the last mask group without rounding their output to eight bytes. Encoding defaults
to tag 1; set `tag: 0` for raw storage or preserve the original nonzero tag explicitly.
The decoder rejects trailing bytes and enforces the caller's output limit. Preserve
original streams when equivalent authored data could have a different encoding.

The shared `som-boss-background.ts` codec also reads and writes FF pose prefixes:
count/FF, two signed little-endian pixel origins, then `count` six-byte rectangles
containing cell X/Y, cell width/height and a bank-C1 near pointer. The native builder
places each rectangle in the `$7FBC00` tilemap buffer with a 64-byte row stride.
The prefix extent excludes collision records and makes no claim about final PPU
scrolling or palette selection. These records are distinct from ordinary OAM parts.

The separate 64-byte bitmap at `$C67FC0` selects each row's starting bank, low bit
first (`$C6 | bit`). The 512 little-endian pointers start at `$C68000`; pointer
wrap is not a bank-selection rule. Row 357 starts in `$C6` and reads across into
`$C7`. The full intro research verifies 258 decoded row instances against physical
WRAM-port writes and reconstructs the complete 512×512 tile map.

The cartridge's WAVE files contain standard mono PCM16 at a nominal 32 kHz preview
rate. An `sBRR` RIFF chunk holds the original encoded BRR blocks. The plugin checks
every PCM sample against the shared BRR decoder before emitting those blocks, which
preserves the original ROM bytes. The segment format uses one WAVE on both sides of
the violin's bank boundary. Edited PCM re-encodes with the shared deterministic BRR
encoder after the recipe declares `loop: false`, `loop: "source"` for a WAVE `smpl`
loop, or `loop: { start, end }` in sample frames (exclusive end, aligned to sixteen).
The BRR flag cannot reveal the external loop-pointer table, so the plugin refuses
to guess that policy. Review playback, peak/RMS error and loop-replay error accompany
the encoded bytes. Ordinary editors may strip the native chunk; the explicit policy
still works. A split stream then also requires `fullByteLength`, and its complete
encoded size must remain fixed so new tail samples cannot silently disappear.
Asset Preview shows the source waveform and offers playback of both the authored
WAVE and the verified decoded BRR. For `som.brr.segment`, the byte count is the
selected bank slice while playback covers the complete stream, since the split
can occur inside a BRR block.

Legacy native-order boss PNGs can keep the original compressed stream in a private `soMz` chunk. The
plugin verifies that its decoded tiles match the visible indexed pixels, then emits
those original bytes for an exact ROM rebuild. After a pixel edit, it re-encodes the
two-byte-history mask stream and optional `som.lz` stage, then keeps the declared ROM
span fixed by default. Set `sizePolicy: "encoded"` on a declared movable asset to
expose its actual encoded length to layout checks and relocation; `byteLength` still
identifies the preserved original stream. Fixed-size edits that do not fit fail;
encoded sizing never allocates space or repairs pointers by itself. The boss frame
atlases carry the same native streams in `soMA`, `soMB`, etc., one per segment in layout
order. Frame records supply positions and flips; each atlas retains a representative
verified source palette, while the game may select a different runtime palette.

For ordinary PNG editors, declare `native: "../assets/native/boss-1ae598.bin"`
on each `som.boss.graphics` include. This small original compressed resource takes
precedence over private PNG chunks, which external editors commonly discard.
The plugin checks its original byte length and decodes it before reuse. Unchanged
logical tiles retain the exact original stream; changed tiles are encoded and
round-trip checked. Each segment has its own resource, so changing one segment
does not unnecessarily recompress the others. Git source generation can admit
these resources through `pristineAssets` entries with a SHA-256 and a `romRange`
of half-open, headerless original-ROM file offsets. Candidate generation extracts
and verifies those original bytes instead of trusting the working asset file.

## Frame-aware sprite atlases

The current `disassembly/assets/images/{npc,enemy,objects}/` PNGs named `*-frames.png`
are **editable source images**. The neighboring `*-frames.layout.json` file maps their
posed 8×8 pixels back to ROM tile order. Every converted NPC, enemy, object and boss
sprite segment uses one of these atlases through `includeAsset`. The PNG is an indexed
image at native resolution, with a dashed 8-pixel grid, a border around each frame,
and stable frame IDs. Full names are in `frames[]` in the sidecar. **Every segment
also has a complete native-order tile atlas at the bottom**, arranged left to right
in rows of sixteen tiles. Its header reports the total and the number of source-only
tiles. This bottom atlas makes every source tile visible, including tiles that no
captured pose exposes unobscured.

Open `secret-of-mana/` as the editor workspace to use its checked-in
`.vscode/settings.json`; this loads the disassembly config and registers the SoM
formats for Asset Preview. When opening the monorepo root instead, set
`asm.configFile` to `secret-of-mana/disassembly/uttori-asm.config.json` in that
workspace. The frame preview displays the complete atlas, ROM palette address and
all catalogue users of that palette. Workspace plugin loading requires a trusted
workspace.

## Shared ROM palettes

`disassembly/assets/palettes/rom-palettes.json` is the single source for the
170 bounded sprite, boss, monster, player, menu, background and effect BGR555 spans.
Its top-level `palettes` object has one record per ROM span, keyed by six-digit CPU
address. A record stores `firstIndex`, its exact little-endian ROM `words` in
hexadecimal, and `users` for every frame atlas and segment that references it.
The 122 address-indexed monster entries follow Rabite at 30-byte intervals; four
more 30-byte entries follow the ring menu palette. Their gameplay names and atlas
uses are not asserted. Records without a known frame atlas
have an empty `users` array. The frame layout's
`paletteRefs` point to these keys.
The same record assembles at its original bank position:

```asm
includeAsset("../assets/palettes/rom-palettes.json", "som.palette.bgr555", palette: "C81000")
```

Overlapping display views must contain identical words at shared ROM addresses.
Use optional zero-based `wordOffset` and positive `wordCount` to emit disjoint
physical spans while keeping complete palette views. Neko's C821EE view emits
13 words; its final two words are emitted by the existing C82208 view. The palette
editor propagates shared-word edits to all aliases and affected atlas PNGs.

The plugin preserves bit 15 of every word, including the `FFFF` cannon palette.
Actor palettes emit fifteen stored words (`firstIndex: 1`), while boss palettes
emit sixteen (`firstIndex: 0`). Background groups can contain 105 words, and effect
palettes may have other lengths. `previewColumns` controls the swatch grid; the
background groups use fifteen columns for seven rows. Each record has a generated
PNG in `assets/palettes/previews/`: color squares in ROM order, each exactly 8×8
pixels with one-pixel grid lines. Asset Preview enlarges the grid without changing
its aspect ratio and lists known frame users.
Run `tools/build-palette-previews.mjs` after editing a word, then run it with
`--check` and run `tools/check-sprite-palettes.mjs --list` after assembling. The
checker compares catalogue words to the rebuilt ROM and validates every atlas use.
`disassembly/asset-includes.json` records every converted palette, image and audio
segment's exact ROM offset, end and `includeAsset` directive. The source exporter
reads this project-owned map so a fresh export retains those includes instead of
reverting them to native struct directives or raw binaries. Update the map whenever
an asset is added or its encoded length changes; the palette checker rejects a
palette mismatch with the catalogue.

The sidecar format is deliberately small. `width` and `height` equal the PNG dimensions;
`version` is `1`. `paletteRefs` lists ROM addresses in the shared
[`rom-palettes.json`](../../../../secret-of-mana/disassembly/assets/palettes/rom-palettes.json)
catalogue. Each address begins a little-endian BGR555 span. `firstIndex: 1` means
the ROM stores fifteen visible actor colors, while PNG index zero is transparent;
`firstIndex: 0` means the ROM stores all sixteen boss colors, including a hidden
color-zero word. Five-bit channels expand by bit replication. In the PNG, palette
group 0 occupies indexes 0–15, group 1 occupies 16–31, and so on. The one guide
color is index `16 * paletteRefs.length` and is recorded as `guideIndex`.
`paletteVariants` can name another ROM palette for the same group, such as Watts'
runtime palette; it does not change the atlas's source colors. An atlas
can keep one native tile authority while individual `frames[].paletteGroup` values
select another `paletteRefs` group for the displayed pose. Omission uses each tile
segment's palette. This supports shared streams such as Tonpole and Biting Lizard:
refresh and body edits preserve their different colors without duplicating ROM
graphics. A display-only group's catalogue user has role `runtime-variant` and
lists the segments referenced by those poses. A block's `paletteGroup` overrides
the pose default and becomes part of its derived placements. Fully blank poses
retain an explicit runtime palette use with an empty segment list.
Each `segments` key
is the `segment` option in assembly. Its `palette` selects a group, and its `tiles`
array is **in native ROM tile order**. Each tile
entry chooses one authoritative 8×8 source rectangle by its top-left `x,y` pixel;
optional `flipX`/`flipY` tell the importer to undo the displayed orientation. Index
zero or the guide index becomes transparent tile color zero. Other indexes must belong
to that segment's palette group. The importer rejects a changed PNG palette relative
to the catalogue, an invalid rectangle, or a color from another group.
`romAddress` orders combined spans; tile encoding uses the rectangle list.
`frames[].name` and `frames[].bounds` describe the displayed poses.
Each segment's `tileAtlas` records the bottom strip's `bounds`, `columns`, pixel
`step`, and `sourceOnly` tile indexes. The bottom tile at index `i` begins at
`bounds[0] + (i % columns) * step`, `bounds[1] + floor(i / columns) * step`.
For indexes in `sourceOnly`, that bottom tile is the authoritative source rectangle.
For other indexes it is a native-order reference to the tile sourced from a frame.

For example, a two-tile source with one flipped visible tile can use this shape.
`C81000` is illustrative here; new assets need their own verified ROM palette:

```json
{
  "version": 1,
  "width": 72,
  "height": 48,
  "paletteRefs": ["C81000"],
  "guideIndex": 16,
  "frames": [{ "id": "F00", "name": "Facing left", "bounds": [0, 0, 71, 47] }],
  "segments": {
    "actor-main": {
      "romAddress": "D78000",
      "palette": 0,
      "tileAtlas": { "bounds": [8, 32, 20, 10], "columns": 16, "step": 10, "sourceOnly": [] },
      "tiles": [
        { "x": 8, "y": 16 },
        { "x": 24, "y": 16, "flipX": true }
      ]
    }
  }
}
```

```asm
includeAsset("../assets/images/npc/actor-frames.png", "som.sprite.frames",
             layout: "../assets/images/npc/actor-frames.layout.json",
             palettes: "../assets/palettes/rom-palettes.json", segment: "actor-main")
```

Omit `segment` when all segments of an atlas occupy one uninterrupted ROM range.
One include then encodes the entire atlas in ascending `romAddress` order. The physical
segment IDs, frame references and per-segment palette groups stay in the sidecar, so
new contiguous poses can extend the same asset without adding another source entry.
For one continuous subset of a gapped atlas, use `segments: ["actor-main", "actor-extra"]`.
The codec rejects empty selections, duplicate ownership, gaps and overlaps; it never
inserts padding. `segment` and `segments` are mutually exclusive. Preserve separate
includes where a named internal source label must remain addressable. Masked/compressed
boss streams continue to require their individual `segment` and storage options.
The source exporter preserves interior annotations above a combined include with their
relative asset offsets. Comments alone do not require separate emission boundaries.

To add a sprite from scratch:

1. Establish the exact ROM tile extent, palette address, and frame geometry from
   captured OAM or another reviewed source. Keep the tile addresses and frame IDs.
   Add the BGR555 words to the shared catalogue with a `users` entry naming the
   atlas and segments. Reuse an existing address for genuinely shared palettes;
   equal colors stored at different addresses remain separate records. Add a
   `som.palette.bgr555` include at the ROM span; this record now owns those bytes.
2. Make an indexed PNG under `assets/images/npc`, `enemy`, or `objects`. Put each
   pose in a bounded cell, leave at least a pixel between cells, and reserve one
   guide index after the palette groups. Expand each BGR555 channel to eight bits as
   `(value << 3) | (value >> 2)`. Use native 8×8 pixels; do not rescale art.
3. List every native tile in a sidecar segment, in ROM order. Point each tile to a
   complete, unobscured occurrence in a frame. Undo OAM flips with `flipX`/`flipY`.
   Add a complete bottom tile atlas in ROM order. Point unseen or obscured tiles
   to its 8×8 rectangles; point visible tiles to a complete frame occurrence.
   Record the bottom geometry and source-only indexes in `tileAtlas`. Repeated
   poses can display the same tile, but one rectangle is authoritative.
4. Add `includeAsset` at the original ROM position with `layout` and `palettes`.
   Prefer one include per continuous run; use `segment` or `segments` to select a
   subset when the atlas has gaps or internal labels. Update `asset-includes.json`
   to own the exact combined extent. Use `som.sprite.frames` for plain 4bpp; use `som.boss.graphics` with
   `layout`, `segment`, `storage`, and `byteLength`
   for masked/compressed boss segments. Preserve the exact boss stream in the matching
   `soMA`, `soMB`, ... chunk until an intentional pixel edit needs recompression.
5. Verify the atlas visually with its palette and compare encoded segment bytes to
   the original. Run `tools/check-sprite-palettes.mjs --list` against the rebuilt ROM;
   it checks catalogue words and exact sidecar user lists. Run the plugin test and
   assemble the entire ROM; require the SHA-256 of `rebuilt-content.sfc` to match
   the source ROM before accepting a no-edit migration.

For the existing capture set, `secret-of-mana/tools/build-frame-atlases.py` performs
steps 2–3 from the original ROM, shared palette catalogue, and reviewed Potos,
Dwarf, Mantis Ant and Tropicallo records when explicitly seeding new files with
`--seed`. It also writes complete bottom tile atlases and records source-only tiles.
Normal invocation only enriches existing sidecars with reviewed composition; it
leaves PNG pixels untouched. Seeding refuses existing files. To add another captured actor to this exporter, add its verified ROM tile
span and palette reference to `SOURCE_ROM_SPANS`, map its entity
in `ENTITY_GROUP`, and load its frame records in `actor_frames()`. The exporter
resolves frame tile offsets to source segments and writes the PNG/sidecar pair.
It requires Python 3 and Pillow. A new boss
graphics mode belongs in this plugin, beside its bounded decoder, encoder and tests.

For saved-file Aseprite export, preview and apply workflows, use the
[asset interchange guide](../../../cli/ASSET_INTERCHANGE.md).
It documents explicit selections, native-byte validation and review before publication.

To edit an existing sprite directly, open the `*-frames.png` indexed image in a pixel editor.
Draw in the authoritative frame occurrence or source-only bottom tile indicated by
the sidecar's `tiles[]`; keep the palette indexes and dimensions intact. The bottom
tile atlas is a reference for frame-backed tiles; changing only that reference does
not alter ROM output. Edits to another visual occurrence of a repeated tile are
likewise preview-only until copied to its authoritative rectangle. The grid color
can be painted over transparent pixels; it encodes as zero. Changing a PNG palette
color alone fails import. For an intentional color edit, use the coordinated palette command below to update
the catalogue, every affected primary PNG palette and the swatch previews together. The catalogue record owns the emitted ROM bytes; its `users`
list and editor preview reveal every graphic affected by that word. The frame
atlas does not specify animation timing; runtime variants such as Dwarf/Watts are
recorded with `paletteVariants` and separate ROM palette references.

The [WRAM cartridge example](../../../../secret-of-mana/examples/asset-wram/README.md)
loads this plugin with the CLI and repacks freshly assembled WRAM images. The
[plugin tests](../../../../secret-of-mana/tools/som-asset-plugin.test.mjs) check all LZ
modes, actor and boss tile round trips, transform chaining and an actual assembled cartridge.
Run them from the repository root with:

```sh
node --conditions=uttori-source --import tsx --test secret-of-mana/tools/som-asset-plugin.test.mjs
```

For another Secret of Mana compression or graphics mode, keep the game codec next to its
plugin registration here and add bounded decoding and exact round-trip tests. Other games
can add sibling directories under `packages/assets/plugins/`. Reuse package
primitives for standard SNES tiles, palettes, maps, audio and previews. Convert a ROM
pixel run to PNG only when its actual palette and displayed shape are identified and
visually checked. Original ROM
compressed bytes remain authoritative until a reviewed rebuild deliberately repacks them.

## Retained composition and current-source authoring

The version-1 sidecars retain each frame's canvas `origin`, ordered native `blocks`,
raw `nativeFrame` evidence when available, and stable tile `placements` with block
and quadrant identity. Placements reference a segment and tile index, or an explicitly
verified external blank tile. Native flags and shared flips remain in the SoM adapter.
Whole-atlas validation reconciles raw native bytes, decoded blocks and derived
placements. Direct edits to just one representation fail. Native body decoding and
bounded coordinate patching live in the portable SoM adapter; assembly inclusion of
those edited frame records and animation timing remain separate integration work.

`inspectFrameAtlas` is the shared validation/extraction entry point used by assembly,
editor previews and authoring. Segment scope checks the selected native source;
`{ whole: true }` also checks every segment, frame and native-order strip. Refresh
requires retained composition. `refreshFrameAtlas` reads authoritative rectangles from
**current PNG pixels**, applies the retained composition and refreshes duplicate
occurrences and the native-order strips. Publication checks that every encoded native
segment, including compressed boss streams, remains identical to the pre-refresh source.

Run from the repository root (after building workspace packages, plain `node` also works):

```sh
# Add reviewed composition to existing sidecars; leaves PNGs untouched.
python3 secret-of-mana/tools/build-frame-atlases.py
# To seed original ROM pixels, --seed requires new output files and refuses existing ones.
python3 secret-of-mana/tools/build-frame-atlases.py --atlas rabite --seed --output /tmp/new-sprite-images

# Dry-run by default; add --write to publish. --atlas is optional and repeatable.
node --conditions=uttori-source --import tsx secret-of-mana/tools/refresh-frame-atlases.mjs --atlas enemy/rabite-frames.png
node --conditions=uttori-source --import tsx secret-of-mana/tools/edit-sprite-palette.mjs --edits /tmp/palette-edits.json
```

Palette edits are a JSON array: `[{"palette":"<catalogue ID>","index":1,"rgb":[255,0,0]}]`.
`index` is the logical palette slot, including `firstIndex`. RGB channels must be exactly
representable by the adapter's BGR555 bit-replication policy. Raw high bits survive,
slot identity is never inferred from RGB equality, and variant-only users keep their
primary PNG palette. The command audits the complete supplied atlas inventory and
catalogue users before planning changes. Missing or stale users reject the edit.
Validated native boss chunks are preserved, and their encoded streams are compared
before publication. All expected swatch files must already exist.

Both authoring commands accept `--export /path/to/staged-export` or
`--project /path/to/project` (whose export is `disassembly`). They snapshot read
sources and reject concurrent changes, stage
all replacements and recover earlier writes on ordinary publication failures. Recovery
is not crash-atomic and intermediate files are visible to readers; avoid concurrent
assembly while publishing. A recovery conflict retains backups for manual reconciliation.
The Python evidence enricher accepts `--project`, `--output` (images root) and repeatable
`--atlas`; its ROM decoding and research-record discovery are intentionally SoM-specific.

### Stable storage, frame geometry and persistent baselines

New seeds use `tileSources: "native-strip"`: every native tile owns a bottom-strip
rectangle independent of pose position, overlap and visibility. In that mode
`tileAtlas.sourceOnly` identifies tiles absent from every pose. Legacy layouts retain
their existing source rectangles and source-only meaning until explicitly repacked.
The Python builder calls `frame-composition-bridge.mjs` for derivation/rendering, so it
requires Node, workspace dependencies/tsx and Pillow; it owns evidence discovery and
decoration, not a second implementation of flip and placement rules.

`planBodyFrameEdits(atlas, catalog, edits)` returns an owned PNG/layout pair. Edits are
`{ frame, block, x?, y? }`, naming existing frame and native block IDs. It patches only
signed seven-bit coordinates (−64..63), preserves native flags/run tokens/collision
tails, updates every pose sharing the same record, derives placements and repacks the
canvas with independent storage. Every native tile must remain byte-identical. A
no-op retains the original PNG exactly. Boss/effect frame edits, tile reassignment,
record growth and relocation are deliberately unsupported by this body codec. The
result includes updated raw frame bytes but does not yet install ROM frame includes.

Save dependencies at the beginning of an external editing session, then require the
same baseline on import. The baseline includes atlas PNGs/layouts, palette catalogue
and swatches, and include sources/map. It is relocatable;
its identity includes the adapter revision and reference ROM hash.

```sh
node --conditions=uttori-source --import tsx secret-of-mana/tools/snapshot-sprite-assets.mjs --output /tmp/sprite-baseline.json
node --conditions=uttori-source --import tsx secret-of-mana/tools/refresh-frame-atlases.mjs --baseline /tmp/sprite-baseline.json
node --conditions=uttori-source --import tsx secret-of-mana/tools/edit-sprite-palette.mjs --baseline /tmp/sprite-baseline.json --edits /tmp/palette-edits.json
```

The snapshot command refuses to overwrite an existing baseline. Authoring commands
check it before planning and retain their command-lifetime concurrency checks.

Source and asset changes are ordinary Git edits. Build with `source build`; use
`source prepare`, `source preview`, a Git checkpoint, `source apply` and `source finish`
for regeneration. Pure generation checks establish original-ROM equality; edited builds
validate placement and references against their exact source snapshot.

## Verification against selected exports

```sh
node packages/cli/out/cli.mjs source build /path/to/project
node --conditions=uttori-source --import tsx secret-of-mana/tools/check-sprite-palettes.mjs --export /path/to/export --source-only
node --conditions=uttori-source --import tsx secret-of-mana/tools/build-palette-previews.mjs --export /path/to/export --check
node --conditions=uttori-source --import tsx secret-of-mana/tools/check-sprite-palettes.mjs --export /path/to/export --rom /path/to/rebuilt.sfc
```

The build command validates the selected Git source snapshot. The sprite
check discovers banks and includes, checks exact native ownership spans and dependencies,
and audits indexed PNG palettes, source extraction and catalogue users. `--source-only`
allows intentional edits without comparing them to the original ROM; it is not an
assembly check. Without it, the default ROM is `<export>/build/rebuilt-content.sfc`;
`--rom` or the legacy positional ROM argument selects another file. Original-ROM
identity is checked on pure generations before Git integration; working source builds may intentionally differ. Game compression, BGR555 catalogue
shape and the HiROM address mapping remain explicit SoM adapter policy.

Run both conversion and authoring regressions with:

```sh
node --conditions=uttori-source --import tsx --test secret-of-mana/tools/som-asset-plugin.test.mjs secret-of-mana/tools/asset-authoring.test.mjs
```

## Editable rooms (`som.room`)

A room JSON owns three discontiguous, fixed ROM sections. Each section assembles
from the same source file, so editing entity coordinates, event IDs, conditional
layout placements or trigger words does not require editing bank assembly:

```asm
includeAsset("../assets/rooms/room-001e.json", "som.room", section: "objects", preview: "../assets/rooms/room-001e.preview.json")
includeAsset("../assets/rooms/room-001e.json", "som.room", section: "assembly", preview: "../assets/rooms/room-001e.preview.json")
includeAsset("../assets/rooms/room-001e.json", "som.room", section: "triggers", preview: "../assets/rooms/room-001e.preview.json")
```

Place each include at its corresponding `sections.<section>.address`; these are
canonical CPU addresses, while the export include map uses ROM file offsets.
`sections.<section>.bytes` is a fixed allocation. The converter validates all
three sections on every conversion, rejects out-of-range fields and refuses
length changes requiring relocation. It does not update ROM pointer tables.

The version-1 source has `format: "som.room"`, `version: 1`, `id`, `name`,
`sections`, an eight-byte `header`, `entities`, `pieces`, `triggers`, and
`previewStory` keyed by decimal story-variable index. Header bytes preserve
native packed flags: byte 0 low six bits selects graphics; byte 1 low seven bits
selects background palette; byte 2 low six bits selects metatiles and its upper
two bits select each layer's 192-metatile half. Other header bytes remain native
values. Room coordinates are 16-pixel cells, with a physical 128-cell row stride.

Entities expose `variable`, inclusive nibble `minimum`/`maximum`, `x`, `y`,
`flags` (40/80), `orientationAndLayer`, `entity`, 12-bit `event`, and four-bit
`interaction`. Pieces expose the same story predicate, one-based ten-bit
`layout`, `x`, `y`, and `layer`. An explicit `marker: 254` or `255` changes to
layer 1 or 2 before that record. Preserve original markers even if redundant.
Story tests use the whole byte; a value such as 13 hex does not pass a 1..3 range.
Triggers remain packed 16-bit words: below 0800 is an event ID; other values
select exit ID `word - 0800`.

The editor resolves the `preview` dependency, verifies the conversion and
renders the **current source placements and preview story values** with captured
planar graphics, BGR555 colors and native metatile words. `layer: 1` or `2`
selects a separate layer. Captured resources retain their graphics-session,
image-clock, phase and source hashes. Unknown graphics fail instead of becoming
black pixels. Portable previews accept native room canvases up to 2048×2048 pixels
and downscale the displayed PNG to a maximum edge of 1024 pixels.
Each room also has a directly viewable `room-XXXX.preview.png` rendering beside
its editable JSON. These are background asset views: actors, camera scrolling,
mutable clones, BG3 and SNES color math are omitted. The captured palette is
retained, including magenta forest regions also visible in the screenshots.
A change to an uncaptured tileset or layout needs new preview resources.

Shared compressed layouts, graphics and palettes are **references**, not
additional ROM ownership of the room source. Editing a preview dependency alone
does not change those ROM resources. `som-map-piece.ts` is the bounded native
layout decoder; unchanged compressed streams are preserved. Deferred motifs decode
in insertion order against the completed parent and earlier motifs. Native pattern
commands use an eight-bit column and physical 128-cell row stride; a narrow motif
can read beyond its parent allocation. Queued rectangles also write their full
extent beyond parent edges; escaped columns can alias the next physical row.
Parent output projects its own cells after all queued writes. Heated-village
layout 0383 has a captured 7×6 insertion at column 49 of a 50-column parent.
`decodeMapPiece(bytes, { history, origin })`
accepts a read-only map of known bank-7F byte offsets and the parent's physical
origin. Missing external cells fail explicitly rather than becoming zero. Use
`motifInstances` for each placement's decoded geometry; `motifs` retains the first
instance for compatibility. Context-free room previews cannot resolve such layouts
without independently retained history. The Water Palace layout 0025 is the
captured regression example. The seven initial
room assets are seeded by `secret-of-mana/tools/build-haunted-room-assets.mjs`,
which refuses to overwrite an edited source. Its `--check` mode verifies the
no-edit ROM conversion and saved preview PNGs.

```sh
node --conditions=uttori-source --import tsx --test secret-of-mana/tools/som-room-assets.test.mjs
node --conditions=uttori-source --import tsx secret-of-mana/tools/build-haunted-room-assets.mjs --check
```

## Editable dialogue (`som.dialogue.script`)

The USA-ROM text parser supports literal glyphs and 61 dual-tile pairs. The
`som-dialogue` module exports reversible ASCII conversion and exact-size packing.
An unchanged text span retains its original native encoding, including DTE aliases.
An edited span uses dynamic programming to find an encoding of its exact byte budget;
this can deliberately leave some pairs literal. An edit that cannot fit fails.

```asm
includeAsset("../assets/text/water-palace/luka-undine.txt", "som.dialogue.script", layout: "../assets/text/water-palace/luka-undine.layout.json")
```

The `.txt` contains visible ASCII, native line breaks, and numbered `{raw:0}`
markers. The version-1 `som-dialogue-script` sidecar stores the 122 dictionary bytes
in `dictionaryHex` and alternating `raw`/`text` segments in `segments[].nativeHex`.
Raw command bytes and every segment's original byte length are retained. Markers
must keep their order; commands cannot be introduced through text. CRLF is accepted
as LF. Only the LF following a final raw marker is cosmetic. Use `\xHH` for an
unresolved native glyph; typographic quote bytes C3/C4 remain distinct escapes.
Unsupported Unicode fails until a verified font extension is available.

Raw segments can optionally expose reviewed `commands` with a byte `offset` and
an original `token`. The token must compile exactly to the native bytes at that
offset. For example, `{ "offset": 0, "token": "${girl}" }` admits bytes `57 01`.
This yields readable, editable commands in the ASCII source:

```text
${openDialogue}${girl}:Okay!
 You can call me ${girl}!${wait}${closeDialogue}
```

`${boy}`, `${girl}` and `${sprite}` insert the current twelve-byte name records
from `7ECC00`, `7ECC0C` and `7ECC18` at runtime. The offline encoder retains the substitution
command, rather than baking a particular name into the translation. `${wait}`
encodes `28 00` and waits for fresh input from the talking actor's controller;
`${wait:N}` uses an unsigned decimal byte `0..255`, with nonzero values counting
event-interpreter updates. `${openDialogue}`, `${closeDialogue}` and
`${clearDialogue}` expose one-byte window controls `50`, `51` and `52`.

Edits must retain the admitted family and width. A party-name slot can change
from `${boy}` to `${girl}`, and a wait can change from `${wait:3}` to `${wait:6}`.
They cannot replace each other merely because both occupy two bytes. A slot can
set `editable: false` to expose its name without allowing byte changes. Unknown
raw subspans retain markers such as `{raw:0:0}`; the original whole-block
`{raw:0}` remains accepted as a request to preserve that block unchanged.
Tokens cannot be inserted into an unadmitted text span or move command offsets;
variable-length script layouts still require relocation/ownership work.

The authoring encoder uses E0 instead of its short 7D alias, because 7D has an
additional meaning at a window entry. It rejects 5F as a text token. The native
parser subtracts `60` from that byte and underflows; the Thingy table's placeholder
must not be used as an authoring character. Digit glyphs B5..BE are supported even
though the supplied Data Crystal table omits them.

This format preserves fixed addresses. Script relocation, pointer-table patches,
and new font glyphs require separate ownership proofs. The five Water Palace
recordings use literal text; DTE behavior is verified from native code and tests.
A byte-identical no-edit build remains the baseline proof.

When the runtime geometry is known, a text segment can specify `lineColumns`
(1..32) and `initialColumn` (default 0, smaller than the capacity). Edited spans
then avoid DTE pairs whose first glyph fills the line: the native append helper
unwinds its caller at capacity, losing that pair's second glyph. Unchanged native
bytes remain preserved, even if a preview exposes that historical loss. Raw
segments cannot declare geometry. A byte budget alone does not establish visible
width, and dynamic name substitutions require the actual prefix column.

`previewSomDialogue(bytes, dictionary, { lineColumns, initialColumn })` returns
native glyph codes grouped by LF or hard capacity, with discarded DTE glyphs
identified by byte offset. Its pixel width is columns × 8 and glyph height is 12.
It previews literal/DTE fields; event commands, dynamic substitutions, choices,
window outlines and headings retain their own contracts. The research tools
`preview-dialogue-asset.mjs` and `render-som-dialogue-font.py` produce an explicit
field preview using the verified ROM font rather than a host font.


### Room-header motion and item-control byte

The eight-byte `som.room` header array preserves the native byte identities. Byte 4
supplies the room-motion selector in its low five bits; it is not a palette index.
The room loader passes that byte to CPU `C2AB03`, which stores the previous item/mode
control byte at `7E011E` and the incoming byte at `7E011F` with one word write. A change
in bit `20` saves the current exit index or clears the saved return exit at `7E0108`.
Exact entrance style `83` skips those paired-byte and return-exit updates while still
setting the motion selector. Native analysis names the byte
`RoomHeader.motion_and_item_flags`; the serialized header array and codec are unchanged.
