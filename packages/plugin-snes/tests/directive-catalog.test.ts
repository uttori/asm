import { test } from "../../../tests/ava-helper.js";

import { findDirective } from "../src/tooling/directive-catalog.js";

test("findDirective looks up descriptors case-insensitively", (t) => {
  const org = findDirective("ORG");
  t.is(org?.keyword, "org");
  t.is(findDirective("org"), org);
  t.is(findDirective("startpos")?.keyword, "startpos");
  t.is(findDirective("not-a-directive"), undefined);
});
