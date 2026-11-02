# ares runtime setup and distribution

The sidecar requires a separately built ares runtime with the capabilities and hashes declared
by its runtime manifest. Stock ares is not a compatible debugger runtime. Native validation has
been performed on macOS. Linux and Windows native-runtime validation remains open.

## Configure a runtime

In VS Code, run **Assembly: Configure Emulator Runtime** and select the matching executable,
runtime directory, and `ares-runtime-manifest.json`. Restart debugging after changing the runtime.

Pin SRAM and numbered save states outside the runtime with launch setting
`"saveDirectory": "${workspaceFolder}/.uttori-local/saves"`, or sidecar option
`--save-dir /absolute/project/saves`. That explicit path survives replacement of the
executable, runtime directory and settings file; the runtime picker retains an existing pin.
ares stores each system beneath this root and keys files by ROM basename, so keep that
basename stable across source builds. Copy existing states into the matching system folder
before switching; the launcher never overwrites or silently migrates saved progress.

Without an explicit pin, desktop launches honor `Paths/Saves` in the selected runtime's
`settings.bml`; when unset, ares saves beside the ROM. Legacy headless defaults are unchanged.
Persistent storage prevents files disappearing during updates; an upstream change to the
emulator's state format can still make an older state incompatible.
See the [editor guide](https://github.com/uttori/asm/blob/master/packages/vscode-extension/GUIDE.md#live-debugging)
for launch settings and the [sidecar README](README.md#runtime-setup) for standalone invocation.

Keep the executable, required databases/resources, settings, and manifest together. The manifest
binds the executable and resource hashes to the source revision, patches, and build configuration.
The host verifies them before launch. Capture features require their own negotiated capabilities.
An emulator's ability to run a processor does not imply debugger or capture support for it.

Native capture candidates are separate from the default runtime. Select a manifest that explicitly
supports the requested [capture mode and sink](CAPTURE.md). An unsupported request fails.

## Build and stage

Build from `fixtures/external/ares`. Configure with `-DARES_BUILD_OPTIONAL_TARGETS=ON`,
then run that checkout's CTest launchers:

```sh
fixtures/external/ares/tests/gdb-polling/run-tests.sh /absolute/path/to/build
fixtures/external/ares/tests/gdb-capture/run-tests.sh /absolute/path/to/build
fixtures/external/ares/tests/gdb-states/run-tests.sh /absolute/path/to/build
```

On a Command Line Tools host, the compiler needs the same explicit libc++ header path as
the desktop CMake build:

```sh
CPLUS_INCLUDE_PATH=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/c++/v1 \
  fixtures/external/ares/tests/gdb-polling/run-tests.sh /absolute/path/to/build
```

Stage into a new directory and retain the previous runtime for rollback. Copy the built executable
and its required resources. On macOS, sign the staged app before hashing it. Update the executable
and resource hashes in the manifest, include the complete source patches as hashed resources, and
record their build configuration. Keep ROMs and user saves outside distribution archives.

## Distribution and notices

Native runtimes are distributed separately from the MIT npm packages. A runtime archive contains
its executable, required databases, license texts, source patches, and manifest. The ares aggregate
license and every linked dependency's notices must accompany it. The current headless macOS link
includes ares/nall/mia/libco, SLJIT, libchdr, LZMA SDK, miniz, Zstandard, and TZXFile notices.
Inspect other platform link inputs independently.

From the repository root:

```sh
npm run fixture:ares:notices
npm run fixture:ares:drift:current
npm run fixture:ares:package
```

Notice staging records license hashes in the manifest. The macOS packager uses a manifest-derived
allowlist, rejects symlinks, traversal, missing notices, and hash drift, and normalizes archive
metadata. It excludes ROMs, saves, user settings, build trees, and npm-sidecar implementation files.
Two invocations with identical inputs must produce the same digest.

Before publishing, rebuild from pinned sources and toolchains, verify the exact final artifact,
and run the shared live conformance suite against that manifest-bound runtime. The portable
JavaScript suite alone does not establish native platform support. See [testing and release gates](https://github.com/uttori/asm/blob/master/TESTING.md#debugger-and-native-runtime-gates).
