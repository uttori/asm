import { stub } from "sinon";

import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";

test("disposal releases captured macro bindings without mutating caller-held syntax or results", (t) => {
  for (const failDisposal of [false, true]) {
    const assembler = new Assembler();
    t.teardown(() => assembler.dispose());
    assembler.assembleSource(
      "lorom\norg $808000\nmacro emit()\ndb 7\nendmacro\n%emit()",
      "dispose.asm",
    );
    const definition = assembler.macros.get("emit");
    t.truthy(definition);
    const syntax = structuredClone(definition);
    const bytes = assembler.getBinaryOutput();
    const symbols = structuredClone(assembler.symbolDefinitions);
    if (failDisposal) {
      // Cleanup still owns captured syntax when another resource rejects its disposal.
      stub(assembler.pluginState, "dispose").throws(new Error("fixture disposal failed"));
      t.throws(() => assembler.dispose(), { instanceOf: AggregateError });
    } else {
      assembler.dispose();
    }
    t.is(assembler.macros.size, 0);
    t.deepEqual(definition, syntax);
    t.deepEqual(assembler.getBinaryOutput(), bytes);
    t.deepEqual(assembler.symbolDefinitions, symbols);
    t.notThrows(() => assembler.dispose());
  }
});
