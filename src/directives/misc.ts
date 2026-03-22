import type { DirectiveRegistry } from "./registry.js";
import { ASAR_COMPAT_NO_OP_DIRECTIVES } from "../compatibility/asar-compatibility-profile.js";
import { AssemblySession, DirectiveContext } from "./types.js";

/**
 * Restores the previously saved character mapping table.
 * @param {DirectiveContext} ctx The directive context.
 * @param {AssemblySession} ctx.session The assembly session.
 * @throws {Error} If `pulltable` is called without `pushtable`.
 */
const handlePullTable = ({ session }: DirectiveContext) => {
  // debug("handlePullTable");
  if (session.tableStack.length === 0) {
    throw new Error("pulltable without pushtable");
  }
  session.characterMappings = session.tableStack.pop()!;
};

/**
 * Saves the current character mapping table.
 * @param {DirectiveContext} ctx The directive context.
 * @param {AssemblySession} ctx.session The assembly session.
 */
const handlePushTable = ({ session }: DirectiveContext) => {
  // debug("handlePushTable");
  session.tableStack.push(new Map(session.characterMappings));
};

export const registerMiscDirectives = (registry: DirectiveRegistry): void => {
  registry.register("pulltable", handlePullTable);

  registry.register("pushtable", handlePushTable);

  registry.register([...ASAR_COMPAT_NO_OP_DIRECTIVES], () => {
    // Compatibility no-ops kept to preserve current fixture behavior.
  });
};
