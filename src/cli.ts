import * as fs from "fs";
import { Assembler } from "./assembler.js";
import path from "path";

class CLI {
  private assembler: Assembler | null;

  constructor() {
    this.assembler = null;
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
        const value = arg.split("=")[1] as "asar" | "simple" | undefined;
        if (value === "asar" || value === "simple") {
          checksumMode = value;
          continue;
        }
        console.error(`Error: Invalid checksum mode '${value}'. Use 'asar' or 'simple'.`);
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
      console.error("Usage: node cli.js <input.asm> <output.bin> [target.sfc] [--checksum-mode=asar|simple]");
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
      this.assembler = new Assembler(targetRom);
      this.assembler.setChecksumMode(checksumMode);
      console.log(`Checksum mode: ${checksumMode}`);

      const assemblyCode = fs.readFileSync(inputFile, "utf8");
      console.log(`Compiling: ${inputFile} → ${outputFile}`);

      // Execute 3-pass assembly process
      const inputDir = path.dirname(inputFile);
      this.assembler.setIncludePaths(["./", inputDir]);
      this.assembler.setCurrentFile(inputFile);
      this.assembleFile(assemblyCode, 0); // First pass: determine label locations
      this.assembleFile(assemblyCode, 1); // Second pass: determine exact positions
      this.assembleFile(assemblyCode, 2); // Third pass: final assembly

      // Write output binary
      this.writeBinary(outputFile);
      console.log(`Success: Output written to '${outputFile}'.`);
    } catch (error) {
      console.error(`Compilation failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Processes and assembles an assembly source code string.
   * @param source
   * @param pass
   */
  assembleFile(source: string, pass: number): void {
    console.log(`cli assembleFile ${pass} started`);
    this.assembler.setPass(pass);
    const lines = source.split("\n");
    let lineNumber = 0;
    for (const line of lines) {
      this.assembler.setCurrentLine(lineNumber);
      this.assembler.assembleblock(line.trim());
      lineNumber++;
    }
    this.assembler.finishPass();
    console.log(`cli assembleFile ${pass} completed`);
  }

  /**
   * Writes the assembled binary data to a file.
   * @param outputFile
   */
  writeBinary(outputFile: string): void {
    console.log("cli writeBinary", this.assembler.getBinaryOutput());
    fs.writeFileSync(outputFile, Buffer.from(this.assembler.getBinaryOutput()));
  }
}

// Run the CLI
new CLI().run();
