/** Decoded argument and its original half-open UTF-16 range within the argument list. */
export type MacroInvocationArgument = {
  /** Trimmed argument with quotes stripped and escapes decoded. */
  value: string;
  /** Exact source slice between separators, before decoding. */
  text: string;
  /** Inclusive start offset in the argument list text. */
  start: number;
  /** Exclusive end offset, at the separator or end of text. */
  end: number;
};

/** Preserve quote stripping, escapes, empty middle arguments and the legacy omitted empty tail. */
export function parseMacroArguments(text: string): MacroInvocationArgument[] {
  const args: MacroInvocationArgument[] = [];
  let value = "";
  let start = 0;
  let quoted = false;
  let escaped = false;
  const push = (end: number): void => {
    args.push({ value: value.trim(), text: text.slice(start, end), start, end });
    value = "";
    start = end + 1;
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index++;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      push(index);
      continue;
    }
    value += char;
  }
  if (value.length > 0) {
    push(text.length);
  }
  return args;
}
