import type { DirectiveRegistry } from "./registry.js";
import { ASAR_COMPAT_NO_OP_DIRECTIVES } from "../compatibility/asar-compatibility-profile.js";
import type { TableDirectiveContext } from "./types.js";

/**
 * Restores the previously saved character mapping table.
 * @param {TableDirectiveContext} ctx The directive context.
 * @param {DirectiveTableCapability} ctx.session The table-capable assembly session.
 * @throws {Error} If `pulltable` is called without `pushtable`.
 */
export const handlePullTable = ({ session }: TableDirectiveContext): void => {
  // debug("handlePullTable");
  if (session.tableStack.length === 0) {
    throw new Error("pulltable without pushtable");
  }
  session.characterMappings = session.tableStack.pop()!;
};

/**
 * Saves the current character mapping table.
 * @param {TableDirectiveContext} ctx The directive context.
 * @param {DirectiveTableCapability} ctx.session The table-capable assembly session.
 */
export const handlePushTable = ({ session }: TableDirectiveContext): void => {
  // debug("handlePushTable");
  session.tableStack.push(new Map(session.characterMappings));
};

export const registerMiscDirectives = (
  registry: DirectiveRegistry,
  context: TableDirectiveContext,
): void => {
  registry.register("pulltable", context, handlePullTable);

  registry.register("pushtable", context, handlePushTable);

  registry.register([...ASAR_COMPAT_NO_OP_DIRECTIVES], context, () => {
    // Compatibility no-ops kept to preserve current fixture behavior.
  });
};
