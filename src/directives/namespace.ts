import type { DirectiveRegistry } from "./registry.js";

export const registerNamespaceDirectives = (registry: DirectiveRegistry): void => {
  registry.register("namespace", ({ session }, words) => {
    if (session.inSpcblock) {
      throw new Error("NAMESPACE is unavailable inside spcblock.");
    }

    session.handleNamespace(words.slice(1));
  });

  registry.register("undef", ({ session }, words) => {
    session.handleUndef(words.slice(1));
  });

  registry.register("pushns", ({ session }) => {
    if (session.inSpcblock) {
      throw new Error("PUSHNS is unavailable inside spcblock.");
    }

    session.handlePushNamespace();
  });

  registry.register("pullns", ({ session }) => {
    if (session.inSpcblock) {
      throw new Error("PULLNS is unavailable inside spcblock.");
    }

    session.handlePullNamespace();
  });
};
