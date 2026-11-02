import {
  sourceSpanToRange,
  shiftSourceSpan,
  type SourceRange,
  type SourceSpan,
} from "./source-location.js";

/** Physical source occurrence; lines and UTF-16 columns are zero-based. */
export type SourceOccurrence = {
  /** Absolute or virtual path identifying the source file. */
  readonly file: string;
  /** Zero-based physical line index in the file. */
  readonly line: number;
  /** Optional UTF-16 span when the occurrence is narrower than the whole line. */
  readonly span?: SourceSpan;
  /** When preprocessing trimmed a command, span offsets refer to this spelling. */
  readonly text?: string;
};

/** Relocate normalized offsets into a physical line only when the spelling has a unique match. */
export function sourceOccurrenceRange(
  location: SourceOccurrence,
  sourceLine?: string,
): SourceRange | undefined {
  if (!location.span) {
    return undefined;
  }
  if (location.text === undefined) {
    return sourceSpanToRange(location.span, location.line);
  }
  if (sourceLine === undefined) {
    return undefined;
  }
  const offset = sourceLine.indexOf(location.text);
  // Repeated inline statements cannot be disambiguated from spelling alone. A line-level link
  // is more honest than pointing at the first unrelated occurrence after an editor change.
  if (offset < 0 || sourceLine.lastIndexOf(location.text) !== offset) {
    return undefined;
  }
  return sourceSpanToRange(shiftSourceSpan(location.span, offset, location.line), location.line);
}

/** Argument spelling at the invocation, before binding defines or expanding the body. */
export type MacroArgumentOrigin = {
  /** Formal parameter name when the argument maps to a macro parameter. */
  readonly parameter?: string;
  /** Zero-based argument index at the macro invocation site. */
  readonly index: number;
  /** Raw argument spelling before define binding or expansion. */
  readonly text: string;
  /** Physical occurrence of the argument token in source. */
  readonly location: SourceOccurrence;
};

/** Persistent, acyclic expansion chain. Cached syntax never owns a live execution context. */
export type SourceOrigin =
  | {
      readonly kind: "include";
      readonly location: SourceOccurrence;
      readonly file: string;
      readonly parent?: SourceOrigin;
    }
  | {
      readonly kind: "macro";
      readonly name: string;
      readonly invocation: SourceOccurrence;
      readonly definition: SourceOccurrence;
      readonly template: SourceOccurrence;
      readonly arguments: readonly MacroArgumentOrigin[];
      /** Generated token runs identify all contributors after ordered substitution. */
      readonly fragment?: import("./ir/source-fragment.js").SourceFragment;
      /** Where the macro body was captured, independently of where it is invoked. */
      readonly definitionContext?: SourceOrigin;
      readonly parent?: SourceOrigin;
    };

/** Shared tooling projection; consumers need no macro parser to explain an expanded location. */
export function sourceOriginLocations(
  origin?: SourceOrigin,
): { message: string; location: SourceOccurrence }[] {
  const locations: { message: string; location: SourceOccurrence }[] = [];
  const visited = new Set<SourceOrigin>();
  const visit = (frame?: SourceOrigin): void => {
    if (!frame || visited.has(frame)) {
      return;
    }
    visited.add(frame);
    if (frame.kind === "include") {
      locations.push({ message: `Included '${frame.file}' here`, location: frame.location });
    } else {
      locations.push({ message: `Macro '${frame.name}' invoked here`, location: frame.invocation });
      locations.push({ message: `Macro '${frame.name}' defined here`, location: frame.definition });
      locations.push({ message: "Expanded from this template", location: frame.template });
      for (const argument of frame.arguments) {
        locations.push({
          message: `Argument ${argument.parameter ?? argument.index + 1}`,
          location: argument.location,
        });
      }
      visit(frame.definitionContext);
    }
    visit(frame.parent);
  };
  visit(origin);
  return locations;
}
