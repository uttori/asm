import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import { sqliteRuntimeIdentity, encodeSqlitePayload, decodeSqlitePayload, } from "./sqlite-payload.js";
import { runtimeColumns } from "./sqlite-records.js";
/** Shared facts own coordinates/payload; observations own source identity and exact counts.
 * A trace instruction owns its paired CPU-state observation, exposed with a negative virtual rowid.
 * Standalone state records remain independent. JSONB avoids reparsing stored payloads in SQL views.
 */
export const RUNTIME_STORAGE_SCHEMA = `
CREATE TABLE runtime_facts (
  fid INTEGER PRIMARY KEY, fingerprint BLOB UNIQUE,
  kind TEXT NOT NULL, architecture TEXT NOT NULL,
  address_space TEXT, address INTEGER, start INTEGER, "end" INTEGER,
  from_address_space TEXT, from_address INTEGER, to_address_space TEXT, to_address INTEGER,
  instruction_address_space TEXT, instruction_address INTEGER,
  accessed_address_space TEXT, accessed_address INTEGER, coverage TEXT, payload BLOB
);
CREATE TABLE runtime_observations (
  oid INTEGER PRIMARY KEY, fact_id INTEGER NOT NULL REFERENCES runtime_facts(fid),
  prefix_id INTEGER NOT NULL REFERENCES runtime_prefixes(id), id BLOB NOT NULL,
  evidence_id INTEGER NOT NULL REFERENCES runtime_evidence(id), count INTEGER NOT NULL,
  state_prefix_id INTEGER REFERENCES runtime_prefixes(id), state_id BLOB,
  query_file_offset INTEGER, query_size INTEGER, query_data BLOB, query_ready INTEGER NOT NULL DEFAULT 0,
  UNIQUE(prefix_id,id), UNIQUE(state_prefix_id,state_id),
  CHECK ((state_prefix_id IS NULL) = (state_id IS NULL))
);
CREATE INDEX runtime_observation_fact ON runtime_observations(fact_id);
CREATE VIEW runtime AS
 SELECT o.oid AS rowid,o.prefix_id,o.id,f.kind,f.architecture,o.count,
 f.address_space,f.address,f.start,f."end",f.from_address_space,f.from_address,
 f.to_address_space,f.to_address,f.instruction_address_space,f.instruction_address,
 f.accessed_address_space,f.accessed_address,f.coverage,o.evidence_id,
 CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload,
 o.query_file_offset,o.query_size,o.query_data,o.query_ready
 FROM runtime_observations o JOIN runtime_facts f ON f.fid=o.fact_id
 UNION ALL
 SELECT -o.oid,o.state_prefix_id,o.state_id,'runtime-cpu-state',f.architecture,o.count,
 f.address_space,f.address,f.start,f."end",f.from_address_space,f.from_address,
 f.to_address_space,f.to_address,f.instruction_address_space,f.instruction_address,
 f.accessed_address_space,f.accessed_address,f.coverage,o.evidence_id,
 CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END,NULL,NULL,NULL,1
 FROM runtime_observations o JOIN runtime_facts f ON f.fid=o.fact_id WHERE o.state_id IS NOT NULL;
CREATE TRIGGER runtime_collect_fact AFTER DELETE ON runtime_observations BEGIN
 DELETE FROM runtime_facts WHERE fid=OLD.fact_id AND NOT EXISTS(SELECT 1 FROM runtime_observations WHERE fact_id=OLD.fact_id);
END;
CREATE TRIGGER runtime_query_update INSTEAD OF UPDATE OF query_file_offset,query_size,query_data,query_ready ON runtime BEGIN
 UPDATE runtime_observations SET query_file_offset=NEW.query_file_offset,query_size=NEW.query_size,
 query_data=NEW.query_data,query_ready=NEW.query_ready WHERE oid=OLD.rowid;
END;
-- Compatibility mutations detach one logical record. They must never change another capture's shared fact.
CREATE TRIGGER runtime_insert INSTEAD OF INSERT ON runtime BEGIN
 INSERT INTO runtime_facts(kind,architecture,address_space,address,start,"end",from_address_space,from_address,
 to_address_space,to_address,instruction_address_space,instruction_address,accessed_address_space,accessed_address,coverage,payload)
 VALUES(NEW.kind,NEW.architecture,NEW.address_space,NEW.address,NEW.start,NEW."end",NEW.from_address_space,NEW.from_address,
 NEW.to_address_space,NEW.to_address,NEW.instruction_address_space,NEW.instruction_address,NEW.accessed_address_space,NEW.accessed_address,NEW.coverage,
 CASE WHEN json_valid(NEW.payload) THEN jsonb(NEW.payload) ELSE NEW.payload END);
 INSERT INTO runtime_observations(fact_id,prefix_id,id,evidence_id,count,query_file_offset,query_size,query_data,query_ready)
 VALUES(last_insert_rowid(),NEW.prefix_id,NEW.id,NEW.evidence_id,NEW.count,NEW.query_file_offset,NEW.query_size,NEW.query_data,
 CASE WHEN NEW.kind='runtime-execution' THEN 0 ELSE 1 END);
END;
CREATE TRIGGER runtime_delete INSTEAD OF DELETE ON runtime BEGIN
 -- Deleting just the instruction preserves its independent logical state record.
 INSERT INTO runtime_facts(kind,architecture,address_space,address,payload)
 SELECT 'runtime-cpu-state',f.architecture,f.address_space,f.address,f.payload
 FROM runtime_observations o JOIN runtime_facts f ON f.fid=o.fact_id WHERE o.oid=OLD.rowid AND o.state_id IS NOT NULL;
 INSERT INTO runtime_observations(fact_id,prefix_id,id,evidence_id,count,query_ready)
 SELECT last_insert_rowid(),state_prefix_id,state_id,evidence_id,count,1 FROM runtime_observations WHERE oid=OLD.rowid AND state_id IS NOT NULL;
 UPDATE runtime_observations SET state_prefix_id=NULL,state_id=NULL WHERE oid=-OLD.rowid;
 -- A preceding instruction deletion may have detached this virtual state; stable identity still finds it.
 DELETE FROM runtime_observations WHERE prefix_id=OLD.prefix_id AND id=OLD.id;
END;
CREATE TRIGGER runtime_record_update INSTEAD OF UPDATE OF prefix_id,id,kind,architecture,count,address_space,address,start,"end",
 from_address_space,from_address,to_address_space,to_address,instruction_address_space,instruction_address,
 accessed_address_space,accessed_address,coverage,evidence_id,payload ON runtime BEGIN
 DELETE FROM runtime WHERE prefix_id=OLD.prefix_id AND id=OLD.id;
 INSERT INTO runtime(prefix_id,id,kind,architecture,count,address_space,address,start,"end",from_address_space,from_address,
 to_address_space,to_address,instruction_address_space,instruction_address,accessed_address_space,accessed_address,coverage,evidence_id,payload)
 VALUES(NEW.prefix_id,NEW.id,NEW.kind,NEW.architecture,NEW.count,NEW.address_space,NEW.address,NEW.start,NEW."end",NEW.from_address_space,NEW.from_address,
 NEW.to_address_space,NEW.to_address,NEW.instruction_address_space,NEW.instruction_address,NEW.accessed_address_space,NEW.accessed_address,NEW.coverage,NEW.evidence_id,NEW.payload);
END;
`;
/** Bounded prepared writer. Dictionary IDs are transaction-owned by the calling store. */
export class SqliteRuntimeWriter {
    #findFact;
    #insertFact;
    #insertObservation;
    #pair;
    #findPair;
    #removeObservation;
    constructor(db) {
        this.#findFact = db.prepare("SELECT fid FROM runtime_facts WHERE fingerprint=?");
        this.#insertFact =
            db.prepare(`INSERT INTO runtime_facts(fingerprint,kind,architecture,address_space,address,start,"end",
      from_address_space,from_address,to_address_space,to_address,instruction_address_space,instruction_address,
      accessed_address_space,accessed_address,coverage,payload) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CASE WHEN typeof(?)='text' THEN jsonb(?) ELSE ? END)`);
        this.#insertObservation = db.prepare("INSERT INTO runtime_observations(fact_id,prefix_id,id,evidence_id,count,state_prefix_id,state_id,query_ready) VALUES(?,?,?,?,?,?,?,?)");
        this.#pair = db.prepare("UPDATE runtime_observations SET state_prefix_id=?,state_id=? WHERE oid=?");
        this.#findPair =
            db.prepare(`SELECT o.*,f.kind,f.architecture,f.address_space,f.address,CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload
      FROM runtime_observations o JOIN runtime_facts f ON f.fid=o.fact_id
      WHERE o.prefix_id=(SELECT id FROM runtime_prefixes WHERE value=?) AND o.id=?`);
        this.#removeObservation = db.prepare("DELETE FROM runtime_observations WHERE oid=?");
    }
    /** Append one validated logical record. Only exact trace pairs share a count/provenance link.
     * @param {RuntimeEvidenceRecord} record Validated source fact with a stable external ID.
     * @param {Function} intern Transaction-owned prefix/evidence dictionary allocator.
     */
    insert(record, intern) {
        const identity = sqliteRuntimeIdentity(record.id);
        const prefix = intern("runtime_prefixes", identity.prefix);
        const evidence = intern("runtime_evidence", JSON.stringify(record.evidence));
        const columns = runtimeColumns(record);
        let statePrefix = null;
        let stateId = null;
        const match = /^runtime:instruction-trace:([\da-f]{64}):(code|state):([\da-f]{64})$/.exec(record.id);
        if (match && (record.kind === "runtime-instruction" || record.kind === "runtime-cpu-state")) {
            const counterpart = match[2] === "code" ? "state" : "code";
            const otherIdentity = sqliteRuntimeIdentity(`runtime:instruction-trace:${match[1]}:${counterpart}:${match[3]}`);
            const other = this.#findPair.get(otherIdentity.prefix, otherIdentity.suffix);
            const expectedKind = record.kind === "runtime-instruction" ? "runtime-cpu-state" : "runtime-instruction";
            // Stable suffixes alone are insufficient: external callers can supply an unpaired state/count.
            if (other &&
                other.kind === expectedKind &&
                other.state_id === null &&
                other.count === record.count &&
                other.evidence_id === evidence &&
                other.architecture === record.architecture &&
                other.address_space === record.addressSpace &&
                other.address === record.address &&
                canonicalJson(JSON.parse(decodeSqlitePayload(other.payload)).state) === canonicalJson(record.state)) {
                if (record.kind === "runtime-cpu-state") {
                    this.#pair.run(prefix, identity.suffix, other.oid);
                    return;
                }
                statePrefix = Number(other.prefix_id);
                stateId = other.id;
                this.#removeObservation.run(other.oid);
            }
        }
        // runtimeColumns already canonicalizes the payload. Parsing it again would
        // repeat allocations and sorting for every distinct fact.
        const payload = columns.payload;
        const fingerprint = createHash("sha256")
            .update(
        // Fixed scalar fields in canonicalJson's key order avoid sorting/cloning
        // per row. Nulls, two-space indentation and the trailing newline preserve
        // persisted v2 fingerprints; changing the layout would duplicate old facts.
        // Keep this list aligned with runtimeColumns and the all-variant fingerprint test.
        JSON.stringify({
            accessedAddress: columns.accessedAddress,
            accessedAddressSpace: columns.accessedAddressSpace,
            address: columns.address,
            addressSpace: columns.addressSpace,
            architecture: record.architecture,
            coverage: columns.coverage,
            end: columns.end,
            fromAddress: columns.fromAddress,
            fromAddressSpace: columns.fromAddressSpace,
            instructionAddress: columns.instructionAddress,
            instructionAddressSpace: columns.instructionAddressSpace,
            kind: record.kind,
            payload,
            start: columns.start,
            toAddress: columns.toAddress,
            toAddressSpace: columns.toAddressSpace,
        }, undefined, 2) + "\n")
            .digest();
        const found = this.#findFact.get(fingerprint);
        let fid = found?.fid;
        if (fid === undefined) {
            // Existing shared facts need only a new observation. Encode payloads only
            // on insertion; large snapshots retain the bounded legacy codec.
            const encoded = payload === null ? null : encodeSqlitePayload(payload);
            fid = this.#insertFact.run(fingerprint, record.kind, record.architecture, columns.addressSpace, columns.address, columns.start, columns.end, columns.fromAddressSpace, columns.fromAddress, columns.toAddressSpace, columns.toAddress, columns.instructionAddressSpace, columns.instructionAddress, columns.accessedAddressSpace, columns.accessedAddress, columns.coverage, encoded, encoded, encoded).lastInsertRowid;
        }
        // Sharing a payload never shares capture ownership: each source still needs
        // its own observation count and evidence, even when the fact already exists.
        this.#insertObservation.run(fid, prefix, identity.suffix, evidence, record.count, statePrefix, stateId, record.kind === "runtime-execution" ? 0 : 1);
    }
}
//# sourceMappingURL=sqlite-runtime-storage.js.map