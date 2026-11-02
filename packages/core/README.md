# @uttori/asm-core

Architecture-neutral assembly, symbols, macros, includes, diagnostics, and plugin contracts.
The core requires an explicit plugin environment and target. It has no default processor.

## Install

Requires Node.js 26 or newer. Exposes ESM JavaScript and TypeScript declarations.

```sh
npm install @uttori/asm-core @uttori/asm-plugin-snes
```

## Usage

```js
import { Assembler } from "@uttori/asm-core";
import { createSnesAssemblerEnvironment, SNES_TARGET_ID } from "@uttori/asm-plugin-snes";

const assembler = new Assembler({
  environment: await createSnesAssemblerEnvironment(),
  target: SNES_TARGET_ID,
});
try {
  assembler.assembleSource("lorom\norg $008000\nsei", "main.asm");
  console.log(assembler.getBinaryOutput()); // Uint8Array [0x78]
} finally {
  assembler.dispose();
}
```

Pass `fileProvider` and call `setIncludePaths()` for host-managed includes. Use `baseImage` for patching.
`analyzeSource()` provides recovery-oriented diagnostics. Assembly errors throw.
Dispose each assembler session and any `PluginManager` your host creates.

## Entry Points

- `@uttori/asm-core`: assembly sessions, environments, and portable browser entry.
- `@uttori/asm-core/canonical-json`: stable JSON identities for equality, hashes, and review files.
- `@uttori/asm-core/plugin`: plugin registration and lifecycle contracts.
- `@uttori/asm-core/tooling`: Node workspace indexing, symbol navigation and catalogs.
- `@uttori/asm-core/frontend`: explicit source analysis and lowering contracts for hosts.
- `@uttori/asm-core/debug-map`: source mapping and binary identity helpers.

Processor rules, mapping, output formats, and target-specific options belong to plugins.

## Documentation and support

[Configuration](https://github.com/uttori/asm/blob/master/packages/plugin-loader-node/CONFIGURATION.md) ·
[API contracts](https://github.com/uttori/asm/blob/master/packages/core/API.md) ·
[Typed structures](https://github.com/uttori/asm/blob/master/packages/core/STRUCTS.md) ·
[Plugin example](https://github.com/uttori/asm/tree/master/packages/plugin-author) ·
[Contributing](https://github.com/uttori/asm/blob/master/CONTRIBUTING.md).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).

Expression parsing now produces explicit relative/reference, source-text, template and diagnostic nodes.
Core evaluation resolves structured member/index paths and binds user-function parameters without a
legacy-evaluator retry. Macro and define expansion uses ordered, attributed fragments; declaration
captures are explicit program nodes. Generated grammar re-enters the shared frontend and caches syntax
by its actual text. Runtime values remain stage-local. See [API.md](API.md) for the syntax ownership contract. Shipped directives and processor encoders execute typed syntax throughout.

### Typed directive and instruction contracts

Shipped core, 65xx and SNES directives bind validated, serializable syntax payloads. Parsing owns argument grammar; runtime services own file reads, symbol/state changes, numeric evaluation and writes. Mixed data and record initializers retain expression nodes and source spans. Public word-based entries use the same parser and execution implementation as source assembly.

Plugin API v2 requires `operandGrammar` and, for assembly targets, `createTypedEncoder`. The grammar preserves registers, immediate/memory operands, addressing delimiters, indexes, stack forms, bit selectors, lexical widths and multiple operands. The typed factory receives state/options only. Each sizing or emission invocation borrows an `InstructionResolutionFrame`; use `choose` to record the selected form, byte count and processor state, then `evaluate` at the intended cursor and evaluation point. Results record that point/address and never become source strings. Frames and emission capabilities expire after dispatch. Use one shared form selector for sizing and encoding, and reuse a value only when the processor's established evaluation schedule permits it.

`ParsedOperand` is the compound syntax union. The shipped 65xx variants now use typed sizing and encoding for every registered form. The shipped 65816, SPC700 and SuperFX processors also use typed sizing and encoding. Public word encoder entry points parse their inputs and call those same typed implementations. The legacy scanner/evaluator, generic passthrough, operand string expansion, old classifiers and advanced word-encoder helpers have been removed. `raw` expressions cannot execute. `UTTORI_AST_QUALIFY=1` asserts that stage execution never falls back to legacy dispatch or reparses semantic operands/directives.

An optional `prepare` hook preserves classification observations at stage-entry lowering and refreshed command dispatch. Its receipt belongs to that occurrence and stage; it is never syntax-cache data. `evaluate` can select numeric or mathematical grouping semantics, and `observe` records a retained value without executing it again. Optional display text is source-map attribution only. Instruction tracing retains write events and enclosing directive attribution.

Encoders that opt into `deferOperandBindingErrors` must retain parsed unresolved operand structure and preserve the binding diagnostic until the appropriate numeric read. This keeps addressing-mode errors, ordinary value failures and final branch failures in their established stages. Successful generated fragments still re-enter the target grammar.

Directive contributions require versioned `syntax.parse`, `syntax.validate` and `syntax.bind` hooks.
Execution receives the validated payload and detached occurrence metadata; lifecycle middleware
receives typed syntax and source provenance. API v1 `createEncoder`, `createHandler`, and operand
classifier registrations are rejected. Analysis uses the same target operand tree, preserving
repeated reference ranges and excluding register operands. See [API.md](API.md).

## Native objects and linking

The Node entry point `@uttori/asm-core/linker` exposes `encodeObject`, `decodeObject`, `encodeLibrary`, `decodeLibrary`, and `linkObjects`. Assemble with `module: { id: "main" }`, then pass `assembler.getAssemblyModule()` to `encodeObject`. Objects contain their own payloads and dependency receipts; linking does not reopen assembly or asset paths.

```js
import { encodeObject, encodeLibrary, linkObjects } from "@uttori/asm-core/linker";

const mainObject = encodeObject(mainAssembler.getAssemblyModule());
const library = encodeLibrary([
  { name: "graphics.o", object: encodeObject(graphicsAssembler.getAssemblyModule()) },
]);
const linked = linkObjects({
  objects: [mainObject],
  libraries: [library],
  recipe,
  target: targetPolicy,
});
// linked.output, linked.debugMap, linked.symbols, linked.allocations
```

Recipes assign section contributions to ROM load and RAM run regions, retain container bytes, and provide symbols/assertions and bank/page assumptions. The supplied target policy validates mapper/container semantics; use `createSnesLinkTarget` from `@uttori/asm-plugin-snes/target` or `createNesLinkTarget` from `@uttori/asm-plugin-65xx`. A generic link without a policy performs generic field/layout checks only. Checksum recomputation requires a target finalizer.

Library extraction reaches a fixed point across archives in input order. The first indexed provider wins; duplicate globals in selected members fail. Instruction forms stay fixed. Symbolic near data/direct-page fields require explicit runtime assumptions unless the source deliberately masks/extracts the encoded field.

`buildLinkedObjects` from `@uttori/asm-disassembler/source-project` verifies an optional original ROM and atomically selects a complete ROM/debug-map/symbol/allocation set. Hosts supplying cached link operations should pass their exact `toolchainSha256`; target policy revisions and options also enter the input identity. Existing CLI/editor build commands continue to use their established source workflow.
