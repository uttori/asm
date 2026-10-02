/**
 * AVA's callable test is its default export. Re-export it so NodeNext callers share one typed binding.
 * @see https://github.com/avajs/ava/issues/3349
 */
import test, { type TestFn } from "ava";

export { test };
export type { TestFn };
