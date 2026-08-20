import {
  definePlugin,
  PLUGIN_API_VERSION,
  type AssemblerPlugin,
  type PluginActivationContext,
} from "../../src/plugin/index.js";

export interface FixturePluginOptions {
  readonly byte: number;
}

export const registerFixtureContributions = (
  context: PluginActivationContext<FixturePluginOptions>,
): void => {
  context.registerSessionState({
    id: "fixture.state",
    create: () => ({ count: 0 }),
    clone: (value) => ({ ...value }),
    resetForStage: (value) => {
      value.count = 0;
    },
  });
  context.registerArchitecture({
    id: "fixture.one-byte",
    aliases: ["fixture-cpu"],
    displayName: "Fixture one-byte CPU",
    unknownInstructionBehavior: "throw",
    splitOperands: (text) => (text ? [text] : []),
    classifyOperand: ({ operands }, operand) => operands.lowerOperand(operand),
    createEncoder: (encoderContext) => ({
      estimateSize: () => 1,
      encode: () => {
        encoderContext.emission.writeByte(context.options.byte);
        return true;
      },
    }),
    instructions: [
      {
        mnemonic: "FIX",
        summary: "Emit the configured fixture byte.",
        modes: [{ mode: "implied", syntax: "", size: 1 }],
      },
    ],
  });
  context.registerAddressSpace({
    id: "fixture.flat",
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
    id: "fixture.raw",
    create: () => ({
      finalize: () => undefined,
      getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes),
    }),
  });
  context.registerDirectiveSet({
    id: "fixture.directives",
    directives: [
      {
        id: "fixture.directive.emit",
        keywords: ["fixturebyte"],
        phase: "lowered",
        createHandler: () => () => undefined,
        tooling: [
          {
            keyword: "fixturebyte",
            summary: "Emit a fixture byte.",
            syntax: "fixturebyte",
            group: "data",
          },
        ],
      },
    ],
  });
  context.registerExpressionSet({
    id: "fixture.expressions",
    functions: [
      {
        name: "fixturevalue",
        aliases: ["fixture_value"],
        signature: { parameters: [] },
        summary: "Return the configured fixture byte.",
        evaluate: () => context.options.byte,
      },
    ],
  });
  context.registerLifecycle({
    id: "fixture.lifecycle",
    create: () => ({}),
  });
  context.registerTarget({
    id: "fixture.raw-target",
    aliases: ["fixture"],
    displayName: "Fixture raw target",
    defaultArchitecture: "fixture-cpu",
    architectures: ["fixture.one-byte"],
    addressSpace: "fixture.flat",
    outputFormat: "fixture.raw",
    directiveSets: ["fixture.directives"],
    expressionSets: ["fixture.expressions"],
    lifecycle: ["fixture.lifecycle"],
    defaultOutputExtension: ".bin",
  });
};

export const createFixturePlugin = (
  overrides: Partial<AssemblerPlugin<FixturePluginOptions>> = {},
): AssemblerPlugin<FixturePluginOptions> =>
  definePlugin<FixturePluginOptions>({
    manifest: {
      id: "fixture.plugin",
      name: "Fixture plugin",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
    },
    validateOptions: (configured) => {
      const byte =
        typeof configured === "object" &&
        configured !== null &&
        "byte" in configured &&
        typeof configured.byte === "number"
          ? configured.byte
          : 0x42;
      if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
        throw new Error("byte must be an unsigned byte");
      }
      return { byte };
    },
    activate: (context) => registerFixtureContributions(context),
    ...overrides,
  });
