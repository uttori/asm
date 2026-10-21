import { Assembler as CoreAssembler } from "@uttori/asm-core";
import type { AssemblyFileProvider } from "@uttori/asm-core";
import type { WorkspaceIndexOptions } from "@uttori/asm-core/tooling";
import { createSnesAssemblerEnvironment, SNES_TARGET_ID } from "@uttori/asm-plugin-snes";
import { createSpcRuntime, snesSessionStateKey } from "@uttori/asm-plugin-snes/target";

import { Typed65816 as Arch65816 } from "../packages/plugin-snes/src/architectures/typed-65816.js";
import { TypedSpc700 as ArchSPC700 } from "../packages/plugin-snes/src/architectures/typed-spc700.js";
import { TypedSuperFx as ArchSuperFX } from "../packages/plugin-snes/src/architectures/typed-superfx.js";

export const snesTestEnvironment = await createSnesAssemblerEnvironment();
export const snesTestAssemblerOptions = {
  environment: snesTestEnvironment,
  target: SNES_TARGET_ID,
} as const;

export type TestAssemblerOptions = {
  fileProvider?: AssemblyFileProvider;
  collectSourceMetadata?: boolean;
};

/** Test-only facade that keeps byte-parity tests concise while activating SNES explicitly. */
export class Assembler extends CoreAssembler {
  constructor(baseImage?: number[] | Uint8Array, options: TestAssemblerOptions = {}) {
    super({
      ...snesTestAssemblerOptions,
      baseImage,
      fileProvider: options.fileProvider,
      collectSourceMetadata: options.collectSourceMetadata,
    });
    this.arch = "65816";
  }

  override selectArchitecture(architecture: string, sourceAlias = architecture): void {
    const canonical = this.architectureRegistry.getCanonicalName(architecture);
    if (!canonical) {
      throw new Error(`Unsupported architecture: ${architecture}`);
    }
    super.selectArchitecture(canonical, sourceAlias);
    const contribution = this.environment.getArchitecture(canonical);
    this.arch = contribution?.aliases?.[0] ?? canonical;
  }

  get arch65816(): Arch65816 {
    const encoder = this.architectureRegistry.getDefinition("65816")?.encoder.typed;
    if (!(encoder instanceof Arch65816)) {
      throw new Error("65816 encoder is not registered.");
    }
    return encoder;
  }

  get archSPC700(): ArchSPC700 {
    const encoder = this.architectureRegistry.getDefinition("spc700")?.encoder.typed;
    if (!(encoder instanceof ArchSPC700)) {
      throw new Error("SPC700 encoder is not registered.");
    }
    return encoder;
  }

  get archSuperFX(): ArchSuperFX {
    const encoder = this.architectureRegistry.getDefinition("superfx")?.encoder.typed;
    if (!(encoder instanceof ArchSuperFX)) {
      throw new Error("SuperFX encoder is not registered.");
    }
    return encoder;
  }

  get targetState() {
    return this.pluginState.get(snesSessionStateKey);
  }

  get spcRuntime() {
    return createSpcRuntime(this, this.targetState);
  }

  write1_65816(value: number): void {
    this.writeArchitectureByte(value);
  }

  setChecksumMode(mode: "asar" | "simple"): void {
    this.pluginState.get(snesSessionStateKey).checksumMode = mode;
  }

  setAsarSuperFxMoveShortAddress(enabled: boolean): void {
    this.pluginState.get(snesSessionStateKey).asarSuperFxMoveShortAddress = enabled;
  }
}

export const snesWorkspaceIndexOptions = (
  options: Omit<WorkspaceIndexOptions, "environment" | "target"> = {},
): WorkspaceIndexOptions => ({ ...snesTestAssemblerOptions, ...options });
