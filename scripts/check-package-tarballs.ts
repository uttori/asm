import { spawnSync } from "node:child_process";

interface PackageDryRun {
  readonly name: string;
  readonly files: ReadonlyArray<{ readonly path: string }>;
}

const requirements = new Map<string, readonly string[]>([
  [
    "@uttori/asm-cli",
    ["package.json", "src/index.ts", "dist/index.d.ts", "out/cli.mjs", "README.md"],
  ],
  ["@uttori/asm-core", ["package.json", "src/index.ts", "dist/index.d.ts"]],
  [
    "@uttori/asm-plugin-loader-node",
    ["package.json", "src/index.ts", "dist/index.d.ts", "asm-config.schema.json"],
  ],
  ["@uttori/asm-plugin-snes", ["package.json", "src/index.ts", "dist/index.d.ts"]],
  [
    "@uttori/asm-plugin-65xx",
    ["package.json", "src/index.ts", "dist/index.d.ts", "THIRD_PARTY_NOTICES.md"],
  ],
]);

for (const [workspace, requiredFiles] of requirements) {
  const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--workspace", workspace], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Package dry run failed for ${workspace}:\n${result.stderr || result.stdout}`);
  }
  const packages = JSON.parse(result.stdout) as PackageDryRun[];
  const packageResult = packages[0];
  if (!packageResult) throw new Error(`Package dry run returned no result for ${workspace}.`);
  const files = new Set(packageResult.files.map((file) => file.path));
  const missing = requiredFiles.filter((file) => !files.has(file));
  if (missing.length > 0) {
    throw new Error(`${workspace} package is missing required files: ${missing.join(", ")}`);
  }
  const forbidden = [...files].filter(
    (filePath) =>
      filePath.includes("fixtures/external/") ||
      filePath.includes("fixtures/integration/") ||
      /\.(sfc|smc|nes)$/i.test(filePath),
  );
  if (forbidden.length > 0) {
    throw new Error(
      `${workspace} package tarball contains fixture or ROM files: ${forbidden.join(", ")}`,
    );
  }
  console.log(`${workspace}: ${packageResult.files.length} files, required runtime files present`);
}
