import { linkBinary, linkConstant, linkUnary, type LinkExpression } from "../ir/link-expression.js";
import type { TargetAddressSpace } from "../plugin/contracts.js";
import type { AddressedAssemblySection, SectionPosition } from "../relocatable.js";
import type { ModuleAssembly } from "./module-assembly.js";

/** Translate authored ORG/BASE locations to ordinary section identities, retaining their addresses only as recipe hints. */
export class AsarModuleLayout {
  private readonly origins = new Map<string, Omit<AddressedAssemblySection, "size">>();
  private previous = new Map<string, Omit<AddressedAssemblySection, "size">>();
  private sequence = 0;
  private readonly pcStack: SectionPosition[] = [];
  private readonly baseStack: number[] = [];

  constructor(
    readonly module: ModuleAssembly,
    readonly addressSpace: TargetAddressSpace,
  ) {}

  /** Previous-pass origins resolve forward labels, while the active pass rebuilds every authored contribution. */
  beginStage(): void {
    this.previous = new Map(this.origins);
    this.origins.clear();
    this.sequence = 0;
    this.pcStack.length = 0;
    this.baseStack.length = 0;
  }

  /** Each address transition opens a relocatable contribution; no fixed placement is stored in the object. */
  private open(loadAddress: number, runAddress: number): number {
    const section = `${this.module.id}:asar:${this.sequence++}`;
    this.origins.set(section, { section, loadAddress, runAddress });
    return this.module.selectSection({ name: section });
  }

  org(address: number): number {
    return this.open(address, address);
  }

  base(address?: number): number {
    const loadAddress = this.currentAddress("load");
    return this.open(loadAddress, address ?? loadAddress);
  }

  pushPc(): void {
    if (this.pcStack.length >= 256) {
      throw new Error("PushPC stack overflow.");
    }
    this.currentAddress("load");
    this.pcStack.push(this.module.position());
  }

  pullPc(): number {
    const saved = this.pcStack.pop();
    if (!saved) {
      throw new Error("No module PC value to pull.");
    }
    this.module.selectSection({ name: saved.section });
    return this.module.seek(saved.offset);
  }

  pushBase(): void {
    this.baseStack.push(this.currentAddress("run"));
  }

  pullBase(): number {
    const address = this.baseStack.pop();
    if (address === undefined) {
      throw new Error("No module base value to pull.");
    }
    return this.base(address);
  }

  /** Numeric preview is for source encoding decisions only. Relocation expressions retain their section leaves. */
  currentAddress(kind: "load" | "run"): number {
    const position = this.module.position();
    const origin = this.origins.get(position.section);
    if (!origin) {
      throw new Error("Asar module output requires ORG before bytes or BASE.");
    }
    const start = kind === "load" ? origin.loadAddress : origin.runAddress;
    return this.addressSpace.advance(start, position.offset);
  }

  /** Unknown imports remain unknown; the encoder uses its normal unresolved form rather than a guessed final value. */
  preview(expression: LinkExpression, seen = new Set<string>()): number | undefined {
    if (expression.kind === "constant") {
      return expression.value;
    }
    if (expression.kind === "section") {
      if (expression.module !== this.module.id) {
        return undefined;
      }
      const origin = this.origins.get(expression.section) ?? this.previous.get(expression.section);
      return origin ? this.addressSpace.advance(origin.runAddress, expression.offset) : undefined;
    }
    if (expression.kind === "symbol") {
      if (expression.module !== undefined && expression.module !== this.module.id) {
        return undefined;
      }
      if (seen.has(expression.name)) {
        return undefined;
      }
      const symbol = this.module.symbols.get(expression.name);
      if (!symbol?.value) {
        return undefined;
      }
      const next = new Set(seen).add(expression.name);
      return this.preview(symbol.value, next);
    }
    if (expression.kind === "unary") {
      const value = this.preview(expression.argument, seen);
      if (value === undefined) {
        return undefined;
      }
      const folded = linkUnary(expression.operator, linkConstant(value));
      return folded.kind === "constant" ? folded.value : undefined;
    }
    const left = this.preview(expression.left, seen);
    if (left === undefined) {
      return undefined;
    }
    if (expression.operator === "&&" && !left) {
      return 0;
    }
    if (expression.operator === "||" && left) {
      return 1;
    }
    const right = this.preview(expression.right, seen);
    if (right === undefined) {
      return undefined;
    }
    const folded = linkBinary(expression.operator, linkConstant(left), linkConstant(right));
    return folded.kind === "constant" ? folded.value : undefined;
  }

  /** Return complete layout evidence only after every section has an authored load/run pair. */
  contributions(): readonly AddressedAssemblySection[] {
    const result: AddressedAssemblySection[] = [];
    for (const section of this.module.sections.values()) {
      const origin = this.origins.get(section.name);
      if (!origin) {
        if (section.size) {
          throw new Error(`Section '${section.name}' has no Asar layout origin.`);
        }
        continue;
      }
      result.push({ ...origin, size: section.size });
    }
    return result;
  }
}
