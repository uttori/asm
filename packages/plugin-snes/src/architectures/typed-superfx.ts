import type {
  InstructionResolutionFrame,
  TypedArchitectureEncoder,
  TypedEncoderContext,
} from "@uttori/asm-core";

import { encodeSuperFxMoveShortAddress } from "../asar/compatibility.js";
import {
  chooseOperandPreparation,
  expandOperandPlan,
  generatedValue,
  preparedParts,
} from "./operand-values.js";
import {
  hasOwn,
  IMPLIED_OPCODES,
  PREFIXED_OPCODES,
  SHORT_BRANCH_OPCODES,
  REGISTER_OPS,
  IMMEDIATE_OPS,
  INDIRECT_OPS,
  type RegisterOpEncoding,
} from "./superfx-encodings.js";
import { superFxSyntax, type SuperFxOperand } from "./superfx-syntax.js";

/** A byte-addressed RAM window; only automatic MOVE applies the selected dialect's byte conversion. */
const shortRam = (value: number): boolean => (value & 1) === 0 && value < 0x200;
const signedByte = (value: number): boolean =>
  (value & 0xffff) < 0x80 || (value & 0xffff) >= 0xff80;

/** Native GSU instruction selection. Values are invocation-local and never stored on syntax nodes. */
export class TypedSuperFx implements TypedArchitectureEncoder {
  readonly deferOperandBindingErrors = true;
  constructor(readonly asarMoveShortAddress: () => boolean = () => false) {}

  prepare(frame: InstructionResolutionFrame): void {
    const syntax = superFxSyntax(frame.instruction.operands).superfx;
    // Implied forms have no numeric observations or preparation payload to copy.
    if (syntax.parts.length === 0) {
      frame.choose("superfx-preparation", 0);
      return;
    }
    const parts = syntax.parts.map((part) => expandOperandPlan(part.expansion, frame));
    if (parts.length !== 1 || !syntax.parts[0].expansion.native) {
      expandOperandPlan(syntax.whole, frame);
    }
    chooseOperandPreparation(frame, "superfx-preparation", parts);
  }
  estimate(frame: InstructionResolutionFrame): number {
    return this.run(frame);
  }
  encode(frame: InstructionResolutionFrame, context: TypedEncoderContext): boolean {
    return this.run(frame, context) > 0;
  }

  /** The same ordered form selection drives sizing and emission; speculative reads occur only for auto forms. */
  private run(frame: InstructionResolutionFrame, context?: TypedEncoderContext): number {
    const syntax = superFxSyntax(frame.instruction.operands).superfx;
    const { mnemonic: op, parts } = syntax;
    const emit = !!context;
    // Fixed forms need no numeric closures or temporary value arrays, which matters for generated code.
    if (hasOwn(IMPLIED_OPCODES, op) || hasOwn(PREFIXED_OPCODES, op)) {
      if (emit && parts.length !== 0) {
        throw frame.error(`${op} does not take operands`);
      }
      let size = 1,
        form = "implied";
      if (hasOwn(IMPLIED_OPCODES, op)) {
        context?.emission.write1(IMPLIED_OPCODES[op]);
      } else {
        context?.emission.write1(PREFIXED_OPCODES[op].prefix);
        context?.emission.write1(PREFIXED_OPCODES[op].opcode);
        size = 2;
        form = "prefixed";
      }
      frame.choose(form, size);
      return size;
    }
    const write = (value: number, width = 1) => {
      if (width === 2) {
        context?.emission.write2(value);
      } else {
        context?.emission.write1(value);
      }
    };
    const choose = (form: string, size: number) => {
      frame.choose(form, size);
      return size;
    };
    const range = (min: number, value: number, max: number) => {
      if (emit && (value < min || value > max)) {
        throw frame.error(`Register out of valid range ${min}-${max}: ${value}`);
      }
    };
    const read = (part: SuperFxOperand, branch = false): number => {
      if (part.expansion.unbound && frame.bindingFailure?.reason === "other") {
        throw new Error(frame.bindingFailure.message);
      }
      const index = parts.indexOf(part);
      const state = preparedParts(frame);
      const expansion = state?.[index];
      if (expansion?.generated) {
        // Generated negative/fractional values retain a layout placeholder until final emission.
        const value =
          frame.stageName !== "emitProgram" &&
          (expansion.value < 0 || !Number.isInteger(expansion.value))
            ? 0
            : generatedValue(expansion.value);
        frame.observe(
          part.scalar,
          value,
          emit ? "beforeOpcode" : "sizing",
          "$" + value.toString(16).toUpperCase(),
        );
        return value;
      }
      let scalar = part.scalar;
      let display = part.display;
      if (branch) {
        scalar = part.expansion.scalar;
        display = part.expansion.display;
      } else if (part.indirectRegister !== null) {
        scalar = {
          ...scalar,
          expression: { type: "identifier", name: "R" + part.indirectRegister },
        };
        display = "R" + part.indirectRegister;
      }
      try {
        return frame.evaluate(
          scalar,
          emit ? "beforeOpcode" : "sizing",
          false,
          branch ? "math" : "numeric",
          display,
        ).value;
      } catch (cause) {
        if (
          branch &&
          (part.indirect || scalar.expression.type === "relativeReference") &&
          frame.stageName !== "emitProgram"
        ) {
          return 0;
        }
        throw cause;
      }
    };
    const probe = (part: SuperFxOperand): number | undefined => {
      try {
        return read(part);
      } catch (cause) {
        if (emit) {
          throw cause;
        }
        return undefined;
      }
    };
    const registerOp = (encoding: RegisterOpEncoding, reg: number) => {
      range(encoding.min ?? 0, reg, encoding.max ?? 15);
      if (encoding.prefix !== undefined) {
        write(encoding.prefix);
      }
      write(encoding.base + reg);
      return choose("register", encoding.prefix === undefined ? 1 : 2);
    };
    const left = parts[0],
      right = parts[1];
    if (parts.length <= 1 && hasOwn(SHORT_BRANCH_OPCODES, op)) {
      if (emit && left) {
        const value = read(left, true);
        let offset = value;
        if (!left.rawOffset) {
          offset = value - (frame.currentAddress() & 0xffffff) - 2;
          if (frame.stageName === "emitProgram" && (offset < -128 || offset > 127)) {
            throw frame.error(`Branch target out of range (${offset})`);
          }
        }
        write(SHORT_BRANCH_OPCODES[op]);
        write(offset & 0xff);
      }
      if (!left && emit) {
        return choose("unknown", 0);
      }
      return choose("branch", 2);
    }
    if (parts.length <= 1) {
      if (left?.register !== null && left?.register !== undefined && hasOwn(REGISTER_OPS, op)) {
        return registerOp(REGISTER_OPS[op], left.register);
      }
      if (left?.immediate) {
        // Even unrecognized immediate mnemonics read their register field before rejection.
        const value = read(left);
        if (value >= 0 && value <= 15 && hasOwn(IMMEDIATE_OPS, op)) {
          return registerOp(IMMEDIATE_OPS[op], value);
        }
      }
      if (
        left?.indirectRegister !== null &&
        left?.indirectRegister !== undefined &&
        hasOwn(INDIRECT_OPS, op)
      ) {
        return registerOp(INDIRECT_OPS[op], left.indirectRegister);
      }
      return choose("unknown", emit ? 0 : 1);
    }
    if (parts.length !== 2) {
      return choose("unknown", emit ? 0 : 1);
    }
    const l = left.register,
      r = right.register,
      li = left.indirectRegister,
      ri = right.indirectRegister;
    if (l !== null && r !== null && (op === "MOVE" || op === "MOVES")) {
      if (op === "MOVE") {
        write(0x20 + r);
        write(0x10 + l);
      } else {
        write(0x20 + l);
        write(0xb0 + r);
      }
      return choose("register-pair", 2);
    }
    if (l !== null && right.immediate) {
      // Encoding historically reads this slot before checking its mnemonic. Sizing only probes MOVE.
      let value: number | undefined;
      if (emit || op === "MOVE") {
        value = probe(right);
      }
      if (op === "IBT" || op === "IWT" || op === "MOVE") {
        const short = op === "IBT" || (op === "MOVE" && value !== undefined && signedByte(value));
        const number = value ?? 0;
        write((short ? 0xa0 : 0xf0) + l);
        write(number & 0xff);
        if (!short) {
          write((number >> 8) & 0xff);
        }
        return choose(short ? "ibt" : "iwt", short ? 2 : 3);
      }
    }
    if ((li !== null && r !== null) || (l !== null && ri !== null)) {
      if (op === "MOVEB" || op === "MOVEW") {
        const store = li !== null;
        const data = store ? li : l!;
        const pointer = store ? r! : ri!;
        range(0, pointer, 11);
        if (data !== 0) {
          write((store ? 0xb0 : 0x10) + data);
        }
        if (op === "MOVEB") {
          write(0x3d);
        }
        write((store ? 0x30 : 0x40) + pointer);
        return choose("register-memory", (data === 0 ? 0 : 1) + (op === "MOVEB" ? 2 : 1));
      }
    }
    const store = r !== null && li === null && left.indirect;
    if (l !== null || store) {
      const operand = l !== null ? right : left;
      const reg = l ?? r!;
      let value: number | undefined;
      if (emit || op === "MOVE") {
        value = probe(operand);
      }
      const load = l !== null;
      const longOp = load ? "LM" : "SM",
        shortOp = load ? "LMS" : "SMS";
      if (op === longOp || op === shortOp || op === "MOVE" || (load && op === "LEA")) {
        const number = value ?? 0;
        const short = op === shortOp || (op === "MOVE" && value !== undefined && shortRam(value));
        if (emit && op === shortOp && (number % 2 !== 0 || number < 0 || number > 0x1fe)) {
          throw frame.error(`Invalid short address ${number}. Must be even and in range 0..0x1FE`);
        }
        if (op !== "LEA") {
          write(load ? 0x3d : 0x3e);
        }
        write((short ? 0xa0 : 0xf0) + reg);
        if (short) {
          let byte = number >> 1;
          if (op === "MOVE") {
            byte = encodeSuperFxMoveShortAddress(
              number,
              this.asarMoveShortAddress() ? "asar" : "hardware",
            );
          }
          write(byte);
        } else {
          write(number, 2);
        }
        let size = short ? 3 : 4;
        if (op === "LEA") {
          size = 3;
        }
        return choose(short ? "ram-short" : "ram-long", size);
      }
    }
    return choose("unknown", emit ? 0 : 1);
  }
}
