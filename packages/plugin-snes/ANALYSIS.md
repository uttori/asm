# SNES function heuristics and captured RAM code

SNES project analysis now runs configurable role detectors over decoded instructions and imported execution evidence. Findings are comments with confidence, rule identity, configuration fingerprint, and supporting instruction/evidence IDs. They do not rename symbols or decide that bytes are code. Manual comments survive reanalysis; findings from this detector are replaced on the next pass.

## Configuration

Put `heuristics.json` beside the project's `analysis.json`:

```json
{
  "enabled": true,
  "minimumConfidence": "medium",
  "maxWindowInstructions": 48,
  "disabledRules": [],
  "registerRules": []
}
```

`enabled` disables all findings. `minimumConfidence` accepts `low`, `medium`, or `high`; these are evidence grades, not calibrated probabilities. `maxWindowInstructions` bounds local pattern matching from 2 to 256 instructions. `disabledRules` names individual built-in or custom rules. Unknown options, invalid addresses, duplicate rule IDs, and invalid bounds fail before the project is written.

The JSON schema is `packages/plugin-snes/heuristics.schema.json`; the extension provides completion for `**/analysis/heuristics.json`. The TypeScript API also accepts `analyzeSnesProject({ ..., heuristics })`, which overrides the file. `analyzeSnesFunctionRoles(shards, config)` is a pure API for inspecting findings before persistence.

A custom rule can assign a role to a resolved hardware-register access. Addresses are JSON decimal numbers, including qualified CPU-bank addresses; hardware mirrors normalize to their register identity. For example, 16914 is `$4212`:

```json
{
  "registerRules": [
    {
      "id": "beam-status",
      "role": "timing.beam-status-read",
      "addresses": [16914],
      "access": "read",
      "confidence": "medium"
    }
  ]
}
```

Run **Assembly: Analyze and Regenerate Disassembly** to apply configuration changes through the existing verified export workflow. **Assembly: Import Runtime Trace and Update Disassembly** imports a saved capture and runs the same analysis. Source regeneration retains its existing conflict and byte-verification checks.

## Built-in rules

| Rule ID                                    | Evidence and resulting role                                                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apu-io`                                   | Resolved writes to `$2140–2143`: audio communication, medium confidence.                                                                                          |
| `apu-handshake`                            | Backward conditional acknowledgement polling at `$2140`: audio handshake wait.                                                                                    |
| `apu-upload`                               | Advancing indirect source, APU payload/token writes, inner acknowledgement wait, and outer transfer loop: bulk audio upload.                                      |
| `vram-write`, `palette-write`, `oam-write` | Writes to the corresponding PPU data ports.                                                                                                                       |
| `dma-destination`                          | Known DMAP/BBAD values and an MDMAEN trigger: VRAM, palette, or OAM DMA. Paired 16-bit setup stores are split into their register bytes; reverse DMA is excluded. |
| `controller-read`                          | Serial or automatic joypad result reads.                                                                                                                          |
| `math-result`                              | Reads from CPU multiply/divide or Mode 7 multiplication result registers.                                                                                         |
| `vblank-wait`                              | Backward loop testing HVBJOY bit 7.                                                                                                                               |
| `display-fade`                             | Repeated brightness writes with an increment/decrement, medium confidence.                                                                                        |
| `mode7-setup`                              | Matrix/center setup and a nearby mode-7 constant, medium confidence; the BGMODE value still needs confirmation.                                                   |
| `block-copy`                               | MVN/MVP; the role is memory copying until the destination is established.                                                                                         |
| `observed-access`                          | Actual CPU bus access resolves an indexed/indirect operand; DMA/HDMA writes retain engine/channel attribution.                                                    |
| `wrapper`                                  | A direct call to a routine with role evidence; marks the call as delegated work, medium confidence.                                                               |

Findings can also appear at an enclosing function when its evidence path and call context establish ownership. Sparse observations remain blocks when no call target establishes a function candidate. Rules can report multiple roles; an audio call in a scene controller does not make the whole controller an audio renderer.

Hardware matching uses resolved data references and banks. `$7E2118` is WRAM, not a PPU register. `JSR $4203` is a code target, not multiplication I/O. The source formatter now applies this distinction too. Unknown DBR, conflicting setup paths, missing trigger writes, and unobserved indirect targets are not filled in by guessing. Decompression formats and game-specific concepts such as “logo” remain outside these rules.

## Capture and RAM navigation

`asm.debug.traceDetail` defaults to `full`. On a runtime that advertises support, runtime recording requests:

- Actual fetched instruction bytes and the ten 65816 registers before execution.
- Actual CPU, DMA, and HDMA bus operations, with address, value, direction, and DMA channel.
- Explicit instruction overflow, per-instruction memory truncation, and unattributed bus-operation counters.

The maintained ares supplement records these at execution hooks without extra debugger bus reads. Its ring holds 65,536 instructions; each instruction retains up to 32 bus operations. Responses pack up to 240 instructions within the native packet byte limit. Large DMA transfers can exceed the per-instruction limit. Interrupt/wait-period operations outside a captured instruction are counted as unattributed; their address/value detail is not saved. Counts of memory operations inside dropped instruction records are also unavailable. This is a bounded observation stream, not a lossless bus log.

For separately negotiated lossless modes, see [ares capture](https://github.com/uttori/asm/blob/master/packages/debug-sidecar-ares/CAPTURE.md). The limits above apply to legacy full-detail tracing.

`pc` selects a smaller stream containing instruction addresses. Explicitly requesting full detail
from a runtime without that capability fails. PC-only files identify reachability but lack the
captured bytes/state needed to reconstruct RAM code. Replay remains a PC-only workflow fixture; MesenCE has no instruction trace producer.

Import creates execution counts, captured instruction variants, CPU-state observations, and memory-access records. Fetches supply code bytes and are excluded from data-read facts. Reimporting the same artifact is idempotent. The sidecar, DAP path, disk recorder and import all retain the details.

Captured instructions can be decoded at any 65816 CPU bus location, including WRAM and cartridge RAM. Different bytes or decode states at one address remain separate variants with their original trace evidence. CPU-state differences that decode to identical instruction bytes, length, and specification are compatible observations; differing instruction encodings remain explicit code conflicts. A ROM file offset is attached only if mapper translation succeeds and the captured bytes match the ROM. RAM nodes do not enter ROM coverage or bank-file export. Static seed limits are spent on ROM PCs; RAM observations are decoded separately.

Trace imports accumulate across captures. An instruction not executed in a later capture retains its earlier evidence and remains an analysis seed. Source-export loss warnings report new code bytes and the net change separately, so additional discoveries cannot hide a loss of previously emitted code.

Selecting a captured RAM location in the analysis graph opens its saved bytes and annotations before attempting live disassembly. The saved view works offline and does not substitute today's RAM contents for a past capture. Memory annotations distinguish CPU operations from DMA/HDMA activity during an instruction. Bus addresses are retained, including WRAM/SRAM aliases; PPU ports do not yet carry reconstructed internal VRAM/CGRAM/OAM buffer offsets.

The ares supplement also exposes stopped, side-effect-free `snes.sram` and `snes.spc700.aram` reads, alongside WRAM and ROM. These are storage peeks. SPC700 instruction tracing/stepping and SuperFX instruction tracing remain unsupported and are not advertised.
