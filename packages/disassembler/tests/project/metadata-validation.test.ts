import { test } from "../../../../tests/ava-helper.js";
import { validateEditableMetadataRecord } from "../../src/model/metadata-validation.js";

const record = { id: "manual.code", evidence: [], addressSpace: "snes.cpu", address: 0xc00000 };
const annotation = {
  id: "manual.code",
  evidence: [],
  addressSpace: "snes.cpu",
  architecture: "snes.65816",
  classification: "opcode",
  start: 0xc00000,
  end: 0xc00001,
};

test("editable metadata rejects malformed identities, declarations and target selectors", (t) => {
  for (const value of [
    null,
    [],
    {},
    { ...record, id: "bad id" },
    { ...record, evidence: [1] },
    { ...record, mapping: {} },
    { ...record, address: -1 },
    { ...record, addressSpace: 1 },
    { ...record, name: "" },
    { ...record, name: "Code", kind: "other" },
    { ...record, name: "Code", sourceName: 1 },
  ]) {
    t.throws(() => validateEditableMetadataRecord("labels", value));
  }
  for (const text of [null, "", " ", "a\0b"]) {
    t.throws(() => validateEditableMetadataRecord("comments", { ...record, text }), {
      message: /nonempty/,
    });
  }
  for (const value of [
    { ...record, kind: "other", targets: [] },
    { ...record, kind: "target-set", name: "", targets: [] },
    { ...record, kind: "target-set", name: "Targets", targets: [-1] },
    { ...record, kind: "target-set", name: "Targets", targets: [0.5] },
    { ...record, kind: "target-set", name: "Targets", targets: [], mapping: { fileOffset: 0 } },
    { ...record, kind: "target-override", address: undefined, targets: [] },
    {
      id: record.id,
      evidence: [],
      addressSpace: record.addressSpace,
      kind: "target-override",
      targets: [],
    },
  ]) {
    t.throws(() => validateEditableMetadataRecord("analysis", value));
  }
  t.notThrows(() =>
    validateEditableMetadataRecord("labels", {
      ...record,
      name: "Code",
      sourceName: "Source_Code",
    }),
  );
  t.notThrows(() => validateEditableMetadataRecord("comments", { ...record, text: "Known entry" }));
  t.notThrows(() =>
    validateEditableMetadataRecord("analysis", {
      ...record,
      kind: "target-set",
      name: "Targets",
      targets: [],
      mapping: { state: { bank: 0 } },
    }),
  );
});

test("editable CPU assumptions reject invalid widths and annotation entry points", (t) => {
  for (const change of [
    { classification: "other" },
    { architecture: "" },
    { start: -1 },
    { end: annotation.start },
    { state: "invalid" },
    { state: [true] },
    { state: { unknown: 1 } },
    { points: [1] },
    { points: ["unknown"] },
  ]) {
    t.throws(() => validateEditableMetadataRecord("annotations", { ...annotation, ...change }));
  }
  for (const field of ["e", "m", "x", "carry"]) {
    t.throws(
      () => validateEditableMetadataRecord("annotations", { ...annotation, state: { [field]: 1 } }),
      { message: /true or false/ },
    );
  }
  for (const [field, maximum] of [
    ["programBank", 255],
    ["dataBank", 255],
    ["directPage", 65535],
    ["stackPointer", 65535],
  ] as const) {
    for (const value of [-1, maximum + 1, 0.5, "0"]) {
      t.throws(
        () =>
          validateEditableMetadataRecord("annotations", {
            ...annotation,
            state: { [field]: value },
          }),
        { message: /Invalid state/ },
      );
    }
    t.notThrows(() =>
      validateEditableMetadataRecord("annotations", {
        ...annotation,
        state: { [field]: maximum },
        points: ["in", "out", "end", "read"],
      }),
    );
  }
  t.throws(() => validateEditableMetadataRecord("annotations", { ...annotation, state: 0 }), {
    message: /register map/,
  });
});
