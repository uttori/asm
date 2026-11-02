/** disassembler contracts. Node host operations own filesystem resources and must honor documented disposal/publication rules. */
export {
  type Snes65816EntryPoint,
  type Snes65816AnalysisOptions,
  type Snes65816AnalysisResult,
  analyzeSnes65816,
} from "./disassembler/65816-analysis.js";
export {
  type Cpu65816AbstractValue,
  type Cpu65816StatusStackEntry,
  type Cpu65816ValueStackEntry,
  type Cpu65816StackEntry,
  type Cpu65816AbstractStack,
  type Cpu65816AbstractState,
  type Cpu65816StateOverride,
  unknownCpu65816State,
  resetCpu65816State,
  nativeVectorCpu65816State,
  emulationVectorCpu65816State,
  joinCpu65816States,
  applyCpu65816StateOverride,
  enterCpu65816Address,
  cpu65816DecodeState,
  transferCpu65816State,
  cpu65816StateKey,
} from "./disassembler/65816-state.js";
export {
  SNES_FILE_ADDRESS_SPACE,
  SNES_CPU_ADDRESS_SPACE,
  SNES_WRAM_ADDRESS_SPACE,
  SNES_SRAM_ADDRESS_SPACE,
  SNES_WRAM_ADDRESS_SPACE_DESCRIPTOR,
  SNES_SRAM_ADDRESS_SPACE_DESCRIPTOR,
  type SnesAddressIdentity,
  createSnesAddressContext,
  identifySnesFileOffset,
  identifySnesCpuAddress,
} from "./disassembler/address-identities.js";
export {
  type DizRawImportResult,
  type DizRawImportOptions,
  importDizRaw,
} from "./disassembler/dizraw-import.js";
export {
  type SnesHardwareDefine,
  type SnesHardwareRegister,
  identifySnesHardwareRegister,
  SNES_HARDWARE_DEFINES_SOURCE,
  snesHardwareDefineRecords,
  snesHardwareDefines,
  renderSnesHardwareDefines,
} from "./disassembler/hardware-registers.js";
export {
  type FrameworkRelativePointer,
  type FrameworkAssetExtractionRange,
  type FrameworkSamplePointer,
  type FrameworkSampleExtractionRange,
  decodeFrameworkRelativePointerTable,
  deriveFrameworkAssetExtractionRanges,
  decodeFrameworkSamplePointers,
  deriveFrameworkSampleExtractionRanges,
} from "./disassembler/framework-asset-helpers.js";
export {
  SNES_MAPPERS,
  type SnesMapper,
  isSnesMapper,
  type SnesCpuVectorDefinition,
  SNES_CPU_VECTOR_DEFINITIONS,
  type SnesExpandedRomHeader,
  type SnesCpuVector,
  type SnesInternalRomHeader,
  snesInternalHeaderOffset,
  parseSnesInternalRomHeader,
  type SnesRomDetectionOptions,
  type SnesRomDetection,
  detectSnesRom,
} from "./disassembler/rom-header.js";
export {
  type SnesSourceExportOptions,
  formatSnes65816SourceInstruction,
  snesSourceLabelNames,
  exportSnes65816Source,
} from "./disassembler/source-export.js";
export {
  type BuildSnesSourceOptions,
  type SnesSourceBuild,
  type InspectSnesSourceOptions,
  type SnesSourceInspection,
  type InspectSnesModuleOptions,
  inspectSnesSourceModule,
  inspectSnesSource,
  buildSnesSource,
} from "./disassembler/source-build.js";
export {
  type PrepareSnesGenerationOptions,
  type PreparedSnesGeneration,
  snesGenerationOptionsHash,
  prepareSnesGeneration,
} from "./disassembler/source-generation.js";
export {
  type SnesLayoutDiagnostic,
  type SnesInstructionStateContract,
  type SnesFixedExtent,
  type SnesPlacementContract,
  checkSnesPlacements,
  type SnesLayoutCheckOptions,
  checkSnesSourceLayout,
} from "./disassembler/rom-layout/check.js";
export {
  type SnesFreeSpace,
  type SnesMovableObject,
  type SnesRelocationReference,
  assertSnesSplitReferences,
  type SnesRelocationPlan,
  encodeSnesRelocationReference,
  planSnesRelocation,
} from "./disassembler/rom-layout/relocate.js";
export {
  type SnesSourceObject,
  type SnesSourceFreeSpace,
  type SnesSourceReference,
  type SnesSourceRelocation,
  prepareSnesSourceRelocation,
} from "./disassembler/rom-layout/source-relocation.js";
export {
  SPC700_ARAM_ADDRESS_SPACE,
  SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR,
  type Spc700AramAddressIdentity,
  Spc700AramImage,
} from "./disassembler/spc700-address-space.js";
export {
  type Spc700EntryPoint,
  type Spc700AnalysisOptions,
  type Spc700AnalysisResult,
  analyzeSpc700Aram,
} from "./disassembler/spc700-analysis.js";
export {
  type Spc700HardwareRegister,
  identifySpc700HardwareRegister,
} from "./disassembler/spc700-hardware-registers.js";
export {
  type Spc700DirectPageValue,
  type Spc700StackEntry,
  type Spc700AbstractStack,
  type Spc700AbstractState,
  type Spc700StateOverride,
  unknownSpc700State,
  applySpc700StateOverride,
  joinSpc700States,
  spc700StateKey,
  spc700DecodeState,
  transferSpc700State,
} from "./disassembler/spc700-state.js";
export {
  type Spc700UploadBlock,
  type Spc700UploadStream,
  type Spc700UploadParseOptions,
  type Spc700UploadAramSegment,
  type Spc700UploadProjectRecords,
  parseSpc700UploadStream,
  materializeSpc700UploadBlock,
  spc700UploadProjectRecords,
} from "./disassembler/spc700-upload.js";
export {
  renderSpc700AramSource,
  renderSpc700UploadSource,
  renderSuperFxRomSource,
} from "./disassembler/processor-source-export.js";
export {
  type SnesProjectInitializationStage,
  type SnesProjectInitializationProgress,
  type SnesProjectOperationOptions,
  SnesProjectInitializationCancelledError,
  type SnesDizRawProbe,
  type SnesProjectProbeResult,
  type ProbeSnesProjectOptions,
  type CreateSnesAnalysisProjectOptions,
  type CreateSnesAnalysisProjectResult,
  type AnalyzeSnesProjectOptions,
  type AnalyzeSnesProjectResult,
  probeSnesProject,
  createSnesAnalysisProject,
  analyzeSnesProject,
} from "./disassembler/project-initializer.js";
export {
  SNES_RAM_MAP_FORMAT,
  SNES_RAM_MAP_SCHEMA_VERSION,
  SNES_RAM_MAP_SOURCE,
  SNES_RAM_MAP_SCHEMA_SOURCE,
  SNES_RAM_DEFINES_SOURCE,
  type SnesRamMapVariableInput,
  type SnesRamMapFile,
  type SnesRamMapVariable,
  type LoadedSnesRamMap,
  validateSnesRamMap,
  emptySnesRamMap,
  loadSnesRamMap,
  canonicalSnesWramAddress,
  indexSnesRamMap,
  renderSnesRamDefines,
  renderSnesRamMapSchema,
} from "./disassembler/ram-map.js";
export {
  SUPERFX_ROM_ADDRESS_SPACE,
  SUPERFX_ROM_ADDRESS_SPACE_DESCRIPTOR,
  type SuperFxRomAddressIdentity,
  SuperFxRomImage,
} from "./disassembler/superfx-address-space.js";
export {
  type SuperFxEntryPoint,
  type SuperFxAnalysisOptions,
  type SuperFxAnalysisResult,
  analyzeSuperFxRom,
} from "./disassembler/superfx-analysis.js";
export {
  type SuperFxKnown,
  type SuperFxAbstractState,
  initialSuperFxState,
  joinSuperFxStates,
  superFxDecodeState,
  enterSuperFxAddress,
  transferSuperFxState,
  superFxStateKey,
} from "./disassembler/superfx-state.js";
export { analyzeSnesRuntimeCode } from "./disassembler/runtime-code.js";
export {
  loadSnesStructMap,
  validateSnesStructMap,
  planSnesStructRomFields,
} from "./disassembler/struct-map.js";
export {
  type SnesRomExpansionPolicy,
  expansionHeaderOffset,
  assertSnesRomExpansion,
  expandedPristineRom,
  checkSnesRomExpansion,
} from "./disassembler/rom-layout/expansion.js";
export {
  type SnesSourceExpansion,
  prepareSnesSourceExpansion,
} from "./disassembler/rom-layout/source-expansion.js";
export { initializeSnesSourceProject } from "./disassembler/source-initialize.js";

export { snesSourceTarget } from "./disassembler/source-target.js";
