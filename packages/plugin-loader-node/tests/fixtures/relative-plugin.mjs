const plugin = {
  manifest: {
    id: "loader.fixture-plugin",
    name: "Loader fixture plugin",
    version: "1.0.0",
    apiVersion: 1,
  },
  validateOptions(configured) {
    const byte = configured?.byte ?? 0x42;
    if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
      throw new Error("byte must be an unsigned byte");
    }
    return { byte };
  },
  activate(context) {
    context.registerArchitecture({
      id: "loader.fixture-architecture",
      aliases: ["loader-cpu"],
      displayName: "Loader fixture architecture",
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
      instructions: [
        {
          mnemonic: "FIX",
          summary: "Emit the loader fixture byte.",
          modes: [{ mode: "implied", syntax: "", size: 1 }],
        },
      ],
    });
    context.registerAddressSpace({
      id: "loader.fixture-address-space",
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
      id: "loader.fixture-output",
      create: () => ({
        finalize: () => undefined,
        getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes),
      }),
    });
    context.registerTarget({
      id: "loader.fixture-target",
      aliases: ["loader-fixture"],
      displayName: "Loader fixture target",
      defaultArchitecture: "loader.fixture-architecture",
      architectures: ["loader.fixture-architecture"],
      addressSpace: "loader.fixture-address-space",
      outputFormat: "loader.fixture-output",
      directiveSets: [],
      expressionSets: [],
      lifecycle: [],
      defaultOutputExtension: ".bin",
    });
  },
};

export default plugin;
