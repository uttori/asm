/** A token may change within its native command family, keeping the original slot width. */
export interface SomDialogueCommand {
    /** Distinguishes two-byte name substitutions from equally sized waits. */
    readonly family: "party-name" | "wait" | "text-window";
    readonly bytes: Uint8Array;
}
/**
 * Compile an explicitly admitted command token, including its `${...}` delimiters.
 * Party names select the live twelve-byte name records; wait counts are event updates,
 * not milliseconds. Zero waits for fresh input from the talking actor's controller.
 * Unknown commands and selectors fail rather than becoming literal dialogue glyphs.
 */
export declare function encodeSomDialogueCommand(token: string): SomDialogueCommand;
/** One reviewed native instruction/control span inside a raw segment; offsets are bytes. */
export interface SomDialogueCommandSlot {
    readonly offset: number;
    /** Original token must compile exactly to the sidecar's native bytes at this offset. */
    readonly token: string;
    /** Defaults to true; false exposes a name while preventing edits to its bytes. */
    readonly editable?: boolean;
}
//# sourceMappingURL=som-dialogue-command.d.ts.map