/**
 * Compile an explicitly admitted command token, including its `${...}` delimiters.
 * Party names select the live twelve-byte name records; wait counts are event updates,
 * not milliseconds. Zero waits for fresh input from the talking actor's controller.
 * Unknown commands and selectors fail rather than becoming literal dialogue glyphs.
 */
export function encodeSomDialogueCommand(token) {
    const names = ["${boy}", "${girl}", "${sprite}"];
    const index = names.indexOf(token);
    if (index >= 0) {
        return { family: "party-name", bytes: Uint8Array.of(0x57, index) };
    }
    if (token === "${wait}") {
        return { family: "wait", bytes: Uint8Array.of(0x28, 0) };
    }
    const wait = /^\${wait:(0|[1-9]\d*)}$/.exec(token);
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
    const opcode = windows.get(token);
    if (opcode !== undefined) {
        return { family: "text-window", bytes: Uint8Array.of(opcode) };
    }
    throw new Error(`Unsupported dialogue command token ${token}.`);
}
//# sourceMappingURL=som-dialogue-command.js.map