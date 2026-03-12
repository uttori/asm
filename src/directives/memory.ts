import type { DirectiveRegistry } from "./registry.js";

export const registerMemoryDirectives = (registry: DirectiveRegistry): void => {
  registry.register(["freecode", "freespace", "freedata"], ({ session }, words) => {
    if (session.inSpcblock) {
      throw new Error(`${words[0]} is unavailable inside spcblock.`);
    }

    session.handleFreespace(words[0], words.slice(1));
  });

  registry.register("freespacebyte", ({ session }, words) => {
    session.handleFreespaceByte(words.slice(1));
  });

  registry.register("prot", ({ session }, words) => {
    session.handleProt(words.slice(1));
  });
};
