/**
 * Exact duplicate detection that spills long ID histories after 4 Mi characters. The disk index
 * stores complete IDs, so no hash collision can hide a duplicate. Call close() after every scan.
 */
export declare class RecordIdSet {
    #private;
    /**
     * Claim an ID while keeping the in-memory prefix small.
     * @param id Complete record identity.
     * @returns False only for an exact duplicate.
     */
    add(id: string): boolean;
    /** Release both memory and any disposable database, including after a failed validation. */
    close(): void;
}
//# sourceMappingURL=record-id-set.d.ts.map