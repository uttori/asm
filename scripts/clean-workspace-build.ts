import * as fs from "node:fs";
import * as path from "node:path";

/** Explicit generated JavaScript/declaration directories removed before a workspace build. */
const GENERATED_PACKAGE_DIRECTORIES = [
  "packages/game-secret-of-mana/dist",
  "packages/capture/dist",
  "packages/workflows/dist",
  "packages/cli/dist",
  "packages/core/dist",
  "packages/debug-adapter/dist",
  "packages/debug-sidecar-ares/dist",
  "packages/disassembler/dist",
  "packages/assets/dist",
  "packages/plugin-loader-node/dist",
  "packages/plugin-snes/dist",
  "packages/plugin-65xx/dist",
] as const;

/**
 * Removes only the checked-in list of generated JavaScript/declaration directories.
 *
 * The repository previously embedded `rm -rf` in `npm run make-types`, which made the release gate
 * depend on a POSIX shell. Keeping the allow-list in code makes cleanup identical on macOS, Linux,
 * and Windows. The containment check is intentionally redundant with the literal list: if this
 * helper is later parameterized, an absolute or parent-relative target must still fail closed.
 * @param [workspace] Optional workspace directory name for a single-package prepack build.
 */
export const cleanWorkspaceBuild = (workspace?: string): void => {
  const root = path.resolve(import.meta.dirname, "..");
  const directories = GENERATED_PACKAGE_DIRECTORIES.filter(
    (relative) => workspace === undefined || relative === `packages/${workspace}/dist`,
  );
  if (directories.length === 0) {
    throw new Error(`Unknown package cleanup workspace '${workspace}'.`);
  }
  for (const relative of directories) {
    const destination = path.resolve(root, relative);
    const contained = path.relative(root, destination);
    if (
      contained === "" ||
      contained.startsWith(`..${path.sep}`) ||
      path.isAbsolute(contained) ||
      path.basename(destination) !== "dist"
    ) {
      throw new Error(`Refusing unsafe package cleanup target '${relative}'.`);
    }
    fs.rmSync(destination, { recursive: true, force: true });
  }
};

const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--workspace")) {
  throw new Error("Usage: clean-workspace-build.ts [--workspace directory-name]");
}
cleanWorkspaceBuild(args[1]);
