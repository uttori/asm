import type { DirectiveRegistry, DirectiveRegistryContexts } from "./registry.js";
import type { AddressStackDirectiveContext, ArchitectureDirectiveContext } from "./types.js";

/**
 * Pushes the current target address onto the push base stack.
 * @param {AddressStackDirectiveContext} ctx The directive context.
 * @returns {void}
 */
export const handlePushBase = ({ session }: AddressStackDirectiveContext): void => {
  // debug("handlePushBase")
  session.pushBaseStack.push(session.currentTargetAddress);
};

/**
 * Restores the target address saved by {@link handlePushBase}.
 * @param {AddressStackDirectiveContext} ctx The directive context.
 * @returns {void}
 * @throws {Error} If the base stack is empty.
 */
export const handlePullBase = ({ session }: AddressStackDirectiveContext): void => {
  // debug("handlePullBase")
  const baseAddress = session.pushBaseStack.pop();
  if (baseAddress === undefined) {
    throw new Error("No base value to pull.");
  }
  session.currentTargetAddress = baseAddress;
};

/**
 * Selects the architecture named by `words[1]`.
 * Prefers {@link DirectiveArchitectureCapability.selectArchitecture} when present;
 * otherwise writes `session.arch` after checking `availableArchitectures`.
 * @param {ArchitectureDirectiveContext} ctx The architecture-capable session.
 * @param {readonly string[]} words Tokenized line, keyword first.
 * @returns {void}
 * @throws {Error} If the architecture name is missing, unknown, or not allowed on the target.
 */
export const handleArch = (
  { session }: ArchitectureDirectiveContext,
  words: readonly string[],
): void => {
  // debug("handleArch", words)
  if (!words[1]) {
    throw new Error("ARCH command requires an architecture parameter.");
  }
  const archParam = words[1].toLowerCase();
  const canonical = session.architectureRegistry.getCanonicalName(archParam);
  if (!canonical) {
    if (session.selectArchitecture) {
      session.selectArchitecture(archParam, archParam);
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
};

/**
 * Registers `base`, `org`, `pushbase`/`pullbase`, `pushpc`/`pullpc`, and `arch`.
 * @param {DirectiveRegistry} registry The directive registry.
 * @param {DirectiveRegistryContexts["layout"]} context Layout-capable sessions and runtime.
 * @returns {void}
 */
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

  registry.registerLowered("org", context.org, ({ runtime }, words) => {
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

/**
 * Registers the core layout directive group.
 * @param {DirectiveRegistry} registry The directive registry.
 * @param {DirectiveRegistryContexts["layout"]} context Layout-capable sessions and runtime.
 * @returns {void}
 */
export const registerLayoutDirectives = (
  registry: DirectiveRegistry,
  context: DirectiveRegistryContexts["layout"],
): void => {
  registerGenericLayoutDirectives(registry, context);
};
