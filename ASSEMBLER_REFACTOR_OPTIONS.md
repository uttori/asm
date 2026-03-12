# Assembler Refactor Options

This note turns the `src/assembler.ts` review into a concrete refactor guide.
It is intentionally biased toward preserving current behavior, especially the
existing three-pass assembly flow exercised by `tests/assembler.integration.test.ts`.

## Current Responsibility Map

`src/assembler.ts` is currently acting as an assembly session object plus most of
the assembler implementation.

### 1. Session State And Lifecycle

- Owns pass-sensitive mutable state such as `pass`, address cursors, mapper mode,
  condition stack, namespace stack, macro state, label tables, struct tables, and
  include tracking.
- Coordinates pass execution through `setPass()` and `finishPass()`.
- Exposes expression-time services through `expressionHost`.

This is the right place for a coordinator to exist. The problem is that the
coordinator also owns nearly all implementation details.

### 2. Front-End Normalization And Dispatch

- `assembleblock()`
- `removeInlineComment()`
- `splitCommandIntoWords()`
- `processCommand()`

This is the highest-leverage extraction seam. `processCommand()` is currently:

- preprocessor
- macro-reference fixer
- conditional gatekeeper
- directive dispatcher
- instruction dispatcher
- loop collector
- partial parser

That is too many roles for one method.

### 3. Macro Engine

- `callMacro()`
- `expandMacroLine()`
- `resolveVariadicPlaceholders()`
- `processMacroLine()`

This is already a conceptual subsystem. It has its own state model, its own
scoping rules, and its own mini-language behavior. It is also tightly coupled to
label scoping and conditional execution, which is why it should be extracted only
after a small session interface exists.

### 4. Symbol And Scope Resolution

- `setLabel()`
- `handleLabelDefinition()`
- `getLabelValue()`
- `getLabelValueDirect()`
- `findNextLabel()`
- `findPreviousLabel()`
- namespace and sublabel behavior
- macro-local label naming conventions
- struct lookup via `resolveStructMember()`

This subsystem is doing more than "lookup labels". It is also encoding scope into
string keys and maintaining hierarchy rules. That means a future `SymbolTable`
should probably own:

- label storage
- namespace lookup policy
- sublabel hierarchy rules
- macro-local label naming

and not just `Map<string, LabelEntry>`.

### 5. Directive Semantics

Representative examples:

- conditionals and loops: `handleIf()`, `handleElseIf()`, `handleWhile()`,
  `beginLoopCollection()`, `executeForLoop()`
- defines: `handleDefineCommand()`, `processNestedDefines()`,
  `resolveRegularDefines()`
- data and structs: `handleDataDirective()`, `writeDataByLength()`,
  `resolveStructLabel()`, `resolveStructMember()`
- namespaces: `handleNamespace()`, `handlePushNamespace()`,
  `handlePullNamespace()`
- memory/layout directives: `handleOrg()`, `handleFreespace()`,
  `handleSpcblock()`, `handleProt()`

This logic is the real bulk behind the large `switch` in `processCommand()`.

### 6. ROM Mapping And Emission

- `step()`
- `write1_65816()`, `write1()`, `write2()`, `write3()`, `write4()`
- `assertBankCrossAllowed()`
- `snestopc()`, `pctosnes()`
- `verifysnespos()`, `fixsnespos()`
- checksum and finalization behavior in `finishPass()`

This is another clear subsystem. It is cohesive, heavily stateful, and mostly
orthogonal to parsing. It should eventually become a `RomWriter` or
`AddressSpace` service.

### 7. File And Include IO

- `resolveReadablePath()`
- include path state via `setIncludePaths()`
- expression-time file reads through `readExpressionFile()`
- target ROM reads through `readTargetRom()`

This is relatively small, but it is mixed into unrelated areas right now.

### 8. Existing Good Seams

The codebase already has two extractions that point in the right direction:

- `src/operand-resolver.ts`
- architecture encoders in `src/Arch65816.ts`, `src/ArchSPC700.ts`,
  `src/ArchSuperFX.ts`

That suggests the safest path is not a rewrite. It is repeated service extraction
from the current session object.

## What Other Languages And Compilers Usually Do

The useful patterns here are not "plugins first". They are:

- coordinator/session object with extracted services
- registry-based directive or pragma dispatch
- explicit phase pipeline or pass manager
- AST/IR front-end only when the language surface justifies it

For this assembler, the relevant lesson is that most mature compilers separate:

- source normalization
- command parsing
- symbol analysis
- target-specific encoding
- output emission

The current file collapses all of those back into one class.

## Option Comparison

### Option 1: Service Extraction Around `Assembler`

Keep `Assembler` as the coordinator and move logic into internal services such as:

- `DirectiveRegistry`
- `MacroEngine`
- `SymbolTable`
- `RomWriter`
- `SourceResolver`

Pros:

- lowest risk
- preserves current three-pass semantics
- aligns with the existing `OperandResolver` and architecture encoder pattern
- easy to ship incrementally

Cons:

- still relies on shared mutable state
- can become "many helpers around one god object" if interfaces stay too wide
- some temporary back-and-forth delegation is inevitable

Best use:

- immediate next step

Verdict:

- best base strategy

### Option 2: Directive Registry / Table-Driven Handlers

Replace the large `switch` inside `processCommand()` with a directive registry:

```ts
type DirectiveHandler = (ctx: DirectiveContext, words: string[], raw: string) => void;
```

Examples:

- `registry.set("if", handleIfDirective)`
- `registry.set("org", handleOrgDirective)`
- `registry.set("db", handleDataDirective)`

Pros:

- directly attacks the biggest hotspot in the file
- improves discoverability of directive behavior
- enables small focused tests per directive group
- is compatible with service extraction
- creates a future path toward internal plugins without freezing a public API

Cons:

- does not solve state coupling on its own
- some directives will still need broad session access initially
- ordering rules must stay explicit:
  - macro expansion before directive dispatch
  - conditional gating before most directives
  - instruction fallback after directive lookup

Best use:

- first extraction slice

Verdict:

- best first structural change

### Option 3: Explicit Phase / Pass Pipeline

Model the assembler around explicit phases, for example:

- normalize source
- expand macros
- resolve labels
- encode instructions
- emit bytes
- finalize ROM

Pros:

- matches the existing `setPass()` / `finishPass()` model
- makes pass-specific behavior less implicit
- helps reduce scattered `if (this.pass === 0)` checks over time

Cons:

- current implementation is line-oriented and string-driven, not phase-object driven
- requires a clearer command representation before it pays off
- higher migration risk than service extraction

Best use:

- medium-term follow-up after dispatch and state boundaries improve

Verdict:

- good architecture target, bad first move

### Option 4: True Plugin System

Allow external registration of directives, architectures, or phase hooks:

- `registerDirective(name, handler)`
- `registerArchitecture(name, factory)`
- `registerPass(name, hook)`

Pros:

- strongest extensibility story
- useful for experimental directives or alternate architectures
- conceptually consistent with the existing architecture encoder seam

Cons:

- premature at the current state boundary quality
- forces API stabilization too early
- increases debugging difficulty
- invites leaking mutable internal state to third-party code
- can make pass ordering and determinism harder to reason about

Best use:

- only after internal service interfaces stabilize

Verdict:

- not recommended as the first or second step

### Option 5: Parse To AST / IR Then Assemble

Parse the source into structured command nodes, then run later passes over those
nodes instead of reprocessing strings.

Pros:

- cleanest long-term design
- best for diagnostics, analysis, and future growth
- removes a lot of repeated string splitting and ad hoc parsing

Cons:

- highest rewrite cost
- macro/include/conditional compatibility makes this much harder than it sounds
- current tests validate behavior, not a parsed intermediate model
- likely a multi-stage rewrite, not a refactor

Best use:

- only if the project grows into a significantly larger assembler front-end

Verdict:

- long-term possibility, not a practical near-term plan

## Recommendation

Use a hybrid of option 1 and option 2.

In other words:

1. Keep `Assembler` as the coordinator/session object.
2. Extract a `DirectiveRegistry` and handler modules first.
3. Introduce a small internal `AssemblySession` interface.
4. Move macro, symbol, and ROM logic behind that interface in later steps.
5. Re-evaluate whether a pass manager layer is still needed after those splits.
6. Delay any public plugin API until internal seams stop changing.

This path matches the code that already exists. It does not pretend the current
assembler is one abstraction away from being pluggable.

## First Extraction Slice

The first extraction should change as few call sites as possible while shrinking
`processCommand()` materially.

### Recommended first slice

Extract only the directive dispatch shell:

- keep in `Assembler` for now:
  - `assembleblock()`
  - macro preprocessing
  - conditional short-circuit logic
  - instruction fallback to `asblock_pick()`
- move out:
  - the large directive `switch`
  - grouped directive handlers and aliases

This keeps control-flow-sensitive behavior in one place while removing the worst
maintenance hotspot.

### Good handler groupings

- `directives/flow-control.ts`
  - `if`, `elseif`, `else`, `endif`, `while`, `endwhile`, `for`, `endfor`
- `directives/namespace.ts`
  - `namespace`, `pushns`, `pullns`
- `directives/layout.ts`
  - `org`, `startpos`, `arch`, mapper directives, `check bankcross`
- `directives/data.ts`
  - `db`, `dw`, `dl`, `dd`, `dc.b`, `dc.w`, `dc.l`
- `directives/memory.ts`
  - `freespace`, `freecode`, `freedata`, `freespacebyte`, `prot`
- `directives/spc.ts`
  - `spcblock`, `endspcblock`

### Why this slice is safe

- `processCommand()` keeps ownership of ordering
- existing handler methods can be reused before they are moved
- tests should mostly see unchanged behavior
- it creates a home for later extractions without forcing them now

## Minimal Internal Interfaces

The main risk in extraction is replacing one giant class with modules that all
reach back into the giant class. A small internal interface limits that.

### `AssemblySession`

```ts
interface AssemblySession {
  readonly pass: number;
  readonly currentFile: string;
  readonly currentLine: number;
  readonly currentAddress: number;
  readonly currentBaseAddress: number;

  defines: Map<string, string>;
  macros: Map<string, MacroDefinition>;
  structs: Map<string, StructDefinition>;
  labelTable: Map<string, LabelEntry>;

  processCommand(command: string): void;
  resolvedefines(input: string): string;
  evaluateExpression(input: string): boolean;
  getLabelValue(label: string, requireStatic: boolean): number;
  setLabel(label: string, value?: number, isStatic?: boolean, isMacroLabel?: boolean, isGlobal?: boolean, modifiesHierarchy?: boolean): void;

  write1(value: number): void;
  write2(value: number): void;
  write3(value: number): void;
  write4(value: number): void;
  step(count: number): void;
}
```

This interface is intentionally internal. It is not a public plugin contract.

### `DirectiveRegistry`

```ts
interface DirectiveContext {
  session: AssemblySession;
  operandResolver: OperandResolver;
}

type DirectiveHandler = (ctx: DirectiveContext, words: string[], raw: string) => void;
```

The registry should stay internal until handler ergonomics and state boundaries
settle down.

## Suggested Extraction Sequence

### Phase 1: Directive Registry

Goal:

- shrink `processCommand()` without changing pass semantics

Work:

- add `src/directives/registry.ts`
- move the directive `switch` into registry-backed dispatch
- group aliases like `db` / `dc.b` together

Expected payoff:

- immediate readability win
- lower merge-conflict surface
- better targeted tests

### Phase 2: Macro Engine

Goal:

- move macro behavior out of `Assembler`

Work:

- extract `callMacro()`
- extract `expandMacroLine()`
- extract `resolveVariadicPlaceholders()`
- extract `processMacroLine()`

Risk:

- medium, because macro expansion touches labels, defines, conditionals, and loops

### Phase 3: Symbol Table / Scope Resolver

Goal:

- isolate label storage and lookup policy

Work:

- extract `setLabel()`
- extract `getLabelValue()` / `getLabelValueDirect()`
- extract relative label search
- move namespace and sublabel policy beside symbol storage

Risk:

- medium-high, because label naming conventions are currently encoded in strings

### Phase 4: ROM Writer / Address Space

Goal:

- separate emission from parsing and macro logic

Work:

- extract address conversion
- extract write methods
- extract bank-cross checks
- extract pass-final output patching

Risk:

- medium, but conceptually clean

### Phase 5: Optional Pass Pipeline Cleanup

Goal:

- make pass rules explicit if still needed

Work:

- reduce ad hoc pass guards
- decide whether to formalize a pass manager or keep the current loop

Risk:

- only worth doing after earlier extractions land

## What Not To Do First

Avoid these as the initial move:

- public plugin API
- full AST rewrite
- simultaneous extraction of macros, symbols, and ROM writing
- moving directive ordering rules out of `processCommand()` before tests cover them

Those paths maximize churn before the state boundaries are understood.

## Testing Strategy For The Refactor

The current integration tests are useful, but they are too coarse to guide safe
extraction by themselves.

Add focused tests as each subsystem moves:

- directive registry dispatch tests
- macro engine tests split from monolithic assembler tests
- symbol lookup tests for namespace and macro-label edge cases
- ROM writer tests for mapper conversions and bank-cross rules

Keep the existing integration loop unchanged during early phases:

```ts
for (const pass of [0, 1, 2]) {
  assembler.setPass(pass);
  // assemble lines
  assembler.finishPass();
}
```

That loop is part of the current behavioral contract and should not move until
the internal services prove stable.

## Bottom Line

The best practical answer is:

- not a plugin system first
- not an AST rewrite first
- yes to service extraction
- yes to a directive registry as the first concrete step

The codebase is already showing the right direction through `OperandResolver` and
the architecture encoders. `src/assembler.ts` should be decomposed the same way:
one high-level session object, several focused internal services, and no public
extension surface until the internals settle down.
