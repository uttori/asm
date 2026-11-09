/** Supported assembly and embedding entry point; specialized host contracts have explicit subpaths. */
export { DEBUG_BACKEND_CONFORMANCE_VERSION, DEBUG_BACKEND_CONFORMANCE_SCENARIOS, runDebugBackendConformance, } from "./conformance.js";
export { DEBUG_BACKEND_PROTOCOL_VERSION, } from "./contracts.js";
export { evaluateDebugExpression, formatDebugExpressionValue, } from "./debug-expression.js";
export { formatDebugAddress, parseDebugAddress, DebugAdapterSession, encodeDapMessage, DapMessageParser, } from "./dap.js";
export { createDebugMapReplayScript } from "./mock-script.js";
export { DEBUG_SIDECAR_SESSION_ENV, NodeStdioSidecarTransport, } from "./node-stdio-transport.js";
export { ReplayDebugBackend, } from "./replay-backend.js";
export { SidecarDebugBackend } from "./sidecar-backend.js";
export { DebugSidecarClient, } from "./sidecar-client.js";
export { DEBUG_SIDECAR_PROTOCOL, DEBUG_SIDECAR_PROTOCOL_VERSION, DEBUG_SIDECAR_COMMANDS, DEBUG_SIDECAR_EVENTS, DEFAULT_DEBUG_SIDECAR_LIMITS, createDebugSidecarSessionToken, assertDebugSidecarSessionToken, assertDebugSidecarMessage, encodeDebugSidecarMessage, DebugSidecarMessageParser, DebugSidecarMessageQueue, } from "./sidecar-protocol.js";
export { DebugSidecarServer } from "./sidecar-server.js";
export { DebugTraceBuffer } from "./trace-buffer.js";
export { LosslessCaptureFileRecorder, NativeCaptureFileRecorder } from "./capture-file.js";
export { CaptureContextRecorder } from "./capture-context.js";
//# sourceMappingURL=index.js.map