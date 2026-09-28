import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import vm from "node:vm";

import * as debugAdapter from "@uttori/asm-debug-adapter";
import {
  DEBUG_SIDECAR_SESSION_ENV,
  DEBUG_SIDECAR_PROTOCOL,
  DEBUG_SIDECAR_PROTOCOL_VERSION,
  DebugSidecarMessageParser,
  encodeDebugSidecarMessage,
  type DebugSidecarRequest,
} from "@uttori/asm-debug-adapter";
import { transformSync } from "esbuild";
import sinon from "sinon";

import { test } from "../ava-helper.js";

/** Inputs for the same lifecycle contract, applied to each production sidecar. */
interface SidecarLifecycleOptions {
  runExport: string;
  /** Actual ESM dependencies returned to the transformed entry point. */
  imports: Record<string, unknown>;
  /** Real process host prototype. Spawning is replaced by an explicit failure in these tests. */
  host: {
    createClient(options: { readonly reset?: boolean }): Promise<unknown>;
    terminate(): Promise<void>;
  };
  manifest: unknown;
  executableOption: string;
  /** Repository-relative TypeScript entry point used for CLI smoke assertions. */
  entryPoint: string;
}

const session = "fixture-session-".repeat(4);

/**
 * Exercise stdio ordering and shutdown without starting a native emulator.
 * @param {SidecarLifecycleOptions} options Production entry points and a valid runtime identity.
 */
export function testSidecarLifecycle(options: SidecarLifecycleOptions): void {
  const entryPoint = path.resolve(options.entryPoint);
  // Isolate the process object: AVA worker stdio contains private Node callbacks and cannot be replaced.
  // Omit the top-level-await CLI guard for CJS evaluation; child-process tests exercise that guard unchanged.
  const source = readFileSync(entryPoint, "utf8");
  const cliStart = source.indexOf("if (import.meta.main)");
  if (cliStart < 0) {
    throw new Error(`Missing CLI entry-point guard in ${entryPoint}`);
  }
  const { code } = transformSync(source.slice(0, cliStart), {
    loader: "ts",
    format: "cjs",
    sourcefile: entryPoint,
    sourcemap: "inline",
  });
  const nativeRequire = createRequire(entryPoint);
  /** Own the temporary streams, manifest, process hooks, and stubs for a single serial case. */
  const setup = (t: { teardown(callback: () => void): void }) => {
    const sandbox = sinon.createSandbox();
    const directory = mkdtempSync(path.join(os.tmpdir(), "sidecar-lifecycle-"));
    const manifest = path.join(directory, "manifest.json");
    const input = new PassThrough();
    const pause = sandbox.spy(input, "pause");
    const output = new PassThrough();
    const errors = new PassThrough();
    t.teardown(() => {
      sandbox.restore();
      input.destroy();
      output.destroy();
      errors.destroy();
      rmSync(directory, { recursive: true, force: true });
    });
    writeFileSync(manifest, JSON.stringify(options.manifest));
    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];
    output.on("data", (data: Buffer) => chunks.push(data));
    errors.on("data", (data: Buffer) => errorChunks.push(data));
    const terminate = sandbox.stub(options.host, "terminate").resolves();
    const createClient = sandbox
      .stub(options.host, "createClient")
      .rejects(new Error("fixture launch failed"));
    // Capture only the sidecar's signal handlers, without sending signals to the AVA worker.
    const signals = new Map<string, () => void>();
    const module = {
      exports: {} as Record<
        string,
        (args: readonly string[], environment?: NodeJS.ProcessEnv) => Promise<void>
      >,
    };
    vm.runInNewContext(
      code,
      {
        module,
        exports: module.exports,
        require: (name: string) => {
          if (name === "@uttori/asm-debug-adapter") {
            return debugAdapter;
          }
          if (name in options.imports) {
            return options.imports[name];
          }
          return nativeRequire(name);
        },
        process: {
          stdin: input,
          stdout: output,
          stderr: errors,
          env: { [DEBUG_SIDECAR_SESSION_ENV]: session },
          once: (signal: string, listener: () => void) => signals.set(signal, listener),
        },
      },
      // Keep VM coverage separate from the real entry point loaded by tsx.
      { filename: `${entryPoint}.unit.cjs` },
    );
    const run = module.exports[options.runExport];
    const args = [
      "--manifest",
      manifest,
      options.executableOption,
      path.join(directory, "unused-emulator"),
      "--rom",
      "unused-rom",
      "--runtime-dir",
      directory,
    ];
    const frame = (command: DebugSidecarRequest["command"], sequence: number, token = session) =>
      encodeDebugSidecarMessage({
        protocol: DEBUG_SIDECAR_PROTOCOL,
        version: DEBUG_SIDECAR_PROTOCOL_VERSION,
        type: "request",
        session: token,
        sequence,
        command,
      });
    const messages = () => new DebugSidecarMessageParser().push(Buffer.concat(chunks));
    return {
      run,
      sandbox,
      args,
      manifest,
      input,
      pause,
      output,
      errors,
      errorChunks,
      signals,
      terminate,
      createClient,
      frame,
      messages,
    };
  };

  test.serial(
    "sidecar validates authentication and manifest before installing stdio handlers",
    async (t) => {
      const fixture = setup(t);
      await t.throwsAsync(fixture.run(fixture.args, {}), { message: /session token/ });
      t.is(fixture.input.listenerCount("data"), 0);
      writeFileSync(fixture.manifest, "{broken");
      await t.throwsAsync(fixture.run(fixture.args, { [DEBUG_SIDECAR_SESSION_ENV]: session }), {
        name: "SyntaxError",
      });
      writeFileSync(fixture.manifest, "null");
      await t.throwsAsync(fixture.run(fixture.args, { [DEBUG_SIDECAR_SESSION_ENV]: session }), {
        message: /must be an object/,
      });
      t.is(fixture.input.listenerCount("data"), 0);
      t.false(fixture.createClient.called);
    },
  );

  test.serial(
    "sidecar drains ordered requests before EOF and forwards backend launch failures",
    async (t) => {
      const fixture = setup(t);
      await fixture.run(fixture.args, { [DEBUG_SIDECAR_SESSION_ENV]: session });
      const finished = once(fixture.output, "finish");
      fixture.input.write(fixture.frame("ping", 1));
      fixture.input.write(fixture.frame("connect", 2));
      fixture.input.end(fixture.frame("ping", 3));
      await finished;
      const messages = fixture.messages();
      const responses = messages.filter((message) => message.type === "response");
      t.deepEqual(
        responses.map((response) => response.requestSequence),
        [1, 2, 3],
      );
      t.deepEqual(
        responses.map((response) => response.success),
        [true, false, true],
      );
      t.regex(responses[1].error ?? "", /fixture launch failed/);
      t.deepEqual(responses[0].result, { pong: true });
      t.true(fixture.createClient.calledOnceWithExactly({ reset: true }));
      t.true(fixture.terminate.calledOnce);
      t.true(fixture.pause.calledOnce);
    },
  );

  test.serial(
    "selected build identity reaches the runtime host without changing installed runtime pins",
    async (t) => {
      const fixture = setup(t);
      const original = readFileSync(fixture.manifest, "utf8");
      const expected = "1".repeat(64);
      await fixture.run([...fixture.args, "--rom-sha256", expected], {
        [DEBUG_SIDECAR_SESSION_ENV]: session,
      });
      const finished = once(fixture.output, "finish");
      fixture.input.end(fixture.frame("connect", 1));
      await finished;
      const host = fixture.createClient.thisValues[0] as { manifest: Record<string, unknown> };
      t.is(host.manifest.romSha256, expected);
      const installed = JSON.parse(original) as Record<string, unknown>;
      t.is(host.manifest.executableSha256, installed.executableSha256);
      t.deepEqual(host.manifest.resources, installed.resources);
      t.is(readFileSync(fixture.manifest, "utf8"), original);
    },
  );

  for (const signal of ["SIGINT", "SIGTERM"]) {
    test.serial(
      `sidecar ${signal} shutdown tolerates host cleanup failure and runs once`,
      async (t) => {
        const fixture = setup(t);
        fixture.terminate.rejects(new Error("cleanup failed"));
        await fixture.run(fixture.args, { [DEBUG_SIDECAR_SESSION_ENV]: session });
        const finished = once(fixture.output, "finish");
        const handler = fixture.signals.get(signal)!;
        handler();
        handler();
        await finished;
        t.true(fixture.terminate.calledOnce);
        t.false(fixture.createClient.called);
        t.true(fixture.pause.calledOnce);
      },
    );
  }

  test.serial("sidecar protocol failures report diagnostics and release the host", async (t) => {
    const fixture = setup(t);
    await fixture.run(fixture.args, { [DEBUG_SIDECAR_SESSION_ENV]: session });
    const finished = once(fixture.output, "finish");
    fixture.input.write(fixture.frame("ping", 1, "wrong-session-".repeat(4)));
    await finished;
    t.regex(Buffer.concat(fixture.errorChunks).toString(), /session does not match/);
    t.deepEqual(fixture.messages(), []);
    t.true(fixture.terminate.calledOnce);
  });

  test.serial("sidecar output failure still closes when stderr also fails", async (t) => {
    const fixture = setup(t);
    // Fail write callbacks instead of emitting stream errors, which have a different lifecycle.
    fixture.sandbox.stub(fixture.output, "write").yields(new Error("output failed")).returns(false);
    fixture.sandbox.stub(fixture.errors, "write").yields(new Error("stderr failed")).returns(false);
    await fixture.run(fixture.args, { [DEBUG_SIDECAR_SESSION_ENV]: session });
    const finished = once(fixture.output, "finish");
    fixture.input.write(fixture.frame("ping", 1));
    await finished;
    t.true(fixture.terminate.calledOnce);
  });

  test.serial(
    "sidecar CLI prints help and exits nonzero on invalid launch arguments",
    async (t) => {
      for (const args of [["--help"], ["--unknown"]]) {
        const child = spawn(
          process.execPath,
          ["--conditions=uttori-source", "--import=tsx", options.entryPoint, ...args],
          {
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        t.teardown(() => {
          if (child.exitCode === null) {
            child.kill();
          }
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        child.stdout.on("data", (data: Buffer) => stdout.push(data));
        child.stderr.on("data", (data: Buffer) => stderr.push(data));
        const [code] = await once(child, "close");
        if (args[0] === "--help") {
          t.is(code, 0);
          t.regex(Buffer.concat(stdout).toString(), /Usage:/);
          t.is(stderr.length, 0);
        } else {
          t.is(code, 1);
          t.regex(Buffer.concat(stderr).toString(), /Unknown .* sidecar option/);
          t.is(stdout.length, 0);
        }
      }
    },
  );

  test.serial(
    "sidecar CLI serves authenticated stdio requests and shuts down without an emulator",
    async (t) => {
      const fixture = setup(t);
      const child = spawn(
        process.execPath,
        ["--conditions=uttori-source", "--import=tsx", options.entryPoint, ...fixture.args],
        {
          env: { ...process.env, [DEBUG_SIDECAR_SESSION_ENV]: session },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      t.teardown(() => {
        if (child.exitCode === null) {
          child.kill();
        }
      });
      const output: Buffer[] = [];
      const errors: Buffer[] = [];
      child.stdout.on("data", (data: Buffer) => output.push(data));
      child.stderr.on("data", (data: Buffer) => errors.push(data));
      const closed = once(child, "close");
      child.stdin.write(fixture.frame("ping", 1));
      // Reconnecting without a preserved process exercises launch dispatch without spawning an emulator.
      child.stdin.write(
        encodeDebugSidecarMessage({
          protocol: DEBUG_SIDECAR_PROTOCOL,
          version: DEBUG_SIDECAR_PROTOCOL_VERSION,
          type: "request",
          session,
          sequence: 2,
          command: "connect",
          arguments: { reset: false },
        }),
      );
      child.stdin.write(fixture.frame("disconnect", 3));
      child.stdin.end(fixture.frame("shutdown", 4));
      const [code] = await closed;
      t.is(code, 0);
      t.is(Buffer.concat(errors).toString(), "");
      const responses = new DebugSidecarMessageParser()
        .push(Buffer.concat(output))
        .filter((message) => message.type === "response");
      t.deepEqual(
        responses.map((response) => response.requestSequence),
        [1, 2, 3, 4],
      );
      t.deepEqual(
        responses.map((response) => response.success),
        [true, false, false, true],
      );
      t.regex(responses[1].error ?? "", /no preserved process/);
      t.regex(responses[2].error ?? "", /not connected/);
    },
  );
}
