/** target contracts. Node host operations own filesystem resources and must honor documented disposal/publication rules. */
export {
  ASAR_COMPAT_NO_OP_DIRECTIVES,
  type MapperCompatibilityState,
  assertMapperAvailable,
  applyMapperSelection,
  isFreespaceAvailable,
  type ChecksumMode,
  type SuperFxMoveShortAddressMode,
  encodeSuperFxMoveShortAddress,
  getChecksumHeaderOffset,
  calculateHeaderChecksum,
  shouldRedirectOrgToSpcblock,
  shouldEnableSpcInlineCompat,
  shouldUseNoromAddressing,
  shouldAutoCloseSpcblock,
  shouldEndifCloseInnermostWhile,
} from "./asar/compatibility.js";
export {
  handleA8,
  handleA16,
  handleAccu,
  handleI8,
  handleI16,
  handleIndex,
  handleSmart,
  resolveSnesCpuName,
  handleSetcpu,
  handlePushcpu,
  handlePopcpu,
} from "./directives/ca65-compat.js";
export {
  SNES_SESSION_STATE_ID,
  type SnesSpcBlockType,
  type SnesSpcBlockData,
  type SnesSessionState,
  snesSessionStateKey,
  cloneSnesSessionState,
} from "./session-state.js";
export { createSpcRuntime } from "./directives/spc.js";
export {
  type AddressSpaceContext,
  type SnesRomAddressSpace,
  snesRomAddressSpace,
} from "./target/address-space.js";
