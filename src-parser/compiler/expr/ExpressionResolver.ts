import type { Assembler } from "../../assembler.js";

export class ExpressionResolver {
  constructor(private readonly assembler: Assembler) {}

  resolve(expression: string): string {
    return this.assembler.resolvedefines(expression);
  }

  evaluate(expression: string): number {
    return this.assembler.getnum(expression);
  }
}
