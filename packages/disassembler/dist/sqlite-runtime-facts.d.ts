/** Coordinates are shared independently of full register snapshots. Order is part of the SQL
 * descriptor key, not the external fact fingerprint; public fact identities remain unchanged.
 */
export declare const RUNTIME_DESCRIPTOR_COLUMNS: readonly ["kind", "architecture", "address_space", "address", "start", "end", "from_address_space", "from_address", "to_address_space", "to_address", "instruction_address_space", "instruction_address", "accessed_address_space", "accessed_address", "coverage"];
/** Hash indexes contain eight bytes, but equality always checks the complete stored value.
 * Text identities retain their complete key to avoid hot buckets for shared textual prefixes.
 * @param {string} column Trusted SQL expression from application-owned query text.
 * @returns {string} Index expression; pair it with full-value equality in every lookup.
 */
export declare const runtimeIdentityKey: (column: string) => string;
/** Shared descriptors and compressed blocks replace wide, repeated per-snapshot rows.
 * The logical view exposes complete records with their exact payload storage types.
 * Physical fact IDs stay stable when payloads are compressed or logical records are updated.
 */
export declare const RUNTIME_FACT_SCHEMA: string;
/** Collision-safe identity interning without repeating complete binary hashes in a second B-tree. */
export declare const RUNTIME_IDENTITY_SCHEMA: string;
//# sourceMappingURL=sqlite-runtime-facts.d.ts.map