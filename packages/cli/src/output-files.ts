import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import path from "node:path";

/** Complete bytes prepared in memory before publishing a build artifact. */
interface OutputFile {
  readonly file: string;
  readonly contents: string | Uint8Array;
}

/**
 * Check for aliases before writing; a debug map must not overwrite its binary or source.
 * @param {string} left Existing or resolved destination path.
 * @param {string} right Existing or resolved destination path.
 * @returns {boolean} Whether paths name the same file, including symlinks and existing hard links.
 */
const sameFile = (left: string, right: string): boolean => {
  if (left === right) {
    return true;
  }
  if (!fs.existsSync(left) || !fs.existsSync(right)) {
    return false;
  }
  const a = fs.statSync(left);
  const b = fs.statSync(right);
  return a.ino !== 0 && a.dev === b.dev && a.ino === b.ino;
};

/**
 * Stage all artifacts before replacing destinations, then rename each file atomically. Parent
 * directories are created. Preparation failures leave existing artifacts intact; publication is
 * atomic per file, not across multiple files or sudden termination between renames. Temporary
 * siblings are removed on ordinary failures; forced process termination can leave them behind.
 * @param {readonly OutputFile[]} outputs Fully computed artifacts in publication order.
 * @param {readonly string[]} protectedFiles Existing inputs that must not become output destinations.
 */
export const publishOutputFiles = (
  outputs: readonly OutputFile[],
  protectedFiles: readonly string[],
): void => {
  const protectedPaths = protectedFiles
    .filter((file) => fs.existsSync(file))
    .map((file) => fs.realpathSync(file));
  const destinations: string[] = [];
  const staged: Array<{ file: string; temporary: string }> = [];
  try {
    for (const output of outputs) {
      fs.mkdirSync(path.dirname(output.file), { recursive: true });
      let file = path.join(fs.realpathSync(path.dirname(output.file)), path.basename(output.file));
      if (fs.existsSync(file)) {
        file = fs.realpathSync(file);
      }
      if (protectedPaths.some((input) => sameFile(input, file))) {
        throw new Error(`Output '${output.file}' would overwrite an input file.`);
      }
      if (destinations.some((destination) => sameFile(destination, file))) {
        throw new Error(`Output destinations must be distinct: '${output.file}'.`);
      }
      if (fs.existsSync(file) && !fs.statSync(file).isFile()) {
        throw new Error(`Output '${output.file}' is not a regular file.`);
      }
      destinations.push(file);
    }
    // Writing every temporary file first catches map/path/disk errors before changing the binary.
    for (const [index, output] of outputs.entries()) {
      const file = destinations[index];
      const temporary = path.join(
        path.dirname(file),
        `.${path.basename(file)}.uttori-${randomUUID()}.tmp`,
      );
      const mode = fs.existsSync(file) ? fs.statSync(file).mode & 0o777 : undefined;
      const descriptor = fs.openSync(temporary, "wx", mode);
      // Track ownership only after exclusive creation succeeds; never clean up another writer's file.
      staged.push({ file, temporary });
      try {
        fs.writeFileSync(descriptor, output.contents);
      } finally {
        fs.closeSync(descriptor);
      }
    }
    for (const { file, temporary } of staged) {
      fs.renameSync(temporary, file);
    }
  } finally {
    for (const { temporary } of staged) {
      try {
        fs.rmSync(temporary, { force: true });
      } catch {
        // A cleanup failure must not hide the original write/rename error.
      }
    }
  }
};
