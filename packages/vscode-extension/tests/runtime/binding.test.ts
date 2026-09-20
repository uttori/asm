import test from "ava";

import { runtimeBindingFromLaunch } from "../../src/runtime/binding.js";

const launch = {
  type: "uttori-asm",
  request: "launch",
  backend: "ares",
  runtimeManifest: "${workspaceFolder}/runtime/manifest.json",
  emulator: "runtime/bin/ares",
  runtimeDirectory: "runtime",
  fastBoot: false,
};
test("run commands reuse one explicit workspace live runtime", (t) => {
  t.deepEqual(
    runtimeBindingFromLaunch(
      [null, {}, { backend: "replay" }, launch, { ...launch, name: "Second launch" }],
      "/project",
    ),
    {
      backend: "ares",
      runtimeManifest: "/project/runtime/manifest.json",
      emulator: "/project/runtime/bin/ares",
      runtimeDirectory: "/project/runtime",
      fastBoot: false,
    },
  );
});
test("run commands do not guess between runtimes or unresolved launch inputs", (t) => {
  t.is(
    runtimeBindingFromLaunch([launch, { ...launch, emulator: "/another/emulator" }], "/project"),
    undefined,
  );
  t.is(
    runtimeBindingFromLaunch([{ ...launch, runtimeManifest: "${env:MANIFEST}" }], "/project"),
    undefined,
  );
  t.is(runtimeBindingFromLaunch([{ ...launch, emulator: "" }], "/project"), undefined);
});
