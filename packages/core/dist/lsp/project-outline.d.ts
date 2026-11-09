/** Kind of a project-outline tree node. File nodes expand to document symbols on the client. */
export type ProjectOutlineKind = "entry" | "file" | "include" | "orphanGroup";
/** Serializable include-graph node shared by language-server and editor clients. */
export type ProjectOutlineNode = {
    /** Stable node id for tree expansion state in clients. */
    id: string;
    /** Primary display label for the outline entry. */
    label: string;
    /** Optional secondary detail such as a path fragment or symbol kind. */
    detail?: string;
    /** Outline node category controlling client expansion behavior. */
    kind: ProjectOutlineKind;
    /** Document URI when the node represents a file entry. */
    uri?: string;
    /** Nested include or orphan nodes beneath this entry. */
    children?: ProjectOutlineNode[];
};
//# sourceMappingURL=project-outline.d.ts.map