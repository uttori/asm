import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { AddressToLineMapping, createDebugMap } from "@uttori/asm-core";
import {
  DebugAdapterSession,
  type DapResponse,
  type DebugAddress,
} from "@uttori/asm-debug-adapter";
import type { ExecutionContext } from "ava";

import { test } from "../../../../tests/ava-helper.js";
import { ControlledExecutionBackend } from "../../../debug-adapter/tests/fixtures/controlled-execution-backend.js";
import { createSnesDebugAddressResolvers } from "../../src/debug/rom-addresses.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDapResponse(value: unknown): value is DapResponse {
  return (
    isRecord(value) &&
    value.type === "response" &&
    typeof value.seq === "number" &&
    typeof value.request_seq === "number" &&
    typeof value.success === "boolean" &&
    typeof value.command === "string"
  );
}

/** Complete static-mapper ROM with a plausible header. No private game assets are needed. */
const setup = (t: ExecutionContext, mapper: "lorom" | "hirom", headerSize = 0) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-debug-alias-"));
  const source = path.join(directory, "main.asm");
  fs.writeFileSync(source, "; entry\nnop\n");
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const size = mapper === "hirom" ? 0x10000 : 0x8000;
  const bytes = new Uint8Array(size + headerSize).fill(0xea);
  const header = headerSize + size - 0x40;
  bytes.fill(0x20, header, header + 0x15);
  bytes[header + 0x15] = mapper === "hirom" ? 0x21 : 0x20;
  bytes[header + 0x16] = 0;
  bytes[header + 0x17] = mapper === "hirom" ? 6 : 5;
  bytes.set([0xcb, 0xed, 0x34, 0x12], header + 0x1c);
  bytes.fill(0, header + 0x20);
  bytes.set([0, 0x80], header + 0x3c);
  const address: DebugAddress = {
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: mapper === "hirom" ? 0xc08000 : 0x808000,
    outputOffset: headerSize + (mapper === "hirom" ? 0x8000 : 0),
  };
  const mapping = new AddressToLineMapping();
  mapping.includeByte(
    source,
    2,
    address.architecture,
    address.addressSpace,
    address.address,
    address.outputOffset!,
  );
  const map = createDebugMap({ target: "snes.sfc", output: bytes, mapping, sourceRoot: directory });
  return { directory, source, bytes, address, map, ...createSnesDebugAddressResolvers(map, bytes) };
};

for (const mapper of ["lorom", "hirom"] as const) {
  for (const headerSize of [0, 512]) {
    test(`${mapper} debugger resolves ROM aliases with ${headerSize}-byte copier header`, (t) => {
      const fixture = setup(t, mapper, headerSize);
      t.truthy(fixture.sourceBreakpointAddresses);
      const aliases = fixture.sourceBreakpointAddresses!(fixture.address).map(
        ({ address }) => address,
      );
      const expected =
        mapper === "hirom" ? [0x008000, 0x408000, 0x808000, 0xc08000] : [0x008000, 0x808000];
      t.deepEqual(aliases, expected);
      for (const address of aliases) {
        t.is(
          fixture.sourceOutputOffset!({ ...fixture.address, address, outputOffset: undefined }),
          fixture.address.outputOffset,
        );
      }
      for (const address of [0x7e8000, 0x002100, 0x701000]) {
        const ram = { ...fixture.address, address };
        t.deepEqual(fixture.sourceBreakpointAddresses!(ram), [ram]);
      }
      const spc = { ...fixture.address, architecture: "snes.spc700", addressSpace: "spc.aram" };
      t.deepEqual(fixture.sourceBreakpointAddresses!(spc), [spc]);
      t.is(fixture.sourceOutputOffset!(spc), undefined);
      const relocated = { ...fixture.address, outputOffset: fixture.address.outputOffset! + 1 };
      t.deepEqual(fixture.sourceBreakpointAddresses!(relocated), [relocated]);
    });
  }
}

test("incomplete or ambiguous cartridges never guess a breakpoint mapper", (t) => {
  const fixture = setup(t, "hirom");
  t.deepEqual(createSnesDebugAddressResolvers(fixture.map, new Uint8Array(4)), {});
  t.deepEqual(createSnesDebugAddressResolvers(fixture.map, new Uint8Array(0x10000)), {});
  t.deepEqual(
    createSnesDebugAddressResolvers({ ...fixture.map, target: "another-target" }, fixture.bytes),
    {},
  );
});

test("source aliases share a native table with exact instruction breakpoints and resolve stopped PCs", async (t) => {
  const fixture = setup(t, "hirom");
  const backend = new ControlledExecutionBackend();
  backend.stackFrames = async () => [
    {
      id: 1,
      threadId: 1,
      name: "CPU",
      pc: {
        architecture: "snes.65816",
        addressSpace: "snes.cpu",
        address: 0x008000,
      },
    },
  ];
  const session = new DebugAdapterSession({
    backend,
    debugMap: fixture.map,
    output: fixture.bytes,
    sourceRoot: fixture.directory,
    sourceBreakpointAddresses: fixture.sourceBreakpointAddresses,
    sourceOutputOffset: fixture.sourceOutputOffset,
  });
  t.teardown(() => session.dispose());
  let seq = 0;
  const request = async (command: string, args = {}) => {
    const [message] = await session.dispatch({
      seq: ++seq,
      type: "request",
      command,
      arguments: args,
    });
    if (!isDapResponse(message)) {
      throw new Error("expected a DAP response");
    }
    return message;
  };
  await request("launch");
  const sourceArgs = { source: { path: fixture.source }, breakpoints: [{ line: 1 }] };
  const source = await request("setBreakpoints", sourceArgs);
  t.true(source.success);
  t.like(source.body, { breakpoints: [{ verified: true, line: 2 }] });
  await request("setInstructionBreakpoints", {
    breakpoints: [{ instructionReference: "snes.65816|snes.cpu|0xc08000" }],
  });
  t.deepEqual(backend.tables.at(-1), [0x008000, 0x408000, 0x808000, 0xc08000]);
  const stack = await request("stackTrace", { threadId: 1 });
  t.like(stack.body, {
    stackFrames: [
      {
        line: 2,
        source: { path: fixture.source },
        instructionPointerReference: "snes.65816|snes.cpu|0x8000",
      },
    ],
  });
  await request("setBreakpoints", { ...sourceArgs, breakpoints: [] });
  t.deepEqual(backend.tables.at(-1), [0xc08000]);
  // A failed alias must leave the single gutter marker unverified.
  const set = backend.setBreakpoints.bind(backend);
  backend.setBreakpoints = async (addresses) =>
    (await set(addresses)).map((entry) =>
      Object.assign({}, entry, {
        verified: entry.address.address !== 0x008000,
      }),
    );
  const partial = await request("setBreakpoints", sourceArgs);
  t.like(partial.body, { breakpoints: [{ verified: false, line: 2 }] });
});

test("NES source breakpoints preserve physical identity across all MMC3 execution windows", (t) => {
  const bytes = new Uint8Array(16 + 512 + 32768);
  bytes.set([0x4e, 0x45, 0x53, 0x1a, 2, 0, 0x44]);
  const map = createDebugMap({
    target: "65xx.nes",
    output: bytes,
    mapping: new AddressToLineMapping(),
    sourceRoot: "/tmp",
  });
  const resolver = createSnesDebugAddressResolvers(map, bytes);
  const address: DebugAddress = {
    architecture: "65xx.2a03",
    addressSpace: "nes.cpu",
    address: 0x8012,
    outputOffset: 528 + 8192 + 0x12,
  };
  const aliases = resolver.sourceBreakpointAddresses!(address);
  t.deepEqual(
    aliases.map((entry) => entry.address),
    [0x8012, 0xa012, 0xc012, 0xe012],
  );
  t.true(aliases.every((entry) => entry.outputOffset === address.outputOffset));
  t.is(resolver.sourceOutputOffset!({ ...address, address: 0xa012 }), address.outputOffset);
  t.is(resolver.sourceOutputOffset!({ ...address, outputOffset: undefined }), undefined);
  t.deepEqual(resolver.sourceBreakpointAddresses!({ ...address, outputOffset: 16 }), []);
});
