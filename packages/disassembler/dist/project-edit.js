import { projectSourceLabelNames, validateSourceLabelName } from "./project-labels.js";
import { canonicalJson } from "./project-store.js";
/** Classifications accepted by a manual range edit. */
export const RANGE_CLASSIFICATIONS = [
    "unreached",
    "opcode",
    "operand",
    "data8",
    "data16",
    "data24",
    "data32",
    "pointer16",
    "pointer24",
    "pointer32",
    "graphics",
    "music",
    "compressed",
    "asset",
    "empty",
    "text",
];
const isStableId = (id) => {
    const isAlphaNumeric = (character) => {
        const code = character.charCodeAt(0);
        return ((code >= 0x30 && code <= 0x39) ||
            (code >= 0x41 && code <= 0x5a) ||
            (code >= 0x61 && code <= 0x7a));
    };
    if (id.length === 0 || !isAlphaNumeric(id[0]) || !isAlphaNumeric(id.at(-1)))
        return false;
    for (const character of id) {
        if (!isAlphaNumeric(character) && !"._:/-".includes(character))
            return false;
    }
    return true;
};
const manifestWithoutShards = (manifest) => {
    if (!("shards" in manifest))
        return manifest;
    const { shards: ignored, ...projectManifest } = manifest;
    void ignored;
    return projectManifest;
};
const assertStableId = (id, label) => {
    if (!isStableId(id))
        throw new Error(`${label} '${id}' is not a stable project id.`);
};
const recordMatches = (left, right) => canonicalJson(left) === canonicalJson(right);
const sortedUnique = (values) => [...new Set(values)].sort((left, right) => left.localeCompare(right));
const sortedUniqueNumbers = (values) => [...new Set(values)].sort((left, right) => left - right);
const assertManualEvidenceRequest = (project, evidenceId, sourceId) => {
    assertStableId(evidenceId, "Evidence id");
    assertStableId(sourceId, "Evidence source id");
    if (project.shards.evidence.some(({ id }) => id === evidenceId)) {
        throw new Error(`Evidence '${evidenceId}' already exists.`);
    }
};
const manualEvidence = (evidenceId, sourceId, detail) => ({
    id: evidenceId,
    source: "manual",
    sourceId,
    confidence: "certain",
    ...(detail?.trim() ? { detail: detail.trim() } : {}),
});
const addressSpaceMaximum = (project, addressSpaceId) => {
    const addressSpace = project.manifest.addressSpaces.find(({ id }) => id === addressSpaceId);
    if (!addressSpace)
        throw new Error(`Unknown analysis address space '${addressSpaceId}'.`);
    return addressSpace.kind === "file"
        ? project.manifest.rom.contentSize
        : 2 ** addressSpace.addressBits;
};
const conflictIdFor = (annotationId, existingId) => `conflict:manual-range:${annotationId}:${existingId}`;
const evidenceReferences = (shards, evidenceId) => [
    ...shards.analysis
        .filter((record) => record.evidence.includes(evidenceId))
        .map((record) => `analysis:${record.id}`),
    ...shards.annotations
        .filter((record) => record.evidence.includes(evidenceId))
        .map((record) => `annotations:${record.id}`),
    ...shards.labels
        .filter((record) => record.evidence.includes(evidenceId))
        .map((record) => `labels:${record.id}`),
    ...shards.comments
        .filter((record) => record.evidence.includes(evidenceId))
        .map((record) => `comments:${record.id}`),
    ...shards.regions
        .filter((record) => record.evidence.includes(evidenceId))
        .map((record) => `regions:${record.id}`),
    ...shards.runtime
        .filter((record) => record.evidence.includes(evidenceId))
        .map((record) => `runtime:${record.id}`),
];
/**
 * Adds one manual interval without deleting or rewriting prior annotations. Contradictory overlaps
 * become explicit range conflicts carrying both evidence sets, so no imported/static fact is lost.
 * @param {LoadedAnalysisProject} project Validated project snapshot to edit.
 * @param {RangeClassificationEditRequest} request Stable manual annotation/evidence identity.
 * @returns {AppliedRangeClassificationEdit} Replacement project and exact inverse records.
 */
export const applyRangeClassificationEdit = (project, request) => {
    assertStableId(request.annotationId, "Annotation id");
    assertStableId(request.evidenceId, "Evidence id");
    if (!isStableId(request.sourceId)) {
        throw new Error(`Evidence source id '${request.sourceId}' is not a stable project id.`);
    }
    if (request.architecture.trim() === "")
        throw new Error("Range classification needs an architecture.");
    if (!RANGE_CLASSIFICATIONS.includes(request.classification)) {
        throw new Error(`Unsupported range classification '${String(request.classification)}'.`);
    }
    if (!Number.isSafeInteger(request.start) ||
        !Number.isSafeInteger(request.end) ||
        request.start < 0 ||
        request.end <= request.start) {
        throw new Error("Range classification needs a valid half-open range.");
    }
    const addressSpace = project.manifest.addressSpaces.find(({ id }) => id === request.addressSpace);
    if (!addressSpace)
        throw new Error(`Unknown analysis address space '${request.addressSpace}'.`);
    const maximum = addressSpace.kind === "file" ? project.manifest.rom.contentSize : 2 ** addressSpace.addressBits;
    if (request.end > maximum) {
        throw new Error(`Range classification exceeds address space '${request.addressSpace}'.`);
    }
    if (project.shards.annotations.some(({ id }) => id === request.annotationId)) {
        throw new Error(`Analysis annotation '${request.annotationId}' already exists.`);
    }
    if (project.shards.evidence.some(({ id }) => id === request.evidenceId)) {
        throw new Error(`Evidence '${request.evidenceId}' already exists.`);
    }
    const evidence = {
        id: request.evidenceId,
        source: "manual",
        sourceId: request.sourceId,
        confidence: "certain",
        ...(request.detail?.trim() ? { detail: request.detail.trim() } : {}),
    };
    const annotation = {
        id: request.annotationId,
        addressSpace: request.addressSpace,
        start: request.start,
        end: request.end,
        classification: request.classification,
        architecture: request.architecture,
        evidence: [evidence.id],
    };
    const conflicts = project.shards.annotations
        .filter((existing) => existing.addressSpace === annotation.addressSpace &&
        existing.start < annotation.end &&
        annotation.start < existing.end &&
        (existing.classification !== annotation.classification ||
            existing.architecture !== annotation.architecture))
        .map((existing) => {
        const address = Math.max(existing.start, annotation.start);
        const end = Math.min(existing.end, annotation.end);
        return {
            id: conflictIdFor(annotation.id, existing.id),
            kind: "conflict",
            addressSpace: annotation.addressSpace,
            address,
            end,
            conflictKind: "manual-range-classification",
            message: `Manual annotation '${annotation.id}' (${annotation.classification}, ${annotation.architecture}) contradicts '${existing.id}' (${existing.classification}, ${existing.architecture}) over [${address}, ${end}).`,
            nodes: [],
            evidence: sortedUnique([...existing.evidence, evidence.id]),
        };
    })
        .sort((left, right) => left.id.localeCompare(right.id));
    for (const conflict of conflicts) {
        if (project.shards.analysis.some(({ id }) => id === conflict.id)) {
            throw new Error(`Analysis conflict '${conflict.id}' already exists.`);
        }
    }
    return {
        project: {
            manifest: manifestWithoutShards(project.manifest),
            shards: {
                ...project.shards,
                analysis: [...project.shards.analysis, ...conflicts],
                annotations: [...project.shards.annotations, annotation],
                evidence: [...project.shards.evidence, evidence],
            },
        },
        inverse: {
            kind: "remove-range-classification",
            annotation,
            evidence,
            conflicts,
        },
    };
};
/**
 * Removes exactly the records produced by an earlier classification edit. Undo refuses to proceed
 * when one of those records changed or the new evidence gained another reference.
 * @param {ProjectLike} project Current project state containing the applied edit.
 * @param {RangeClassificationInverse} inverse Exact records returned by the original edit.
 * @returns {AnalysisProject} Replacement project with only the unchanged edit records removed.
 */
export const revertRangeClassificationEdit = (project, inverse) => {
    const annotation = project.shards.annotations.find(({ id }) => id === inverse.annotation.id);
    const evidence = project.shards.evidence.find(({ id }) => id === inverse.evidence.id);
    if (!annotation || !recordMatches(annotation, inverse.annotation)) {
        throw new Error(`Cannot undo changed analysis annotation '${inverse.annotation.id}'.`);
    }
    if (!evidence || !recordMatches(evidence, inverse.evidence)) {
        throw new Error(`Cannot undo changed evidence '${inverse.evidence.id}'.`);
    }
    const conflictIds = new Set(inverse.conflicts.map(({ id }) => id));
    for (const expected of inverse.conflicts) {
        const conflict = project.shards.analysis.find(({ id }) => id === expected.id);
        if (!conflict || !recordMatches(conflict, expected)) {
            throw new Error(`Cannot undo changed analysis conflict '${expected.id}'.`);
        }
    }
    const permittedReferences = new Set([
        `annotations:${inverse.annotation.id}`,
        ...inverse.conflicts.map(({ id }) => `analysis:${id}`),
    ]);
    const addedReferences = evidenceReferences(project.shards, inverse.evidence.id).filter((reference) => !permittedReferences.has(reference));
    if (addedReferences.length > 0) {
        throw new Error(`Cannot undo evidence '${inverse.evidence.id}' because it is now referenced by ${addedReferences.join(", ")}.`);
    }
    return {
        manifest: manifestWithoutShards(project.manifest),
        shards: {
            ...project.shards,
            analysis: project.shards.analysis.filter(({ id }) => !conflictIds.has(id)),
            annotations: project.shards.annotations.filter(({ id }) => id !== inverse.annotation.id),
            evidence: project.shards.evidence.filter(({ id }) => id !== inverse.evidence.id),
        },
    };
};
const STATE_FIELD_MAXIMUMS = {
    programBank: 0xff,
    dataBank: 0xff,
    directPage: 0xffff,
    stackPointer: 0xffff,
};
const validateManualState = (state) => {
    if (!state)
        return [];
    const fields = Object.keys(state);
    for (const field of fields) {
        if (!["e", "m", "x", "carry", ...Object.keys(STATE_FIELD_MAXIMUMS)].includes(field)) {
            throw new Error(`Unknown manual state field '${field}'.`);
        }
        const value = state[field];
        if (["e", "m", "x", "carry"].includes(field)) {
            if (typeof value !== "boolean")
                throw new Error(`Manual state '${field}' must be boolean.`);
            continue;
        }
        const maximum = STATE_FIELD_MAXIMUMS[field];
        if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
            throw new Error(`Manual state '${field}' must be an integer from 0 through ${maximum}.`);
        }
    }
    return fields.sort();
};
const stateConflictFields = (manual, existing) => Object.keys(manual)
    .filter((field) => {
    const key = field;
    return existing?.[key] !== undefined && existing[key] !== manual[key];
})
    .sort();
/**
 * Adds a manual state/entry-point overlay by copying an existing classified interval. The base
 * record remains untouched; incompatible overlapping state becomes an explicit conflict.
 * @param {LoadedAnalysisProject} project Validated project snapshot to edit.
 * @param {StateEntryPointEditRequest} request State, entry-point, and stable evidence identity.
 * @returns {AppliedStateEntryPointEdit} Replacement project and exact inverse records.
 */
export const applyStateEntryPointEdit = (project, request) => {
    assertStableId(request.annotationId, "Annotation id");
    assertStableId(request.baseAnnotationId, "Base annotation id");
    assertManualEvidenceRequest(project, request.evidenceId, request.sourceId);
    if (project.shards.annotations.some(({ id }) => id === request.annotationId)) {
        throw new Error(`Analysis annotation '${request.annotationId}' already exists.`);
    }
    const base = project.shards.annotations.find(({ id }) => id === request.baseAnnotationId);
    if (!base)
        throw new Error(`Base analysis annotation '${request.baseAnnotationId}' does not exist.`);
    const stateFields = validateManualState(request.state);
    if (stateFields.length === 0 && request.entryPoint !== true) {
        throw new Error("A state/entry-point edit needs at least one state field or an entry point.");
    }
    const evidence = manualEvidence(request.evidenceId, request.sourceId, request.detail);
    const annotation = {
        id: request.annotationId,
        addressSpace: base.addressSpace,
        start: base.start,
        end: base.end,
        classification: base.classification,
        architecture: base.architecture,
        ...(stateFields.length > 0 ? { state: request.state } : {}),
        ...(request.entryPoint === true ? { points: ["in"] } : {}),
        evidence: [evidence.id],
    };
    const conflicts = project.shards.annotations
        .filter((existing) => existing.addressSpace === annotation.addressSpace &&
        existing.start < annotation.end &&
        annotation.start < existing.end)
        .flatMap((existing) => {
        const differing = request.state ? stateConflictFields(request.state, existing.state) : [];
        if (differing.length === 0)
            return [];
        const address = Math.max(existing.start, annotation.start);
        const end = Math.min(existing.end, annotation.end);
        return [
            {
                id: `conflict:manual-state:${annotation.id}:${existing.id}`,
                kind: "conflict",
                addressSpace: annotation.addressSpace,
                address,
                end,
                conflictKind: "manual-state",
                message: `Manual annotation '${annotation.id}' contradicts '${existing.id}' for state ${differing.join(", ")} over [${address}, ${end}).`,
                nodes: [],
                evidence: sortedUnique([...existing.evidence, evidence.id]),
            },
        ];
    })
        .sort((left, right) => left.id.localeCompare(right.id));
    for (const conflict of conflicts) {
        if (project.shards.analysis.some(({ id }) => id === conflict.id)) {
            throw new Error(`Analysis conflict '${conflict.id}' already exists.`);
        }
    }
    return {
        project: {
            manifest: manifestWithoutShards(project.manifest),
            shards: {
                ...project.shards,
                analysis: [...project.shards.analysis, ...conflicts],
                annotations: [...project.shards.annotations, annotation],
                evidence: [...project.shards.evidence, evidence],
            },
        },
        inverse: { kind: "remove-state-entry-point", annotation, evidence, conflicts },
    };
};
/**
 * Safely removes the exact state/entry-point overlay produced by an earlier edit.
 * @param {ProjectLike} project Current project state containing the applied edit.
 * @param {StateEntryPointInverse} inverse Exact records returned by the original edit.
 * @returns {AnalysisProject} Replacement project with only unchanged edit records removed.
 */
export const revertStateEntryPointEdit = (project, inverse) => {
    const annotation = project.shards.annotations.find(({ id }) => id === inverse.annotation.id);
    const evidence = project.shards.evidence.find(({ id }) => id === inverse.evidence.id);
    if (!annotation || !recordMatches(annotation, inverse.annotation)) {
        throw new Error(`Cannot undo changed analysis annotation '${inverse.annotation.id}'.`);
    }
    if (!evidence || !recordMatches(evidence, inverse.evidence)) {
        throw new Error(`Cannot undo changed evidence '${inverse.evidence.id}'.`);
    }
    const conflictIds = new Set(inverse.conflicts.map(({ id }) => id));
    for (const expected of inverse.conflicts) {
        const conflict = project.shards.analysis.find(({ id }) => id === expected.id);
        if (!conflict || !recordMatches(conflict, expected)) {
            throw new Error(`Cannot undo changed analysis conflict '${expected.id}'.`);
        }
    }
    const permittedReferences = new Set([
        `annotations:${inverse.annotation.id}`,
        ...inverse.conflicts.map(({ id }) => `analysis:${id}`),
    ]);
    const addedReferences = evidenceReferences(project.shards, inverse.evidence.id).filter((reference) => !permittedReferences.has(reference));
    if (addedReferences.length > 0) {
        throw new Error(`Cannot undo evidence '${inverse.evidence.id}' because it is now referenced by ${addedReferences.join(", ")}.`);
    }
    return {
        manifest: manifestWithoutShards(project.manifest),
        shards: {
            ...project.shards,
            analysis: project.shards.analysis.filter(({ id }) => !conflictIds.has(id)),
            annotations: project.shards.annotations.filter(({ id }) => id !== inverse.annotation.id),
            evidence: project.shards.evidence.filter(({ id }) => id !== inverse.evidence.id),
        },
    };
};
/**
 * Adds targets and manual provenance to the sole override at a control-flow site. Existing targets
 * and evidence are unioned, because an indirect instruction can legitimately reach several sites.
 * @param {LoadedAnalysisProject} project Validated project snapshot to edit.
 * @param {TargetResolutionEditRequest} request Control-flow site, targets, and evidence identity.
 * @returns {AppliedTargetResolutionEdit} Replacement project and exact inverse state.
 */
export const applyTargetResolutionEdit = (project, request) => {
    assertStableId(request.overrideId, "Target override id");
    assertManualEvidenceRequest(project, request.evidenceId, request.sourceId);
    const maximum = addressSpaceMaximum(project, request.addressSpace);
    if (!Number.isSafeInteger(request.address) || request.address < 0 || request.address >= maximum) {
        throw new Error(`Target resolution has an invalid address in '${request.addressSpace}'.`);
    }
    const targets = sortedUniqueNumbers(request.targets);
    if (targets.length === 0 ||
        targets.some((target) => !Number.isSafeInteger(target) || target < 0 || target >= maximum)) {
        throw new Error(`Target resolution needs one or more valid '${request.addressSpace}' targets.`);
    }
    const matching = project.shards.analysis.filter((record) => record.kind === "target-override" &&
        record.addressSpace === request.addressSpace &&
        record.address === request.address);
    if (matching.length > 1) {
        throw new Error(`More than one target override already exists at address ${request.address}.`);
    }
    const before = matching[0];
    if (before && before.id !== request.overrideId) {
        throw new Error(`Target override '${before.id}' already owns address ${request.address}.`);
    }
    if (!before && project.shards.analysis.some(({ id }) => id === request.overrideId)) {
        throw new Error(`Analysis record '${request.overrideId}' already exists.`);
    }
    const evidence = manualEvidence(request.evidenceId, request.sourceId, request.detail);
    const after = {
        id: request.overrideId,
        kind: "target-override",
        addressSpace: request.addressSpace,
        address: request.address,
        targets: sortedUniqueNumbers([...(before?.targets ?? []), ...targets]),
        evidence: sortedUnique([...(before?.evidence ?? []), evidence.id]),
    };
    return {
        project: {
            manifest: manifestWithoutShards(project.manifest),
            shards: {
                ...project.shards,
                analysis: before
                    ? project.shards.analysis.map((record) => (record.id === before.id ? after : record))
                    : [...project.shards.analysis, after],
                evidence: [...project.shards.evidence, evidence],
            },
        },
        inverse: { kind: "restore-target-resolution", ...(before ? { before } : {}), after, evidence },
    };
};
/**
 * Safely restores or removes the exact target override produced by an earlier edit.
 * @param {ProjectLike} project Current project state containing the applied edit.
 * @param {TargetResolutionInverse} inverse Exact before/after records from the original edit.
 * @returns {AnalysisProject} Replacement project with the previous override restored.
 */
export const revertTargetResolutionEdit = (project, inverse) => {
    const after = project.shards.analysis.find(({ id }) => id === inverse.after.id);
    const evidence = project.shards.evidence.find(({ id }) => id === inverse.evidence.id);
    if (!after || !recordMatches(after, inverse.after)) {
        throw new Error(`Cannot undo changed target override '${inverse.after.id}'.`);
    }
    if (!evidence || !recordMatches(evidence, inverse.evidence)) {
        throw new Error(`Cannot undo changed evidence '${inverse.evidence.id}'.`);
    }
    const addedReferences = evidenceReferences(project.shards, inverse.evidence.id).filter((reference) => reference !== `analysis:${inverse.after.id}`);
    if (addedReferences.length > 0) {
        throw new Error(`Cannot undo evidence '${inverse.evidence.id}' because it is now referenced by ${addedReferences.join(", ")}.`);
    }
    const before = inverse.before;
    return {
        manifest: manifestWithoutShards(project.manifest),
        shards: {
            ...project.shards,
            analysis: before
                ? project.shards.analysis.map((record) => record.id === inverse.after.id ? before : record)
                : project.shards.analysis.filter(({ id }) => id !== inverse.after.id),
            evidence: project.shards.evidence.filter(({ id }) => id !== inverse.evidence.id),
        },
    };
};
/**
 * Renames one label while adding certain manual provenance and retaining every prior evidence id.
 * @param {LoadedAnalysisProject} project Validated project snapshot to edit.
 * @param {LabelRenameEditRequest} request Stable label, replacement name, and evidence identity.
 * @returns {AppliedLabelRenameEdit} Replacement project and exact inverse state.
 */
export const applyLabelRenameEdit = (project, request) => {
    assertStableId(request.labelId, "Label id");
    assertManualEvidenceRequest(project, request.evidenceId, request.sourceId);
    const before = project.shards.labels.find(({ id }) => id === request.labelId);
    if (!before)
        throw new Error(`Analysis label '${request.labelId}' does not exist.`);
    const name = request.name.trim();
    if (name === "")
        throw new Error("A label name cannot be empty.");
    if (name === before.name)
        throw new Error(`Analysis label '${request.labelId}' already has that name.`);
    const evidence = manualEvidence(request.evidenceId, request.sourceId, request.detail ?? `Renamed '${before.name}' to '${name}'.`);
    const after = {
        ...before,
        name,
        ...(before.sourceName !== undefined ? { sourceName: name } : {}),
        evidence: sortedUnique([...before.evidence, evidence.id]),
    };
    projectSourceLabelNames(project.shards.labels.map((label) => (label.id === before.id ? after : label)));
    return {
        project: {
            manifest: manifestWithoutShards(project.manifest),
            shards: {
                ...project.shards,
                labels: project.shards.labels.map((label) => (label.id === before.id ? after : label)),
                evidence: [...project.shards.evidence, evidence],
            },
        },
        inverse: { kind: "restore-label-name", before, after, evidence },
    };
};
/**
 * Safely restores the exact label value replaced by an earlier rename.
 * @param {ProjectLike} project Current project state containing the applied edit.
 * @param {LabelRenameInverse} inverse Exact before/after records from the original rename.
 * @returns {AnalysisProject} Replacement project with the previous label restored.
 */
export const revertLabelRenameEdit = (project, inverse) => {
    const after = project.shards.labels.find(({ id }) => id === inverse.after.id);
    const evidence = project.shards.evidence.find(({ id }) => id === inverse.evidence.id);
    if (!after || !recordMatches(after, inverse.after)) {
        throw new Error(`Cannot undo changed analysis label '${inverse.after.id}'.`);
    }
    if (!evidence || !recordMatches(evidence, inverse.evidence)) {
        throw new Error(`Cannot undo changed evidence '${inverse.evidence.id}'.`);
    }
    const addedReferences = evidenceReferences(project.shards, inverse.evidence.id).filter((reference) => reference !== `labels:${inverse.after.id}`);
    if (addedReferences.length > 0) {
        throw new Error(`Cannot undo evidence '${inverse.evidence.id}' because it is now referenced by ${addedReferences.join(", ")}.`);
    }
    return {
        manifest: manifestWithoutShards(project.manifest),
        shards: {
            ...project.shards,
            labels: project.shards.labels.map((label) => label.id === inverse.after.id ? inverse.before : label),
            evidence: project.shards.evidence.filter(({ id }) => id !== inverse.evidence.id),
        },
    };
};
/**
 * Save a friendly name and comments without changing code classifications or earlier evidence.
 * @param {LoadedAnalysisProject} project Validated snapshot to edit.
 * @param {DisassemblyAnnotationEditRequest} request Address, text, and stable record identities.
 * @returns {AppliedDisassemblyAnnotationEdit} Replacement project and exact inverse records.
 */
export const applyDisassemblyAnnotationEdit = (project, request) => {
    assertManualEvidenceRequest(project, request.evidenceId, request.sourceId);
    const maximum = addressSpaceMaximum(project, request.addressSpace);
    if (!Number.isSafeInteger(request.address) || request.address < 0 || request.address >= maximum)
        throw new Error("The annotation address is outside the selected address space.");
    for (const text of [request.comment, request.inlineComment, request.instructionComment]) {
        if (text === undefined)
            continue;
        if (typeof text !== "string")
            throw new Error("Comments must contain plain text.");
        for (const character of text) {
            const code = character.codePointAt(0);
            if ((code < 32 && ![9, 10, 13].includes(code)) || code === 0x2028 || code === 0x2029)
                throw new Error("Comments must contain plain text without control characters.");
        }
    }
    for (const text of [request.inlineComment, request.instructionComment]) {
        if (text !== undefined && /[\n\r]/.test(text))
            throw new Error("Inline comments must fit on one line.");
    }
    const atAddress = (record) => record.addressSpace === request.addressSpace && record.address === request.address;
    const fileAddress = project.manifest.addressSpaces.some((space) => space.id === request.addressSpace && space.kind === "file");
    const labelBefore = request.labelId === undefined
        ? undefined
        : project.shards.labels.find(({ id }) => id === request.labelId);
    if (labelBefore && !atAddress(labelBefore))
        throw new Error("The label id belongs to a different address.");
    let labelAfter;
    if (request.name !== undefined) {
        if (!request.labelId)
            throw new Error("A stable label id is required.");
        assertStableId(request.labelId, "Label id");
        const name = request.name.trim();
        validateSourceLabelName(name);
        labelAfter = {
            ...(labelBefore ?? {
                id: request.labelId,
                addressSpace: request.addressSpace,
                address: request.address,
                analysisEntryPoint: false,
            }),
            name,
            sourceName: name,
            ...(request.comment !== undefined
                ? { comment: request.comment.replaceAll("\r\n", "\n").replaceAll("\r", "\n") }
                : {}),
            ...(request.inlineComment !== undefined ? { inlineComment: request.inlineComment } : {}),
            evidence: sortedUnique([...(labelBefore?.evidence ?? []), request.evidenceId]),
        };
    }
    else if (request.comment || request.inlineComment || request.labelId) {
        throw new Error("A label name is required for comments attached to a label.");
    }
    const labels = labelAfter
        ? [...project.shards.labels.filter(({ id }) => id !== labelAfter.id), labelAfter]
        : project.shards.labels;
    projectSourceLabelNames(labels);
    const commentBefore = request.instructionCommentId === undefined || request.instructionComment === undefined
        ? undefined
        : project.shards.comments.find(({ id }) => id === request.instructionCommentId);
    if (commentBefore &&
        (!atAddress(commentBefore) || commentBefore.placement !== "inline-instruction"))
        throw new Error("The comment id belongs to a different address or placement.");
    let commentAfter;
    if (request.instructionComment !== undefined) {
        if (!request.instructionCommentId)
            throw new Error("A stable instruction-comment id is required.");
        assertStableId(request.instructionCommentId, "Comment id");
        if (request.instructionComment) {
            if (request.instructionComment !== commentBefore?.text &&
                !project.shards.analysis.some((record) => record.kind === "cfg-node" &&
                    (atAddress(record) || (fileAddress && record.fileOffset === request.address))))
                throw new Error("An inline instruction comment requires an accepted instruction boundary.");
            commentAfter = {
                id: request.instructionCommentId,
                addressSpace: request.addressSpace,
                address: request.address,
                placement: "inline-instruction",
                text: request.instructionComment,
                evidence: sortedUnique([...(commentBefore?.evidence ?? []), request.evidenceId]),
            };
        }
    }
    const withoutEvidence = (record) => {
        if (!record)
            return undefined;
        const { evidence: ignored, ...value } = record;
        void ignored;
        return value;
    };
    if (recordMatches(withoutEvidence(labelBefore), withoutEvidence(labelAfter)) &&
        recordMatches(withoutEvidence(commentBefore), withoutEvidence(commentAfter)))
        throw new Error("The annotation has no changes to save.");
    const evidence = manualEvidence(request.evidenceId, request.sourceId, `Edited disassembly annotation at ${request.addressSpace}:$${request.address.toString(16).toUpperCase()}.`);
    return {
        project: {
            manifest: manifestWithoutShards(project.manifest),
            shards: {
                ...project.shards,
                labels,
                comments: request.instructionComment === undefined
                    ? project.shards.comments
                    : [
                        ...project.shards.comments.filter(({ id }) => id !== request.instructionCommentId),
                        ...(commentAfter ? [commentAfter] : []),
                    ],
                evidence: [...project.shards.evidence, evidence],
            },
        },
        inverse: {
            kind: "restore-disassembly-annotation",
            labelBefore,
            labelAfter,
            commentBefore,
            commentAfter,
            evidence,
        },
    };
};
/**
 * Undo only if every touched record and its new provenance are still exactly as saved.
 * @param {ProjectLike} project Current native project.
 * @param {DisassemblyAnnotationInverse} inverse Records retained when saving.
 * @returns {AnalysisProject} Restored project with unrelated records preserved.
 */
export const revertDisassemblyAnnotationEdit = (project, inverse) => {
    const labelId = inverse.labelAfter?.id ?? inverse.labelBefore?.id;
    const commentId = inverse.commentAfter?.id ?? inverse.commentBefore?.id;
    if (!recordMatches(project.shards.labels.find(({ id }) => id === labelId), inverse.labelAfter) ||
        !recordMatches(project.shards.comments.find(({ id }) => id === commentId), inverse.commentAfter) ||
        !recordMatches(project.shards.evidence.find(({ id }) => id === inverse.evidence.id), inverse.evidence))
        throw new Error("Cannot undo an annotation whose records changed after saving.");
    const allowed = new Set([`labels:${labelId}`, `comments:${commentId}`]);
    if (evidenceReferences(project.shards, inverse.evidence.id).some((reference) => !allowed.has(reference)))
        throw new Error("Cannot undo annotation evidence referenced by another record.");
    return {
        manifest: manifestWithoutShards(project.manifest),
        shards: {
            ...project.shards,
            labels: [
                ...project.shards.labels.filter(({ id }) => id !== labelId),
                ...(inverse.labelBefore ? [inverse.labelBefore] : []),
            ],
            comments: [
                ...project.shards.comments.filter(({ id }) => id !== commentId),
                ...(inverse.commentBefore ? [inverse.commentBefore] : []),
            ],
            evidence: project.shards.evidence.filter(({ id }) => id !== inverse.evidence.id),
        },
    };
};
/**
 * Resolves complete evidence records, reverse references, and related persisted conflicts for one
 * stable project record. This is target-neutral and performs no mapper/address inference.
 * @param {AnalysisProjectShards} shards Validated native project records.
 * @param {keyof AnalysisProjectShards} shard Shard containing the requested record.
 * @param {string} recordId Stable record id to explain.
 * @returns {ProjectEvidenceExplanation} Direct provenance, reverse links, and related conflicts.
 */
export const explainProjectEvidence = (shards, shard, recordId) => {
    const records = shards[shard];
    const record = records.find(({ id }) => id === recordId);
    if (!record)
        throw new Error(`Analysis ${shard} record '${recordId}' does not exist.`);
    let evidenceIds = [];
    if (shard === "evidence")
        evidenceIds = [record.id];
    else if ("evidence" in record)
        evidenceIds = record.evidence;
    const evidence = evidenceIds.map((id) => {
        const found = shards.evidence.find((entry) => entry.id === id);
        if (!found)
            throw new Error(`Analysis record '${recordId}' refers to missing evidence '${id}'.`);
        return found;
    });
    const referencedBy = sortedUnique(evidenceIds.flatMap((id) => evidenceReferences(shards, id)));
    const evidenceSet = new Set(evidenceIds);
    const conflicts = shards.analysis
        .filter((entry) => entry.kind === "conflict" &&
        (entry.id === recordId ||
            entry.nodes.includes(recordId) ||
            entry.evidence.some((id) => evidenceSet.has(id))))
        .sort((left, right) => left.id.localeCompare(right.id));
    return { shard, record, evidence, referencedBy, conflicts };
};
//# sourceMappingURL=project-edit.js.map