import {
  RelocatableInstruction,
  linkConstant,
  linkBinary,
  isReferenceExpressionNode,
  type InstructionResolutionFrame,
  type TypedArchitectureEncoder,
  type TypedEncoderContext,
} from "@uttori/asm-core";

import { classify65816, prepare65816, read65816, prepared65816 } from "./65816-resolution.js";
import { cpu65816Modes, cpu65816Specifications } from "./65816-spec.js";
import { syntax65816 } from "./65816-syntax.js";

/** Opcode data is shared with decoding; selection and expression timing remain encoder-owned. */
const encodings = new Map<string, Map<string, number>>();
for (const spec of cpu65816Specifications) {
  const modes = encodings.get(spec.mnemonic) ?? new Map<string, number>();
  modes.set(spec.mode, spec.opcode[0]);
  encodings.set(spec.mnemonic, modes);
}
/** Signature opcodes whose second byte is not selected from the mode matrix. */
const generic: Readonly<Record<string, number>> = {
  BRK: 0,
  COP: 2,
  PEA: 0xf4,
  PEI: 0xd4,
  REP: 0xc2,
  SEP: 0xe2,
  WDM: 0x42,
};
/** True when `op` appears as a whitespace-separated token in `values`. */
const family = (op: string, values: string): boolean => values.split(" ").includes(op);
/** Resolves a mode map key to its stable mode id string. */
const modeId = (key: string): string =>
  (cpu65816Modes as Record<string, { id: string } | undefined>)[key]?.id ?? key;

/** 65816 flags belong to this encoder instance and reset once per assembly pass. */
export class Typed65816 implements TypedArchitectureEncoder {
  /** Relocatable object emission covers the shared 65816 opcode matrix. */
  readonly supportsRelocatable = true;
  /** Operand binding failures surface at the final read, not during width collection. */
  readonly deferOperandBindingErrors = true;
  /** True selects 16-bit expression immediates; lexical widths can override this hint. */
  m16 = false;
  /** X/Y immediate-width hint, independent of the accumulator. */
  x16 = false;
  /** SEP/REP update hints only while smart tracking is enabled. */
  smartMode = true;
  /**
   * Creates a 65816 encoder with optional direct-page width optimization.
   * @param optimizeDirectPage When true, same-bank labels may encode as DP addresses.
   */
  constructor(readonly optimizeDirectPage: () => boolean = () => false) {}
  /** Clears M/X width hints at the start of each assembly pass. */
  beginPass(): void {
    this.m16 = false;
    this.x16 = false;
  }
  /**
   * Sets the accumulator immediate-width hint used when expressions follow M flag state.
   * @param value True selects 16-bit accumulator immediates.
   */
  setAccumulatorWidth(value: boolean): void {
    this.m16 = value;
  }
  /**
   * Sets the index immediate-width hint used when expressions follow X flag state.
   * @param value True selects 16-bit index immediates.
   */
  setIndexWidth(value: boolean): void {
    this.x16 = value;
  }
  /**
   * Enables or disables REP/SEP smart tracking of M and X flag hints.
   * @param value When false, width hints ignore SEP/REP operands.
   */
  setSmartMode(value: boolean): void {
    this.smartMode = value;
  }
  /**
   * Stores the classified operand tuple for reuse during encoding.
   * @param frame Active resolution frame for the occurrence.
   */
  prepare(frame: InstructionResolutionFrame): void {
    if (frame.isRelocatable) {
      frame.choose("65816-module-preparation", 0);
      return;
    }
    const r = prepare65816(syntax65816(frame.instruction.operands), frame);
    // The tuple is occurrence-owned. Its scalar expression is already retained by parsed syntax.
    frame.chooseScalars(
      "65816-preparation",
      0,
      r.length,
      r.value,
      r.generated,
      r.flattened,
      r.mode,
      r.hexDigits,
      r.explicitDp,
    );
  }
  /**
   * Returns the byte size chosen for the current instruction form.
   * @param frame Active resolution frame for the occurrence.
   * @returns Encoded instruction length in bytes, or `-1` when unrecognized.
   */
  estimate(frame: InstructionResolutionFrame): number {
    return this.run(frame);
  }
  /**
   * Emits opcode bytes when `context` is supplied; otherwise sizes only.
   * @param frame Active resolution frame for the occurrence.
   * @param context Emission sink and diagnostics for the emit pass.
   * @returns True when a recognized form produced bytes.
   */
  encode(frame: InstructionResolutionFrame, context: TypedEncoderContext): boolean {
    return this.run(frame, context) >= 0;
  }
  /** Shared selection preserves the distinct numeric-read positions of each hardware family. */
  private run(frame: InstructionResolutionFrame, context?: TypedEncoderContext): number {
    if (frame.isRelocatable) {
      return this.runModule(frame, context);
    }
    return this.runAbsolute(frame, context);
  }

  /** Existing numeric selection remains shared with explicit Asar source adaptation. */
  private runAbsolute(frame: InstructionResolutionFrame, context?: TypedEncoderContext): number {
    const syntax = syntax65816(frame.instruction.operands),
      p = syntax.cpu65816,
      op = p.mnemonic,
      emit = !!context;
    if (p.suffixError) {
      throw new Error(p.suffixError);
    }
    // Object preparation intentionally carries no numeric tuple. Compatibility selection
    // observes its authored-address preview in this invocation instead of decoding that marker.
    let r = frame.isRelocatable ? undefined : prepared65816(frame, p.scalar);
    r ??= prepare65816(syntax, frame);
    r = { ...r, scalar: p.scalar };
    const initial = r;
    const forced = p.width !== undefined,
      len = p.width ?? r.length;
    const memory = family(op, "ADC LDA SBC STA"),
      logic = family(op, "AND ORA EOR CMP CPX CPY"),
      shift = family(op, "ASL LSR ROL ROR INC DEC"),
      load = op === "LDX" || op === "LDY",
      store = family(op, "STX STY STZ"),
      bit = family(op, "BIT TSB TRB"),
      jump = family(op, "JMP JSR JML JSL");
    const table = encodings.get(op);
    const opcode = (mode: string): number | undefined => table?.get(modeId(mode));
    const write = (value: number | undefined, width = 1): void => {
      if (width === 1) {
        context?.emission.write1(value!);
      } else if (width === 2) {
        context?.emission.write2(value!);
      } else if (width === 3) {
        context?.emission.write3(value!);
      }
    };
    const select = (mode: string, size: number): number => {
      frame.choose(mode, size, { m16: this.m16, x16: this.x16, smartMode: this.smartMode });
      return size;
    };
    const display = () =>
      r!.generated
        ? (p.whole.immediate ? "#" : "") + "$" + r!.value.toString(16).toUpperCase()
        : p.original;
    const invalid = () => new Error(`Error: Invalid operand format for ${op}: ${display()}`);
    const read = (native = false, whole = false) => read65816(syntax, r!, frame, native, whole);
    const output = (mode: string, width: number, after = false, value?: number): number => {
      const code = opcode(mode);
      if (code === undefined) {
        throw invalid();
      }
      if (emit) {
        if (after) {
          write(code);
          write(value ?? read(memory), width);
        } else {
          const number = value ?? read(memory);
          write(code);
          write(number, width);
        }
      }
      return select(mode, width + 1);
    };
    // REP/SEP state reads precede family selection and are repeated at every sizing/emission invocation.
    if (this.smartMode && (op === "REP" || op === "SEP")) {
      try {
        const value = frame.evaluate(
          p.wholeScalar,
          "beforeOpcode",
          false,
          "numeric",
          p.original,
        ).value;
        const set = op === "REP";
        if (value & 0x20) {
          this.m16 = set;
        }
        if (value & 0x10) {
          this.x16 = set;
        }
      } catch {
        /* Forward operands leave the last known hints intact. */
      }
    }
    const immediateWidth = (expandedOnly = false) => {
      if (forced) {
        return len <= 1 ? 1 : 2;
      }
      if (p.bankWord) {
        return 2;
      }
      if (!p.stateImmediate || (expandedOnly && r!.generated)) {
        return len <= 1 ? 1 : 2;
      }
      const wide = family(op, "LDX LDY CPX CPY") ? this.x16 : this.m16;
      // A CPU-width hint cannot discard a resolved immediate's high byte. Banked
      // routine labels still encode a word even after another path selected eight-bit A.
      return wide || len > 1 ? 2 : 1;
    };
    const implied = opcode("imp"),
      acc = opcode("acc");
    // Implied repeats preserve their decimal-prefix convention; accumulator repeats use numeric values.
    if (implied !== undefined) {
      let count = 1;
      if (p.whole.immediate) {
        if (!emit) {
          try {
            count = Math.max(1, frame.evaluate(p.whole.scalar, "sizing").value);
          } catch {
            count = 1;
          }
        } else if (r.generated) {
          count = decimalHexPrefix(r.value);
        } else {
          count = p.impliedRepeat ?? NaN;
        }
        if (emit && Number.isNaN(count)) {
          throw new Error(`Invalid repeat count in pseudo opcode: ${display()}`);
        }
      }
      if (emit) {
        for (let i = 0; i < count; i++) {
          write(implied);
        }
      }
      return select("implied-repeat", Math.max(0, Math.ceil(count)));
    }
    if (
      shift &&
      (p.whole.immediate || !p.hasOperand || (p.shape?.kind === "register" && p.shape.name === "a"))
    ) {
      let count = 1;
      if (p.whole.immediate) {
        count = emit ? read() : frame.evaluate(p.wholeScalar, "sizing").value;
        if (emit && (!Number.isInteger(count) || count < 1)) {
          throw new Error(`Invalid repeat count in pseudo opcode: ${display()}`);
        }
      }
      if (emit) {
        for (let i = 0; i < count; i++) {
          write(acc);
        }
      }
      return select("accumulator-repeat", Math.max(0, Math.ceil(count)));
    }
    // Original-source families refresh width observations; expansion-only families cannot rerun calls.
    if (!emit || logic || jump) {
      r = classify65816(syntax, frame);
    }
    const mode = r.mode;
    const fixed = family(mode, "dil dily diy dix sr sriy") || (mode === "dpi" && len === 1);
    const index = p.shape?.kind === "memory" ? p.shape.index?.register : undefined;
    const x = index === "x" && !fixed,
      y = index === "y" && !fixed;
    // Definition collection reserves permissive sizes before final operand validity is known.
    if (!emit) {
      if (opcode("rel8") !== undefined) {
        return select("relative", 2);
      }
      if (op === "BRL" || op === "PER" || op === "PEA" || op === "MVP" || op === "MVN") {
        return select("fixed-word", 3);
      }
      if (Object.hasOwn(generic, op)) {
        return select("signature", 2);
      }
      if (mode === "dil" || mode === "dily") {
        return select(mode, jump ? 3 : 2);
      }
      if (op === "JSL" || op === "JML") {
        return select("long", 4);
      }
      if (jump) {
        return select("jump", 3);
      }
      if (forced) {
        return select("forced", 1 + len);
      }
      if (p.whole.immediate) {
        return select("immediate", 1 + immediateWidth());
      }
      if (fixed || mode === "dpi") {
        return select(mode, 2);
      }
      if (mode === "long" || mode === "longx") {
        return select(mode, 4);
      }
      return select(mode, 1 + initial.length);
    }
    // Both bank operands are read before any write, so failure cannot leave a partial opcode.
    if (op === "MVP" || op === "MVN") {
      if (p.parts.length !== 2) {
        throw new Error(`Error: ${op} requires two parameters (source, destination).`);
      }
      if (frame.bindingFailure?.reason === "other") {
        throw new Error(frame.bindingFailure.message);
      }
      const values = p.parts.map(
        (part) => frame.evaluate(part.scalar, "beforeOpcode", false, "numeric", part.display).value,
      );
      write(op === "MVP" ? 0x44 : 0x54);
      write(values[0]);
      write(values[1]);
      return select("block", 3);
    }
    if (op === "PER") {
      if (!p.hasOperand) {
        throw new Error("Error: PER requires an operand.");
      }
      return output("rel16", 2, false, read(false, true) & 0xffff);
    }
    if (opcode("rel8") !== undefined || op === "BRL") {
      const width = op === "BRL" ? 2 : 1,
        end = frame.currentAddress() + width + 1;
      let target: number;
      const expression = p.whole.scalar.expression;
      // Missing backward labels fail during layout; forward streams defer until final emission.
      if (expression.type === "relativeReference" && isReferenceExpressionNode(expression)) {
        const reference = frame.reference(expression, end);
        if (
          reference.kind === "error" &&
          (expression.direction === -1 || frame.stageName === "emitProgram")
        ) {
          throw reference.error;
        }
        target = reference.kind === "resolved" ? reference.value : 0;
      } else {
        target = read(false, true);
      }
      let offset = target - end;
      if (width === 1 && !p.whole.immediate && !index && r.hexDigits > 0 && r.hexDigits <= 2) {
        offset = target;
        if (offset > 127) {
          offset -= 256;
        }
      }
      if (frame.stageName !== "emitProgram") {
        offset = 0;
      } else if (Number.isNaN(offset)) {
        throw frame.error("Error: relativeAddress is NaN.");
      } else if (width === 2 && (offset < -32768 || offset > 32767)) {
        throw frame.error(`Error: BRL target out of range (${offset}).`);
      } else if (width === 1 && (offset < -128 || offset > 127)) {
        throw frame.error(
          `Error: Branch target out of range (${offset}) for ${op} ${display()} at $${frame.currentAddress().toString(16)}.`,
        );
      }
      write(opcode(width === 1 ? "rel8" : "rel16"));
      let value = offset;
      if (width === 1) {
        value = (offset & 255) >>> 0;
        if (offset < 0) {
          value |= 256;
        }
      }
      write(value, width);
      return select("relative", width + 1);
    }
    if (jump) {
      let value: number;
      try {
        value = read();
      } catch {
        throw invalid();
      }
      if (mode === "dil") {
        write(0xdc);
        write(value & 0xffff, 2);
        return select("indlong", 3);
      }
      if (mode === "dix") {
        write(op === "JSR" ? 0xfc : 0x7c);
        write(value & 0xffff, 2);
        return select("indx", 3);
      }
      if (mode === "dpi") {
        write(0x6c);
        write(value & 0xffff, 2);
        return select("ind", 3);
      }
      let long = op === "JML" || op === "JSL";
      // Same-bank targets can use a word address; explicit long mnemonics never shrink.
      if (value > 0xffff && !long) {
        const bank = (frame.currentAddress() >>> 16) & 255;
        long = ((value >>> 16) & 255) !== bank && p.hintedBank !== bank;
      }
      let code = op === "JSR" ? 0x20 : 0x4c;
      if (long) {
        code = op === "JSR" || op === "JSL" ? 0x22 : 0x5c;
      }
      write(code);
      write(value, long ? 3 : 2);
      return select("jump", long ? 4 : 3);
    }
    if (memory || logic) {
      if (memory && !p.hasOperand) {
        throw new Error(`Error: ${op} requires an operand.`);
      }
      if (p.whole.immediate) {
        if (op === "STA") {
          throw new Error("Error: STA does not support immediate mode.");
        }
        return output(family(op, "CPX CPY") ? "immX" : "immM", immediateWidth(), memory);
      }
      let selected = mode,
        width = 1;
      if (forced && !fixed) {
        if (len === 4) {
          if (memory) {
            write(undefined);
          }
          return select("forced-double", memory ? 1 : 0);
        }
        if (x) {
          selected = len === 1 ? "dpx" : "abx";
        } else if (y) {
          selected = "aby";
        } else {
          selected = len === 1 ? "dp" : "abs";
        }
        if (len === 3 && !y) {
          selected = x ? "longx" : "long";
        }
        width = len;
        if ((y && len !== 2) || opcode(selected) === undefined) {
          const label = x || y ? "indexed" : "non-indexed";
          let message = `Opcode ${op} not supported in forced ${label} mode.`;
          if (memory) {
            message = `Error: Opcode ${op} not supported in forced ${y ? "indexed-Y" : label} mode.`;
          }
          throw new Error(message);
        }
        return output(selected, width, true);
      }
      if (mode === "abx" || mode === "aby" || mode === "abs") {
        width = 2;
      } else if (mode === "long" || mode === "longx") {
        width = 3;
      } else if (mode === "unknown" || mode === "register") {
        selected = "abs";
        width = 2;
        if (memory && (this.optimizeDirectPage() || r.explicitDp)) {
          selected = "dp";
          width = 1;
        }
        if (logic && r.hexDigits === 2) {
          selected = "dp";
          width = 1;
        } else if (logic) {
          throw invalid();
        }
      } else if (mode === "dpx" && memory && !this.optimizeDirectPage() && !r.explicitDp) {
        selected = "abx";
        width = 2;
      }
      if (logic && opcode(selected) === undefined) {
        if (family(selected, "dpx abx aby sr sriy longx")) {
          throw invalid();
        }
        read();
        throw new Error(`Error: Invalid operand format for ${op}: ${display()} => undefined`);
      }
      return output(selected, width, memory);
    }
    if (shift) {
      let selected = "dp",
        width = 1;
      if (forced) {
        selected = x ? "dpx" : "dp";
        if (len === 2) {
          selected = x ? "abx" : "abs";
        }
        width = len;
      } else if (mode === "dpx") {
        selected = "dpx";
      } else if (mode === "abx") {
        selected = "abx";
        width = 2;
      } else if (mode === "abs") {
        selected = "abs";
        width = 2;
      }
      // Preserve the opcode-before-width-error write boundary for unsupported forced shift widths.
      if (forced && len > 2) {
        write(undefined);
        throw new Error("Forced length for arithmetic operations must be 1 or 2 bytes.");
      }
      write(opcode(selected));
      write(read(false, !x), width);
      return select(selected, width + 1);
    }
    if (load) {
      if (!p.hasOperand) {
        throw new Error(`Error: ${op} requires an operand.`);
      }
      if (p.whole.immediate) {
        return output("immX", immediateWidth(true), false);
      }
      const indexed = op === "LDX" ? y : x;
      const value = read(false, !indexed);
      let width = 1;
      if (forced) {
        width = len;
      } else if (
        (r.hexDigits > 2 && r.hexDigits <= 4) ||
        (!r.hexDigits && (r.length === 2 || len === 2)) ||
        value > 255
      ) {
        width = 2;
      }
      let selected = width === 1 ? "dp" : "abs";
      if (indexed) {
        if (op === "LDX") {
          selected = width === 1 ? "dpy" : "aby";
        } else {
          selected = width === 1 ? "dpx" : "abx";
        }
      }
      if (forced && len > 2) {
        write(opcode(selected));
        throw new Error(`Forced length ${len} not supported for ${op}`);
      }
      return output(selected, width, false, value);
    }
    if (store) {
      const indexed = op === "STX" ? y : x;
      if (!forced && (p.whole.immediate || (index && !indexed) || fixed)) {
        throw invalid();
      }
      let width = 1,
        selected = "dp";
      if (forced) {
        width = len;
        if (len !== 1) {
          selected = "abs";
        }
      } else if ((r.hexDigits >= 3 && r.hexDigits <= 4) || (mode === "abs" && !indexed)) {
        width = 2;
        selected = "abs";
      } else if (!indexed && r.hexDigits !== 2) {
        throw invalid();
      }
      if (indexed) {
        if (op === "STZ") {
          selected = width === 1 ? "dpx" : "abx";
        } else if (width === 1 || forced) {
          selected = op === "STX" ? "dpy" : "dpx";
        }
      }
      if (forced) {
        write(opcode(selected));
        const value = read(false, !indexed);
        if (len > 2) {
          throw new Error(`Forced length ${len} not supported for ${op}`);
        }
        write(value, width);
        return select(selected, width + 1);
      }
      // Preliminary indexed reads are observable for effectful expressions even when another read follows.
      if (indexed && (op === "STX" || r.hexDigits === 2 || (op === "STZ" && mode === "abx"))) {
        read();
      }
      return output(selected, width, false, read(false, !indexed));
    }
    if (bit) {
      const value = read(false, !x && !p.whole.immediate);
      if (
        !forced &&
        !p.whole.immediate &&
        ((index && !x) || (r.generated && (r.value < 0 || !Number.isInteger(r.value))))
      ) {
        throw invalid();
      }
      if (p.whole.immediate) {
        if (op !== "BIT") {
          throw new Error(`Opcode ${op} does not support immediate mode.`);
        }
        // Banked symbols can have more than four hex digits before their immediate
        // low word is encoded; use operand width rather than an exact digit count.
        const width = len <= 1 ? 1 : 2;
        return output("immM", width, false, value);
      }
      let width = 1;
      if (forced) {
        width = len === 1 ? 1 : 2;
      } else if (r.hexDigits === 4) {
        width = 2;
      } else if (!r.hexDigits || r.hexDigits > 2) {
        throw invalid();
      }
      if (forced && x && op !== "BIT") {
        throw new Error(`Opcode ${op} does not support indexed addressing in forced mode.`);
      }
      let selected = width === 1 ? "dp" : "abs";
      if (x && op === "BIT") {
        selected = width === 1 ? "dpx" : "abx";
      }
      return output(selected, width, false, value);
    }
    const value = p.hasOperand ? read(false, true) : 0;
    if (Object.hasOwn(generic, op)) {
      if ((op === "REP" || op === "SEP") && (len !== 1 || value < 0 || value > 255)) {
        throw new Error("Error: invalid_number");
      }
      write(generic[op]);
      write(value, op === "PEA" ? 2 : 1);
      return select("signature", op === "PEA" ? 3 : 2);
    }
    frame.choose("unknown", 0);
    return -1;
  }

  /** Module forms are determined from syntax/state; final symbol addresses cannot shrink instructions. */
  private runModule(frame: InstructionResolutionFrame, context?: TypedEncoderContext): number {
    const p = syntax65816(frame.instruction.operands).cpu65816;
    if (p.suffixError) {
      throw frame.error(p.suffixError);
    }
    const op = p.mnemonic;
    let compatibility: { form: string; size: number } | undefined;
    // Legacy emission can choose a different width/repeat count than its sizing pass. Probe that exact
    // path with a borrowed cursor; real bytes and symbolic fields still use the native object writer.
    if (
      frame.sourceAdapter === "asar" &&
      (!p.hasOperand || frame.previewSource(p.scalar) !== undefined)
    ) {
      compatibility = frame.withSourcePreview((advance) => {
        this.runAbsolute(frame, {
          emission: {
            write1: () => advance(1),
            write2: () => advance(2),
            write3: () => advance(3),
            writeByte: () => advance(1),
            writeBytes: (bytes) => advance(bytes.length),
            writeValue: (_value, width) => advance(width),
          },
          diagnostics: { error: (message) => frame.error(message) },
        });
        return frame.snapshot();
      });
    }
    const instruction = new RelocatableInstruction(frame, context);
    const table = encodings.get(op);
    const code = (mode: string): number => {
      const value = table?.get(modeId(mode));
      if (value === undefined) {
        throw frame.error(`${op} does not support relocatable form '${mode}'.`);
      }
      return value;
    };
    const finish = (mode: string): number =>
      instruction.finish(mode, { m16: this.m16, x16: this.x16, smartMode: this.smartMode });
    if (table?.has(modeId("imp"))) {
      let count = 1;
      if (p.whole.immediate) {
        count = compatibility?.size ?? frame.constant(p.wholeScalar, "Instruction repeat count");
      }
      if (!Number.isInteger(count) || count < 1 || count > 0x1000000) {
        throw frame.error("Invalid instruction repeat count.");
      }
      for (let index = 0; index < count; index++) {
        instruction.opcode(code("imp"));
      }
      return finish("implied-repeat");
    }
    if (
      (p.shape?.kind === "register" && p.shape.name === "a") ||
      (!p.hasOperand && table?.has(modeId("acc")))
    ) {
      instruction.opcode(code("acc"));
      return finish("accumulator");
    }
    if (family(op, "ASL LSR ROL ROR INC DEC") && p.whole.immediate) {
      const count =
        compatibility?.size ?? frame.constant(p.wholeScalar, "Accumulator repeat count");
      if (count < 1 || count > 0x1000000) {
        throw frame.error("Invalid accumulator repeat count.");
      }
      for (let index = 0; index < count; index++) {
        instruction.opcode(code("acc"));
      }
      return finish("accumulator-repeat");
    }
    if (family(op, "MVP MVN")) {
      if (p.parts.length !== 2) {
        throw frame.error(`${op} requires source and destination banks.`);
      }
      instruction.opcode(code("block"));
      for (const part of p.parts) {
        instruction.field(part.scalar, { width: 1, minimum: 0 });
      }
      return finish("blockMove");
    }
    if (table?.has(modeId("rel8")) || op === "BRL" || op === "PER") {
      const width = op === "BRL" || op === "PER" ? 2 : 1;
      instruction.opcode(code(width === 1 ? "rel8" : "rel16"));
      instruction.field(p.wholeScalar, {
        width,
        kind: "relative",
        signed: true,
        addressWidth: 24,
        wrapWidth: 16,
      });
      return finish("relative");
    }
    if (family(op, "BRK COP WDM REP SEP")) {
      if (this.smartMode && (op === "REP" || op === "SEP")) {
        const mask = frame.constant(p.scalar, `${op} CPU-width mask`);
        if (mask & 0x20) {
          this.m16 = op === "REP";
        }
        if (mask & 0x10) {
          this.x16 = op === "REP";
        }
      }
      instruction
        .opcode(code("sig"))
        .field(p.hasOperand ? p.scalar : linkConstant(0), { width: 1 });
      return finish("signature");
    }
    if (op === "PEA") {
      instruction.opcode(code("imm16")).field(p.scalar, { width: 2 });
      return finish("immediate16");
    }
    if (p.whole.immediate) {
      const index = family(op, "LDX LDY CPX CPY");
      let width = p.width;
      if (compatibility && compatibility.size > 1) {
        width = compatibility.size - 1;
      }
      if (width === undefined) {
        width = index ? Number(this.x16) + 1 : Number(this.m16) + 1;
        if (p.scalar.width.literalBytes !== undefined) {
          width = p.scalar.width.literalBytes;
        }
      }
      if (width !== 1 && width !== 2) {
        throw frame.error("65816 immediates require a byte or word width.");
      }
      instruction
        .opcode(code(index ? "immX" : "immM"))
        .field(p.scalar, { width, truncate: frame.sourceAdapter === "asar" });
      return finish("immediate");
    }
    const shape = p.shape;
    if (!p.hasOperand || shape?.kind !== "memory" || "kind" in shape.address) {
      throw frame.error(`${op} requires a scalar address.`);
    }
    const jump = family(op, "JMP JSR JML JSL");
    const indexed = shape.index?.register;
    // Exported masked operands use parentheses for arithmetic grouping, matching absolute assembly.
    const groupedMath =
      p.whole.math && shape.index?.position !== "inside" && shape.innerIndex !== "s";
    let mode = "abs";
    let width: 1 | 2 | 3 = 2;
    if (shape.delimiter === "brackets") {
      if (jump) {
        mode = "indlong";
      } else {
        mode = indexed === "y" ? "dily" : "dil";
        width = 1;
      }
    } else if (shape.delimiter === "parentheses" && !groupedMath) {
      if (jump) {
        mode = shape.index?.position === "inside" ? "indx" : "ind";
      } else {
        width = 1;
        if (shape.innerIndex === "s") {
          mode = "sriy";
        } else if (shape.index?.position === "inside") {
          mode = "dix";
        } else {
          mode = indexed === "y" ? "diy" : "dpi";
        }
      }
    } else if (indexed === "s") {
      mode = "sr";
      width = 1;
    } else {
      const authored = p.width ?? p.scalar.width.literalBytes;
      if (authored !== undefined) {
        if (authored !== 1 && authored !== 2 && authored !== 3) {
          throw frame.error("Address width must be 1..3 bytes.");
        }
        width = authored;
      }
      if (op === "JML" || op === "JSL") {
        width = 3;
      }
      // Near calls preserve their RTS convention. A far call must be authored as JSL.
      if (jump && op !== "JML" && op !== "JSL") {
        width = 2;
      }
      if (width === 1) {
        mode = "dp";
        if (indexed === "x") {
          mode = "dpx";
        } else if (indexed === "y") {
          mode = "dpy";
        }
      } else if (width === 2) {
        mode = "abs";
        if (indexed === "x") {
          mode = "abx";
        } else if (indexed === "y") {
          mode = "aby";
        }
      } else {
        mode = indexed === "x" ? "longx" : "long";
      }
    }
    if (
      compatibility &&
      compatibility.size >= 2 &&
      compatibility.size <= 4 &&
      table?.has(modeId(compatibility.form))
    ) {
      mode = compatibility.form;
      const selectedWidth = compatibility.size - 1;
      if (selectedWidth === 1 || selectedWidth === 2 || selectedWidth === 3) {
        width = selectedWidth;
      }
    }
    if (op === "PEI") {
      mode = "dpi";
      width = 1;
    }
    let kind: import("@uttori/asm-core").RelocationEncoding["kind"] = "absolute";
    if (width === 1 && mode !== "sr" && mode !== "sriy") {
      kind = "directPage";
    }
    if (width === 2 && mode !== "ind" && mode !== "indlong") {
      kind = jump ? "programBank" : "dataBank";
    }
    // Plain indirect JMP/JML fetch their pointers from bank zero; indexed indirect calls use PBR.
    const addressWidth = mode === "ind" || mode === "indlong" ? 16 : 24;
    let operand: import("@uttori/asm-core").LinkExpression | typeof shape.address = shape.address;
    // Asar's near data syntax writes the low word without a DBR declaration. Preserve that
    // established meaning while retaining checked near control flow and native module semantics.
    if (frame.sourceAdapter === "asar" && kind === "dataBank") {
      operand = linkBinary("&", frame.compileLink(shape.address), linkConstant(65535));
      kind = "absolute";
    }
    instruction.opcode(code(mode)).field(operand, { width, kind, addressWidth, minimum: 0 });
    return finish(mode);
  }
}
/** Implied repeats historically interpret the decimal prefix of an expanded hexadecimal value. */
function decimalHexPrefix(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return NaN;
  }
  let remaining = Math.floor(value),
    digits: number[] = [];
  do {
    digits.unshift(remaining % 16);
    remaining = Math.floor(remaining / 16);
  } while (remaining);
  let result = 0,
    count = 0;
  for (const digit of digits) {
    if (digit > 9) {
      break;
    }
    result = result * 10 + digit;
    count++;
  }
  return count ? result : NaN;
}
