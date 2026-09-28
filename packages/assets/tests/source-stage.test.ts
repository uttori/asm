import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import {
  createAssetSourceBaseline,
  assertAssetSourceBaseline,
  createAssetSourceStage,
  publishAssetSourceStage,
  parseAssetSourceBaseline,
} from "../src/node.js";

/** Keep every original, staged and recovery generation within an isolated test directory. */
function fixture() {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "source-stage-test-")));
  const root = path.join(parent, "project");
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, "source.bin"), Uint8Array.of(1, 2));
  return { parent, root };
}

test("persisted baselines reject stale, missing, malformed and escaping dependencies", (t) => {
  const { parent, root } = fixture();
  try {
    const baseline = createAssetSourceBaseline(
      "other-game:codec-v2",
      new Map([["source.bin", Uint8Array.of(1, 2)]]),
    );
    const reopened = parseAssetSourceBaseline(JSON.parse(JSON.stringify(baseline)));
    t.notThrows(() => assertAssetSourceBaseline(root, reopened, baseline.identity));
    t.throws(() => assertAssetSourceBaseline(root, reopened, "wrong-game"), {
      message: /different project/,
    });
    fs.writeFileSync(path.join(root, "source.bin"), Uint8Array.of(2, 1));
    t.throws(() => assertAssetSourceBaseline(root, reopened, baseline.identity), {
      message: /Stale/,
    });
    fs.unlinkSync(path.join(root, "source.bin"));
    t.throws(() => assertAssetSourceBaseline(root, reopened, baseline.identity), {
      message: /Stale/,
    });
    t.throws(
      () =>
        parseAssetSourceBaseline({ ...baseline, files: [baseline.files[0], baseline.files[0]] }),
      { message: /Duplicate/ },
    );
    for (const name of ["../outside", "/absolute", "x/../y", "a\\b", "C:/x"]) {
      t.throws(() => createAssetSourceBaseline("x", new Map([[name, new Uint8Array()]])), {
        message: /relative/,
      });
    }
    fs.symlinkSync(path.join(parent, "unrelated"), path.join(root, "source.bin"));
    t.throws(() => assertAssetSourceBaseline(root, reopened, baseline.identity), {
      message: /Stale/,
    });
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test.serial(
  "staging isolates new files and publishes a validated complete generation with recovery copy",
  async (t) => {
    const { parent, root } = fixture();
    try {
      fs.mkdirSync(path.join(root, "empty"));
      const stage = createAssetSourceStage(root, "game:codec-v2");
      t.true(fs.statSync(path.join(stage.directory, "empty")).isDirectory());
      fs.mkdirSync(path.join(stage.directory, "frames"));
      fs.writeFileSync(path.join(stage.directory, "frames/new.json"), "{}");
      fs.writeFileSync(path.join(stage.directory, "source.bin"), Uint8Array.of(3, 4));
      t.false(fs.existsSync(path.join(root, "frames")));
      const previous = await publishAssetSourceStage(
        root,
        stage,
        stage.baseline.identity,
        (directory) => {
          t.is(fs.readFileSync(path.join(directory, "frames/new.json"), "utf8"), "{}");
          t.deepEqual([...fs.readFileSync(path.join(root, "source.bin"))], [1, 2]);
        },
      );
      t.true(fs.existsSync(path.join(root, "frames/new.json")));
      t.deepEqual([...fs.readFileSync(path.join(previous, "source.bin"))], [1, 2]);
      t.deepEqual([...fs.readFileSync(path.join(root, "source.bin"))], [3, 4]);
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  },
);

test.serial("failed gates and concurrent changes never publish a staged generation", async (t) => {
  const { parent, root } = fixture();
  try {
    const stage = createAssetSourceStage(root, "game");
    await t.throwsAsync(
      publishAssetSourceStage(root, stage, "game", () => {
        throw new Error("ROM mismatch");
      }),
      { message: /ROM mismatch/ },
    );
    t.true(fs.existsSync(stage.directory));
    await t.throwsAsync(
      publishAssetSourceStage(root, stage, "game", () => {
        fs.writeFileSync(path.join(root, "added"), "new");
      }),
      { message: /inventory/ },
    );
    t.is(fs.readFileSync(path.join(root, "added"), "utf8"), "new");
    fs.unlinkSync(path.join(root, "added"));
    await t.throwsAsync(
      publishAssetSourceStage(root, stage, "game", () => {
        fs.writeFileSync(path.join(root, "source.bin"), "concurrent edit");
      }),
      { message: /Stale/ },
    );
    t.is(fs.readFileSync(path.join(root, "source.bin"), "utf8"), "concurrent edit");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test.serial("a failed publication rename restores the previous source tree", async (t) => {
  const { parent, root } = fixture();
  const rename = fs.renameSync;
  try {
    const stage = createAssetSourceStage(root, "game");
    fs.writeFileSync(path.join(stage.directory, "new"), "new");
    let calls = 0;
    fs.renameSync = ((...args: Parameters<typeof fs.renameSync>) => {
      if (++calls === 2) {
        throw new Error("injected rename failure");
      }
      return rename(...args);
    }) as typeof fs.renameSync;
    await t.throwsAsync(
      publishAssetSourceStage(root, stage, "game", () => {}),
      { message: /injected/ },
    );
    t.deepEqual([...fs.readFileSync(path.join(root, "source.bin"))], [1, 2]);
    t.false(fs.existsSync(path.join(root, "new")));
    t.true(fs.existsSync(path.join(stage.directory, "new")));
  } finally {
    fs.renameSync = rename;
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test.serial(
  "external databases remain live and cannot be shadowed by a staged generation",
  async (t) => {
    const { parent, root } = fixture();
    try {
      fs.mkdirSync(path.join(root, "analysis"));
      fs.writeFileSync(path.join(root, "analysis/db"), "original");
      const stage = createAssetSourceStage(root, "game", ["analysis"]);
      t.false(fs.existsSync(path.join(stage.directory, "analysis")));
      fs.writeFileSync(path.join(root, "analysis/db"), "current live data");
      fs.mkdirSync(path.join(stage.directory, "analysis"));
      await t.throwsAsync(
        publishAssetSourceStage(root, stage, "game", () => {}),
        { message: /shadows/ },
      );
      fs.rmdirSync(path.join(stage.directory, "analysis"));
      await publishAssetSourceStage(root, stage, "game", () => {});
      t.is(fs.readFileSync(path.join(root, "analysis/db"), "utf8"), "current live data");
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  },
);

test.serial("publication failure restores external directories after their transfer", async (t) => {
  const { parent, root } = fixture();
  const rename = fs.renameSync;
  try {
    fs.mkdirSync(path.join(root, "analysis"));
    fs.writeFileSync(path.join(root, "analysis/db"), "research");
    const stage = createAssetSourceStage(root, "game", ["analysis"]);
    let calls = 0;
    fs.renameSync = ((...args: Parameters<typeof fs.renameSync>) => {
      if (++calls === 3) {
        throw new Error("injected final rename");
      }
      return rename(...args);
    }) as typeof fs.renameSync;
    await t.throwsAsync(
      publishAssetSourceStage(root, stage, "game", () => {}),
      { message: /injected/ },
    );
    t.is(fs.readFileSync(path.join(root, "analysis/db"), "utf8"), "research");
    t.false(fs.existsSync(path.join(stage.directory, "analysis")));
  } finally {
    fs.renameSync = rename;
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test.serial(
  "a recovery conflict preserves the concurrent tree and reports the retained sources",
  async (t) => {
    const { parent, root } = fixture();
    const rename = fs.renameSync;
    try {
      const stage = createAssetSourceStage(root, "game");
      let calls = 0;
      fs.renameSync = ((...args: Parameters<typeof fs.renameSync>) => {
        if (++calls === 2) {
          fs.mkdirSync(root);
          fs.writeFileSync(path.join(root, "concurrent"), "keep");
          throw new Error("injected concurrent writer");
        }
        return rename(...args);
      }) as typeof fs.renameSync;
      const error = await t.throwsAsync(
        publishAssetSourceStage(root, stage, "game", () => {}),
        { instanceOf: AggregateError, message: /previous sources remain/ },
      );
      t.is(fs.readFileSync(path.join(root, "concurrent"), "utf8"), "keep");
      const previousContainer = fs.readdirSync(parent).find((name) => name.includes("-previous-"));
      t.truthy(error);
      t.truthy(previousContainer);
      t.deepEqual(
        [...fs.readFileSync(path.join(parent, previousContainer!, "source/source.bin"))],
        [1, 2],
      );
    } finally {
      fs.renameSync = rename;
      fs.rmSync(parent, { recursive: true, force: true });
    }
  },
);
