# ares runtime setup and distribution

The sidecar requires a separately built ares runtime with the capabilities and hashes declared
by its runtime manifest. Stock ares is not a compatible debugger runtime. Native validation has
been performed on macOS. Linux and Windows native-runtime validation remains open.

## Configure a runtime

In VS Code, run **Assembly: Configure Emulator Runtime** and select the matching executable,
runtime directory, and `ares-runtime-manifest.json`. Restart debugging after changing the runtime.

Desktop launches honor `Paths/Saves` in the selected runtime's `settings.bml`; when unset,
ares stores SRAM and numbered save states beside the ROM. When staging a replacement
runtime, retain that setting so the same saves remain visible. The launcher does not
override the desktop save path or relocate existing files.
See the [editor guide](https://github.com/uttori/asm/blob/master/packages/vscode-extension/GUIDE.md#live-debugging)
for launch settings and the [sidecar README](README.md#runtime-setup) for standalone invocation.

Keep the executable, required databases/resources, settings, and manifest together. The manifest
binds the executable and resource hashes to the source revision, patches, and build configuration.
The host verifies them before launch. Capture features require their own negotiated capabilities.
An emulator's ability to run a processor does not imply debugger or capture support for it.

Native capture candidates are separate from the default runtime. Select a manifest that explicitly
supports the requested [capture mode and sink](CAPTURE.md). An unsupported request fails.

## Build and stage

The [native source inventory](native/README.md) and [upstream contribution package](native/upstream/README.md)
identify the patch layers and reproduction commands. Apply only patches matching their recorded
base revision. The prepared upstream series and downstream capture supplements have distinct bases.

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
