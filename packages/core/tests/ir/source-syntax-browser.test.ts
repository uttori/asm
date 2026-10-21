import { runInNewContext } from "node:vm";

import { buildSync } from "esbuild";

import { test } from "../../../../tests/ava-helper.js";

test("portable compiled browser exports execute the source AST slice after JSON transport", async (t) => {
  const output = buildSync({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
    import {Assembler,MemoryAssemblyFileProvider,PluginManager} from '@uttori/asm-core';
    import snes from '@uttori/asm-plugin-snes';
    globalThis.result=(async()=>{
      const manager=new PluginManager(); await manager.activatePlugins([{plugin:snes}]);
      const assembler=new Assembler({environment:manager.freeze(),target:'snes.sfc',fileProvider:new MemoryAssemblyFileProvider({})});
      try {
        const program=assembler.buildProgramModel('org $808000\\nMain: db 2 * (3 + 4)\\ncheck bankcross off\\ndb (5+1)\\nfunction twice(x) = x*2\\nmacro Emit(x)\\ndb twice(<x>)\\nendmacro\\n%Emit(4)','browser.asm');
        assembler.assembleProgram(JSON.parse(JSON.stringify(program)));
        return JSON.stringify([...assembler.getBinaryOutput()]);
      } finally {assembler.dispose();await manager.dispose();}
    })();`,
    },
    platform: "browser",
    conditions: ["browser"],
    bundle: true,
    write: false,
    format: "esm",
    logLevel: "silent",
  });
  // Deliberately omit Node globals and structuredClone, matching restricted browser workers.
  const context = {
    result: undefined as Promise<string> | undefined,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    Int8Array,
    Int16Array,
    Int32Array,
    ArrayBuffer,
    DataView,
  };
  await runInNewContext(`(async () => { ${output.outputFiles[0].text} })()`, context);
  t.is(await context.result, "[14,6,8]");
});
