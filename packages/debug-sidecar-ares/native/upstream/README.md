# Desktop contribution series through U6

The canonical prepared source is `fixtures/external/ares` on
`codex/ares-desktop-u6`. `series.json` fixes the upstream base, ordered commits,
authors, patch hashes, and exact changed-file hashes. U3/U4/U5 include native
tests and have separate local branches: `codex/ares-upstream-u3`,
`codex/ares-upstream-u4`, and `codex/ares-upstream-u5`.

Apply the seven numbered patches in order with `git am` to the manifest's
upstream revision. U1/U2 remain independent submitted changes; their position
after U3–U5 here is the local integration order. The U2 cherry-pick's whitespace
conflict was resolved by retaining U3–U5, applying the polling correction, and
retaining U2's trailing-whitespace cleanup. The exact result is checked.

The sixth layer adds U2's native CMake/CTest regression and shell launcher.
`codex/ares-upstream-u2-tests` starts at the submitted PR head, with its independent
follow-up exported as [u2-tests-followup.patch](u2-tests-followup.patch).
The [draft PR update](u2-tests-pr.md) and `pollingTestFollowUp` in the manifest
record that separate review surface. It has not been pushed.

The final `U5-states` layer fixes save/load/undo while stopped in GDB and refreshes
the stopped PC after a synchronized load. It adds real SFC coroutine/serializer
regressions in both PPU modes and enables Release assertions after nall's
build-mode header. Include this follow-up when preparing U3–U5 for publication;
the earlier contribution branch heads are preserved in the manifest.

All ares contribution tests use C++ and CMake/CTest with `run-tests.sh` launchers.
The verifier below uses shell and CMake; neither path needs Node.js.

```sh
packages/debug-sidecar-ares/native/upstream/verify-series.sh fixtures/external/ares
```

This verifies complete tree identity after every layer, not just an allowlist.
It supplements the legacy release-pinned drift checker; it does not weaken or
replace that check or promote an existing runtime. `source-inventory.json`
records the preserved old checkpoint and all twelve modified native files.
The obsolete alternate-frontend series is archived locally and excluded here.

The ares patches retain their Git authorship and are covered by the applicable
ares/nall source licenses. Preserve the source tree's `LICENSE` and component/dependency notices when distributing a built runtime. The outer repository's
license does not relicense these patches.

See the [evidence and reproduction guide](../../../../docs/ares-upstream-u1-u6-evidence.md),
[RFC](../../../../docs/ares-capture-rfc.md), and
[neutral v2 design](../../../../docs/ares-capture-v2-design.md).
