import { Assembler as CoreAssembler } from "@uttori/asm-core";
import type { AssemblyFileProvider, WorkspaceIndexOptions } from "@uttori/asm-core";
import {
  Arch65816,
  ArchSPC700,
  ArchSuperFX,
  createSnesAssemblerHost,
  createSpcRuntime,
  snesSessionStateKey,
} from "@uttori/asm-plugin-snes";

export const snesAssemblerHost = await createSnesAssemblerHost();

export type LegacyTestAssemblerOptions = {
  fileProvider?: AssemblyFileProvider;
  collectSourceMetadata?: boolean;
};

/** Test-only compatibility facade for the pre-plugin constructor shape. */
export class Assembler extends CoreAssembler {
  constructor(baseImage?: number[] | Uint8Array, options: LegacyTestAssemblerOptions = {}) {
    super({
      ...snesAssemblerHost,
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
    return this.architectureRegistry.getDefinition("65816")?.encoder as Arch65816;
  }

  get archSPC700(): ArchSPC700 {
    return this.architectureRegistry.getDefinition("spc700")?.encoder as ArchSPC700;
  }

  get archSuperFX(): ArchSuperFX {
    return this.architectureRegistry.getDefinition("superfx")?.encoder as ArchSuperFX;
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
): WorkspaceIndexOptions => ({ ...snesAssemblerHost, ...options });
