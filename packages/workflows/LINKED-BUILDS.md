# Native object and linked builds

The CLI and editor worker use `executeAssemblyBuildOperation` from `@uttori/asm-workflows/build`. Lightweight request/receipt validators and types are also available from `@uttori/asm-workflows/build-contracts`. Existing `assemble`, bare-source invocations and Asar source projects keep their absolute assembly behavior. Native module builds require an explicit command or configured manifest.

```sh
uttori-asm assemble-object src/main.asm build/main.uobj --module main --config uttori-asm.config.json
uttori-asm assemble-object src/helper.asm build/helper.uobj --module helper --config uttori-asm.config.json
uttori-asm library build/helpers.ulib build/helper.uobj
uttori-asm link link.json
uttori-asm build build.json
```

Object assembly requires a stable module ID. It uses ordinary plugin configuration, include paths and plugin options. Native `.uobj` objects and `.ulib` archives contain their own payloads and provenance. `link` reads serialized objects/libraries without reopening their assembly sources or assets. `build` first assembles the manifest's modules, then appends prebuilt objects and resolves libraries. Input order determines contributions and archive-provider priority. Library member names use each object's basename; duplicate names are rejected.

## Build manifest

All manifest paths resolve beside the manifest. The example's ROM starts at SNES `$808000` and occupies one 32 KiB LoROM bank. The [JSON schema](build.schema.json) supports editor completion for the host graph and main recipe fields; the linker performs full expression/layout validation.

```json
{
  "format": "uttori-build",
  "version": 1,
  "config": "uttori-asm.config.json",
  "modules": [{ "id": "main", "source": "src/main.asm" }],
  "libraries": ["build/helpers.ulib"],
  "recipe": {
    "target": "snes.sfc",
    "targetOptions": { "mapper": "lorom" },
    "checksumPolicy": "preserve",
    "regions": [
      { "name": "ROM", "start": 8421376, "size": 32768, "outputOffset": 0, "fillByte": 255 }
    ],
    "placements": [{ "section": "Code", "load": "ROM", "run": "ROM", "bankSize": 65536 }]
  },
  "outputDirectory": "build/linked",
  "outputName": "game.sfc"
}
```

Modules use `section`, `import` and `export` declarations. A separate `link.json` can replace `modules` with `"objects": ["build/main.uobj"]`. `recipe` may also be a path to a portable recipe JSON file. Configured include paths retain their normal config-relative meaning. Without a config, bundled SNES/NES defaults are selected by recipe target; object assembly defaults to SNES. Other targets require their plugin configuration and a target-owned link policy.

Set `original` to a complete original ROM path when checking a pristine build. Equality includes all container bytes, including any copier/iNES header. Checksums are preserved by default; use an explicit recipe policy to recompute them. Ordinary edited builds should omit `original` when intentional byte changes are expected.

## Source compatibility adapters

Existing source is adapted only when a module declares `sourceAdapter`. Omit the field for native sections. Bare-source and `assemble` commands retain the existing absolute Asar pipeline.

```json
{
  "format": "uttori-build",
  "version": 1,
  "config": "uttori-asm.config.json",
  "modules": [{ "id": "main", "source": "src/main.asm", "sourceAdapter": "asar" }],
  "recipe": { "from": "modules", "target": "snes.sfc" },
  "original": "original.sfc"
}
```

- **Asar:** `org`, `base`/`base off`, PC/base stacks and padding become ordinary relocatable contributions. Authored load/run addresses seed a replaceable recipe, with explicit gaps, fill, mapper/checksum policy and container bytes. SNES operand-width and repeat selection uses the existing numeric emitter through an isolated preview cursor, then writes symbolic native fixups. NES requires target `sourceStyle: "asar"`; physical `org` offsets and logical `base` addresses retain their distinct meanings.
- **ca65:** `sourceAdapter: "ca65"` reuses the existing supported segment/import/export directives and NES `linkerConfig` MEMORY/SEGMENTS/SYMBOLS conversion. Set the selector target to `65xx.nes`. RAM/BSS and initialized load/run overlays retain their existing configuration. Cartridge gaps inherit the existing absolute NES target's `fillByte` behavior.

For separate object assembly, use `--source-adapter asar` or `--source-adapter ca65`. The JSON object receipt includes its suggested `linkRecipe` when available. A composed build can combine disjoint authored Asar layouts or reuse one shared ca65 configuration. It publishes `<outputName>.recipe.json` and returns `recipeFile`; subsequent source-free `link` manifests can reference that portable file. An explicit recipe/path replaces source-derived placement and can move the sections without rebuilding objects.

Adapters retain the native module rules: sizes and preprocessing decisions must be assembly-time constants, unresolved imports use deterministic encodings, and the linker checks reach/bank constraints without automatic relaxation. Derived Asar recipes reject overlapping patches and sections spanning noncontiguous mapper storage; use the existing absolute patch workflow or an explicit disjoint recipe for those layouts. Recipe derivation assumes one consistent mapper configuration across its contributions. Retain forced operand widths when independent imports cannot establish the original encoding during assembly. Adopted disassembly projects use the explicit [Git migration workflow](DISASSEMBLY-MIGRATION.md).

## Editor

The command palette exposes **Assemble Relocatable Object**, **Create Object Library**, **Link Objects and Libraries**, and **Build Linked Project**. Object assembly offers Native sections, Asar source and ca65 source. They run the same service in the bundled source worker, with progress, cancellation and Workspace Trust enforcement.

Native manifests also select module-aware language-server analysis. Each source root retains its declared module ID and source adapter across index workers and cached snapshots; manifest/recipe/configuration changes refresh that selection. `@uttori/asm-workflows/build-selection` exposes the editor's data-only manifest selection helper.

To route ordinary **Build Binary**, **Run**, **Debug** and **Watch** through a native manifest, set `"linkProject": "build.json"` in `uttori-asm.config.json`, or set `asm.linkProject` relative to the workspace folder. A selected Git source project retains its Git workflow. **Prepare Migration to Linked Sources** opts generated source into native sections and a portable recipe; see [Disassembly Migration](DISASSEMBLY-MIGRATION.md). Ordinary Prepare preserves the selected build mode.

Builds consume saved files. The worker verifies consumed input bytes again after the editor checks live document versions and unsaved text/binary inputs. Watch tracks consumed configuration, recipe, source, resource and serialized input paths within the workspace. A failed opted-in build reports its error and preserves the previously selected artifacts.

## Results and plugin capabilities

Object/library commands print a compact JSON receipt. Link/build returns a matching ROM/debug-map pair plus symbols, allocation reports and the resolved recipe in one immutable directory. `outputDirectory/current.json` selects the complete set. Use the receipt's `outputFile` and `debugMapFile` rather than assuming a mutable top-level ROM filename. Repeated identical builds reuse the selected set and report unchanged ROM/map contents.

Host input identities include the manifest, recipe, configuration and serialized inputs alongside linker/plugin/bundle identities. Debug maps include those dependencies so final-address tooling expires when the build graph changes. The allocation report retains dependency hashes and selected archive members. Single-file object/archive writes use a staged rename and reject input/output aliases.

Host JSON files are limited to 16 MiB each, and one operation's consumed input snapshots are limited to 256 MiB. Artifact codec/linker budgets apply independently. Composed builds currently assemble each declared source module; prebuilt objects and indexed archives provide explicit incremental reuse.

`TargetContribution.createLinkTarget()` and optional `createSourceLinkRecipe(context, sections)` are additive capabilities under plugin API 2. SNES and NES register their existing phase 2 policies. A plugin lacking the hook remains valid for absolute assembly; native linking fails clearly instead of bypassing its target checks. Older object/archive versions continue to be checked by their codecs. This rollout introduces no object-format version change or automatic instruction relaxation.
