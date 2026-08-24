import { test } from "../ava-helper.js";
import { DirectiveRegistry } from "../../src/directives/registry.js";
import { registerLayoutDirectives } from "../../src/directives/layout.js";
import type { DirectiveRuntimeService } from "../../src/services/directive-runtime-service.js";
import type { LegacySpcRuntimeService } from "../../src/services/legacy-spc-runtime-service.js";
import { createOperandResolver } from "./test-stubs.js";

test("org routes through the injected runtime and compatibility policy", t => {
  const calls: string[][] = [];
  const runtime = {
    handleOrg: (args: string[]) => calls.push(["org", ...args]),
  } as DirectiveRuntimeService;
  const spcRuntime = {
    handleSpcblock: (words: string[]) => calls.push(words),
  } as LegacySpcRuntimeService;
  const session = {
    inTargetBlock: false,
    targetBlockInlineCompatibility: false,
  };
  const operandResolver = createOperandResolver();
  const registry = new DirectiveRegistry();
  registerLayoutDirectives(registry, {
    addressStack: { session },
    architecture: { session },
    base: { session, operandResolver },
    mapper: { session },
    org: { session, runtime, spcRuntime },
    policy: { session },
    runtime: { runtime },
    startpos: { session, operandResolver },
  });

  registry.dispatch("org", ["org", "$808000"], "org $808000");
  session.targetBlockInlineCompatibility = true;
  registry.dispatch("org", ["org", "$0200"], "org $0200");

  t.deepEqual(calls, [["org", "$808000"], ["spcblock", "$0200"]]);
});
