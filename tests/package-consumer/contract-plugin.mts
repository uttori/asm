import { definePlugin, PLUGIN_API_VERSION } from "@uttori/asm-core/plugin";
import type { AssemblerPlugin, AssemblyStageName, SessionStateKey } from "@uttori/asm-core/plugin";

/** Initial byte emitted by each independent session. */
interface CounterOptions {
  start: number;
}

/** Observable lifecycle order for the installed-consumer assertions. */
export const events: string[] = [];

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
      splitOperands: () => [],
      classifyOperand: ({ operands }, operand) => operands.lowerOperand(operand),
      createEncoder: ({ emission, state }) => ({
        estimateSize: () => 1,
        encode: () => {
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
        onStageStart({ stage }) {
          const current: AssemblyStageName = stage;
          events.push(current);
        },
        onSessionDispose() {
          events.push("session-dispose");
        },
      }),
    });
    context.registerTarget({
      id: "consumer.target",
      displayName: "Counter target",
      defaultArchitecture: "consumer.cpu",
      architectures: ["consumer.cpu"],
      addressSpace: "consumer.flat",
      outputFormat: "consumer.raw",
      directiveSets: [],
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

export default plugin;
