/**
 * Module-wide capture/setup lease token; only its matching release callback may clear ownership,
 * even after repeated releases.
 */
let owner: symbol | undefined;

/**
 * Serializes interactive setup and runtime trace recording across debug sessions.
 * @returns Idempotent release callback.
 */
export const acquireTraceLease = (): (() => void) => {
  if (owner) {
    throw new Error(
      "A trace recording or capture setup is already active. Stop it before starting another.",
    );
  }
  const token = Symbol("trace");
  owner = token;
  return () => {
    // The token is a local ownership symbol, not a secret compared across a trust boundary.
    // oxlint-disable-next-line security/detect-possible-timing-attacks
    if (owner === token) {
      owner = undefined;
    }
  };
};
