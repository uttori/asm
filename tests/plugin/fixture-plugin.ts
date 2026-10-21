import {
  CORE_DIRECTIVE_GROUPS,
  type CoreDirectiveGroup,
} from "../../packages/core/src/directive-groups.js";

function isCoreDirectiveGroup(value: unknown): value is CoreDirectiveGroup {
  return CORE_DIRECTIVE_GROUPS.some((group) => group === value);
}

function readCoreDirectiveGroups(value: unknown): CoreDirectiveGroup[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const groups: CoreDirectiveGroup[] = [];
  for (const entry of value) {
    if (!isCoreDirectiveGroup(entry)) {
      throw new Error("coreDirectiveGroups must contain known groups.");
    }
    groups.push(entry);
  }
  return groups;
}
import {
  definePlugin,
  parseInstructionOperands,
  PLUGIN_API_VERSION,
  type AssemblerPlugin,
  type PluginActivationContext,
} from "../../packages/core/src/plugin/index.js";

export interface FixturePluginOptions {
  readonly byte: number;
  readonly coreDirectiveGroups?: readonly CoreDirectiveGroup[];
}

export const registerFixtureContributions = (
  context: PluginActivationContext<FixturePluginOptions>,
): void => {
  const fixtureState = context.registerSessionState({
    id: "fixture.state",
    create: () => ({ count: 0, history: { values: [] as number[] } }),
    clone: (value) => ({
      ...value,
      history: { values: [...value.history.values] },
    }),
    resetForStage: (value) => {
      value.count = 0;
    },
  });
  context.registerArchitecture({
    id: "fixture.one-byte",
    aliases: ["fixture-cpu"],
    displayName: "Fixture one-byte CPU",
    unknownInstructionBehavior: "throw",
    operandGrammar: {
      version: "1",
      parse: (mnemonic, text) =>
        parseInstructionOperands(mnemonic, text, {
          registers: [],
          indexRegisters: [],
          commaIndex: false,
        }),
    },
    createTypedEncoder: () => ({
      estimate: (frame) => {
        frame.choose("fixture", 1);
        return 1;
      },
      encode: (frame, encoderContext) => {
        frame.choose("fixture", 1);
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
        syntax: {
          version: "1",
          parse: () => null,
          validate: (payload) => payload === null,
          bind: ({ state }) => ({
            execute: () => {
              const value = state.get(fixtureState);
              value.count++;
              value.history.values.push(value.count);
            },
          }),
        },
        tooling: [
          {
            keyword: "fixturebyte",
            summary: "Record a fixture directive invocation.",
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
    coreDirectiveGroups: context.options.coreDirectiveGroups,
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
      const coreDirectiveGroups =
        typeof configured === "object" && configured !== null && "coreDirectiveGroups" in configured
          ? readCoreDirectiveGroups(configured.coreDirectiveGroups)
          : undefined;
      return { byte, coreDirectiveGroups };
    },
    activate: (context) => registerFixtureContributions(context),
    ...overrides,
  });
