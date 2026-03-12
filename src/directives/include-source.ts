import type { DirectiveRegistry } from "./registry.js";

export const registerIncludeSourceDirectives = (registry: DirectiveRegistry): void => {
  registry.register("incsrc", ({ session }, words) => {
    if (words.length !== 2) {
      throw new Error("incsrc requires exactly one filename parameter");
    }

    session.assemblefile(words[1], false);
  });

  registry.register("include", ({ session }, words) => {
    session.handleInclude("include", words[1], false);
  });

  registry.register("includeonce", ({ session }) => {
    const fileInfo = session.includedFiles.get(session.currentFile) || { included: true, guarded: false };
    fileInfo.guarded = true;
    session.includedFiles.set(session.currentFile, fileInfo);
  });
};
