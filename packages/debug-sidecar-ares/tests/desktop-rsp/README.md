# Sidecar desktop integration test

This test exercises the TypeScript sidecar's RSP client against a desktop ares
executable. It belongs to the sidecar and is excluded from the ares contributions.
The ares native tests use CMake/CTest and shell scripts with no Node dependency.

From the outer repository root:

```sh
node --import=tsx packages/debug-sidecar-ares/tests/desktop-rsp/desktop-rsp.mjs \
  /absolute/path/to/ares /tmp/ares-desktop-evidence.json --quiescent --gui-quit
```

With `--gui-quit`, use the application's normal Quit action when the runner says
it is ready. The runner requires a clean exit while the debugger is halted.
The synthetic ROM and settings are isolated in a temporary directory and removed
after the test. Type/lint/format checks use `npm run desktop-rsp:check --workspace=@uttori/asm-debug-sidecar-ares`.
