import type { AddressToLineMapping, InstructionSourceInfo } from "@uttori/asm-core";

import { cpu65816Specifications } from "../../architectures/65816-spec.js";
import type {
  SnesInstructionStateContract,
  SnesLayoutDiagnostic,
  SnesPlacementContract,
} from "./check.js";

/** The first support envelope proves leaf routines; stack-restored modes and callee effects need richer contracts. */
type WidthState = { readonly e: boolean; readonly m: boolean; readonly x: boolean };
/** Stack depth is relative to entry; negative depth would consume a caller's saved frame. */
type FlowState = WidthState & { readonly stackBytes: number };
const sameState = (a: WidthState, b: WidthState): boolean =>
  a.e === b.e && a.m === b.m && a.x === b.x;

/** Validate known flags before deriving instruction sizes or comparing control-flow joins. */
function knownState(state: Partial<WidthState> | undefined): state is WidthState {
  return (
    !!state &&
    [state.e, state.m, state.x].every((flag) => typeof flag === "boolean") &&
    !(state.e && (!state.m || !state.x))
  );
}

/**
 * Prove contiguous, single-entry 65816 leaf blocks from emitted bytes, not a declaration alone.
 * Internal branches/jumps and REP/SEP are supported. Every join and declared state must agree;
 * indirect transfers, calls, interrupts, stack-restored modes and external jumps fail closed.
 * Returned states are derived build facts, not additional Git authoring declarations.
 */
export function checkSnesCodeFlow(
  output: Uint8Array,
  mapping: AddressToLineMapping,
  contract: SnesPlacementContract,
  declared: readonly SnesInstructionStateContract[] = [],
): {
  readonly diagnostics: SnesLayoutDiagnostic[];
  readonly states: readonly SnesInstructionStateContract[];
} {
  const diagnostics: SnesLayoutDiagnostic[] = [];
  const states: SnesInstructionStateContract[] = [];
  const assumptions = new Map(declared.map((state) => [state.offset, state]));
  const fail = (message: string, instruction?: InstructionSourceInfo, offset?: number) => {
    diagnostics.push({
      code: "control-flow",
      message,
      offset: instruction?.outputOffset ?? offset,
      file: instruction && mapping.fileList[instruction.fileIdx]?.name,
      line: instruction?.line,
    });
  };
  for (const object of contract.objects.filter((item) => item.kind === "code")) {
    const before = diagnostics.length;
    const entry = assumptions.get(object.start);
    if (!object.closedControlFlow || !knownState(entry)) {
      fail(
        `${object.id}: closed code requires explicit, coherent E/M/X entry state.`,
        undefined,
        object.start,
      );
      continue;
    }
    if (object.returnInstruction !== "RTS" && object.returnInstruction !== "RTL") {
      fail(
        `${object.id}: declare RTS or RTL as the code return convention.`,
        undefined,
        object.start,
      );
      continue;
    }
    const exit = object.exitState ?? entry;
    if (!knownState(exit)) {
      fail(
        `${object.id}: exit state requires coherent boolean E/M/X flags.`,
        undefined,
        object.start,
      );
      continue;
    }
    const instructions = mapping.instructions
      .filter(
        (instruction) =>
          instruction.outputOffset !== undefined &&
          instruction.outputOffset >= object.start &&
          instruction.outputOffset < object.start + object.length,
      )
      .sort((a, b) => a.outputOffset! - b.outputOffset!);
    const byOffset = new Map<number, InstructionSourceInfo>();
    const byAddress = new Map<number, number>();
    let through = object.start;
    for (const instruction of instructions) {
      if (
        instruction.architecture !== "snes.65816" ||
        instruction.outputOffset !== through ||
        !Number.isSafeInteger(instruction.size) ||
        instruction.size! <= 0
      ) {
        fail(
          `${object.id}: code bytes must be owned by contiguous 65816 instructions. Split data and additional entry points into separate objects.`,
          instruction,
        );
        break;
      }
      byOffset.set(through, instruction);
      byAddress.set(instruction.address, through);
      through += instruction.size!;
    }
    if (through !== object.start + object.length) {
      fail(
        `${object.id}: the code extent contains unclassified bytes or crosses its boundary.`,
        undefined,
        through,
      );
    }
    for (const state of declared) {
      if (
        state.offset >= object.start &&
        state.offset < object.start + object.length &&
        !byOffset.has(state.offset)
      ) {
        fail(
          `${object.id}: a CPU-state assumption points inside an instruction or data.`,
          undefined,
          state.offset,
        );
      }
    }
    // An interior external entry bypasses the entry-state proof. Do not infer its calling convention.
    if (
      contract.references.some(
        (reference) => reference.target === object.id && (reference.addend ?? 0) !== 0,
      )
    ) {
      fail(
        `${object.id}: interior code entries require a separate entry contract.`,
        undefined,
        object.start,
      );
    }
    if (diagnostics.length !== before) {
      continue;
    }
    const reached = new Map<number, FlowState>();
    const queue: { offset: number; state: FlowState }[] = [
      { offset: object.start, state: { e: entry.e, m: entry.m, x: entry.x, stackBytes: 0 } },
    ];
    // Array iteration visits appended successors; each instruction expands only on its first visit.
    for (const { offset, state } of queue) {
      const instruction = byOffset.get(offset);
      if (!instruction) {
        fail(
          `${object.id}: control flow leaves its declared block or enters the middle of an instruction at $${offset.toString(16)}.`,
          undefined,
          offset,
        );
        continue;
      }
      const previous = reached.get(offset);
      if (previous) {
        if (!sameState(previous, state) || previous.stackBytes !== state.stackBytes) {
          fail(
            `${object.id}: control-flow paths disagree on E/M/X or stack depth at this instruction.`,
            instruction,
          );
        }
        continue;
      }
      reached.set(offset, state);
      const assumption = assumptions.get(offset);
      if (
        assumption &&
        ["e", "m", "x"].some((flag) => {
          const key = flag as keyof WidthState;
          return assumption[key] !== undefined && assumption[key] !== state[key];
        })
      ) {
        fail(
          `${object.id}: a declared CPU state contradicts the preceding control flow.`,
          instruction,
        );
      }
      const spec = cpu65816Specifications[output[offset]];
      const expectedSize = spec.minimumSize + (spec.widthFlag && !state[spec.widthFlag] ? 1 : 0);
      if (instruction.size !== expectedSize) {
        fail(
          `${object.id}: ${spec.mnemonic} emits ${instruction.size} bytes but propagated CPU state requires ${expectedSize}.`,
          instruction,
        );
        continue;
      }
      if (
        spec.flow.indirect ||
        ["call", "interrupt", "wait", "stop"].includes(spec.flow.kind) ||
        ["PLP", "XCE", "RTI", "PER", "TCS", "TXS", "PLB", "PLD", "TCD", "MVN", "MVP"].includes(
          spec.mnemonic,
        )
      ) {
        fail(
          `${object.id}: ${spec.mnemonic} requires an unsupported callee, indirect, stack or PC-relative state contract.`,
          instruction,
        );
        continue;
      }
      let next = state;
      if (spec.mnemonic === "REP" || spec.mnemonic === "SEP") {
        const mask = output[offset + 1];
        const enabled = spec.mnemonic === "SEP";
        next = {
          e: state.e,
          m: state.e || ((mask & 0x20) !== 0 ? enabled : state.m),
          x: state.e || ((mask & 0x10) !== 0 ? enabled : state.x),
          stackBytes: state.stackBytes,
        };
      }
      let stackDelta = 0;
      if (spec.mnemonic === "PHA" || spec.mnemonic === "PLA") {
        stackDelta = state.m ? 1 : 2;
      } else if (["PHX", "PHY", "PLX", "PLY"].includes(spec.mnemonic)) {
        stackDelta = state.x ? 1 : 2;
      } else if (["PHP", "PHB", "PHK"].includes(spec.mnemonic)) {
        stackDelta = 1;
      } else if (["PHD", "PEA", "PEI"].includes(spec.mnemonic)) {
        stackDelta = 2;
      }
      if (["PLA", "PLX", "PLY"].includes(spec.mnemonic)) {
        stackDelta = -stackDelta;
      }
      if (stackDelta !== 0) {
        next = { ...next, stackBytes: state.stackBytes + stackDelta };
        if (next.stackBytes < 0) {
          fail(`${object.id}: stack pull consumes the caller's saved frame.`, instruction);
          continue;
        }
      }
      if (spec.flow.kind === "return") {
        if (spec.mnemonic !== object.returnInstruction || next.stackBytes !== 0) {
          fail(
            `${object.id}: return violates its ${object.returnInstruction} convention or leaves an unbalanced stack.`,
            instruction,
          );
        }
        if (!sameState(next, exit)) {
          fail(
            `${object.id}: ${spec.mnemonic} does not satisfy the declared E/M/X exit state.`,
            instruction,
          );
        }
        continue;
      }
      if (spec.flow.kind === "jump" || spec.flow.kind === "conditionalBranch") {
        const value = output[offset + 1] + (expectedSize >= 3 ? output[offset + 2] * 256 : 0);
        let address: number;
        if (spec.mode === "relative" || spec.mode === "relativeLong") {
          const modulus = 2 ** (8 * (expectedSize - 1));
          const displacement = value >= modulus / 2 ? value - modulus : value;
          address =
            (instruction.address & 0xff0000) |
            ((instruction.address + expectedSize + displacement) & 0xffff);
        } else if (spec.mode === "absoluteLong") {
          address = value + output[offset + 3] * 65536;
        } else {
          address = (instruction.address & 0xff0000) | value;
        }
        const target = byAddress.get(address);
        if (target === undefined) {
          fail(
            `${object.id}: ${spec.mnemonic} target $${address.toString(16)} leaves the block or is not an instruction boundary.`,
            instruction,
          );
        } else {
          queue.push({ offset: target, state: next });
        }
      }
      if (spec.flow.fallthrough) {
        queue.push({ offset: offset + expectedSize, state: next });
      }
    }
    if (reached.size !== instructions.length) {
      fail(
        `${object.id}: not every declared instruction is reachable from its entry. Separate extra entries or embedded data.`,
        undefined,
        object.start,
      );
    }
    if (diagnostics.length === before) {
      // The entry assumption also carries its original offset; copy only flags to each new PC.
      states.push(
        ...[...reached].map(([offset, state]) => ({ offset, e: state.e, m: state.m, x: state.x })),
      );
    }
  }
  return { diagnostics, states };
}
