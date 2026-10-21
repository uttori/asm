import { checkRuntimeBundle, runtimeBundles } from "./runtime-bundles.mjs";

for (const bundle of runtimeBundles) {
  checkRuntimeBundle(bundle);
}
console.log(
  `Verified ${runtimeBundles.length} runtime bundles, source inputs, and notices (Node 26 / editor Node 24).`,
);
