import type { DirectiveRegistry } from "./registry.js";

export const registerFlowControlDirectives = (registry: DirectiveRegistry): void => {
  registry.register(["+", "-"], ({ session }, _words, raw) => {
    session.symbolScope.handleRelativeLabel(raw);
  });

  registry.register("if", ({ session }, words) => {
    session.handleIf(words.slice(1));
  });

  registry.register("elseif", ({ session }, words) => {
    session.handleElseIf(words.slice(1));
  });

  registry.register("else", ({ session }) => {
    session.handleElse();
  });

  registry.register("endif", ({ session }) => {
    session.handleEndIf();
  });

  registry.register("while", ({ session }, words) => {
    session.handleWhile(words.slice(1));
  });

  registry.register("endwhile", ({ session }) => {
    session.handleEndWhile();
  });

  registry.register("for", ({ session }, words) => {
    session.handleFor(words.slice(1));
  });

  registry.register("endfor", ({ session }) => {
    session.handleEndFor();
  });
};
