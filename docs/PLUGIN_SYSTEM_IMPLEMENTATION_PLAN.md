# Plugin System Implementation Plan

Status: in progress - Phases 0 through 4 complete
Scope: replace constructor-time extension injection with a complete, trusted, in-process plugin system and move every SNES-specific production behavior into a first-party SNES plugin
Compatibility policy: public API compatibility is not required; behavioral regressions covered by the test and fixture suites are not permitted

## 1. Required outcome

At the end of this work:

- The assembler core knows nothing about the SNES, 65816, SPC700, Super FX, SFC files, SNES mappers, RATS/freespace blocks, SNES checksums, or Asar's SNES-specific compatibility behavior.
- A first-party SNES plugin provides all current SNES behavior and passes the existing SNES unit, integration, and byte-parity fixtures.
- A plugin is a loadable ESM package with a manifest, API-version validation, configuration, lifecycle, owned registrations, collision detection, session state, build contributions, and tooling metadata.
- The CLI, language server, VS Code extension, programmatic API, and analysis sessions all use the same resolved plugin environment.
- The 65xx implementation is a separate production plugin, proving that a non-SNES target can be installed without coupling it to the SNES plugin.
- Core can assemble a small program supplied by a test plugin while the SNES plugin is absent.
- `npm run verify` and the SNES fixture gates pass after every mergeable phase.

This is intentionally an API-breaking redesign. Do not preserve `new Assembler()` defaulting to SNES, direct writes to `assembler.mapper`, concrete `arch65816` fields, or the current `targetProfile`/`architectureExtensions` constructor options merely for compatibility.

## 2. Current baseline

The repository already has useful extension seams:

- `ArchitectureExtension` creates a session-bound encoder.
- `TargetProfile` separates architecture selection, address mapping, output finalization, and feature flags.
- `DirectiveRegistry` supports handler registration.
- `InstructionCatalogProvider` allows a non-default instruction catalog.
- `Assembler.createToolingSession()` recreates architecture factories per session.

These are dependency-injection contracts, not a plugin system. The missing system-level behavior is:

- package discovery and module loading;
- plugin manifests and API compatibility checks;
- activation and disposal;
- registration ownership and duplicate handling;
- target-scoped directive and expression contributions;
- plugin-owned per-session state and stage snapshots;
- lifecycle hooks for pass and output behavior;
- project configuration and CLI/editor propagation;
- a shared tooling catalog assembled from active plugins; and
- enforcement that core does not import or embed SNES behavior.

The current branch's uncommitted extensibility work is the starting baseline. Preserve it while implementing the phases below; do not discard or overwrite it when moving files.

## 3. Architectural decisions

These decisions are part of the plan and should not be reopened during implementation unless a concrete repository constraint makes one impossible.

### 3.1 Package boundaries

Convert the repository to these workspace boundaries:

```text
packages/
  core/                       # architecture-neutral parser, pipeline, APIs, and tooling adapters
  plugin-loader-node/         # Node ESM discovery, config loading, and module resolution
  cli/                        # generic command-line host
plugins/
  snes/                       # all current SNES/Asar/65816/SPC700/Super FX behavior
  65xx/                       # 6502-family architectures and flat/raw target
language-server/              # generic LSP host using core + loader
editors/vscode/               # generic assembly extension and plugin configuration UI
tests/
  core/                       # architecture-neutral tests and fixture plugin
  integration/                # host/plugin integration tests
fixtures/
  snes/                       # existing Asar and production SNES fixtures
```

Use these workspace package names internally. `uttori-asm` is the umbrella
project; target names such as SNES belong to their plugin packages:

- `@uttori/asm-core`
- `@uttori/asm-plugin-loader-node`
- `@uttori/asm-cli`
- `@uttori/asm-plugin-snes`
- `@uttori/asm-plugin-65xx`

The root `package.json` becomes the private workspace/test orchestrator. Publishing or preserving the current root package shape is not required for this migration.

### 3.2 Trusted in-process plugins

Version 1 plugins execute in the host Node process and therefore have normal Node permissions. There is no sandbox, worker isolation, marketplace, remote download, signature verification, or hot reload in this plan.

The consequences must be explicit:

- Only configured packages and paths are loaded; never scan `node_modules` automatically.
- The CLI and documentation state that plugins are trusted code.
- VS Code loads workspace-configured plugins only in a trusted workspace.
- A plugin failure is diagnosed with its plugin ID and contribution ID, but process-level malicious behavior cannot be contained.

Isolation can be designed later without changing the contribution model, because plugin activation and session factories are already centralized.

### 3.3 Async loading, synchronous assembly

Module discovery and plugin activation are asynchronous host-startup operations. Assembly remains synchronous:

```text
asm.config.json
      |
      v
Node plugin loader --await--> PluginManager --freeze--> AssemblerEnvironment
                                                       |       |       |
                                                       v       v       v
                                                    build   analysis   LSP
                                                   session  session   catalog
```

An `Assembler` receives a frozen `AssemblerEnvironment` and a target ID. It never imports packages, reads project configuration, or activates plugins itself.

### 3.4 No implicit SNES default in core

`@uttori/asm-core` must not import the SNES plugin and must not contain a default target. Constructing an assembler requires an environment and target selection. A missing target produces a clear configuration error.

The CLI and language-server distributions may bundle `@uttori/asm-plugin-snes` and select it as their product-level default when no project configuration exists. That default belongs to the host, not core.

### 3.5 Immutable environment, session-bound implementations

Activation builds an immutable environment containing contribution descriptors and factories. Anything that reads or mutates assembly state is created per `AssemblerSession`.

Never store an encoder, directive handler, address-space instance, lifecycle hook instance, or mutable plugin option object in a process-global registry.

### 3.6 Fail-fast collision policy

Version 1 has no contribution overrides.

- Plugin IDs are globally unique.
- Contribution IDs are globally unique and namespaced by convention (`snes.target`, `snes.65816`, and so on).
- User-facing aliases and directive keywords are unique within a resolved target.
- Registration of a duplicate ID or alias fails activation and names both owning plugins.
- A failed plugin activation is transactional: none of that plugin's contributions are committed.
- Disposal occurs in reverse activation order.

An explicit override model may be added in a later plugin API version.

## 4. Version 1 plugin API

Create the public contracts under `packages/core/src/plugin/`. Keep this package free of Node-specific loading logic.

### 4.1 Module and manifest

The concrete API should follow this shape:

```ts
export const PLUGIN_API_VERSION = 1 as const;

export interface AssemblerPluginManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: typeof PLUGIN_API_VERSION;
  description?: string;
  requires?: ReadonlyArray<{
    pluginId: string;
    version: string;
  }>;
}

export interface AssemblerPlugin<Options = unknown> {
  manifest: AssemblerPluginManifest;
  validateOptions?(configured: unknown): Options;
  activate(
    context: PluginActivationContext,
    options: Readonly<Options>,
  ): void | PluginDisposable | Promise<void | PluginDisposable>;
}

export interface PluginDisposable {
  dispose(): void | Promise<void>;
}

export function definePlugin<Options>(plugin: AssemblerPlugin<Options>): AssemblerPlugin<Options>;
```

Rules:

- A plugin module exports the plugin as `default`. Named exports are optional.
- `definePlugin` is an identity helper that improves type inference; runtime validation still occurs in the manager.
- Validate IDs, versions, API version, dependencies, options shape, and all contribution descriptors before commit.
- Use semantic versions for plugin versions and dependency ranges. Add `semver` to the package that owns `PluginManager` rather than implementing range parsing.
- If `validateOptions` is omitted, only `undefined` or an empty object is accepted. A plugin with options must validate and normalize them before `activate` runs.
- API version 1 compatibility is exact-major compatibility. A future core may support multiple major adapters, but v1 does not.

### 4.2 Activation registrar

`PluginActivationContext` exposes registration methods, a namespaced logger, and the plugin's validated options. It does not expose an `Assembler` instance.

```ts
export interface PluginActivationContext {
  readonly pluginId: string;
  readonly logger: PluginLogger;

  registerSessionState<T>(contribution: SessionStateContribution<T>): SessionStateKey<T>;
  registerArchitecture(contribution: ArchitectureContribution): void;
  registerAddressSpace(contribution: AddressSpaceContribution): void;
  registerOutputFormat(contribution: OutputFormatContribution): void;
  registerDirectiveSet(contribution: DirectiveSetContribution): void;
  registerExpressionSet(contribution: ExpressionSetContribution): void;
  registerLifecycle(contribution: LifecycleContribution): void;
  registerTarget(contribution: TargetContribution): void;
}
```

Each registration is recorded with `{ pluginId, contributionId, registrationOrder }`. Do not expose the manager's mutable maps.

### 4.3 Target composition

Replace the closed `TargetDirectiveFeature` and `TargetExpressionFeature` unions with contribution IDs:

```ts
export interface TargetContribution {
  id: string;
  aliases?: readonly string[];
  displayName: string;
  defaultArchitecture: string;
  architectures: readonly string[];
  addressSpace: string;
  outputFormat: string;
  directiveSets: readonly string[];
  expressionSets: readonly string[];
  lifecycle: readonly string[];
  defaultOutputExtension: string;
  createOptions?(configured: unknown): Readonly<Record<string, unknown>>;
}
```

Environment freezing resolves every referenced ID and rejects:

- missing contribution references;
- architecture aliases that resolve outside the target;
- duplicate directive keywords after directive sets are composed;
- duplicate expression function names;
- invalid default architectures; and
- targets whose address-space or output-format factories cannot be resolved.

The generic core language is always present. Target contribution lists add target/dialect behavior; they do not need to repeat core macros, labels, symbols, includes, generic data emission, or generic layout directives.

### 4.4 Plugin-owned session state

SNES state cannot remain as fields on `Assembler`. Add typed state slots:

```ts
export interface SessionStateContribution<T> {
  id: string;
  create(context: SessionCreationContext): T;
  clone(value: T): T;
  resetForStage?(value: T, stage: AssemblyStageName): void;
  dispose?(value: T): void;
}

export interface SessionStateStore {
  get<T>(slot: SessionStateKey<T>): T;
}
```

`SessionStateKey<T>` is an opaque value returned by registration or `defineSessionState`; plugins keep their key and use it in their factories. Core stores state by fully qualified contribution ID.

Requirements:

- Create state once per assembler/analysis session.
- Clone every active plugin state slot when stage state is cloned.
- Restore plugin state alongside cursor, symbol, and control state.
- Run `resetForStage` deterministically after core stage reset.
- Dispose session state in reverse contribution order.
- Never assume plugin state is JSON serializable; require its explicit `clone` function.

The SNES plugin state should initially contain:

```ts
interface SnesSessionState {
  mapper: SnesMapper;
  sa1Banks: number[];
  checksumEnabled: boolean;
  checksumMode: "asar" | "simple";
  bankCrossMode: "off" | "half" | "full";
  readFunctionsEnabled: boolean;
  optimizeDirectPage: boolean;
  defaultFreespaceByte: number;
  activeFreespaceStartOffset: number | null;
  activeFreespaceContentStartOffset: number | null;
  inSpcBlock: boolean;
  spcBlock: SnesSpcBlockData | null;
  spcInlineCompatibility: boolean;
}
```

This entire type and its state key live in `plugins/snes`.

### 4.5 Architecture contributions

Evolve `ArchitectureExtension` into an owned descriptor:

```ts
export interface ArchitectureContribution {
  id: string;
  aliases?: readonly string[];
  displayName: string;
  unknownInstructionBehavior: "throw" | "returnFalse";
  splitOperands(text: string): string[];
  classifyOperand(context: OperandClassificationContext, operand: string): LoweredOperand;
  createEncoder(context: ArchitectureEncoderContext): ArchitectureEncoder;
  instructions: readonly InstructionDescriptor[];
}
```

Changes from the current design:

- The static instruction catalog is activation metadata, not obtained from a live encoder.
- Aliases are pure spelling aliases. If an alias changes behavior, the target plugin handles that through `onArchitectureSelected` lifecycle metadata.
- Encoder instances remain session-bound.
- Core's architecture registry has no built-ins and silently overwrites nothing.
- Operand classifiers for 65816, SPC700, and Super FX move with their architecture contributions.

The SNES plugin registers `snes.65816`, `snes.spc700`, and `snes.superfx`, with source aliases preserving current `arch` spellings. The 65xx plugin registers its `65xx.*` architectures separately.

### 4.6 Directive contributions

Replace `createDirectiveRegistry()` and `DIRECTLY_LOWERABLE_DIRECTIVES` with descriptor-driven registration:

```ts
export interface DirectiveContribution {
  id: string;
  keywords: readonly string[];
  phase: "preprocess" | "lowered";
  createHandler(context: DirectiveFactoryContext): DirectiveHandler;
  tooling: readonly DirectiveDescriptor[];
}

export interface DirectiveSetContribution {
  id: string;
  directives: readonly DirectiveContribution[];
}
```

Requirements:

- `CommandLoweringService` reads `phase` from the resolved directive registry. Delete the static keyword set.
- Tooling descriptors and executable registrations come from the same contribution; completion can never advertise an inactive directive.
- Handler factories receive narrow, stable facades for output, addresses, operands, expressions, symbols, includes, diagnostics, architecture selection, and plugin state.
- Do not pass the concrete `Assembler` or mutable service bag to plugin handlers.
- Add deterministic directive middleware hooks so target plugins can reject or intercept generic directives. This is needed for SPC inline `org`, namespace restrictions inside SPC blocks, and architecture-selection side effects without teaching core about SPC.
- A middleware hook may return `continue` or `handled`; multiple `handled` results are an environment error.

Core retains architecture-neutral directives and language constructs:

- `arch`, `org`, `base`, `pushbase`, `pullbase`, `pushpc`, and `pullpc`;
- data emission (`db`, `dw`, `dl`, `dd`, and generic aliases);
- fill/pad after errors and types use target/output terminology;
- include/source/binary include;
- namespaces, structs, labels, defines, macros, functions, loops, and conditionals; and
- character tables where behavior is architecture-neutral.

The SNES plugin owns:

- mapper directives;
- freespace/freecode/freedata/RATS/prot behavior;
- SPC block directives and inline-SPC interception;
- SNES `check` and `optimize dp` policy;
- SNES/Asar compatibility no-ops; and
- any restriction on generic directives caused by SNES/SPC state.

### 4.7 Expression contributions

Refactor `MathCore.callBuiltInFunction()` so generic built-ins and active plugin functions share a registry:

```ts
export interface ExpressionFunctionContribution {
  name: string;
  aliases?: readonly string[];
  signature: ExpressionFunctionSignature;
  summary: string;
  evaluate(context: ExpressionFunctionContext, args: readonly MathValue[]): MathValue;
}

export interface ExpressionSetContribution {
  id: string;
  functions: readonly ExpressionFunctionContribution[];
}
```

Move `snestopc`, `pctosnes`, `canread*`, and ROM `read*` functions into the SNES plugin. Keep filesystem reads, generic math, string operations, symbol queries, and current logical-address queries in core.

Remove `convertSnesToPc` and `convertPcToSnes` from core `ExpressionHost`. Plugin expression contexts use generic `addresses.toOutputOffset()` and `addresses.fromOutputOffset()` facades.

Expression descriptors supply tooling/signature metadata and are target-scoped through `expressionSets`.

### 4.8 Address spaces, output formats, and lifecycle

Replace the current singleton objects with session factories:

```ts
export interface AddressSpaceContribution {
  id: string;
  create(context: TargetFactoryContext): TargetAddressSpace;
}

export interface TargetAddressSpace {
  readonly addressWidth: number;
  readonly defaultOrigin: number;
  normalizeForWrite(address: number): number;
  advance(address: number, amount: number): number;
  toOutputOffset(address: number): number;
  fromOutputOffset(offset: number): number;
  validateWrite?(address: number, width: number): void;
}

export interface OutputFormatContribution {
  id: string;
  create(context: TargetFactoryContext): TargetOutputFormat;
}

export interface TargetOutputFormat {
  finalize(context: OutputFinalizationContext): void;
  getOutput(context: OutputReadContext): Uint8Array;
}
```

Generalize core output terminology:

- `RomWriterService` -> `OutputWriterService`
- `romdata` -> `outputBytes`
- `targetRom` -> `baseImage`
- `convertTargetAddressToRomOffset` -> `toOutputOffset`
- `pctosnes` -> `fromOutputOffset`
- trace `snesAddress` -> `logicalAddress`
- trace `pcAddress` -> `outputOffset`
- address-to-line comments and public names use logical/output addresses

Core output writing is responsible only for:

- mapping logical addresses through the active address space;
- filling gaps according to target options;
- writing byte sequences;
- maintaining logical cursor state; and
- invoking target validation and lifecycle hooks.

Move these behaviors out of core and into the SNES plugin:

- LoROM/HiROM/ExLoROM/ExHiROM/SA-1/full-SA-1/Super-FX/no-ROM mapping;
- SA-1 bank state;
- bank-cross validation and SNES-specific diagnostics;
- automatic SPC block closure and missing-block errors;
- RATS/freespace finalization;
- SFC header selection and checksum/complement writes;
- Asar checksum mode and CRC logging; and
- fixed-size or SNES-specific base-ROM seeding behavior.

Add lifecycle contributions with deterministic hooks:

```ts
export interface SessionLifecycle {
  onSessionCreated?(context: SessionLifecycleContext): void;
  onStageStart?(context: StageLifecycleContext): void;
  beforeDirective?(context: DirectiveMiddlewareContext): "continue" | "handled";
  onArchitectureSelected?(context: ArchitectureSelectionContext): void;
  beforeWrite?(context: WriteValidationContext): void;
  onStageEnd?(context: StageLifecycleContext): void;
  beforeOutputFinalize?(context: OutputFinalizationContext): void;
  onSessionDispose?(context: SessionLifecycleContext): void;
}
```

Ordering is plugin activation order, then contribution registration order. Disposal reverses that order. Lifecycle errors include plugin and hook IDs.

### 4.9 Tooling catalog

The frozen environment exposes one `ToolingCatalog` built from the active target:

```ts
export interface ToolingCatalog {
  getInstructions(architecture: string): readonly InstructionDescriptor[];
  getDirectives(): readonly DirectiveDescriptor[];
  getExpressionFunctions(): readonly ExpressionFunctionDescriptor[];
  getArchitectures(): readonly ArchitectureSummary[];
  getTargets(): readonly TargetSummary[];
}
```

Delete core's static 65816/SPC700/Super FX catalogs and static all-target directive catalog. Catalogs live beside the contributions that implement them.

## 5. Node loader and project configuration

Implement Node-specific behavior in `@uttori/asm-plugin-loader-node`.

### 5.1 Configuration file

Use `asm.config.json` at the workspace/project root:

```json
{
  "$schema": "./node_modules/@uttori/asm-plugin-loader-node/asm-config.schema.json",
  "plugins": [
    {
      "module": "@uttori/asm-plugin-snes",
      "options": {
        "checksumMode": "asar"
      }
    }
  ],
  "target": "snes.sfc",
  "architecture": "snes.65816",
  "includePaths": ["./"]
}
```

Provide and test a JSON schema. Unknown top-level keys and invalid plugin entries are errors, not ignored warnings.

### 5.2 Resolution rules

- Resolve relative module paths from the configuration file directory.
- Resolve package specifiers from the configuration directory using Node resolution (`createRequire`/`import.meta.resolve` as appropriate).
- Convert filesystem paths to file URLs before `import()`.
- Preserve configuration order exactly.
- Maintain a host-provided map of bundled plugin modules. The CLI and language server use this map for the first-party SNES plugin so it works when bundled.
- Reject duplicate resolved modules and duplicate plugin IDs.
- Do not fetch packages or mutate `package.json`.
- Cache one activated environment per normalized configuration snapshot. Configuration changes dispose the previous manager before replacement.

### 5.3 Programmatic host API

Expose:

```ts
loadProjectEnvironment(options: {
  configFile?: string;
  cwd: string;
  pluginModules?: readonly PluginModuleRequest[];
  bundledPlugins?: ReadonlyMap<string, AssemblerPlugin>;
  overrides?: ProjectConfigurationOverrides;
}): Promise<LoadedProjectEnvironment>;
```

`LoadedProjectEnvironment` contains the frozen environment, resolved target/architecture, include paths, normalized configuration, diagnostics, and `dispose()`.

## 6. SNES extraction inventory

Use this as the migration checklist. A checked row means production logic has moved and core no longer imports it.

| Current location | Final SNES plugin location/responsibility |
| --- | --- |
| `src/Arch65816.ts` | `plugins/snes/src/architectures/65816.ts` |
| `src/ArchSPC700.ts` | `plugins/snes/src/architectures/spc700.ts` |
| `src/ArchSuperFX.ts` | `plugins/snes/src/architectures/superfx.ts` |
| SNES classifiers in `src/operand-classifiers.ts` | `plugins/snes/src/architectures/operand-classifiers.ts` |
| 65816/SPC700/Super FX catalog data in `src/lsp/instruction-catalog.ts` | architecture contribution `instructions` metadata |
| SNES portions of `src/target-profile.ts` | `plugins/snes/src/target/{address-space,output-format,target}.ts` |
| `src/compatibility/asar-compatibility-profile.ts` | `plugins/snes/src/asar/compatibility.ts`; only genuinely generic policies may remain in core under generic names |
| Mapper/check/optimize/startpos portions of `src/directives/layout.ts` | `plugins/snes/src/directives/{mapper,policy,spc}.ts` |
| `src/directives/memory.ts` | `plugins/snes/src/directives/freespace.ts` |
| `src/directives/spc.ts` | `plugins/snes/src/directives/spc.ts` |
| SPC methods in `src/services/directive-runtime-service.ts` | SNES directive handlers/services |
| SNES/Asar no-ops in `src/directives/misc.ts` | `plugins/snes/src/directives/compatibility.ts` |
| SPC guards in namespace/layout code | SNES directive middleware |
| SNES fields and `SpcblockData` in `src/assembler.ts` | `SnesSessionState` in plugin |
| concrete architecture construction in `src/assembler.ts` | SNES architecture factories |
| SNES expression feature checks in `src/assembler.ts` and cases in `src/mathcore.ts` | SNES expression set |
| mapping/checksum/freespace/SPC behavior in `src/services/rom-writer-service.ts` | SNES address space, output format, validation, and lifecycle hooks |
| `updateHeaderAndCRC32`, `setChecksumMode`, mapper state, and SNES base-image behavior in `src/assembler.ts` | SNES output/configuration services |
| static SNES directives in `src/lsp/directive-catalog.ts` | SNES directive contribution metadata |
| SNES defaults in `src/lsp/workspace-index.ts` | host-resolved environment/target/architecture |
| SNES defaults and `.sfc` output logic in `src/cli.ts` and `language-server/src/server.ts` | resolved target output extension and host default plugin configuration |
| SNES names/settings/commands/grammar assumptions in `editors/vscode` | generic assembly UI plus plugin/target settings; SNES behavior comes from bundled plugin metadata |
| SNES wording in `src/debug-tracing.ts`, `src/addressToLine.ts`, service comments, and errors | architecture-neutral logical/output terminology |

Also inspect every file returned by:

```sh
rg -l -i '\b(snes|sfc|65816|spc700|superfx|lorom|hirom|exlorom|exhirom|sa1rom|bigsa1rom|sfxrom|spcblock|rats)\b' packages/core/src
```

At completion this command must return no production-core matches. Generic APIs must not keep SNES names as compatibility aliases.

## 7. Host and tooling integration

### 7.1 CLI

Replace positional SNES assumptions with:

```text
asm <input> [output]
  --config <asm.config.json>
  --plugin <module>              # repeatable, appended after config plugins
  --target <target-id>
  --architecture <architecture-id>
  --base-image <path>
  --include-path <path>          # repeatable
  --plugin-option <plugin:key=value>
```

Behavior:

- Load/activate plugins before constructing the assembler.
- Use the target's default extension when output is omitted.
- Treat `--base-image` generically.
- Print resolved plugin, target, and architecture IDs in verbose mode.
- Report manifest, dependency, collision, and load failures with source module paths.
- Keep the current SNES checksum option only as namespaced SNES plugin configuration; remove it from generic core and generic CLI parsing.
- The distributed CLI installs the bundled SNES plugin by host policy when neither config nor `--plugin` is supplied.

### 7.2 Workspace index and language server

- `WorkspaceIndex` accepts an `AssemblerEnvironment`/assembler factory plus target and architecture IDs. It never calls a default `new Assembler()`.
- Reuse the same environment for build and analysis sessions.
- On configuration changes, resolve and activate a replacement environment, swap only after successful activation, dispose the old environment, and reindex.
- Pass `ToolingCatalog` to completion, hover, signature-help, and semantic-token providers.
- Remove all fallback-to-65816 behavior.
- Build output paths use the selected target extension.
- LSP initialization may be asynchronous while plugins load.
- Return plugin load/configuration failures as a workspace diagnostic and log entry without crashing the server.
- Do not accept executable plugin objects over the LSP wire. Pass module specifiers/options, then load inside the server process.

### 7.3 VS Code

Rename the UI surface from SNES-only terminology to generic assembly terminology. Backward-compatible setting and command IDs are not required.

Add settings:

- `asm.configFile`
- `asm.plugins`
- `asm.target`
- `asm.architecture`
- `asm.entryPoints`
- `asm.includePaths`
- `asm.buildOutput`
- `asm.baseImage`

Requirements:

- Pass plugin/config settings as language-server initialization options.
- Gate workspace-provided plugins on VS Code Workspace Trust.
- Commands and status messages say “Assembly”/“binary,” not “SNES ROM.”
- Replace the fixed architecture enum with free-form strings; validation and available values come from server/plugin metadata.
- Use a generic assembly TextMate grammar for comments, strings, numbers, labels, and directives.
- Use LSP semantic tokens/catalogs for architecture-specific mnemonics. Runtime plugins cannot safely mutate `package.json` grammar contributions.
- Bundle the first-party SNES plugin with the server distribution for out-of-box SNES behavior, but activate it through the same plugin manager.

## 8. Implementation phases

Each phase should be one reviewable pull request or a short series of commits. Temporary bridges are allowed only where a phase explicitly calls for them. `npm run verify` must pass before moving to the next phase.

### Phase 0 - Lock the behavioral baseline

Tasks:

1. Run and record the current gates:
   - `npm run verify`
   - `npm run fixture:asar`
   - `npm run fixture:slideshow`
   - `npm run fixture:chou`
   - `npm run benchmark:smoke`
2. Record hashes and sizes of generated SNES fixture outputs used for parity.
3. Add missing golden assertions if any mapper, checksum mode, SPC block, RATS/freespace, or architecture switch is only tested indirectly.
4. Add a focused test proving build and tooling sessions currently create independent architecture encoders; this invariant must survive the migration.

Acceptance:

- All existing tests pass before structural changes.
- Golden behavior exists for every SNES subsystem being extracted.

### Phase 1 - Add plugin API, manager, and environment without changing behavior

Tasks:

1. Add plugin contracts, manifest validation, contribution records, disposable ownership, and environment builder under the current `src` tree.
2. Implement transactional activation, exact API-version validation, dependency ordering, duplicate detection, deterministic ordering, and reverse disposal.
3. Add an immutable `AssemblerEnvironment` and target-resolution validation.
4. Create a tiny test plugin with:
   - a one-byte architecture;
   - a flat address space;
   - raw output;
   - one directive;
   - one expression function;
   - one state slot; and
   - tooling descriptors.
5. Keep current constructor behavior through a temporary adapter that builds an environment from existing registrations. Mark the adapter for deletion in Phase 4.

Tests:

- valid activation and disposal;
- malformed/default-export failures;
- incompatible API version;
- missing dependency and bad version range;
- duplicate plugin, contribution, alias, directive, and expression IDs;
- activation rollback;
- deterministic hook ordering; and
- frozen environment mutation attempts.

Acceptance:

- The test plugin can create and validate an environment.
- Existing SNES behavior is unchanged.

### Phase 2 - Make assembler sessions environment-driven

Tasks:

1. Change the assembler constructor to require `{ environment, target, architecture?, baseImage?, fileProvider?, collectSourceMetadata? }`.
2. Instantiate architecture encoders, address space, output format, directive handlers, expression handlers, lifecycle hooks, and session state from the environment.
3. Replace `architectureExtensions`, built-in architecture construction, and `TargetProfile` feature unions with environment lookups.
4. Implement plugin state create/clone/reset/dispose and include it in `StageExecutionState`.
5. Make `createToolingSession()` reuse the immutable environment while constructing all new session-bound factories/state.
6. Add plugin/contribution IDs to diagnostics raised from factories and hooks.
7. Update core tests to create an explicit test environment rather than relying on `new Assembler()`.

Acceptance:

- No assembler constructor path builds concrete 65816/SPC700/Super FX encoders.
- A session created from the tiny test plugin emits the expected raw byte.
- Parallel build/tooling sessions share descriptors but no mutable handlers or state.
- Existing SNES tests pass through the temporary SNES environment adapter.

Completion note (2026-08-19): the strict environment/target constructor, session-bound
factories and lifecycle hooks, plugin state snapshots, tooling-session isolation, explicit
host wiring, and temporary SNES adapter are implemented. `npm run verify` passes with 797
tests; all 60 Asar fixtures and the Slideshow and Chou checksum gates pass.

### Phase 3 - Convert directives, expressions, and lowering to contributions

Tasks:

1. Add descriptor-driven directive sets and remove `DIRECTLY_LOWERABLE_DIRECTIVES`.
2. Split generic directive factories from target-specific factories.
3. Add directive middleware/interception and architecture-selection lifecycle hooks.
4. Add expression function sets and move dispatch out of the monolithic built-in switch where functions are plugin-provided.
5. Generate directive/expression tooling metadata from the same active contributions.
6. Replace closed feature flags with resolved set IDs.
7. Move Asar-specific `endif`/while behavior behind a dialect/lifecycle policy rather than importing the compatibility profile in core.

Acceptance:

- An inactive directive or expression is unknown and absent from completion.
- The tiny test plugin's directive and expression work in build and analysis sessions.
- Existing generic macros/includes/labels remain core behavior.
- SNES behavior remains green through contributions, not feature-name conditionals.

Completion note (2026-08-24): directive execution phase now lives beside each registry
entry and the hard-coded lowering allowlist is removed. Generic and target-specific
directive factories compose from resolved set IDs; the closed target feature unions are
gone. Target expression sets install session-local evaluators (including aliases and
argument contracts), and SNES address/read functions now come from the temporary SNES
adapter rather than the MathCore built-in switch. Runtime and editor tooling share the
active directive/expression metadata, including inactive-contribution filtering. The
Asar `endif`/`while` ambiguity is owned by the legacy dialect lifecycle. `npm run verify`
passes with 915 tests and global coverage at 93.54% statements, 90.06% branches, and
96.35% functions; package dry-run, all 60 Asar fixtures, Slideshow, and Chou checksum
gates pass.

### Phase 4 - Generalize output and remove target-specific core state

Tasks:

1. Rename ROM/SNES public and internal concepts to logical address, output offset, output bytes, and base image.
2. Convert address spaces and output formats to session factories.
3. Add write validation and lifecycle hooks.
4. Move stage-specific mutable extension data into plugin state slots.
5. Remove SNES fields from `Assembler`, `StageWriteState`, directive capability types, and service hosts.
6. Split `DirectiveRuntimeService` so its core portion contains only generic functionality.
7. Reduce the output writer to mapping/writing/cursor/hook responsibilities.
8. Remove checksum and SPC/freespace finalization calls from core.

Acceptance:

- Core output writer contains no mapper names, checksum offsets, RATS bytes, bank masks, or SPC behavior.
- Stage cloning correctly preserves the tiny plugin's nontrivial state.
- SNES parity tests still pass using plugin hooks/state.

Completion note (2026-08-24): output and base-image ownership now use the
target-neutral `outputBytes`, `baseImage`, logical-address, and output-offset
vocabulary. Address spaces and output formats are live session factories; the
legacy adapter owns mapper, bank, checksum, freespace, and SPC state in a
deep-cloned/resettable session slot. Address-space validation owns bank-cross
and unmapped-write policy, while adapter lifecycle/output hooks own RATS and
checksum finalization. The renamed `OutputWriterService` is limited to mapping,
cursor movement, byte emission, validation hooks, tracing, and output-format
finalization, with no SNES mapper names, bank masks, checksum offsets, RATS
bytes, or SPC behavior. Generic directive runtime no longer implements SPC
blocks; that behavior is isolated in the transitional legacy SPC runtime for
Phase 5 extraction. A nested fixture-plugin state test verifies independent
stage snapshots and caught/fixed stale factory references across state restore.
The 916-test suite passes with global coverage at 93.58% statements, 90.05%
branches, and 95.95% functions. Package dry-run, all 60 Asar fixtures,
Slideshow, Chou, language-server, editor, and full SNES staged/tree/golden parity
gates pass.

### Phase 5 - Physically extract the SNES and initial 65xx plugins

Tasks:

1. Create workspace packages and move files according to the extraction inventory.
2. Implement `@uttori/asm-plugin-snes` as a default-exported plugin module.
3. Register SNES state, architectures, address space, output format, directives, expressions, lifecycle hooks, target, and tooling metadata during activation.
4. Move mapper/checksum/SPC/freespace/Asar compatibility tests beside the SNES plugin.
5. Move architecture tests and catalogs beside the SNES plugin.
6. Move the initial 6502 architecture scaffold, flat-16 target, and its tests to `@uttori/asm-plugin-65xx`.
7. Delete the temporary adapter and all built-in registries from core.
8. Add package export maps so plugins consume only documented `@uttori/asm-core` plugin API and context types.

Acceptance:

- `@uttori/asm-core` has no dependency on either plugin.
- Core tests pass with only the tiny fixture plugin installed.
- SNES plugin tests pass when the plugin is explicitly activated.
- The initial 65xx scaffold owns its architecture and target diagnostics.
- The core SNES identifier scan returns no matches.

Completion note (2026-08-24): the repository is now a workspace with
`@uttori/asm-core`, `@uttori/asm-plugin-snes`, and
`@uttori/asm-plugin-65xx`. The SNES plugin default export registers its
state, 65816/SPC700/Super FX encoders and catalogs, mapper/address space,
SFC output/checksum policy, directives, expressions, and lifecycle services.
Architecture, mapper, freespace, SPC, compatibility, and full SNES parity
tests live beside the plugin and activate it explicitly. The initial 65xx
package owns its flat-16 target and architecture boundary. The temporary legacy adapter, target profiles, built-in
architecture factory, target directive implementations, and target state are
gone from core; its prohibited SNES identifier scan is empty and it has no
plugin dependency. CLI and language-server hosts now opt into the SNES plugin
through an explicit environment factory, pending the generic discovery and
configuration work in Phase 6.

### Phase 6 - Add Node discovery and project configuration

Tasks:

1. Implement `@uttori/asm-plugin-loader-node` and JSON schema.
2. Add module/path/package resolution, bundled-plugin lookup, option validation, caching, and disposal.
3. Add configuration precedence: CLI/editor overrides > `asm.config.json` > host defaults.
4. Convert the CLI to the generic options and environment flow.
5. Add loader integration fixtures containing plugins loaded from:
   - an absolute file path;
   - a relative file path;
   - a workspace package specifier; and
   - the bundled plugin map.

Acceptance:

- A clean SNES project builds using `asm.config.json`.
- A project using the tiny fixture plugin builds without loading SNES.
- Load errors identify config entry, resolved path, and plugin ID where available.
- No automatic `node_modules` scanning occurs.

Completion note (2026-08-24): `@uttori/asm-plugin-loader-node` now owns strict
`asm.config.json` validation and its published JSON schema, configuration-relative
file and package resolution, absolute paths, host-bundled modules, deterministic
activation order, plugin option validation, contextual load diagnostics, normalized
configuration snapshots, environment caching, and replacement/disposal. Resolution
only visits configured/default/override entries and never scans `node_modules`.
Configuration precedence is CLI/host overrides over project configuration over host
defaults; explicit modules append after configured plugins without reordering. The
generic CLI supports config, repeatable plugins/includes, target, architecture,
base-image, namespaced plugin options, verbose resolution output, and target-default
output extensions. Its host policy supplies the bundled SNES plugin only when neither
project configuration nor an explicit plugin is present. Fourteen loader/CLI tests
cover all required resolution sources, caching/disposal, errors, precedence, SNES
config builds, and non-SNES isolation. The 926-test verification suite passes with
94.29% statement, 90.33% branch, and 95.48% function coverage. All four package
dry-runs include the expected runtime files (including the loader schema); all 60 Asar
fixtures, Slideshow, Chou, and the five-workload smoke benchmark pass with exact output
validation.

### Phase 7 - Propagate plugins through LSP and VS Code

Tasks:

1. Inject environment/target/architecture into `WorkspaceIndex`.
2. Use the same loaded project environment for analysis and build commands.
3. Replace static catalogs with environment `ToolingCatalog` data throughout providers.
4. Support safe environment replacement on configuration change.
5. Generalize command IDs, settings, messages, output extensions, language ID, and grammar.
6. Enforce Workspace Trust before workspace plugin loading.
7. Bundle and register the first-party SNES plugin through the host bundled-plugin map.
8. Rebuild generated server/extension artifacts only after source tests pass.

Acceptance:

- Hover/completion/signature help show only contributions active for the selected target.
- LSP build and diagnostics use identical plugins and target settings.
- Changing target/plugin configuration reindexes without restarting the server.
- The VSIX works for default SNES projects and for a workspace-local fixture plugin.

Completion note (2026-08-24): the language server now activates project plugins through
the Node loader and a transactional environment controller, preserving the previous
environment after failed reloads and sharing the exact environment, target, architecture,
target options, include paths, and overlays between analysis and builds. Tooling providers
consume only the active target catalog; configuration failures are logged and published as
workspace diagnostics. The VS Code surface now uses generic `asm.*` settings and commands,
the `uttori-asm` language ID, a target-neutral grammar, target-derived output extensions,
and Workspace Trust gating. The server bundle registers the first-party SNES plugin through
the bundled-plugin map. The 931-test verification suite passes with 94.29% statement,
90.35% branch, and 95.61% function coverage; all package dry-runs, 60 Asar fixtures,
Slideshow, Chou, and the five-workload benchmark pass. A packaged-server stdio smoke test
builds both the bundled SNES target and a workspace-local ESM fixture plugin successfully.

### Phase 8 - Enforce boundaries, finish documentation, and remove dead APIs

Tasks:

1. Add `scripts/check-package-boundaries.ts` that fails when:
   - core imports a plugin package or plugin source path;
   - a plugin imports a non-exported core internal path;
   - core contains prohibited SNES production identifiers; or
   - language-server providers import static plugin catalogs.
2. Delete obsolete APIs, generated declarations, adapters, feature unions, catalogs, and SNES-named core methods.
3. Update root README with:
   - generic core usage;
   - SNES plugin quick start;
   - plugin authoring guide;
   - trusted-code warning;
   - manifest/configuration reference; and
   - CLI/editor setup.
4. Add `plugins/snes/README.md` documenting targets, architecture aliases, directives, expressions, mapper options, checksum modes, and output extension.
5. Add a plugin author example copied from the tiny fixture plugin.
6. Update build, format, lint, typecheck, coverage, pack, and workspace scripts.

Acceptance:

- Boundary checks are part of `npm run verify`.
- Package tarball dry runs contain required runtime files and JSON schema.
- No dead compatibility path can create an implicit SNES assembler.

Completion note (2026-08-24): `scripts/check-package-boundaries.ts` now enforces
core/plugin import direction, public core export usage, target-neutral core
identifiers, and environment-backed LSP providers as part of `npm run verify`.
The temporary SNES host factory, legacy encoder aliases, duplicate SNES catalog
registry, stale generated declarations, and final SNES-named core local are gone.
The root and SNES READMEs now cover generic and SNES usage, configuration,
trusted-code policy, contributions, mapper/checksum behavior, CLI, and editor
setup; `examples/plugin-author` provides a runnable non-SNES plugin that emits
`0x42`. Package dry-runs assert required source, declaration, and schema files,
and the 65xx declaration layout now matches its export map. The 935-test
verification suite passes with 94.31% statement, 90.34% branch, and 95.82%
function coverage. All four package assertions, 60 Asar fixtures, Slideshow,
Chou, five correctness-checked benchmark workloads, the packaged language
server smoke test, and VSIX packaging pass.

## 9. Test migration and verification matrix

Tests may change imports and APIs, but assertions about emitted bytes and supported language behavior must remain.

| Area | Final test owner | Required assertions |
| --- | --- | --- |
| parser, IR, macros, defines, symbols, includes | core | works with fixture plugin and no SNES dependency |
| plugin manager/loader | core + Node loader | validation, ownership, order, rollback, disposal, resolution |
| session/state isolation | core | build/tooling/parallel sessions have independent instances and cloned state |
| output writer | core | flat target mapping, gap fill, bounds, endian writes, lifecycle invocation |
| 65816/SPC700/Super FX encoding | SNES plugin | retain all existing opcode assertions |
| SNES mappers | SNES plugin | retain both address directions and invalid ranges |
| checksums/SFC output | SNES plugin | header offsets, complement/checksum bytes, modes, small images |
| SPC blocks | SNES plugin | explicit/inline forms, state restoration, namespace behavior, finalization |
| freespace/RATS | SNES plugin | allocation, tags, fill byte, final lengths, unsupported mapper behavior |
| Asar compatibility | SNES plugin | no-ops, mapper rules, control-flow quirks, byte parity |
| instruction/directive catalogs | owning contribution | executable/catalog parity and target filtering |
| LSP | language server | environment injection, target filtering, config reload, build/analysis parity |
| VS Code | editor | settings propagation, workspace trust, generic labels, bundled SNES smoke test |
| 65xx architectures | 65xx plugin | load, catalog, and encode without a SNES dependency |

Add these high-value integration tests:

1. **No-plugin failure:** core rejects construction with no resolved target.
2. **Non-SNES success:** fixture plugin assembles `org 0` plus a custom instruction/directive into raw bytes while SNES is not loaded.
3. **SNES explicit success:** the same existing SNES source only works after the SNES plugin is activated.
4. **Target filtering:** installing SNES and fixture plugins does not expose SNES directives/catalogs in the fixture target.
5. **Collision failure:** two plugins claiming `lorom`, an architecture alias, or an expression name fail with owner-rich diagnostics.
6. **State isolation:** two sessions and a tooling session cannot observe each other's plugin state.
7. **Lifecycle order:** hooks execute in documented order and dispose in reverse.
8. **LSP parity:** catalog entries equal the active environment's contributions exactly.
9. **Dynamic load:** a temporary ESM plugin package loaded from project configuration works in CLI and LSP.
10. **Boundary guard:** core cannot import or mention prohibited SNES implementation identifiers.

## 10. Required commands and merge gates

During each phase:

```sh
npm run fmt:check
npm run lint
npm run make-types
npm test
npm run lsp:typecheck
npm run vscode:typecheck
```

Before merging each completed phase:

```sh
npm run verify
npm run pack:check
```

Before declaring the migration complete:

```sh
npm run verify
npm run fixture:asar
npm run fixture:slideshow
npm run fixture:chou
npm run benchmark:smoke
npm run lsp:build
npm run vscode:build
npm run vscode:package
```

Generated `dist`, language-server bundle, extension bundle, and VSIX artifacts should be regenerated only from the final verified sources. Do not hand-edit generated output.

## 11. Error and diagnostic requirements

Every plugin-system error must carry enough structured context for CLI, LSP, and tests:

```ts
interface PluginDiagnosticContext {
  code: string;
  pluginId?: string;
  pluginModule?: string;
  contributionId?: string;
  targetId?: string;
  cause?: unknown;
}
```

Minimum diagnostic codes:

- `PLUGIN_MODULE_NOT_FOUND`
- `PLUGIN_INVALID_EXPORT`
- `PLUGIN_INVALID_MANIFEST`
- `PLUGIN_API_INCOMPATIBLE`
- `PLUGIN_DEPENDENCY_MISSING`
- `PLUGIN_DEPENDENCY_INCOMPATIBLE`
- `PLUGIN_ACTIVATION_FAILED`
- `PLUGIN_CONTRIBUTION_DUPLICATE`
- `PLUGIN_ALIAS_DUPLICATE`
- `PLUGIN_TARGET_INVALID`
- `PLUGIN_CONFIGURATION_INVALID`
- `PLUGIN_HOOK_FAILED`

Do not silently fall back to SNES, 65816, built-in directives, or static catalogs after any of these failures.

## 12. Risks and mitigations

### Stage-state regressions

Risk: SNES mutable fields currently participate manually in multi-pass state copying.
Mitigation: implement typed plugin state cloning before moving any state; add state-isolation tests first.

### Hidden SNES behavior in generic-looking services

Risk: `RomWriterService`, `DirectiveRuntimeService`, namespace handling, control-flow policy, expression dispatch, and tooling catalogs contain SNES/Asar behavior despite generic filenames.
Mitigation: use the extraction inventory and the final prohibited-identifier/import gate.

### Catalog/runtime drift

Risk: static LSP catalogs may advertise behavior that is not active.
Mitigation: executable contributions own their tooling descriptors and the environment builds one target-filtered catalog.

### Bundled versus workspace plugin resolution

Risk: an esbuild-bundled language server cannot resolve workspace packages the same way as the repository runtime.
Mitigation: distinguish host-provided bundled plugin modules from Node-resolved project plugins and test both from the packaged server.

### Plugin activation leaking partial registrations

Risk: a plugin throws after registering some contributions.
Mitigation: collect into a private transaction, validate, then commit atomically.

### Overexposing core internals

Risk: passing `Assembler` or service implementations to plugins makes the API impossible to evolve.
Mitigation: expose capability facades and enforce package export maps/import boundaries.

### Performance regressions

Risk: registry lookups and lifecycle middleware run for every command/byte.
Mitigation: resolve target contributions once, instantiate once per session, precompute directive/function maps, and benchmark before/after. Avoid plugin-manager lookups on the per-byte path.

## 13. Definition of done

The plugin migration is complete only when all statements below are true:

- [ ] `Assembler` requires an explicit frozen environment and target.
- [ ] The core package has no built-in architecture or target.
- [ ] Plugin manifests, API validation, dependencies, configuration, activation, disposal, ownership, and collision handling are implemented and tested.
- [ ] Plugin session state is created, cloned across stages, reset, and disposed generically.
- [ ] Architectures, targets, address spaces, output formats, directives, expressions, lifecycle hooks, and tooling metadata are real contribution types.
- [ ] Directive lowering is metadata-driven; the static directly-lowerable keyword list is gone.
- [ ] LSP catalogs come entirely from the active environment.
- [ ] CLI, analysis, LSP, and VS Code builds use the same resolved environment.
- [ ] Workspace plugin loading is gated by VS Code Workspace Trust.
- [ ] Every production SNES behavior listed in the extraction inventory lives under `plugins/snes`.
- [ ] 65816, SPC700, Super FX, mapper, checksum, SPC, freespace/RATS, and Asar compatibility tests live with or explicitly activate the SNES plugin.
- [ ] The production 65xx implementation remains a separate plugin.
- [ ] A non-SNES fixture plugin assembles successfully with the SNES plugin absent.
- [ ] Core boundary checks reject SNES imports/identifiers.
- [ ] All verification, fixture, build, package, and benchmark commands pass.
- [ ] Documentation contains a working plugin-author example and trusted-code warning.

Once these checks pass, adding another architecture or target should require a plugin package and project configuration, not edits to assembler core, the language server providers, or the VS Code extension.
