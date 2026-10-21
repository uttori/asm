import {
  parseDataList,
  parseDirectiveExpression,
  unquoteDirectiveText,
  syntaxArray,
  syntaxBoolean,
  syntaxCodec,
  syntaxExpression,
  syntaxLiteral,
  syntaxOptional,
  syntaxRecord,
  syntaxString,
  syntaxUnion,
  type DirectiveFactoryContext,
  type DirectiveSyntaxContribution,
  type SyntaxParseInput,
} from "@uttori/asm-core/plugin";

import {
  ca65CpuNames,
  ca65CpuShorthands,
  ca65SessionStateKey,
  resolve65xxCpuName,
} from "../ca65-profile.js";
import { nes65xxSessionStateKey } from "../session-state.js";
import { NES_65XX_TARGET_ID } from "../target/nes.js";
import {
  closeActiveSegment,
  handleEndScope,
  handlePopcpu,
  handlePopseg,
  handlePushcpu,
  handlePushseg,
  markGlobalSymbol,
  openSegment,
  parameterList,
} from "./ca65.js";

const operation = <const T extends string>(name: T) => syntaxLiteral(name);
const schema = syntaxUnion(
  syntaxRecord({ operation: operation("segment"), name: syntaxString }),
  syntaxRecord({ operation: operation("cpu"), name: syntaxString, architecture: syntaxString }),
  syntaxRecord({ operation: operation("symbols"), names: syntaxArray(syntaxString) }),
  syntaxRecord({
    operation: operation("data"),
    width: syntaxUnion(syntaxLiteral(1), syntaxLiteral(2), syntaxLiteral(3), syntaxLiteral(4)),
    operands: syntaxArray(syntaxRecord({ text: syntaxString, expression: syntaxExpression })),
  }),
  syntaxRecord({
    operation: operation("mapped"),
    mode: syntaxUnion(syntaxLiteral("low"), syntaxLiteral("high"), syntaxLiteral("big")),
    values: syntaxArray(syntaxExpression),
  }),
  syntaxRecord({
    operation: syntaxUnion(operation("reserve"), operation("align")),
    count: syntaxExpression,
    fill: syntaxOptional(syntaxExpression),
  }),
  syntaxRecord({
    operation: operation("binary"),
    filename: syntaxString,
    offset: syntaxOptional(syntaxExpression),
    size: syntaxOptional(syntaxExpression),
  }),
  syntaxRecord({
    operation: operation("assert"),
    condition: syntaxExpression,
    message: syntaxString,
  }),
  syntaxRecord({
    operation: operation("scope"),
    name: syntaxOptional(syntaxString),
    procedure: syntaxBoolean,
  }),
  syntaxRecord({
    operation: syntaxUnion(
      operation("pushcpu"),
      operation("popcpu"),
      operation("pushseg"),
      operation("popseg"),
      operation("endscope"),
    ),
  }),
  syntaxRecord({ operation: operation("error"), message: syntaxString }),
);
type Payload = ExtractGuard<typeof schema>;
type ExtractGuard<G> = G extends ((value: unknown) => value is infer T) ? T : never;

/** Parsing depends only on the selected contribution and lexical source, never on CPU/segment state. */
function parse(id: string, { words }: SyntaxParseInput): Payload {
  const keyword = (words[0] ?? "").replace(/^\./, "").toLowerCase();
  const family = id.slice("65xx.directive.".length);
  if (
    family === "pushcpu" ||
    family === "popcpu" ||
    family === "pushseg" ||
    family === "popseg" ||
    family === "endscope"
  ) {
    return { operation: family };
  }
  if (family === "segment") {
    const name = unquoteDirectiveText(words[1] ?? "").trim();
    if (!name) {
      throw new Error(".segment requires a segment name.");
    }
    return { operation: "segment", name };
  }
  if (family === "setcpu" || family === "cpu-shorthand") {
    const name =
      family === "setcpu"
        ? unquoteDirectiveText(words.slice(1).join(" ").trim())
        : ca65CpuShorthands[keyword];
    if (!name) {
      throw new Error(".setcpu requires a CPU name argument.");
    }
    const architecture = resolve65xxCpuName(name);
    if (!architecture) {
      throw new Error(
        `.setcpu "${name}" is not a supported 65xx CPU. Supported names: ${Object.keys(ca65CpuNames).join(", ")}.`,
      );
    }
    return { operation: "cpu", name: name.toLowerCase(), architecture };
  }
  if (family === "scope") {
    return {
      operation: "scope",
      name: words[1]?.trim() || undefined,
      procedure: keyword === "proc",
    };
  }
  if (family === "unsupported-object") {
    return {
      operation: "error",
      message: `.${keyword} requires relocatable ca65 object/linker semantics, which the flat-image compatibility profile does not implement.`,
    };
  }
  if (family === "unsupported-macro") {
    return {
      operation: "error",
      message: `.${keyword} is not yet supported by the ca65 macro compatibility slice.`,
    };
  }
  if (family === "byte" || family === "addr" || family === "dword" || family === "faraddr") {
    const widths = { byte: 1, addr: 2, dword: 4, faraddr: 3 } as const;
    const width = widths[family];
    const operands = parseDataList(words.slice(1).join(" "));
    if (!operands.length) {
      throw new Error(
        `${["", "DB", "DW", "DL", "DD"][width]} directive requires at least one parameter.`,
      );
    }
    return { operation: "data", width, operands };
  }
  const params = parameterList(words);
  if (family === "export" || family === "import") {
    const names = params.map((value) => unquoteDirectiveText(value).trim()).filter(Boolean);
    if (!names.length) {
      throw new Error(`.${family} requires at least one identifier.`);
    }
    return { operation: "symbols", names };
  }
  if (family === "lobytes" || family === "hibytes" || family === "dbyt") {
    if (!params.length) {
      throw new Error(`${words[0]} requires at least one parameter.`);
    }
    let mode: "low" | "high" | "big" = "low";
    if (family === "hibytes") {
      mode = "high";
    } else if (family === "dbyt") {
      mode = "big";
    }
    return {
      operation: "mapped",
      mode,
      values: params.map((value) => parseDirectiveExpression(value)),
    };
  }
  if (family === "res" || family === "align") {
    if (params.length < 1 || params.length > 2) {
      throw new Error(
        family === "res"
          ? ".res expects count and an optional fill value."
          : ".align expects a boundary and optional fill value.",
      );
    }
    return {
      operation: family === "res" ? "reserve" : "align",
      count: parseDirectiveExpression(params[0]),
      fill: params[1] ? parseDirectiveExpression(params[1]) : undefined,
    };
  }
  if (family === "incbin") {
    if (params.length < 1 || params.length > 3) {
      throw new Error(".incbin expects a filename, optional offset, and optional size.");
    }
    return {
      operation: "binary",
      filename: unquoteDirectiveText(params[0]),
      offset: params[1] ? parseDirectiveExpression(params[1]) : undefined,
      size: params[2] ? parseDirectiveExpression(params[2]) : undefined,
    };
  }
  if (family === "assert") {
    if (!params.length) {
      throw new Error(".assert requires an expression.");
    }
    const message = params.find((part) => /^["']/.test(part));
    return {
      operation: "assert",
      condition: parseDirectiveExpression(params[0], false),
      message: message ? unquoteDirectiveText(message) : ".assert expression evaluated to false.",
    };
  }
  throw new Error(`Missing typed ca65 directive grammar '${id}'.`);
}

/** Each execution refreshes live scope, cursor and CPU state; syntax never stores resolved values. */
function execute(node: Payload, { session, state, targetId }: DirectiveFactoryContext): void {
  const profile = state.get(ca65SessionStateKey);
  switch (node.operation) {
    case "error":
      throw new Error(node.message);
    case "pushcpu":
      return handlePushcpu(session, profile);
    case "popcpu":
      return handlePopcpu(session, profile);
    case "pushseg":
      return handlePushseg(profile);
    case "popseg":
      return handlePopseg(profile);
    case "endscope":
      return handleEndScope(session, profile);
    case "cpu":
      session.selectArchitecture(node.architecture, node.name);
      profile.currentArchitecture = node.architecture;
      return;
    case "segment": {
      if (targetId !== NES_65XX_TARGET_ID) {
        profile.currentFlatSegment = node.name;
        return;
      }
      const nes = state.get(nes65xxSessionStateKey);
      const segment = nes.linker.segments.get(node.name);
      if (!segment) {
        throw new Error(`.segment "${node.name}" is not defined in the linker configuration.`);
      }
      closeActiveSegment(session, nes);
      openSegment(session, nes, segment);
      return;
    }
    case "scope": {
      const name = node.name ?? `__anonymous_scope_${session.currentLine}`;
      if (node.procedure) {
        session.symbolScope.setLabel(session.symbolScope.qualifySymbolName(name));
      }
      profile.scopeStack.push(session.currentNamespace);
      session.currentNamespace = session.currentNamespace
        ? `${session.currentNamespace}_${name}`
        : name;
      return;
    }
    case "symbols":
      for (const name of node.names) {
        markGlobalSymbol(session, name);
      }
      return;
    case "data":
      session.directiveRuntime.executeDataStatement(node);
      return;
    case "mapped":
      if (session.isDefinitionCollectionStage) {
        session.step(node.values.length * (node.mode === "big" ? 2 : 1));
        return;
      }
      for (const expression of node.values) {
        const value = session.operandResolver.getnum(expression);
        if (node.mode !== "low") {
          session.write1((value >> 8) & 0xff);
        }
        if (node.mode !== "high") {
          session.write1(value & 0xff);
        }
      }
      return;
    case "reserve":
    case "align": {
      const value = session.operandResolver.getnum(node.count);
      const fill = node.fill ? session.operandResolver.getnum(node.fill) : 0;
      if (!Number.isInteger(value) || value < (node.operation === "align" ? 1 : 0)) {
        throw new Error(
          node.operation === "align"
            ? ".align boundary must be a positive integer."
            : ".res count must be non-negative.",
        );
      }
      const count =
        node.operation === "reserve"
          ? value
          : (value - (session.currentTargetAddress % value)) % value;
      if (session.isDefinitionCollectionStage) {
        session.step(count);
        return;
      }
      for (let index = 0; index < count; index++) {
        session.write1(fill & 0xff);
      }
      return;
    }
    case "binary": {
      const data = session.includeSource.readFile(node.filename);
      if (!(data instanceof Uint8Array)) {
        throw new Error(`Failed to read binary include: ${node.filename}`);
      }
      const offset = node.offset ? session.operandResolver.getnum(node.offset) : 0;
      const size = node.size ? session.operandResolver.getnum(node.size) : data.length - offset;
      if (
        !Number.isInteger(offset) ||
        !Number.isInteger(size) ||
        offset < 0 ||
        size < 0 ||
        offset + size > data.length
      ) {
        throw new Error(
          `.incbin range ${offset}+${size} is outside '${node.filename}' (${data.length} bytes).`,
        );
      }
      if (session.isDefinitionCollectionStage) {
        session.step(size);
        return;
      }
      for (const byte of data.subarray(offset, offset + size)) {
        session.write1(byte);
      }
      return;
    }
    case "assert":
      if (session.evaluateAssertion(node.condition) === false) {
        throw new Error(node.message);
      }
      return;
  }
}

/** Optional overrides retain core ownership when the selected source style is Asar. */
export function ca65DirectiveSyntax(id: string): DirectiveSyntaxContribution {
  const codec = syntaxCodec("1", (input) => parse(id, input), schema);
  return {
    ...codec,
    bind(context) {
      if (
        (id === "65xx.directive.incbin" || id === "65xx.directive.assert") &&
        context.session.targetOptions.sourceStyle === "asar"
      ) {
        return undefined;
      }
      return { execute: (payload) => execute(codec.read(payload), context) };
    },
  };
}
