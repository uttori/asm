import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

/** Build profiling entry points with the CLI's bundle settings, retaining imported script identity. */
const output = path.resolve(process.argv[2] ?? "/tmp/assembler-profile-runtime");
fs.mkdirSync(output, { recursive: true });
for (const [name, filename] of [
  ["profile-assembler-ast", "assembler-ast-profile"],
  ["profile-assembler-production", "production-profile"],
]) {
  const entry = path.resolve(`scripts/${name}.ts`);
  await build({
    entryPoints: [entry],
    outfile: path.join(output, `${filename}.mjs`),
    bundle: true,
    conditions: ["uttori-source"],
    platform: "node",
    format: "esm",
    target: "node26",
    define: { UTTORI_SOURCE_BUNDLED: "true" },
    sourcemap: true,
    logLevel: "warning",
    plugins: [
      {
        name: "preserve-fixture-script-identity",
        setup(builder) {
          builder.onLoad({ filter: /\/(?:scripts|fixtures)\/.*\.[cm]?[jt]s$/ }, (args) => {
            if (args.path === entry) {
              return undefined;
            }
            // Imported fixture helpers locate the repository and guard their standalone CLI with
            // import.meta.url. Keep those identities when bundling so preparation remains unchanged.
            const contents = fs
              .readFileSync(args.path, "utf8")
              .replaceAll("import.meta.url", JSON.stringify(pathToFileURL(args.path).href));
            /** @type {import("esbuild").Loader} */
            let loader = "js";
            if (
              args.path.endsWith(".ts") ||
              args.path.endsWith(".mts") ||
              args.path.endsWith(".cts")
            ) {
              loader = "ts";
            }
            return { contents, loader };
          });
        },
      },
    ],
  });
}
