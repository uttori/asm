import type { Assembler } from "@uttori/asm-core";

import { isFreespaceAvailable } from "../asar/compatibility.js";
import type { SnesSessionState } from "../session-state.js";

export function handleFreespace(
  session: Assembler,
  state: SnesSessionState,
  words: readonly string[],
): void {
  if (state.inSpcBlock) {
    throw new Error(`${words[0]} is unavailable inside spcblock.`);
  }
  if (!isFreespaceAvailable(state.mapper)) {
    throw new Error("No freespace available in norom.");
  }

  const sourceLength =
    session.baseImage.length > 0 ? session.baseImage.length : session.outputBytes.length;
  const startOffset = Math.max(0x80000, sourceLength);
  if (session.outputBytes.length < 0x100000) {
    session.expandOutput(0x100000, state.outputFillByte);
  }
  const startAddress = session.outputWriter.fromOutputOffset(startOffset);
  if (startAddress < 0) {
    throw new Error("Unable to map freespace start to a logical address.");
  }

  session.currentTargetAddress = startAddress;
  session.currentTargetBaseAddress = startAddress;
  session.currentTargetStartAddress = startAddress;
  session.currentTargetBaseStartAddress = startAddress;
  state.activeFreespaceStartOffset = startOffset;

  for (const value of [0x53, 0x54, 0x41, 0x52, 0x00, 0x00, 0xff, 0xff]) {
    session.write1(value);
  }
  state.activeFreespaceContentStartOffset = startOffset + 8;
}

export function handleFreespaceByte(
  session: Assembler,
  state: SnesSessionState,
  words: readonly string[],
): void {
  if (words.length !== 2) {
    throw new Error("FREESPACEBYTE requires exactly one parameter.");
  }
  state.outputFillByte = session.operandResolver.getnum(session.resolvedefines(words[1])) & 0xff;
  session.outputFillByte = state.outputFillByte;
}

export function handleProt(session: Assembler, words: readonly string[]): void {
  const labels = words
    .slice(1)
    .join(" ")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  if (labels.length === 0) {
    throw new Error("PROT command requires at least one label parameter.");
  }

  for (const value of [0x50, 0x52, 0x4f, 0x54, (labels.length * 3) & 0xff]) {
    session.write1(value);
  }
  for (const label of labels) {
    let address = 0;
    try {
      address = session.symbolScope.getLabelValue(label, false) & 0xffffff;
    } catch {
      address = 0;
    }
    session.write3(address);
  }
  for (const value of [0x53, 0x54, 0x4f, 0x50, 0x00]) {
    session.write1(value);
  }
}
