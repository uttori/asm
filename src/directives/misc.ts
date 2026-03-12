import type { DirectiveRegistry } from "./registry.js";

export const registerMiscDirectives = (registry: DirectiveRegistry): void => {
  registry.register("pulltable", ({ session }) => {
    session.handlePullTable();
  });

  registry.register("pushtable", ({ session }) => {
    session.handlePushTable();
  });

  registry.register(["dpbase", "warnings", "print", "autoclean", "autoclear", "table", "includefrom", "asar", "{", "}"], () => {
    // Compatibility no-ops kept to preserve current fixture behavior.
  });
};
