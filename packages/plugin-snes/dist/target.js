/** target contracts. Node host operations own filesystem resources and must honor documented disposal/publication rules. */
export { ASAR_COMPAT_NO_OP_DIRECTIVES, assertMapperAvailable, applyMapperSelection, isFreespaceAvailable, encodeSuperFxMoveShortAddress, getChecksumHeaderOffset, calculateHeaderChecksum, shouldRedirectOrgToSpcblock, shouldEnableSpcInlineCompat, shouldUseNoromAddressing, shouldAutoCloseSpcblock, shouldEndifCloseInnermostWhile, } from "./asar/compatibility.js";
export { handleA8, handleA16, handleAccu, handleI8, handleI16, handleIndex, handleSmart, resolveSnesCpuName, handleSetcpu, handlePushcpu, handlePopcpu, } from "./directives/ca65-compat.js";
export { SNES_SESSION_STATE_ID, snesSessionStateKey, cloneSnesSessionState, } from "./session-state.js";
export { createSpcRuntime } from "./directives/spc.js";
export { snesRomAddressSpace, } from "./target/address-space.js";
export { createSnesLinkTarget } from "./target/link-target.js";
//# sourceMappingURL=target.js.map