import {
  DEBUG_SIDECAR_SESSION_ENV,
  DebugSidecarServer,
  ReplayDebugBackend,
  assertDebugSidecarSessionToken,
  type DebugBackend,
} from "../../src/index.js";
import { debugConformanceScript } from "./debug-conformance-fixture.js";

const session = process.env[DEBUG_SIDECAR_SESSION_ENV];
assertDebugSidecarSessionToken(session);

const replay = new ReplayDebugBackend(debugConformanceScript);
const crashOn = process.env.UTTORI_ASM_DEBUG_MOCK_CRASH_ON;
const implementation: DebugBackend = crashOn
  ? (new Proxy(replay, {
      get(target, property, receiver) {
        if (property === crashOn) {
          return () => {
            process.stderr.write(`mock sidecar crash on ${String(property)}\n`);
            process.exit(23);
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    }) as DebugBackend)
  : replay;

let ending = false;

const server = new DebugSidecarServer({
  backend: "mock-sidecar",
  implementation,
  session,
  write: (data) =>
    new Promise((resolve, reject) => {
      process.stdout.write(data, (error?: Error | null) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    }),
  close: (error) =>
    new Promise((resolve) => {
      if (ending) {
        return resolve();
      }
      ending = true;
      if (error) {
        process.stderr.write(`${error.stack ?? error.message}\n`);
      }
      process.stdin.pause();
      process.stdout.end(resolve);
    }),
});

let receiveTail = Promise.resolve();
process.stdin.on("data", (data: Buffer) => {
  receiveTail = receiveTail.then(() => server.receive(data));
  void receiveTail.catch(() => undefined);
});
process.stdin.on("end", () => {
  void receiveTail.then(() => server.close()).catch(() => undefined);
});
