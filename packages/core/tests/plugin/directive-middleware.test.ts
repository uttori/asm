import { test } from "../../../../tests/ava-helper.js";
import {
  createFixturePlugin,
  registerFixtureContributions,
} from "../../../../tests/plugin/fixture-plugin.js";
import { Assembler } from "../../src/assembler.js";
import type {
  LifecycleContribution,
  DirectiveMiddlewareContext,
} from "../../src/plugin/contracts.js";
import { PluginManager, PluginError } from "../../src/plugin/index.js";

/** Use a real frozen environment so selection, borrowed capabilities and detached syntax are exercised together. */
async function environment(lifecycles: LifecycleContribution[]) {
  const manager = new PluginManager();
  await manager.activatePlugins([
    {
      plugin: createFixturePlugin({
        activate(context) {
          registerFixtureContributions(context);
          for (const lifecycle of lifecycles) {
            context.registerLifecycle(lifecycle);
          }
          context.registerTarget({
            id: "fixture.middleware",
            displayName: "Middleware fixture",
            defaultArchitecture: "fixture.one-byte",
            architectures: ["fixture.one-byte"],
            addressSpace: "fixture.flat",
            outputFormat: "fixture.raw",
            directiveSets: ["fixture.directives"],
            expressionSets: [],
            lifecycle: lifecycles.map((lifecycle) => lifecycle.id),
            defaultOutputExtension: ".bin",
          });
        },
      }),
    },
  ]);
  return { manager, value: manager.freeze() };
}

test("directive filters preserve registration order, detached snapshots and handled short-circuiting", async (t) => {
  const calls: string[] = [];
  const observe = (name: string) => (context: DirectiveMiddlewareContext) => {
    calls.push(`${name}:${context.keyword}`);
    t.not(context.source.raw, "changed");
    // Each hook must own its own snapshot, even when earlier hooks mutate their input.
    context.source.raw = "changed";
    return "continue" as const;
  };
  const { manager, value } = await environment([
    { id: "fixture.unrestricted", create: () => ({ beforeDirective: observe("all") }) },
    {
      id: "fixture.filtered",
      beforeDirectiveKeywords: ["db"],
      create: () => ({ beforeDirective: observe("filtered") }),
    },
    {
      id: "fixture.empty",
      beforeDirectiveKeywords: [],
      create: () => ({
        beforeDirective() {
          t.fail("empty filter ran");
          return "continue";
        },
      }),
    },
    {
      id: "fixture.stop",
      beforeDirectiveKeywords: ["db"],
      create: () => ({
        beforeDirective(context) {
          calls.push(`stop:${context.keyword}`);
          context.session.write1(9);
          return "handled";
        },
      }),
    },
    { id: "fixture.after", create: () => ({ beforeDirective: observe("after") }) },
  ]);
  t.teardown(() => manager.dispose());
  const assembler = new Assembler({ environment: value, target: "fixture.middleware" });
  t.teardown(() => assembler.dispose());
  assembler.assembleSource("org 0\ndb 1\nfixturebyte", "middleware.asm");
  t.deepEqual([...assembler.getBinaryOutput()], [9]);
  t.deepEqual(
    calls,
    Array.from({ length: 3 }, () => [
      "all:org",
      "after:org",
      "all:db",
      "filtered:db",
      "stop:db",
      "all:fixturebyte",
      "after:fixturebyte",
    ]).flat(),
  );
});

test("filtered directive failures retain plugin attribution and expire borrowed capabilities", async (t) => {
  let retained: DirectiveMiddlewareContext["session"] | undefined;
  const { manager, value } = await environment([
    {
      id: "fixture.failure",
      beforeDirectiveKeywords: ["db"],
      create: () => ({
        beforeDirective(context) {
          retained = context.session;
          throw new Error("failure");
        },
      }),
    },
  ]);
  t.teardown(() => manager.dispose());
  const assembler = new Assembler({ environment: value, target: "fixture.middleware" });
  t.teardown(() => assembler.dispose());
  const error = t.throws(() => assembler.assembleSource("db 1"), { instanceOf: PluginError });
  t.is(error.contributionId, "fixture.failure");
  t.is(error.code, "PLUGIN_HOOK_FAILED");
  t.throws(() => retained?.write1(2), { message: /only valid during a synchronous callback/ });
});

test("lifecycle keyword declarations reject malformed or noncanonical input", async (t) => {
  for (const keywords of [["DB"], [" db"], [""]]) {
    await t.throwsAsync(
      environment([
        { id: "fixture.invalid", beforeDirectiveKeywords: keywords, create: () => ({}) },
      ]),
      { instanceOf: PluginError },
    );
  }
});

test("interested middleware sees detached ordinary operands for compact literal rows", async (t) => {
  let observations = 0;
  const { manager, value } = await environment([
    {
      id: "fixture.literal-observer",
      beforeDirectiveKeywords: ["db"],
      create: () => ({
        beforeDirective(context) {
          if (context.syntax?.kind !== "numericData") {
            t.fail();
            return "continue";
          }
          observations++;
          t.is(context.syntax.statement.literalData, undefined);
          t.is(context.syntax.statement.operands.length, 8);
          const expression = context.syntax.statement.operands[0].expression;
          if (expression.type === "literal") {
            expression.value = "99";
          }
          return "continue";
        },
      }),
    },
  ]);
  t.teardown(() => manager.dispose());
  const assembler = new Assembler({ environment: value, target: "fixture.middleware" });
  t.teardown(() => assembler.dispose());
  assembler.assembleSource("org 0\ndb 1,2,3,4,5,6,7,8");
  t.is(observations, 3);
  t.deepEqual([...assembler.getBinaryOutput()], [1, 2, 3, 4, 5, 6, 7, 8]);
});
