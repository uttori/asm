/** Inject failures at durable filesystem publication boundaries in a disposable process. */
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";

const [root, boundary, mode] = process.argv.slice(2);
const rename = fs.renameSync;
fs.renameSync = function (from, to) {
  const matches = path.basename(String(to)) === boundary;
  if (matches && mode === "disk-full") {
    throw Object.assign(new Error("Injected publication disk exhaustion"), { code: "ENOSPC" });
  }
  rename(from, to);
  if (matches) {
    process.kill(process.pid, "SIGKILL");
  }
};
syncBuiltinESMExports();
const { createSnesAssemblerEnvironment } = await import("../../src/assembler.ts");
const { buildSnesSource } = await import("../../src/disassembler/source-build.ts");
buildSnesSource({
  root,
  entrySource: "main.asm",
  environment: await createSnesAssemblerEnvironment(),
  expectedSize: 1,
  targetOptions: { checksumEnabled: false },
  outputDirectory: path.join(root, "build"),
  toolchainSha256: "a".repeat(64),
  configurationSha256: "b".repeat(64),
});
