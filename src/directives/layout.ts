import type { DirectiveRegistry } from "./registry.js";
import { shouldRedirectOrgToSpcblock } from "../compatibility/asar-compatibility-profile.js";
import { DirectiveContext } from "./types.js";

const assertMapperAvailable = (inSpcblock: boolean): void => {
  if (inSpcblock) {
    throw new Error("Mapper directives are unavailable inside spcblock.");
  }
};

/**
 * Pushes the current target address onto the push base stack.
 * @param {DirectiveContext} ctx The directive context.
 * @param {AssemblySession} ctx.session The assembly session.
 */
const handlePushBase = ({ session }: DirectiveContext) => {
  // debug("handlePushBase")
  session.pushBaseStack.push(session.currentTargetAddress);
}

/**
 * Pulls the current target address from the push base stack.
 * @param {DirectiveContext} ctx The directive context.
 * @param {AssemblySession} ctx.session The assembly session.
 */
const handlePullBase = ({ session }: DirectiveContext) => {
  // debug("handlePullBase")
  if (session.pushBaseStack.length === 0) {
    throw new Error("No base value to pull.");
  }
  session.currentTargetAddress = session.pushBaseStack.pop();
}

/**
 * Handles the ARCH command.
 * @param {DirectiveContext} ctx The directive context.
 * @param {AssemblySession} ctx.session The assembly session.
 * @param {string[]} words - The words from the ARCH command.
 * @throws {Error} If the ARCH command requires an architecture parameter.
 */
export const handleArch = ({ session }: DirectiveContext, words: string[]): void => {
  // debug("handleArch", words)
  if (session.inSpcblock) {
    throw new Error("ARCH is unavailable inside spcblock.");
  }

  if (!words[1]) {
    throw new Error("ARCH command requires an architecture parameter.")
  }
  const archParam = words[1].toLowerCase();
  const canonical = session.architectureRegistry.getCanonicalName(archParam);
  if (!canonical) {
    throw new Error("Unsupported architecture: " + archParam);
  }
  session.arch = canonical;
  session.spcInlineCompatMode = archParam === "spc700-inline";
}

export const handleStartpos = ({ session }: DirectiveContext, words: string[]): void => {
  const params = words.slice(1);

  if (!session.inSpcblock || !session.spcblockData) {
    throw new Error("startpos used without an active spcblock.");
  }
  if (params.length !== 1) {
    throw new Error("startpos requires exactly one parameter.");
  }
  session.spcblockData.executeAddress = session.operandResolver.getnum(session.resolvedefines(params[0])) & 0xFFFF;
}

export const registerLayoutDirectives = (registry: DirectiveRegistry): void => {
  registry.register("base", ({ session, operandResolver }, words) => {
    if (words.length !== 2) {
      throw new Error("BASE directive requires exactly one parameter.");
    }

    const param = words[1].toLowerCase();
    if (param === "off") {
      const baseAddress = Number(session.currentTargetBaseAddress);
      const baseStartAddress = Number(session.currentTargetBaseStartAddress);
      session.currentTargetAddress = baseAddress;
      session.currentTargetStartAddress = baseStartAddress;
      return;
    }

    const value = operandResolver.getnum(param);
    if (value > 0xFFFFFF) {
      throw new Error(`Invalid base address: ${param}. Must be within 24 bits.`);
    }

    session.currentTargetAddress = value;
    session.currentTargetStartAddress = value;
  });

  registry.register("fastrom", () => {
    // Compatibility no-op kept for fixture parity.
  });

  registry.register("lorom", ({ session }) => {
    assertMapperAvailable(session.inSpcblock);
    session.mapper = "lorom";
  });

  registry.register("hirom", ({ session }) => {
    assertMapperAvailable(session.inSpcblock);
    session.mapper = "hirom";
  });

  registry.register("exlorom", ({ session }) => {
    assertMapperAvailable(session.inSpcblock);
    session.mapper = "exlorom";
  });

  registry.register("exhirom", ({ session }) => {
    assertMapperAvailable(session.inSpcblock);
    session.mapper = "exhirom";
  });

  registry.register("sfxrom", ({ session }) => {
    assertMapperAvailable(session.inSpcblock);
    session.mapper = "sfxrom";
  });

  registry.register("norom", ({ session }) => {
    assertMapperAvailable(session.inSpcblock);
    session.mapper = "norom";
    session.checksumFixEnabled = false;
  });

  registry.register("fullsa1rom", ({ session }) => {
    assertMapperAvailable(session.inSpcblock);
    session.mapper = "bigsa1rom";
  });

  registry.register("sa1rom", ({ session }, words) => {
    assertMapperAvailable(session.inSpcblock);

    if (words.length > 1) {
      const parts = words[1].split(",");
      if (parts.length !== 4) {
        throw new Error("Invalid SA1ROM mapper specification. Expected 4 comma-separated values.");
      }

      session.sa1banks = [];
      session.sa1banks[0] = parseInt(parts[0], 10) << 20;
      session.sa1banks[1] = parseInt(parts[1], 10) << 20;
      session.sa1banks[4] = parseInt(parts[2], 10) << 20;
      session.sa1banks[5] = parseInt(parts[3], 10) << 20;
    } else {
      session.sa1banks = [];
      session.sa1banks[0] = 0 << 20;
      session.sa1banks[1] = 1 << 20;
      session.sa1banks[4] = 2 << 20;
      session.sa1banks[5] = 3 << 20;
    }

    session.mapper = "sa1rom";
  });

  registry.register("org", ({ session }, words) => {
    if (session.inSpcblock) {
      throw new Error("ORG is unavailable inside spcblock.");
    }

    if (shouldRedirectOrgToSpcblock(session.spcInlineCompatMode)) {
      session.handleSpcblock(["spcblock", ...words.slice(1)]);
      return;
    }

    session.handleOrg(words.slice(1));
  });

  registry.register("pushbase", handlePushBase);

  registry.register("pullbase", handlePullBase);

  registry.register("pushpc", ({ session }) => {
    session.handlePushPC();
  });

  registry.register("pullpc", ({ session }) => {
    session.handlePullPC();
  });

  registry.register("arch", handleArch);

  registry.register("startpos", handleStartpos);

  registry.register("check", ({ session }, words) => {
    if (words.length >= 2 && words[1].toLowerCase() === "title") {
      session.readFunctionsEnabled = true;
      return;
    }

    if (words.length < 3 || words[1].toLowerCase() !== "bankcross") {
      throw new Error("Invalid CHECK command. Expected: check bankcross <on|off|half|full>");
    }

    const mode = words[2].toLowerCase();
    if (mode === "off") {
      session.bankCrossCheckMode = "off";
    } else if (mode === "half") {
      session.bankCrossCheckMode = "half";
    } else if (mode === "full" || mode === "on") {
      session.bankCrossCheckMode = "full";
    } else {
      throw new Error(`Invalid parameter for check bankcross: ${words[2]}`);
    }
  });

  registry.register("optimize", ({ session }, words) => {
    if (words.length >= 3 && words[1].toLowerCase() === "dp") {
      const mode = words[2].toLowerCase();
      if (mode === "none") {
        session.optimizeDirectPage = false;
      } else if (mode === "ram" || mode === "always") {
        session.optimizeDirectPage = true;
      }
    }
  });
};
