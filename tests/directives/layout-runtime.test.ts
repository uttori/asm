import { test } from "../ava-helper.js";
import { DirectiveRegistry } from "../../packages/core/src/directives/registry.js";
import { registerLayoutDirectives } from "../../packages/core/src/directives/layout.js";
import type { DirectiveRuntimeService } from "../../packages/core/src/services/directive-runtime-service.js";
import { createOperandResolver } from "./test-stubs.js";

test("org routes through the injected runtime and compatibility policy", (t) => {
  const calls: string[][] = [];
  const runtime = {
    handleOrg: (args: string[]) => calls.push(["org", ...args]),
  } as DirectiveRuntimeService;
  const session = {
    currentTargetAddress: 0,
    currentTargetBaseAddress: 0,
  };
  const operandResolver = createOperandResolver();
  const registry = new DirectiveRegistry();
  registerLayoutDirectives(registry, {
    addressStack: { session },
    architecture: { session },
    base: { session, operandResolver },
    mapper: { session },
    org: { session, runtime },
    runtime: { runtime },
    startpos: { session, operandResolver },
  });

  registry.dispatch("org", ["org", "$808000"], "org $808000");
  registry.dispatch("org", ["org", "$0200"], "org $0200");

  t.deepEqual(calls, [
    ["org", "$808000"],
    ["org", "$0200"],
  ]);
});
