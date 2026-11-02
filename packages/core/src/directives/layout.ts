import { parseDirectiveExpression } from "../ir/directive-arguments.js";
import {
  syntaxBoolean,
  syntaxExpression,
  syntaxOptional,
  syntaxRecord,
  syntaxString,
} from "../ir/syntax-codec.js";
import type { DirectiveRegistry, DirectiveRegistryContexts } from "./registry.js";
import type { AddressStackDirectiveContext, ArchitectureDirectiveContext } from "./types.js";

/**
 * Pushes the current target address onto the push base stack.
 * @param ctx The directive context.
 */
export const handlePushBase = ({ session }: AddressStackDirectiveContext): void => {
  session.pushBaseStack.push(session.currentTargetAddress);
};

/**
 * Restores the target address saved by {@link handlePushBase}.
 * @param ctx The directive context.
 * @throws {Error} If the base stack is empty.
 */
export const handlePullBase = ({ session }: AddressStackDirectiveContext): void => {
  const baseAddress = session.pushBaseStack.pop();
  if (baseAddress === undefined) {
    throw new Error("No base value to pull.");
  }
  session.currentTargetAddress = baseAddress;
};

/**
 * Selects the architecture named by `words[1]`.
 * Prefers {@link DirectiveArchitectureCapability.selectArchitecture} when present.
 * Otherwise writes `session.arch` after checking `availableArchitectures`.
 * @param ctx The architecture-capable session.
 * @param words Tokenized line, keyword first.
 * @throws {Error} If the architecture name is missing, unknown, or not allowed on the target.
 */
export const handleArch = (
  { session }: ArchitectureDirectiveContext,
  words: readonly string[],
): void => {
  selectArchitecture({ session }, parseArchitectureName(words).name);
};

/** Apply a parsed CPU name without retaining parser tokens in the runtime contract. */
function selectArchitecture({ session }: ArchitectureDirectiveContext, archParam: string): void {
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
}

/**
 * Registers `base`, `org`, `pushbase`/`pullbase`, `pushpc`/`pullpc`, and `arch`.
 * @param registry The directive registry.
 * @param context Layout-capable sessions and runtime.
 */
/** No-op metadata hook for directives that only affect layout counters. */
const empty = () => ({});

/** Registers org, base, and related layout directives shared across targets. */
export const registerGenericLayoutDirectives = (
  registry: DirectiveRegistry,
  context: DirectiveRegistryContexts["layout"],
): void => {
  registry.registerImmutableTyped(
    "base",
    ({ words }) => {
      if (words.length !== 2) {
        throw new Error("BASE directive requires exactly one parameter.");
      }
      const text = words[1].trim();
      const off = text.toLowerCase() === "off";
      return { off, text, address: off ? undefined : parseDirectiveExpression(text) };
    },
    syntaxRecord({
      off: syntaxBoolean,
      text: syntaxString,
      address: syntaxOptional(syntaxExpression),
    }),
    ({ off, text, address }) => {
      const { session, operandResolver } = context.base;
      if (off) {
        session.currentTargetAddress = session.currentTargetBaseAddress;
        session.currentTargetStartAddress = session.currentTargetBaseStartAddress;
        return;
      }
      if (!address) {
        throw new Error("Missing BASE expression.");
      }
      const value = operandResolver.getnum(address);
      const addressWidth = session.addressWidth;
      if (value < 0 || value > 2 ** addressWidth - 1) {
        throw new Error(`Invalid base address: ${text}. Must be within ${addressWidth} bits.`);
      }
      session.currentTargetAddress = value;
      session.currentTargetStartAddress = value;
    },
  );
  registry.registerImmutableTyped(
    "org",
    ({ words }) => {
      if (words.length !== 2) {
        throw new Error("ORG requires a single address parameter.");
      }
      return { address: parseDirectiveExpression(words[1].trim(), false), text: words[1] };
    },
    syntaxRecord({ address: syntaxExpression, text: syntaxString }),
    ({ address, text }) => {
      context.org.runtime.executeOrg(address, text);
    },
  );
  const emptySyntax = syntaxRecord({});
  registry.registerImmutableTyped("pushbase", empty, emptySyntax, () =>
    handlePushBase(context.addressStack),
  );
  registry.registerImmutableTyped("pullbase", empty, emptySyntax, () =>
    handlePullBase(context.addressStack),
  );
  registry.registerImmutableTyped("pushpc", empty, emptySyntax, () =>
    context.runtime.runtime.handlePushPC(),
  );
  registry.registerImmutableTyped("pullpc", empty, emptySyntax, () =>
    context.runtime.runtime.handlePullPC(),
  );
  registry.registerImmutableTyped(
    "arch",
    ({ words }) => parseArchitectureName(words),
    syntaxRecord({ name: syntaxString }),
    ({ name }) => selectArchitecture(context.architecture, name),
  );
};

/**
 * Registers the core layout directive group.
 * @param registry The directive registry.
 * @param context Layout-capable sessions and runtime.
 */
export const registerLayoutDirectives = (
  registry: DirectiveRegistry,
  context: DirectiveRegistryContexts["layout"],
): void => {
  registerGenericLayoutDirectives(registry, context);
};

/** Public calls and source directives share CPU-name validation. */
const parseArchitectureName = (words: readonly string[]) => {
  if (!words[1]) {
    throw new Error("ARCH command requires an architecture parameter.");
  }
  return { name: words[1].toLowerCase() };
};
