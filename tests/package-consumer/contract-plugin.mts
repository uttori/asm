import { parseExpressionNode } from "@uttori/asm-core";
import { definePlugin, PLUGIN_API_VERSION } from "@uttori/asm-core/plugin";
import type {
  AssemblerPlugin,
  AssemblyStageName,
  SessionStateKey,
  PluginSessionCapabilities,
} from "@uttori/asm-core/plugin";

/** Initial byte emitted by each independent session. */
interface CounterOptions {
  start: number;
}

/** Observable lifecycle order for the installed-consumer assertions. */
export const events: string[] = [];
export let sawMacroOrigin = false;
let borrowed: PluginSessionCapabilities | undefined;
/** Deliberately retain a borrow to verify it cannot escape its synchronous callback. */
export function escapedCapability(): number {
  if (!borrowed) {
    throw new Error("No capability borrowed");
  }
  return borrowed.currentLine;
}

/** This no-argument directive owns one constant syntax tree; it is never a resolved stage value. */
const markerExpression = parseExpressionNode("2*(3+4)");

const plugin: AssemblerPlugin<CounterOptions> = definePlugin({
  manifest: {
    id: "consumer.counter",
    name: "Counter",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
  },
  validateOptions(configured) {
    let start = 1;
    if (typeof configured === "object" && configured !== null && "start" in configured) {
      start = Number(configured.start);
    }
    if (!Number.isInteger(start) || start < 0 || start > 254) {
      throw new Error("start must be 0..254");
    }
    return { start };
  },
  activate(context) {
    const counter: SessionStateKey<{ next: number }> = context.registerSessionState({
      id: "consumer.counter-state",
      create: () => ({ next: context.options.start }),
      clone: (value) => ({ ...value }),
      resetForStage: (value) => {
        value.next = context.options.start;
      },
      dispose: () => {
        events.push("state-dispose");
      },
    });
    context.registerArchitecture({
      id: "consumer.cpu",
      displayName: "Counter CPU",
      unknownInstructionBehavior: "throw",
      operandGrammar: { version: "1", parse: () => ({ operands: [] }) },
      createTypedEncoder: ({ state }) => ({
        estimate: (frame) => {
          frame.choose("fixture", 1);
          return 1;
        },
        encode: (frame, { emission }) => {
          frame.choose("fixture", 1);
          emission.writeByte(state.get(counter).next++);
          return true;
        },
      }),
      instructions: [],
    });
    context.registerAddressSpace({
      id: "consumer.flat",
      create: () => ({
        addressWidth: 16,
        defaultOrigin: 0,
        normalizeForWrite: (address) => address,
        advance: (address, amount) => address + amount,
        toOutputOffset: (address) => address,
        fromOutputOffset: (offset) => offset,
      }),
    });
    context.registerOutputFormat({
      id: "consumer.raw",
      create: () => ({
        finalize: () => undefined,
        getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes),
      }),
    });
    context.registerLifecycle({
      id: "consumer.lifecycle",
      create: () => ({
        beforeDirective(occurrence) {
          if ("words" in occurrence || "raw" in occurrence) {
            throw new Error("Legacy directive execution input escaped");
          }
          if (occurrence.keyword === "mark" && occurrence.syntax?.kind !== "plugin") {
            throw new Error("Missing typed middleware syntax");
          }
          return "continue";
        },
        onStageStart({ stage }) {
          const current: AssemblyStageName = stage;
          events.push(current);
        },
        onSessionDispose() {
          events.push("session-dispose");
        },
      }),
    });
    context.registerDirectiveSet({
      id: "consumer.directives",
      directives: [
        {
          id: "consumer.typedmark",
          keywords: ["typedmark"],
          phase: "lowered",
          tooling: [],
          syntax: {
            version: "1",
            parse({ words }) {
              if (words.length !== 2 || !/^\d+$/.test(words[1])) {
                throw new Error("typedmark expects one decimal literal");
              }
              return { literal: words[1] };
            },
            validate(payload) {
              return (
                !!payload &&
                typeof payload === "object" &&
                !Array.isArray(payload) &&
                "literal" in payload &&
                typeof payload.literal === "string" &&
                /^\d+$/.test(payload.literal)
              );
            },
            bind({ session }) {
              return {
                execute(payload, { command }) {
                  if ("words" in command || "parsed" in command) {
                    throw new Error("Execution received a command parser view");
                  }
                  if (!payload || typeof payload !== "object" || !("literal" in payload)) {
                    throw new Error("Missing typed payload");
                  }
                  session.write1(Number(payload.literal));
                  // Execution owns its snapshots; mutation must not corrupt the next stage or invocation.
                  Object.assign(payload, { literal: "99" });
                  command.keyword = "changed";
                },
              };
            },
          },
        },
        {
          id: "consumer.mark",
          keywords: ["mark"],
          tooling: [
            {
              keyword: "mark",
              summary: "Check the borrowed session capability.",
              syntax: "mark",
              group: "data",
            },
          ],
          phase: "lowered",
          syntax: {
            version: "1",
            parse: () => null,
            validate: (payload) => payload === null,
            bind: ({ session }) => {
              borrowed = session;
              if ("assembleSource" in session || "services" in session || "dispose" in session) {
                throw new Error("Host session escaped into plugin API");
              }
              return {
                execute: (_payload, { command }) => {
                  void session.currentLine;
                  sawMacroOrigin ||= command.source.origin?.kind === "macro";
                  if (command.keyword !== "mark") {
                    throw new Error("Missing directive syntax snapshot");
                  }
                  const parsed = { expression: structuredClone(markerExpression) };
                  if (session.operandResolver.getnum(parsed.expression) !== 14) {
                    throw new Error("Typed directive operand did not evaluate");
                  }
                  // Source metadata and the expression copy belong to this callback.
                  command.keyword = "changed";
                  parsed.expression.type = "raw";
                  const fresh = structuredClone(markerExpression);
                  if (session.operandResolver.getnum(fresh) !== 14) {
                    throw new Error("Plugin mutation escaped its owned syntax copy");
                  }
                },
              };
            },
          },
        },
      ],
    });
    context.registerTarget({
      id: "consumer.target",
      displayName: "Counter target",
      defaultArchitecture: "consumer.cpu",
      architectures: ["consumer.cpu"],
      addressSpace: "consumer.flat",
      outputFormat: "consumer.raw",
      directiveSets: ["consumer.directives"],
      expressionSets: [],
      lifecycle: ["consumer.lifecycle"],
      defaultOutputExtension: ".bin",
    });
    return {
      dispose() {
        events.push("plugin-dispose");
      },
    };
  },
});

/** A retained nested method must enforce the same synchronous lifetime as direct capabilities. */
export function escapedParsedOperand(): unknown {
  if (!borrowed) {
    throw new Error("No capability borrowed");
  }
  return borrowed.operandResolver.getnum({ type: "literal", value: "1" });
}

export default plugin;
