import * as fs from "fs";
import { Assembler } from "./assembler.js";
import path from "path";

class CLI {
  assembler: Assembler | null;

  constructor() {
    this.assembler = null;
  }

  /**
   * Gets assembler.
   * @returns {Assembler} The result.
   */
  getAssembler(): Assembler {
    if (!this.assembler) {
      throw new Error("Assembler has not been initialized.");
    }
    return this.assembler;
  }

  /**
   * Main function to process input arguments and compile assembly files.
   */
  public run(): void {
    console.log("cli run");
    const rawArgs = process.argv.slice(2);
    let checksumMode: "asar" | "simple" = "asar";
    const args: string[] = [];
    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i];
      if (arg.startsWith("--checksum-mode=")) {
        const value = arg.split("=")[1];
        if (value === "asar" || value === "simple") {
          checksumMode = value;
          continue;
        }
        console.error(`Error: Invalid checksum mode '${String(value)}'. Use 'asar' or 'simple'.`);
        process.exit(1);
      }
      if (arg === "--checksum-mode") {
        const value = rawArgs[i + 1] as "asar" | "simple" | undefined;
        if (value === "asar" || value === "simple") {
          checksumMode = value;
          i++;
          continue;
        }
        console.error("Error: --checksum-mode requires 'asar' or 'simple'.");
        process.exit(1);
      }
      args.push(arg);
    }

    if (args.length < 2) {
      console.error(
        "Usage: node cli.js <input.asm> <output.bin> [target.sfc] [--checksum-mode=asar|simple]",
      );
      process.exit(1);
    }

    const inputFile = args[0];
    const outputFile = args[1];
    const targetRomFile = args[2];

    if (!fs.existsSync(inputFile)) {
      console.error(`Error: Input file '${inputFile}' not found.`);
      process.exit(1);
    }

    // Load target ROM file if provided.
    let targetRom: Uint8Array | undefined = undefined;
    if (targetRomFile) {
      if (!fs.existsSync(targetRomFile)) {
        console.error(`Error: Target ROM file '${targetRomFile}' not found.`);
        process.exit(1);
      }
      const fileBuffer = fs.readFileSync(targetRomFile);
      targetRom = new Uint8Array(fileBuffer);
      console.log(`Loaded target ROM: ${targetRom.length} bytes.`);
    }

    try {
      const assembler = new Assembler(targetRom, { collectSourceMetadata: false });
      this.assembler = assembler;
      assembler.setChecksumMode(checksumMode);
      console.log(`Checksum mode: ${checksumMode}`);

      const assemblyCode = fs.readFileSync(inputFile, "utf8");
      console.log(`Compiling: ${inputFile} → ${outputFile}`);

      // Build once, execute as staged pipeline.
      const inputDir = path.dirname(inputFile);
      assembler.setIncludePaths(["./", inputDir]);
      assembler.setCurrentFile(inputFile);
      const program = assembler.buildProgramModel(assemblyCode, inputFile, 0);
      assembler.assembleProgram(program);

      // Write output binary
      this.writeBinary(outputFile);
      console.log(`Success: Output written to '${outputFile}'.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : (JSON.stringify(error) ?? "Unknown error");
      console.error(`Compilation failed: ${message}`);
      process.exit(1);
    }
  }

  /**
   * Processes and assembles an assembly source code string.
   * @param {string} source - The source code to assemble.
   * @param {number} pass - The pass number to assemble.
   */
  assembleFile(source: string, pass: number): void {
    console.log(`cli assembleFile ${pass} started`);
    const assembler = this.getAssembler();
    const program = assembler.buildProgramModel(source, assembler.currentFile, 0);
    switch (pass) {
      case 0:
        assembler.runStage("collectDefinitions", program);
        break;
      case 1:
        assembler.runStage("resolveLayout", program);
        break;
      default:
        assembler.runStage("emitProgram", program);
        break;
    }
    console.log(`cli assembleFile ${pass} completed`);
  }

  /**
   * Writes the assembled binary data to a file.
   * @param {string} outputFile - The path to the output file.
   */
  writeBinary(outputFile: string): void {
    const assembler = this.getAssembler();
    console.log("cli writeBinary", assembler.getBinaryOutput());
    fs.writeFileSync(outputFile, Buffer.from(assembler.getBinaryOutput()));
  }
}

// Run the CLI
new CLI().run();
