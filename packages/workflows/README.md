# @uttori/asm-workflows

Node-hosted source project and asset operations shared by CLI and editor workers. Operations preserve authored source, use verified build inputs, and expose explicit Git preparation, preview, application and recovery.

Import source operations from `@uttori/asm-workflows/source`, source conversion from `@uttori/asm-workflows/asset-source`, and saved-file interchange from `@uttori/asm-workflows/asset-interchange`. Progress and cancellation belong to each request; publication checks belong to the supplied host.

Use `@uttori/asm-workflows/build` for explicit native object assembly, indexed libraries, linking and composed builds. See [linked build commands, manifests and editor configuration](LINKED-BUILDS.md). Lightweight worker contracts are available from `@uttori/asm-workflows/build-contracts`.
