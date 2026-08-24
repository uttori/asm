import { test } from "./ava-helper.js";

import { Assembler } from "./test-assembler.js";
import type { ArchitectureExtension } from "../src/architecture-registry.js";
import type { ArchitectureEncoderContext } from "../src/architecture-types.js";
import {
  builtInTargetProfiles,
  mos6502StubTargetProfile,
  rawBinaryOutputFormat,
  snesTargetProfile,
  type TargetProfile,
} from "../src/target-profile.js";

test("SNES remains the default composed target", (t) => {
  const assembler = new Assembler();

  t.is(assembler.targetProfile, snesTargetProfile);
  t.is(assembler.arch, "65816");
  t.is(assembler.targetState.mapper, "lorom");
  t.true(assembler.targetState.checksumEnabled);
  t.true(assembler.directiveRegistry.has("lorom"));
  t.true(assembler.directiveRegistry.has("spcblock"));
  t.true(assembler.directiveRegistry.has("freespace"));
  t.is(assembler.mathCore.math("snestopc($808000)"), 0);
  t.is(assembler.mathCore.math("pctosnes(0)"), 0x808000);
  t.true(assembler.shouldEndifCloseInnermostWhile("while", 3, 1));
  t.true(
    assembler.environment
      .getToolingCatalog(assembler.targetId)
      .getExpressionFunctions()
      .some((expressionFunction) => expressionFunction.name === "snestopc"),
  );
  t.is(builtInTargetProfiles.get("sfc"), snesTargetProfile);
});

test("6502 target is an explicit non-functional framework stub", (t) => {
  const assembler = new Assembler(undefined, { targetProfile: mos6502StubTargetProfile });

  t.is(assembler.arch, "6502");
  t.is(assembler.targetState.mapper, "flat");
  t.false(assembler.targetState.checksumEnabled);
  t.truthy(assembler.architectureRegistry.getDefinition("mos6502"));
  t.deepEqual(assembler.architectureRegistry.getInstructionCatalog("6502"), []);
  t.true(assembler.directiveRegistry.has("org"));
  t.true(assembler.directiveRegistry.has("db"));
  t.false(assembler.directiveRegistry.has("lorom"));
  t.false(assembler.directiveRegistry.has("spcblock"));
  t.false(assembler.directiveRegistry.has("freespace"));
  t.false(assembler.directiveRegistry.has("check"));
  t.is(builtInTargetProfiles.get("6502-stub"), mos6502StubTargetProfile);

  t.throws(() => assembler.assembleSource("org $8000\nnop", "stub.asm"), {
    message: /framework stub/i,
  });
  t.throws(() => assembler.directiveRuntime.handleOrg(["$10000"]), {
    message: /invalid org address/i,
  });
  t.throws(() => assembler.mathCore.math("snestopc($8000)"), {
    message: /unknown built-in function 'snestopc'/i,
  });
});

test("architecture extensions bind encoders to each assembler session", (t) => {
  let factoriesCreated = 0;
  const extension: ArchitectureExtension = {
    name: "contract-cpu",
    aliases: ["contract-alias"],
    classifyOperand: (resolver, operand) => resolver.lowerOperand(operand),
    splitOperands: (operandText) => (operandText ? [operandText] : []),
    unknownInstructionBehavior: "throw",
    createEncoder: (context: ArchitectureEncoderContext) => {
      factoriesCreated++;
      return {
        estimateSize: () => 2,
        encode: () => {
          context.emission.writeValue(0x1234, 2, "big");
          return true;
        },
        getInstructionCatalog: () => [
          {
            mnemonic: "EMIT",
            summary: "Contract instruction.",
            modes: [{ mode: "implied", syntax: "", size: 2 }],
          },
        ],
      };
    },
  };
  let finalizations = 0;
  const target: TargetProfile = {
    ...mos6502StubTargetProfile,
    name: "contract-target",
    defaultArchitecture: "contract-cpu",
    architectures: new Set(["contract-cpu"]),
    outputFormat: {
      ...rawBinaryOutputFormat,
      finalize: () => {
        finalizations++;
      },
    },
  };

  const assembler = new Assembler(undefined, {
    targetProfile: target,
    architectureExtensions: [extension],
  });
  t.is(factoriesCreated, 1);
  t.truthy(assembler.architectureRegistry.getDefinition("contract-alias"));
  t.is(assembler.architectureRegistry.getInstructionCatalog("contract-cpu")[0]?.mnemonic, "EMIT");

  assembler.assembleSource("org $0000\nemit", "contract.asm");
  t.deepEqual([...assembler.getBinaryOutput()], [0x12, 0x34]);
  t.is(finalizations, 1);

  const tooling = assembler.createToolingSession();
  t.is(factoriesCreated, 2);
  t.not(
    tooling.architectureRegistry.getDefinition("contract-cpu")?.encoder,
    assembler.architectureRegistry.getDefinition("contract-cpu")?.encoder,
  );
});

test("target profile restricts architecture switching", (t) => {
  const assembler = new Assembler(undefined, { targetProfile: mos6502StubTargetProfile });

  t.throws(() => assembler.processCommand("arch 65816"), {
    message: /unavailable for target mos6502-stub/i,
  });
});
