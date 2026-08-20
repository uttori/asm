import type { DirectiveRegistry, DirectiveRegistryContexts } from "./registry.js";
import {
  applyMapperSelection,
  assertMapperAvailable,
  shouldEnableSpcInlineCompat,
  shouldRedirectOrgToSpcblock,
} from "../compatibility/asar-compatibility-profile.js";
import type {
  AddressStackDirectiveContext,
  ArchitectureDirectiveContext,
  StartposDirectiveContext,
} from "./types.js";
import type { TargetDirectiveFeature } from "../target-profile.js";

const DEFAULT_LAYOUT_FEATURES: ReadonlySet<TargetDirectiveFeature> = new Set([
  "snes-mappers",
  "snes-memory",
  "snes-policy",
  "spc-blocks",
]);

/**
 * Pushes the current target address onto the push base stack.
 * @param {AddressStackDirectiveContext} ctx The directive context.
 */
export const handlePushBase = ({ session }: AddressStackDirectiveContext): void => {
  // debug("handlePushBase")
  session.pushBaseStack.push(session.currentTargetAddress);
};

/**
 * Pulls the current target address from the push base stack.
 * @param {AddressStackDirectiveContext} ctx The directive context.
 */
export const handlePullBase = ({ session }: AddressStackDirectiveContext): void => {
  // debug("handlePullBase")
  if (session.pushBaseStack.length === 0) {
    throw new Error("No base value to pull.");
  }
  const baseAddress = session.pushBaseStack.pop();
  if (baseAddress === undefined) {
    throw new Error("No base value to pull.");
  }
  session.currentTargetAddress = baseAddress;
};

/**
 * Handles the ARCH command.
 * @param {ArchitectureDirectiveContext} ctx The directive context.
 * @param {string[]} words - The words from the ARCH command.
 * @throws {Error} If the ARCH command requires an architecture parameter.
 */
export const handleArch = (
  { session }: ArchitectureDirectiveContext,
  words: readonly string[],
): void => {
  // debug("handleArch", words)
  if (session.inSpcblock) {
    throw new Error("ARCH is unavailable inside spcblock.");
  }

  if (!words[1]) {
    throw new Error("ARCH command requires an architecture parameter.");
  }
  const archParam = words[1].toLowerCase();
  const canonical = session.architectureRegistry.getCanonicalName(archParam);
  if (!canonical) {
    if (session.selectArchitecture) {
      session.selectArchitecture(archParam, archParam);
      session.spcInlineCompatMode = shouldEnableSpcInlineCompat(archParam);
      return;
    }
    throw new Error("Unsupported architecture: " + archParam);
  }
  if (
    !session.selectArchitecture &&
    session.targetProfile &&
    !session.targetProfile.architectures.has(canonical)
  ) {
    throw new Error(
      `Architecture ${canonical} is unavailable for target ${session.targetProfile.name}.`,
    );
  }
  if (session.selectArchitecture) {
    session.selectArchitecture(canonical, archParam);
  } else {
    session.arch = canonical;
  }
  session.spcInlineCompatMode = shouldEnableSpcInlineCompat(archParam);
};

export const handleStartpos = (
  { session, operandResolver }: StartposDirectiveContext,
  words: readonly string[],
): void => {
  const params = words.slice(1);

  if (!session.inSpcblock || !session.spcblockData) {
    throw new Error("startpos used without an active spcblock.");
  }
  if (params.length !== 1) {
    throw new Error("startpos requires exactly one parameter.");
  }
  session.spcblockData.executeAddress =
    operandResolver.getnum(session.resolvedefines(params[0])) & 0xffff;
};

export const registerLayoutDirectives = (
  registry: DirectiveRegistry,
  context: DirectiveRegistryContexts["layout"],
  features: ReadonlySet<TargetDirectiveFeature> = DEFAULT_LAYOUT_FEATURES,
): void => {
  registry.register("base", context.base, ({ session, operandResolver }, words) => {
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
    const addressWidth = session.targetProfile?.addressSpace.addressWidth ?? 24;
    const maxAddress = 2 ** addressWidth - 1;
    if (value < 0 || value > maxAddress) {
      throw new Error(`Invalid base address: ${param}. Must be within ${addressWidth} bits.`);
    }

    session.currentTargetAddress = value;
    session.currentTargetStartAddress = value;
  });

  if (features.has("snes-mappers")) {
    registry.register("lorom", context.mapper, ({ session }) => {
      assertMapperAvailable(session.inSpcblock);
      applyMapperSelection(session, "lorom");
    });

    registry.register("hirom", context.mapper, ({ session }) => {
      assertMapperAvailable(session.inSpcblock);
      applyMapperSelection(session, "hirom");
    });

    registry.register("exlorom", context.mapper, ({ session }) => {
      assertMapperAvailable(session.inSpcblock);
      applyMapperSelection(session, "exlorom");
    });

    registry.register("exhirom", context.mapper, ({ session }) => {
      assertMapperAvailable(session.inSpcblock);
      applyMapperSelection(session, "exhirom");
    });

    registry.register("sfxrom", context.mapper, ({ session }) => {
      assertMapperAvailable(session.inSpcblock);
      applyMapperSelection(session, "sfxrom");
    });

    registry.register("norom", context.mapper, ({ session }) => {
      assertMapperAvailable(session.inSpcblock);
      applyMapperSelection(session, "norom");
    });

    registry.register("fullsa1rom", context.mapper, ({ session }) => {
      assertMapperAvailable(session.inSpcblock);
      applyMapperSelection(session, "bigsa1rom");
    });

    registry.register("sa1rom", context.mapper, ({ session }, words) => {
      assertMapperAvailable(session.inSpcblock);

      if (words.length > 1) {
        const parts = words[1].split(",");
        if (parts.length !== 4) {
          throw new Error(
            "Invalid SA1ROM mapper specification. Expected 4 comma-separated values.",
          );
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

      applyMapperSelection(session, "sa1rom");
    });
  }

  registry.register("org", context.org, ({ session, runtime }, words) => {
    if (session.inSpcblock) {
      throw new Error("ORG is unavailable inside spcblock.");
    }

    if (shouldRedirectOrgToSpcblock(session.spcInlineCompatMode)) {
      runtime.handleSpcblock(["spcblock", ...words.slice(1)]);
      return;
    }

    runtime.handleOrg(words.slice(1));
  });

  registry.register("pushbase", context.addressStack, handlePushBase);

  registry.register("pullbase", context.addressStack, handlePullBase);

  registry.register("pushpc", context.runtime, ({ runtime }) => {
    runtime.handlePushPC();
  });

  registry.register("pullpc", context.runtime, ({ runtime }) => {
    runtime.handlePullPC();
  });

  registry.register("arch", context.architecture, handleArch);

  if (features.has("spc-blocks")) {
    registry.register("startpos", context.startpos, handleStartpos);
  }

  if (features.has("snes-policy")) {
    registry.register("check", context.policy, ({ session }, words) => {
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

    registry.register("optimize", context.policy, ({ session }, words) => {
      if (words.length >= 3 && words[1].toLowerCase() === "dp") {
        const mode = words[2].toLowerCase();
        if (mode === "none") {
          session.optimizeDirectPage = false;
        } else if (mode === "ram" || mode === "always") {
          session.optimizeDirectPage = true;
        }
      }
    });
  }
};
