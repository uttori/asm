import { test } from "../../../../tests/ava-helper.js";
import type { InstructionDescriptor } from "../../src/architecture-types.js";
import { InstructionCatalogRegistry } from "../../src/lsp/instruction-catalog.js";

test("instruction catalogs resolve canonical names and aliases without case sensitivity", (t) => {
  const registry = new InstructionCatalogRegistry();
  const catalog: InstructionDescriptor[] = [{ mnemonic: "NOP", modes: [] }];
  t.deepEqual(registry.getInstructionCatalog("missing"), []);
  registry.register("Example.CPU", catalog, ["CPU", "Legacy"]);
  for (const name of ["example.cpu", "EXAMPLE.CPU", "cpu", "LeGaCy"]) {
    t.is(registry.getInstructionCatalog(name), catalog);
  }
  t.deepEqual(registry.getInstructionCatalog("missing"), []);
});

test("replacing a catalog updates existing aliases without affecting other architectures", (t) => {
  const registry = new InstructionCatalogRegistry();
  const first: InstructionDescriptor[] = [{ mnemonic: "NOP", modes: [] }];
  const replacement: InstructionDescriptor[] = [{ mnemonic: "HALT", modes: [] }];
  registry.register("cpu", first, ["legacy"]);
  registry.register("other", first);
  registry.register("CPU", replacement);
  t.is(registry.getInstructionCatalog("legacy"), replacement);
  t.is(registry.getInstructionCatalog("other"), first);
  // The public maps can be edited by the host. Dangling aliases must remain a safe miss.
  registry.catalogs.delete("cpu");
  t.deepEqual(registry.getInstructionCatalog("legacy"), []);
});
