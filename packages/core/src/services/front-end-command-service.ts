import { type LabelStatement, type AssignmentStatement } from "../ir/statement-node.js";
import type { MathCore } from "../mathcore.js";
import type { SourceSpan } from "../source-location.js";
import type { SymbolScopeService } from "./symbol-scope-service.js";

export type FrontEndCommandHost = {
  readonly moduleIdentity?: string;
  assignModuleSymbol?(
    name: string,
    expression: import("../ir/expression-node.js").ExpressionNode,
  ): void;
  currentParentLabel: string;
  currentParentIsGlobal: boolean;
  currentGlobalParentLabel: string;
  currentNamespace: string;
  mathCore: MathCore;
  symbolScope: SymbolScopeService;
  parseFunctionDefinition(defLine: string): void;
  processCommand(command: string): void;
  resolvedefines(input: string): string;
  recordCurrentAddress(): void;
  recordSymbolDefinition(
    kind: "label" | "function",
    name: string,
    options?: { span?: SourceSpan; value?: number | string; containerName?: string },
  ): void;
  isNamedLabelToken(token: string): boolean;
};

export class FrontEndCommandService {
  constructor(readonly host: FrontEndCommandHost) {}

  /** Apply declarations directly; callers execute the following typed statement afterward. */
  executeLabelStatement(statement: LabelStatement): void {
    if (statement.form === "relative") {
      if (statement.name === ":") {
        this.host.symbolScope.handleUnnamedLabel();
      } else {
        this.host.symbolScope.declareRelativeLabel({
          direction: statement.direction,
          depth: statement.depth,
          macroLocal: false,
          spelling: statement.name,
        });
      }
      this.host.recordCurrentAddress();
      this.host.recordSymbolDefinition("label", statement.name, { span: statement.span });
      return;
    }
    if (statement.form === "global") {
      if (statement.missingName) {
        throw new Error("global requires a label name");
      }
      this.host.symbolScope.setLabel(
        statement.name,
        undefined,
        false,
        false,
        true,
        !statement.preserveHierarchy,
      );
      if (!statement.preserveHierarchy) {
        this.host.currentParentLabel = statement.name;
        this.host.currentParentIsGlobal = true;
        this.host.currentGlobalParentLabel = statement.name;
      }
      this.host.recordSymbolDefinition("label", statement.name, { span: statement.span });
      return;
    }
    for (const { name, span } of statement.labels) {
      // Compute a dot label's container before declaring it: declaration changes the active parent.
      const dotCount = name.match(/^\.+/)?.[0].length ?? 0;
      const containerName =
        dotCount > 0
          ? this.host.symbolScope.getScopedParentLabel(dotCount) || undefined
          : this.host.currentNamespace || undefined;
      this.host.symbolScope.handleLabelDefinition(name);
      this.host.recordSymbolDefinition("label", name, { span, containerName });
    }
  }

  /** Resolve each assignment in the current scope; the parsed expression never stores its value. */
  executeAssignmentStatement(statement: AssignmentStatement): string {
    if (this.host.moduleIdentity !== undefined && this.host.assignModuleSymbol) {
      const name = this.host.symbolScope.qualifySymbolName(statement.target);
      this.host.assignModuleSymbol(name, statement.expression);
      this.host.recordCurrentAddress();
      return name;
    }
    const value = this.host.mathCore.math(statement.expression);
    const assignedName = this.host.symbolScope.qualifySymbolName(statement.target);
    this.host.symbolScope.setLabel(assignedName, value, true);
    this.host.recordCurrentAddress();
    this.host.recordSymbolDefinition("label", assignedName, {
      span: statement.span,
      value,
      containerName: this.host.currentNamespace || undefined,
    });
    return assignedName;
  }
}
