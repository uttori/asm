import fs from "node:fs";
import path from "node:path";

import { buildLinkedObjects } from "@uttori/asm-disassembler/source-project";
import { createNesLinkTarget } from "@uttori/asm-plugin-65xx";
import { createSnesLinkTarget } from "@uttori/asm-plugin-snes/target";

const directory = process.argv[2];
const input = JSON.parse(fs.readFileSync(path.join(directory, "link-input.json"), "utf8"));
const receipt = buildLinkedObjects({
  objects: input.objects.map((name) => fs.readFileSync(path.join(directory, name))),
  libraries: input.libraries.map((name) => fs.readFileSync(path.join(directory, name))),
  recipe: input.recipe,
  target: input.recipe.target === "snes.sfc" ? createSnesLinkTarget() : createNesLinkTarget(),
  directory: path.join(directory, "linked"),
});
process.stdout.write(JSON.stringify(receipt));
