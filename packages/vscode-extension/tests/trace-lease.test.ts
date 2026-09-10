import { test } from "../../../tests/ava-helper.js";
import { acquireTraceLease } from "../src/trace-lease.js";

test("trace lease rejects overlapping setup and releases idempotently", (t) => {
  const release = acquireTraceLease();
  t.throws(() => acquireTraceLease(), { message: /already active/ });
  release();
  const second = acquireTraceLease();
  release();
  t.throws(() => acquireTraceLease());
  second();
  t.notThrows(() => acquireTraceLease()());
});
