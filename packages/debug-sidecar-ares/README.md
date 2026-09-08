# `@uttori/asm-debug-sidecar-ares`

Restartable ares debugger integration below Uttori ASM's emulator-neutral sidecar protocol.

This package does not contain or link ares emulator code. It hosts the candidate-specific process and GDB Remote Serial Protocol translation needed to expose a maintained ares build through `DebugBackend` and `DebugSidecarServer`. Ares binaries, licenses, revision manifests, and runtime resources remain separate distribution artifacts.

The RSP connection is restricted to numeric loopback addresses. It is an internal child-process control channel, not the authenticated editor protocol and not a network service intended for remote access.

## Graphical and headless runtimes

Runtime manifests accept `frontend: "desktop"` or `"headless"`; omission preserves the legacy headless
launch contract. Desktop uses the existing ares native UI and the same patched SNES/GDB/trace core.
The host supplies the selected loopback port through desktop settings, enables `Boot/AwaitGDBClient`,
disables the native debugger window, run-ahead, and rewind, and permits emulation while unfocused.
It does not pass headless-only CLI switches to the desktop executable. Both modes retain executable,
ROM, and resource verification and the existing bounded lifecycle/trace contract.

The local Secret of Mana desktop build includes two frontend coordination fixes: wait for the actual
GDB halt handshake rather than only TCP accept before releasing boot, and yield a stopped CPU back
to the frontend so its game window/settings remain responsive while VS Code owns stepping.
Launch stops at `$008004`; Continue starts the game. Keyboard/controller bindings are configured in
ares Settings → Input, not invented by the sidecar.

The desktop runtime passes all seven opt-in live SNES tests and a real VS Code launch/step/trace test.
It is a private macOS development build, **not** the reproducible headless release artifact described
below. Its additional patch, application resources, SDL framework, and signature have their own
manifest hashes. The existing six-file fork-drift and deterministic packaging gates must be extended
before promoting this desktop build; Windows/Linux desktop validation remains outstanding.

## Headless release baseline and live gates

`AresRspDebugBackend` translates the maintained fork's 65816 RSP target into the complete emulator-neutral backend contract: lifecycle events, threads and stack frames, registers, side-effect-free named memory, execute breakpoints, exact stepping, reconnect, bounded instruction tracing, and native-syntax disassembly. Public memory reads accept only direct `snes.wram` and `snes.cartridge-rom` storage through the private `uttoriNamedMemory+` fork extension; logical CPU-bus addresses remain valid for execution control and private disassembly reads but are not advertised as harmless memory. `uttoriInstructionTrace+` records only after an explicit start into a fixed 65,536-entry native ring and returns at most 240 ordered addresses per pull with cumulative loss metadata. Its capability manifest intentionally advertises SPC700 and SuperFX as present but unsupported until their live control hooks exist. A scripted RSP implementation passes all six frozen backend-conformance scenarios, including chunking requests above the 4,096-byte RSP packet budget.

The separate `UTTORI_ARES_SUPERFX_LIVE=1` test binds the current reproducible runtime to the intentional local Yoshi's Island fixture. It proves that a real GSU cartridge launches while the backend still exposes only its 65816 thread and rejects SuperFX operations according to the reduced manifest. Compiled emulation support is deliberately not treated as debugger support.

`AresProcessHost` owns the emulator below that backend. Every fresh launch requires a versioned manifest containing the upstream, headless-base, and exact fork revisions; separate headless-series and project-patch digests; host/build identity; executable and ROM hashes; and hashes for separately distributed runtime resources. The executable must be contained within the portable runtime root. The host verifies resources relative to that same root, launches there so ares resolves the verified databases/settings/saves, binds only a numeric loopback RSP endpoint, keeps emulator stdout/stderr away from neutral-protocol stdout, retries readiness within a deadline, preserves the process for detach/reconnect, and performs bounded TERM/KILL cleanup. The manifest verifies identity; it does not bundle the declared files.

The opt-in macOS arm64 live fixture uses only locally supplied artifacts. The selected current-upstream port is fork revision `0e74a98c72017f2c1aad2319e035f3a223c4196e` over upstream `7b51c8ab719e403a150aa700e0933d9e93a06851`, with headless-series digest `2853bfc22b1ce46d9adc3ac46bcf55c396ed5ce6f5a4cc2544c3034046f2ae76`, project-patch digest `1628ab0abb7b9325edd2e71f7587f6658d2ac2c21027c6824ce7eb8efc49b6b1`, and reproducible signed executable digest `556b9fd66ce5b6189ace4758d2bf786f6724627573956c87601adeaa41a3912d`. The authorized golden ROM reaches a deterministic first 65816 instruction at `$008004` and passes all six frozen backend scenarios. A production-path DAP regression also maps the reset sequence to temporary native source, sets line 2 through `setBreakpoints`, and proves that continue stops at `$008005` with the exact source path and line recovered by `stackTrace`. The direct cartridge-ROM path returns `18 FB E2 30 5C 10 00 C1` from raw offset `$008004` without traversing the mapped CPU bus. Set `UTTORI_ARES_LIVE=1` only on a host that has the separately managed paths and hashes declared by the test manifest; ordinary tests skip all seven ares live cases.

`npm run fixture:ares:drift:current` is the selected local promotion gate; `npm run fixture:ares:drift` retains the historical stale-draft audit. Both require the exact one-commit project topology and six-file allowlist, independently regenerate the complete nine-commit headless series and one-commit project patch byte-for-byte, verify the executable, intentional local test ROM, and runtime-resource hashes, and report upstream/fork drift from a real merge base. The current runtime is forward-ported to the pinned upstream revision and its macOS binary is byte-reproducible across independent build directories. `npm run fixture:ares:notices` stages and hashes the exact macOS link's aggregate and third-party notices into that manifest. `npm run fixture:ares:package` produces the deterministic manifest-allowlisted archive; the current 13-file artifact independently passes provenance and all live cases after extraction. Native release still requires Windows and Linux link/runtime validation.

The package builds the `uttori-asm-debug-sidecar-ares` executable, which accepts explicit manifest, ares, ROM, and isolated-runtime paths. Its stdout is reserved for the authenticated framed protocol; the private ares process cannot inherit the editor session token. The opt-in suite also passes all six scenarios through a real parent-side `SidecarDebugBackend` and child-side `DebugSidecarServer`, proving that the production process boundary preserves the live behavior.

The generated `out/sidecar.mjs` bundle independently passes the same live sidecar conformance path when invoked through Node. Its trace gate observes ordered producer traffic while enforcing the fixed native buffer and pull-batch ceilings; dropped producer events remain explicit rather than blocking control traffic or growing memory. Full-speed capture can lose many events and must not be interpreted as complete execution coverage. The package's narrow `./profile` export contains only immutable backend/capability data so the VS Code host can negotiate before launch without importing translator or process-host implementation.

An additional opt-in resilience case sends `SIGKILL` only to the exact emulator PID owned by the test. The parent survives, observes a restartable termination, rejects stale access, revalidates the manifest, starts a different PID, and returns to the deterministic initial boundary.

Contributor rules for the clean-room/GPL boundary, native manifests, upstream candidates, and release
evidence are in [CONTRIBUTING.md](../../CONTRIBUTING.md), the
[debug architecture](../../docs/disassembler-architecture.md#debug-architecture), and the
[native runtime inventory](../../docs/ares-native-runtime-distribution.md).

The maintained native [execution-detail supplement](native/README.md) adds negotiated full 65816 traces and safe SRAM/SPC700 ARAM peeks. See [capture semantics and limits](../../docs/snes-function-heuristics-and-runtime-code.md).
