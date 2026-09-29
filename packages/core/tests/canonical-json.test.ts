import {
  canonicalEquals,
  canonicalJson,
  canonicalJsonCompact,
  canonicalValue,
} from "@uttori/asm-core/canonical-json";

import { test } from "../../../tests/ava-helper.js";

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
  t.is(
    canonicalJsonCompact(input),
    '{"2":"two","10":"ten","__proto__":{"polluted":true},"a":4,"ä":3,"array":[{"a":null,"z":false},null,"escaped\\n🎮"],"z":1}',
  );
  t.true(canonicalEquals({ z: 1, a: 2 }, { a: 2, z: 1, omitted: undefined }));
  t.false(canonicalEquals({ a: 1 }, { a: 2 }));
  t.false(canonicalEquals(undefined, null));
});
