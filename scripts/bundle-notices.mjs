import fs from "node:fs";
import path from "node:path";

/**
 * Wrap esbuild so each shipped bundle carries the exact licenses of its bundled npm dependencies.
 * Missing license files fail the build instead of silently producing an incomplete archive.
 * @param {typeof import("esbuild").build} build The package's installed esbuild function.
 * @returns {(options: import("esbuild").BuildOptions & { outfile: string }) => Promise<import("esbuild").BuildResult>} Builder that also writes OUTFILE.licenses.txt.
 */
export const withBundleNotices = (build) => async (options) => {
  const result = await build({ ...options, metafile: true });
  if (!result.metafile) {
    throw new Error("Bundle notices require esbuild output metadata.");
  }
  const base = options.absWorkingDir ?? process.cwd();
  /** @type {Map<string, string>} Exact license text grouped by package and installed version. */
  const packages = new Map();
  // Use output contributions rather than all parsed inputs to exclude tree-shaken dependencies.
  for (const output of Object.values(result.metafile.outputs)) {
    for (const [input, contribution] of Object.entries(output.inputs)) {
      if (contribution.bytesInOutput === 0 || !input.includes("node_modules/")) {
        continue;
      }
      let directory = path.dirname(path.resolve(base, input));
      /** @type {{ name: string, version: string } | undefined} Owning package, excluding module markers. */
      let manifest;
      // Some dependencies put { type: "module" } manifests inside lib/esm. Those are module
      // markers, not package identities, and their license still belongs to the package root.
      while (!manifest) {
        const candidate = path.join(directory, "package.json");
        if (fs.existsSync(candidate)) {
          /** @type {unknown} Package data is checked before selecting its license directory. */
          const value = JSON.parse(fs.readFileSync(candidate, "utf8"));
          if (
            value !== null &&
            typeof value === "object" &&
            "name" in value &&
            "version" in value &&
            typeof value.name === "string" &&
            typeof value.version === "string"
          ) {
            manifest = { name: value.name, version: value.version };
            break;
          }
        }
        const parent = path.dirname(directory);
        if (parent === directory) {
          throw new Error(`No package manifest for bundled input ${input}`);
        }
        directory = parent;
      }
      const key = `${manifest.name}@${manifest.version}`;
      if (packages.has(key)) {
        continue;
      }
      const files = fs
        .readdirSync(directory)
        .filter(
          (name) =>
            /^(licen[cs]e|copying|notice)(?:\.|$)/i.test(name) &&
            fs.statSync(path.join(directory, name)).isFile(),
        )
        .sort();
      if (files.length === 0) {
        // These published Data Tools releases declare MIT and Matthew Callis as author,
        // but omit the license file. Keep their existing archives buildable; later
        // releases must include the upstream LICENSE instead of using this fallback.
        if (key === "@uttori/data-tools@4.1.0" || key === "@uttori/data-tools@5.0.0") {
          packages.set(
            key,
            `MIT license declared in package.json; published tarball has no license file.\n\n${fs.readFileSync(path.resolve(import.meta.dirname, "../packages/assets/LICENSE"), "utf8")}`,
          );
          continue;
        }
        throw new Error(`Missing license for bundled dependency ${key}`);
      }
      packages.set(
        key,
        files
          .map((name) => `${name}\n\n${fs.readFileSync(path.join(directory, name), "utf8")}`)
          .join("\n\n"),
      );
    }
  }
  const sections = [...packages]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, license]) => `${name}\n${"=".repeat(name.length)}\n\n${license}`);
  const header = "Bundled npm dependency notices. License text is reproduced unchanged.\n";
  fs.writeFileSync(`${options.outfile}.licenses.txt`, header + "\n" + sections.join("\n\n"));
  return result;
};
