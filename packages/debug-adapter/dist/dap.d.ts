import { type DebugMap } from "@uttori/asm-core/debug-map";
import type { DebugAddress, DebugBackend } from "./contracts.js";
/** Minimal DAP request shape accepted by the adapter. */
export interface DapRequest {
    readonly seq: number;
    readonly type: "request";
    readonly command: string;
    readonly arguments?: Record<string, unknown>;
}
/** Minimal DAP response shape emitted by the adapter. */
export interface DapResponse {
    readonly seq: number;
    readonly type: "response";
    readonly request_seq: number;
    readonly success: boolean;
    readonly command: string;
    readonly message?: string;
    readonly body?: unknown;
}
/** Minimal DAP event shape emitted by the adapter. */
export interface DapEvent {
    readonly seq: number;
    readonly type: "event";
    readonly event: string;
    readonly body?: unknown;
}
/** Protocol messages emitted by `DebugAdapterSession`. */
export type DapProtocolMessage = DapResponse | DapEvent;
/** Host-provided launch artifacts. File I/O stays outside the protocol adapter. */
export interface DebugAdapterSessionOptions {
    readonly backend: DebugBackend;
    readonly debugMap?: DebugMap;
    readonly output?: Uint8Array;
    readonly sourceRoot?: string;
    /** Host-confirmed ROM aliases for a source location. Instruction breakpoints stay exact. */
    readonly sourceBreakpointAddresses?: (address: DebugAddress) => readonly DebugAddress[];
    /** Physical output byte for a runtime PC when the backend omits mirror identity. */
    readonly sourceOutputOffset?: (address: DebugAddress) => number | undefined;
    /** Optional display suffix. Async providers can batch a page. Failures leave instruction text intact. */
    readonly instructionAnnotation?: (address: DebugAddress) => string | undefined | Promise<string | undefined>;
    readonly onMessage?: (message: DapProtocolMessage) => void;
    /** Live DAP hosts configure breakpoints after connection and before launch completes. */
    readonly configurationHandshake?: boolean;
}
/**
 * Formats a qualified address for DAP memory/instruction references.
 * @param {DebugAddress} address Qualified logical address.
 * @returns {string} Stable transport string.
 */
export declare const formatDebugAddress: (address: DebugAddress) => string;
export declare const parseDebugAddress: (reference: string) => DebugAddress | undefined;
/**
 * Emulator-neutral DAP session. It translates protocol requests into the
 * `DebugBackend` contract and never exposes backend implementation details.
 */
export declare class DebugAdapterSession {
    #private;
    /**
     * Creates a DAP session around one backend.
     * @param {DebugAdapterSessionOptions} options Backend, map, and host callbacks.
     */
    constructor(options: DebugAdapterSessionOptions);
    /** Releases the backend event subscription. */
    dispose(): void;
    /**
     * Handles one request and returns all deterministically ordered response/events.
     * @param {DapRequest} request Incoming request.
     * @returns {Promise<readonly DapProtocolMessage[]>} Response followed by queued events.
     */
    dispatch(request: DapRequest): Promise<readonly DapProtocolMessage[]>;
}
/**
 * Encodes one DAP message with a UTF-8 byte-counted Content-Length header.
 * @param {DapRequest | DapProtocolMessage} message Protocol message.
 * @returns {Uint8Array} Framed transport bytes.
 */
export declare const encodeDapMessage: (message: DapRequest | DapProtocolMessage) => Uint8Array;
/** Incremental parser for stdio/socket DAP framing. */
export declare class DapMessageParser {
    #private;
    /**
     * Adds a transport chunk and returns every complete request.
     * @param {Uint8Array} chunk Transport bytes.
     * @returns {readonly DapRequest[]} Complete parsed requests.
     */
    push(chunk: Uint8Array): readonly DapRequest[];
}
//# sourceMappingURL=dap.d.ts.map