# Project Configuration

Requires Node.js 26+ for CLI/library use or VS Code 1.145.0+ for the extension. Create
`uttori-asm.config.json` in the project directory:

```json
{
  "$schema": "./node_modules/@uttori/asm-plugin-loader-node/asm-config.schema.json",
  "plugins": [{ "module": "@uttori/asm-plugin-snes" }],
  "target": "snes.sfc",
  "architecture": "snes.65816",
  "entryPoints": ["main.asm"],
  "includePaths": ["include"],
  "buildOutput": "build/main.sfc"
}
```

Install the configured plugins in that project. The CLI already depends on the SNES plugin. Add
`@uttori/asm-plugin-65xx` for 65xx targets. Only load plugins you trust: they execute JavaScript with
the host process's permissions. VS Code ignores workspace configuration and external plugins until
the workspace is trusted.

## Fields

| Field          | Meaning                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| `plugins`      | Ordered `{ module, options? }` entries. Each plugin validates its own options                              |
| `target`       | Target contribution ID or alias                                                                            |
| `architecture` | Initial processor ID or alias valid for the target                                                         |
| `includePaths` | Additional source/binary include directories                                                               |
| `entryPoints`  | Editor/indexing build roots. Pass the source explicitly to the CLI                                         |
| `buildOutput`  | Editor build destination. Pass output explicitly to the CLI                                                |
| `linkProject`  | Opt-in native build manifest for editor Build/Run/Debug and module-aware indexing, relative to this config |
| `baseImage`    | Editor base ROM for patching. Use CLI `--base-image` for terminal builds                                   |
| `$schema`      | Optional editor schema URI                                                                                 |

Unknown fields are rejected. The loader searches only its supplied project directory, not parents.
Use CLI `--config path` or editor `asm.configFile` for a nested configuration.
Paths in a configuration resolve beside that file. Explicit editor path settings resolve from the
workspace root. Bare package names resolve as installed modules. Relative plugin paths resolve
beside the configuration. Published plugins should point at executable JavaScript.

Overrides take precedence over project values, then host defaults. Explicit CLI plugins append to
configured plugins without reordering. CLI `--include-path` values replace configured `includePaths`
and resolve from the current directory; without either, the current directory is searched. CLI
`--plugin-option plugin:key=value` names a loaded plugin by module or plugin ID and fails otherwise.
With no configuration or explicit plugins, the CLI selects SNES; a configuration file must list its
own plugins. The generic loader/core has no default target.

The generic loader selects a sole registered target automatically. Multiple targets require an
explicit choice. An omitted architecture uses that target's default. For host integration,
option merging, and cache/disposal behavior, see [API contracts](https://github.com/uttori/asm/blob/master/packages/core/API.md).

Native manifests use the shared [linked build workflow](../workflows/LINKED-BUILDS.md).
Data-only manifest validation and the module-root/configuration projection are exposed through
`@uttori/asm-plugin-loader-node/build-configuration`; these helpers do not activate plugins.

## 6502 example

```json
{
  "plugins": [{ "module": "@uttori/asm-plugin-65xx", "options": { "origin": 32768 } }],
  "target": "65xx.raw",
  "architecture": "65xx.6502"
}
```

With `org $8000`, `origin: 32768` makes the first output byte file offset zero. Use `65xx.nes`
for an iNES image. See the [65xx manual](https://github.com/uttori/asm/blob/master/packages/plugin-65xx/MANUAL.md) for target options and limitations.

## Troubleshooting

- **Module not found:** install the plugin beside the project or correct its configured path.
- **No target:** choose a target contributed by an active plugin.
- **Unknown option/alias:** use the owning package's documented options and contribution IDs.
- **Restricted workspace:** grant trust only after reviewing its configuration and plugins.
- **Wrong build root:** set `entryPoints` and `asm.configFile` in the editor. Pass source and output
  explicitly in terminal builds.
