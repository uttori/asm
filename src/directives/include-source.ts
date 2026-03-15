import type { DirectiveRegistry } from "./registry.js";

export const registerIncludeSourceDirectives = (registry: DirectiveRegistry): void => {
  registry.register("incsrc", ({ session }, words, _raw, command) => {
    const target = command?.parsed.includeTarget?.target ?? words[1];
    if (!target) {
      throw new Error("incsrc requires exactly one filename parameter");
    }

    session.assemblefile(target, false);
  });

  registry.register("include", ({ session }, words, _raw, command) => {
    const target = command?.parsed.includeTarget?.target ?? words[1];
    if (!target) {
      throw new Error("include requires exactly one filename parameter");
    }
    session.handleInclude("include", target, false);
  });

  registry.register("includeonce", ({ session }) => {
    const fileInfo = session.includedFiles.get(session.currentFile) || { included: true, guarded: false };
    fileInfo.guarded = true;
    session.includedFiles.set(session.currentFile, fileInfo);
  });
};
