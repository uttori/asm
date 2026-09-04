import * as fs from "node:fs";
import * as path from "node:path";

/** Explicit generated declaration directories removed before a workspace build. */
const GENERATED_DECLARATION_DIRECTORIES = [
  "packages/cli/dist",
  "packages/core/dist",
  "packages/debug-adapter/dist",
  "packages/debug-sidecar-ares/dist",
  "packages/debug-sidecar-mesence/dist",
  "packages/disassembler/dist",
  "packages/plugin-loader-node/dist",
  "packages/plugin-snes/dist",
  "packages/plugin-65xx/dist",
] as const;

/**
 * Removes only the checked-in list of generated declaration directories.
 *
 * The repository previously embedded `rm -rf` in `npm run make-types`, which made the release gate
 * depend on a POSIX shell. Keeping the allow-list in code makes cleanup identical on macOS, Linux,
 * and Windows. The containment check is intentionally redundant with the literal list: if this
 * helper is later parameterized, an absolute or parent-relative target must still fail closed.
 * @returns {void}
 */
export const cleanWorkspaceDeclarations = (): void => {
  const root = process.cwd();
  for (const relative of GENERATED_DECLARATION_DIRECTORIES) {
    const destination = path.resolve(root, relative);
    const contained = path.relative(root, destination);
    if (
      contained === "" ||
      contained.startsWith(`..${path.sep}`) ||
      path.isAbsolute(contained) ||
      path.basename(destination) !== "dist"
    ) {
      throw new Error(`Refusing unsafe declaration cleanup target '${relative}'.`);
    }
    fs.rmSync(destination, { recursive: true, force: true });
  }
};

cleanWorkspaceDeclarations();
