import type { DatabaseSync } from "node:sqlite";

import type {
  AnalysisCallGraph,
  AnalysisCallGraphFunction,
  AnalysisCallGraphEdge,
  AnalysisCallGraphUnresolved,
} from "./analysis-graph.js";
import type {
  AnalysisControlFlowNodeRecord,
  AnalysisControlFlowEdgeRecord,
  AnalysisFunctionRecord,
  AnalysisUnresolvedRecord,
  ProjectLabel,
} from "./project-types.js";
import { decodeSqlitePayload } from "./sqlite-payload.js";
const decode = <T>(value: unknown): T => JSON.parse(decodeSqlitePayload(value)) as T;
const unique = (ids: readonly string[]): string[] =>
  [...new Set(ids)].sort((a, b) => a.localeCompare(b));
const numbers = (ids: readonly number[]): number[] => [...new Set(ids)].sort((a, b) => a - b);
/** Index only graph ownership and relevant edges, with bounded payload decoding on rebuild.
 * Context/state payloads never remain in memory. Ownership uses the last function entry in each
 * evidence path. Missing owners remain explicit.
 * @param {DatabaseSync} db Connection in a read transaction. Computation writes only temporary tables.
 * @returns {AnalysisCallGraph} Compact call graph backed by indexed node ownership.
 */
export const prepareGraph = (db: DatabaseSync): AnalysisCallGraph => {
  db.exec(`CREATE TEMP TABLE query_graph_nodes(id TEXT PRIMARY KEY,address_space TEXT,address INTEGER,file_offset INTEGER,owner TEXT) WITHOUT ROWID;
    CREATE INDEX temp.query_graph_owner ON query_graph_nodes(owner);
    CREATE INDEX temp.query_graph_location ON query_graph_nodes(address_space,address);
    CREATE TEMP TABLE query_graph_edges(id TEXT PRIMARY KEY,kind TEXT,address_space TEXT,from_address INTEGER,from_id TEXT,payload TEXT) WITHOUT ROWID;
    CREATE INDEX temp.query_graph_edge_location ON query_graph_edges(kind,address_space,from_address);
    DELETE FROM query_graph_nodes; DELETE FROM query_graph_edges;`);
  const entries = new Set(
    db
      .prepare(
        "SELECT n.id FROM analysis n JOIN analysis f ON f.kind='function' AND n.address_space=f.address_space AND n.address=f.address WHERE n.kind='cfg-node'",
      )
      .all()
      .map((row) => String(row.id)),
  );
  const putNode = db.prepare("INSERT INTO query_graph_nodes VALUES(?,?,?,?,?)");
  const putEdge = db.prepare("INSERT INTO query_graph_edges VALUES(?,?,?,?,?,?)");
  for (const row of db
    .prepare("SELECT kind,payload FROM analysis WHERE kind IN ('cfg-node','cfg-edge')")
    .iterate()) {
    if (row.kind === "cfg-node") {
      const node = decode<AnalysisControlFlowNodeRecord>(row.payload);
      const path = node.evidencePath.length ? node.evidencePath : [node.id];
      let owner: string | undefined;
      for (let i = path.length - 1; i >= 0; i--) {
        if (entries.has(path[i])) {
          owner = path[i];
          break;
        }
      }
      putNode.run(node.id, node.addressSpace, node.address, node.fileOffset ?? null, owner ?? null);
    } else {
      const edge = decode<AnalysisControlFlowEdgeRecord>(row.payload);
      if (
        edge.edgeKind === "unresolved" ||
        (["call", "interrupt"].includes(edge.edgeKind) && edge.toAddress !== undefined)
      ) {
        putEdge.run(
          edge.id,
          edge.edgeKind,
          edge.addressSpace,
          edge.fromAddress,
          edge.from,
          JSON.stringify(edge),
        );
      }
    }
  }
  const ownersQuery =
    db.prepare(`SELECT f.id FROM query_graph_nodes n JOIN query_graph_nodes e ON e.id=n.owner
    JOIN analysis f ON f.kind='function' AND f.address_space=e.address_space AND f.address=e.address WHERE n.id=?`);
  const owners = (id: string): string[] => unique(ownersQuery.all(id).map((row) => String(row.id)));
  const offsetQuery = db.prepare(
    "SELECT file_offset FROM query_graph_nodes WHERE id=? AND file_offset IS NOT NULL",
  );
  const offsets = (ids: readonly string[]): number[] =>
    numbers(ids.flatMap((id) => offsetQuery.all(id).map((row) => Number(row.file_offset))));
  const functionsAt = db.prepare(
    "SELECT id FROM analysis WHERE kind='function' AND address_space=? AND address=?",
  );
  const calls: AnalysisCallGraphEdge[] = [];
  for (const row of db
    .prepare("SELECT payload FROM query_graph_edges WHERE kind IN ('call','interrupt')")
    .iterate()) {
    const edge = decode<AnalysisControlFlowEdgeRecord>(row.payload);
    calls.push({
      id: edge.id,
      edgeKind: edge.edgeKind as "call" | "interrupt",
      addressSpace: edge.addressSpace,
      fromAddress: edge.fromAddress,
      toAddress: edge.toAddress!,
      fromNodeId: edge.from,
      ...(edge.to ? { toNodeId: edge.to } : {}),
      callerFunctionIds: owners(edge.from),
      calleeFunctionIds: unique(
        functionsAt.all(edge.addressSpace, edge.toAddress!).map((row) => String(row.id)),
      ),
      fromOutputOffsets: offsets([edge.from]),
      toOutputOffsets: offsets(edge.to ? [edge.to] : []),
      indirect: edge.indirect,
      ...(edge.override ? { override: edge.override } : {}),
      ...(edge.explanation ? { explanation: edge.explanation } : {}),
      evidence: edge.evidence,
    });
  }
  const unresolved: AnalysisCallGraphUnresolved[] = [];
  const unresolvedNodes = db.prepare(
    "SELECT from_id FROM query_graph_edges WHERE kind='unresolved' AND address_space=? AND from_address=?",
  );
  for (const row of db.prepare("SELECT payload FROM analysis WHERE kind='unresolved'").iterate()) {
    const record = decode<AnalysisUnresolvedRecord>(row.payload);
    const nodeIds = unique(
      unresolvedNodes.all(record.addressSpace, record.address).map((row) => String(row.from_id)),
    );
    unresolved.push({
      id: record.id,
      addressSpace: record.addressSpace,
      address: record.address,
      flowKind: record.flowKind,
      indirect: record.indirect,
      reason: record.reason,
      nodeIds,
      ownerFunctionIds: unique(nodeIds.flatMap(owners)),
      outputOffsets: offsets(nodeIds),
      evidence: record.evidence,
    });
  }
  const incoming = new Map<string, string[]>(),
    outgoing = new Map<string, string[]>(),
    unresolvedByOwner = new Map<string, string[]>();
  const append = (map: Map<string, string[]>, owner: string, id: string): void => {
    let ids = map.get(owner);
    if (!ids) {
      ids = [];
      map.set(owner, ids);
    }
    ids.push(id);
  };
  for (const call of calls) {
    for (const id of call.callerFunctionIds) {
      append(outgoing, id, call.id);
    }
    for (const id of call.calleeFunctionIds) {
      append(incoming, id, call.id);
    }
  }
  for (const record of unresolved) {
    for (const id of record.ownerFunctionIds) {
      append(unresolvedByOwner, id, record.id);
    }
  }
  const owned = db.prepare(
    "SELECT n.id,n.address,n.file_offset FROM query_graph_nodes e JOIN query_graph_nodes n ON n.owner=e.id WHERE e.address_space=? AND e.address=?",
  );
  const labels = db.prepare("SELECT payload FROM labels WHERE address_space=? AND address=?");
  const functions: AnalysisCallGraphFunction[] = [];
  for (const row of db.prepare("SELECT payload FROM analysis WHERE kind='function'").iterate()) {
    const fn = decode<AnalysisFunctionRecord>(row.payload);
    const nodes = owned.all(fn.addressSpace, fn.address);
    functions.push({
      id: fn.id,
      addressSpace: fn.addressSpace,
      address: fn.address,
      source: fn.source,
      labels: labels
        .all(fn.addressSpace, fn.address)
        .map((row) => {
          const { id, name } = decode<ProjectLabel>(row.payload);
          return { id, name };
        })
        .sort((a, b) => a.id.localeCompare(b.id)),
      nodeIds: unique(nodes.map((row) => String(row.id))),
      outputOffsets: numbers(
        nodes
          .filter((row) => row.address === fn.address && row.file_offset !== null)
          .map((row) => Number(row.file_offset)),
      ),
      incomingCallIds: unique(incoming.get(fn.id) ?? []),
      outgoingCallIds: unique(outgoing.get(fn.id) ?? []),
      unresolvedIds: unique(unresolvedByOwner.get(fn.id) ?? []),
      evidence: fn.evidence,
    });
  }
  functions.sort(
    (a, b) =>
      a.addressSpace.localeCompare(b.addressSpace) ||
      a.address - b.address ||
      a.id.localeCompare(b.id),
  );
  calls.sort(
    (a, b) =>
      a.addressSpace.localeCompare(b.addressSpace) ||
      a.fromAddress - b.fromAddress ||
      a.toAddress - b.toAddress ||
      a.id.localeCompare(b.id),
  );
  unresolved.sort(
    (a, b) =>
      a.addressSpace.localeCompare(b.addressSpace) ||
      a.address - b.address ||
      a.id.localeCompare(b.id),
  );
  const graph = {
    functions,
    calls,
    unresolved,
    orphanCallIds: unique(
      calls
        .filter((c) => !c.callerFunctionIds.length || !c.calleeFunctionIds.length)
        .map((c) => c.id),
    ),
    orphanUnresolvedIds: unique(
      unresolved.filter((r) => !r.ownerFunctionIds.length).map((r) => r.id),
    ),
  };
  return graph;
};

/** Publish fully computed SQL ownership under the caller's short writer lock.
 * @param {DatabaseSync} db Connection retaining the temporary graph tables.
 */
export const publishGraph = (db: DatabaseSync): void => {
  db.exec(`CREATE TABLE IF NOT EXISTS main.query_graph_nodes(id TEXT PRIMARY KEY,address_space TEXT,address INTEGER,file_offset INTEGER,owner TEXT) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS main.query_graph_owner ON query_graph_nodes(owner);
    CREATE INDEX IF NOT EXISTS main.query_graph_location ON query_graph_nodes(address_space,address);
    CREATE TABLE IF NOT EXISTS main.query_graph_edges(id TEXT PRIMARY KEY,kind TEXT,address_space TEXT,from_address INTEGER,from_id TEXT,payload TEXT) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS main.query_graph_edge_location ON query_graph_edges(kind,address_space,from_address);
    DELETE FROM main.query_graph_nodes;INSERT INTO main.query_graph_nodes SELECT * FROM temp.query_graph_nodes;
    DELETE FROM main.query_graph_edges;INSERT INTO main.query_graph_edges SELECT * FROM temp.query_graph_edges;`);
};
