import { test } from "../ava-helper.js";
import {
  handleNamespace,
  handlePullNamespace,
  handlePushNamespace,
  registerNamespaceDirectives,
} from "../../packages/core/src/directives/namespace.js";
import { DirectiveRegistry } from "../../packages/core/src/directives/registry.js";

const createContext = () => ({
  session: {
    namespaceStack: [] as string[],
    namespaceNestingPath: [] as string[],
    namespaceNestingEnabled: false,
    currentNamespace: "",
    inTargetBlock: false,
  },
});

test("namespace handlers preserve nested state without an assembler", (t) => {
  const ctx = createContext();
  handleNamespace(ctx, ["namespace", "nested", "on"]);
  handleNamespace(ctx, ["namespace", "Parent"]);
  handlePushNamespace(ctx);
  handleNamespace(ctx, ["namespace", "Child"]);
  handlePullNamespace(ctx);

  t.is(ctx.session.currentNamespace, "Parent");
  t.deepEqual(ctx.session.namespaceNestingPath, ["Parent"]);
});

test("namespace remains target-neutral and sanitizes saved paths", (t) => {
  const ctx = createContext();
  ctx.session.inTargetBlock = true;
  handleNamespace(ctx, ["namespace", "Name"]);
  t.is(ctx.session.currentNamespace, "Name");

  ctx.session.inTargetBlock = false;
  ctx.session.namespaceNestingEnabled = true;
  ctx.session.namespaceStack.push("Root", '{"invalid":true}');
  handlePullNamespace(ctx);
  t.deepEqual(ctx.session.namespaceNestingPath, []);
});

test("namespace push and pull preserve flat state and reject underflow", (t) => {
  const ctx = createContext();
  ctx.session.currentNamespace = "Root";

  handlePushNamespace(ctx);
  handleNamespace(ctx, ["namespace", "Child"]);
  handlePullNamespace(ctx);

  t.is(ctx.session.currentNamespace, "Root");
  t.deepEqual(ctx.session.namespaceStack, []);
  t.is(t.throws(() => handlePullNamespace(ctx)).message, "pullns without pushns");
});

test("namespace nested mode can be disabled and reset", (t) => {
  const ctx = createContext();
  handleNamespace(ctx, ["namespace", "nested", "on"]);
  handleNamespace(ctx, ["namespace", "Root"]);
  handleNamespace(ctx, ["namespace", "Child"]);

  handleNamespace(ctx, ["namespace", "nested", "off"]);
  t.false(ctx.session.namespaceNestingEnabled);
  t.deepEqual(ctx.session.namespaceNestingPath, []);
  t.is(ctx.session.currentNamespace, "");

  handleNamespace(ctx, ["namespace", "Flat"]);
  handleNamespace(ctx, ["namespace"]);
  t.is(ctx.session.currentNamespace, "");
});

test("namespace off unwinds nested names and clears flat names", (t) => {
  const nested = createContext();
  handleNamespace(nested, ["namespace", "nested", "on"]);
  handleNamespace(nested, ["namespace", "Root"]);
  handleNamespace(nested, ["namespace", "Child"]);
  handleNamespace(nested, ["namespace", "off"]);
  t.deepEqual(nested.session.namespaceNestingPath, ["Root"]);
  t.is(nested.session.currentNamespace, "Root");

  const flat = createContext();
  handleNamespace(flat, ["namespace", "Root"]);
  handleNamespace(flat, ["namespace", "off"]);
  t.is(flat.session.currentNamespace, "");
});

test("namespace two-argument forms enable or disable names", (t) => {
  const flat = createContext();
  handleNamespace(flat, ["namespace", "Root", "on"]);
  t.is(flat.session.currentNamespace, "Root");
  handleNamespace(flat, ["namespace", "Root", "off"]);
  t.is(flat.session.currentNamespace, "");

  const nested = createContext();
  handleNamespace(nested, ["namespace", "nested", "on"]);
  handleNamespace(nested, ["namespace", "Root", "on"]);
  handleNamespace(nested, ["namespace", "Child", "on"]);
  handleNamespace(nested, ["namespace", "Child", "off"]);
  t.deepEqual(nested.session.namespaceNestingPath, ["Root"]);
  t.is(nested.session.currentNamespace, "Root");
});

test("namespace reset clears nested path", (t) => {
  const ctx = createContext();
  ctx.session.namespaceNestingEnabled = true;
  ctx.session.namespaceNestingPath = ["Root"];
  ctx.session.currentNamespace = "Root";

  handleNamespace(ctx, ["namespace"]);

  t.deepEqual(ctx.session.namespaceNestingPath, []);
  t.is(ctx.session.currentNamespace, "");
});

test("namespace directive registration exposes all handlers", (t) => {
  const registry = new DirectiveRegistry();
  registerNamespaceDirectives(registry, createContext());

  t.true(registry.has("namespace"));
  t.true(registry.has("pushns"));
  t.true(registry.has("pullns"));
});
