import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { applyAssetFileChanges, type AssetFileChange } from "@uttori/asm-assets/node";
import { decodeBodyFrame } from "@uttori/asm-assets/secret-of-mana/som-body-frame";
import {
  bindFrameAtlasPalette,
  inspectFrameAtlas,
  encodeInspectedFrameSegment,
} from "@uttori/asm-assets/secret-of-mana/som-frame-atlas";
import { inspectSpritePaletteUsers } from "@uttori/asm-assets/secret-of-mana/som-palette-edit";
import {
  createSomSpriteEditorBundle,
  planSomSpriteEditorChanges,
} from "@uttori/asm-assets/secret-of-mana/som-sprite-editing";
import {
  spritePaletteBytes,
  type SpritePaletteCatalog,
} from "@uttori/asm-assets/secret-of-mana/som-sprite-palettes";
import type { SpriteAtlasSource } from "@uttori/asm-assets/secret-of-mana/som-types";
import {
  inspectSpriteEditorResult,
  type SpriteEditorBundle,
} from "@uttori/asm-assets/sprite-editing";
import { planTypedSourceEdits, type TypedSourcePatch } from "@uttori/asm-core";
import { canonicalJson } from "@uttori/asm-core/canonical-json";
import {
  openSourceProject,
  sourceGit,
  assertSourcePath,
} from "@uttori/asm-disassembler/source-project";
import { inspectSourceProject, type SourceProjectInspection } from "@uttori/asm-workflows/source";

/** Source-validation fixture inputs; atlas identity is the catalogue user identity, never a basename guess. */
export interface RoundtripSelection {
  readonly directory: string;
  readonly image: string;
  readonly layout: string;
  readonly catalog: string;
  readonly atlasId: string;
  /** All catalogue users, including runtime variants and compressed atlases, must be represented. */
  readonly atlases: readonly { id: string; image: string; layout: string }[];
}

/** Local trusted session. Exported editor files cannot redefine source baselines or capabilities. */
interface Session {
  readonly format: "uttori-sprite-session";
  readonly version: 1;
  readonly selection: RoundtripSelection;
  readonly bundle: SpriteEditorBundle;
  readonly files: readonly { path: string; sha256: string }[];
  readonly head: string;
  readonly configuration: string;
  readonly toolchain: string;
  readonly adapter: string;
  readonly output: string;
}

/** Fully assembled prospective edit. Applying requires another complete freshness check. */
export interface RoundtripPlan {
  readonly session: string;
  readonly changes: readonly AssetFileChange[];
  readonly output: Uint8Array;
  readonly outputSha256: string;
  readonly changedOffsets: readonly number[];
}

const hash = (bytes: string | Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");
const equal = (a: Uint8Array, b: Uint8Array): boolean => Buffer.from(a).equals(b);
const jsonBytes = (value: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(value, null, 2) + "\n");
/** Read host-authored declarations. Editor JSON is independently validated as unknown input. */
// The caller selects the host-authored fixture contract at this deliberate typed JSON boundary.
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
function readJson<T>(file: string): T {
  const value: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  // Local session and project contracts are trusted inputs; downstream native checks reject corruption.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return value as T;
}

/** Pin fixture and adapter behavior independently of the assembler toolchain identity. */
function adapterHash(): string {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  return hash(
    canonicalJson(
      [
        "tests/fixtures/sprite-roundtrip-host.ts",
        "packages/assets/src/sprite-editing.ts",
        "packages/assets/src/secret-of-mana/som-sprite-editing.ts",
        "packages/core/src/source-field-edits.ts",
      ].map((name) => [name, hash(fs.readFileSync(path.join(root, name)))]),
    ),
  );
}

/** Resolve source paths inside the selected checkout; symlinks cannot redirect publication elsewhere. */
function sourcePath(root: string, name: string): string {
  assertSourcePath(name);
  const file = path.join(root, name);
  const relative = path.relative(fs.realpathSync(root), fs.realpathSync(file));
  if (relative.startsWith("../") || path.isAbsolute(relative) || !fs.lstatSync(file).isFile()) {
    throw new Error(`Round-trip source must be a regular file in this checkout: ${name}.`);
  }
  return file;
}

function atlas(
  root: string,
  selection: { id: string; image: string; layout: string },
): SpriteAtlasSource {
  return {
    id: selection.id,
    source: { bytes: fs.readFileSync(sourcePath(root, selection.image)), mediaType: "image/png" },
    layout: readJson(sourcePath(root, selection.layout)),
  };
}

/** Use the assembler's address attribution rather than assuming a particular SNES mapper. */
function outputOffset(build: SourceProjectInspection, address: number): number {
  const offsets = new Set(
    build.mapping.ranges.flatMap((range) => {
      if (
        range.addressSpace !== "snes.cpu" ||
        range.outputStart === undefined ||
        address < range.start ||
        address >= range.end
      ) {
        return [];
      }
      return [range.outputStart + address - range.start];
    }),
  );
  if (offsets.size !== 1) {
    throw new Error(`Native address has no unique emitted owner: ${address.toString(16)}.`);
  }
  return [...offsets][0];
}

function requireBuild(build: SourceProjectInspection): void {
  if (build.diagnostics.length) {
    throw new Error(build.diagnostics.map((v) => v.message).join("\n"));
  }
}

/**
 * Retained frame bytes are caches. Refresh coordinate caches from current typed assembly, while
 * rejecting changes to flags, tokens or bounds that this adapter cannot reconcile faithfully.
 */
function currentAtlas(
  build: SourceProjectInspection,
  selected: SpriteAtlasSource,
  catalog: SpritePaletteCatalog,
): SpriteAtlasSource {
  const next = structuredClone(selected);
  const inspected = inspectFrameAtlas(selected.source, selected.layout, catalog, { whole: true });
  const spans: { start: number; end: number }[] = [];
  for (const name of Object.keys(selected.layout.segments)) {
    const address = Number.parseInt(selected.layout.segments[name].romAddress, 16);
    const bytes = encodeInspectedFrameSegment(inspected, name);
    const offset = outputOffset(build, address);
    const end = offset + bytes.length;
    if (spans.some((span) => offset < span.end && span.start < end)) {
      throw new Error(
        "Overlapping atlas segments require a shared-pixel reconciliation capability.",
      );
    }
    spans.push({ start: offset, end });
    // A continuous multi-segment include owns several logical strips in one emission. Attribution
    // must cover the full strip; requiring an exact per-segment emission would reject adopted atlases.
    const emissions = build.mapping.assets.filter(
      (v) =>
        v.outputOffset !== undefined &&
        v.outputOffset <= offset &&
        end <= v.outputOffset + v.size &&
        v.format === "som.sprite.frames" &&
        build.mapping.fileList[v.assetFileIdx]?.name === selected.id,
    );
    // The caller replaces the public atlas ID with the exact source path for this ownership check.
    if (
      emissions.length !== 1 ||
      !equal(build.output.subarray(offset, offset + bytes.length), bytes)
    ) {
      throw new Error(`Atlas pixels do not own the current emitted segment: ${name}.`);
    }
  }
  for (const frame of next.layout.frames ?? []) {
    const native = frame.nativeFrame;
    if (!native?.bytes || !frame.blocks || native.end - native.address !== native.bytes.length) {
      throw new Error("Missing bounded native body source.");
    }
    const offset = outputOffset(build, native.address);
    const bytes = build.output.slice(offset, offset + native.bytes.length);
    const before = decodeBodyFrame(native.bytes);
    const after = decodeBodyFrame(bytes);
    const coordinates = new Set(before.coordinateOffsets.flatMap((v) => [v.x, v.y]));
    if (
      after.groups !== before.groups ||
      frame.blocks.length !== after.groups ||
      bytes.some((v, i) =>
        coordinates.has(i) ? (v & 128) !== (native.bytes![i] & 128) : v !== native.bytes![i],
      )
    ) {
      throw new Error("Current body source changed outside supported coordinate fields.");
    }
    for (const [index, block] of frame.blocks.entries()) {
      const decoded = after.blocks[index];
      const dx = decoded.x - block.x;
      const dy = decoded.y - block.y;
      for (const placement of frame.placements ?? []) {
        if (placement.block === block.id) {
          placement.x += dx;
          placement.y += dy;
        }
      }
      block.x = decoded.x;
      block.y = decoded.y;
    }
    native.bytes = [...bytes];
    // Require encoder attribution for every editable coordinate before offering movement in the editor.
    for (const coordinate of after.coordinateOffsets.flatMap((v) => [v.x, v.y])) {
      const old = bytes[coordinate];
      planTypedSourceEdits({
        ...build,
        patches: [
          {
            offset: offset + coordinate,
            before: Uint8Array.of(old),
            after: Uint8Array.of(old ^ 1),
          },
        ],
      });
    }
  }
  return next;
}

/** Cross-atlas native sharing needs a wider reconciliation policy than this single-atlas spike. */
function requireIndependentOwners(
  selected: SpriteAtlasSource,
  others: readonly SpriteAtlasSource[],
): void {
  for (const other of others) {
    for (const a of Object.values(selected.layout.segments)) {
      for (const b of Object.values(other.layout.segments)) {
        const startA = Number.parseInt(a.romAddress, 16),
          startB = Number.parseInt(b.romAddress, 16);
        if (startA < startB + b.tiles.length * 32 && startB < startA + a.tiles.length * 32) {
          throw new Error(
            "Cross-atlas shared graphics require a separate reconciliation capability.",
          );
        }
      }
    }
    for (const a of selected.layout.frames ?? []) {
      for (const b of other.layout.frames ?? []) {
        if (
          a.nativeFrame?.bytes?.length &&
          b.nativeFrame?.bytes?.length &&
          a.nativeFrame.address < b.nativeFrame.end &&
          b.nativeFrame.address < a.nativeFrame.end
        ) {
          throw new Error(
            "Cross-atlas shared body records require a separate reconciliation capability.",
          );
        }
      }
    }
  }
}

async function fingerprint(selection: RoundtripSelection, build: SourceProjectInspection) {
  const project = await openSourceProject(build.root);
  const names = new Set(
    [...build.snapshots.keys()].map((name) =>
      path.relative(build.root, name).split(path.sep).join("/"),
    ),
  );
  for (const name of [
    ".uttori/project.json",
    ".uttori/generation.json",
    project.configuration.layout,
    project.configuration.buildConfig,
    path.join(path.dirname(project.configuration.buildConfig), "source-raw.json"),
    selection.image,
    selection.layout,
    selection.catalog,
    ...selection.atlases.flatMap((v) => [v.image, v.layout]),
  ]) {
    names.add(name);
  }
  const recipeFile = path.join(build.root, ".uttori/generation-inputs.json");
  if (fs.existsSync(recipeFile)) {
    names.add(".uttori/generation-inputs.json");
    const recipe = readJson<{ sourceRoot: string; recipes: string[] }>(recipeFile);
    for (const name of recipe.recipes) {
      names.add(path.posix.join(recipe.sourceRoot, name));
    }
  }
  // Research declarations and Git generation lineage are part of a session even when they emit no bytes.
  for (const root of project.configuration.researchRoots) {
    for (const name of fs.readdirSync(path.join(build.root, root), { recursive: true })) {
      const relative = path.join(root, String(name)).split(path.sep).join("/");
      if (fs.lstatSync(path.join(build.root, relative)).isFile()) {
        names.add(relative);
      }
    }
  }
  const files = [...names].toSorted().map((name) => {
    const file = sourcePath(build.root, name);
    const bytes = fs.readFileSync(file);
    const snapshot = build.snapshots.get(file);
    if (snapshot && !equal(bytes, snapshot)) {
      throw new Error("Source changed during round-trip inspection.");
    }
    return { path: name, sha256: hash(bytes) };
  });
  return {
    files,
    head: (await sourceGit(build.root, ["rev-parse", "HEAD"])).stdout.toString().trim(),
    configuration: build.configurationSha256,
    toolchain: build.toolchainSha256,
    adapter: adapterHash(),
    output: hash(build.output),
  };
}

function sessionFile(root: string, session: string): string {
  if (!/^[\da-f-]{36}$/.test(session)) {
    throw new Error("Invalid local sprite session ID.");
  }
  return path.join(root, ".uttori-local/sprite-roundtrip", `${session}.json`);
}

/** Export from current authored source; original-ROM assets are never reseeded into the working checkout. */
export async function exportSpriteSession(
  selection: RoundtripSelection,
  bundleFile: string,
): Promise<SpriteEditorBundle> {
  const build = await inspectSourceProject(selection.directory);
  requireBuild(build);
  const normalized = { ...selection, directory: build.root };
  const selected = atlas(build.root, {
    id: sourcePath(build.root, selection.image),
    ...selection,
    layout: selection.layout,
  });
  // Source attribution uses the absolute image path; portable identity remains the declared catalogue user.
  selected.id = sourcePath(build.root, selection.image);
  const catalog = readJson<SpritePaletteCatalog>(sourcePath(build.root, selection.catalog));
  const all = selection.atlases.map((v) => atlas(build.root, v));
  requireIndependentOwners(
    selected,
    all.filter((v) => v.id !== selection.atlasId),
  );
  const audit = inspectSpritePaletteUsers(catalog, all);
  if (audit.errors.length) {
    throw new Error(audit.errors.join("\n"));
  }
  if (
    !selection.atlases.some(
      (v) =>
        v.id === selection.atlasId && v.image === selection.image && v.layout === selection.layout,
    )
  ) {
    throw new Error("Selected atlas is absent from the complete user inventory.");
  }
  for (const id of selected.layout.paletteRefs) {
    const bytes = spritePaletteBytes(catalog, id);
    const offset = outputOffset(build, Number.parseInt(catalog.palettes[id].romAddress, 16));
    const owners = build.mapping.assets.filter(
      (v) =>
        v.outputOffset === offset &&
        v.size === bytes.length &&
        v.format === "som.palette.bgr555" &&
        build.mapping.fileList[v.assetFileIdx]?.name === sourcePath(build.root, selection.catalog),
    );
    if (
      owners.length !== 1 ||
      !equal(bytes, build.output.subarray(offset, offset + bytes.length))
    ) {
      throw new Error("Palette catalogue does not own the current emitted words.");
    }
  }
  const current = currentAtlas(build, selected, catalog);
  const bundle = createSomSpriteEditorBundle(current, catalog, randomUUID());
  const session: Session = {
    format: "uttori-sprite-session",
    version: 1,
    selection: normalized,
    bundle,
    ...(await fingerprint(normalized, build)),
  };
  const file = sessionFile(build.root, bundle.session);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(bundleFile, jsonBytes(bundle), { flag: "wx" });
  try {
    fs.writeFileSync(file, jsonBytes(session), { flag: "wx", mode: 0o600 });
  } catch (error) {
    fs.unlinkSync(bundleFile);
    throw error;
  }
  return bundle;
}

/** Validate every source dependency and implementation identity before consuming external editor deltas. */
async function freshSession(directory: string, sessionId: string) {
  const project = await openSourceProject(directory);
  const session = readJson<Session>(sessionFile(project.repository.root, sessionId));
  if (
    // Saved host fixtures can be edited on disk, so schema literals still need runtime validation.
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    session.format !== "uttori-sprite-session" ||
    // A corrupt local schema revision cannot authorize native publication.
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    session.version !== 1 ||
    session.bundle.session !== sessionId ||
    session.selection.directory !== project.repository.root
  ) {
    throw new Error("Invalid local session baseline.");
  }
  const build = await inspectSourceProject(directory);
  requireBuild(build);
  const now = await fingerprint(session.selection, build);
  const expected = {
    files: session.files,
    head: session.head,
    configuration: session.configuration,
    toolchain: session.toolchain,
    adapter: session.adapter,
    output: session.output,
  };
  if (canonicalJson(now) !== canonicalJson(expected)) {
    const changed = (
      ["files", "head", "configuration", "toolchain", "adapter", "output"] as const
    ).filter((key) => canonicalJson(now[key]) !== canonicalJson(expected[key]));
    throw new Error(
      `Stale sprite session (${changed.join(", ")}): export again from current source.`,
    );
  }
  return { session, build };
}

/** Plan source overlays and compare the entire assembled ROM with the permitted fixed native owners. */
export async function planSpriteImport(
  directory: string,
  sessionId: string,
  result: unknown,
): Promise<RoundtripPlan> {
  const { session, build } = await freshSession(directory, sessionId);
  const changes = inspectSpriteEditorResult(session.bundle, result);
  const selection = session.selection;
  const selected = atlas(build.root, { id: sourcePath(build.root, selection.image), ...selection });
  selected.id = sourcePath(build.root, selection.image);
  const catalog = readJson<SpritePaletteCatalog>(sourcePath(build.root, selection.catalog));
  const current = currentAtlas(build, selected, catalog);
  const plan = planSomSpriteEditorChanges(current, catalog, changes);
  const files: AssetFileChange[] = [];
  const add = (name: string, bytes: Uint8Array): void => {
    const file = sourcePath(build.root, name);
    const before = fs.readFileSync(file);
    if (!equal(before, bytes)) {
      files.push({ path: file, before, after: bytes });
    }
  };
  const expected = Uint8Array.from(build.output);
  const writeOwner = (address: number, before: Uint8Array, after: Uint8Array): number => {
    const offset = outputOffset(build, address);
    if (
      before.length !== after.length ||
      !equal(before, build.output.subarray(offset, offset + before.length))
    ) {
      throw new Error("Native owner extent or before bytes changed.");
    }
    expected.set(after, offset);
    return offset;
  };
  if (changes.pixels.length || changes.positions.length || changes.colors.length) {
    add(selection.image, plan.png);
    add(selection.layout, jsonBytes(plan.layout));
    if (plan.palettes.length) {
      add(selection.catalog, jsonBytes(plan.catalog));
      // Freeze each affected PNG's existing index binding before changing shared display colors.
      for (const user of selection.atlases) {
        if (user.layout === selection.layout) {
          continue;
        }
        const source = atlas(build.root, user);
        if (source.layout.paletteRefs.some((id) => plan.palettes.includes(id))) {
          add(user.layout, jsonBytes(bindFrameAtlasPalette(source.source, source.layout, catalog)));
        }
      }
    }
  }
  const oldPixels = inspectFrameAtlas(current.source, current.layout, catalog, { whole: true });
  const newPixels = inspectFrameAtlas(
    { bytes: plan.png, mediaType: "image/png" },
    plan.layout,
    plan.catalog,
    { whole: true },
  );
  for (const name of Object.keys(current.layout.segments)) {
    writeOwner(
      Number.parseInt(current.layout.segments[name].romAddress, 16),
      encodeInspectedFrameSegment(oldPixels, name),
      encodeInspectedFrameSegment(newPixels, name),
    );
  }
  const patches: TypedSourcePatch[] = [];
  for (const body of plan.bodies) {
    const offset = writeOwner(body.address, body.before, body.after);
    body.before.forEach((value, index) => {
      if (value !== body.after[index]) {
        patches.push({
          offset: offset + index,
          before: Uint8Array.of(value),
          after: Uint8Array.of(body.after[index]),
        });
      }
    });
  }
  for (const edit of planTypedSourceEdits({ ...build, patches })) {
    add(path.relative(build.root, edit.file).split(path.sep).join("/"), edit.after);
  }
  for (const id of plan.palettes) {
    writeOwner(
      Number.parseInt(catalog.palettes[id].romAddress, 16),
      spritePaletteBytes(catalog, id),
      spritePaletteBytes(plan.catalog, id),
    );
  }
  const overlays = new Map(
    files.map((v) => [path.relative(build.root, v.path).split(path.sep).join("/"), v.after]),
  );
  const assembled = files.length ? await inspectSourceProject(directory, overlays) : build;
  requireBuild(assembled);
  if (!equal(assembled.output, expected)) {
    throw new Error("Overlay ROM differs outside the permitted native edits.");
  }
  await freshSession(directory, sessionId);
  return {
    session: sessionId,
    changes: files,
    output: assembled.output,
    outputSha256: hash(assembled.output),
    changedOffsets: [...assembled.output.keys()].filter(
      (i) => assembled.output[i] !== build.output[i],
    ),
  };
}

/** Apply only a freshly reconstructed plan using the existing recoverable ordinary-file writer. */
export async function applySpriteImport(
  directory: string,
  sessionId: string,
  result: unknown,
): Promise<RoundtripPlan> {
  const plan = await planSpriteImport(directory, sessionId, result);
  applyAssetFileChanges(plan.changes);
  return plan;
}
