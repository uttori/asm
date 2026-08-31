# Plugin Author Example

This minimal plugin is a working copy of the test fixture pattern. It contributes a one-byte architecture, a flat address space, raw output, one directive, one session-state slot, and the `example.raw` target.

From the repository root:

```sh
npm run cli -- packages/plugin-author/main.asm packages/plugin-author/main.bin \
  --config packages/plugin-author/uttori-asm.config.json
```

The output is one byte, `0x42`. The plugin imports only the documented `@uttori/asm-core/plugin` entry point and exports an `AssemblerPlugin` as its default export. Copy this directory when starting a plugin, then give every manifest and contribution ID a package-specific namespace.
