import { test } from "../../../../tests/ava-helper.js";
import {
  assertAssetEditorVersions,
  type AssetEditorVersion,
} from "../../src/source/asset-drafts.js";

test("asset publication rechecks live native versions and preserves newly dirty opaque drafts", (t) => {
  const before: AssetEditorVersion[] = [
    { path: "/project/source/pixels.png", version: 4, dirty: false, opaque: false },
  ];
  t.notThrows(() => assertAssetEditorVersions(before, before, [before[0].path]));
  t.throws(
    () => assertAssetEditorVersions(before, [{ ...before[0], version: 5 }], [before[0].path]),
    { message: /editor changed/ },
  );
  t.throws(
    () =>
      assertAssetEditorVersions(
        before,
        [{ path: "/project/source/layout.json", version: 0, dirty: true, opaque: true }],
        ["/project/source/layout.json"],
      ),
    { message: /opaque editor draft.*preserved/ },
  );
  t.notThrows(() =>
    assertAssetEditorVersions(
      before,
      [{ path: "/unrelated/draft", version: 1, dirty: true, opaque: true }],
      [before[0].path],
    ),
  );
});

test("asset publication matches macOS editor URIs to canonical worker paths", (t) => {
  if (process.platform !== "darwin") {
    return;
  }
  const before: AssetEditorVersion[] = [
    { path: "/var/folders/asset-draft.png", version: 1, dirty: false, opaque: false },
  ];
  t.throws(
    () =>
      assertAssetEditorVersions(
        before,
        [{ ...before[0], dirty: true }],
        ["/private/var/folders/asset-draft.png"],
      ),
    { message: /editor changed/ },
  );
  t.throws(
    () =>
      assertAssetEditorVersions(
        before,
        [{ ...before[0], version: 2, path: "/private/var/folders/asset-draft.png" }],
        [before[0].path],
      ),
    { message: /editor changed/ },
  );
});
