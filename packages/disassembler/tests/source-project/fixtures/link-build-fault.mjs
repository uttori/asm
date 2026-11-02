import fs from "node:fs";
import path from "node:path";

import { buildLinkedObjects } from "../../../src/source-project/link-build.ts";

const [root, boundary] = process.argv.slice(2);
const recipe = JSON.parse(fs.readFileSync(path.join(root, "recipe.json"), "utf8"));
const rename = fs.renameSync;
fs.renameSync = (from, to) => {
  rename(from, to);
  const name = path.basename(to);
  if (name === boundary || (boundary === "directory" && /^[a-f0-9]{64}$/.test(name))) {
    process.kill(process.pid, "SIGKILL");
  }
};
buildLinkedObjects({
  objects: [fs.readFileSync(path.join(root, "input.uobj"))],
  recipe,
  directory: path.join(root, "build"),
});
