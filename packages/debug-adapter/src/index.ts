/** Supported assembly and embedding entry point; specialized host contracts have explicit subpaths. */

export {
  DEBUG_BACKEND_CONFORMANCE_VERSION,
  DEBUG_BACKEND_CONFORMANCE_SCENARIOS,
  type DebugBackendConformanceArchitecture,
  type DebugBackendConformanceFixture,
  type DebugBackendConformanceOptions,
  type DebugBackendConformanceScenarioResult,
  type DebugBackendConformanceReport,
  runDebugBackendConformance,
} from "./conformance.js";
export {
  DEBUG_BACKEND_PROTOCOL_VERSION,
  type DebugAddress,
  type DebugExecutionCapabilities,
  type DebugMemorySpaceCapabilities,
  type DebugTraceCapabilities,
  type DebugArchitectureCapabilities,
  type DebugBackendCapabilities,
  type DebugThread,
  type DebugStackFrame,
  type DebugRegister,
  type DebugMemoryRead,
  type DebugBreakpoint,
  type DebugInstruction,
  type DebugTraceStartOptions,
  type DebugTraceInstructionDetail,
  type DebugTraceBatch,
  type DebugStopReason,
  type DebugBackendEvent,
  type DebugBackendConnectOptions,
  type DebugStepKind,
  type DebugSubscription,
  type DebugBackend,
} from "./contracts.js";
export {
  type DebugExpressionResult,
  evaluateDebugExpression,
  formatDebugExpressionValue,
} from "./debug-expression.js";
export {
  type DapRequest,
  type DapResponse,
  type DapEvent,
  type DapProtocolMessage,
  type DebugAdapterSessionOptions,
  formatDebugAddress,
  parseDebugAddress,
  DebugAdapterSession,
  encodeDapMessage,
  DapMessageParser,
} from "./dap.js";
export { createDebugMapReplayScript } from "./mock-script.js";
export {
  DEBUG_SIDECAR_SESSION_ENV,
  type NodeStdioSidecarTransportOptions,
  NodeStdioSidecarTransport,
} from "./node-stdio-transport.js";
export {
  type ReplayMemoryRegion,
  type ReplaySnapshot,
  type ReplayScript,
  ReplayDebugBackend,
} from "./replay-backend.js";
export { type SidecarDebugBackendOptions, SidecarDebugBackend } from "./sidecar-backend.js";
export {
  type DebugSidecarTransport,
  type DebugSidecarClientOptions,
  DebugSidecarClient,
} from "./sidecar-client.js";
export {
  DEBUG_SIDECAR_PROTOCOL,
  DEBUG_SIDECAR_PROTOCOL_VERSION,
  DEBUG_SIDECAR_COMMANDS,
  DEBUG_SIDECAR_EVENTS,
  type DebugSidecarProtocolLimits,
  DEFAULT_DEBUG_SIDECAR_LIMITS,
  type DebugSidecarEnvelope,
  type DebugSidecarRequest,
  type DebugSidecarResponse,
  type DebugSidecarEvent,
  type DebugSidecarMessage,
  createDebugSidecarSessionToken,
  assertDebugSidecarSessionToken,
  assertDebugSidecarMessage,
  encodeDebugSidecarMessage,
  DebugSidecarMessageParser,
  DebugSidecarMessageQueue,
} from "./sidecar-protocol.js";
export { type DebugSidecarServerOptions, DebugSidecarServer } from "./sidecar-server.js";
export { type DebugTraceBufferOptions, DebugTraceBuffer } from "./trace-buffer.js";
export { LosslessCaptureFileRecorder, NativeCaptureFileRecorder } from "./capture-file.js";
export { type CaptureContextOptions, CaptureContextRecorder } from "./capture-context.js";
