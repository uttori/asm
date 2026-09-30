import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
/**
 * Exact duplicate detection that spills long ID histories after 4 Mi characters. The disk index
 * stores complete IDs, so no hash collision can hide a duplicate. Call close() after every scan.
 */
export class RecordIdSet {
    #ids = new Set();
    #characters = 0;
    #directory;
    #database;
    #insert;
    /**
     * Claim an ID while keeping the in-memory prefix small.
     * @param {string} id Complete record identity.
     * @returns {boolean} False only for an exact duplicate.
     */
    add(id) {
        if (this.#insert) {
            return this.#insert.run(id).changes !== 0;
        }
        if (this.#ids.has(id)) {
            return false;
        }
        this.#ids.add(id);
        this.#characters += id.length;
        if (this.#characters > 4 * 1024 * 1024) {
            this.#spill();
        }
        return true;
    }
    #spill() {
        this.#directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-record-ids-"));
        try {
            this.#database = new DatabaseSync(path.join(this.#directory, "ids.sqlite"));
            // The index is disposable validation state, never project storage. Bound the page cache and
            // omit journaling. Any error or interrupted scan cannot authorize project publication.
            this.#database.exec("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA cache_size=-4096; CREATE TABLE ids (id TEXT PRIMARY KEY) WITHOUT ROWID; BEGIN;");
            this.#insert = this.#database.prepare("INSERT OR IGNORE INTO ids VALUES (?)");
            for (const id of this.#ids) {
                this.#insert.run(id);
            }
            this.#ids.clear();
        }
        catch (error) {
            this.close();
            throw error;
        }
    }
    /** Release both memory and any disposable database, including after a failed validation. */
    close() {
        try {
            this.#database?.close();
        }
        finally {
            this.#database = undefined;
            this.#insert = undefined;
            this.#ids.clear();
            if (this.#directory) {
                fs.rmSync(this.#directory, { recursive: true, force: true });
            }
            this.#directory = undefined;
        }
    }
}
//# sourceMappingURL=record-id-set.js.map