import type { DecodedInstruction } from "@uttori/asm-core";
import { definePlugin, PLUGIN_API_VERSION, type AssemblerPlugin } from "@uttori/asm-core/plugin";

interface ExampleOptions {
  readonly byte: number;
}

const plugin: AssemblerPlugin<ExampleOptions> = definePlugin({
  manifest: {
    id: "example.byte-plugin",
    name: "Example byte plugin",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    description: "A minimal raw-binary target for the Uttori ASM plugin author guide.",
  },
  validateOptions(configured) {
    const value =
      typeof configured === "object" &&
      configured !== null &&
      "byte" in configured &&
      typeof configured.byte === "number"
        ? configured.byte
        : 0x42;
    if (!Number.isInteger(value) || value < 0 || value > 0xff) {
      throw new Error("byte must be an unsigned byte");
    }
    return { byte: value };
  },
  activate(context) {
    const state = context.registerSessionState({
      id: "example.state",
      create: () => ({ marks: 0 }),
      clone: (value) => ({ ...value }),
      resetForStage: (value) => {
        value.marks = 0;
      },
    });
    context.registerArchitecture({
      id: "example.byte",
      aliases: ["byte"],
      displayName: "Example one-byte architecture",
      unknownInstructionBehavior: "throw",
      splitOperands: (text) => (text ? [text] : []),
      classifyOperand: ({ operands }, operand) => operands.lowerOperand(operand),
      createEncoder: ({ emission }) => ({
        estimateSize: () => 1,
        encode: () => {
          emission.writeByte(context.options.byte);
          return true;
        },
      }),
      createDecoder: () => ({
        decode: ({ source, offset, logicalAddress }) => {
          const byte = source.readByte(offset);
          if (byte === undefined) {
            return {
              kind: "error",
              code: "outOfBounds",
              message: `Cannot read a byte at offset ${offset}.`,
              offset,
              requiredBytes: 1,
              availableBytes: Math.max(0, source.length - offset),
            };
          }
          if (byte !== context.options.byte) {
            return {
              kind: "error",
              code: "invalidOpcode",
              message: `Expected configured byte $${context.options.byte.toString(16).padStart(2, "0")}.`,
              offset,
            };
          }
          const instruction: DecodedInstruction = {
            architecture: "example.byte",
            specificationId: "example.byte.byte",
            opcode: byte,
            mnemonic: "BYTE",
            mode: "implied",
            offset,
            logicalAddress,
            bytes: Uint8Array.of(byte),
            size: 1,
            operands: [],
            references: [],
            flow: { kind: "fallthrough", fallthrough: true },
            effects: [],
          };
          return { kind: "instruction", instruction };
        },
      }),
      instructionSpecifications: [
        {
          id: "example.byte.byte",
          architecture: "example.byte",
          opcode: [context.options.byte],
          mnemonic: "BYTE",
          mode: "implied",
          minimumSize: 1,
          maximumSize: 1,
          summary: "Recognize the byte configured for this plugin.",
        },
      ],
      instructions: [
        {
          mnemonic: "BYTE",
          summary: "Emit the byte configured for this plugin.",
          modes: [{ mode: "implied", syntax: "", size: 1 }],
        },
      ],
    });
    context.registerAddressSpace({
      id: "example.flat",
      create: () => ({
        addressWidth: 16,
        defaultOrigin: 0,
        normalizeForWrite: (address) => address,
        advance: (address, amount) => address + amount,
        toOutputOffset: (address) => address,
        fromOutputOffset: (offset) => offset,
      }),
    });
    context.registerOutputFormat({
      id: "example.raw-output",
      create: () => ({
        finalize: () => undefined,
        getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes),
      }),
    });
    context.registerDirectiveSet({
      id: "example.directives",
      directives: [
        {
          id: "example.mark",
          keywords: ["mark"],
          phase: "lowered",
          createHandler:
            ({ state: sessionState }) =>
            () => {
              sessionState.get(state).marks++;
            },
          tooling: [
            {
              keyword: "mark",
              summary: "Record a target-local marker.",
              syntax: "mark",
              group: "example",
            },
          ],
        },
      ],
    });
    context.registerTarget({
      id: "example.raw",
      aliases: ["example"],
      displayName: "Example raw binary",
      defaultArchitecture: "example.byte",
      architectures: ["example.byte"],
      addressSpace: "example.flat",
      outputFormat: "example.raw-output",
      directiveSets: ["example.directives"],
      expressionSets: [],
      lifecycle: [],
      defaultOutputExtension: ".bin",
    });
  },
});

export default plugin;
