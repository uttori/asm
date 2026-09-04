/** Kind of a project-outline tree node. File nodes expand to document symbols on the client. */
export type ProjectOutlineKind = "entry" | "file" | "include" | "orphanGroup";
/** Serializable include-graph node shared by language-server and editor clients. */
export type ProjectOutlineNode = {
    id: string;
    label: string;
    detail?: string;
    kind: ProjectOutlineKind;
    uri?: string;
    children?: ProjectOutlineNode[];
};
//# sourceMappingURL=project-outline.d.ts.map