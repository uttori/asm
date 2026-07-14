import { test } from "../ava-helper.js";
import {
  handleNamespace,
  handlePullNamespace,
  handlePushNamespace,
} from "../../src/directives/namespace.js";
import { createOperandResolver, runtimeStub } from "./test-stubs.js";

const createContext = () => ({
  session: {
    namespaceStack: [] as string[],
    namespaceNestingPath: [] as string[],
    namespaceNestingEnabled: false,
    currentNamespace: "",
    inSpcblock: false,
  },
  operandResolver: createOperandResolver(),
  runtime: runtimeStub,
});

test("namespace handlers preserve nested state without an assembler", t => {
  const ctx = createContext();
  handleNamespace(ctx, ["namespace", "nested", "on"]);
  handleNamespace(ctx, ["namespace", "Parent"]);
  handlePushNamespace(ctx);
  handleNamespace(ctx, ["namespace", "Child"]);
  handlePullNamespace(ctx);

  t.is(ctx.session.currentNamespace, "Parent");
  t.deepEqual(ctx.session.namespaceNestingPath, ["Parent"]);
});

test("namespace rejects SPC block usage and sanitizes saved paths", t => {
  const ctx = createContext();
  ctx.session.inSpcblock = true;
  t.throws(() => handleNamespace(ctx, ["namespace", "Name"]));

  ctx.session.inSpcblock = false;
  ctx.session.namespaceNestingEnabled = true;
  ctx.session.namespaceStack.push("Root", "{\"invalid\":true}");
  handlePullNamespace(ctx);
  t.deepEqual(ctx.session.namespaceNestingPath, []);
});
