import type { DirectiveRegistry } from "./registry.js";
import { ASAR_COMPAT_NO_OP_DIRECTIVES } from "../compatibility/asar-compatibility-profile.js";
import type { DirectiveTableCapability } from "./types.js";

type TableDirectiveContext = {
  session: DirectiveTableCapability;
};

/**
 * Restores the previously saved character mapping table.
 * @param {TableDirectiveContext} ctx The directive context.
 * @param {DirectiveTableCapability} ctx.session The table-capable assembly session.
 * @throws {Error} If `pulltable` is called without `pushtable`.
 */
const handlePullTable = ({ session }: TableDirectiveContext) => {
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
const handlePushTable = ({ session }: TableDirectiveContext) => {
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
