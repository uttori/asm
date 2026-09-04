# Security policy

## Supported code

Uttori ASM is currently unreleased. Security fixes target the current `master` branch; no published
version or long-term-support window is promised yet. Do not change package versions solely to report
or fix a vulnerability.

## Report a vulnerability privately

Do not open a public issue for a vulnerability that exposes arbitrary code execution, path traversal,
credential/session-token disclosure, unsafe native-process control, or private ROM/project content.
Use GitHub private vulnerability reporting for `uttori/asm` when available, or email the package
maintainer at `matthew.callis@gmail.com` with the subject `Uttori ASM security report`.

Include:

- the affected commit and package;
- operating system and Node version;
- the smallest synthetic reproduction;
- expected and observed behavior;
- security impact and required user interaction; and
- whether the report contains information that must remain private.

Do not send commercial ROMs, extracted copyrighted assets, emulator binaries, credentials, session
tokens, or an entire private analysis project. Replace them with hashes, redacted manifests, or the
smallest synthetic byte sequence. If real private material is essential, ask the maintainer how to
transfer it before sending it.

## Security boundaries

- Plugins are trusted in-process JavaScript and are not sandboxed. Loading an untrusted plugin is
  equivalent to running untrusted Node code.
- ROMs, analysis projects, generated-source manifests, traces, debug maps, runtime manifests,
  sidecar frames, and child-process output are untrusted data and should fail closed at their parser.
- Workspace plugin/configuration execution requires VS Code Workspace Trust. Read-only views do not
  make a workspace plugin safe.
- Sidecar sessions use a fresh inherited 256-bit token, bounded frames/queues/requests, and increasing
  sequences. Tokens must not appear in command-line arguments, logs, or emulator environments.
- Emulator processes and GPL runtimes are separately managed programs. MIT packages must not copy,
  link, or unexpectedly package their implementation or binaries.
- A debugger memory space is generically readable only when its capability explicitly declares the
  operation side-effect-free.
- Analysis projects store identities and evidence, never ROM byte payloads.

Validation bugs that only reject a valid file, ordinary assembler correctness errors without a
security boundary, and documented trusted-plugin behavior can be reported publicly. When unsure,
start privately.

## Fix expectations

A security fix should add a synthetic regression test at the narrowest boundary, retain resource
bounds, preserve explicit errors, and run the relevant fuzz, package, protocol, and hosted gates.
Update [CONTRIBUTING.md](CONTRIBUTING.md),
and [the architecture guide](docs/disassembler-architecture.md) if the trust model or release claim
changes.
