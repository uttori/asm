/**
 * AVA default export is mis-typed as the module namespace under TS 5.6+ with NodeNext/tsimp.
 * This helper imports the callable test and types it as TestFn.
 * @see https://github.com/avajs/ava/issues/3349
 */
import type { TestFn } from "ava";
declare const test: TestFn;
export { test };
export type { TestFn };
//# sourceMappingURL=ava-helper.d.ts.map