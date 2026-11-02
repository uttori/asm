/** A token may change within its native command family, keeping the original slot width. */
export interface SomDialogueCommand {
  /** Distinguishes two-byte name substitutions from equally sized waits. */
  readonly family: "party-name" | "wait" | "text-window";
  /** Exact native bytes emitted for this token width. */
  readonly bytes: Uint8Array;
}

/**
 * Compile an explicitly admitted command token, including its `${...}` delimiters.
 * Party names select the live twelve-byte name records; wait counts are event updates,
 * not milliseconds. Zero waits for fresh input from the talking actor's controller.
 * Unknown commands and selectors fail rather than becoming literal dialogue glyphs.
 */
export function encodeSomDialogueCommand(text: string): SomDialogueCommand {
  const names = ["${boy}", "${girl}", "${sprite}"];
  const index = names.indexOf(text);
  if (index >= 0) {
    return { family: "party-name", bytes: Uint8Array.of(0x57, index) };
  }
  if (text === "${wait}") {
    return { family: "wait", bytes: Uint8Array.of(0x28, 0) };
  }
  const wait = /^\${wait:(0|[1-9]\d*)}$/.exec(text);
  if (wait) {
    const count = Number(wait[1]);
    if (!Number.isSafeInteger(count) || count > 255) {
      throw new Error("Dialogue wait must fit one unsigned byte.");
    }
    return { family: "wait", bytes: Uint8Array.of(0x28, count) };
  }
  const windows = new Map([
    ["${openDialogue}", 0x50],
    ["${closeDialogue}", 0x51],
    ["${clearDialogue}", 0x52],
  ]);
  const opcode = windows.get(text);
  if (opcode !== undefined) {
    return { family: "text-window", bytes: Uint8Array.of(opcode) };
  }
  throw new Error(`Unsupported dialogue command token ${text}.`);
}

/** One reviewed native instruction/control span inside a raw segment; offsets are bytes. */
export interface SomDialogueCommandSlot {
  /** Byte offset within the raw segment's native payload. */
  readonly offset: number;
  /** Original token must compile exactly to the sidecar's native bytes at this offset. */
  readonly token: string;
  /** Defaults to true; false exposes a name while preventing edits to its bytes. */
  readonly editable?: boolean;
}
