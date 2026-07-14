import { test } from "../ava-helper.js";
import { DirectiveRegistry } from "../../src/directives/registry.js";
import { registerIncludeSourceDirectives } from "../../src/directives/include-source.js";
import type { IncludeDirectiveContext } from "../../src/directives/types.js";
import { createOperandResolver, runtimeStub } from "./test-stubs.js";

test("includeonce only requires current-file include state", t => {
  const session = {
    currentFile: "main.asm",
    includedFiles: new Map<string, { included: boolean; guarded: boolean }>(),
  };
  const registry = new DirectiveRegistry();
  const context = {
    session,
    operandResolver: createOperandResolver(),
    runtime: runtimeStub,
  } as IncludeDirectiveContext;
  registerIncludeSourceDirectives(registry, context);

  registry.dispatch("includeonce", ["includeonce"], "includeonce");
  t.deepEqual(session.includedFiles.get("main.asm"), { included: true, guarded: true });
});
