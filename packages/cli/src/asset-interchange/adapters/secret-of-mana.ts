import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import type { AssetInput } from "@uttori/asm-assets";
import {
  quantizeAnimationEvidence,
  type QuantizedAnimationRun,
} from "@uttori/asm-assets/animation-evidence";
import { ASSET_LIMITS } from "@uttori/asm-assets/limits";
import { convertBossImage } from "@uttori/asm-assets/secret-of-mana/som-asset-plugin";
import { planSomAtlasImport } from "@uttori/asm-assets/secret-of-mana/som-atlas-interchange";
import {
  bindFrameAtlasPalette,
  encodeFrameAtlas,
  inspectFrameAtlas,
  readFrameAtlasSelection,
  readFrameLayout,
  frameAtlasSegmentOrder,
} from "@uttori/asm-assets/secret-of-mana/som-frame-atlas";
import {
  readSomObservationDeclaration,
  resolveSomObservationEvidence,
} from "@uttori/asm-assets/secret-of-mana/som-observation-evidence";
import {
  inspectSpritePaletteUsers,
  planSpritePaletteWords,
} from "@uttori/asm-assets/secret-of-mana/som-palette-edit";
import {
  createSomSpriteInterchange,
  type SomInterchangePaletteSlot,
} from "@uttori/asm-assets/secret-of-mana/som-sprite-interchange";
import {
  parseSpritePaletteCatalog,
  spritePaletteBytes,
  type SpritePaletteCatalog,
} from "@uttori/asm-assets/secret-of-mana/som-sprite-palettes";
import type { SpriteAtlasSource } from "@uttori/asm-assets/secret-of-mana/som-types";
import type { AssetEmissionInfo } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { assertSourcePath, type SourceFileReplacement } from "@uttori/asm-disassembler";

import type { AssetAdapterContext, AssetNativeEffect, AssetSourceAdapter } from "../contracts.js";

/** Explicit complete catalogue consumer closure. Paths are portable relative to the selected source project. */
export interface SomSpriteSelection {
  readonly atlasId: string;
  readonly image: string;
  readonly layout: string;
  readonly catalog: string;
  /** Optional source-owned observation selection and retained proof; container codecs never resolve capture paths. */
  readonly observations?: { readonly declaration: string; readonly proof: string };
  readonly atlases: readonly {
    readonly id: string;
    readonly image: string;
    readonly layout: string;
  }[];
}
interface SomSpriteBindings {
  readonly paletteSlots: readonly SomInterchangePaletteSlot[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error("Invalid SoM interchange declaration.");
  }
  return value;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.length || value.length > 1024) {
    throw new Error("Invalid SoM interchange identity.");
  }
  return value;
}
function name(value: unknown): string {
  const result = text(value);
  assertSourcePath(result);
  return result;
}
function json(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value, null, 2) + "\n");
}
function equal(a: Uint8Array, b: Uint8Array): boolean {
  return Buffer.from(a).equals(b);
}
function relative(context: AssetAdapterContext, absolute: string): string {
  const result = path.relative(context.build.root, absolute).split(path.sep).join("/");
  assertSourcePath(result);
  return result;
}

/** Actual evaluated includes retain all format resources/options. No filename or raw tile-byte guess selects encoding. */
function graphics(
  context: AssetAdapterContext,
  selection: SomSpriteSelection,
): AssetEmissionInfo[] {
  const result = context.build.mapping.assets.filter(
    (entry) =>
      context.build.mapping.fileList[entry.assetFileIdx]?.name ===
      path.join(context.build.root, selection.image),
  );
  if (!result.length) {
    throw new Error(`No current emitting include for ${selection.image}.`);
  }
  for (const emission of result) {
    if (
      (emission.format !== "som.sprite.frames" && emission.format !== "som.boss.graphics") ||
      !emission.conversion ||
      emission.conversion.transforms.length ||
      emission.transforms.length ||
      emission.outputOffset === undefined ||
      emission.conversion.resources[String(emission.conversion.options.layout)] !==
        path.join(context.build.root, selection.layout) ||
      emission.conversion.resources[String(emission.conversion.options.palettes)] !==
        path.join(context.build.root, selection.catalog)
    ) {
      throw new Error(`Unsupported or incomplete current graphics include: ${selection.image}.`);
    }
    if (
      emission.format === "som.boss.graphics" &&
      (emission.conversion.options.sizePolicy ?? "fixed") !== "fixed"
    ) {
      throw new Error(
        `Graphics ${selection.image}: interchange currently requires a fixed native span.`,
      );
    }
  }
  return result;
}

function resourceInputs(
  context: AssetAdapterContext,
  emission: AssetEmissionInfo,
): Record<string, AssetInput> {
  const inputs: Record<string, AssetInput> = {};
  for (const [declared, absolute] of Object.entries(emission.conversion?.resources ?? {})) {
    inputs[declared] = {
      bytes: context.read(relative(context, absolute)),
      mediaType: declared.endsWith(".json") ? "application/json" : "application/octet-stream",
    };
  }
  return inputs;
}

/** Decode source values with normal sidecar validators and the exact current compression reference bundle. */
function atlas(
  context: AssetAdapterContext,
  user: SomSpriteSelection["atlases"][number],
  catalog: SpritePaletteCatalog,
  emissions: readonly AssetEmissionInfo[] = [],
): SpriteAtlasSource {
  const bytes = context.read(user.layout),
    resources: Record<string, AssetInput> = {};
  const layout = readFrameLayout(
    { layout: user.layout },
    { [user.layout]: { bytes, mediaType: "application/json" } },
  );
  const nativeOptions: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const emission of emissions) {
    const inputs = resourceInputs(context, emission);
    for (const [key, value] of Object.entries(inputs)) {
      if (resources[key] && !equal(resources[key].bytes, value.bytes)) {
        throw new Error(`Ambiguous declared resource ${key}.`);
      }
      resources[key] = value;
    }
    if (emission.format === "som.boss.graphics") {
      const options = emission.conversion!.options,
        segment = text(options.segment);
      if (nativeOptions[segment]) {
        throw new Error(`Duplicate native segment emission: ${segment}.`);
      }
      nativeOptions[segment] = options;
    }
  }
  const result = {
    id: user.id,
    source: { bytes: context.read(user.image), mediaType: "image/png" },
    layout,
    nativeOptions,
    resources,
  };
  inspectFrameAtlas(result.source, layout, catalog, { whole: true });
  return result;
}

/** Use the same native conversion entry points as assembly, retaining compression originals and padding policy. */
function encode(
  emission: AssetEmissionInfo,
  source: SpriteAtlasSource,
  catalog: SpritePaletteCatalog,
): Uint8Array {
  const options = emission.conversion!.options,
    layoutName = text(options.layout),
    paletteName = text(options.palettes);
  const resources = {
    ...source.resources,
    [layoutName]: { bytes: json(source.layout), mediaType: "application/json" },
    [paletteName]: { bytes: json(catalog), mediaType: "application/json" },
  };
  let bytes: Uint8Array;
  if (emission.format === "som.boss.graphics") {
    bytes = convertBossImage(source.source, options, resources).outputs.graphics.bytes;
  } else {
    bytes = encodeFrameAtlas(
      source.source,
      source.layout,
      readFrameAtlasSelection(options),
      catalog,
    );
  }
  if (
    bytes.length !== emission.size ||
    (emission.conversion!.maxSize !== undefined && bytes.length > emission.conversion!.maxSize)
  ) {
    throw new Error(
      `Native resource ${source.id} at ${emission.outputOffset}: encoded output exceeds or changes fixed span ${emission.size}.`,
    );
  }
  return Uint8Array.from(bytes);
}

/** Current emission extents, rather than tile-count arithmetic, identify output ownership and physical aliases. */
function assertEffect(
  context: AssetAdapterContext,
  owner: AssetEmissionInfo,
  before: Uint8Array,
): void {
  const offset = owner.outputOffset!;
  const overlapping = context.build.mapping.assets.filter(
    (entry) =>
      entry.outputOffset !== undefined &&
      entry.outputOffset < offset + owner.size &&
      offset < entry.outputOffset + entry.size,
  );
  if (
    overlapping.length !== 1 ||
    overlapping[0] !== owner ||
    !equal(context.build.output.subarray(offset, offset + owner.size), before)
  ) {
    throw new Error(
      `Native include does not uniquely own emitted span ${offset}..${offset + owner.size}.`,
    );
  }
}

function inspect(context: AssetAdapterContext, selection: SomSpriteSelection) {
  const emitted = graphics(context, selection),
    catalog = parseSpritePaletteCatalog(context.read(selection.catalog));
  const all = selection.atlases.map((user) =>
    atlas(
      context,
      user,
      catalog,
      user.id === selection.atlasId
        ? emitted
        : context.build.mapping.assets.filter(
            (entry) =>
              entry.format === "som.boss.graphics" &&
              context.build.mapping.fileList[entry.assetFileIdx]?.name ===
                path.join(context.build.root, user.image),
          ),
    ),
  );
  const selected = all.find((item) => item.id === selection.atlasId);
  if (!selected) {
    throw new Error("Selected SoM atlas is missing from the complete consumer closure.");
  }
  const audit = inspectSpritePaletteUsers(catalog, all);
  if (audit.errors.length) {
    throw new Error(audit.errors.join("\n"));
  }
  const owned = new Set<string>();
  for (const emission of emitted) {
    const options = emission.conversion!.options,
      selector = readFrameAtlasSelection(options);
    let segments: readonly string[];
    if (typeof selector === "string") {
      segments = [selector];
    } else {
      segments = frameAtlasSegmentOrder(selected.layout, selector);
    }
    for (const segment of segments) {
      if (!selected.layout.segments[segment] || owned.has(segment)) {
        throw new Error(`Incomplete or duplicate native ownership: ${segment}.`);
      }
      owned.add(segment);
    }
    assertEffect(context, emission, encode(emission, selected, catalog));
  }
  if (owned.size !== Object.keys(selected.layout.segments).length) {
    throw new Error("Native includes omit declared sprite inventory.");
  }
  const dependencies = new Set([
    selection.catalog,
    ...selection.atlases.flatMap((user) => [user.image, user.layout]),
  ]);
  for (const emission of emitted) {
    dependencies.add(relative(context, context.build.mapping.fileList[emission.fileIdx].name));
    for (const absolute of Object.values(emission.conversion!.resources)) {
      dependencies.add(relative(context, absolute));
    }
  }
  // Every consumer's original stream matters even when the selected palette edit only rebinds its layout.
  for (const emission of context.build.mapping.assets) {
    if (
      all.some(
        (user) =>
          context.build.mapping.fileList[emission.assetFileIdx]?.name ===
          path.join(
            context.build.root,
            selection.atlases.find((item) => item.id === user.id)!.image,
          ),
      )
    ) {
      for (const absolute of Object.values(emission.conversion?.resources ?? {})) {
        dependencies.add(relative(context, absolute));
      }
    }
  }
  return { selected, all, catalog, emitted, dependencies: [...dependencies].toSorted() };
}

/** Bound decompression and pin exact evidence bytes before adapting measured holds into presentation-only ranges. */
function observedRuns(
  context: AssetAdapterContext,
  selection: SomSpriteSelection,
  source: SpriteAtlasSource,
): QuantizedAnimationRun[] {
  if (!selection.observations) {
    return [];
  }
  const declarationBytes = context.read(selection.observations.declaration);
  if (declarationBytes.length > ASSET_LIMITS.metadataBytes) {
    throw new Error("Observation declaration exceeds its metadata budget.");
  }
  const declaration = readSomObservationDeclaration(
      JSON.parse(new TextDecoder().decode(declarationBytes)),
    ),
    bytes = context.read(selection.observations.proof),
    project = object(JSON.parse(new TextDecoder().decode(context.read(".uttori/project.json"))));
  if (
    project.romSha256 !== declaration.romSha256 ||
    createHash("sha256").update(bytes).digest("hex") !== declaration.proofSha256
  ) {
    throw new Error("Observation proof does not match its declared ROM/source identity.");
  }
  let decoded = bytes;
  if (selection.observations.proof.endsWith(".gz")) {
    decoded = gunzipSync(bytes, { maxOutputLength: ASSET_LIMITS.metadataBytes });
  }
  if (decoded.length > ASSET_LIMITS.metadataBytes) {
    throw new Error("Observation proof exceeds its metadata budget.");
  }
  const proof: unknown = JSON.parse(new TextDecoder().decode(decoded)),
    resolved = resolveSomObservationEvidence(proof, declaration, source.layout.frames ?? []);
  return quantizeAnimationEvidence(resolved.sequences);
}

/** SoM native interpretation is injected into the common host; it never publishes source or trusts imported bindings. */
export const somSpriteSourceAdapter: AssetSourceAdapter<SomSpriteSelection, SomSpriteBindings> = {
  id: "som.sprite.native",
  version: 2,
  module: fileURLToPath(import.meta.url),
  capabilities: {
    pixelEdits: true,
    paletteEdits: true,
    tileReferences: true,
    previewTimeline: true,
  },
  readSelection(value) {
    const input = object(value);
    if (!Array.isArray(input.atlases) || !input.atlases.length || input.atlases.length > 65536) {
      throw new Error("Missing SoM consumer closure.");
    }
    const atlases = input.atlases.map((entry) => {
      const user = object(entry);
      return { id: text(user.id), image: name(user.image), layout: name(user.layout) };
    });
    let observations: SomSpriteSelection["observations"];
    if (input.observations !== undefined) {
      const selection = object(input.observations);
      observations = { declaration: name(selection.declaration), proof: name(selection.proof) };
    }
    const result = {
      atlasId: text(input.atlasId),
      image: name(input.image),
      layout: name(input.layout),
      catalog: name(input.catalog),
      atlases,
      observations,
    };
    if (
      new Set(atlases.map((user) => user.id)).size !== atlases.length ||
      !atlases.some(
        (user) =>
          user.id === result.atlasId &&
          user.image === result.image &&
          user.layout === result.layout,
      )
    ) {
      throw new Error("Invalid selected SoM consumer identity.");
    }
    return result;
  },
  readBindings(value) {
    const input = object(value);
    if (!Array.isArray(input.paletteSlots) || input.paletteSlots.length > 256) {
      throw new Error("Invalid SoM palette binding.");
    }
    const paletteSlots = input.paletteSlots.map((entry) => {
      const slot = object(entry);
      if (
        typeof slot.index !== "number" ||
        !Number.isInteger(slot.index) ||
        slot.index < 0 ||
        slot.index > 15
      ) {
        throw new Error("Invalid SoM palette slot.");
      }
      return { palette: text(slot.palette), index: slot.index };
    });
    return { paletteSlots };
  },
  export(context, selection, exportId) {
    const current = inspect(context, selection),
      presentation = createSomSpriteInterchange(
        current.selected,
        current.catalog,
        exportId,
        observedRuns(context, selection, current.selected),
      );
    return {
      asset: selection.atlasId,
      baseline: presentation.baseline,
      bindings: { paletteSlots: presentation.paletteSlots },
      dependencies: current.dependencies,
    };
  },
  plan(context, selection, bindings, changes) {
    const current = inspect(context, selection),
      presentation = createSomSpriteInterchange(
        current.selected,
        current.catalog,
        "00000000-0000-0000-0000-000000000000",
        observedRuns(context, selection, current.selected),
      );
    if (canonicalJson(bindings.paletteSlots) !== canonicalJson(presentation.paletteSlots)) {
      throw new Error("SoM private palette binding no longer matches current source.");
    }
    const palettePlan = planSpritePaletteWords(
      current.catalog,
      changes.colors.map((change) => {
        const slot = bindings.paletteSlots[change.index];
        if (!slot || !presentation.baseline.editablePaletteSlots.includes(change.index)) {
          throw new Error("Unknown native SoM palette authority.");
        }
        return { palette: slot.palette, index: slot.index, rgb: change.color.slice(0, 3) };
      }),
    );
    const pixelPlan = planSomAtlasImport(current.selected, current.catalog, {
      pixels: changes.pixels,
      colors: [],
    });
    const files: SourceFileReplacement[] = [],
      effects: AssetNativeEffect[] = [];
    const add = (file: string, after: Uint8Array): void => {
      const before = context.read(file);
      if (!equal(before, after)) {
        files.push({ path: file, before, after });
      }
    };
    if (changes.pixels.length || palettePlan.palettes.length) {
      const layout = bindFrameAtlasPalette(
        current.selected.source,
        current.selected.layout,
        current.catalog,
      );
      const next = {
        ...current.selected,
        source: { bytes: pixelPlan.png, mediaType: "image/png" },
        layout,
      };
      add(selection.image, pixelPlan.png);
      add(selection.layout, json(layout));
      if (palettePlan.palettes.length) {
        add(selection.catalog, json(palettePlan.catalog));
        for (const source of current.all) {
          if (
            source.id !== selection.atlasId &&
            source.layout.paletteRefs.some((id) => palettePlan.palettes.includes(id))
          ) {
            const user = selection.atlases.find((item) => item.id === source.id)!;
            add(
              user.layout,
              json(bindFrameAtlasPalette(source.source, source.layout, current.catalog)),
            );
          }
        }
      }
      for (const emission of current.emitted) {
        const before = encode(emission, current.selected, current.catalog),
          after = encode(emission, next, palettePlan.catalog);
        if (!equal(before, after)) {
          effects.push({
            resource: `${selection.atlasId}:${emission.format}:${emission.line}`,
            offset: emission.outputOffset!,
            before,
            after,
            consumers: [selection.atlasId],
          });
        }
      }
      for (const emission of context.build.mapping.assets.filter(
        (entry) =>
          entry.format === "som.palette.bgr555" &&
          context.build.mapping.fileList[entry.assetFileIdx]?.name ===
            path.join(context.build.root, selection.catalog),
      )) {
        const conversion = emission.conversion;
        if (
          !conversion ||
          conversion.transforms.length ||
          emission.outputOffset === undefined ||
          typeof conversion.options.palette !== "string"
        ) {
          throw new Error("Unsupported current palette emission contract.");
        }
        const options = conversion.options,
          paletteId = text(options.palette);
        const slice = {
          wordOffset: typeof options.wordOffset === "number" ? options.wordOffset : undefined,
          wordCount: typeof options.wordCount === "number" ? options.wordCount : undefined,
        };
        const before = spritePaletteBytes(current.catalog, paletteId, slice),
          after = spritePaletteBytes(palettePlan.catalog, paletteId, slice);
        assertEffect(context, emission, before);
        if (!equal(before, after)) {
          effects.push({
            resource: `palette:${paletteId}`,
            offset: emission.outputOffset,
            before,
            after,
            consumers: current.catalog.palettes[paletteId].users?.map((user) => user.atlas) ?? [],
          });
        }
      }
    }
    return { files, effects };
  },
};
