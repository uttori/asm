import { assertSourcePath } from "../internal/source-inputs.js";
import { projectSourceLabelNames, validateSourceLabelName } from "../model/project-labels.js";
import type { ProjectLabel } from "../model/project-types.js";
import {
  parseResearchDocument,
  validateResearchSnapshot,
  type ResearchDocument,
  type ResearchSnapshot,
} from "./inputs.js";

/** Runtime validation must not widen a readonly typed array to Array<any>. */
const isArray = (value: unknown): boolean => Array.isArray(value);

/** Original address is stable through source relocation; ordinary spelling changes never replace the ID. */
export interface ResearchSymbolIdentity {
  readonly id: string;
  readonly addressSpace: string;
  readonly address: number;
  readonly currentName: string;
  readonly evidence: readonly string[];
}

/** An editor combines this content-checked declaration change with its normal multi-file rename edit. */
export interface ResearchSymbolEdit {
  readonly path: string;
  readonly expectedSha256: string | null;
  readonly document: ResearchDocument;
  readonly symbol: ProjectLabel;
}

/** Presentation choices and analysis seeding are independent; suppression never removes evidence. */
export type ResearchSymbolChange =
  | { readonly kind: "aliases"; readonly aliases: readonly string[] }
  | { readonly kind: "suppression"; readonly suppressed: boolean }
  | { readonly kind: "entry-point"; readonly enabled: boolean };

/** Prepare an existing declaration edit while retaining its identity, evidence links and file. */
export function changeResearchSymbol(
  snapshot: ResearchSnapshot,
  id: string,
  change: ResearchSymbolChange,
): ResearchSymbolEdit {
  validateResearchSnapshot(snapshot);
  const file = snapshot.files.find((input) =>
    input.document.decisions.some(
      (decision) => decision.collection === "labels" && decision.id === id,
    ),
  );
  const decision = file?.document.decisions.find(
    (item) => item.collection === "labels" && item.id === id,
  );
  if (!file || !decision?.value) {
    throw new Error(
      "Choose an existing label declaration. A record tombstone must be restored explicitly in its research file.",
    );
  }
  const previous = decision.value as ProjectLabel;
  let symbol: ProjectLabel;
  if (change.kind === "aliases") {
    if (!isArray(change.aliases) || change.aliases.length > 64) {
      throw new Error("A symbol may have at most 64 research aliases.");
    }
    const names = new Set<string>();
    for (const alias of change.aliases) {
      validateSourceLabelName(alias);
      const key = alias.toLowerCase();
      if (names.has(key) || key === (previous.sourceName ?? previous.name).toLowerCase()) {
        throw new Error(`Repeated alias or current symbol name: ${alias}`);
      }
      names.add(key);
    }
    for (const other of snapshot.decisions) {
      if (other.collection !== "labels" || !other.value || other.id === id) {
        continue;
      }
      const label = other.value as ProjectLabel;
      for (const name of [label.sourceName ?? label.name, ...(label.aliases ?? [])]) {
        if (names.has(name.toLowerCase())) {
          throw new Error(`Alias '${name}' belongs to another research symbol.`);
        }
      }
    }
    symbol = { ...previous, aliases: [...change.aliases] };
  } else if (change.kind === "suppression" && typeof change.suppressed === "boolean") {
    symbol = { ...previous, suppressed: change.suppressed };
  } else if (change.kind === "entry-point" && typeof change.enabled === "boolean") {
    symbol = { ...previous, analysisEntryPoint: change.enabled };
  } else {
    throw new Error("Unknown research symbol change.");
  }
  // Restoring a presentation name must not introduce a collision hidden while it was suppressed.
  projectSourceLabelNames(
    snapshot.decisions.flatMap((item) => {
      if (item.collection !== "labels" || !item.value) {
        return [];
      }
      return [item.id === id ? symbol : (item.value as ProjectLabel)];
    }),
  );
  const document = parseResearchDocument({
    ...file.document,
    decisions: file.document.decisions.map((item) =>
      item.collection === "labels" && item.id === id ? { ...item, value: symbol } : item,
    ),
  });
  return { path: file.path, expectedSha256: file.sha256, document, symbol };
}

/**
 * Prepare persistent rename intent without writing SQLite or committing source. Existing declarations
 * retain their location, provenance, comments, and seed policy. Newly named generated entries do not
 * become new static-analysis entry points merely because someone pressed F2.
 */
export function renameResearchSymbol(
  snapshot: ResearchSnapshot,
  identity: ResearchSymbolIdentity,
  newName: string,
  newDocumentPath: string,
  reservedNames: Iterable<string> = [],
): ResearchSymbolEdit {
  validateResearchSnapshot(snapshot);
  validateSourceLabelName(newName);
  validateSourceLabelName(identity.currentName);
  if (
    !/^\w[\w./:-]*$/.test(identity.id) ||
    !identity.addressSpace ||
    !Number.isSafeInteger(identity.address) ||
    identity.address < 0
  ) {
    throw new Error("Rename requires the original symbol identity and address.");
  }
  const file = snapshot.files.find((input) =>
    input.document.decisions.some(
      (decision) => decision.collection === "labels" && decision.id === identity.id,
    ),
  );
  const decision = file?.document.decisions.find(
    (input) => input.collection === "labels" && input.id === identity.id,
  );
  if (decision?.value === null) {
    throw new Error("Restore this suppressed research record before renaming it.");
  }
  const previous = decision?.value as ProjectLabel | undefined;
  if (
    previous &&
    (previous.addressSpace !== identity.addressSpace || previous.address !== identity.address)
  ) {
    throw new Error("The symbol's original identity changed. Refresh before renaming.");
  }
  if (previous?.sourceName && previous.sourceName !== identity.currentName) {
    throw new Error("The symbol was renamed since this source snapshot. Refresh before renaming.");
  }
  const aliases = [...new Set([...(previous?.aliases ?? []), identity.currentName])].filter(
    (name) => name !== newName,
  );
  const symbol: ProjectLabel = {
    ...(previous ?? {
      id: identity.id,
      addressSpace: identity.addressSpace,
      address: identity.address,
      evidence: identity.evidence,
      analysisEntryPoint: false,
    }),
    name: newName,
    sourceName: newName,
    aliases,
    suppressed: false,
  };
  const labels = snapshot.decisions
    .filter(
      (item) => item.collection === "labels" && item.value !== null && item.id !== identity.id,
    )
    .map((item) => item.value as ProjectLabel);
  // Match the exporter's case-insensitive name reservation before producing a source edit.
  if ([...reservedNames].some((name) => name.toLowerCase() === newName.toLowerCase())) {
    throw new Error(`Source name '${newName}' is already used by another symbol.`);
  }
  projectSourceLabelNames([...labels, symbol]);
  const relative = file?.path ?? newDocumentPath;
  assertSourcePath(relative);
  if (!relative.endsWith(".json")) {
    throw new Error("Symbol research documents use .json files.");
  }
  const destination = file ?? snapshot.files.find((input) => input.path === relative);
  const document = parseResearchDocument({
    ...(destination?.document ?? {
      format: "uttori-research",
      version: 1,
      project: snapshot.project,
      romSha256: snapshot.romSha256,
    }),
    decisions: [
      ...(destination?.document.decisions ?? []).filter(
        (item) => item.collection !== "labels" || item.id !== identity.id,
      ),
      { collection: "labels", id: identity.id, value: symbol },
    ].sort((a, b) =>
      Buffer.compare(
        Buffer.from(`${a.collection}:${a.id}`),
        Buffer.from(`${b.collection}:${b.id}`),
      ),
    ),
  });
  return { path: relative, expectedSha256: destination?.sha256 ?? null, document, symbol };
}
