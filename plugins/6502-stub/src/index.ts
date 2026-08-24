import { classifyGenericOperand, definePlugin, PLUGIN_API_VERSION } from "@uttori/asm-core";
import type { AssemblerPlugin } from "@uttori/asm-core/plugin";

import { Arch6502 } from "./architecture.js";

export const MOS6502_STUB_TARGET_ID = "mos.6502-stub";

const plugin: AssemblerPlugin = definePlugin({
  manifest: {
    id: "uttori.asm-plugin-6502-stub",
    name: "Uttori ASM MOS 6502 Stub",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    description: "A deliberately nonfunctional plugin used to verify target isolation.",
  },
  activate(context) {
    context.registerArchitecture({
      id: "mos.6502",
      aliases: ["6502", "mos6502"],
      displayName: "MOS 6502 (stub)",
      unknownInstructionBehavior: "throw",
      splitOperands: (text) => (text ? [text] : []),
      classifyOperand: ({ operands }, operand) => {
        const raw = operand.trim();
        const { expanded, length } = operands.expandOperand(raw);
        return classifyGenericOperand({ raw, expanded, length });
      },
      createEncoder: (encoderContext) => new Arch6502(encoderContext),
      instructions: [],
    });
    context.registerAddressSpace({
      id: "mos.flat16",
      create: () => ({
        addressWidth: 16,
        defaultOrigin: 0,
        normalizeForWrite(address) {
          if (!Number.isInteger(address) || address < 0 || address > 0xffff) {
            throw new Error(`Address $${address.toString(16).toUpperCase()} is outside flat16.`);
          }
          return address;
        },
        advance(address, amount) {
          const next = address + amount;
          if (!Number.isInteger(next) || next < 0 || next > 0xffff) {
            throw new Error(`Address $${next.toString(16).toUpperCase()} is outside flat16.`);
          }
          return next;
        },
        toOutputOffset: (address) =>
          Number.isInteger(address) && address >= 0 && address <= 0xffff ? address : -1,
        fromOutputOffset: (offset) =>
          Number.isInteger(offset) && offset >= 0 && offset <= 0xffff ? offset : -1,
      }),
    });
    context.registerOutputFormat({
      id: "mos.raw",
      create: () => ({
        finalize: () => undefined,
        getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes),
      }),
    });
    context.registerTarget({
      id: MOS6502_STUB_TARGET_ID,
      aliases: ["6502-stub"],
      displayName: "MOS 6502 Stub",
      defaultArchitecture: "mos.6502",
      architectures: ["mos.6502"],
      addressSpace: "mos.flat16",
      outputFormat: "mos.raw",
      directiveSets: [],
      expressionSets: [],
      lifecycle: [],
      defaultOutputExtension: ".bin",
    });
  },
});

export default plugin;
export { Arch6502 } from "./architecture.js";
