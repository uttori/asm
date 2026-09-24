# Secret of Mana asset plugin

[`som-asset-plugin.mjs`](som-asset-plugin.mjs) is a complete game plugin for the SNES
assembler target. It registers `som.tile.actor3bpp`, an indexed PNG conversion built on
`@uttori/asm-assets/image` and `/snes`, `som.sprite.frames` for framed 4bpp sprites,
`som.boss.graphics` for the mask-expanded boss sheets, playable WAVE formats `som.brr.pcm` and
`som.brr.segment`, `som.palette.bgr555` for shared ROM palettes, and `som.lz`, a reversible transform backed by
[`som-lz.mjs`](som-lz.mjs). The LZ implementation handles the game's six boot/graphics
distance-mask modes and returns the exact consumed stream extent. Room map-piece and
metatile compression have separate grammars and are not registered as `som.lz`.

The cartridge's WAVE files contain standard mono PCM16 at a nominal 32 kHz preview
rate. An `sBRR` RIFF chunk holds the original encoded BRR blocks. The plugin checks
every PCM sample against the shared BRR decoder before emitting those blocks, which
preserves the original ROM bytes. The segment format uses one WAVE on both sides of
the violin's bank boundary. Editing the PCM requires a reviewed BRR re-encode; a
stale native chunk is rejected.

Legacy native-order boss PNGs can keep the original compressed stream in a private `soMz` chunk. The
plugin verifies that its decoded tiles match the visible indexed pixels, then emits
those original bytes for an exact ROM rebuild. After a pixel edit, it re-encodes the
two-byte-history mask stream and optional `som.lz` stage, then keeps the declared ROM
span fixed. An edit that cannot fit the original span fails assembly. The boss frame
atlases carry the same native streams in `soMA`, `soMB`, etc., one per segment in layout
order. Frame records supply positions and flips; each atlas retains a representative
verified source palette, while the game may select a different runtime palette.

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

## Shared sprite palettes

`disassembly/assets/palettes/sprite-palettes.json` is the single source for the
converted sprites' BGR555 colors. Its top-level `palettes` object has one record per
ROM span, keyed by six-digit CPU address. A record stores `firstIndex`, its exact
little-endian ROM `words` in hexadecimal, and `users` for every frame atlas and
segment that references it. The frame layout's `paletteRefs` point to these keys.
The same record assembles at its original bank position:

```asm
includeAsset("../assets/palettes/sprite-palettes.json", "som.palette.bgr555", palette: "C81000")
```

The plugin preserves bit 15 of every word, including the `FFFF` cannon palette.
Actor palettes emit fifteen stored words (`firstIndex: 1`), while boss palettes
emit sixteen (`firstIndex: 0`). Each record has a generated 37×37 PNG in
`assets/palettes/previews/`: sixteen color squares in ROM order, each exactly 8×8
pixels with one-pixel grid lines. Asset Preview displays the same image at a larger
size and lists its users.
Run `tools/build-palette-previews.mjs` after editing a word, then run it with
`--check` and run `tools/check-sprite-palettes.mjs --list` after assembling. The
checker compares catalogue words to the rebuilt ROM and validates every atlas use.

The sidecar format is deliberately small. `width` and `height` equal the PNG dimensions;
`version` is `1`. `paletteRefs` lists ROM addresses in the shared
[`sprite-palettes.json`](../../../../secret-of-mana/disassembly/assets/palettes/sprite-palettes.json)
catalogue. Each address begins a little-endian BGR555 span. `firstIndex: 1` means
the ROM stores fifteen visible actor colors, while PNG index zero is transparent;
`firstIndex: 0` means the ROM stores all sixteen boss colors, including a hidden
color-zero word. Five-bit channels expand by bit replication. In the PNG, palette
group 0 occupies indexes 0–15, group 1 occupies 16–31, and so on. The one guide
color is index `16 * paletteRefs.length` and is recorded as `guideIndex`.
`paletteVariants` can name another ROM palette for the same group, such as Watts'
runtime palette; it does not change the atlas's source colors. Each `segments` key
is the `segment` option in assembly. Its `palette` selects a group, and its `tiles`
array is **in native ROM tile order**. Each tile
entry chooses one authoritative 8×8 source rectangle by its top-left `x,y` pixel;
optional `flipX`/`flipY` tell the importer to undo the displayed orientation. Index
zero or the guide index becomes transparent tile color zero. Other indexes must belong
to that segment's palette group. The importer rejects a changed PNG palette relative
to the catalogue, an invalid rectangle, or a color from another group.
`romAddress`, `frames[].name`, and `frames[].bounds` help editors and exporters;
tile encoding uses the rectangle list.
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
      "tiles": [{ "x": 8, "y": 16 }, { "x": 24, "y": 16, "flipX": true }]
    }
  }
}
```

```asm
includeAsset("../assets/images/npc/actor-frames.png", "som.sprite.frames",
             layout: "../assets/images/npc/actor-frames.layout.json",
             palettes: "../assets/palettes/sprite-palettes.json", segment: "actor-main")
```

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
4. Add `includeAsset` at the original ROM position with `layout`, `palettes` and
   `segment`. Use `som.sprite.frames` for plain 4bpp; use `som.boss.graphics` with
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
Dwarf, Mantis Ant and Tropicallo records. It also writes the complete bottom tile atlases and
records source-only tiles automatically. Running it
**replaces the generated atlases**: finish current PNG edits first or use a separate
copy. To add another captured actor to this exporter, add its verified ROM tile
span and palette reference to `SOURCE_ROM_SPANS`, map its entity
in `ENTITY_GROUP`, and load its frame records in `actor_frames()`. The exporter
resolves frame tile offsets to source segments and writes the PNG/sidecar pair.
It requires Python 3 and Pillow. A new boss
graphics mode belongs in this plugin, beside its bounded decoder, encoder and tests.

To edit an existing sprite, open the `*-frames.png` indexed image in a pixel editor.
Draw in the authoritative frame occurrence or source-only bottom tile indicated by
the sidecar's `tiles[]`; keep the palette indexes and dimensions intact. The bottom
tile atlas is a reference for frame-backed tiles; changing only that reference does
not alter ROM output. Edits to another visual occurrence of a repeated tile are
likewise preview-only until copied to its authoritative rectangle. The grid color
can be painted over transparent pixels; it encodes as zero. Changing a PNG palette
color alone fails import. For an intentional color edit, update its catalogue BGR555
word and the indexed PNG palette entries of all affected atlases, then regenerate
the palette preview. The catalogue record owns the emitted ROM bytes; its `users`
list and editor preview reveal every graphic affected by that word. The frame
atlas does not specify animation timing; runtime variants such as Dwarf/Watts are
recorded with `paletteVariants` and separate ROM palette references.

The [WRAM cartridge example](../../../../secret-of-mana/examples/asset-wram/README.md)
loads this plugin with the CLI and repacks freshly assembled WRAM images. The
[plugin tests](../../../../secret-of-mana/tools/som-asset-plugin.test.mjs) check all LZ
modes, actor and boss tile round trips, transform chaining and an actual assembled cartridge.
Run them from the repository root with:

```sh
rtk proxy node --conditions=uttori-source --import tsx --test secret-of-mana/tools/som-asset-plugin.test.mjs
```

For another Secret of Mana compression or graphics mode, keep the game codec next to its
plugin registration here and add bounded decoding and exact round-trip tests. Other games
can add sibling directories under `packages/assets/plugins/`. Reuse package
primitives for standard SNES tiles, palettes, maps, audio and previews. Convert a ROM
pixel run to PNG only when its actual palette and displayed shape are identified and
visually checked. Original ROM
compressed bytes remain authoritative until a reviewed rebuild deliberately repacks them.
