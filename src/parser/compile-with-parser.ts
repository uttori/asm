import path from "node:path";
import { Assembler } from "../assembler.js";
import { executeParsedCommands } from "./execute-ir.js";
import { parseTokenizedCommands } from "./parser.js";
import { tokenizeSource } from "./tokenizer.js";

export interface CompileWithParserOptions {
  targetRom?: Uint8Array;
  sourcePath?: string;
  includePaths?: string[];
  checksumMode?: "asar" | "simple";
}

export const compileSourceWithParser = (
  source: string,
  options: CompileWithParserOptions = {}
): Uint8Array => {
  const assembler = new Assembler(options.targetRom);
  if (options.checksumMode) {
    assembler.setChecksumMode(options.checksumMode);
  }

  if (options.includePaths?.length) {
    assembler.setIncludePaths(options.includePaths);
  } else if (options.sourcePath) {
    const sourceDir = path.dirname(options.sourcePath);
    assembler.setIncludePaths(["./", sourceDir]);
  }

  if (options.sourcePath) {
    assembler.setCurrentFile(options.sourcePath);
  }

  const tokenizedCommands = tokenizeSource(source);
  const parsedCommands = parseTokenizedCommands(tokenizedCommands);

  for (const pass of [0, 1, 2]) {
    assembler.setPass(pass);
    executeParsedCommands(assembler, parsedCommands);
    assembler.finishPass();
  }

  return assembler.getBinaryOutput();
};
