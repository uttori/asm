import path from "node:path";

import type { SourceResearchResult } from "@uttori/asm-cli/source";
import {
  isResearchMapping,
  type ResearchMapping,
  type IntervalAnnotation,
  type ResearchAnalysisChange,
  type ResearchAnalysisRecord,
} from "@uttori/asm-disassembler";
import { Uri, window, workspace } from "vscode";

import type { SourceProcessClient } from "./process-client.js";
import { editSourceResearch, type ResearchEditorContext } from "./research-editor.js";

type AnalysisSelection = Extract<SourceResearchResult, { kind: "analysis" }>;

/** Evidence-view context narrows the picker without treating observations as editable declarations. */
export interface AnalysisResearchHint {
  readonly action: "classification" | "state" | "targets";
  readonly ids: readonly string[];
  /** Original file offsets from the ROM coverage map; never reuse these as CPU addresses. */
  readonly range?: { start: number; end: number };
}

/** Accept assembly-style hexadecimal or explicit decimal; never silently treat an invalid address as zero. */
export function parseResearchAddress(text: string): number | undefined {
  const value = text.trim();
  if (!/^(?:\$[\da-f]+|0x[\da-f]+|\d+)$/i.test(value)) {
    return undefined;
  }
  const number = Number(value.replace(/^\$/, "0x"));
  return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}

const hex = (value: number): string => `$${value.toString(16).toUpperCase()}`;

const CPU_STATE_FIELDS = [
  { label: "E · emulation mode", key: "e" },
  { label: "M · accumulator width", key: "m" },
  { label: "X · index width", key: "x" },
  { label: "Carry", key: "carry" },
  { label: "Program bank", key: "programBank" },
  { label: "Data bank", key: "dataBank" },
  { label: "Direct page", key: "directPage" },
  { label: "Stack pointer", key: "stackPointer" },
] as const;

function isFlagKey(key: string): key is "e" | "m" | "x" | "carry" {
  return key === "e" || key === "m" || key === "x" || key === "carry";
}

function isRegisterKey(
  key: string,
): key is "programBank" | "dataBank" | "directPage" | "stackPointer" {
  return (
    key === "programBank" || key === "dataBank" || key === "directPage" || key === "stackPointer"
  );
}

/** Cancellation propagates as undefined through each native picker, before any workspace edit exists. */
async function address(
  title: string,
  initial: number,
  maximum: number,
): Promise<number | undefined> {
  const text = await window.showInputBox({
    title,
    value: hex(initial),
    prompt: "Original address: $hex, 0xhex, or decimal.",
    validateInput: (value) => {
      const parsed = parseResearchAddress(value);
      return parsed === undefined || parsed > maximum
        ? `Enter an address from $0 through ${hex(maximum)}.`
        : undefined;
    },
  });
  return text === undefined ? undefined : parseResearchAddress(text);
}

/** One field at a time keeps the common CPU assumption edit small and preserves every other hint. */
async function editState(record: IntervalAnnotation): Promise<IntervalAnnotation | undefined> {
  const field = await window.showQuickPick(CPU_STATE_FIELDS, {
    title: `CPU assumption · ${record.id}`,
  });
  if (!field) {
    return undefined;
  }
  const state = { ...record.state };
  if (isFlagKey(field.key)) {
    const key = field.key;
    let labels = ["Set", "Clear"];
    if (key === "e") {
      labels = ["Emulation (8-bit M/X)", "Native"];
    } else if (key === "m" || key === "x") {
      labels = ["8-bit", "16-bit"];
    }
    const choice = await window.showQuickPick(
      [
        { label: labels[0], value: true },
        { label: labels[1], value: false },
        { label: "Unknown · remove this assumption", value: undefined },
      ],
      { title: field.label },
    );
    if (!choice) {
      return undefined;
    }
    const flag = key;
    if (choice.value === undefined) {
      delete state[flag];
    } else {
      state[flag] = choice.value;
    }
    // Hardware forces both width flags in emulation mode; record the consequence explicitly.
    if (flag === "e" && choice.value) {
      state.m = true;
      state.x = true;
    }
  } else if (isRegisterKey(field.key)) {
    const register = field.key;
    const maximum = register === "programBank" || register === "dataBank" ? 0xff : 0xffff;
    const value = await window.showInputBox({
      title: field.label,
      value: state[register] === undefined ? "" : hex(state[register]),
      prompt: `Value from $0 through ${hex(maximum)}; empty removes the assumption.`,
      validateInput: (text) => {
        const number = parseResearchAddress(text);
        return text.trim() && (number === undefined || number > maximum)
          ? "Enter a value within the register width."
          : undefined;
      },
    });
    if (value === undefined) {
      return undefined;
    }
    if (!value.trim()) {
      delete state[register];
    } else {
      state[register] = parseResearchAddress(value);
    }
  }
  return { ...record, state };
}

/** Pick a classification without dropping state, codec declarations, or original evidence. */
async function classification(record: IntervalAnnotation): Promise<IntervalAnnotation | undefined> {
  const choices: IntervalAnnotation["classification"][] = [
    "opcode",
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
    "unreached",
    "operand",
  ];
  const selected = await window.showQuickPick(
    choices.map((label) => ({
      label,
      description: label === record.classification ? "current" : undefined,
    })),
    { title: `Classification · ${hex(record.start)}–${hex(record.end)} (exclusive)` },
  );
  return selected ? { ...record, classification: selected.label } : undefined;
}

/** NES bank selection is explicit JSON so omitted mapper registers remain unknown. */
async function mappingSelection(initial?: ResearchMapping): Promise<ResearchMapping | undefined> {
  const text = await window.showInputBox({
    title: "Original NES mapper selection",
    value: initial ? JSON.stringify(initial) : "",
    prompt:
      'Use mapper state, for example {"state":{"prgMode":0,"r6":2,"r7":3}}. Optional fileOffset is headerless.',
    validateInput: (value) => {
      try {
        return isResearchMapping(JSON.parse(value))
          ? undefined
          : "Enter a nonempty mapping selector.";
      } catch {
        return "Enter a mapping selector as JSON.";
      }
    },
  });
  if (text === undefined) {
    return undefined;
  }
  const mapping: unknown = JSON.parse(text);
  if (!isResearchMapping(mapping)) {
    throw new Error("Invalid mapping selector.");
  }
  return mapping;
}

/** New records use an explicit address space and existing subject document, so ownership is visible. */
async function newRecord(
  selection: AnalysisSelection,
  kind: "range" | "targets",
  hint?: AnalysisResearchHint,
): Promise<{ path: string; value: ResearchAnalysisRecord } | undefined> {
  const document = await window.showQuickPick(
    selection.documents.map((item) => item.path),
    { title: "Research document" },
  );
  if (!document) {
    return undefined;
  }
  const spaces = selection.addressSpaces.filter(
    (item) => kind !== "range" || !hint?.range || item.kind === "file",
  );
  const space = await window.showQuickPick(
    spaces.map((item) => ({ label: item.name, description: item.id, item })),
    { title: "Original address space" },
  );
  if (!space) {
    return undefined;
  }
  const maximum = 2 ** space.item.addressBits - 1;
  const start = await address(
    kind === "range" ? "Range start" : "Indirect instruction address",
    kind === "range" ? (hint?.range?.start ?? 0) : 0,
    maximum,
  );
  if (start === undefined) {
    return undefined;
  }
  let mapping: ResearchMapping | undefined;
  if (space.item.id === "nes.cpu") {
    mapping = await mappingSelection();
    if (!mapping) {
      return undefined;
    }
  }
  const identitySuffix = mapping ? `.${Buffer.from(JSON.stringify(mapping)).toString("hex")}` : "";
  if (kind === "targets") {
    return {
      path: document,
      value: {
        id: `manual.targets.${space.item.id}.${start.toString(16)}${identitySuffix}`,
        ...(mapping ? { mapping } : {}),
        kind: "target-override",
        addressSpace: space.item.id,
        address: start,
        targets: [],
        evidence: [],
      },
    };
  }
  const end = await address("Range end (exclusive)", hint?.range?.end ?? start + 1, maximum + 1);
  if (end === undefined) {
    return undefined;
  }
  const architecture = await window.showInputBox({
    title: "Architecture",
    value: space.item.id.startsWith("nes.") ? "65xx.2a03" : "snes.65816",
    prompt: "Architecture identifier used by this range.",
    validateInput: (value) => (value.trim() ? undefined : "Enter an architecture identifier."),
  });
  if (architecture === undefined) {
    return undefined;
  }
  return {
    path: document,
    value: {
      id: `manual.range.${space.item.id}.${start.toString(16)}.${end.toString(16)}${identitySuffix}`,
      ...(mapping ? { mapping } : {}),
      addressSpace: space.item.id,
      architecture: architecture.trim(),
      start,
      end,
      classification: hint?.action === "state" ? "opcode" : "data8",
      evidence: [],
    },
  };
}

/** Native research pickers return one content-checked WorkspaceEdit; neither SQLite nor Git is mutated. */
export async function editAnalysisResearch(
  worker: SourceProcessClient,
  context: () => ResearchEditorContext | undefined,
  change?: ResearchAnalysisChange,
  hint?: AnalysisResearchHint,
): Promise<SourceResearchResult | undefined> {
  if (change) {
    return editSourceResearch(worker, context, { kind: "analysis", change });
  }
  const initial = context();
  if (!initial || !workspace.isTrusted) {
    throw new Error("Select a Git source project in a trusted workspace first.");
  }
  const selection = await worker.run<SourceResearchResult>(
    {
      action: "research",
      directory: initial.root,
      overlays: initial.buffers,
      research: { kind: "analysis" },
    },
    { maxMemoryMiB: 512 },
  );
  if (selection.kind !== "analysis") {
    throw new Error("Research service returned an invalid analysis selection.");
  }
  const relevant = selection.records.filter(
    (record) =>
      !hint ||
      ("classification" in record.value !== (hint.action === "targets") &&
        (!(hint.range ?? hint.ids.length) || hint.ids.includes(record.value.id))),
  );
  const options: {
    readonly label: string;
    readonly description: string;
    readonly detail: string;
    readonly record: (typeof relevant)[number] | undefined;
    readonly create: "range" | "targets" | undefined;
  }[] = relevant.map((record) => ({
    label: record.value.id,
    description:
      record.value.addressSpace +
      (record.value.mapping ? ` · ${JSON.stringify(record.value.mapping)}` : ""),
    detail: record.path,
    record,
    create: undefined,
  }));
  const choice =
    hint && options.length === 1
      ? options[0]
      : await window.showQuickPick(
          [
            {
              label: "Classify a Range…",
              description: "New declaration",
              detail: "Original ROM addresses; changes the next analysis and generation.",
              record: undefined,
              create: "range" as const,
            },
            {
              label: "Set Indirect Targets…",
              description: "New declaration",
              detail: "Explicit destinations for one indirect instruction.",
              record: undefined,
              create: "targets" as const,
            },
            ...options,
          ].filter(
            (item) =>
              !hint || !item.create || (item.create === "targets") === (hint.action === "targets"),
          ),
          { title: "Analysis Research", matchOnDescription: true, matchOnDetail: true },
        );
  if (!choice) {
    return undefined;
  }
  const selected = choice.create ? await newRecord(selection, choice.create, hint) : choice.record;
  if (!selected) {
    return undefined;
  }
  let record = selected.value;
  const expectedDocumentSha256 = selection.documents.find(
    (item) => item.path === selected.path,
  )!.sha256;
  if (choice.create && selection.records.some((item) => item.value.id === record.id)) {
    throw new Error(
      "This range or target already has a declaration. Select it from the research list.",
    );
  }
  let action: string = hint?.action ?? (choice.create === "range" ? "classification" : "targets");
  const rangeRecord = "classification" in record;
  if (hint && rangeRecord === (hint.action === "targets")) {
    throw new Error("This declaration does not support the requested evidence action.");
  }
  if (!choice.create && !hint) {
    const edits = "classification" in record ? ["classification", "state"] : ["targets"];
    if (record.addressSpace.startsWith("nes.")) {
      const state = edits.indexOf("state");
      if (state !== -1) {
        edits.splice(state, 1);
      }
      if (record.addressSpace === "nes.cpu") {
        edits.push("mapping");
      }
    }
    const picked = await window.showQuickPick(
      [
        ...edits.map((item) => ({
          label: item === "state" ? "Change CPU Assumption" : `Edit ${item}`,
          action: item,
        })),
        { label: "Open Declaration", action: "open" },
        {
          label: "Remove Research Override",
          action: "remove",
          detail: "Restores imported observations after saving; keeps evidence.",
        },
      ],
      { title: record.id },
    );
    if (!picked) {
      return undefined;
    }
    action = picked.action;
  }
  if (action === "open") {
    await window.showTextDocument(Uri.file(path.join(initial.root, selected.path)));
    return selection;
  }
  if (action === "remove") {
    change = {
      kind: "remove",
      expectedDocumentSha256,
      collection: "classification" in record ? "annotations" : "analysis",
      id: record.id,
    };
  } else {
    if (action === "mapping" || (action === "state" && record.addressSpace === "nes.cpu")) {
      const mapping = await mappingSelection(record.mapping);
      if (!mapping) {
        return undefined;
      }
      record = { ...record, mapping };
    } else if ("classification" in record) {
      const edited = action === "state" ? await editState(record) : await classification(record);
      if (!edited) {
        return undefined;
      }
      record = edited;
    } else {
      const targets = await window.showInputBox({
        title: `Indirect targets · ${record.id}`,
        value: record.targets.map(hex).join(", "),
        prompt: "Comma-separated original addresses. Empty records no known targets.",
        validateInput: (value) =>
          value.trim() && value.split(",").some((item) => parseResearchAddress(item) === undefined)
            ? "Enter comma-separated $hex, 0xhex or decimal addresses."
            : undefined,
      });
      if (targets === undefined) {
        return undefined;
      }
      record = {
        ...record,
        targets: targets.trim()
          ? targets.split(",").map((item) => parseResearchAddress(item)!)
          : [],
      };
    }
    const reason = await window.showInputBox({
      title: "Reason for the research decision",
      prompt: "Evidence or reasoning retained in Git beside this declaration.",
      validateInput: (value) => (value.trim() ? undefined : "Describe the evidence or reasoning."),
    });
    if (reason === undefined) {
      return undefined;
    }
    if ("classification" in record) {
      change = {
        kind: "put",
        expectedDocumentSha256,
        collection: "annotations",
        path: selected.path,
        value: record,
        reason,
      };
    } else {
      change = {
        kind: "put",
        expectedDocumentSha256,
        collection: "analysis",
        path: selected.path,
        value: record,
        reason,
      };
    }
  }
  if (context()?.root !== initial.root) {
    throw new Error("The selected source project changed. Open the research action again.");
  }
  return editSourceResearch(worker, context, { kind: "analysis", change });
}
