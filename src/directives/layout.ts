import type { DirectiveRegistry } from "./registry.js";

const assertMapperAvailable = (inSpcblock: boolean): void => {
  if (inSpcblock) {
    throw new Error("Mapper directives are unavailable inside spcblock.");
  }
};

export const registerLayoutDirectives = (registry: DirectiveRegistry): void => {
  registry.register("base", ({ session, operandResolver }, words) => {
    if (words.length !== 2) {
      throw new Error("BASE directive requires exactly one parameter.");
    }

    const param = words[1].toLowerCase();
    if (param === "off") {
      session.snespos = session.realsnespos;
      session.startpos = session.realstartpos;
      return;
    }

    const value = operandResolver.getnum(param);
    if (value > 0xFFFFFF) {
      throw new Error(`Invalid base address: ${param}. Must be within 24 bits.`);
    }

    session.snespos = value;
    session.startpos = value;
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

    if (session.spcInlineCompatMode) {
      session.handleSpcblock(["spcblock", ...words.slice(1)]);
      return;
    }

    session.handleOrg(words.slice(1));
  });

  registry.register("pushbase", ({ session }) => {
    session.handlePushBase();
  });

  registry.register("pullbase", ({ session }) => {
    session.handlePullBase();
  });

  registry.register("pushpc", ({ session }) => {
    session.handlePushPC();
  });

  registry.register("pullpc", ({ session }) => {
    session.handlePullPC();
  });

  registry.register("arch", ({ session }, words) => {
    if (session.inSpcblock) {
      throw new Error("ARCH is unavailable inside spcblock.");
    }

    session.handleArch(words);
  });

  registry.register("startpos", ({ session }, words) => {
    session.handleStartpos(words.slice(1));
  });

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
