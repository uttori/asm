import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Assembler, WorkspaceIndex } from "@uttori/asm-core";

import { test } from "../../../tests/ava-helper.js";
import { create65xxAssemblerEnvironment, nesChrPng } from "../src/index.js";

const environment = await create65xxAssemblerEnvironment();

for (const sourceStyle of ["asar", "ca65"] as const) {
  test(`${sourceStyle} NES asset assertions wait for exact sizes while editor analysis retains dependencies`, (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-nes-asset-analysis-"));
    t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
    const root = path.join(directory, "main.asm");
    const asset = path.join(directory, "chr.png");
    const options = { environment, target: "65xx.nes", targetOptions: { sourceStyle } };
    const directive = sourceStyle === "asar" ? "assert" : ".assert";
    const origin = sourceStyle === "asar" ? "org $000000\nbase $0000" : ".org $0000";
    const source = `${origin}
CHR_start:
  includeAsset("chr.png", "nes.chr.2bpp")
CHR_end:
  ${directive} ((CHR_end - CHR_start) & $FFFF) == $2000, "CHR size changed"
AfterAssertion:
`;
    const native = Uint8Array.from({ length: 0x2000 }, (_, index) => index & 255);
    fs.writeFileSync(asset, nesChrPng(native));
    fs.writeFileSync(root, source);
    const index = new WorkspaceIndex({ ...options, entryPoints: [root] });
    index.reindex();
    t.deepEqual(index.getDiagnostics(root), []);
    t.true(index.getSymbols(root).some((symbol) => symbol.name === "AfterAssertion"));
    t.deepEqual(index.rootAnalyses.get(root)?.assetDependencies, { [asset]: "binary" });

    const assembler = new Assembler(options);
    t.teardown(() => assembler.dispose());
    assembler.assembleSource(source, root);
    t.is(assembler.symbolScope.getLabelValue("CHR_end", false), 0x2000);
    t.is(
      assembler.addressToLineMapping.assets.find((entry) => entry.format === "nes.chr.2bpp")?.size,
      native.length,
    );

    // A real size change must still fail explicit assembly even though edit-time conversion is deferred.
    fs.writeFileSync(asset, nesChrPng(native.subarray(0, 0x1000)));
    const changed = new Assembler(options);
    t.teardown(() => changed.dispose());
    t.throws(() => changed.assembleSource(source, root), { message: /CHR size changed/ });

    // Numeric checks remain authoritative after an asset, including values supplied through defines.
    const constant = sourceStyle === "asar" ? "!expected = $2000" : "";
    const reference = sourceStyle === "asar" ? "!expected" : "$2000";
    // Dependency discovery must not decode media during synchronous edits, even when its bytes are incomplete.
    fs.writeFileSync(asset, new Uint8Array([0]));
    index.updateDocument(
      root,
      `${source}\n${constant}\n${directive} ${reference} == 0, "constant failure"\n`,
    );
    index.reindex();
    t.is(index.getDiagnostics(root).length, 1);
    t.true(
      index
        .getDiagnostics(root)
        .some((diagnostic) => diagnostic.message.includes("constant failure")),
    );

    // A new analysis without skipped assets must not inherit the previous pass's provisional-layout flag.
    const data = sourceStyle === "asar" ? "db" : ".byte";
    index.updateDocument(
      root,
      `${origin}\nStart:\n${data} 0\nEnd:\n${directive} End - Start == 2, "ordinary failure"\n`,
    );
    index.reindex();
    t.true(
      index
        .getDiagnostics(root)
        .some((diagnostic) => diagnostic.message.includes("ordinary failure")),
    );
  });
}
