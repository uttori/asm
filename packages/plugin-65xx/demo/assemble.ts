import fs from "node:fs";

import { Assembler } from "@uttori/asm-core";

import { create65xxAssemblerEnvironment, NES_65XX_TARGET_ID } from "../src/index.ts";

const environment = await create65xxAssemblerEnvironment();
const source = fs.readFileSync(new URL("./hello-world.asm", import.meta.url), "utf8");
const assembler = new Assembler({
  environment,
  target: NES_65XX_TARGET_ID,
  architecture: "65xx.6502",
});
try {
  assembler.assembleSource(source, "hello-world.asm");
  const out = assembler.getBinaryOutput();
  console.log("length", out.length);
  // Typed-array map preserves numeric storage; Array.from keeps the formatted hexadecimal strings.
  console.log(
    "header",
    Array.from(out.subarray(0, 16), (b) => b.toString(16).padStart(2, "0")).join(" "),
  );
  console.log(
    "vectors",
    Array.from(out.subarray(out.length - 6), (b) => b.toString(16).padStart(2, "0")).join(" "),
  );
  console.log("reset vector", (out[out.length - 3] << 8) | out[out.length - 4]);
  fs.writeFileSync("hello-world.nes", out);
  console.log("wrote hello-world.nes");
} finally {
  assembler.dispose();
}
