import type { AssemblyModule } from "../relocatable.js";
/** Bumps when on-disk object metadata layout is incompatible with prior readers. */
export declare const OBJECT_FORMAT_VERSION = 1;
/** Write self-contained payloads and typed metadata; mutable asset paths never become external object storage. */
export declare function encodeObject(module: AssemblyModule): Uint8Array;
/** Reader owns its result and checks canonical payload extents before exposing a module to the linker. */
export declare function decodeObject(bytes: Uint8Array): AssemblyModule;
//# sourceMappingURL=object.d.ts.map