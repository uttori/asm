/** Process-local fault injection: production modules contain no crash or disk-full switches. */
import childProcess from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";

const request = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
let cleanupStarted = false;
const remove = fs.rmSync;
fs.rmSync = function (file, options) {
  remove(file, options);
  if (request.cleanupDirectory && path.dirname(String(file)) === request.cleanupDirectory) {
    cleanupStarted = true;
    if (request.killCleanup === "payload") {
      process.kill(process.pid, "SIGKILL");
    }
  }
};
const unlink = fs.unlinkSync;
fs.unlinkSync = function (file) {
  unlink(file);
  if (cleanupStarted && String(file) === path.join(request.cleanupDirectory, request.killCleanup)) {
    process.kill(process.pid, "SIGKILL");
  }
};
const removeDirectory = fs.rmdirSync;
fs.rmdirSync = function (directory, options) {
  removeDirectory(directory, options);
  if (request.killCleanup === "directory" && String(directory) === request.cleanupDirectory) {
    process.kill(process.pid, "SIGKILL");
  }
};
const spawn = childProcess.spawn;
let gitBoundaries = 0;
childProcess.spawn = function (command, args, options) {
  const child = spawn(command, args, options);
  // Install before the caller's close listener, after Git has completed its actual write.
  if (command === "git" && args.includes(request.killAfterGit)) {
    child.once("close", () => {
      if (++gitBoundaries === (request.killAfterGitCount ?? 1)) {
        process.kill(process.pid, "SIGKILL");
      }
    });
  }
  return child;
};
const rename = fs.renameSync;
fs.renameSync = function (from, to) {
  if (request.diskFull && String(to).endsWith("/merge.json")) {
    throw Object.assign(new Error("Injected disk exhaustion before journal publication"), {
      code: "ENOSPC",
    });
  }
  rename(from, to);
  if (request.killAfterJournal && String(to).endsWith("/merge.json")) {
    process.kill(process.pid, "SIGKILL");
  }
};
syncBuiltinESMExports();
const { sourceRepository } = await import("../../../src/source-project/git.ts");
const { retainSourceGeneration } = await import("../../../src/source-project/generation.ts");
const { applySourceGeneration, finishSourceGeneration } =
  await import("../../../src/source-project/merge.ts");
const { createSourceScratch, pruneSourceScratch } =
  await import("../../../src/source-project/scratch.ts");
const { pruneSourcePins } = await import("../../../src/source-project/pins.ts");
const repository = await sourceRepository(request.root);
if (request.action === "scratch") {
  const scratch = createSourceScratch(repository, "prepare");
  fs.writeFileSync(path.join(scratch.directory, "01-payload"), "Discardable data");
  fs.writeFileSync(path.join(scratch.directory, "02-payload"), "More discardable data");
  process.kill(process.pid, "SIGKILL");
} else if (request.action === "clean") {
  pruneSourceScratch(repository);
} else if (request.action === "clean-pins") {
  await pruneSourcePins(repository);
} else if (request.action === "retain") {
  await retainSourceGeneration(repository, {
    inputs: request.inputs,
    parent: request.parent,
    files: [{ path: "main.asm", bytes: Buffer.from("db $07\n") }],
  });
} else if (request.action === "apply") {
  await applySourceGeneration(repository, request.generation, request.preview);
} else if (request.action === "finish") {
  await finishSourceGeneration(repository, {
    message: "Fault test validated merge",
    validate: async () => {
      if (request.killDuringValidation) {
        process.kill(process.pid, "SIGKILL");
      }
      return request.verification;
    },
  });
}
