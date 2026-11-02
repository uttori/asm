# Migrating disassemblies to linked source

Existing Asar projects retain absolute assembly until an explicit linked generation is adopted. Migration uses the existing Git source workflow for SNES 65816 and NES projects with `.uttori/project.json` and an accepted `.uttori/generation.json` baseline. It preserves editable assembly, assets and Git-tracked research declarations.

## Prepare and adopt

Save configuration and research changes. Use the usual **Analyze Source Project Evidence** and **Refresh Capture Catalog** steps when their inputs have changed, and commit the source edits you intend to carry into the merge.

```sh
uttori-asm source prepare /path/to/project --linked
uttori-asm source preview /path/to/project <generation-commit>
uttori-asm source apply /path/to/project <generation-commit>
uttori-asm source finish /path/to/project
uttori-asm source build /path/to/project
```

In the editor, **Prepare Migration to Linked Sources** prepares the same candidate. Continue with **Preview Regeneration with Current Edits**, **Apply Previewed Generation** and **Validate and Finish Regeneration**. Prepare leaves the working source and index untouched. Native Git handles conflicts, edits and entry-point renames; a failed validation preserves the previous successful build. The normal abort/recovery flow remains available.

After adoption, ordinary Prepare Regeneration inherits linked mode from the reviewed compiler configuration. The default for projects without that selection remains absolute assembly.

## What enters the generation

- Native bank/segment sections retain the original contribution order, explicit operand widths, opaque bytes and raw asset slices.
- `link-recipe.json` records regions, load/run addresses, output offsets, sizes, container bytes and checksum policy. It is a replaceable placement recipe, rather than a fixed-address constraint in the object format.
- `build.json` is a portable native build manifest. The compiler configuration selects it with `linkProject`; existing options and entry-point names are retained. Portable build output goes under the project's ignored `.uttori-local/linked` directory.
- `link-verification.json` records complete original/output hashes, recipe identity, toolchain identity, output size and checks. It excludes temporary paths so unchanged preparations remain reproducible.

The initial Git source integration compiles one source unit containing independently placeable sections. The ordinary native build service also supports multiple modules, prebuilt objects and libraries. Git source builds explicitly reject unsupported graph additions instead of silently skipping them.

## Exactness and edited builds

Before retaining a linked candidate, generation assembles native records, serializes an object, links it, and compares the complete original container. SNES copier headers, NES headers/trainers/trailers, retained gaps and mirrored operand encodings are included. Original ROM/research identities remain unchanged. Pristine assets come from original ROM ranges or verified immutable Git blobs, never edited working assets.

Working source builds use final linker addresses for layout, CPU-state, placement, field and raw-consumption checks. Debug maps retain complete container offsets, including copier headers; original-ROM layout contracts retain their headerless offsets. Structured extent references resolve through the linker. Recipe, manifest and compiler bytes participate in freshness checks and debugger dependencies.

`source build` and the editor retain the Git project's validation and matching ROM/map publication. The portable manifest also works with ordinary `build`, `assemble-object` and standalone `link` commands described in [Linked Builds](LINKED-BUILDS.md). Serialized objects retain the payload and provenance needed to link after assembly and asset inputs are removed.

Migration preserves the original build; it does not establish new knowledge about opaque numeric references. Moving code still requires valid references, bank/reach constraints and calling conventions. Instruction relaxation, inferred references in compressed data, and automatic trampolines are outside this rollout.
