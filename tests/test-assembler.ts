import { Arch6502 } from "../src/Arch6502.js";
import { Arch65816 } from "../src/Arch65816.js";
import { ArchSPC700 } from "../src/ArchSPC700.js";
import { ArchSuperFX } from "../src/ArchSuperFX.js";
import { Assembler as CoreAssembler } from "../src/assembler.js";
import type { ArchitectureExtension } from "../src/architecture-registry.js";
import type { AssemblyFileProvider } from "../src/file-provider.js";
import {
  createLegacyAssemblerEnvironment,
  snesAssemblerHost,
} from "../src/plugin/legacy-adapter.js";
import type { WorkspaceIndexOptions } from "../src/lsp/workspace-index.js";
import type { TargetProfile } from "../src/target-profile.js";

export type LegacyTestAssemblerOptions = {
  fileProvider?: AssemblyFileProvider;
  collectSourceMetadata?: boolean;
  targetProfile?: TargetProfile;
  architectureExtensions?: readonly ArchitectureExtension[];
};

/** Test-only compatibility facade for the pre-plugin constructor shape. */
export class Assembler extends CoreAssembler {
  private legacyTargetProfile?: TargetProfile;

  constructor(baseImage?: number[] | Uint8Array, options: LegacyTestAssemblerOptions = {}) {
    const host =
      options.targetProfile || options.architectureExtensions
        ? createLegacyAssemblerEnvironment({
            targetProfile: options.targetProfile,
            architectureExtensions: options.architectureExtensions,
          })
        : snesAssemblerHost;
    super({
      ...host,
      architecture: options.targetProfile?.defaultArchitecture,
      baseImage,
      fileProvider: options.fileProvider,
      collectSourceMetadata: options.collectSourceMetadata,
    });
    this.legacyTargetProfile = options.targetProfile;
    this.arch = options.targetProfile?.defaultArchitecture ?? "65816";
  }

  override selectArchitecture(architecture: string, sourceAlias = architecture): void {
    const canonical = this.architectureRegistry.getCanonicalName(architecture);
    if (!canonical) {
      if (this.legacyTargetProfile) {
        super.selectArchitecture(architecture, sourceAlias);
        return;
      }
      throw new Error(`Unsupported architecture: ${architecture}`);
    }
    super.selectArchitecture(canonical, sourceAlias);
    const contribution = this.environment.getArchitecture(canonical);
    this.arch = contribution?.aliases?.[0] ?? canonical;
  }

  get arch65816(): Arch65816 {
    return this.architectureRegistry.getDefinition("65816")?.encoder as Arch65816;
  }

  get arch6502(): Arch6502 {
    return this.architectureRegistry.getDefinition("6502")?.encoder as Arch6502;
  }

  get archSPC700(): ArchSPC700 {
    return this.architectureRegistry.getDefinition("spc700")?.encoder as ArchSPC700;
  }

  get archSuperFX(): ArchSuperFX {
    return this.architectureRegistry.getDefinition("superfx")?.encoder as ArchSuperFX;
  }
}

export const snesWorkspaceIndexOptions = (
  options: Omit<WorkspaceIndexOptions, "environment" | "target"> = {},
): WorkspaceIndexOptions => ({ ...snesAssemblerHost, ...options });
