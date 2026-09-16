import test from "ava";

import { canonicalJson, canonicalValue } from "../src/canonical-json.js";

test("canonical JSON preserves locale ordering, undefined omission and own __proto__ data", (t) => {
  const input = JSON.parse(
    '{"z":1,"__proto__":{"polluted":true},"10":"ten","2":"two","ä":3,"a":4}',
  );
  input.omitted = undefined;
  input.array = [{ z: false, a: null }, undefined, "escaped\n🎮"];
  // This independent expected text protects the pre-optimization serialized identity contract.
  t.is(
    canonicalJson(input),
    '{\n  "2": "two",\n  "10": "ten",\n  "__proto__": {\n    "polluted": true\n  },\n  "a": 4,\n  "ä": 3,\n  "array": [\n    {\n      "a": null,\n      "z": false\n    },\n    null,\n    "escaped\\n🎮"\n  ],\n  "z": 1\n}\n',
  );
  const normalized = canonicalValue(input) as Record<string, unknown>;
  t.true(Object.hasOwn(normalized, "__proto__"));
  t.is(Object.getPrototypeOf(normalized), Object.prototype);
  t.false(Object.hasOwn(normalized, "omitted"));
});
