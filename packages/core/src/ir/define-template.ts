import { bindSourceFragment, sourceFragment, type SourceFragment } from "./source-fragment.js";

/** Define syntax keeps dynamic names unbound; offsets refer to the template's original UTF-16 text. */
export type DefineTemplatePart =
  | {
      readonly kind: "escape";
      readonly start: number;
      readonly end: number;
      readonly value: string;
    }
  | {
      readonly kind: "define";
      readonly start: number;
      readonly end: number;
      readonly name: string;
      readonly braced: boolean;
      readonly children: readonly DefineTemplatePart[];
    }
  | { readonly kind: "error"; readonly start: number; readonly end: number };
export type DefineTemplate = {
  readonly text: string;
  readonly parts: readonly DefineTemplatePart[];
};

/** Parse replacement sites without lookup or evaluation; escaped exclamation marks never become references. */
export function parseDefineTemplate(
  text: string,
  escapes: "basic" | "string" | "none" = "basic",
): DefineTemplate {
  const parse = (start: number, end: number): DefineTemplatePart[] => {
    const parts: DefineTemplatePart[] = [];
    for (let index = start; index < end; index++) {
      const next = text.at(index + 1);
      if (
        text[index] === "\\" &&
        next !== undefined &&
        escapes !== "none" &&
        (escapes === "string" || next === "\\" || next === "!")
      ) {
        parts.push({ kind: "escape", start: index, end: index + 2, value: next });
        index++;
        continue;
      }
      if (text[index] !== "!") {
        continue;
      }
      if (next === "{") {
        let cursor = index + 2;
        let depth = 1;
        for (; cursor < end && depth > 0; cursor++) {
          if (text[cursor] === "{") {
            depth++;
          } else if (text[cursor] === "}") {
            depth--;
          }
        }
        if (depth !== 0) {
          parts.push({ kind: "error", start: index, end });
          break;
        }
        parts.push({
          kind: "define",
          start: index,
          end: cursor,
          name: text.slice(index + 2, cursor - 1),
          braced: true,
          children: parse(index + 2, cursor - 1),
        });
        index = cursor - 1;
      } else if (next && /\w/.test(next)) {
        let cursor = index + 2;
        while (cursor < end && /\w/.test(text[cursor])) {
          cursor++;
        }
        parts.push({
          kind: "define",
          start: index,
          end: cursor,
          name: text.slice(index + 1, cursor),
          braced: false,
          children: [],
        });
        index = cursor - 1;
      }
    }
    return parts;
  };
  return { text, parts: parse(0, text.length) };
}

/** Binding owns errors and lookup. Replacement output is not scanned again in the same phase. */
export function bindDefineTemplate(
  template: DefineTemplate,
  fragment: SourceFragment,
  resolve: (part: Extract<DefineTemplatePart, { kind: "define" }>) => SourceFragment,
  errorMessage = "Error: Mismatched braces in define name.",
): SourceFragment {
  return bindSourceFragment(
    fragment,
    template.parts.map((part) => {
      if (part.kind === "error") {
        throw new Error(errorMessage);
      }
      const value = part.kind === "escape" ? sourceFragment(part.value) : resolve(part);
      return { start: part.start, end: part.end, value };
    }),
  );
}
