# Secret of Mana integration

Private game registration for assembly, previews, native source conversion and saved-file interchange. Codec identifiers remain stable. Portable encoders and data models live in `@uttori/asm-assets`; this package binds them to compiler and host contracts.

The assembly plugin is the package root. Authoring hosts explicitly install the contributions from `./workflows`; preview hosts install `./preview`. Native conversion proves equivalent output against the current build. Saved-file interchange uses recorded baselines and reviewed publication; these authority models remain separate.
