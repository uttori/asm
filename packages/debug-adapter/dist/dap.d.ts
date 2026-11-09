import { type DebugMap } from "@uttori/asm-core/debug-map";
import type { DebugAddress, DebugBackend } from "./contracts.js";
/** Minimal DAP request shape accepted by the adapter. */
export interface DapRequest {
    /** Client sequence number echoed on responses. */
    readonly seq: number;
    /** Discriminator marking DAP requests. */
    readonly type: "request";
    /** DAP command name. */
    readonly command: string;
    /** Command-specific JSON arguments when present. */
    readonly arguments?: Record<string, unknown>;
}
/** Minimal DAP response shape emitted by the adapter. */
export interface DapResponse {
    /** Adapter sequence number for this response. */
    readonly seq: number;
    /** Discriminator marking DAP responses. */
    readonly type: "response";
    /** Sequence of the request being answered. */
    readonly request_seq: number;
    /** Whether the command succeeded. */
    readonly success: boolean;
    /** Command name copied from the request. */
    readonly command: string;
    /** Error text when success is false. */
    readonly message?: string;
    /** Success payload when provided by the command handler. */
    readonly body?: unknown;
}
/** Minimal DAP event shape emitted by the adapter. */
export interface DapEvent {
    /** Adapter sequence number for this event. */
    readonly seq: number;
    /** Discriminator marking DAP events. */
    readonly type: "event";
    /** DAP event name. */
    readonly event: string;
    /** Event-specific JSON body. */
    readonly body?: unknown;
}
/** Protocol messages emitted by `DebugAdapterSession`. */
export type DapProtocolMessage = DapResponse | DapEvent;
/** Host-provided launch artifacts. File I/O stays outside the protocol adapter. */
export interface DebugAdapterSessionOptions {
    /** Emulator-neutral backend serving register, memory, and execution requests. */
    readonly backend: DebugBackend;
    /** Optional debug map for source and virtual disassembly resolution. */
    readonly debugMap?: DebugMap;
    /** ROM or load image bytes paired with the debug map. */
    readonly output?: Uint8Array;
    /** Root directory for resolving source paths in DAP responses. */
    readonly sourceRoot?: string;
    /** Host-confirmed ROM aliases for a source location. Instruction breakpoints stay exact. */
    readonly sourceBreakpointAddresses?: (address: DebugAddress) => readonly DebugAddress[];
    /** Physical output byte for a runtime PC when the backend omits mirror identity. */
    readonly sourceOutputOffset?: (address: DebugAddress) => number | undefined;
    /** Optional display suffix. Async providers can batch a page. Failures leave instruction text intact. */
    readonly instructionAnnotation?: (address: DebugAddress) => string | undefined | Promise<string | undefined>;
    /** Receives every outbound DAP response or event frame. */
    readonly onMessage?: (message: DapProtocolMessage) => void;
    /** Live DAP hosts configure breakpoints after connection and before launch completes. */
    readonly configurationHandshake?: boolean;
}
/**
 * Formats a qualified address for DAP memory/instruction references.
 * @param address Qualified logical address.
 * @returns Stable transport string.
 */
export declare const formatDebugAddress: (address: DebugAddress) => string;
/**
 * Parses an address produced by formatDebugAddress.
 * @param reference Qualified address string.
 * @returns Parsed address, or undefined for malformed input.
 */
export declare const parseDebugAddress: (reference: string) => DebugAddress | undefined;
/**
 * Emulator-neutral DAP session. It translates protocol requests into the
 * `DebugBackend` contract and never exposes backend implementation details.
 */
export declare class DebugAdapterSession {
    #private;
    /**
     * Creates a DAP session around one backend.
     * @param options Backend, map, and host callbacks.
     */
    constructor(options: DebugAdapterSessionOptions);
    /** Releases the backend event subscription. */
    dispose(): void;
    /**
     * Handles one request and returns all deterministically ordered response/events.
     * @param request Incoming request.
     * @returns Response followed by queued events.
     */
    dispatch(request: DapRequest): Promise<readonly DapProtocolMessage[]>;
}
/**
 * Encodes one DAP message with a UTF-8 byte-counted Content-Length header.
 * @param message Protocol message.
 * @returns Framed transport bytes.
 */
export declare const encodeDapMessage: (message: DapRequest | DapProtocolMessage) => Uint8Array;
/** Incremental parser for stdio/socket DAP framing. */
export declare class DapMessageParser {
    #private;
    /**
     * Adds a transport chunk and returns every complete request.
     * @param chunk Transport bytes.
     * @returns Complete parsed requests.
     */
    push(chunk: Uint8Array): readonly DapRequest[];
}
//# sourceMappingURL=dap.d.ts.map