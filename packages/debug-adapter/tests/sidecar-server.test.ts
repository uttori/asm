import { test } from "../../../tests/ava-helper.js";
import {
  DEBUG_SIDECAR_PROTOCOL,
  DEBUG_SIDECAR_PROTOCOL_VERSION,
  DebugSidecarMessageParser,
  DebugSidecarServer,
  ReplayDebugBackend,
  createDebugSidecarSessionToken,
  encodeDebugSidecarMessage,
  type DebugSidecarMessage,
  type DebugSidecarRequest,
} from "../src/index.js";
import { debugConformanceScript } from "./fixtures/debug-conformance-fixture.js";

const request = (
  session: string,
  sequence: number,
  command: DebugSidecarRequest["command"],
  arguments_: Readonly<Record<string, unknown>> = {},
): Uint8Array =>
  encodeDebugSidecarMessage({
    protocol: DEBUG_SIDECAR_PROTOCOL,
    version: DEBUG_SIDECAR_PROTOCOL_VERSION,
    session,
    sequence,
    type: "request",
    command,
    arguments: arguments_,
  });

test("sidecar server orders responses before captured backend events and shuts down once", async (t) => {
  const session = createDebugSidecarSessionToken();
  const frames: Uint8Array[] = [];
  let closes = 0;
  const server = new DebugSidecarServer({
    backend: "test-backend",
    implementation: new ReplayDebugBackend(debugConformanceScript),
    session,
    write: async (frame) => {
      frames.push(new Uint8Array(frame));
    },
    close: async () => {
      closes++;
    },
  });

  await server.receive(
    request(session, 1, "initialize", {
      backend: "test-backend",
      backendProtocolVersion: 1,
    }),
  );
  await server.receive(request(session, 2, "connect", { reset: true }));
  await server.receive(request(session, 3, "shutdown"));

  const parser = new DebugSidecarMessageParser();
  const messages = frames.flatMap((frame) => parser.push(frame));
  t.deepEqual(
    messages.map((message) =>
      message.type === "response"
        ? `${message.type}:${message.requestSequence}`
        : `${message.type}:${message.event}`,
    ),
    ["response:1", "response:2", "event:stopped", "response:3"],
  );
  t.true(server.closed);
  t.is(closes, 1);
});

test("sidecar server returns command failures but closes on a session mismatch", async (t) => {
  const session = createDebugSidecarSessionToken();
  const frames: Uint8Array[] = [];
  let closeError: Error | undefined;
  const server = new DebugSidecarServer({
    backend: "test-backend",
    implementation: new ReplayDebugBackend(debugConformanceScript),
    session,
    write: async (frame) => {
      frames.push(new Uint8Array(frame));
    },
    close: async (error) => {
      closeError = error;
    },
  });

  await server.receive(
    request(session, 1, "initialize", {
      backend: "wrong-backend",
      backendProtocolVersion: 1,
    }),
  );
  await server.receive(request(session, 2, "step", { threadId: 0, kind: "instruction" }));

  const parser = new DebugSidecarMessageParser();
  const messages: DebugSidecarMessage[] = frames.flatMap((frame) => parser.push(frame));
  t.deepEqual(
    messages.map((message) =>
      message.type === "response" ? { success: message.success, error: message.error } : message,
    ),
    [
      { success: false, error: "Unexpected backend identity." },
      {
        success: false,
        error: "Step threadId must be a safe integer greater than or equal to 1.",
      },
    ],
  );
  t.false(server.closed);

  const mismatch = await t.throwsAsync(
    server.receive(request(createDebugSidecarSessionToken(), 3, "ping")),
  );
  t.regex(mismatch?.message ?? "", /session does not match/);
  t.true(server.closed);
  t.regex(closeError?.message ?? "", /session does not match/);
});
