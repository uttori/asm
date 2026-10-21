/** Interrupt real rendering/assembly through test-only hooks; production needs no fault switches. */
import assert from "node:assert/strict";
import fs from "node:fs";

import { Assembler } from "@uttori/asm-core";

const [directory, phase, mode] = process.argv.slice(2);
const abort = new AbortController();
let interrupted = false;
/** Stop only after the selected operation has performed meaningful work in its private scratch. */
function interrupt() {
  assert.equal(interrupted, false);
  interrupted = true;
  if (mode === "kill") {
    process.kill(process.pid, "SIGKILL");
  }
  abort.abort(new Error(`Cancelled during ${phase}`));
}

if (phase === "export") {
  const write = fs.writeFileSync;
  fs.writeFileSync = function (file, ...args) {
    const result = write.call(this, file, ...args);
    if (
      typeof file === "string" &&
      file.includes("/scratch/") &&
      file.endsWith("/assets/raw/000000.bin")
    ) {
      interrupt();
    }
    return result;
  };
} else {
  assert.equal(phase, "verification");
  const assemble = Assembler.prototype.assembleProgram;
  Assembler.prototype.assembleProgram = function (...args) {
    const result = assemble.apply(this, args);
    // Cancellation after assembly must prevent verification/build publication and retained Git refs.
    interrupt();
    return result;
  };
}
const { executeSourceOperation } = await import("../../../workflows/src/source.ts");
await assert.rejects(
  executeSourceOperation({ directory, action: "prepare", signal: abort.signal }),
  new RegExp(`Cancelled during ${phase}`),
);
assert.equal(interrupted, true);
