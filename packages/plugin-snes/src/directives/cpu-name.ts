/**
 * Maps a ca65 CPU name string to the SNES architecture id it should activate.
 * Returns `undefined` for names that are not SNES-owned CPU identifiers.
 * @param {string} name CPU name as used in ca65 `.setcpu`.
 * @returns {string | undefined} The resolved SNES architecture id.
 */
export function resolveSnesCpuName(name: string): string | undefined {
  switch (name.toLowerCase()) {
    case "65816":
    case "65c816":
    case "65802":
      return "snes.65816";
    case "spc700":
      return "snes.spc700";
    case "superfx":
      return "snes.superfx";
    default:
      return undefined;
  }
}
