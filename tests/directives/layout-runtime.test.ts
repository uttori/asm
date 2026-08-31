import { test } from "../ava-helper.js";
import { DirectiveRegistry } from "../../packages/core/src/directives/registry.js";
import {
  handleArch,
  handlePullBase,
  registerLayoutDirectives,
} from "../../packages/core/src/directives/layout.js";
import type { DirectiveRegistryContexts } from "../../packages/core/src/directives/registry.js";
import type { ArchitectureDirectiveContext } from "../../packages/core/src/directives/types.js";
import type { DirectiveRuntimeService } from "../../packages/core/src/services/directive-runtime-service.js";
import { createOperandResolver } from "./test-stubs.js";

const createLayoutHarness = () => {
  const calls: string[][] = [];
  const runtime = {
    handleOrg: (args: string[]) => calls.push(["org", ...args]),
    handlePushPC: () => calls.push(["pushpc"]),
    handlePullPC: () => calls.push(["pullpc"]),
  } as DirectiveRuntimeService;
  const session = {
    currentTargetAddress: 0x8000,
    currentTargetBaseAddress: 0x8100,
    currentTargetStartAddress: 0x8000,
    currentTargetBaseStartAddress: 0x8100,
    pushBaseStack: [] as number[],
    addressWidth: 16,
    arch: "snes.65816",
    architectureRegistry: {
      getCanonicalName: (name: string) => {
        if (name === "65816" || name === "snes.65816") return "snes.65816";
        if (name === "spc700") return "snes.spc700";
        return undefined;
      },
    },
    availableArchitectures: new Set(["snes.65816"]),
    targetDisplayName: "SNES",
  };
  const operandResolver = createOperandResolver();
  const registry = new DirectiveRegistry();
  const context: DirectiveRegistryContexts["layout"] = {
    addressStack: { session },
    architecture: { session },
    base: { session, operandResolver },
    org: { session, runtime },
    runtime: { runtime },
  };
  registerLayoutDirectives(registry, context);
  return { calls, session, registry };
};

test("org routes through the injected runtime and compatibility policy", (t) => {
  const { calls, registry } = createLayoutHarness();

  registry.dispatch("org", ["org", "$808000"], "org $808000");
  registry.dispatch("org", ["org", "$0200"], "org $0200");

  t.deepEqual(calls, [
    ["org", "$808000"],
    ["org", "$0200"],
  ]);
});

test("pushpc and pullpc route through the injected runtime", (t) => {
  const { calls, registry } = createLayoutHarness();
  registry.dispatch("pushpc", ["pushpc"], "pushpc");
  registry.dispatch("pullpc", ["pullpc"], "pullpc");
  t.deepEqual(calls, [["pushpc"], ["pullpc"]]);
});

test("pushbase and pullbase save and restore the target address", (t) => {
  const { session, registry } = createLayoutHarness();
  session.currentTargetAddress = 0x1234;
  registry.dispatch("pushbase", ["pushbase"], "pushbase");
  session.currentTargetAddress = 0x5678;
  registry.dispatch("pullbase", ["pullbase"], "pullbase");
  t.is(session.currentTargetAddress, 0x1234);
});

test("pullbase rejects an empty stack", (t) => {
  t.is(
    t.throws(() =>
      handlePullBase({
        session: {
          pushBaseStack: [],
          currentTargetAddress: 0,
          currentTargetBaseAddress: 0,
          currentTargetStartAddress: 0,
          currentTargetBaseStartAddress: 0,
          addressWidth: 16,
        },
      }),
    ).message,
    "No base value to pull.",
  );
});

test("base requires one in-range parameter and supports off", (t) => {
  const { session, registry } = createLayoutHarness();

  t.is(
    t.throws(() => registry.dispatch("base", ["base"], "base")).message,
    "BASE directive requires exactly one parameter.",
  );
  t.is(
    t.throws(() => registry.dispatch("base", ["base", "$10000"], "base $10000")).message,
    "Invalid base address: $10000. Must be within 16 bits.",
  );

  registry.dispatch("base", ["base", "$2000"], "base $2000");
  t.is(session.currentTargetAddress, 0x2000);
  t.is(session.currentTargetStartAddress, 0x2000);

  session.currentTargetBaseAddress = 0x8100;
  session.currentTargetBaseStartAddress = 0x8200;
  registry.dispatch("base", ["base", "off"], "base off");
  t.is(session.currentTargetAddress, 0x8100);
  t.is(session.currentTargetStartAddress, 0x8200);
});

test("arch without selectArchitecture writes session.arch and enforces the target set", (t) => {
  const session: ArchitectureDirectiveContext["session"] = {
    arch: "old",
    architectureRegistry: {
      getCanonicalName: (name: string) => {
        if (name === "65816") return "snes.65816";
        if (name === "spc700") return "snes.spc700";
        return undefined;
      },
    } as ArchitectureDirectiveContext["session"]["architectureRegistry"],
    availableArchitectures: new Set(["snes.65816"]),
    targetDisplayName: "SNES",
  };

  handleArch({ session }, ["arch", "65816"]);
  t.is(session.arch, "snes.65816");

  t.is(
    t.throws(() => handleArch({ session }, ["arch", "spc700"])).message,
    "Architecture snes.spc700 is unavailable for target SNES.",
  );
  t.is(
    t.throws(() => handleArch({ session }, ["arch", "z80"])).message,
    "Unsupported architecture: z80",
  );
  t.is(
    t.throws(() => handleArch({ session }, ["arch"])).message,
    "ARCH command requires an architecture parameter.",
  );

  const selected: string[] = [];
  const selectable = {
    ...session,
    selectArchitecture: (architecture: string, sourceAlias = architecture) => {
      selected.push(architecture, sourceAlias);
    },
  };
  handleArch({ session: selectable }, ["arch", "65816"]);
  handleArch({ session: selectable }, ["arch", "z80"]);
  t.deepEqual(selected, ["snes.65816", "65816", "z80", "z80"]);

  delete session.targetDisplayName;
  t.is(
    t.throws(() => handleArch({ session }, ["arch", "spc700"])).message,
    "Architecture snes.spc700 is unavailable for target active target.",
  );
});
