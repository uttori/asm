import { type CaptureRecovery } from "@uttori/asm-debug-adapter";
/**
 * A present companion is part of the import's integrity boundary. Bind its verified artifacts to
 * the primary archive's exact session and terminal count; a different capture of the same ROM
 * is insufficient. Bare captures remain valid when no companion was recorded.
 */
export declare function verifyRuntimeCaptureCompanion(file: string, recovery: CaptureRecovery, signal?: AbortSignal): Promise<void>;
//# sourceMappingURL=capture-companion.d.ts.map