import type { ExpressionNode } from "@uttori/asm-core";
import { parseDirectiveExpression, type PluginSessionCapabilities } from "@uttori/asm-core/plugin";

import { shouldAutoCloseSpcblock } from "../asar/compatibility.js";
import type { SnesSessionState } from "../session-state.js";

/** Prepared operands preserve validation timing relative to block-state checks and header writes. */
export type SpcBlockSyntax = {
  /** Parsed 16-bit SPC load address expression. */
  destination: ExpressionNode;
  /** Original destination token text for diagnostics. */
  destinationText: string;
  /** Non-NSPC mode or arity error deferred until after destination binding. */
  modeError?: string;
};
/** Parsed `endspcblock` trailer and validation errors. */
export type EndSpcBlockSyntax = {
  /** Optional execute address expression for the NSPC trailer word pair. */
  execute?: ExpressionNode;
  /** Line format error detected during tokenization. */
  error?: string;
};

/**
 * Tokenizes an `spcblock` directive line into a validated syntax payload.
 * @param words Tokenized directive words beginning with `spcblock`.
 * @returns Parsed block open payload.
 */
export function parseSpcBlock(words: readonly string[]): SpcBlockSyntax {
  if (words.length < 2) {
    throw new Error("spcblock requires at least a destination address.");
  }
  if (words.length > 4) {
    throw new Error("spcblock has too many arguments.");
  }
  let modeError: string | undefined;
  if (words.length === 3 && words[2].toLowerCase() !== "nspc") {
    modeError =
      words[2].toLowerCase() === "custom"
        ? "Custom spcblock mode requires a macro and is not implemented."
        : `Unknown spcblock type: ${words[2]}`;
  } else if (words.length === 4) {
    modeError =
      words[2].toLowerCase() === "custom"
        ? "Custom spcblock mode is not implemented."
        : `Unexpected spcblock argument for type: ${words[2]}`;
  }
  return { destination: parseDirectiveExpression(words[1]), destinationText: words[1], modeError };
}

/**
 * Tokenizes an `endspcblock` directive line into trailer operands or errors.
 * @param words Tokenized directive words beginning with `endspcblock`.
 * @returns Parsed block close payload.
 */
export function parseEndSpcBlock(words: readonly string[]): EndSpcBlockSyntax {
  if (words.length === 3) {
    if (words[1].toLowerCase() !== "execute") {
      return { error: `Invalid endspcblock argument: ${words[1]}` };
    }
    return { execute: parseDirectiveExpression(words[2]) };
  }
  return words.length === 1 ? {} : { error: "Unknown endspcblock format." };
}

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
    readonly session: PluginSessionCapabilities,
    readonly state: SnesSessionState,
  ) {}

  /**
   * Closes an implicit inline-SPC block (`arch spc700-inline`), then errors if
   * a block is still open. Called from `onStageEnd`.
   */
  finishPass(): void {
    if (shouldAutoCloseSpcblock(this.state.spcInlineCompatibility, this.state.inSpcBlock)) {
      this.executeEndSpcblock({ execute: { type: "literal", value: "0", numericValue: 0 } });
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
   * @param words Tokenized line: `spcblock dest [nspc|custom [macro]]`.
   */
  handleSpcblock(words: readonly string[]): void {
    this.executeSpcblock(parseSpcBlock(words));
  }

  /** Bind destination before reporting mode errors, then commit the NSPC header and switch CPU. */
  executeSpcblock(node: SpcBlockSyntax): void {
    if (this.state.inSpcBlock) {
      throw new Error("Nested spcblock directives are not supported.");
    }

    const destination = this.session.operandResolver.getnum(node.destination);
    if ((destination & ~0xffff) !== 0) {
      throw new Error(`spcblock destination must be 16-bit, got: ${node.destinationText}`);
    }

    if (node.modeError) {
      throw new Error(node.modeError);
    }

    const sizeAddress = this.session.currentTargetBaseAddress;
    this.session.write2(0);
    this.session.write2(destination);
    this.session.currentTargetAddress = destination;
    this.session.currentTargetStartAddress = destination;
    this.state.spcBlock = {
      destination,
      type: "nspc",
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
   * Size is only patched when `canFinalize` (emit pass). Collect/layout leave
   * the placeholder so later passes can rewrite it.
   *
   * Trailer priority: `endspcblock execute <addr>` > `startpos` > none.
   *
   * @param words Tokenized line.
   */
  handleEndSpcblock(words: readonly string[]): void {
    this.executeEndSpcblock(parseEndSpcBlock(words));
  }

  /** Size patching precedes trailer validation; an execute expression runs after its zero word. */
  executeEndSpcblock(node: EndSpcBlockSyntax): void {
    const block = this.state.spcBlock;
    if (!this.state.inSpcBlock || !block) {
      throw new Error("endspcblock used without an active spcblock.");
    }
    if (block.type !== "nspc") {
      throw new Error("Custom spcblock mode is not implemented.");
    }

    if (this.session.canFinalize) {
      const sizeOffset = this.session.outputWriter.toOutputOffset(block.sizeAddress & 0xffffff);
      if (sizeOffset < 0) {
        throw new Error("spcblock size address does not map to output.");
      }
      const blockSize = (this.session.currentTargetAddress - block.destination) & 0xffff;
      this.session.writeOutputBytes(sizeOffset, blockSize & 0xff, 1);
      this.session.writeOutputBytes(sizeOffset + 1, (blockSize >> 8) & 0xff, 1);
    }

    if (node.error) {
      throw new Error(node.error);
    }
    if (node.execute) {
      this.session.write2(0);
      this.session.write2(this.session.operandResolver.getnum(node.execute) & 0xffff);
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
