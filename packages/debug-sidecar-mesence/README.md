# `@uttori/asm-debug-sidecar-mesence`

Clean-room MIT translator between Uttori ASM's emulator-neutral `DebugBackend` and the bounded debugger protocol implemented by the separately maintained MesenCE spike.

This package does not contain, copy, link, or distribute MesenCE code. MesenCE remains a separate GPL program and distribution artifact. The candidate-specific command names and response validation live below the neutral backend boundary so editor, DAP, and analysis code never receive MesenCE types.

`MesenDebugBackend` currently translates coherent stopped state plus 65816, SPC700, and SuperFX threads, registers, stack frames, side-effect-suppressed named memory, project-native disassembly, exact steps, 65816 execute breakpoints, reconnects, and ordered lifecycle events. The SuperFX surface includes its debugger instruction PC, pipelined R15, selector registers, program-read buffer, banks, SFR flags, and cycles so ALT state and delayed branches remain visible. Since the experimental native protocol is request/response only, the translator uses one bounded status request at a time while running to synthesize a stopped event. Instruction tracing and SPC700/SuperFX breakpoint sets remain explicitly unsupported.

`MesenProcessHost` verifies a versioned source/patch/binary/ROM/resource manifest before launching a separate portable MesenCE runtime. The generated `uttori-asm-debug-sidecar-mesence` executable accepts explicit manifest, emulator, ROM, and portable-runtime paths. Its stdout is reserved for the authenticated neutral protocol; the editor session token is stripped before launch and replaced by a distinct private token used only on numeric loopback.

The standard opt-in live suite uses `UTTORI_MESEN_LIVE=1` and the intentional local Secret of Mana fixture. The separate `UTTORI_MESEN_SUPERFX_LIVE=1` case uses the manifest-declared local Yoshi's Island fixture, waits for active GSU execution, aligns to a GSU-owned stop, and proves one exact pipelined instruction through the built sidecar. Neither ROM, native runtime, manifest, nor GPL-side patch is included in this MIT package.

The generated 157,886-byte `out/sidecar.mjs` bundle (SHA-256 `bebfdd84606d4ebad23bf8b90716846f1f5ee50a9272cc2824390f71106a4bee`) passes the complete live 65816 conformance suite plus exact SPC700 and active SuperFX cases. The package's narrow `./profile` export contains only immutable backend/capability data so the VS Code host can negotiate before launch without importing translator, process-host, native-service, or GPL implementation.

Before changing this translator or the separately licensed service, read the clean-room, capability,
and native-evidence rules in [CONTRIBUTING.md](../../CONTRIBUTING.md) and the
[debug architecture](../../docs/disassembler-architecture.md#debug-architecture).
