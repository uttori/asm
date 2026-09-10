import type { DebugTraceInstructionDetail } from "./contracts.js";
/** Exact counters crossing JavaScript/JSON boundaries. */
export type CaptureU64 = string;
export interface CaptureCapabilitiesV2 {
    readonly version: 2;
    readonly scope: "snes.65816.instructions";
    readonly mode: "lossless";
    readonly ownership: "durable-prefix";
    readonly maxChunkBytes: 262144;
    readonly requiredReserveBytes: 71;
    readonly overheadBytes: 4194304;
    readonly resumeSession: false;
}
export interface CapturePositionV2 {
    readonly session: string;
    readonly state: "armed" | "recording" | "throttled" | "stopping" | "draining" | "complete" | "incomplete";
    readonly producedThrough: CaptureU64;
    readonly deliveredThrough: CaptureU64;
    readonly acceptedThrough: CaptureU64;
    readonly durableThrough: CaptureU64;
    readonly releasedThrough: CaptureU64;
    readonly chunkThrough: CaptureU64;
    readonly producedChunks: CaptureU64;
    readonly bufferedBytes: number;
    readonly allocatedBytes: number;
    readonly throttleCount: CaptureU64;
    readonly clockNumerator: CaptureU64;
    readonly clockDenominator: CaptureU64;
    readonly droppedInScope: "0";
    readonly error: string;
}
export type CaptureRequestV2 = {
    readonly operation: "capabilities";
} | {
    readonly operation: "start";
    readonly bufferBytes: number;
} | {
    readonly operation: "status" | "stop" | "abort" | "release";
    readonly session: string;
} | {
    readonly operation: "read";
    readonly session: string;
    readonly chunk: CaptureU64;
} | {
    readonly operation: "ack";
    readonly session: string;
    readonly chunk: CaptureU64;
    readonly event: CaptureU64;
};
export type CaptureResultV2 = CaptureCapabilitiesV2 | CapturePositionV2 | {
    readonly hex: string;
};
export type CaptureTransportV2 = (request: CaptureRequestV2) => Promise<CaptureResultV2>;
export declare const captureU64: (value: unknown) => bigint;
export declare const captureSession: (value: unknown) => string;
export declare const validateCaptureRequest: (value: CaptureRequestV2) => void;
export declare const validateCaptureCapabilities: (value: unknown) => CaptureCapabilitiesV2;
export declare const validateCapturePosition: (value: unknown, session?: string) => CapturePositionV2;
/**
 * CRC-32C Castagnoli, including the canonical 123456789 test vector.
 * @param {Uint8Array} bytes Bytes to checksum.
 * @param {boolean} zeroChecksum Treat the ACT2 checksum field as zero.
 * @returns {number} Unsigned checksum.
 */
export declare const captureCrc32c: (bytes: Uint8Array, zeroChecksum?: boolean) => number;
export interface CaptureInstructionV2 {
    readonly sequence: CaptureU64;
    readonly ordinal: CaptureU64;
    readonly cycle: CaptureU64;
    readonly address: number;
    readonly detail: DebugTraceInstructionDetail;
}
export interface CaptureChunkV2 {
    readonly session: string;
    readonly sequence: CaptureU64;
    readonly first: CaptureU64;
    readonly through: CaptureU64;
    readonly instructions: readonly CaptureInstructionV2[];
}
/**
 * Validate the entire envelope and every record before accepting any event.
 * @param {Uint8Array} bytes Bounded encoded chunk.
 * @param {string} session Negotiated session identity.
 * @returns {CaptureChunkV2} Fully validated ordered instructions.
 */
export declare const decodeCaptureChunk: (bytes: Uint8Array, session: string) => CaptureChunkV2;
//# sourceMappingURL=capture-v2.d.ts.map