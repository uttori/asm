/** Exact package contents consumed by a trusted Node host, independent of installation directories. */
export interface ToolchainFingerprint {
    /** Hex SHA-256 of the canonical JSON of node and packages. */
    readonly sha256: string;
    /** Node runtime version string, such as v24.0.0. */
    readonly node: string;
    /** Packages and bundles in byte order of name, version and content hash. */
    readonly packages: readonly {
        readonly name: string;
        readonly version: string;
        readonly sha256: string;
    }[];
}
/**
 * Hash owning packages and installed runtime dependencies, including dirty source, encoders and native
 * modules. Hosts include their own entry point so bundled code is covered as well. This is conservative:
 * source and built output both contribute; no version string alone is accepted as a content identity.
 */
export declare function fingerprintNodeToolchain(moduleFiles: readonly string[], bundles?: readonly string[]): ToolchainFingerprint;
//# sourceMappingURL=toolchain.d.ts.map