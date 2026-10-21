import { test } from "../../../../tests/ava-helper.js";
import { clonePluginSyntax } from "../../src/plugin/syntax-snapshot.js";

test("syntax snapshots detach descendants and preserve absent optional values and array holes", (t) => {
  const input = {
    optional: undefined,
    values: [{ span: { start: 2, end: 4 } }],
    // eslint-disable-next-line unicorn/no-new-array -- This fixture needs absent slots, not owned undefined entries.
    sparse: new Array(2),
  };
  const copy = clonePluginSyntax(input);
  t.deepEqual(copy, input);
  t.true(Object.hasOwn(copy, "optional"));
  t.false(0 in copy.sparse);
  copy.values[0].span.start = 99;
  t.is(input.values[0].span.start, 2);
});

test("syntax snapshots preserve prototype-looking keys as ordinary owned data", (t) => {
  const input: unknown = JSON.parse(
    '{"__proto__":{"marker":true},"constructor":{"name":"syntax"}}',
  );
  const copy = clonePluginSyntax(input);
  t.deepEqual(copy, input);
  if (!copy || typeof copy !== "object") {
    t.fail("Expected a plain object snapshot");
    return;
  }
  t.is(Object.getPrototypeOf(copy), Object.prototype);
  t.true(Object.hasOwn(copy, "__proto__"));
  t.false(Object.hasOwn(Object.prototype, "marker"));
});
