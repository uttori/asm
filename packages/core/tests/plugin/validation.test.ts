import { test } from "../../../../tests/ava-helper.js";
import { createFixturePlugin } from "../../../../tests/plugin/fixture-plugin.js";
import {
  PluginManager,
  PluginError,
  PLUGIN_API_VERSION,
  type AssemblerPlugin,
  type PluginActivationContext,
} from "../../src/plugin/index.js";

const manifest = {
  id: "fixture.validation",
  name: "Validation fixture",
  version: "1.0.0",
  apiVersion: PLUGIN_API_VERSION,
};
const idle = () => {};
const definition = { manifest, activate: idle };

/** Malformed module exports enter through the same unknown-valued boundary as dynamic plugin loading. */
test("plugin module admission rejects invalid manifests and dependency declarations", async (t) => {
  const malformed = [
    null,
    {},
    { ...definition, activate: 1 },
    { ...definition, manifest: null },
    { ...definition, validateOptions: 1 },
    ...["", "1start", "bad_id", "double..dot", "trailing-"].map((id) =>
      Object.assign({}, definition, { manifest: Object.assign({}, manifest, { id }) }),
    ),
    ...[
      { name: " " },
      { version: "invalid" },
      { description: 1 },
      { requires: {} },
      { requires: [null] },
      { requires: [{ pluginId: "bad id", version: "*" }] },
      { requires: [{ pluginId: "other", version: "bad version" }] },
    ].map((change) =>
      Object.assign({}, definition, { manifest: Object.assign({}, manifest, change) }),
    ),
  ];
  for (const value of malformed) {
    const manager = new PluginManager();
    await t.throwsAsync(
      manager.activateModules([{ pluginModule: "invalid", module: { default: value } }]),
      { instanceOf: PluginError },
    );
    t.deepEqual(manager.activatedPlugins, []);
    await manager.dispose();
  }
});

/** Corrupt one registered contribution from a complete fixture, preserving all unrelated contracts. */
function corrupt(
  method: keyof PluginActivationContext,
  change: Record<string, unknown>,
): AssemblerPlugin {
  const fixture = createFixturePlugin();
  return createFixturePlugin({
    activate(context, options) {
      const observed = new Proxy(
        { ...context },
        {
          get(target, key, receiver) {
            const value: unknown = Reflect.get(target, key, receiver);
            if (key !== method || typeof value !== "function") {
              return value;
            }
            return (contribution: object) =>
              Reflect.apply(value, target, [Object.assign({ ...contribution }, change)]);
          },
        },
      );
      return fixture.activate(observed, options);
    },
  });
}

// Registration tests never invoke an encoder. Throwing protects against accidentally treating
// these deliberately incomplete fixtures as a supported assembler or asset conversion session.
function registrationOnly(): never {
  throw new Error("Registration fixture cannot execute.");
}

test("malformed contributions roll back registrations and preserve actionable configuration errors", async (t) => {
  const cases: readonly [keyof PluginActivationContext, readonly Record<string, unknown>[]][] = [
    [
      "registerArchitecture",
      [
        { aliases: 1 },
        { aliases: [1] },
        { displayName: 1 },
        { createEncoder: 1 },
        { createEncoder: () => ({ estimateSize: () => 0, encode: () => true }) },
        { createTypedEncoder: 1 },
        { operandGrammar: undefined },
        { operandGrammar: { version: "1" } },
        { operandGrammar: { version: "", parse: registrationOnly } },
        { createDecoder: 1 },
        { classifyOperand: 1 },
        { splitOperands: 1 },
        { referenceExpressions: 1 },
        { instructions: {} },
      ],
    ],
    ["registerAddressSpace", [{ create: 1 }]],
    ["registerOutputFormat", [{ create: 1 }]],
    ["registerSessionState", [{ create: 1 }, { clone: 1 }]],
    ["registerLifecycle", [{ create: 1 }]],
    [
      "registerDirectiveSet",
      [
        { directives: {} },
        { tooling: {} },
        ...[
          { syntax: undefined },
          { syntax: { version: "1", parse: registrationOnly, validate: registrationOnly } },
          { phase: "preprocess" },
        ].map((change) => ({
          directives: [
            {
              id: "fixture.directive",
              keywords: ["x"],
              phase: "lowered",
              tooling: [],
              syntax: {
                version: "1",
                parse: () => null,
                validate: (payload: unknown) => payload === null,
                bind: () => ({ execute: () => undefined }),
              },
              ...change,
            },
          ],
        })),
        {
          directives: [
            {
              id: "fixture.directives",
              keywords: ["x"],
              createHandler: registrationOnly,
              tooling: [],
            },
          ],
        },
        ...[[], [""], [1]].map((keywords) => ({
          directives: [
            { id: "fixture.directive", keywords, createHandler: registrationOnly, tooling: [] },
          ],
        })),
      ],
    ],
    [
      "registerExpressionSet",
      [
        { functions: {} },
        { functions: [{ name: "", evaluate: registrationOnly, summary: "test", signature: {} }] },
      ],
    ],
    [
      "registerTarget",
      [
        { coreDirectiveGroups: ["invalid"] },
        { coreDirectiveGroups: [1] },
        { createSyntaxProfile: 1 },
        { syntaxProfile: {} },
        { defaultOutputExtension: 1 },
      ],
    ],
  ];
  for (const [method, changes] of cases) {
    for (const change of changes) {
      const manager = new PluginManager();
      const error = await t.throwsAsync(
        manager.activatePlugins([{ plugin: corrupt(method, change) }]),
        { instanceOf: PluginError },
      );
      t.regex(error.message, /malformed|aliases|Duplicate directive/);
      t.deepEqual(manager.activatedPlugins, []);
      await manager.dispose();
    }
  }
});

test("asset contracts reject invalid schemas and optional functions before conversion", async (t) => {
  const format = { id: "fixture.format", version: "1.0.0", convert: registrationOnly };
  const transform = {
    id: "fixture.transform",
    version: "1.0.0",
    encode: registrationOnly,
    decode: registrationOnly,
  };
  const formatChanges: readonly Record<string, unknown>[] = [
    { version: "bad" },
    { convert: 1 },
    { optionSchema: [] },
    { optionSchema: { field: null } },
    { optionSchema: { field: { summary: 1 } } },
    { optionSchema: { field: { summary: "ok", valueSyntax: 1 } } },
    { resourcePaths: 1 },
    { targets: 1 },
    { targets: [1] },
  ];
  const transformChanges: readonly Record<string, unknown>[] = [
    { version: "bad" },
    { encode: 1 },
    { decode: 1 },
    { validateOptions: 1 },
    { resourcePaths: 1 },
    { targets: 1 },
    { targets: [1] },
    { optionSchema: [] },
    ...[
      null,
      { type: "other" },
      { type: "enum" },
      { type: "integer", required: "yes" },
      { type: "string", resource: false },
      { type: "integer", resource: true },
      { type: "integer", minimum: "0" },
      { type: "integer", maximum: Infinity },
      { type: "string", enum: "bad" },
    ].map((field) => ({ optionSchema: { field } })),
  ];
  for (const [kind, changes] of [
    ["format", formatChanges],
    ["transform", transformChanges],
  ] as const) {
    for (const change of changes) {
      const manager = new PluginManager();
      await t.throwsAsync(
        manager.activatePlugins([
          {
            plugin: {
              manifest,
              activate(context) {
                if (kind === "format") {
                  context.registerAssetFormat(Object.assign({ ...format }, change));
                } else {
                  context.registerAssetTransform(Object.assign({ ...transform }, change));
                }
              },
            },
          },
        ]),
        { instanceOf: PluginError, message: /malformed/ },
      );
      t.deepEqual(manager.activatedPlugins, []);
      await manager.dispose();
    }
  }
});

test("manager lifecycle freezes recursive option graphs and completes every cleanup after failure", async (t) => {
  const options: { values: unknown[]; callback: () => void; self?: unknown } = {
    values: [null, 1, "text"],
    callback: idle,
  };
  options.self = options;
  Object.assign(options.callback, { metadata: { enabled: true } });
  const cleanup: string[] = [];
  const manager = new PluginManager();
  await manager.activatePlugins([
    {
      plugin: {
        manifest,
        validateOptions: () => options,
        activate(context, configured) {
          t.true(Object.isFrozen(configured));
          t.true(Object.isFrozen(options.values));
          t.true(Object.isFrozen(options.callback));
          context.logger.debug("ready");
          context.logger.info("ready");
          context.logger.warn("ready");
          context.logger.error("ready");
          return {
            dispose() {
              cleanup.push("first");
            },
          };
        },
      },
    },
    {
      plugin: {
        manifest: {
          ...manifest,
          id: "fixture.second",
          description: "second",
          requires: [{ pluginId: manifest.id, version: "^1.0.0" }],
        },
        activate() {
          return {
            dispose() {
              cleanup.push("second");
              throw new Error("Cleanup failed");
            },
          };
        },
      },
    },
  ]);
  t.is(manager.freeze(), manager.freeze());
  await t.throwsAsync(manager.activatePlugins([]), { message: /frozen/ });
  await t.throwsAsync(manager.dispose(), { instanceOf: AggregateError });
  t.deepEqual(cleanup, ["second", "first"]);
  await t.notThrowsAsync(manager.dispose());
  t.throws(() => manager.freeze(), { message: /disposed/ });
  await t.throwsAsync(manager.activatePlugins([]), { message: /disposed/ });
});
