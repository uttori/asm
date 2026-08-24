import type { DirectiveRegistry, DirectiveRegistryContexts } from "./registry.js";
import {
  applyMapperSelection,
  assertMapperAvailable,
  shouldEnableSpcInlineCompat,
  shouldRedirectOrgToSpcblock,
  shouldUseNoromAddressing,
} from "../compatibility/asar-compatibility-profile.js";
import type {
  AddressStackDirectiveContext,
  ArchitectureDirectiveContext,
  StartposDirectiveContext,
} from "./types.js";
import {
  ALL_LEGACY_TARGET_DIRECTIVE_SETS,
  LEGACY_SNES_MAPPER_DIRECTIVE_SET,
  LEGACY_SNES_POLICY_DIRECTIVE_SET,
  LEGACY_SPC_DIRECTIVE_SET,
} from "./directive-set-ids.js";

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
  if (session.inTargetBlock) {
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
      session.targetBlockInlineCompatibility = shouldEnableSpcInlineCompat(archParam);
      if (shouldUseNoromAddressing(archParam)) {
        applyMapperSelection(session.targetState, "norom");
      }
      return;
    }
    throw new Error("Unsupported architecture: " + archParam);
  }
  if (
    !session.selectArchitecture &&
    session.availableArchitectures &&
    !session.availableArchitectures.has(canonical)
  ) {
    throw new Error(
      `Architecture ${canonical} is unavailable for target ${session.targetDisplayName ?? "active target"}.`,
    );
  }
  if (session.selectArchitecture) {
    session.selectArchitecture(canonical, archParam);
  } else {
    session.arch = canonical;
  }
  session.targetBlockInlineCompatibility = shouldEnableSpcInlineCompat(archParam);
  if (shouldUseNoromAddressing(archParam)) {
    // `arch spc700-raw` is a 1:1 file image. Lorom/hirom leave `org $000000`
    // unmapped (`(addr & 0x408000) === 0`) and silently drop the writes.
    applyMapperSelection(session.targetState, "norom");
  }
};

export const handleStartpos = (
  { session, operandResolver }: StartposDirectiveContext,
  words: readonly string[],
): void => {
  const params = words.slice(1);

  if (!session.inTargetBlock || !session.targetBlockData) {
    throw new Error("startpos used without an active spcblock.");
  }
  if (params.length !== 1) {
    throw new Error("startpos requires exactly one parameter.");
  }
  session.targetBlockData.executeAddress =
    operandResolver.getnum(session.resolvedefines(params[0])) & 0xffff;
};

export const registerGenericLayoutDirectives = (
  registry: DirectiveRegistry,
  context: DirectiveRegistryContexts["layout"],
): void => {
  registry.registerLowered("base", context.base, ({ session, operandResolver }, words) => {
    if (words.length !== 2) {
      throw new Error("BASE directive requires exactly one parameter.");
    }

    const param = words[1].trim();
    if (param.toLowerCase() === "off") {
      const baseAddress = Number(session.currentTargetBaseAddress);
      const baseStartAddress = Number(session.currentTargetBaseStartAddress);
      session.currentTargetAddress = baseAddress;
      session.currentTargetStartAddress = baseStartAddress;
      return;
    }

    const value = operandResolver.getnum(param);
    const addressWidth = session.addressWidth;
    const maxAddress = 2 ** addressWidth - 1;
    if (value < 0 || value > maxAddress) {
      throw new Error(`Invalid base address: ${param}. Must be within ${addressWidth} bits.`);
    }

    session.currentTargetAddress = value;
    session.currentTargetStartAddress = value;
  });

  registry.registerLowered("org", context.org, ({ session, runtime, spcRuntime }, words) => {
    if (session.inTargetBlock) {
      throw new Error("ORG is unavailable inside spcblock.");
    }

    if (shouldRedirectOrgToSpcblock(session.targetBlockInlineCompatibility)) {
      spcRuntime.handleSpcblock(["spcblock", ...words.slice(1)]);
      return;
    }

    runtime.handleOrg(words.slice(1));
  });

  registry.registerLowered("pushbase", context.addressStack, handlePushBase);

  registry.registerLowered("pullbase", context.addressStack, handlePullBase);

  registry.registerLowered("pushpc", context.runtime, ({ runtime }) => {
    runtime.handlePushPC();
  });

  registry.registerLowered("pullpc", context.runtime, ({ runtime }) => {
    runtime.handlePullPC();
  });

  registry.registerLowered("arch", context.architecture, handleArch);
};

export const registerSnesMapperDirectives = (
  registry: DirectiveRegistry,
  context: DirectiveRegistryContexts["layout"],
): void => {
  const registerMapper = (keyword: string, mapper: string): void =>
    registry.registerLowered(keyword, context.mapper, ({ session }) => {
      assertMapperAvailable(session.inTargetBlock);
      applyMapperSelection(session.targetState, mapper);
    });

  registerMapper("lorom", "lorom");
  registerMapper("hirom", "hirom");
  registerMapper("exlorom", "exlorom");
  registerMapper("exhirom", "exhirom");
  registerMapper("sfxrom", "sfxrom");
  registerMapper("norom", "norom");
  registerMapper("fullsa1rom", "bigsa1rom");

  registry.registerLowered("sa1rom", context.mapper, ({ session }, words) => {
    assertMapperAvailable(session.inTargetBlock);

    if (words.length > 1) {
      const parts = words[1].split(",");
      if (parts.length !== 4) {
        throw new Error("Invalid SA1ROM mapper specification. Expected 4 comma-separated values.");
      }

      session.targetState.sa1Banks = [];
      session.targetState.sa1Banks[0] = parseInt(parts[0], 10) << 20;
      session.targetState.sa1Banks[1] = parseInt(parts[1], 10) << 20;
      session.targetState.sa1Banks[4] = parseInt(parts[2], 10) << 20;
      session.targetState.sa1Banks[5] = parseInt(parts[3], 10) << 20;
    } else {
      session.targetState.sa1Banks = [];
      session.targetState.sa1Banks[0] = 0 << 20;
      session.targetState.sa1Banks[1] = 1 << 20;
      session.targetState.sa1Banks[4] = 2 << 20;
      session.targetState.sa1Banks[5] = 3 << 20;
    }

    applyMapperSelection(session.targetState, "sa1rom");
  });
};

export const registerSpcLayoutDirectives = (
  registry: DirectiveRegistry,
  context: DirectiveRegistryContexts["layout"],
): void => {
  registry.registerLowered("startpos", context.startpos, handleStartpos);
};

export const registerSnesPolicyDirectives = (
  registry: DirectiveRegistry,
  context: DirectiveRegistryContexts["layout"],
): void => {
  registry.registerLowered("check", context.policy, ({ session }, words) => {
    if (words.length >= 2 && words[1].toLowerCase() === "title") {
      session.targetState.readFunctionsEnabled = true;
      return;
    }

    if (words.length < 3 || words[1].toLowerCase() !== "bankcross") {
      throw new Error("Invalid CHECK command. Expected: check bankcross <on|off|half|full>");
    }

    const mode = words[2].toLowerCase();
    if (mode === "off") {
      session.targetState.bankCrossMode = "off";
    } else if (mode === "half") {
      session.targetState.bankCrossMode = "half";
    } else if (mode === "full" || mode === "on") {
      session.targetState.bankCrossMode = "full";
    } else {
      throw new Error(`Invalid parameter for check bankcross: ${words[2]}`);
    }
  });

  registry.registerLowered("optimize", context.policy, ({ session }, words) => {
    if (words.length >= 3 && words[1].toLowerCase() === "dp") {
      const mode = words[2].toLowerCase();
      if (mode === "none") {
        session.targetState.optimizeDirectPage = false;
      } else if (mode === "ram" || mode === "always") {
        session.targetState.optimizeDirectPage = true;
      }
    }
  });
};

export const registerLayoutDirectives = (
  registry: DirectiveRegistry,
  context: DirectiveRegistryContexts["layout"],
  activeSetIds: ReadonlySet<string> = ALL_LEGACY_TARGET_DIRECTIVE_SETS,
): void => {
  registerGenericLayoutDirectives(registry, context);
  if (activeSetIds.has(LEGACY_SNES_MAPPER_DIRECTIVE_SET)) {
    registerSnesMapperDirectives(registry, context);
  }
  if (activeSetIds.has(LEGACY_SPC_DIRECTIVE_SET)) {
    registerSpcLayoutDirectives(registry, context);
  }
  if (activeSetIds.has(LEGACY_SNES_POLICY_DIRECTIVE_SET)) {
    registerSnesPolicyDirectives(registry, context);
  }
};
