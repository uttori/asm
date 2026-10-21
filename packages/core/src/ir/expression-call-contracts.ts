/** Built-in argument slots that consume spelling rather than a numeric symbol value. */
const firstSourceArgument = new Set([
  "countof",
  "bytesof",
  "startof",
  "endof",
  "defined",
  "sizeof",
  "objectsize",
  "datasize",
  "filesize",
  "getfilestatus",
]);

/** Parsing and evaluation share this policy, including the historical case-sensitive names. */
export function isSourceTextArgument(name: string, index: number): boolean {
  if (name === "stringsequal" || name === "stringsequalnocase") {
    return index < 2;
  }
  return (
    index === 0 && (firstSourceArgument.has(name) || /^(?:canreadfile|readfile)\d?$/.test(name))
  );
}
