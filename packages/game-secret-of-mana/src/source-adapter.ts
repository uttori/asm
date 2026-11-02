import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { AssetInput } from "@uttori/asm-assets";
import { rewriteIndexedPng, extendIndexedPngPalette, readAssetPng } from "@uttori/asm-assets/image";
import { readFrameLayout } from "@uttori/asm-assets/secret-of-mana/som-frame-atlas";
import {
  normalizeSomSource,
  somPngPaletteViews,
} from "@uttori/asm-assets/secret-of-mana/som-source";
import { createSomSpriteInterchange } from "@uttori/asm-assets/secret-of-mana/som-sprite-interchange";
import { parseSpritePaletteCatalog } from "@uttori/asm-assets/secret-of-mana/som-sprite-palettes";
import { readAssetSourceBinding, type AssetSourceBinding } from "@uttori/asm-assets/source-binding";
import { indexedPngSourceCodec } from "@uttori/asm-assets/source-codecs";
import { assetSourceMediaType, type AssetEmissionInfo } from "@uttori/asm-core";
import { assertSourcePath, type SourceFileChange } from "@uttori/asm-disassembler/source-project";
import type {
  AssetConversionContext,
  AssetSourceConversionAdapter,
} from "@uttori/asm-workflows/asset-source";
import { editAssetCall, locateAssetCall } from "@uttori/asm-workflows/asset-source-edits";

import { readBossNativeReference } from "./assembly.js";

/** Encode a JSON record as UTF-8 bytes with a trailing newline. */
const json = (value: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(value, null, 2) + "\n");
/** Path of `to` relative to the directory containing `from`, always using `/`. */
const relative = (from: string, to: string): string =>
  path.relative(path.dirname(from), to).split(path.sep).join("/");

/** JSON declarations and include options are untrusted until their structural fields are checked. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** True when the value is an array whose elements still need their own checks. */
function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/** Only explicit string resource names can join the portable palette dependency closure. */
function isSourceNames(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((name: unknown) => typeof name === "string" && !!name);
}

/** Preserve declared representation hints when consuming another binding's active authoring file. */
function assetMediaType(file: string, context: AssetConversionContext): string {
  const representation = context.codecs
    .representations()
    .find((codec) => codec.extensions.some((extension) => file.toLowerCase().endsWith(extension)));
  if (representation) {
    return representation.mediaType;
  }
  return assetSourceMediaType(file);
}

/** Evaluated resources retain the include's declared keys, including the dynamically discovered binding closure. */
function resources(
  context: AssetConversionContext,
  emission: AssetEmissionInfo,
): Record<string, AssetInput> {
  return Object.fromEntries(
    Object.entries(emission.conversion!.resources).map(([key, absolute]) => [
      key,
      {
        bytes: context.read(absolute),
        mediaType: assetMediaType(absolute, context),
      },
    ]),
  );
}

/** SoM policy retains the complete native atlas and known compositions. The host and codecs remain game independent. */
export const somSourceConversionAdapter: AssetSourceConversionAdapter = {
  id: "som.sprite.native",
  supports: (emission) =>
    emission.format === "som.sprite.frames" || emission.format === "som.boss.graphics",
  async prepare(context) {
    const { build, selected, source, destination } = context;
    const options = selected.conversion!.options;
    const inputs = resources(context, selected);
    const layout = readFrameLayout(options, inputs);
    const catalog = parseSpritePaletteCatalog(inputs[String(options.palettes)].bytes);
    const related = build.mapping.assets.filter(
      (emission) => build.mapping.fileList[emission.assetFileIdx].name === source,
    );
    if (
      related.some(
        (emission) =>
          !this.supports(emission) || !emission.conversion || emission.transforms.length,
      )
    ) {
      throw new Error(
        "Source has unsupported or ambiguous native consumers; no source reference was changed.",
      );
    }
    const changes: SourceFileChange[] = [];
    const nativeFiles = new Map<string, string>();
    const updates: {
      emission: AssetEmissionInfo;
      path?: string;
      values: Record<string, unknown>;
    }[] = [];
    const projectName = (absolute: string) => {
      const result = path.relative(build.root, absolute).split(path.sep).join("/");
      assertSourcePath(result);
      return result;
    };
    let bindingFile: string;
    let binding: AssetSourceBinding;
    let canonical: AssetInput;
    let currentLayout = layout;
    let currentCatalog = catalog;
    const sourceInput = {
      bytes: context.read(source),
      mediaType: context.codecs.identify(context.read(source), { path: source }).mediaType,
    };
    if (typeof options.sourceBinding === "string") {
      bindingFile = selected.conversion!.resources[options.sourceBinding];
      binding = readAssetSourceBinding(inputs[options.sourceBinding].bytes);
      const normalized = normalizeSomSource(sourceInput, options, inputs, catalog, context.codecs);
      canonical = normalized.source;
      currentLayout = normalized.layout;
      currentCatalog = normalized.catalog;
      changes.push({
        path: projectName(bindingFile),
        before: context.read(bindingFile),
        after: json({
          ...binding,
          source: {
            path: relative(bindingFile, destination),
            representation: context.representation,
          },
        }),
      });
    } else {
      bindingFile = source.replace(/\.[^.]+$/, ".source.json");
      const referenceFile = source.replace(/\.[^.]+$/, ".reference.png");
      const referenceCatalog = source.replace(/\.[^.]+$/, ".reference-palettes.json");
      canonical = sourceInput;
      if (canonical.mediaType !== "image/png") {
        throw new Error(
          "A composed source needs a portable sourceBinding; convert its native PNG first.",
        );
      }
      const nativeResources: Record<string, string> = {};
      const declarations = related.map((emission) => {
        let nativeOptions = emission.conversion!.options;
        if (emission.format === "som.boss.graphics") {
          const native = readBossNativeReference(canonical, nativeOptions, inputs);
          if (!native) {
            throw new Error(
              "Compressed source conversion requires its exact original native stream.",
            );
          }
          const segment = String(nativeOptions.segment);
          const nativeFile = source.replace(/\.[^.]+$/, `.${segment}.native.bin`);
          changes.push({ path: projectName(nativeFile), before: null, after: native });
          nativeResources[`native:${segment}`] = relative(bindingFile, nativeFile);
          nativeFiles.set(segment, nativeFile);
          nativeOptions = { ...nativeOptions, native: `native:${segment}` };
        }
        return { format: emission.format, options: nativeOptions };
      });
      binding = {
        format: "uttori-asset-source",
        version: 1,
        id: randomUUID(),
        adapter: this.id,
        source: {
          path: relative(bindingFile, destination),
          representation: context.representation,
        },
        resources: {
          reference: relative(bindingFile, referenceFile),
          layout: relative(bindingFile, selected.conversion!.resources[String(options.layout)]),
          palettes: relative(bindingFile, referenceCatalog),
          ...nativeResources,
        },
        native: declarations,
      };
      for (const [absolute, bytes] of [
        [referenceFile, canonical.bytes],
        [referenceCatalog, json(catalog)],
        [bindingFile, json(binding)],
      ] as const) {
        changes.push({ path: projectName(absolute), before: null, after: bytes });
      }
    }
    const nativeOptions = Object.fromEntries(
      binding.native.flatMap((entry) =>
        entry.format === "som.boss.graphics"
          ? [[String(entry.options.segment), entry.options]]
          : [],
      ),
    );
    const atlas = {
      id: binding.id,
      source: canonical,
      layout: currentLayout,
      nativeOptions,
      resources: inputs,
    };
    const presentation = createSomSpriteInterchange(atlas, currentCatalog, binding.id);
    let bytes: Uint8Array;
    if (context.representation === "indexed-png") {
      // Canonical native storage includes guide indexes and unused owners; timeline cels never stand in for it.
      const primary = currentLayout.paletteRefs.flatMap((palette) => {
        const start = presentation.paletteSlots.findIndex((slot) => slot.palette === palette);
        return presentation.baseline.document.palette.slice(start, start + 16);
      });
      // Complete owner/native validation above and the candidate ROM oracle protect these embedded
      // original streams. Retain each declared stream across palette-only container changes.
      const preserved = readAssetPng(canonical.bytes)
        .chunks.filter((chunk) => /^soM[A-Z]$/.test(chunk.type))
        .map((chunk) => chunk.type);
      bytes = rewriteIndexedPng(canonical.bytes, {
        palette: [
          ...primary,
          ...indexedPngSourceCodec
            .decode(canonical.bytes, presentation.baseline.document)
            .palette.slice(primary.length),
        ],
        preserveChunks: preserved,
      });
      const views = somPngPaletteViews(atlas, currentCatalog);
      bytes = extendIndexedPngPalette(
        bytes,
        views.document.palette.map((color, index) =>
          index < primary.length ? primary[index] : color,
        ),
        preserved,
      );
    } else {
      bytes = await context.codecs
        .get(context.representation)
        .encode(presentation.baseline.document);
    }
    const catalogFile = selected.conversion!.resources[String(options.palettes)];
    for (const emission of build.mapping.assets) {
      if (!emission.conversion) {
        continue;
      }
      const assembly = build.mapping.fileList[emission.fileIdx].name;
      const sameSource = build.mapping.fileList[emission.assetFileIdx].name === source;
      const sameCatalog =
        emission.conversion.resources[String(emission.conversion.options.palettes)] === catalogFile;
      const paletteOutput =
        emission.format === "som.palette.bgr555" &&
        build.mapping.fileList[emission.assetFileIdx].name === catalogFile;
      if (!sameSource && !sameCatalog && !paletteOutput) {
        continue;
      }
      const previous = emission.conversion.options.paletteSources;
      if (previous !== undefined && !isSourceNames(previous)) {
        throw new Error("Invalid paletteSources resource names.");
      }
      const values: Record<string, unknown> = {
        paletteSources: [...new Set([...(previous ?? []), relative(assembly, bindingFile)])],
      };
      if (sameSource) {
        values.sourceBinding = relative(assembly, bindingFile);
        const nativeFile = nativeFiles.get(String(emission.conversion.options.segment));
        if (nativeFile) {
          values.native = relative(assembly, nativeFile);
        }
      }
      updates.push({
        emission,
        path: sameSource ? relative(assembly, destination) : undefined,
        values,
      });
    }
    // Source-owned regeneration declarations keep their original address/extents while switching only the working directive.
    const declaration = path.join(build.root, "asset-includes.json");
    if (fs.existsSync(declaration)) {
      const before = fs.readFileSync(declaration);
      if (before.length > 16 * 1024 * 1024) {
        throw new Error("Asset include declarations exceed their budget.");
      }
      const value: unknown = JSON.parse(before.toString("utf8"));
      if (!isRecord(value) || !isUnknownArray(value.entries)) {
        throw new Error("Invalid asset include declarations.");
      }
      for (const update of updates) {
        const entries = value.entries
          .filter(isRecord)
          .filter((entry) => entry.start === update.emission.outputOffset);
        if (entries.length > 1) {
          throw new Error("Ambiguous regeneration declaration ownership.");
        }
        for (const entry of entries) {
          if (typeof entry.directive !== "string") {
            throw new Error("Invalid regeneration asset directive.");
          }
          entry.directive = editAssetCall(entry.directive, locateAssetCall(entry.directive, 1), {
            path: update.path,
            values: update.values,
          });
        }
      }
      const after = json(value);
      if (!Buffer.from(after).equals(before)) {
        changes.push({ path: projectName(declaration), before, after });
      }
    }
    // Every current emitting consumer was resolved above. The fixed reference PNG carries original pixels/chunks independently.
    changes.push({ path: projectName(source), before: context.read(source), after: null });
    return { bytes, changes, updates, retained: [] };
  },
};
