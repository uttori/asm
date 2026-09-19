import path from "node:path";

import type { RomIdentity } from "@uttori/asm-disassembler";
import type { ExtensionContext } from "vscode";

import { test } from "../../../tests/ava-helper.js";
import { rememberedSnesRom, rememberSnesRom } from "../src/snes-rom-bindings.js";

const ROM_BINDINGS_KEY = "snesProjectRomBindings.v1";
const MAX_ROM_BINDINGS = 32;

const identity = (n: number, headerSize: 0 | 512 = 0): RomIdentity => ({
  sha256: `file-${n}`,
  contentSha256: `content-${n}`,
  fileSize: headerSize + 0x8000,
  contentSize: 0x8000,
  headerSize,
});

const createContext = (initial: Record<string, unknown> = {}) => {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    context: {
      globalState: {
        get: (key: string, defaultValue?: unknown) =>
          store.has(key) ? store.get(key) : defaultValue,
        update: async (key: string, value: unknown) => {
          store.set(key, value);
        },
      },
    } as unknown as ExtensionContext,
    snapshot: () =>
      (store.get(ROM_BINDINGS_KEY) ?? {}) as Record<
        string,
        {
          path: string;
          updatedAt: string;
          fileSha256: string;
          contentSha256: string;
          headerSize: 0 | 512;
        }
      >,
  };
};

const seed = (count: number, updatedAt: (n: number) => string): Record<string, unknown> => ({
  [ROM_BINDINGS_KEY]: Object.fromEntries(
    Array.from({ length: count }, (_, n) => [
      identity(n).contentSha256,
      {
        path: `/roms/${n}.sfc`,
        fileSha256: identity(n).sha256,
        contentSha256: identity(n).contentSha256,
        headerSize: 0,
        updatedAt: updatedAt(n),
      },
    ]),
  ),
});

test("remembered ROM is missing until a matching content identity is stored", async (t) => {
  const { context, snapshot } = createContext();
  t.is(rememberedSnesRom(context, identity(1).contentSha256), undefined);
  await rememberSnesRom(context, identity(1, 512), "games/secret.smc");
  t.is(rememberedSnesRom(context, identity(1).contentSha256), path.resolve("games/secret.smc"));
  t.is(
    rememberedSnesRom(context, identity(1).sha256),
    undefined,
    "lookup is content-addressed, not file hash",
  );
  const stored = snapshot()[identity(1).contentSha256];
  t.like(stored, {
    fileSha256: identity(1).sha256,
    contentSha256: identity(1).contentSha256,
    headerSize: 512,
    path: path.resolve("games/secret.smc"),
  });
  t.true(Number.isFinite(Date.parse(stored.updatedAt)));
});

test("remembering the same content identity overwrites the path and timestamp", async (t) => {
  const { context, snapshot } = createContext();
  await rememberSnesRom(context, identity(2), "/old/game.sfc");
  const previous = snapshot()[identity(2).contentSha256].updatedAt;
  await rememberSnesRom(context, identity(2, 512), "/new/game.smc");
  t.is(rememberedSnesRom(context, identity(2).contentSha256), path.resolve("/new/game.smc"));
  t.like(snapshot()[identity(2).contentSha256], {
    headerSize: 512,
    fileSha256: identity(2).sha256,
    path: path.resolve("/new/game.smc"),
  });
  t.true(snapshot()[identity(2).contentSha256].updatedAt >= previous);
});

test("bindings keep the 32 most recently updated identities", async (t) => {
  const { context, snapshot } = createContext(
    seed(MAX_ROM_BINDINGS, (n) => `2020-01-01T00:00:${String(n).padStart(2, "0")}.000Z`),
  );
  await rememberSnesRom(context, identity(MAX_ROM_BINDINGS), `/roms/${MAX_ROM_BINDINGS}.sfc`);
  t.is(Object.keys(snapshot()).length, MAX_ROM_BINDINGS);
  t.is(rememberedSnesRom(context, identity(0).contentSha256), undefined);
  t.is(
    rememberedSnesRom(context, identity(MAX_ROM_BINDINGS).contentSha256),
    path.resolve(`/roms/${MAX_ROM_BINDINGS}.sfc`),
  );
  t.is(rememberedSnesRom(context, identity(1).contentSha256), "/roms/1.sfc");
});

test("updating an existing binding refreshes recency so it survives later eviction", async (t) => {
  const { context, snapshot } = createContext(
    seed(MAX_ROM_BINDINGS, (n) => `2020-01-01T00:00:${String(n).padStart(2, "0")}.000Z`),
  );
  await rememberSnesRom(context, identity(0), "/roms/relinked.sfc");
  await rememberSnesRom(context, identity(MAX_ROM_BINDINGS), `/roms/${MAX_ROM_BINDINGS}.sfc`);
  t.is(rememberedSnesRom(context, identity(0).contentSha256), path.resolve("/roms/relinked.sfc"));
  t.is(rememberedSnesRom(context, identity(1).contentSha256), undefined);
  t.is(Object.keys(snapshot()).length, MAX_ROM_BINDINGS);
});

test("a just-written binding is kept even when its timestamp is not the newest", async (t) => {
  const { context, snapshot } = createContext(
    seed(MAX_ROM_BINDINGS, () => "2099-01-01T00:00:00.000Z"),
  );
  await rememberSnesRom(context, identity(MAX_ROM_BINDINGS), `/roms/${MAX_ROM_BINDINGS}.sfc`);
  t.is(
    rememberedSnesRom(context, identity(MAX_ROM_BINDINGS).contentSha256),
    path.resolve(`/roms/${MAX_ROM_BINDINGS}.sfc`),
  );
  t.is(Object.keys(snapshot()).length, MAX_ROM_BINDINGS);
});
