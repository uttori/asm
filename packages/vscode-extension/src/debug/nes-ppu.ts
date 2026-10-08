import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";

import { formatDebugAddress, type CaptureFileMetadata } from "@uttori/asm-debug-adapter";
import {
  decodeNesPPUSnapshot,
  nesPPUHtml,
  NES_PPU_SNAPSHOT_BYTES,
} from "@uttori/asm-plugin-65xx/disassembler";
import { window, ViewColumn, type DebugSession } from "vscode";

/** Read only while halted, save a hash-bound private bundle, and show its offline graphics view.
 * The adapter rejects running reads; all protocol slices describe the same paused machine state.
 */
export async function saveNesPPUSnapshot(
  session: DebugSession,
  metadata: CaptureFileMetadata,
  root: string,
) {
  if (metadata.architecture !== "65xx.2a03" || !metadata.romFileSha256)
    throw new Error("NES PPU snapshot requires a complete cartridge identity.");
  const response = await session.customRequest("readMemory", {
    memoryReference: formatDebugAddress({
      architecture: "65xx.2a03",
      addressSpace: "nes.ppu-snapshot",
      address: 0,
    }),
    count: NES_PPU_SNAPSHOT_BYTES,
  });
  if (typeof response.data !== "string" || response.unreadableBytes)
    throw new Error("Incomplete NES PPU snapshot.");
  const bytes = Buffer.from(response.data, "base64");
  const snapshot = decodeNesPPUSnapshot(bytes);
  const identity = {
    ...metadata,
    snapshotSha256: createHash("sha256").update(bytes).digest("hex"),
  };
  const directory = path.join(root, ".uttori-local", "graphics", "snapshots");
  await mkdir(directory, { recursive: true });
  const staging = await mkdtemp(path.join(directory, ".pending-"));
  const destination = path.join(
    directory,
    path.basename(staging).replace(".pending-", `ppu-${Date.now()}-`),
  );
  const html = nesPPUHtml(snapshot, identity);
  try {
    await writeFile(path.join(staging, "ppu.bin"), bytes, { flag: "wx" });
    await writeFile(path.join(staging, "identity.json"), JSON.stringify(identity, null, 2) + "\n", {
      flag: "wx",
    });
    await writeFile(path.join(staging, "index.html"), html, { flag: "wx" });
    await rename(staging, destination);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  const panel = window.createWebviewPanel("uttori.nes.ppu", "NES PPU evidence", ViewColumn.Beside, {
    enableScripts: true,
    localResourceRoots: [],
  });
  panel.webview.html = html;
  return {
    directory: destination,
    cycle: snapshot.cycle,
    pc: snapshot.pc,
    snapshotSha256: identity.snapshotSha256,
  };
}
