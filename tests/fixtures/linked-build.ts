import fs from "node:fs";
import path from "node:path";

/** Small independently specified ROM with cross-module code/data relocations and an included binary payload. */
export function createLinkedBuildFixture(directory: string): {
  manifest: string;
  original: Uint8Array;
} {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "main.asm"),
    'section "Code"\nimport Helper\nexport Start\nStart:\njsl Helper\nlda.w #$1234\nrtl\ndl Helper\n',
  );
  fs.writeFileSync(
    path.join(directory, "helper.asm"),
    'section "Code"\nexport Helper\nHelper:\nrtl\nincbin "payload.bin"\n',
  );
  fs.writeFileSync(path.join(directory, "payload.bin"), Uint8Array.of(0xaa, 0x55));
  fs.writeFileSync(
    path.join(directory, "uttori-asm.config.json"),
    JSON.stringify({
      plugins: [{ module: "@uttori/asm-plugin-snes", options: { checksumEnabled: false } }],
      target: "snes.sfc",
      linkProject: "build.json",
    }),
  );
  fs.writeFileSync(
    path.join(directory, "recipe.json"),
    JSON.stringify({
      target: "snes.sfc",
      targetOptions: { mapper: "lorom" },
      checksumPolicy: "preserve",
      regions: [{ name: "ROM", start: 0x808000, size: 0x8000, outputOffset: 0, fillByte: 255 }],
      placements: [{ section: "Code", load: "ROM", run: "ROM", bankSize: 0x10000 }],
    }),
  );
  fs.writeFileSync(
    path.join(directory, "build.json"),
    JSON.stringify({
      format: "uttori-build",
      version: 1,
      recipe: "recipe.json",
      modules: [
        { id: "main", source: "main.asm" },
        { id: "helper", source: "helper.asm" },
      ],
      outputDirectory: "build",
      outputName: "fixture.sfc",
      original: "original.sfc",
    }),
  );
  const original = new Uint8Array(0x8000).fill(255);
  original.set([
    0x22, 0x0b, 0x80, 0x80, 0xa9, 0x34, 0x12, 0x6b, 0x0b, 0x80, 0x80, 0x6b, 0xaa, 0x55,
  ]);
  fs.writeFileSync(path.join(directory, "original.sfc"), original);
  return { manifest: path.join(directory, "build.json"), original };
}

/** Equivalent authored Asar layout with independently specified bytes and a replaceable source recipe. */
export function createAsarSourceBuildFixture(
  directory: string,
): ReturnType<typeof createLinkedBuildFixture> {
  const fixture = createLinkedBuildFixture(directory);
  fs.writeFileSync(
    path.join(directory, "main.asm"),
    "lorom\norg $808000\nimport Helper\nexport Start\nStart:\njsl Helper\nlda.w #$1234\nrtl\ndl Helper\n",
  );
  fs.writeFileSync(
    path.join(directory, "helper.asm"),
    'lorom\norg $80800B\nexport Helper\nHelper:\nrtl\nincbin "payload.bin"\npadbyte $FF\npad $818000\n',
  );
  fs.writeFileSync(
    fixture.manifest,
    JSON.stringify({
      format: "uttori-build",
      version: 1,
      recipe: { from: "modules", target: "snes.sfc" },
      modules: [
        { id: "main", source: "main.asm", sourceAdapter: "asar" },
        { id: "helper", source: "helper.asm", sourceAdapter: "asar" },
      ],
      outputDirectory: "build",
      outputName: "fixture.sfc",
      original: "original.sfc",
    }),
  );
  return fixture;
}
