import { shouldAutoCloseSpcblock } from "../compatibility/asar-compatibility-profile.js";
import type { OperandResolver } from "../operand-resolver.js";
import type { LegacySpcBlockData, LegacySpcBlockType } from "../plugin/legacy-session-state.js";
import type { OutputWriterService } from "./output-writer-service.js";

export interface LegacySpcRuntimeHost {
  canFinalize: boolean;
  currentNamespace: string;
  currentTargetAddress: number;
  currentTargetBaseAddress: number;
  currentTargetStartAddress: number;
  inTargetBlock: boolean;
  operandResolver: OperandResolver;
  outputWriter: OutputWriterService;
  targetBlockInlineCompatibility: boolean;
  targetBlockData: LegacySpcBlockData | null;
  resolvedefines(input: string): string;
  write2(value: number): void;
  writeOutputBytes(start: number, value: number, length?: number): void;
}

/** Transitional SNES-plugin runtime for SPC block directives and pass cleanup. */
export class LegacySpcRuntimeService {
  constructor(readonly host: LegacySpcRuntimeHost) {}

  finishPass(): void {
    if (
      shouldAutoCloseSpcblock(this.host.targetBlockInlineCompatibility, this.host.inTargetBlock)
    ) {
      this.handleEndSpcblock(["endspcblock", "execute", "0"]);
    }
    if (this.host.inTargetBlock) {
      throw new Error("Missing endspcblock before end of pass.");
    }
  }

  handleSpcblock(words: readonly string[]): void {
    if (words.length < 2) throw new Error("spcblock requires at least a destination address.");
    if (words.length > 4) throw new Error("spcblock has too many arguments.");
    if (this.host.inTargetBlock) throw new Error("Nested spcblock directives are not supported.");

    const destination = this.host.operandResolver.getnum(this.host.resolvedefines(words[1]));
    if ((destination & ~0xffff) !== 0) {
      throw new Error(`spcblock destination must be 16-bit, got: ${words[1]}`);
    }

    let type: LegacySpcBlockType = "nspc";
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

    const sizeAddress = this.host.currentTargetBaseAddress;
    this.host.write2(0);
    this.host.write2(destination);
    this.host.currentTargetAddress = destination;
    this.host.currentTargetStartAddress = destination;
    this.host.targetBlockData = {
      destination,
      type,
      sizeAddress,
      executeAddress: null,
      namespaceBackup: this.host.currentNamespace,
    };
    this.host.currentNamespace = `:SPCBLOCK:_${this.host.currentNamespace}`;
    this.host.inTargetBlock = true;
  }

  handleEndSpcblock(words: readonly string[]): void {
    if (!this.host.inTargetBlock || !this.host.targetBlockData) {
      throw new Error("endspcblock used without an active spcblock.");
    }
    if (this.host.targetBlockData.type !== "nspc") {
      throw new Error("Custom spcblock mode is not implemented.");
    }

    if (this.host.canFinalize) {
      const sizeOffset = this.host.outputWriter.toOutputOffset(
        this.host.targetBlockData.sizeAddress & 0xffffff,
      );
      if (sizeOffset < 0) throw new Error("spcblock size address does not map to output.");
      const blockSize =
        (this.host.currentTargetAddress - this.host.targetBlockData.destination) & 0xffff;
      this.host.writeOutputBytes(sizeOffset, blockSize & 0xff, 1);
      this.host.writeOutputBytes(sizeOffset + 1, (blockSize >> 8) & 0xff, 1);
    }

    if (words.length === 3) {
      if (words[1].toLowerCase() !== "execute") {
        throw new Error(`Invalid endspcblock argument: ${words[1]}`);
      }
      this.host.write2(0);
      this.host.write2(
        this.host.operandResolver.getnum(this.host.resolvedefines(words[2])) & 0xffff,
      );
    } else if (words.length !== 1) {
      throw new Error("Unknown endspcblock format.");
    } else if (this.host.targetBlockData.executeAddress !== null) {
      this.host.write2(0);
      this.host.write2(this.host.targetBlockData.executeAddress & 0xffff);
    }

    this.host.currentNamespace = this.host.targetBlockData.namespaceBackup;
    this.host.targetBlockData = null;
    this.host.inTargetBlock = false;
  }
}
