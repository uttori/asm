# Core and Node loader contracts

Use Node.js 26+ for packages and standalone hosts. The VS Code extension uses its editor's
bundled runtime. Published entry points contain JavaScript and TypeScript declarations with JSDoc.

## Public entry points

| Entry point                                             | Intended use                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `@uttori/asm-core`                                      | `Assembler`, file providers, diagnostics, architecture/decoder types, syntax, source maps, and tooling  |
| `@uttori/asm-core/canonical-json`                       | Canonical JSON values, compact equality, and pretty durable/review text                                 |
| `@uttori/asm-core/plugin`                               | Plugin definitions, contribution contracts, `PluginManager`, environments, state, and structured errors |
| `@uttori/asm-core/debug-map`                            | Debug-map serialization, validation, source mapping, and binary identity                                |
| `@uttori/asm-plugin-loader-node`                        | Configuration validation/discovery and trusted Node plugin loading                                      |
| `@uttori/asm-plugin-loader-node/asm-config.schema.json` | Editor JSON schema                                                                                      |

The core root also exposes `pluginApi` and the main plugin runtime classes/functions. Import
plugin types from `/plugin`. Front-end/lowering services, `ProgramModelBuilder`, IR types, LSP
helpers, `OwnedContribution`, and `PluginSessionStateStore` remain available for advanced hosts.
They require the same stage, target, and ownership invariants as `Assembler`. Most integrations
should use the assembler and manager. Package-internal `src/` and `dist/` paths are not entry points.

## Host lifecycle

```ts
import { Assembler } from "@uttori/asm-core";
import { NodePluginLoader } from "@uttori/asm-plugin-loader-node";

const loader = new NodePluginLoader();
try {
  const loaded = await loader.loadProjectEnvironment({ cwd: process.cwd() });
  const session = new Assembler({
    environment: loaded.environment,
    target: loaded.target,
    architecture: loaded.architecture,
    targetOptions: loaded.targetOptions,
  });
  try {
    session.setIncludePaths([...loaded.includePaths]);
    session.assembleSource("org $008000\nsei", "main.asm"); // Requires a configured 65816 target.
    const bytes = Uint8Array.from(session.getBinaryOutput());
    console.log(bytes);
  } finally {
    session.dispose();
  }
} finally {
  await loader.dispose();
}
```

For in-memory plugins, create a `PluginManager`, await `activatePlugins`, then call `freeze()`.
`activateModules` accepts already-imported module namespaces. It does not import paths itself.
Dispose the manager in `finally`, including when activation or freezing fails.

One environment can serve multiple independent sessions. Each session owns its mutable runtime.
The host owns the manager/loader and file provider. Finish and dispose sessions before replacing
or disposing their environment. Calls on a manager or loader must be serialized. Assembler
operations are synchronous and must not be re-entered from plugin callbacks.

## Assembly and state

`assembleSource` parses source text and runs `collectDefinitions`, `resolveLayout`, and `emitProgram`
in order. Source line inputs are zero-based. Read binary output only after successful assembly.
Failures can leave partial state. Use a fresh session after failure. `getBinaryOutput` delegates
to the output formatter without reassembling. Copy the returned bytes for independent ownership.
`baseImage` is copied at construction. `setIncludePaths` retains its supplied array.

`analyzeSource` uses an isolated temporary session, defaults to definition collection, and returns
recoverable diagnostics. Plugin construction or cleanup failures can still throw. `fileProvider`
supports virtual documents. Built-in file reads are synchronous. The default Node provider searches
the macro source directory, current source directory, include directories, then process cwd.

Plugin state slots are created for every registered contribution in each session, even when another
target is selected. `state.get(key)` returns the live mutable value. The plugin's `clone` hook must
copy mutable descendants to isolate stage snapshots. `resetForStage` runs before `onStageStart`.
Construction also enters `collectDefinitions`, so these hooks run once before the first build
and again when that build's definition pass starts. Reset hooks must tolerate repeated entry.
Keep state cloneable: discarded snapshots are not individually disposed. Low-level `restore`
adopts its supplied map without copying. Session construction is not a resource transaction.
Plugin-wide external resources belong in the activation disposable.

Lifecycle hooks run in registration order. The first `beforeDirective` result of `handled` skips
later middleware and the handler. The last defined `shouldEndifCloseInnermostWhile` result wins.
After emission, `onStageEnd` precedes `beforeOutputFinalize` and output-format finalization.
Session disposal reverses lifecycle order, then disposes live state slots in reverse order.

Logical addresses and physical output offsets are distinct byte addresses. Address width is in
bits, and write widths/instruction sizes are in bytes. A decoder-only architecture can be registered
for analysis, but every architecture selected by an assembly target must provide an encoder.
Expression `output.read` accepts a logical address and applies mapping. `output.canRead` checks
a physical offset. Both inspect the base image when present, otherwise current output.

## Activation and errors

`definePlugin` supplies typing and returns the same object. The manager performs validation.
Manifest `apiVersion` must equal `PLUGIN_API_VERSION`, independently of package semver.
Dependencies activate first. IDs are lowercase. Contribution IDs require a namespace dot.
Contributions must be registered before `activate` resolves and cannot be mutated after commit.

`validateOptions` supplies defaults or throws. Its result is frozen in place, including nested
objects, so return owned data. Without a validator, nonempty options are rejected. Each plugin's
registrations commit together. A later failed plugin does not roll back earlier successful plugins
in the batch. If activation throws before returning a disposable, it must clean up its own resources.
Freezing validates cross-contribution references and aliases and prevents further activation.

Handle `PluginError.code` and optional owner/module/target fields instead of matching messages.
Source errors can be ordinary errors. Disposal attempts all resources and reports `AggregateError`
after cleanup failures. Repeated disposal is a no-op. Never continue using disposed sessions or
plugin resources. Direct `AssemblerEnvironment` construction is an advanced path that assumes
already validated, frozen contribution records. Prefer `PluginManager.freeze()`.

## Loader configuration and caching

Discovery reads only `cwd/uttori-asm.config.json`. An absent discovered file means empty
configuration. An absent explicit file is an error. Validation does not execute plugins, fetch
`$schema`, read a base image, or build entry points. Its result retains nested input values.

Target, architecture, and include paths use host overrides, then configuration, then defaults.
With no explicit target, exactly one registered target is selected automatically. Zero or multiple
targets require a choice. Architecture defaults to that target's default architecture. Include
paths default to `["./"]`, become absolute, and are deduplicated.

Configuration plugin paths and packages resolve from the configuration directory. Host/default
modules resolve from cwd. Empty or absent configuration plugins allow the host's default plugin
list. Explicit `pluginModules` append. Exact bundled-plugin matches bypass module resolution.
`activateBundledPlugins` appends otherwise unused bundled entries. Plugin options merge shallowly:
configured values, module-specifier overrides, then plugin-ID overrides. Unknown override keys fail.
Target options are the target owner's merged options when it provides `createOptions`. The
assembler invokes that hook later. Use JSON-compatible option values and treat nested input as shared.

`NodePluginLoader` owns one active environment. An unchanged normalized snapshot reuses its handle.
Replacement disposes it before activating the new environment. A failure during configuration or
module resolution preserves the current environment. A failure after replacement begins does not.
The cache does not track module file contents, logger identity, or bundled plugin object identity.
Node's import cache remains in effect. This API is not a module hot-reloader.

The convenience `loadProjectEnvironment` shares a loader per absolute cwd. Any current handle's
disposal releases that shared environment. Handles are not reference-counted. An old disposed handle
does not evict its replacement. Use separate loader instances for independent lifetimes.

See [project configuration](https://github.com/uttori/asm/blob/master/packages/plugin-loader-node/CONFIGURATION.md) for user settings and
[plugin authoring](https://github.com/uttori/asm/blob/master/packages/plugin-author/GUIDE.md) for the runnable plugin example.
