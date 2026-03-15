import type { DirectiveRegistry } from "./registry.js";
import { ASAR_COMPAT_NO_OP_DIRECTIVES } from "../compatibility/asar-compatibility-profile.js";

export const registerMiscDirectives = (registry: DirectiveRegistry): void => {
  registry.register("pulltable", ({ session }) => {
    session.handlePullTable();
  });

  registry.register("pushtable", ({ session }) => {
    session.handlePushTable();
  });

  registry.register([...ASAR_COMPAT_NO_OP_DIRECTIVES], () => {
    // Compatibility no-ops kept to preserve current fixture behavior.
  });
};
