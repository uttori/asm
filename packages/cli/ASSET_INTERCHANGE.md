# Edit saved asset files

Export an asset from the current Git source project, edit the saved file, review its
changes, then apply that exact review. Conversion runs in Uttori; an installed image
editor is needed only for painting. Assembly, research and accepted asset files remain
ordinary Git source inputs.

The installed adapters support Secret of Mana sprite atlases and supported USA room
assets. Other games can inject an adapter into the public `AssetInterchangeService`.
The service accepts current authored source and preserves unrelated edits.

## Convert an assembly include

To make a converted asset itself the editable source, convert the include on one assembly line:

```sh
uttori-asm asset convert /path/to/project --file source/sprites.asm --line 42 --to aseprite
```

`--file` and the optional `--destination` are relative to the project. `--to` is `aseprite` or
`indexed-png`; the destination defaults to the current source with the new extension and must not
exist. The installed conversion adapters are `som.sprite.native` and `indexed.raster`. Conversion
rewrites the include call and publishes through a journaled source transaction only when the
complete ROM is unchanged. Old sources whose remaining references are uncertain are retained and
reported. Afterward edit and save the new source and run the normal build.

## Export, review and apply

Save relevant source and editor drafts first. Export requires a selection JSON file:
paths inside that declaration are relative to the selected source project. Command
file arguments, including the selection JSON itself, are relative to the calling
directory. Export refuses to replace an existing document or manifest.

```sh
uttori-asm asset export /path/to/project --adapter som.sprite.native --selection sprite-selection.json --document sprite.aseprite --manifest sprite.aseprite.json
uttori-asm asset review /path/to/project --document sprite-edited.aseprite --manifest sprite.aseprite.json
uttori-asm asset apply /path/to/project --document sprite-edited.aseprite --manifest sprite.aseprite.json --review <id-from-review>
```

Save the edited document in your editor before reviewing it. Review reports the affected
source files and consumers without publishing source changes. Apply requires its exact
review ID. Changing the saved document, relevant source, resources, configuration or
conversion implementation requires a new export or review. A no-edit import changes
no source bytes or modification times.

After applying, export current source again for the next editing round. Use normal
Git diff, build and source regeneration preview/merge commands to retain your work.
The original export's native bindings are stale after an accepted edit.

In VS Code, select the source project and run **Assembly: Export Asset to File**,
**Assembly: Review Saved Asset**, then **Assembly: Apply Reviewed Asset**. Export asks
for the adapter, selection declaration, presentation and output path. Review chooses
the saved document and its manifest. Dirty text, native PNG and opaque custom-editor
drafts are named and preserved; commands do not save or discard them.

## Selection declarations

| Adapter             | Fields                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `som.sprite.native` | `atlasId`, `image`, `layout`, `catalog`, and `atlases` containing `id`, `image`, `layout` for every declared palette-catalog consumer. |
| `som.room.native`   | `room` and `rooms`: the selected room declaration and the complete set of declared room consumers.                                     |

Selections explicitly include the consumer closure. An omitted consumer is a diagnostic,
because editing shared graphics or colors can affect other assets. Repeated loads and
physical palette aliases are reconciled against current source. Unknown or ambiguous
source coverage stays read-only.

A sprite selection may also name `observations: { declaration, proof }`. The versioned
source-owned observation declaration pins the retained proof and ROM, capture, palette
banks, common pivot and measured ranges. Known holds create tagged preview frames.
Unknown gaps and terminal timing remain uncertain; pose names do not determine playback
order. These declarations provide display evidence, not native animation edit authority.

## Choose a presentation

The default `--presentation tilemap` exports a visible inventory containing every
declared native view, including blank, unused and duplicate-looking tiles. Composition
and room layers reference that inventory; tagged frames show known animations. Select
the inventory frame to edit a tile directly. Shared references update together.

`--presentation raster` exports indexed Aseprite with the complete view inventory in
fixed rectangles. `--presentation indexed-png` exports the same inventory as PNG.
These formats support pixel and palette edits without composition or animation previews.
Keep palette slots in their original order, even when two colors look identical.
For PNG, explicitly select the matching manifest on review.

The existing v1 raster file codecs remain supported. Extended source manifests and
private baselines use v2; obsolete experimental manifests or unsupported record versions
require re-export. A copied sidecar does not transfer authority to another checkout.
Preserve the original saved file as reference when re-exporting.

## Paint existing tiles in Aseprite

Select a tilemap layer and the **Pencil** tool. The tilemap controls are in the
**tool options bar above the canvas**, rather than the File or Edit menus. They appear
for a selected tilemap layer:

1. Use the **Draw Pixels / Draw Tiles** toggle to select **Draw Pixels**. Hold **Space**
   and press **Tab** to toggle between them; check the tooltip/mode before painting.
2. Choose **Manual** in the adjacent tileset-mode controls. Hold **Space** and press
   **1** to select Manual directly. Space+2 selects Auto and Space+3 selects Stack.
3. Select the intended palette slot, paint inside an existing inventory tile, and save
   as an `.aseprite` file. Review that saved file with its export manifest.

Manual changes existing shared tile pixels. Auto and Stack may allocate tiles or change
references; allocation is outside this editing profile and is rejected. See
[Aseprite's tilemap documentation](https://www.aseprite.org/docs/tilemap/) for the controls
and shortcuts. Raster Aseprite and PNG use ordinary pixel painting and have no tileset modes.

## Accepted edits and limits

Existing tile pixels and representable native palette colors are editable. Palette
variants are views of the same native owners: one changed view is sufficient, unchanged
aliases do not veto it, and conflicting edits to one owner are rejected. Affected derived
previews refresh from accepted source. Hidden palette bits and opaque fields are preserved.

Composition placement, room cells, layer order, native geometry, animation timing, tile
allocation and relocation are read-only. H/V transforms are normalized; unsupported
native transforms are rejected. Compression must fit its declared native span. An
oversized edit produces a diagnostic before source writes.

Canvases support at most **4,194,304 pixels**, with an interchange side limit of 4096.
PNG files are bounded at 32 MiB; Aseprite files at 16 MiB. Decoded payload, metadata,
reference counts and rendering work have separate budgets. Large multi-frame or layered
documents can reach those budgets even when each frame fits the canvas limit.

## Interrupted application and cleanup

Uttori stages replacements and journals exact before/after values under the project's
operation lock. Normal source operations stop when publication needs recovery.
Uncoordinated external programs can observe intermediate filesystem renames; publication
is not globally atomic to every reader.

Save relevant drafts, then restore the before values or finish the after values:

```sh
uttori-asm asset recover /path/to/project --direction before
uttori-asm asset recover /path/to/project --direction after
```

VS Code provides **Assembly: Recover Interrupted Asset Edit**. Recovery verifies the
journal and current bytes and refuses to replace a third party's new changes. Inspect
the diagnostic and Git diff before resolving an unknown replacement.

Private exports/reviews live in `.uttori-local/asset-interchange`. They persist across
restarts; no age-based pruning runs automatically. To retire records, create a policy
with explicit export and review IDs:

```json
{ "exports": [], "reviews": [] }
```

```sh
uttori-asm asset cleanup /path/to/project --policy retire.json
uttori-asm asset cleanup /path/to/project --policy retire.json --review <cleanup-plan-id>
```

The first command previews cleanup. The second requires that exact inventory plan.
Retained reviews pin their exports; retire references together. Cleanup removes only
selected complete private records and their private blobs, preserving saved documents,
source files and Git history.

An interrupted private-record publication can leave an unusable `.staging-<uuid>`
directory in the `exports` or `reviews` store. To retire these leftovers, add the
optional `staging` selection to the same policy, using each directory's exact basename:

```json
{
  "exports": [],
  "reviews": [],
  "staging": {
    "exports": [".staging-12345678-1234-1234-1234-123456789abc"],
    "reviews": []
  }
}
```

The preview's `stagingInventory` lists every selected directory's regular files,
byte sizes and SHA-256 hashes, including partial publication temporaries. Preview and
apply both hold the project operation lock and validate completed-record references.
Changed filenames or bytes require a new preview; unknown files, subdirectories,
symlinks and excessive payloads stop cleanup. Only explicitly selected staging
directories are retired. Other crash leftovers remain until selected in a later policy.
