import type { DirectiveRegistry } from "./registry.js";
import { DirectiveContext } from "./types.js";

/**
 * Pushes the current namespace.
 * @param {DirectiveContext} ctx The directive context.
 * @param {AssemblySession} ctx.session The assembly session.
 */
const handlePushNamespace = ({ session }: DirectiveContext) => {
  // debug("handlePushNamespace")
  session.namespaceStack.push(session.currentNamespace);
  if (session.namespaceNestingEnabled) {
    // Also save the nesting path
    session.namespaceStack.push(JSON.stringify(session.namespaceNestingPath));
  }
};

/**
 * Restores the previous namespace.
 * @param {DirectiveContext} ctx The directive context.
 * @param {AssemblySession} ctx.session The assembly session.
 */
const handlePullNamespace = ({ session }: DirectiveContext) => {
  // debug("handlePullNamespace");
  if (session.namespaceStack.length === 0) {
    throw new Error("pullns without pushns");
  }
  if (session.namespaceNestingEnabled) {
    // Restore the nesting path first
    const pathJson = session.namespaceStack.pop();
    const parsedPath: unknown = JSON.parse(pathJson ?? "[]");
    session.namespaceNestingPath = Array.isArray(parsedPath) && parsedPath.every((entry) => typeof entry === "string")
      ? parsedPath
      : [];
  }
  session.currentNamespace = session.namespaceStack.pop() ?? "";
};

/**
 * Handles `namespace` definitions.
 * Example:
 * @example
 * namespace "identifier"
 * namespace identifier
 * @param {DirectiveContext} ctx The directive context.
 * @param {AssemblySession} ctx.session The assembly session.
 * @param {string[]} words The words of the namespace command.
 */
const handleNamespace = ({ session }: DirectiveContext, words: string[]) => {
  if (session.inSpcblock) {
    throw new Error("NAMESPACE is unavailable inside spcblock.");
  }

  const params = words.slice(1);
  // debug("handleNamespace", params);

// Handle namespace nesting directive
  if (params.length >= 2 && params[0].toLowerCase() === "nested") {
    const action = params[1].toLowerCase();
    if (action === "on") {
      session.namespaceNestingEnabled = true;
      return;
    } else if (action === "off") {
      session.namespaceNestingEnabled = false;
      session.namespaceNestingPath = [];
      session.currentNamespace = "";
      return;
    }
  }

  if (params.length === 0) {
    // debug("handleNamespace empty, resetting namespace");
    if (session.namespaceNestingEnabled) {
      session.namespaceNestingPath = [];
    }
    session.currentNamespace = "";
    return;
  }

  if (params.length === 1 && params[0].toLowerCase() === "off") {
    // debug("handleNamespace disable", session.currentNamespace);
    if (session.namespaceNestingEnabled) {
      // Pop the last namespace from the path
      session.namespaceNestingPath.pop();
      // Reconstruct the current namespace from the remaining path
      session.currentNamespace = session.namespaceNestingPath.join("_");
    } else {
      session.currentNamespace = "";
    }
    return;
  } else if (params.length === 1) {
    // debug("handleNamespace enable", params[0]);
    if (session.namespaceNestingEnabled) {
      session.namespaceNestingPath.push(params[0]);
      session.currentNamespace = session.namespaceNestingPath.join("_");
    } else {
      session.currentNamespace = params[0];
    }
    return;
  }

  const action = params[1].toLowerCase();
  if (action === "off") {
    // debug("handleNamespace disable action", params[0]);
    if (session.namespaceNestingEnabled) {
      session.namespaceNestingPath.pop();
      session.currentNamespace = session.namespaceNestingPath.join("_");
    } else {
      session.currentNamespace = "";
    }
  } else {
    // debug("handleNamespace enable action", params[0]);
    if (session.namespaceNestingEnabled) {
      session.namespaceNestingPath.push(params[0]);
      session.currentNamespace = session.namespaceNestingPath.join("_");
    } else {
      session.currentNamespace = params[0];
    }
  }
};

export const registerNamespaceDirectives = (registry: DirectiveRegistry): void => {
  registry.register("namespace", handleNamespace);

  registry.register("pushns", handlePushNamespace);

  registry.register("pullns", handlePullNamespace);
};
