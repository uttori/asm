import { spawnSync } from "node:child_process";
import fs from "node:fs";

const probe = `
try {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE t(id INTEGER PRIMARY KEY); INSERT INTO t VALUES (1);");
  const row = db.prepare("SELECT id FROM t").get();
  db.exec("CREATE TRIGGER fail BEFORE INSERT ON t BEGIN SELECT RAISE(ROLLBACK, 'probe rollback'); END; BEGIN;");
  let rollbackMessage;
  try { db.exec("INSERT INTO t VALUES (2)"); }
  catch (error) {
    // SQLite may abort its own transaction; the host must expose the state for guarded cleanup.
    if (db.isTransaction) db.exec("ROLLBACK");
    rollbackMessage = error.message;
  }
  const automaticRollback = db.isTransaction === false && rollbackMessage === "probe rollback";
  db.close();
  process.stdout.write(JSON.stringify({
    ok: row.id === 1 && automaticRollback,
    automaticRollback,
    node: process.version,
    electron: process.versions.electron || null,
    execPath: process.execPath,
  }) + "\\n");
} catch (error) {
  process.stdout.write(JSON.stringify({
    ok: false,
    error: String(error),
    node: process.version,
    electron: process.versions.electron || null,
    execPath: process.execPath,
  }) + "\\n");
  process.exitCode = 1;
}
`;

const hosts = [
  "/Applications/Cursor.app/Contents/MacOS/Cursor",
  "/Applications/Cursor.app/Contents/Frameworks/Cursor Helper.app/Contents/MacOS/Cursor Helper",
  "/Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper.app/Contents/MacOS/Code Helper",
];

interface ElectronProbeResult {
  readonly ok?: boolean;
  readonly error?: string;
  readonly execPath?: string;
}

const results: ElectronProbeResult[] = [];
for (const execPath of hosts) {
  if (!fs.existsSync(execPath)) {
    results.push({ execPath, ok: false, error: "missing" });
    continue;
  }
  const child = spawnSync(execPath, ["-e", probe], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    encoding: "utf8",
  });
  const line = child.stdout.trim().split("\n").at(-1) ?? "";
  try {
    const parsed: unknown = JSON.parse(line);
    if (!parsed || typeof parsed !== "object") throw new Error("invalid probe payload");
    const row = parsed as ElectronProbeResult;
    results.push(row);
  } catch {
    results.push({ execPath, ok: false, error: child.stderr || line || `status ${String(child.status)}` });
  }
}

process.stdout.write(`${JSON.stringify({ results }, undefined, 2)}\n`);
if (results.some((result) => result.ok !== true && result.error !== "missing")) process.exitCode = 1;
