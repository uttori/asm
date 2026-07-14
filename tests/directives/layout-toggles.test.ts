import { test } from "../ava-helper.js";
import { DirectiveRegistry } from "../../src/directives/registry.js";
import {
  handlePullBase,
  handlePushBase,
  registerLayoutDirectives,
} from "../../src/directives/layout.js";
import type { AddressStackDirectiveContext } from "../../src/directives/types.js";
import { createOperandResolver, runtimeStub } from "./test-stubs.js";

test("mapper directives apply compatibility policy without an assembler", t => {
  const session = {
    mapper: "lorom",
    checksumFixEnabled: true,
    sa1banks: [] as number[],
    inSpcblock: false,
  };
  const operandResolver = createOperandResolver();
  const registry = new DirectiveRegistry();
  registerLayoutDirectives(registry, {
    addressStack: { session },
    architecture: { session },
    base: { session, operandResolver },
    mapper: { session },
    org: { session, runtime: runtimeStub },
    policy: { session },
    runtime: { runtime: runtimeStub },
    startpos: { session, operandResolver },
  });

  registry.dispatch("norom", ["norom"], "norom");
  t.is(session.mapper, "norom");
  t.false(session.checksumFixEnabled);

  session.inSpcblock = true;
  t.throws(() => registry.dispatch("hirom", ["hirom"], "hirom"));
});

test("base stack handlers only require address stack state", t => {
  const session = {
    currentTargetAddress: 0x808000,
    pushBaseStack: [] as number[],
  };
  const ctx = {
    session,
    operandResolver: createOperandResolver(),
    runtime: runtimeStub,
  } as AddressStackDirectiveContext;

  handlePushBase(ctx);
  session.currentTargetAddress = 0x818000;
  handlePullBase(ctx);
  t.is(session.currentTargetAddress, 0x808000);
  t.throws(() => handlePullBase(ctx));
});
