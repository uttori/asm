/** Coordinates are shared independently of full register snapshots. Order is part of the SQL
 * descriptor key, not the external fact fingerprint; public fact identities remain unchanged.
 */
export const RUNTIME_DESCRIPTOR_COLUMNS = [
    "kind",
    "architecture",
    "address_space",
    "address",
    "start",
    "end",
    "from_address_space",
    "from_address",
    "to_address_space",
    "to_address",
    "instruction_address_space",
    "instruction_address",
    "accessed_address_space",
    "accessed_address",
    "coverage",
];
/** Hash indexes contain eight bytes, but equality always checks the complete stored value.
 * Text identities retain their complete key to avoid hot buckets for shared textual prefixes.
 * @param {string} column Trusted SQL expression from application-owned query text.
 * @returns {string} Index expression; pair it with full-value equality in every lookup.
 */
export const runtimeIdentityKey = (column) => `CASE WHEN typeof(${column})='blob' THEN substr(${column},1,8) ELSE ${column} END`;
const columns = RUNTIME_DESCRIPTOR_COLUMNS.map((column) => `"${column}"`).join(",");
const inserted = RUNTIME_DESCRIPTOR_COLUMNS.map((column) => `NEW."${column}"`).join(",");
const key = `json_array(${inserted})`;
const descriptorInsert = `INSERT OR IGNORE INTO runtime_descriptors(key,${columns}) VALUES(${key},${inserted});`;
const descriptorId = `(SELECT did FROM runtime_descriptors WHERE key=${key})`;
/** Shared descriptors and compressed blocks replace wide, repeated per-snapshot rows.
 * The logical view exposes complete records with their exact payload storage types.
 * Physical fact IDs stay stable when payloads are compressed or logical records are updated.
 */
export const RUNTIME_FACT_SCHEMA = `
CREATE TABLE runtime_descriptors (
  did INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL, architecture TEXT NOT NULL,
  address_space TEXT, address INTEGER, start INTEGER, "end" INTEGER,
  from_address_space TEXT, from_address INTEGER, to_address_space TEXT, to_address INTEGER,
  instruction_address_space TEXT, instruction_address INTEGER,
  accessed_address_space TEXT, accessed_address INTEGER, coverage TEXT
);
CREATE INDEX runtime_lookup ON runtime_descriptors(kind,address_space,address,start);
CREATE INDEX runtime_memory ON runtime_descriptors(instruction_address_space,instruction_address) WHERE kind='runtime-memory-access';
CREATE TABLE runtime_fact_rows (
  fid INTEGER PRIMARY KEY, fingerprint BLOB,
  descriptor_id INTEGER NOT NULL REFERENCES runtime_descriptors(did),
  payload BLOB, history_id INTEGER REFERENCES runtime_history(id), history_slot INTEGER,
  CHECK ((history_id IS NULL AND history_slot IS NULL) OR
    (history_id IS NOT NULL AND history_slot>=0 AND payload IS NULL))
);
CREATE INDEX runtime_fact_fingerprint ON runtime_fact_rows(substr(fingerprint,1,8));
CREATE INDEX runtime_fact_descriptor ON runtime_fact_rows(descriptor_id);
CREATE INDEX runtime_history_pending ON runtime_fact_rows(fid) WHERE history_id IS NULL;
CREATE TRIGGER runtime_fact_unique_insert BEFORE INSERT ON runtime_fact_rows
WHEN NEW.fingerprint IS NOT NULL AND EXISTS(
  SELECT 1 FROM runtime_fact_rows WHERE substr(fingerprint,1,8)=substr(NEW.fingerprint,1,8) AND fingerprint=NEW.fingerprint AND fid IS NOT NEW.fid)
BEGIN SELECT RAISE(ABORT,'Duplicate runtime fact fingerprint'); END;
CREATE TRIGGER runtime_fact_unique_update BEFORE UPDATE OF fingerprint ON runtime_fact_rows
WHEN NEW.fingerprint IS NOT NULL AND EXISTS(
  SELECT 1 FROM runtime_fact_rows WHERE substr(fingerprint,1,8)=substr(NEW.fingerprint,1,8)
    AND fingerprint=NEW.fingerprint AND fid!=OLD.fid)
BEGIN SELECT RAISE(ABORT,'Duplicate runtime fact fingerprint'); END;
CREATE VIEW runtime_fact_locations AS SELECT f.fid,
  ${RUNTIME_DESCRIPTOR_COLUMNS.map((column) => `d."${column}"`).join(",")}
FROM runtime_fact_rows f LEFT JOIN runtime_descriptors d ON d.did=f.descriptor_id;
CREATE VIEW runtime_facts AS SELECT f.fid,f.fingerprint,
  ${RUNTIME_DESCRIPTOR_COLUMNS.map((column) => `d."${column}"`).join(",")},
  CASE WHEN f.history_id IS NULL THEN f.payload
    ELSE analysis_history_payload(f.history_id,f.history_slot) END AS payload
FROM runtime_fact_rows f LEFT JOIN runtime_descriptors d ON d.did=f.descriptor_id;
CREATE TRIGGER runtime_fact_insert INSTEAD OF INSERT ON runtime_facts BEGIN
  ${descriptorInsert}
  INSERT INTO runtime_fact_rows(fid,fingerprint,descriptor_id,payload)
    VALUES(NEW.fid,NEW.fingerprint,${descriptorId},NEW.payload);
END;
CREATE TRIGGER runtime_fact_update INSTEAD OF UPDATE ON runtime_facts BEGIN
  ${descriptorInsert}
  UPDATE runtime_fact_rows SET fid=NEW.fid,fingerprint=NEW.fingerprint,
    descriptor_id=${descriptorId},payload=NEW.payload,history_id=NULL,history_slot=NULL WHERE fid=OLD.fid;
END;
CREATE TRIGGER runtime_fact_delete INSTEAD OF DELETE ON runtime_facts BEGIN
  DELETE FROM runtime_fact_rows WHERE fid=OLD.fid;
END;
`;
/** Collision-safe identity interning without repeating complete binary hashes in a second B-tree. */
export const RUNTIME_IDENTITY_SCHEMA = `
CREATE TABLE runtime_identities(iid INTEGER PRIMARY KEY,value BLOB NOT NULL);
CREATE INDEX runtime_identity_key ON runtime_identities(${runtimeIdentityKey("value")});
CREATE TRIGGER runtime_identity_unique_insert BEFORE INSERT ON runtime_identities
WHEN EXISTS(SELECT 1 FROM runtime_identities
  WHERE (${runtimeIdentityKey("value")})=(${runtimeIdentityKey("NEW.value")}) AND value=NEW.value)
BEGIN SELECT RAISE(ABORT,'Duplicate runtime identity'); END;
CREATE TRIGGER runtime_identity_unique_update BEFORE UPDATE OF value ON runtime_identities
WHEN EXISTS(SELECT 1 FROM runtime_identities
  WHERE (${runtimeIdentityKey("value")})=(${runtimeIdentityKey("NEW.value")}) AND value=NEW.value AND iid!=OLD.iid)
BEGIN SELECT RAISE(ABORT,'Duplicate runtime identity'); END;
`;
//# sourceMappingURL=sqlite-runtime-facts.js.map