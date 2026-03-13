import type { DirectiveRegistry } from "./registry.js";

type StructBinarySession = {
  handleStruct(words: string[]): void;
  handleEndStruct(words: string[]): void;
  handleIncbin(words: string[]): void;
};

export const registerStructBinaryDirectives = (registry: DirectiveRegistry): void => {
  registry.register("struct", ({ session }, words) => {
    (session as unknown as StructBinarySession).handleStruct(words);
  });

  registry.register("endstruct", ({ session }, words) => {
    (session as unknown as StructBinarySession).handleEndStruct(words);
  });

  registry.register("incbin", ({ session }, words) => {
    (session as unknown as StructBinarySession).handleIncbin(words);
  });
};
