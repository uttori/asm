import {
  parseDirectiveExpression,
  syntaxArray,
  syntaxBoolean,
  syntaxExpression,
  syntaxLiteral,
  syntaxNumber,
  syntaxOptional,
  syntaxRecord,
  syntaxString,
  syntaxUnion,
  type SyntaxParseInput,
} from "@uttori/asm-core/plugin";

import { parseSpcBlock, parseEndSpcBlock } from "../services/spc-runtime.js";
import { resolveSnesCpuName } from "./cpu-name.js";

/** Builds a syntax literal guard for a fixed directive operation keyword. */
const op = <const T extends string>(name: T) => syntaxLiteral(name);
/** Typed union of every lowered SNES directive payload shape. */
export const snesDirectiveSchema = syntaxUnion(
  syntaxRecord({
    operation: op("mapper"),
    mapper: syntaxString,
    banks: syntaxOptional(syntaxArray(syntaxNumber)),
    error: syntaxOptional(syntaxString),
  }),
  syntaxRecord({ operation: op("optimize"), enabled: syntaxOptional(syntaxBoolean) }),
  syntaxRecord({ operation: op("noop") }),
  syntaxRecord({
    operation: op("width"),
    register: syntaxUnion(syntaxLiteral("accumulator"), syntaxLiteral("index")),
    wide: syntaxBoolean,
  }),
  syntaxRecord({ operation: op("smart"), enabled: syntaxBoolean }),
  syntaxRecord({ operation: op("cpu"), architecture: syntaxString, alias: syntaxString }),
  syntaxRecord({ operation: syntaxUnion(op("pushcpu"), op("popcpu")) }),
  syntaxRecord({ operation: op("freespace"), keyword: syntaxString }),
  syntaxRecord({ operation: op("freespacebyte"), expression: syntaxExpression }),
  syntaxRecord({ operation: op("prot"), labels: syntaxArray(syntaxString) }),
  syntaxRecord({
    operation: op("spcblock"),
    block: syntaxRecord({
      destination: syntaxExpression,
      destinationText: syntaxString,
      modeError: syntaxOptional(syntaxString),
    }),
  }),
  syntaxRecord({
    operation: op("endspcblock"),
    block: syntaxRecord({
      execute: syntaxOptional(syntaxExpression),
      error: syntaxOptional(syntaxString),
    }),
  }),
  syntaxRecord({
    operation: op("startpos"),
    expression: syntaxOptional(syntaxExpression),
    error: syntaxOptional(syntaxString),
  }),
);
/** Infers the validated payload type from a syntax guard union. */
type ExtractGuard<G> = G extends ((value: unknown) => value is infer T) ? T : never;
/** Parsed SNES directive payload accepted by the execution handlers. */
type Payload = ExtractGuard<typeof snesDirectiveSchema>;

/** Select a target operation without invoking mapping, CPU changes, file reads or expression functions. */
export function parseSnesDirective(
  id: string,
  { words }: Pick<SyntaxParseInput, "words">,
): Payload {
  const family = id.slice("snes.directive.".length);
  const keyword = words[0].toLowerCase();
  switch (family) {
    case "mapper": {
      const mapper = keyword === "fullsa1rom" ? "bigsa1rom" : keyword;
      if (mapper !== "sa1rom") {
        return { operation: "mapper", mapper, banks: undefined, error: undefined };
      }
      const parts = words.length > 1 ? words[1].split(",") : ["0", "1", "2", "3"];
      const error =
        parts.length !== 4
          ? "Invalid SA1ROM mapper specification. Expected 4 comma-separated values."
          : undefined;
      return {
        operation: "mapper",
        mapper,
        banks: parts.map((part) => parseInt(part, 10) << 20),
        error,
      };
    }
    case "optimize": {
      let enabled: boolean | undefined;
      if (words.length >= 3 && words[1].toLowerCase() === "dp") {
        const mode = words[2].toLowerCase();
        if (mode === "none") {
          enabled = false;
        } else if (mode === "ram" || mode === "always") {
          enabled = true;
        }
      }
      return { operation: "optimize", enabled };
    }
    case "asar-noops":
      return { operation: "noop" };
    case "ca65.a8":
      return { operation: "width", register: "accumulator", wide: false };
    case "ca65.a16":
      return { operation: "width", register: "accumulator", wide: true };
    case "ca65.i8":
      return { operation: "width", register: "index", wide: false };
    case "ca65.i16":
      return { operation: "width", register: "index", wide: true };
    case "ca65.accu":
    case "ca65.index": {
      const width = words.at(1)?.trim();
      if (width !== "8" && width !== "16") {
        throw new Error(`${keyword} requires an argument of 8 or 16, got: ${width ?? "<none>"}`);
      }
      return {
        operation: "width",
        register: family === "ca65.accu" ? "accumulator" : "index",
        wide: width === "16",
      };
    }
    case "ca65.smart":
      return { operation: "smart", enabled: words[1]?.trim().toLowerCase() !== "off" };
    case "ca65.setcpu": {
      if (!words[1]) {
        throw new Error(".setcpu requires a CPU name argument.");
      }
      const name = words[1].trim().replace(/^["']|["']$/g, "");
      const architecture = resolveSnesCpuName(name);
      if (!architecture) {
        throw new Error(
          `.setcpu "${name}" is not available on the SNES target. Supported names: 65816, 65C816, 65802, spc700, superfx.`,
        );
      }
      return { operation: "cpu", architecture, alias: name.toLowerCase() };
    }
    case "ca65.pushcpu":
      return { operation: "pushcpu" };
    case "ca65.popcpu":
      return { operation: "popcpu" };
    case "freespace":
      return { operation: "freespace", keyword };
    case "freespacebyte":
      if (words.length !== 2) {
        throw new Error("FREESPACEBYTE requires exactly one parameter.");
      }
      return { operation: "freespacebyte", expression: parseDirectiveExpression(words[1]) };
    case "prot":
      return {
        operation: "prot",
        labels: words
          .slice(1)
          .join(" ")
          .split(",")
          .map((label) => label.trim())
          .filter(Boolean),
      };
    case "spcblock": {
      const block = parseSpcBlock(words);
      return { operation: "spcblock", block: { ...block, modeError: block.modeError } };
    }
    case "endspcblock": {
      const block = parseEndSpcBlock(words);
      return { operation: "endspcblock", block: { execute: block.execute, error: block.error } };
    }
    case "startpos":
      return {
        operation: "startpos",
        expression: words.length === 2 ? parseDirectiveExpression(words[1]) : undefined,
        error: words.length === 2 ? undefined : "startpos requires exactly one parameter.",
      };
    default:
      throw new Error(`Missing typed SNES directive grammar '${id}'.`);
  }
}
