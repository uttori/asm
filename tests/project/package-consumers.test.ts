import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  declaredArchiveClosure,
  writePackageExportProbe,
  type PackageArchiveNode,
} from "../../scripts/package-consumers.js";
import { test } from "../ava-helper.js";

test("isolated consumers expose an undeclared subpath import masked by an aggregate install", (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-consumer-fixture-"));
  t.teardown(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const packages = new Map<string, PackageArchiveNode>();
  for (const name of ["entry", "declared", "leaf", "hidden"]) {
    const directory = path.join(scratch, "packages", name);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, "package.json"),
      JSON.stringify({
        name: `@probe/${name}`,
        version: "1.0.0",
        type: "module",
        exports: { ".": "./index.js", "./feature": "./feature.js" },
      }),
    );
    fs.writeFileSync(path.join(directory, "index.js"), "export const value = 1;\n");
    fs.writeFileSync(
      path.join(directory, "feature.js"),
      'export { value } from "@probe/hidden";\n',
    );
    let dependencies: string[] = [];
    if (name === "entry") {
      dependencies = ["declared"];
    }
    if (name === "declared") {
      dependencies = ["leaf"];
    }
    packages.set(name, { archive: directory, dependencies });
  }
  /** The fixture copies selected payloads; the production checker installs the corresponding tarballs. */
  const probe = (name: string, roots: string[]) => {
    const consumer = path.join(scratch, name);
    fs.mkdirSync(consumer);
    for (const directory of declaredArchiveClosure(roots, packages)) {
      fs.cpSync(
        directory,
        path.join(consumer, "node_modules", "@probe", path.basename(directory)),
        { recursive: true },
      );
    }
    const script = writePackageExportProbe(consumer, {
      imports: ["@probe/entry", "@probe/entry/feature"],
      commonJsImports: [],
      jsonImports: [],
    });
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    delete env.NODE_PATH;
    return spawnSync(process.execPath, [script], { cwd: consumer, env, encoding: "utf8" });
  };
  const aggregate = probe("aggregate", [...packages.keys()]);
  t.is(aggregate.status, 0, aggregate.stderr);
  const isolated = probe("isolated", ["entry"]);
  t.not(isolated.status, 0);
  t.regex(isolated.stderr, /ERR_MODULE_NOT_FOUND/);
  t.regex(isolated.stderr, /@probe\/hidden/);
  t.true(fs.existsSync(path.join(scratch, "isolated/node_modules/@probe/leaf/index.js")));
  const entry = packages.get("entry")!;
  packages.set("entry", { ...entry, dependencies: [...entry.dependencies, "hidden"] });
  const corrected = probe("corrected", ["entry"]);
  t.is(corrected.status, 0, corrected.stderr);
  t.throws(() => declaredArchiveClosure(["missing"], packages), {
    message: /No packed dependency/,
  });
});
