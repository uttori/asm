import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "./ava-helper.js";
import { collectPackageBoundaryViolations } from "../scripts/check-package-boundaries.js";

const boundaryFixture = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-asm-boundaries-"));
  const write = (file: string, contents: string): void => {
    const resolved = path.join(root, file);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, contents);
  };
  write(
    "packages/core/package.json",
    JSON.stringify({
      name: "@uttori/asm-core",
      exports: { ".": "./src/index.ts", "./plugin": "./src/plugin/index.ts" },
    }),
  );
  write("packages/core/src/index.ts", "export const core = true;\n");
  write("plugins/example/src/index.ts", 'import "@uttori/asm-core/plugin";\n');
  write("language-server/src/providers.ts", 'import { core } from "@uttori/asm-core";\n');
  return root;
};

test("package boundary checker accepts the repository ownership graph", (t) => {
  t.deepEqual(collectPackageBoundaryViolations(), []);
});

test("package boundary checker rejects core plugin imports and SNES identifiers", (t) => {
  const root = boundaryFixture();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(root, "packages/core/src/index.ts"),
    'import snes from "@uttori/asm-plugin-snes";\nexport const mapper = "lorom";\n',
  );

  const codes = collectPackageBoundaryViolations(root).map((violation) => violation.code);
  t.true(codes.includes("CORE_IMPORTS_PLUGIN"));
  t.true(codes.includes("CORE_CONTAINS_SNES_IDENTIFIER"));
});

test("package boundary checker rejects private core imports from plugins", (t) => {
  const root = boundaryFixture();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(root, "plugins/example/src/index.ts"),
    'import { Assembler } from "@uttori/asm-core/assembler";\n',
  );

  t.deepEqual(
    collectPackageBoundaryViolations(root).map((violation) => violation.code),
    ["PLUGIN_IMPORTS_CORE_INTERNAL"],
  );
});

test("package boundary checker rejects static catalogs in LSP providers", (t) => {
  const root = boundaryFixture();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(root, "language-server/src/providers.ts"),
    'import { cpu65816Catalog } from "../../../plugins/snes/src/tooling/instruction-catalog.js";\n',
  );

  t.deepEqual(
    collectPackageBoundaryViolations(root).map((violation) => violation.code),
    ["LSP_PROVIDER_IMPORTS_STATIC_CATALOG"],
  );
});
