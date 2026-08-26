# 65xx implementation plan

Status: Phases 0–5 and 7 implemented; Phase 6 deferred; Phases 8–9 planned
Updated: 2026-08-26

## Outcome

Maintain a production `plugins/65xx` plugin that owns the
6502-derived instruction-set families not already owned by the SNES plugin,
supports native project syntax, and offers a source-compatibility profile for
ca65. The implementation must cover undocumented NMOS instructions and the
larger vendor extensions as first-class scope; those variants are staged, but
not deferred to an unspecified future project.

This extends the project's architecture coverage beside the existing SNES
65816 implementation. It does not replace or reorganize that implementation.
Anything derived from or extending 65816 remains part of the SNES core.

At the same time, correct an architectural boundary that the initial prototype exposed:
several facilities currently called “core” encode SNES, 65816, or Asar policy.
The assembler core should retain reusable mechanics, while architecture,
target, and dialect policy moves behind plugin-owned contributions.

## Scope decisions

### First-class architecture set

The following architecture IDs are part of this plan's acceptance criteria.
Their names follow ca65 where practical so that `.setcpu` and command-line
compatibility do not need a second translation vocabulary.

| Architecture ID | Instruction-set intent | Delivery track |
| --- | --- | --- |
| `65xx.6502` | Legal NMOS 6502 instructions | NMOS base |
| `65xx.6502x` | NMOS 6502 plus all documented ca65 undocumented opcodes | NMOS base |
| `65xx.6502dtv` | C64DTV extensions | Commodore extensions |
| `65xx.65sc02` | Early CMOS set without bit instructions or `WAI`/`STP` | CMOS |
| `65xx.65c02` | CMOS plus Rockwell extensions | CMOS |
| `65xx.w65c02` | WDC CMOS set, including bit instructions and `WAI`/`STP` | CMOS |
| `65xx.65ce02` | CSG 65CE02 extensions | Commodore extensions |
| `65xx.4510` | Commodore 65 / 4510 extensions | Commodore extensions |
| `65xx.45gs02` | MEGA65 / 45GS02 extensions and compound encodings | Commodore extensions |
| `65xx.huc6280` | Hudson HuC6280 extensions | Vendor extensions |
| `65xx.m740` | Mitsubishi M740 extensions | Vendor extensions |

This covers ca65's current hardware CPU choices other than 65816, which is
already implemented and remains owned by the SNES plugin. `sweet16` is not
included because it is an interpreted pseudo-CPU rather than a 65xx silicon
variant; it can be a separate architecture contribution later without changing
this model.

Chip names whose instruction encoding is identical to one of these sets should
be aliases or target profiles rather than copied opcode tables. Initial aliases
should include `6510`, `8502`, `2A03`, `2A07`, and `6507` for the appropriate
NMOS instruction set. Electrical, bus-width, decimal-mode, or memory-map
differences belong to the target profile unless they change accepted
instructions or emitted bytes. `65C816`, `65802`, and any future 65816-derived
extensions belong to the SNES plugin instead.

“First-class” means each row has an explicit architecture identity, catalog,
encoder, fixtures, and compatibility tests in this plan. It does not mean all
rows must land in one pull request.

### Package and target ownership

- Use `plugins/65xx` and package identity `@uttori/asm-plugin-65xx` without
  alternate package or contribution identities.
- Use stable architecture IDs under `65xx.*`; targets should identify a machine
  or output model rather than pretending every CPU is a distinct machine.
- Provide a flat/raw 16-bit target for small programs, tutorials, and binary
  fixtures. Additional machine targets can supply address mapping, headers, and
  image rules independently of the CPU encoder.
- The SNES plugin remains the sole owner of the existing 65816 encoder,
  classifier, width-state behavior, instruction catalog, and any future
  65816-derived extensions. The 65xx work does not replace, extract, wrap, or
  become a dependency of that implementation.
- The 65xx plugin adds the other 6502-derived variants beside the SNES plugin.
  It may reuse public core contracts and follow proven SNES architectural
  patterns, but it owns independent opcode data, classifiers, and tests for its
  architecture set.

### Syntax and compatibility

The native 65xx syntax should stay close to the existing SNES core where the
notation is conventional and unambiguous: `$` hexadecimal values, `#`
immediates, parentheses/brackets, comma-indexed operands, labels, and the
project's ordinary data/output flow.

ca65 support is a named source-compatibility profile layered over the same
architecture encoders. It should cover CPU selection, operand notation,
operators, labels/scopes, macros, data/include directives, and common control
directives. It must not claim full ca65 compatibility until relocatable object
files, segments, linker expressions, and linker configuration semantics are
implemented. Flat-source compatibility and cc65 object/link compatibility are
separate milestones.

## Architectural design

### One declarative instruction model

Do not implement variants as copied switch statements. Define a declarative
instruction-form schema from which the encoder lookup, size calculation,
instruction catalog, documentation, and most tests are derived.

This schema is for the new 65xx plugin architectures. Adopting it does not
require converting the existing SNES `Arch65816` implementation, and parity
between the two implementation styles is not a prerequisite for this plan.

Conceptually, each form needs:

```ts
interface InstructionForm {
  mnemonic: string;
  aliases?: readonly string[];
  mode: AddressingMode;
  encoding: readonly number[];
  operands: readonly OperandField[];
  codec?: OperandCodecId;
  availableWhen: FeatureExpression;
  stateEffect?: ArchitectureStateEffect;
  canonical?: boolean;
}
```

The model must support more than a single opcode byte:

- fixed prefix and compound byte sequences for 45GS02;
- multiple legal encodings of undocumented instructions and NOPs in 6502X;
- bit-number operands and bit branches;
- 8-bit and 16-bit relative branches;
- HuC6280 block transfers and register-mask forms;
- M740 and Commodore-specific operand layouts;
- variant-specific state only where one of the 65xx architectures in scope
  requires it.

`codec` should select a small, tested operand-layout strategy. It is an escape
hatch for genuinely unusual encodings, not permission to put an arbitrary
per-instruction function into the table. When several bytes encode the same
mnemonic/mode, mark one canonical for ordinary assembly and expose a deliberate
way to select alternates where source compatibility requires it.

### Variant composition

Represent a CPU as capabilities and overlays, not an inheritance chain that
assumes every later chip is a strict superset. For example:

```text
NMOS legal + undocumented + DTV overlay
CMOS base + Rockwell overlay + WDC overlay
65CE02 base + 4510 overlay + 45GS02 overlay
HuC6280 family overlay
M740 family overlay
```

Availability expressions should be auditable from generated reports: for every
mnemonic/mode/encoding, the test suite must be able to list exactly which CPUs
accept it. This avoids accidentally treating incompatible vendor additions as
one monotonic “latest 6502” set.

### Operand classification ownership

`classifyGenericOperand` is not generic. It knows about direct-page spelling,
65816 stack-relative and long modes, SPC700 register/bit forms, and Super FX
register names. Core's `OperandResolver.lowerOperand()` also calls it directly,
which bypasses the architecture contribution already intended to own operand
classification.

The planned boundary is:

1. Keep only target-neutral token/lexical facts in core: raw text, immediate or
   indirect punctuation, numeric spelling, resolved value, unresolved-symbol
   status, and the unvalidated index token.
2. Consolidate the current classifier into
   `plugins/snes/src/architectures/operand-classifiers.ts`; remove the duplicate
   core implementation and export after consumers migrate.
3. Remove the classifier call from `OperandResolver.lowerOperand()`. Lowering
   must delegate to the active architecture, or the resolver must become a pure
   expression/operand-expansion service.
4. Add `plugins/65xx/src/operands/classifier.ts`, with only 65xx modes and
   variant-aware decisions. The classifier selects candidates; the instruction
   table validates whether the active CPU actually implements them.
5. Preserve the index token as a string in core. Registers such as `S`, `Z`, or
   vendor-specific forms are validated by the architecture instead of being a
   hard-coded core union.

Address-size forcing must be explicit metadata, not inferred from SNES-only
bank heuristics. Native and ca65 profiles may translate their respective
spelling into common force-width metadata before classification.

## Core ownership audit

The audit found the following additional areas where generic machinery and
SNES/Asar policy are currently mixed. Extraction should be incremental and
protected by the existing SNES behavioral baseline.

| Current area | Hidden assumption | Planned boundary |
| --- | --- | --- |
| `operand-resolver.ts` | Same-bank checks, `label,x` shortening, 24-bit values, and a three-byte width ceiling encode 65816 rules | Core resolves expressions and reports value/source-width facts; the active architecture chooses address width and mode |
| `operand-syntax.ts` | The index-register union is fixed to `X`, `Y`, and 65816 `S` | Core recognizes punctuation and preserves an index token; architectures validate registers and compound forms |
| `command-text-service.ts` | Leading whitespace is discarded, ` : ` is an Asar statement separator, and `+`/`-` labels plus `!` defines are globally recognized | Add a syntax-profile contribution for whitespace, comments, separators, label forms, and define markers |
| `front-end-command-service.ts` | A token beginning with `.` is assumed to be a label, which conflicts with ca65 dotted directives | Make directive/label precedence and label grammar syntax-profile policy |
| `define-engine.ts` | `!name`, `!{name}`, `:=`, `#=`, `?=`, and `undef` are Asar spellings | Keep symbol operations in core; parse spellings in dialect adapters |
| `macro-engine.ts` | `macro/endmacro`, `%Name`, `<param>`, `!<param>`, and `?` labels are Asar macro syntax | Keep macro storage and expansion mechanics in core; make declaration, invocation, placeholders, and local-label syntax dialect-owned |
| `mathcore.ts` and expression parsing | `<:` and several function names are Asar conventions; ca65 needs its own low/high/bank operators and pseudo-functions | Keep the evaluator and expression IR in core; register operators, aliases, and built-ins from an expression profile |
| `directives/include-source.ts` | `incbin` range forms, EOF sentinel behavior, and parsing helpers follow Asar | Keep file-provider/include primitives in core; move operand parsing and aliases to SNES/Asar and ca65 profiles |
| `directives/misc.ts` | Print/assert/error forms, character tables, and `warnpc` follow Asar | Retain generic diagnostics/table capabilities; register dialect handlers from plugins |
| `directives/fill-pad.ts` | `pad` without an address advances to the next 64 KiB bank | Keep fill/emit mechanics in core; make the implicit boundary a target/dialect rule |
| `directives/registry.ts` | Core eagerly installs dialect directives and globally accepts Asar's `@directive` header form | Compose the registry from core primitives plus active target/dialect directive sets; put `@` handling in the Asar profile |
| `directive-runtime-service.ts` | `db/dw/dl/dd` and `dc.*` aliases are treated as universal, and metadata masks to 24 bits | Keep width-based data emission; contribute aliases by dialect and normalize addresses through the target address space |
| `lsp/directive-catalog.ts` | The supposedly global catalog advertises Asar/SNASM spellings regardless of active target | Build tooling catalogs from active core primitives plus plugin/dialect contributions |
| `assembler.ts` | Several source-map and size calculations mask addresses with `0xffffff` | Normalize through the active address-space contribution and its declared width |
| `debug-tracing.ts` | Addresses are always masked and formatted as six hexadecimal digits | Format using the active target's address width |
| `struct-engine.ts` | Structure bases are capped at `0xffffff` | Validate against the active address width or segment model |
| Core naming and comments | “ROM address,” “ROM data,” and similar names imply SNES patching in generic services | Prefer “logical address,” “output image,” and “base image”; keep actual ROM/patch policy in target plugins |

The hard-coded address checks are correctness issues, not only naming issues.
Most 65xx targets are 16-bit, 65816 is 24-bit, and 4510/45GS02 mapping behavior
cannot be modeled safely by applying a universal 24-bit mask.

The following remain core responsibilities: assembly stages, diagnostics and
source provenance, symbol storage, expression-evaluation mechanics, file access
interfaces, output-writing primitives, plugin/session lifecycle, and tooling
contracts. Some of their current public names may remain temporarily for source
compatibility even after the policy behind them is moved.

## Delivery plan

### Phase 0: lock down behavior and sources of truth

Implementation status: complete. The pinned source record is in
`docs/65xx-reference-baseline.md`, with machine-readable pins in the 65xx
fixture directory. The post-change regression gates pass.

- Preserve all existing SNES production hashes and architecture catalog tests.
- Record package-loader behavior before changing the architecture contribution.
- Check in machine-readable reference fixtures rather than copying assembler
  implementation code.
- Treat 6502js as a behavioral oracle and fixture source only. It is GPLv3 while
  this repository is MIT, so do not transplant its implementation.
- Use the Easy 6502 and mass:werk material for explanations and independent
  cross-checks; use official CPU documentation and ca65 behavior for edge cases.
- Pin a known ca65 version or commit for differential fixtures so upstream
  changes do not silently redefine expected output.

Exit criterion: current `verify` and SNES fixture gates pass, and reference
provenance/versioning is documented.

### Phase 1: establish the core/plugin boundary

Implementation status: complete and verified. The existing SNES classifiers
and 65816 width policy remain SNES-owned. Core now exposes neutral operand facts,
architecture-bound lowering, address-width operations, syntax profiles, and
composable core directive groups. The initial 65xx scaffold has an independent
6502 classifier; it remains intentionally non-encoding until Phase 2.

- Introduce target-neutral operand lexical/resolution metadata.
- Move `classifyGenericOperand` and its SNES-specific tests into the SNES plugin,
  then implement the independent 65xx classifier.
- Remove same-bank and three-byte width policy from the core resolver.
- Replace hard-coded 24-bit masks and formatting with address-space operations.
- Add the minimal syntax-profile hooks required to distinguish Asar, native
  65xx, and ca65 command/label parsing without rewriting the whole front end.
- Make active directive/tooling catalogs compositional.

Exit criterion: SNES output hashes remain identical; the 65xx scaffold does not import
a SNES-shaped core classifier; a minimal 6502 operand matrix can be classified
without 65816/SPC700/Super FX concepts.

### Phase 2: rename and build the 65xx architecture foundation

Implementation status: complete and verified. The production
`@uttori/asm-plugin-65xx` package owns declarative instruction forms, feature
expressions, codecs, generated catalogs, and the configurable-origin
`65xx.raw`/`65xx.flat16` target. It exposes only the production package and
contribution identities.

- Establish the package, plugin ID, configuration fixtures, loader tests, and docs.
- Add the instruction schema, feature expressions, operand codecs, architecture
  factories, and generated catalogs.
- Add a raw/flat target with configurable origin and a 16-bit address space.

Exit criterion: the plugin assembles a small legal 6502 program, emits a useful
instruction catalog, and has no dependency on SNES internals.

### Phase 3: NMOS base, including 6502X

Implementation status: complete and verified. The legal 151-opcode NMOS set,
all 256 NMOS decode slots, ca65's undocumented 6502X names, duplicate encoding
policy, unstable-opcode metadata, aliases, branch validation, width forcing,
and zero-page/absolute selection are covered by generated integrity tests and a
221-form differential fixture from pinned ca65 V2.19.

- Implement every legal 6502 mnemonic and addressing mode.
- Implement 6502X undocumented opcodes in the same milestone, including opcode
  aliases, duplicate encodings, and unstable/variant-sensitive cases with clear
  diagnostics or explicit policy.
- Add 6510/8502/2A03/2A07/6507 aliases or target profiles as appropriate.
- Implement branch range checks, zero-page versus absolute selection, indirect
  jump quirks where relevant to diagnostics, and explicit width forcing.

Exit criterion: exhaustive 256-opcode decode/encode coverage for both 6502 and
6502X, plus differential byte tests against the pinned ca65 version.

### Phase 4: CMOS variants

Implementation status: complete and verified. The three independent ca65
tables materialize 182 `65SC02`, 214 Rockwell `65C02`, and 216 WDC `W65C02`
forms. Availability negatives and every emitted form are covered by the pinned
Phase 4/5 differential fixture.

- Add 65SC02, Rockwell 65C02, and W65C02 as independent capability
  compositions.
- Test accepted and rejected instructions, not only positive encoding cases.
- Cover bit operations, bit branches, `STZ`, `BRA`, indirect addressing changes,
  and WDC-only `WAI`/`STP` distinctions.

Exit criterion: generated availability reports and ca65 differential suites pass
for all three variants.

### Phase 5: Commodore extensions

Implementation status: complete and verified. The plugin exposes 192 C64DTV,
263 65CE02, 263 4510, and 350 45GS02 forms. Architecture-owned codecs cover Z
and stack syntax, bit branches, 16-bit relative offsets, Q operations, and
compound prefixes. All 1,680 Phase 4/5 forms match the pinned ca65 fixture.

- Add 6502DTV, 65CE02, 4510, and 45GS02.
- Add codecs for new registers, 16-bit relative forms, mapping instructions,
  quad/compound operations, and multi-byte opcode prefixes.
- Model logical address width and machine mapping separately from instruction
  encoding, especially for 4510 and 45GS02 targets.

Exit criterion: each architecture has exhaustive opcode fixtures, negative
availability tests, catalog parity, and pinned ca65 differential tests.

### Phase 6: HuC6280 and M740

- Add HuC6280 special registers, bit operations, test forms, and block-transfer
  operand layouts.
- Add M740-specific instructions, bit forms, and addressing restrictions.
- Keep vendor-specific syntax in their architecture/profile modules rather than
  widening the global operand grammar.

Exit criterion: exhaustive architecture fixtures and ca65 differential suites
pass for both variants.

### Phase 7: SNES-owned 65816 compatibility extension

Implementation status: complete and verified. The SNES plugin gains ten ca65
65816 source-compatibility directives — `.a8`, `.a16`, `.i8`, `.i16`, `.accu`,
`.index`, `.smart`, `.setcpu`, `.pushcpu`, and `.popcpu` — and three new
architecture aliases (`65c816`, `65802`) without disturbing the existing encoder,
classifier, mapper, SPC block, or production hashes.  The Phase 8.1 CPU-stack
and `.setcpu` SNES forms are also delivered here as called out by the plan.

- Compare ca65's 65816 source behavior with the existing SNES `Arch65816`
  implementation and catalog without moving either into the 65xx plugin.
- Extend the SNES plugin with the useful ca65 65816 syntax, aliases, width-state
  directives, and compatibility behavior identified by that comparison.
- Keep the existing SNES encoder, classifier, width-state model, same-bank
  optimization, mapper behavior, and ROM patch semantics intact and SNES-owned.
- Add `65C816` and `65802` aliases or target distinctions in the SNES plugin if
  the compatibility analysis shows they are useful.
- Reuse only target-neutral syntax/expression profile contracts from core. Do
  not introduce an opcode-table or architecture-factory dependency between the
  SNES and 65xx plugins.

Exit criterion: the SNES plugin gains the selected ca65 65816 compatibility
features while retaining its current implementation and every existing SNES
verification hash and diagnostic.

### Phase 8: ca65 source-compatibility profile

Implement compatibility in vertical slices so real programs can be used early:

1. `.setcpu`, `.pushcpu`, `.popcpu`, CPU shorthand directives, `.CPU`, and CPU
   conditional directives for every first-class 65xx architecture. The
   corresponding 65816 forms are complete as part of Phase 7 (SNES-owned).
2. ca65 number formats, unary low/high/bank operators, force-address-size
   syntax, pseudo-functions, and symbol assignment.
3. dotted directives, label forms, cheap/unnamed locals, scopes, and procedures.
4. `.byte`/`.word`/`.dword` and aliases, `.res`, `.align`, `.org`, `.include`,
   `.incbin`, assertions, and conditional assembly.
5. ca65 macro declaration, invocation, parameters, local symbols, repeat forms,
   and common emulation features.
6. segment/address-size source semantics that can still emit a flat image.

Relocatable cc65 object generation, imports/exports requiring linker resolution,
linker configuration, libraries, and full debug/listing formats are a separately
estimated project. Unsupported directives must produce precise diagnostics
rather than being silently ignored.

Exit criterion: a published compatibility matrix identifies supported,
partially supported, and unsupported ca65 features; selected real-world flat
sources assemble byte-for-byte; no claim of object/linker parity is made.

### Phase 9: consolidation and publication

- Generate architecture reference tables and LSP completion/hover data from the
  instruction model.
- Document selecting CPUs, aliases, native versus ca65 syntax, and raw targets.
- Publish the core/SNES ownership changes and extension authoring contract.

## Validation strategy

Each architecture must pass the same classes of checks:

- table integrity: no accidental duplicate encoding, missing operand codec, or
  contradictory availability expression;
- exhaustive encoding: every declared form emits expected fixed and operand
  bytes at boundary values;
- negative availability: instructions from sibling variants are rejected;
- all-opcode coverage where the architecture has a meaningful 256-byte opcode
  map, including undocumented/duplicate forms;
- branch boundary and unresolved-label relaxation tests;
- instruction size/catalog/encoder agreement generated from the same forms;
- native-syntax and ca65-profile fixtures;
- differential assembly against a pinned ca65 build;
- independent spot checks against published hardware references;
- unchanged SNES production hashes throughout the core-boundary migration.

Differential failures must be classified as implementation bugs, intentional
syntax differences, known ca65 behavior, or hardware ambiguity. Do not “fix” a
fixture merely to agree with one reference without recording which policy the
project chose.

## Proposed pull-request sequence

1. Core boundary tests and address-width normalization.
2. Operand-classifier extraction plus independent 65xx classifier.
3. Package rename, migration aliases, instruction schema, and raw target.
4. 6502 + 6502X, including exhaustive and differential fixtures.
5. 65SC02 + 65C02 + W65C02.
6. 6502DTV + 65CE02 + 4510.
7. 45GS02 compound encodings.
8. HuC6280 + M740.
9. SNES-owned ca65 65816 compatibility review and additions, with no ownership
   transfer or shared encoder dependency.
10. ca65 compatibility slices, followed by documentation and deprecation
    cleanup.

PRs may be split further, but none of the first-class architecture rows should
be moved to a noncommittal “future extensions” section.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Core extraction changes mature SNES behavior | Preserve production hashes and migrate one policy boundary at a time |
| A single opcode-byte schema cannot express 45GS02 or special vendor forms | Design fixed byte sequences and operand codecs before populating tables |
| Variant inheritance accepts instructions on the wrong CPU | Use explicit feature expressions and generated negative matrices |
| ca65 parsing contaminates the native grammar | Keep named syntax/expression/directive profiles over shared mechanics |
| “Compatibility” is interpreted as cc65 linker compatibility | Publish separate source, object, and linker compatibility matrices |
| GPL implementation code enters the MIT repository | Use 6502js only for black-box behavior and independently authored fixtures |
| 65xx work accidentally replaces or duplicates mature 65816 logic | Keep 65816 and all derived extensions exclusively SNES-owned; share only core contracts and behavioral patterns |
| Address assumptions break non-SNES CPUs | Route bounds, normalization, and formatting through the target address-space contract |

## Reference material

- [ca65 Users Guide](https://cc65.github.io/doc/ca65.html), especially CPU
  selection, input format, expressions, symbols, scopes, address sizes,
  directives, and macros.
- [ca65 instruction implementation](https://github.com/cc65/cc65/blob/master/src/ca65/instr.c)
  for differential behavior and variant naming; pin a commit before generating
  golden fixtures.
- [Easy 6502](https://skilldrick.github.io/easy6502/) for accessible baseline
  syntax and tutorial programs.
- [mass:werk 6502 instruction set](https://www.masswerk.at/6502/6502_instruction_set.html)
  and [6502 simulator](https://www.masswerk.at/6502/) for independent baseline
  cross-checks.
- The vendored `6502js/` tree as a GPLv3 behavioral reference, not a code source.
- Existing SNES architecture catalogs, tests, and
  `docs/plugin-migration-baseline.md` as the core-boundary migration safety net.
