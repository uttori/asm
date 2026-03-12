import type { DirectiveRegistry } from "./registry.js";

const getDirectiveWidth = (keyword: string, prefix: "fill" | "pad"): number => {
  if (keyword === `${prefix}byte`) return 1;
  if (keyword === `${prefix}word`) return 2;
  if (keyword === `${prefix}long`) return 3;
  if (keyword === "paddword" || keyword === "filldword") return 4;
  throw new Error(`Unrecognized ${prefix} directive.`);
};

export const registerFillPadDirectives = (registry: DirectiveRegistry): void => {
  registry.register(["fillbyte", "fillword", "filllong", "filldword"], ({ session, operandResolver }, words) => {
    const keyword = words[0];
    const len = getDirectiveWidth(keyword, "fill");

    if (words.length !== 2) {
      throw new Error(`${keyword.toUpperCase()} directive requires exactly one parameter.`);
    }

    const value = operandResolver.getnum(session.resolvedefines(words[1]));
    for (let i = 0; i < 12; i += len) {
      let current = value;
      for (let j = 0; j < len; j++) {
        session.fillbyte[i + j] = current & 0xFF;
        current >>>= 8;
      }
    }
  });

  registry.register("fill", ({ session, operandResolver }, words) => {
    if (words.length !== 2) {
      throw new Error("FILL directive requires exactly one parameter (number of bytes to fill).");
    }

    const count = operandResolver.getnum(session.resolvedefines(words[1]));
    for (let i = 0; i < count; i++) {
      session.write1(session.fillbyte[i % 12]);
    }
  });

  registry.register(["padbyte", "padword", "padlong", "paddword"], ({ session, operandResolver }, words) => {
    const keyword = words[0];
    const len = getDirectiveWidth(keyword, "pad");

    if (words.length !== 2) {
      throw new Error(`${keyword.toUpperCase()} directive requires exactly one parameter.`);
    }

    const value = operandResolver.getnum(session.resolvedefines(words[1]));
    session.padUnit = len;
    for (let i = 0; i < len; i++) {
      session.padbyte[i] = (value >> (8 * i)) & 0xFF;
    }
  });

  registry.register("pad", ({ session, operandResolver }, words) => {
    let gap: number;

    if (words.length === 1) {
      const currentBank = session.snespos & 0xFF0000;
      const bankOffset = session.snespos & 0xFFFF;
      const nextBank = bankOffset === 0xFFFF ? currentBank + 0x10000 : currentBank + 0x10000 - bankOffset;
      gap = nextBank;
    } else if (words.length === 2) {
      const targetSNES = operandResolver.getnum(words[1]);
      const targetPC = session.snestopc(targetSNES);
      if (targetPC < 0) {
        throw new Error(`Target SNES address ${targetSNES.toString(16)} does not map to ROM.`);
      }

      const currentPC = session.snestopc(session.snespos);
      if (targetPC <= currentPC) {
        return;
      }

      gap = targetPC - currentPC;
    } else {
      throw new Error("PAD directive accepts zero or one parameter.");
    }

    for (let i = 0; i < gap; i++) {
      session.write1(session.padbyte[i % session.padUnit]);
    }
  });
};
