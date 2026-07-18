import { test } from "../ava-helper.js";
import { DirectiveRegistry } from "../../src/directives/registry.js";
import { registerIncludeSourceDirectives } from "../../src/directives/include-source.js";
import type { IncludeDirectiveContext } from "../../src/directives/types.js";
import { createOperandResolver, runtimeStub } from "./test-stubs.js";

test("source directives call only the focused include service", t => {
  const calls: string[] = [];
  const registry = new DirectiveRegistry();
  const context = {
    session: {},
    includeSource: {
      assembleFile: (filename: string) => calls.push(`incsrc:${filename}`),
      guardCurrentFile: () => calls.push("includeonce"),
      includeFile: (filename: string) => calls.push(`include:${filename}`),
      readFile: () => new Uint8Array(),
    },
    operandResolver: createOperandResolver(),
    runtime: runtimeStub,
  } as IncludeDirectiveContext;
  registerIncludeSourceDirectives(registry, context);

  registry.dispatch("incsrc", ["incsrc", "raw.asm"], "incsrc raw.asm");
  registry.dispatch("include", ["include", "guarded.asm"], "include guarded.asm");
  registry.dispatch("includeonce", ["includeonce"], "includeonce");

  t.deepEqual(calls, ["incsrc:raw.asm", "include:guarded.asm", "includeonce"]);
});
