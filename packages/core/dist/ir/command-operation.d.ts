/** Ordered source operations whose meaning is independent of the selected processor. */
export type CommandOperation = {
    kind: "macroHeader";
    name: string;
    parameters: string[];
} | {
    kind: "macroCall";
    name: string;
    arguments: string[];
    parenthesized: boolean;
} | {
    kind: "defineAssignment";
    name: string;
    dynamic: boolean;
    operator: string;
    value: string;
} | {
    kind: "undef";
    name: string;
} | {
    kind: "defineExpansion";
    name: string;
    dynamic: boolean;
} | {
    kind: "empty";
    seedBaseImage: boolean;
} | {
    kind: "invalid";
    message: string;
};
/** Public and physical-source entry points share this grammar; errors activate only on execution. */
export declare function parseCommandOperation(text: string, raw?: string): CommandOperation | undefined;
//# sourceMappingURL=command-operation.d.ts.map