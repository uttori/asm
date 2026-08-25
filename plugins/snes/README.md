# `@uttori/asm-plugin-snes`

The first-party SNES plugin supplies the SFC target, WDC 65C816, Sony SPC700, Super FX, mapper-aware ROM addressing, SFC output/checksum finalization, target directives, expression functions, and Asar compatibility policy. Nothing in this package is activated implicitly by `@uttori/asm-core`.

## Activation and target

```ts
import { Assembler } from "@uttori/asm-core";
import {
  createSnesAssemblerEnvironment,
  SNES_TARGET_ID,
} from "@uttori/asm-plugin-snes";

const assembler = new Assembler({
  environment: await createSnesAssemblerEnvironment(),
  target: SNES_TARGET_ID,
});
```

The target ID is `snes.sfc`; aliases are `snes`, `sfc`, and `snes-65816`. The default architecture is `snes.65816`, and the default output extension is `.sfc`.

For project loading:

```json
{
  "plugins": [
    {
      "module": "@uttori/asm-plugin-snes",
      "options": {
        "checksumMode": "asar",
        "checksumEnabled": true,
        "asarSuperFxMoveShortAddress": false
      }
    }
  ],
  "target": "snes.sfc",
  "architecture": "snes.65816"
}
```

## Architectures and aliases

| Contribution | Aliases | Notes |
| --- | --- | --- |
| `snes.65816` | `65816` | WDC 65C816; default SNES architecture |
| `snes.spc700` | `spc700` | SPC700 code inside explicit `spcblock` regions |
| `snes.spc700` | `spc700-raw` | Standalone SPC payload with mapper-free 1:1 addressing |
| `snes.spc700` | `spc700-inline` | Asar-compatible implicit SPC block behavior |
| `snes.superfx` | `superfx` | Super FX/GSU encoder; unknown instructions may fall through to directives |

The executable encoders and editor instruction catalogs are registered by the same architecture contributions, so target-filtered hover and completion cannot expose an inactive architecture.

## Directives

The active target catalog combines architecture-neutral core directives with these SNES and compatibility additions. The complete catalog is grouped below.

| Group | Keywords |
| --- | --- |
| Data | `db`, `dw`, `dl`, `dd`, `dc.b`, `dc.w`, `dc.l` |
| Memory/output | `fillbyte`, `fillword`, `filllong`, `filldword`, `fill`, `padbyte`, `padword`, `padlong`, `paddword`, `pad`, `freecode`, `freedata`, `freespace`, `freespacebyte`, `prot` |
| Include | `incsrc`, `include`, `includeonce`, `incbin` |
| Layout/architecture | `base`, `org`, `pushbase`, `pullbase`, `pushpc`, `pullpc`, `startpos`, `check`, `optimize`, `arch` |
| Mapper | `lorom`, `hirom`, `exlorom`, `exhirom`, `fastrom`, `sfxrom`, `norom`, `sa1rom`, `fullsa1rom` |
| Namespace | `namespace`, `pushns`, `pullns` |
| Character table | `table`, `cleartable`, `pushtable`, `pulltable` |
| SPC | `spcblock`, `endspcblock` |
| Struct | `struct`, `endstruct` |
| Control flow | `if`, `elseif`, `else`, `endif`, `while`, `endwhile`, `for`, `endfor` |
| Macro | `macro`, `endmacro` |
| Diagnostics/compatibility | `dpbase`, `warnings`, `print`, `assert`, `error`, `warn`, `warnpc`, `autoclean`, `autoclear`, `includefrom`, `asar` |

`fastrom`, `dpbase`, `warnings`, `print`, `warn`, `autoclean`, `autoclear`, `includefrom`, `asar`, `reset`, `{`, and `}` are accepted compatibility no-ops where appropriate. Unsupported syntax is still diagnosed rather than silently ignored.

`check bankcross <on|off|half|full>` controls bank-cross validation. `check title` enables Asar-compatible ROM read functions. `optimize dp <none|ram|always>` controls direct-page optimization.

## Expressions

| Function | Meaning |
| --- | --- |
| `snestopc(address)` | Convert a mapped SNES address to an output offset |
| `pctosnes(offset)` | Convert an output offset to a mapped SNES address |
| `canread1` … `canread4` | Test whether a fixed-size range can be read from the base image |
| `canread(position, size)` | Test an arbitrary base-image range |
| `read1` … `read4` | Read a little-endian value, with an optional default value |

Reads without a default follow the compatibility policy selected by `check title` and report out-of-bounds SNES addresses.

## Mapper behavior

| Directive | Canonical mode | Behavior |
| --- | --- | --- |
| `lorom` | `lorom` | LoROM mapping; checksum header at `0x7fc0` |
| `hirom` | `hirom` | HiROM mapping; checksum header at `0xffc0` |
| `exlorom` | `exlorom` | Extended LoROM mapping |
| `exhirom` | `exhirom` | Extended HiROM mapping |
| `sfxrom` | `sfxrom` | Super FX ROM mapping |
| `norom` | `norom` | 1:1 output addressing; disables checksum and ROM freespace allocation |
| `sa1rom` | `sa1rom` | SA-1 mapping; optionally accepts four comma-separated bank selectors |
| `fullsa1rom` | `bigsa1rom` | Full SA-1 mapping |

Mapper changes are rejected inside an active SPC block. Freespace/RATS allocation is available for mapped ROM modes and uses `freespacebyte` as its fill policy.

## Checksum and output options

Target options are validated during activation/session creation:

| Option | Values | Default | Effect |
| --- | --- | --- | --- |
| `checksumMode` | `"asar"`, `"simple"` | `"asar"` | Asar mirrors a trailing non-power-of-two region; simple sums bytes directly |
| `checksumEnabled` | boolean | `true` | Writes checksum/complement header fields when enabled and the image is large enough |
| `asarSuperFxMoveShortAddress` | boolean | `false` | Uses Asar’s raw-byte short-address encoding instead of the hardware word index |

The `snes.sfc-output` contribution finalizes the selected header and returns SFC bytes. New outputs and patched base images both use `.sfc` unless the host overrides the path.

## Compatibility and trust

Compatibility rules live under `src/asar`, while mapper/output implementations live under `src/target`; neither leaks into core. The focused Asar tests and production fixtures are the byte-parity contract.

Like every Uttori ASM plugin, this package is trusted in-process code. Project loaders and editor hosts should activate it only from an expected package or bundled-plugin map.
