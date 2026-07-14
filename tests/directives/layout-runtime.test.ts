import { test } from "../ava-helper.js";
import { DirectiveRegistry } from "../../src/directives/registry.js";
import { registerLayoutDirectives } from "../../src/directives/layout.js";
import type { DirectiveRuntimeService } from "../../src/services/directive-runtime-service.js";
import { createOperandResolver } from "./test-stubs.js";

test("org routes through the injected runtime and compatibility policy", t => {
  const calls: string[][] = [];
  const runtime = {
    handleOrg: (args: string[]) => calls.push(["org", ...args]),
    handleSpcblock: (words: string[]) => calls.push(words),
  } as DirectiveRuntimeService;
  const session = {
    inSpcblock: false,
    spcInlineCompatMode: false,
  };
  const operandResolver = createOperandResolver();
  const registry = new DirectiveRegistry();
  registerLayoutDirectives(registry, {
    addressStack: { session },
    architecture: { session },
    base: { session, operandResolver },
    mapper: { session },
    org: { session, runtime },
    policy: { session },
    runtime: { runtime },
    startpos: { session, operandResolver },
  });

  registry.dispatch("org", ["org", "$808000"], "org $808000");
  session.spcInlineCompatMode = true;
  registry.dispatch("org", ["org", "$0200"], "org $0200");

  t.deepEqual(calls, [["org", "$808000"], ["spcblock", "$0200"]]);
});
