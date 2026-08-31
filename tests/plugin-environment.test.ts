import { test } from "./ava-helper.js";

import { PluginError } from "../packages/core/src/plugin/diagnostics.js";
import {
  AssemblerEnvironment,
  type EnvironmentContributions,
  type OwnedContribution,
} from "../packages/core/src/plugin/environment.js";
import type {
  AddressSpaceContribution,
  ArchitectureContribution,
  DirectiveSetContribution,
  ExpressionSetContribution,
  LifecycleContribution,
  OutputFormatContribution,
  TargetContribution,
} from "../packages/core/src/plugin/contracts.js";

const errorCode = (error: unknown): string | undefined =>
  error instanceof PluginError ? error.code : undefined;

const owned = <T>(
  contributionId: string,
  value: T,
  registrationOrder = 0,
  pluginId = "fixture.plugin",
): OwnedContribution<T> => ({
  pluginId,
  contributionId,
  registrationOrder,
  value,
});

const architecture = (
  id: string,
  extras: Partial<ArchitectureContribution> = {},
): ArchitectureContribution => ({
  id,
  displayName: id,
  unknownInstructionBehavior: "throw",
  splitOperands: () => [],
  classifyOperand: ({ operands }, operand) => operands.lowerOperand(operand),
  createEncoder: () => ({ estimateSize: () => 0, encode: () => true }),
  instructions: [{ mnemonic: "NOP", summary: "No operation.", modes: [{ mode: "implied", syntax: "", size: 1 }] }],
  ...extras,
});

const addressSpace: AddressSpaceContribution = {
  id: "mem.flat",
  create: () => ({
    addressWidth: 16,
    defaultOrigin: 0,
    normalizeForWrite: (address) => address,
    advance: (address, amount) => address + amount,
    toOutputOffset: (address) => address,
    fromOutputOffset: (offset) => offset,
  }),
};

const outputFormat: OutputFormatContribution = {
  id: "out.raw",
  create: () => ({ finalize: () => undefined, getOutput: () => new Uint8Array() }),
};

const directiveSet: DirectiveSetContribution = {
  id: "dir.set",
  tooling: [{ keyword: "setlevel", summary: "Set-level docs.", syntax: "setlevel", group: "data" }],
  directives: [
    {
      id: "dir.emit",
      keywords: ["emitx"],
      phase: "lowered",
      createHandler: () => () => undefined,
      tooling: [{ keyword: "emitx", summary: "Emit a fixture byte.", syntax: "emitx", group: "data" }],
    },
  ],
};

const expressionSet: ExpressionSetContribution = {
  id: "expr.set",
  functions: [
    {
      name: "forty",
      aliases: ["xl"],
      signature: { parameters: [] },
      summary: "Return 40.",
      evaluate: () => 40,
    },
    {
      name: "zero",
      signature: { parameters: [] },
      summary: "Return 0.",
      evaluate: () => 0,
    },
  ],
};

const lifecycle: LifecycleContribution = {
  id: "life.one",
  create: () => ({}),
};

const target = (overrides: Partial<TargetContribution> = {}): TargetContribution => ({
  id: "tgt.main",
  displayName: "Main",
  defaultArchitecture: "cpu.one",
  architectures: ["cpu.one"],
  addressSpace: "mem.flat",
  outputFormat: "out.raw",
  directiveSets: ["dir.set"],
  expressionSets: ["expr.set"],
  lifecycle: ["life.one"],
  defaultOutputExtension: ".bin",
  ...overrides,
});

const contributions = (
  targetOverrides: Partial<TargetContribution> = {},
  extras: Partial<EnvironmentContributions> = {},
): EnvironmentContributions => ({
  manifests: [],
  sessionStates: [],
  architectures: [
    owned("cpu.one", architecture("cpu.one")),
    owned("cpu.extra", architecture("cpu.extra", { aliases: ["extra-cpu"] })),
  ],
  addressSpaces: [owned("mem.flat", addressSpace)],
  outputFormats: [owned("out.raw", outputFormat)],
  directiveSets: [owned("dir.set", directiveSet)],
  expressionSets: [owned("expr.set", expressionSet)],
  lifecycles: [owned("life.one", lifecycle), owned("life.two", { id: "life.two", create: () => ({}) }, 1)],
  targets: [owned("tgt.main", target(targetOverrides))],
  ...extras,
});

const freeze = (
  targetOverrides: Partial<TargetContribution> = {},
  extras: Partial<EnvironmentContributions> = {},
): AssemblerEnvironment => new AssemblerEnvironment(contributions(targetOverrides, extras));

test("AssemblerEnvironment resolves contributions, owners, summaries, and tooling", (t) => {
  const environment = freeze(
    { aliases: ["main"], directiveSets: ["dir.set", "dir.bare"] },
    {
      directiveSets: [
        owned("dir.set", directiveSet),
        owned("dir.bare", {
          id: "dir.bare",
          directives: [
            {
              id: "dir.bare.emit",
              keywords: ["barex"],
              phase: "lowered",
              createHandler: () => () => undefined,
              tooling: [
                { keyword: "barex", summary: "Bare emit.", syntax: "barex", group: "data" },
              ],
            },
          ],
        }),
      ],
    },
  );
  const catalog = environment.getToolingCatalog("MAIN");

  t.is(environment.resolveTargetId("main"), "tgt.main");
  t.is(environment.getTarget("main")?.displayName, "Main");
  t.is(environment.resolveArchitectureId("tgt.main", "cpu.one"), "cpu.one");
  t.is(environment.getArchitecture("cpu.one")?.displayName, "cpu.one");
  t.is(environment.getAddressSpace("mem.flat")?.id, "mem.flat");
  t.is(environment.getOutputFormat("out.raw")?.id, "out.raw");
  t.is(environment.getDirectiveSet("dir.set")?.id, "dir.set");
  t.is(environment.getExpressionSet("expr.set")?.id, "expr.set");
  t.is(environment.getLifecycle("life.one")?.id, "life.one");
  t.is(environment.getContributionOwner("cpu.one"), "fixture.plugin");
  t.is(environment.getContributionOwner("mem.flat"), "fixture.plugin");
  t.is(environment.getContributionOwner("out.raw"), "fixture.plugin");
  t.is(environment.getContributionOwner("dir.set"), "fixture.plugin");
  t.is(environment.getContributionOwner("expr.set"), "fixture.plugin");
  t.is(environment.getContributionOwner("life.one"), "fixture.plugin");
  t.is(environment.getContributionOwner("tgt.main"), "fixture.plugin");
  t.is(environment.getContributionOwner("missing"), undefined);
  t.is(environment.getArchitecture("nope"), undefined);
  t.is(environment.getTarget("nope"), undefined);
  t.is(environment.resolveArchitectureId("nope", "cpu.one"), undefined);

  t.deepEqual(
    environment.getTargetSummaries().map((item) => item.id),
    ["tgt.main"],
  );
  t.deepEqual(catalog.getInstructions("cpu.one").map((item) => item.mnemonic), ["NOP"]);
  t.deepEqual(catalog.getInstructions("cpu.extra"), []);
  t.deepEqual(catalog.getInstructions("unknown"), []);
  t.true(catalog.getDirectives().some((item) => item.keyword === "emitx"));
  t.true(catalog.getDirectives().some((item) => item.keyword === "barex"));
  t.true(catalog.getDirectives().some((item) => item.keyword === "setlevel"));
  t.true(catalog.getDirectives().some((item) => item.keyword === "org"));
  t.deepEqual(catalog.getExpressionFunctions().map((item) => item.name), ["forty", "zero"]);
  t.deepEqual(catalog.getExpressionFunctions()[0].aliases, ["xl"]);
  t.deepEqual(catalog.getExpressionFunctions()[1].aliases, []);
  t.deepEqual(catalog.getArchitectures().map((item) => item.id), ["cpu.one"]);
  t.deepEqual(catalog.getTargets().map((item) => item.id), ["tgt.main"]);
  t.deepEqual(
    environment.getTargetLifecycles("tgt.main").map((item) => item.contributionId),
    ["life.one"],
  );

  const bare = freeze();
  t.deepEqual(bare.getTargetSummaries()[0].aliases, []);
  t.deepEqual(bare.getToolingCatalog("tgt.main").getTargets()[0].aliases, []);
  t.deepEqual(
    freeze(
      {},
      {
        architectures: [
          owned(
            "cpu.one",
            architecture("cpu.one", {
              instructions: undefined as unknown as ArchitectureContribution["instructions"],
            }),
          ),
        ],
      },
    )
      .getToolingCatalog("tgt.main")
      .getInstructions("cpu.one"),
    [],
  );
});

test("AssemblerEnvironment rejects incomplete or colliding target graphs", (t) => {
  const cases: Array<{ name: string; overrides: Partial<TargetContribution> }> = [
    { name: "address space", overrides: { addressSpace: "missing.space" } },
    { name: "output format", overrides: { outputFormat: "missing.format" } },
    { name: "extension prefix", overrides: { defaultOutputExtension: "bin" } },
    { name: "extension length", overrides: { defaultOutputExtension: "." } },
    { name: "architecture", overrides: { architectures: ["cpu.missing"] } },
    { name: "default architecture", overrides: { defaultArchitecture: "cpu.extra" } },
    { name: "directive set", overrides: { directiveSets: ["missing.directives"] } },
    { name: "expression set", overrides: { expressionSets: ["missing.expressions"] } },
    { name: "lifecycle", overrides: { lifecycle: ["missing.life"] } },
  ];
  for (const item of cases) {
    const error = t.throws(() => freeze(item.overrides));
    t.is(errorCode(error), "PLUGIN_TARGET_INVALID", item.name);
  }

  t.is(errorCode(t.throws(() => freeze().getTargetLifecycles("nope"))), "PLUGIN_TARGET_INVALID");
  t.is(errorCode(t.throws(() => freeze().getToolingCatalog("nope"))), "PLUGIN_TARGET_INVALID");
});

test("AssemblerEnvironment tooling catalog skips dangling target references", (t) => {
  const dangling = target();
  const environment = new AssemblerEnvironment({
    ...contributions(),
    targets: [owned("tgt.main", dangling)],
  });
  dangling.directiveSets = ["dir.set", "ghost.directives"];
  dangling.expressionSets = ["expr.set", "ghost.expressions"];
  dangling.architectures = ["cpu.one", "cpu.ghost"];
  dangling.lifecycle = ["life.one", "ghost.life"];

  const catalog = environment.getToolingCatalog("tgt.main");
  t.true(catalog.getDirectives().some((item) => item.keyword === "emitx"));
  t.deepEqual(catalog.getExpressionFunctions().map((item) => item.name), ["forty", "zero"]);
  t.deepEqual(catalog.getArchitectures().map((item) => item.id), ["cpu.one"]);
  t.deepEqual(
    environment.getTargetLifecycles("tgt.main").map((item) => item.contributionId),
    ["life.one"],
  );
});

test("AssemblerEnvironment reports duplicate architecture aliases with both owners", (t) => {
  const error = t.throws(() =>
    freeze(
      { architectures: ["cpu.one", "cpu.extra"] },
      {
        architectures: [
          owned("cpu.one", architecture("cpu.one", { aliases: ["shared"] }), 0, "plugin.a"),
          owned("cpu.extra", architecture("cpu.extra", { aliases: ["shared"] }), 1, "plugin.b"),
        ],
      },
    ),
  );
  t.is(errorCode(error), "PLUGIN_ALIAS_DUPLICATE");
  t.true((error).message.includes("plugin.a"));
  t.true((error).message.includes("plugin.b"));
});

test("AssemblerEnvironment rejects duplicate target aliases, directive keywords, and expression names", (t) => {
  const aliasError = t.throws(() =>
    new AssemblerEnvironment(
      contributions(
        { aliases: ["shared"] },
        {
          targets: [
            owned("tgt.main", target({ aliases: ["shared"] })),
            owned("tgt.other", target({ id: "tgt.other", aliases: ["shared"] }), 1, "plugin.other"),
          ],
        },
      ),
    ),
  );
  t.is(errorCode(aliasError), "PLUGIN_ALIAS_DUPLICATE");

  const extraDirectives: DirectiveSetContribution = {
    id: "dir.extra",
    directives: [
      {
        id: "dir.collision",
        keywords: ["emitx"],
        phase: "lowered",
        createHandler: () => () => undefined,
        tooling: [],
      },
    ],
  };
  t.is(
    errorCode(
      t.throws(() =>
        freeze(
          { directiveSets: ["dir.set", "dir.extra"] },
          { directiveSets: [owned("dir.set", directiveSet), owned("dir.extra", extraDirectives)] },
        ),
      ),
    ),
    "PLUGIN_TARGET_INVALID",
  );

  const extraExpressions: ExpressionSetContribution = {
    id: "expr.extra",
    functions: [
      {
        name: "forty",
        signature: { parameters: [] },
        summary: "Collision.",
        evaluate: () => 0,
      },
    ],
  };
  t.is(
    errorCode(
      t.throws(() =>
        freeze(
          { expressionSets: ["expr.set", "expr.extra"] },
          {
            expressionSets: [owned("expr.set", expressionSet), owned("expr.extra", extraExpressions)],
          },
        ),
      ),
    ),
    "PLUGIN_TARGET_INVALID",
  );
});
