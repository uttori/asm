import { test } from "./ava-helper.js";

import { PluginError } from "../packages/core/src/plugin/diagnostics.js";
import type { OwnedContribution } from "../packages/core/src/plugin/environment.js";
import { PluginSessionStateStore } from "../packages/core/src/plugin/session-state.js";
import type {
  SessionCreationContext,
  SessionStateContribution,
  SessionStateKey,
} from "../packages/core/src/plugin/contracts.js";

type Slot = { n: number; note?: string };

const context: SessionCreationContext = { targetId: "tgt.main", targetOptions: { k: 1 } };
const slotKey = { id: "slot.a" } as SessionStateKey<Slot>;
const otherKey = { id: "slot.missing" } as SessionStateKey<Slot>;

const owned = (
  contributionId: string,
  value: SessionStateContribution<Slot>,
  registrationOrder = 0,
): OwnedContribution<SessionStateContribution<unknown>> => ({
  pluginId: "fixture.plugin",
  contributionId,
  registrationOrder,
  value: value,
});

const counter = (
  contributionId: string,
  hooks: Partial<SessionStateContribution<Slot>> = {},
  registrationOrder = 0,
): OwnedContribution<SessionStateContribution<unknown>> =>
  owned(
    contributionId,
    {
      id: contributionId,
      create: () => ({ n: 1 }),
      clone: (value) => ({ ...value }),
      ...hooks,
    },
    registrationOrder,
  );

const errorCode = (error: unknown): string | undefined =>
  error instanceof PluginError ? error.code : undefined;

test("PluginSessionStateStore creates, gets, clones, restores, and resets slots", (t) => {
  const stages: string[] = [];
  const store = new PluginSessionStateStore(
    [
      counter("slot.a", {
        create: (creation) => ({ n: 1, note: creation.targetId }),
        resetForStage: (value, stage) => {
          value.n = 0;
          stages.push(stage);
        },
      }),
      owned("slot.plain", {
        id: "slot.plain",
        create: () => ({ n: 7 }),
        clone: (value) => ({ ...value }),
      }),
    ],
    context,
  );

  t.is(store.get(slotKey).n, 1);
  t.is(store.get(slotKey).note, "tgt.main");

  store.get(slotKey).n = 4;
  const snapshot = store.cloneSnapshot();
  const liveBeforeRestore = store.get(slotKey);
  liveBeforeRestore.n = 9;
  t.false(liveBeforeRestore === snapshot.get("slot.a"));
  store.restore(snapshot);
  t.is(store.get(slotKey).n, 4);

  store.resetForStage("emitProgram");
  t.is(store.get(slotKey).n, 0);
  t.deepEqual(stages, ["emitProgram"]);
  t.is(store.get({ id: "slot.plain" } as SessionStateKey<Slot>).n, 7);

  store.dispose();
  store.dispose();
});

test("PluginSessionStateStore wraps factory, lookup, clone, reset, and dispose failures", (t) => {
  const createError = t.throws(
    () =>
      new PluginSessionStateStore(
        [
          counter("slot.a", {
            create: () => {
              throw new Error("boom-create");
            },
          }),
        ],
        context,
      ),
  );
  t.is(errorCode(createError), "PLUGIN_ACTIVATION_FAILED");
  t.is((createError as PluginError).pluginId, "fixture.plugin");
  t.is((createError as PluginError).targetId, "tgt.main");

  const store = new PluginSessionStateStore([counter("slot.a")], context);
  t.is(errorCode(t.throws(() => store.get(otherKey))), "PLUGIN_CONFIGURATION_INVALID");

  t.is(
    errorCode(t.throws(() => store.cloneSnapshot(new Map()))),
    "PLUGIN_CONFIGURATION_INVALID",
  );

  const cloneFail = new PluginSessionStateStore(
    [
      counter("slot.a", {
        clone: () => {
          throw new Error("boom-clone");
        },
      }),
    ],
    context,
  );
  t.is(errorCode(t.throws(() => cloneFail.cloneSnapshot())), "PLUGIN_HOOK_FAILED");

  const resetFail = new PluginSessionStateStore(
    [
      counter("slot.a", {
        resetForStage: () => {
          throw new Error("boom-reset");
        },
      }),
    ],
    context,
  );
  t.is(errorCode(t.throws(() => resetFail.resetForStage("resolveLayout"))), "PLUGIN_HOOK_FAILED");

  const order: string[] = [];
  const disposeFail = new PluginSessionStateStore(
    [
      counter("slot.a", {
        dispose: () => {
          order.push("a");
          throw new Error("a-fail");
        },
      }),
      counter(
        "slot.b",
        {
          id: "slot.b",
          create: () => ({ n: 2 }),
          clone: (value) => ({ ...value }),
          dispose: () => {
            order.push("b");
            throw new Error("b-fail");
          },
        },
        1,
      ),
    ],
    context,
  );
  const aggregated = t.throws(() => disposeFail.dispose()) as AggregateError;
  t.true(aggregated instanceof AggregateError);
  t.deepEqual(order, ["b", "a"]);
  t.is(aggregated.errors.length, 2);
});
