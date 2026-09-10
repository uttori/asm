import {
  exportCaptureJson,
  recoverCaptureFile,
} from "../packages/debug-adapter/src/capture-file.js";

const [operation, file, destination] = process.argv.slice(2);
if (!file || !["inspect", "export"].includes(operation ?? "")) {
  throw new Error(
    "Usage: node --import=tsx scripts/ares-capture-file.ts inspect capture.act2[.partial] | export capture.act2 trace.json",
  );
}
if (operation === "export") {
  if (!destination) throw new Error("Export requires a new JSON destination.");
  await exportCaptureJson(file, destination);
  console.log(`Exported ${destination}`);
} else {
  console.log(JSON.stringify(await recoverCaptureFile(file), undefined, 2));
}
