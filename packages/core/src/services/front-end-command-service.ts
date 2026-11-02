import { type LabelStatement, type AssignmentStatement } from "../ir/statement-node.js";
import type { MathCore } from "../mathcore.js";
import type { SourceSpan } from "../source-location.js";
import type { SymbolScopeService } from "./symbol-scope-service.js";

/** Session callbacks for label, assignment, and function front-end commands. */
export type FrontEndCommandHost = {
  /** Optional module id used when binding module-level symbols. */
  readonly moduleIdentity?: string;
  /** Optional hook binding module symbols from assignment expressions. */
  assignModuleSymbol?(
    name: string,
    expression: import("../ir/expression-node.js").ExpressionNode,
  ): void;
  /** Innermost enclosing label used for cheap/local qualification. */
  currentParentLabel: string;
  /** Whether the current parent label is a global export. */
  currentParentIsGlobal: boolean;
  /** Outermost global label anchoring nested locals. */
  currentGlobalParentLabel: string;
  /** Active namespace prefix for recorded symbols. */
  currentNamespace: string;
  /** Shared expression evaluator for assignment right-hand sides. */
  mathCore: MathCore;
  /** Label and namespace scope service for symbol declarations. */
  symbolScope: SymbolScopeService;
  /** Parses and registers a function definition line. */
  parseFunctionDefinition(defLine: string): void;
  /** Executes a normalized command after front-end handling. */
  processCommand(command: string): void;
  /** Resolves define references in command text before execution. */
  resolvedefines(input: string): string;
  /** Records the program counter for the current emission site. */
  recordCurrentAddress(): void;
  /** Records label and function symbols for tooling and later passes. */
  recordSymbolDefinition(
    kind: "label" | "function",
    name: string,
    options?: { span?: SourceSpan; value?: number | string; containerName?: string },
  ): void;
  /** Dialect-specific check for tokens that may introduce named labels. */
  isNamedLabelToken(token: string): boolean;
};

/** Applies label and assignment statement semantics before command execution. */
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
