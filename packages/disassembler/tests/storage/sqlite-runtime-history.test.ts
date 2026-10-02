import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import {
  decodeRuntimeHistory,
  encodeRuntimeHistory,
  packRuntimeHistory,
} from "../../src/storage/sqlite-runtime-history.js";
import { SqliteAnalysisStore } from "../../src/storage/sqlite-store.js";
import { DatabaseSync } from "../helpers/sqlite-connection.js";

test("history blocks preserve storage types and reject corrupt, oversized, and invalid references", (t) => {
  const values = [null, "", new Uint8Array(), "雪\u0000", new Uint8Array([0, 255, 1])];
  const encoded = encodeRuntimeHistory(values);
  const decoded = decodeRuntimeHistory(encoded);
  t.deepEqual(
    decoded.map((v) => (v instanceof Uint8Array ? Array.from(v) : v)),
    values.map((v) => (v instanceof Uint8Array ? Array.from(v) : v)),
  );
  const corrupt = Buffer.from(encoded);
  corrupt[12] ^= 1;
  t.throws(() => decodeRuntimeHistory(corrupt), { message: /Corrupt/ });
  corrupt.writeUInt32LE(0xffffffff, 8);
  t.throws(() => decodeRuntimeHistory(corrupt), { message: /bounds/ });
  t.throws(() => encodeRuntimeHistory([]), { message: /count/ });
  t.throws(() => decodeRuntimeHistory(encoded.subarray(0, 16)), { message: /Unsupported/ });
});

test("history packing closes a byte-limited cursor before sealing and resuming its remaining rows", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-history-bytes-"));
  const store = new SqliteAnalysisStore(path.join(directory, "analysis.sqlite"));
  const db = new DatabaseSync(store.file);
  const values = Array.from({ length: 3 }, () => randomBytes(192 * 1024));
  try {
    const insert = db.prepare(
      "INSERT INTO runtime_facts(kind,architecture,payload) VALUES('runtime-execution','cpu',?)",
    );
    db.exec("BEGIN");
    for (const value of values) {
      insert.run(value);
    }
    t.is(packRuntimeHistory(db), values.length);
    db.exec("COMMIT");
    t.is(db.prepare("SELECT COUNT(*) n FROM runtime_history").get()!.n, values.length);
    const payloads = db.prepare("SELECT payload FROM runtime_facts ORDER BY fid").all();
    for (const [index, row] of payloads.entries()) {
      const payload = row.payload;
      if (!(payload instanceof Uint8Array)) {
        throw new Error("Expected history bytes.");
      }
      t.deepEqual(Buffer.from(payload), values[index]);
    }
  } finally {
    db.close();
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

const record = (index: number) => ({
  id: `full:${index}`,
  kind: "runtime-instruction" as const,
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  address: 0xc08000,
  bytes: [0xea],
  state: { a: index, x: 123, y: 0, s: 511, p: 0x31, e: 0, d: 0, db: 126, pb: 192, pc: 32768 },
  count: index + 1,
  evidence: ["capture"],
});

test("full register history shares descriptors, compresses, survives reopen and rolls back reused block IDs", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-history-"));
  const file = path.join(directory, "analysis.sqlite");
  const store = new SqliteAnalysisStore(file);
  const db = new DatabaseSync(file);
  try {
    store.transaction(() => {
      for (let i = 0; i < 1500; i++) {
        store.insertRuntime(record(i));
      }
    });
    t.is(db.prepare("SELECT COUNT(*) n FROM runtime_descriptors").get()!.n, 1);
    t.is(db.prepare("SELECT COUNT(*) n FROM runtime_history").get()!.n, 2);
    t.is(
      db.prepare("SELECT COUNT(*) n FROM runtime_fact_rows WHERE payload IS NOT NULL").get()!.n,
      0,
    );
    t.true(
      Number(db.prepare("SELECT SUM(length(payload)) n FROM runtime_history").get()!.n) < 1500 * 15,
    );
    const reopened = new SqliteAnalysisStore(file, false);
    try {
      t.deepEqual(
        [...reopened.runtimeRecords()],
        Array.from({ length: 1500 }, (_, i) => record(i)),
      );
    } finally {
      reopened.close();
    }
    // Fail after packing, forcing a block ID and its cache contents to roll back together.
    db.exec(
      `CREATE TRIGGER fail_history AFTER UPDATE ON runtime_fact_rows WHEN NEW.history_id IS NOT NULL BEGIN
        SELECT analysis_history_payload(NEW.history_id,NEW.history_slot);
        SELECT RAISE(ROLLBACK,'history failure'); END`,
    );
    t.throws(() => store.transaction(() => store.insertRuntime(record(1500))), {
      message: /history failure/,
    });
    db.exec("DROP TRIGGER fail_history");
    const replacement = { ...record(1500), state: { a: 65535, p: 255 } };
    store.transaction(() => store.insertRuntime(replacement));
    t.deepEqual([...store.runtimeRecords()].at(-1), replacement);
    t.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    t.throws(() => db.exec("UPDATE runtime_history SET payload=X'00' WHERE id=1"), {
      message: /immutable/,
    });
    t.throws(() => db.prepare("SELECT analysis_history_payload(1,999999)").get(), {
      message: /bounds/,
    });
    // Broken descriptor references must surface as corrupt records, never disappear from a stream.
    db.exec("PRAGMA foreign_keys=OFF; DELETE FROM runtime_descriptors");
    t.throws(() => [...store.runtimeRecords()], { message: /Unsupported stored runtime kind/ });
  } finally {
    db.close();
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("identity collection preserves common and exceptional references in either deletion order", (t) => {
  for (const first of [1, 2]) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-history-gc-"));
    const store = new SqliteAnalysisStore(path.join(directory, "analysis.sqlite"));
    const db = new DatabaseSync(store.file);
    try {
      db.exec(`INSERT INTO runtime_prefixes(id,value) VALUES(1,'a'),(2,'b');
        INSERT INTO runtime_evidence(id,value) VALUES(1,'[]');
        INSERT INTO runtime_identities(iid,value) VALUES(1,'shared');
        INSERT INTO runtime_facts(fid,kind,architecture,address_space,address) VALUES(1,'runtime-execution','cpu','bus',1),(2,'runtime-execution','cpu','bus',2);
        INSERT INTO runtime_observations(oid,fact_id,identity_id,prefix_id,evidence_id,count) VALUES(1,1,1,1,1,1),(2,2,1,2,1,1);`);
      db.prepare("DELETE FROM runtime_observations WHERE oid=?").run(first);
      t.is(db.prepare("SELECT COUNT(*) n FROM runtime_identities").get()!.n, 1);
      t.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
      db.exec("DELETE FROM runtime_observations");
      t.is(db.prepare("SELECT COUNT(*) n FROM runtime_identities").get()!.n, 0);
      t.is(db.prepare("SELECT COUNT(*) n FROM runtime_fact_rows").get()!.n, 0);
    } finally {
      db.close();
      store.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("short hash index collisions never merge different fact or identity values", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-history-collision-"));
  const store = new SqliteAnalysisStore(path.join(directory, "analysis.sqlite"));
  const db = new DatabaseSync(store.file);
  try {
    const a = Buffer.alloc(32, 1),
      b = Buffer.from(a);
    b[31] = 2;
    const insert = db.prepare(
      "INSERT INTO runtime_facts(fingerprint,kind,architecture,address_space,address,payload) VALUES(?,'runtime-execution','cpu','bus',1,NULL)",
    );
    insert.run(a);
    insert.run(b);
    t.is(db.prepare("SELECT COUNT(*) n FROM runtime_fact_rows").get()!.n, 2);
    t.throws(() => insert.run(a), { message: /Duplicate runtime fact/ });
    const identity = db.prepare("INSERT INTO runtime_identities(value) VALUES(?)");
    identity.run(a);
    identity.run(b);
    t.is(db.prepare("SELECT COUNT(*) n FROM runtime_identities").get()!.n, 2);
    t.throws(() => identity.run(a), { message: /Duplicate runtime identity/ });
  } finally {
    db.close();
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
