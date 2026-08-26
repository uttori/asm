import { type NormalizedCommand } from "../ir/normalized-command.js";
import type { SourceSpan } from "../source-location.js";
import type { MathCore } from "../mathcore.js";
import type { SymbolScopeService } from "./symbol-scope-service.js";
export type FrontEndCommandHost = {
    inFunctionDefinition: boolean;
    functionDefinitionLines: string[];
    currentParentLabel: string;
    currentParentIsGlobal: boolean;
    currentGlobalParentLabel: string;
    mathCore: MathCore;
    symbolScope: SymbolScopeService;
    parseFunctionDefinition(defLine: string): void;
    processCommand(command: string): void;
    resolvedefines(input: string): string;
    recordCurrentAddress(): void;
    recordSymbolDefinition(kind: "label" | "function", name: string, options?: {
        span?: SourceSpan;
        value?: number | string;
        containerName?: string;
    }): void;
    isNamedLabelToken(token: string): boolean;
};
export declare class FrontEndCommandService {
    readonly host: FrontEndCommandHost;
    constructor(host: FrontEndCommandHost);
    /**
     * Continues a function definition.
     * @param {string} command The command to continue.
     * @returns {boolean} `true` if the command was handled, `false` otherwise.
     */
    continueFunctionDefinition(command: string): boolean;
    /**
     * Starts a function definition.
     * @param {NormalizedCommand} command The command to start.
     * @returns {boolean} `true` if the command was handled, `false` otherwise.
     */
    startFunctionDefinition(command: NormalizedCommand): boolean;
    /**
     * Handles a relative label definition.
     * @param {NormalizedCommand} command The command to handle.
     * @returns {boolean} `true` if the command was handled, `false` otherwise.
     */
    handleRelativeLabelDefinition(command: NormalizedCommand): boolean;
    /**
     * Handles a global label definition.
     * @param {NormalizedCommand} command The command to handle.
     * @returns {boolean} `true` if the command was handled, `false` otherwise.
     */
    handleGlobalLabel(command: NormalizedCommand): boolean;
    /**
     * Consumes named label definitions.
     * @param {NormalizedCommand} command The command to consume.
     * @returns {boolean} `true` if the command was handled, `false` otherwise.
     */
    consumeNamedLabelDefinitions(command: NormalizedCommand): boolean;
    /**
     * Handles a static label assignment.
     * @param {NormalizedCommand} command The command to handle.
     * @returns {boolean} `true` if the command was handled, `false` otherwise.
     */
    handleStaticLabelAssignment(command: NormalizedCommand): boolean;
}
//# sourceMappingURL=front-end-command-service.d.ts.map