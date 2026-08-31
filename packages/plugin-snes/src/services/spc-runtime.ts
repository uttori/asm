import type { Assembler } from "@uttori/asm-core";

import { shouldAutoCloseSpcblock } from "../asar/compatibility.js";
import type { SnesSessionState, SnesSpcBlockType } from "../session-state.js";

/**
 * Session-bound runtime for SPC block directives and stage cleanup.
 *
 * NSPC on-disk shape:
 *   `dw size, dest`  then payload assembled at `dest` in SPC RAM,
 *   optionally `dw 0, execute` as a terminator/execute trailer.
 *
 * While open, architecture is forced to `spc700` and labels live under
 * `:SPCBLOCK:_` + the previous namespace so they cannot collide with SNES labels.
 */
export class SnesSpcRuntimeService {
  constructor(
    readonly session: Assembler,
    readonly state: SnesSessionState,
  ) {}

  /**
   * Closes an implicit inline-SPC block (`arch spc700-inline`), then errors if
   * a block is still open. Called from `onStageEnd`.
   */
  finishPass(): void {
    if (shouldAutoCloseSpcblock(this.state.spcInlineCompatibility, this.state.inSpcBlock)) {
      this.handleEndSpcblock(["endspcblock", "execute", "0"]);
    }
    if (this.state.inSpcBlock) {
      throw new Error("Missing endspcblock before end of pass.");
    }
  }

  /**
   * Opens an NSPC block: writes size/dest placeholders, retargets PC to the
   * 16-bit SPC destination, and switches architecture.
   *
   * `custom` with a macro name is recognized as Asar syntax but not implemented.
   *
   * @param {readonly string[]} words Tokenized line: `spcblock dest [nspc|custom [macro]]`.
   */
  handleSpcblock(words: readonly string[]): void {
    if (words.length < 2) throw new Error("spcblock requires at least a destination address.");
    if (words.length > 4) throw new Error("spcblock has too many arguments.");
    if (this.state.inSpcBlock) throw new Error("Nested spcblock directives are not supported.");

    const destination = this.session.operandResolver.getnum(this.session.resolvedefines(words[1]));
    if ((destination & ~0xffff) !== 0) {
      throw new Error(`spcblock destination must be 16-bit, got: ${words[1]}`);
    }

    let type: SnesSpcBlockType = "nspc";
    if (words.length === 3) {
      const kind = words[2].toLowerCase();
      if (kind === "nspc") type = "nspc";
      else if (kind === "custom") {
        throw new Error("Custom spcblock mode requires a macro and is not implemented.");
      } else throw new Error(`Unknown spcblock type: ${words[2]}`);
    } else if (words.length === 4) {
      if (words[2].toLowerCase() !== "custom") {
        throw new Error(`Unexpected spcblock argument for type: ${words[2]}`);
      }
      throw new Error("Custom spcblock mode is not implemented.");
    }
    if (type !== "nspc") throw new Error("Custom spcblock mode is not implemented.");

    const sizeAddress = this.session.currentTargetBaseAddress;
    this.session.write2(0);
    this.session.write2(destination);
    this.session.currentTargetAddress = destination;
    this.session.currentTargetStartAddress = destination;
    this.state.spcBlock = {
      destination,
      type,
      sizeAddress,
      executeAddress: null,
      namespaceBackup: this.session.currentNamespace,
    };
    this.session.currentNamespace = `:SPCBLOCK:_${this.session.currentNamespace}`;
    this.state.spcPreviousArchitecture = this.session.arch;
    this.state.inSpcBlock = true;
    this.session.selectArchitecture(
      "spc700",
      this.state.spcInlineCompatibility ? "spc700-inline" : "spc700",
    );
  }

  /**
   * Closes the open block: patches the NSPC size word, optionally writes an
   * execute trailer, then restores namespace and the previous architecture.
   *
   * Size is `(pc - dest) & $FFFF` - 64 KiB wrap, matching Asar.
   * Size is only patched when `canFinalize` (emit pass); collect/layout leave
   * the placeholder so later passes can rewrite it.
   *
   * Trailer priority: `endspcblock execute <addr>` > `startpos` > none.
   *
   * @param {readonly string[]} words Tokenized line.
   */
  handleEndSpcblock(words: readonly string[]): void {
    const block = this.state.spcBlock;
    if (!this.state.inSpcBlock || !block) {
      throw new Error("endspcblock used without an active spcblock.");
    }
    if (block.type !== "nspc") {
      throw new Error("Custom spcblock mode is not implemented.");
    }

    if (this.session.canFinalize) {
      const sizeOffset = this.session.outputWriter.toOutputOffset(block.sizeAddress & 0xffffff);
      if (sizeOffset < 0) throw new Error("spcblock size address does not map to output.");
      const blockSize = (this.session.currentTargetAddress - block.destination) & 0xffff;
      this.session.writeOutputBytes(sizeOffset, blockSize & 0xff, 1);
      this.session.writeOutputBytes(sizeOffset + 1, (blockSize >> 8) & 0xff, 1);
    }

    if (words.length === 3) {
      if (words[1].toLowerCase() !== "execute") {
        throw new Error(`Invalid endspcblock argument: ${words[1]}`);
      }
      this.session.write2(0);
      this.session.write2(
        this.session.operandResolver.getnum(this.session.resolvedefines(words[2])) & 0xffff,
      );
    } else if (words.length !== 1) {
      throw new Error("Unknown endspcblock format.");
    } else if (block.executeAddress !== null) {
      this.session.write2(0);
      this.session.write2(block.executeAddress & 0xffff);
    }

    this.session.currentNamespace = block.namespaceBackup;
    const previousArchitecture = this.state.spcPreviousArchitecture;
    this.state.spcBlock = null;
    this.state.spcPreviousArchitecture = null;
    this.state.inSpcBlock = false;
    if (previousArchitecture) {
      this.session.selectArchitecture(previousArchitecture, previousArchitecture);
    }
  }
}
