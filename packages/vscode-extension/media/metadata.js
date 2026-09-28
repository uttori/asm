/* Native metadata stays in the worker. This view retains only its page and editable draft. */
const vscode = acquireVsCodeApi();
const element = (id) => document.getElementById(id);
let page;
let selected;
let anchor;
let offset = 0;
let map;
let mapSymbol;
let mapEntryIndex = -1;
let mapEntryCollection;
let mapEntryDirty = false;
let busy = false;
let afterIdle;
let dirty = false;
let renderedCollection;
let draftTimer;
const controls = new Map();
const isMap = () => element("collection").value.endsWith(".json");
const status = (text, error = false) => {
  element("status").textContent = text;
  element("status").className = error ? "error" : "";
};
const send = (message) => {
  if (busy) {
    return;
  }
  if (["preview", "map-preview", "save"].includes(message.type)) {
    clearTimeout(draftTimer);
    persistDraft();
  }
  busy = true;
  // Keep a pending save/read from replacing text typed into the same form while it is in flight.
  element("native").inert = true;
  element("map").inert = true;
  element("collection").disabled = true;
  vscode.postMessage(message);
};
const snapshotDraft = () => ({
  collection: renderedCollection ?? element("collection").value,
  fields: readDraftText(),
  selected,
  anchor,
  map,
  mapText: element("map-text").value,
  mapEntry: element("map-entry").value,
  mapEntryCollection,
  mapEntryIndex,
  mapEntryDirty,
});
const persistDraft = () => {
  const draft = snapshotDraft();
  vscode.setState(draft);
  vscode.postMessage({ type: "draft-save", draft });
};
const invalidate = () => {
  dirty = true;
  element("save").disabled = true;
  vscode.postMessage({ type: "invalidate" });
  clearTimeout(draftTimer);
  draftTimer = setTimeout(persistDraft, 200);
};
const recoverForm = (draft) => {
  if (!draft) {
    return;
  }
  element("collection").value = draft.collection;
  renderedCollection = draft.collection;
  selected = draft.selected;
  anchor = draft.anchor;
  element("native").hidden = isMap();
  element("map").hidden = !isMap();
  if (isMap()) {
    map = draft.map;
    element("map-text").value = draft.mapText;
    try {
      renderMapCollections();
      if (draft.mapEntryCollection) {
        element("map-collection").value = draft.mapEntryCollection;
        renderMapEntries();
        element("map-entries").value = String(draft.mapEntryIndex);
      }
    } catch {
      /* Raw invalid JSON remains recoverable. */
    }
    element("map-entry").value = draft.mapEntry;
    mapEntryCollection = draft.mapEntryCollection;
    mapEntryIndex = draft.mapEntryIndex;
    mapEntryDirty = draft.mapEntryDirty;
    try {
      renderMapFields();
    } catch {
      element("map-fields").replaceChildren();
    }
  } else {
    render(selected);
    for (const [name, value] of Object.entries(draft.fields ?? {})) {
      const control = controls.get(name);
      if (!control) {
        continue;
      }
      if (control.type === "checkbox") {
        control.checked = value;
      } else {
        control.value = value;
      }
    }
  }
  dirty = true;
};
const readDraftText = () =>
  Object.fromEntries(
    [...controls].map(([key, input]) => [
      key,
      input.type === "checkbox" ? input.checked : input.value,
    ]),
  );
const hex = (value) => "$" + (value ?? 0).toString(16).toUpperCase();
const number = (value) => {
  const text = String(value).trim();
  if (!/^(?:\$[\da-f]+|\d+)$/i.test(text)) {
    throw new Error("Enter a nonnegative decimal integer or $hex address.");
  }
  const n = text.startsWith("$") ? Number.parseInt(text.slice(1), 16) : Number(text);
  if (!text || !Number.isSafeInteger(n) || n < 0) {
    throw new Error("Enter a nonnegative integer or $hex address.");
  }
  return n;
};
const field = (name, title, value, options) => {
  const label = document.createElement("label");
  label.textContent = title;
  let input;
  if (Array.isArray(options)) {
    input = document.createElement("select");
    for (const [value, text] of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      input.append(option);
    }
  } else if (options === "text") {
    input = document.createElement("textarea");
    input.rows = 4;
    label.className = "wide";
  } else {
    input = document.createElement("input");
    input.type = options === "check" ? "checkbox" : "text";
  }
  if (options === "check") {
    input.checked = Boolean(value);
  } else {
    input.value = value ?? "";
  }
  input.id = "field-" + name;
  input.addEventListener("input", invalidate);
  label.append(input);
  element("fields").append(label);
  controls.set(name, input);
};
const render = (record) => {
  renderedCollection = element("collection").value;
  selected = record;
  controls.clear();
  element("fields").replaceChildren();
  element("save").disabled = true;
  const shard = element("collection").value;
  const value = record ?? {};
  field("id", "Stable record ID", value.id ?? "");
  controls.get("id").readOnly = Boolean(record);
  field(
    "addressSpace",
    "Address space",
    value.addressSpace ?? anchor?.addressSpace ?? page?.addressSpaces[0]?.id,
    page?.addressSpaces.map(({ id, name }) => [id, `${name} (${id})`]) ?? [],
  );
  if (shard === "labels") {
    field("name", "Native name (original imported spelling)", value.name ?? "");
    field(
      "sourceName",
      "Assembly name (blank uses the generated spelling)",
      value.sourceName ?? "",
    );
    field("comment", "Comment above the label", value.comment, "text");
    field("inlineComment", "Comment beside the label", value.inlineComment);
    field("suppressed", "Suppress the name", value.suppressed, "check");
    let entryPolicy = "false";
    if (record) {
      entryPolicy = "";
    }
    if (value.analysisEntryPoint !== undefined) {
      entryPolicy = String(value.analysisEntryPoint);
    }
    field("analysisEntryPoint", "Analysis entry-point policy", entryPolicy, [
      ["", "Keep legacy behavior"],
      ["true", "Use as entry point"],
      ["false", "Presentation only"],
    ]);
  } else if (shard === "comments") {
    field("text", "Comment", value.text, "text");
    field("placement", "Placement", value.placement ?? "before", [
      ["before", "Standalone, before this address"],
      ["inline-instruction", "Beside an accepted instruction"],
    ]);
  } else if (shard === "annotations") {
    const kinds = [
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
    field(
      "classification",
      "Classification",
      value.classification ?? "data8",
      kinds.map((name) => [name, name]),
    );
    field("architecture", "Architecture", value.architecture ?? "snes.65816");
    field("start", "Start (inclusive)", hex(value.start ?? anchor?.address));
    field("end", "End (exclusive)", hex(value.end ?? anchor?.end ?? (anchor?.address ?? 0) + 1));
    for (const flag of ["e", "m", "x", "carry"]) {
      field(
        flag,
        `CPU ${flag} (M/X true = 8-bit)`,
        value.state?.[flag] === undefined ? "" : String(value.state[flag]),
        [
          ["", "No saved hint"],
          ["true", "true"],
          ["false", "false"],
        ],
      );
    }
    for (const key of ["programBank", "dataBank", "directPage", "stackPointer"]) {
      field(
        key,
        `CPU ${key} (blank clears hint)`,
        value.state?.[key] === undefined ? "" : hex(value.state[key]),
      );
    }
    for (const point of ["in", "out", "end", "read"]) {
      field("point-" + point, `Point: ${point}`, value.points?.includes(point), "check");
    }
  } else if (shard === "analysis") {
    field("kind", "Target record", value.kind ?? "target-override", [
      ["target-override", "Indirect control-flow targets"],
      ["target-set", "Named entry-point set"],
    ]);
    field("name", "Target set name", value.name ?? "");
    field(
      "targets",
      "Complete target set, one address per line",
      value.targets?.map(hex).join("\n") ?? "",
      "text",
    );
  }
  if (shard !== "annotations") {
    field("address", "Anchor address", hex(value.address ?? anchor?.address));
  }
  element("removal").hidden = shard !== "labels";
  element("reset").hidden = shard !== "labels";
  element("split-control").hidden = shard !== "annotations";
};
const request = (operations, description) =>
  send({ type: "preview", request: { operations, description } });
// Empty optional controls remove saved hints; omitted fields are never silently merged back.
const record = () => {
  const result = { ...selected, ...readDraftText() };
  const shard = element("collection").value;
  result.id = result.id.trim() || `manual:${crypto.randomUUID()}`;
  result.evidence = selected?.evidence ?? [];
  if (shard === "annotations") {
    result.start = number(result.start);
    result.end = number(result.end);
    const state = {};
    for (const key of ["e", "m", "x", "carry"]) {
      if (result[key] !== "") {
        state[key] = result[key] === "true";
      }
      delete result[key];
    }
    for (const key of ["programBank", "dataBank", "directPage", "stackPointer"]) {
      if (result[key] !== "") {
        state[key] = number(result[key]);
      }
      delete result[key];
    }
    result.state = state;
    if (!Object.keys(state).length && !selected?.state) {
      delete result.state;
    }
    result.points = [];
    for (const key of ["in", "out", "end", "read"]) {
      if (result["point-" + key]) {
        result.points.push(key);
      }
      delete result["point-" + key];
    }
    if (!result.points.length && !selected?.points) {
      delete result.points;
    }
  } else {
    result.address = number(result.address);
    if (shard === "labels") {
      for (const key of ["comment", "inlineComment"]) {
        if (!result[key]) {
          delete result[key];
        }
      }
      if (!result.suppressed) {
        delete result.suppressed;
      }
      if (!result.sourceName) {
        delete result.sourceName;
      }
      if (result.analysisEntryPoint === "") {
        delete result.analysisEntryPoint;
      } else {
        result.analysisEntryPoint = result.analysisEntryPoint === "true";
      }
    } else if (shard === "analysis") {
      result.targets = result.targets
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(number);
      if (result.kind === "target-set") {
        delete result.address;
      } else {
        delete result.name;
      }
    }
  }
  return result;
};
const attempt = (fn) => {
  try {
    fn();
  } catch (error) {
    status(String(error), true);
  }
};
const load = () => {
  if (isMap()) {
    element("native").hidden = true;
    element("map").hidden = false;
    send({
      type: "map-read",
      map: { name: element("collection").value, text: "", beforeSha256: "" },
    });
  } else {
    element("native").hidden = false;
    element("map").hidden = true;
    send({
      type: "list",
      shard: element("collection").value,
      query: element("query").value,
      offset,
    });
  }
};
const leaveDraft = () => {
  clearTimeout(draftTimer);
  if (dirty) {
    persistDraft();
  }
  vscode.postMessage({ type: "draft-new" });
  dirty = false;
};
element("collection").addEventListener("change", () => {
  leaveDraft();
  offset = 0;
  load();
});
element("reload").addEventListener("click", load);
element("search").addEventListener("click", () => {
  offset = 0;
  load();
});
element("previous").addEventListener("click", () => {
  offset = Math.max(0, offset - 100);
  load();
});
element("next").addEventListener("click", () => {
  offset += 100;
  load();
});
element("records").addEventListener("change", () => {
  leaveDraft();
  render(page.records.find(({ id }) => id === element("records").value));
});
element("new").addEventListener("click", () => {
  leaveDraft();
  render(undefined);
});
element("preview").addEventListener("click", () =>
  attempt(() => {
    if (isMap()) {
      if (mapEntryDirty) {
        throw new Error("Apply the selected entry to the map draft before previewing.");
      }
      send({
        type: "map-preview",
        map: { name: map.name, beforeSha256: map.sha256, text: element("map-text").value },
      });
    } else {
      request(
        [{ kind: "put", shard: element("collection").value, record: record() }],
        "Save " + element("collection").value + " metadata",
      );
    }
  }),
);
element("remove").addEventListener("click", () =>
  attempt(() => {
    if (!selected) {
      throw new Error("Select a saved record to remove.");
    }
    const shard = element("collection").value;
    if (shard === "labels") {
      request(
        [
          {
            kind: "remove-label",
            id: selected.id,
            preserveComments: element("keep-comments").checked,
            preserveEntryPoint: element("keep-seed").checked,
          },
        ],
        "Remove label name; preserve selected metadata",
      );
    } else {
      request([{ kind: "remove", shard, id: selected.id }], "Remove " + shard + " record");
    }
  }),
);
element("reset").addEventListener("click", () =>
  attempt(() => {
    if (!selected) {
      throw new Error("Select a saved label.");
    }
    request(
      [{ kind: "reset-label", id: selected.id }],
      "Reset label to its original naming policy",
    );
  }),
);
element("split").addEventListener("click", () =>
  attempt(() => {
    if (!selected) {
      throw new Error("Select a saved classification.");
    }
    const at = number(element("split-at").value);
    request(
      [
        {
          kind: "split-classification",
          id: selected.id,
          at,
          rightId: `manual:${crypto.randomUUID()}`,
        },
      ],
      "Split classification at the selected address",
    );
  }),
);
element("restore").addEventListener("click", () =>
  attempt(() => {
    const receiptId = element("history").value;
    if (!receiptId) {
      throw new Error("Choose a saved receipt.");
    }
    request([{ kind: "restore", receiptId }], "Restore saved metadata edit");
  }),
);
element("save").addEventListener("click", () => send({ type: "save" }));
element("regenerate").addEventListener("click", () => send({ type: "regenerate" }));
element("map-text").addEventListener("input", () => {
  invalidate();
  // Invalid intermediate JSON is a valid draft; leave the entry editor untouched until parseable.
  try {
    if (!mapEntryDirty) {
      if (element("map-collection").options.length) {
        renderMapEntries();
      } else {
        renderMapCollections();
      }
    }
  } catch {
    /* Preserve the user's raw text. */
  }
});
element("map-history").addEventListener("click", () => send({ type: "map-history" }));
window.addEventListener("message", ({ data }) => {
  if (data.type === "idle") {
    busy = false;
    element("native").inert = false;
    element("map").inert = false;
    element("collection").disabled = false;
    const next = afterIdle;
    afterIdle = undefined;
    next?.();
    return;
  }
  if (data.type === "page") {
    const retained = dirty && renderedCollection === data.shard ? snapshotDraft() : undefined;
    page = data.page;
    if (page.selected && !page.records.some(({ id }) => id === page.selected.id)) {
      page.records.unshift(page.selected);
    }
    anchor = data.anchor;
    element("collection").value = data.shard;
    element("records").replaceChildren();
    for (const entry of page.records) {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = `${entry.sourceName ?? entry.name ?? entry.classification ?? entry.kind ?? entry.text?.slice(0, 50) ?? entry.id} · ${entry.id}${entry.suppressed ? " (name removed)" : ""}`;
      element("records").append(option);
    }
    element("count").textContent = `${page.total} matching records`;
    element("history").replaceChildren();
    for (const receipt of page.history) {
      const option = document.createElement("option");
      option.value = receipt.id;
      option.textContent = `${receipt.sequence}: ${receipt.description}`;
      element("history").append(option);
    }
    render(page.selected ?? (data.anchor ? undefined : page.records[0]));
    status("Loaded saved metadata. Changes require preview before save.");
    if (retained) {
      recoverForm(retained);
      element("review").textContent =
        "Current saved records for comparison:\n" + JSON.stringify(page.records, null, 2);
      status(
        "Current metadata loaded; your draft text is retained. Compare saved records below and preview again.",
      );
    }
    if (data.history) {
      element("history-title").parentElement.open = true;
      element("history").focus();
      status(
        "Choose a persisted receipt to undo. Restoring its inverse receipt redoes the edit. Source regeneration remains pending after Save.",
      );
    }
    if (page.selected) {
      element("records").value = page.selected.id;
    }
    if (data.initialAction) {
      afterIdle = () => {
        if (data.generatedSuppression) {
          request(
            [{ kind: "put", shard: "labels", record: data.generatedSuppression }],
            "Suppress generated function name without changing code discovery",
          );
        } else {
          element(data.initialAction === "remove-label" ? "remove" : "reset").click();
        }
      };
    }
    if (data.mapName) {
      afterIdle = () => {
        mapSymbol = data.mapSymbol;
        element("collection").value = data.mapName;
        load();
      };
    }
  } else if (data.type === "map") {
    const retained = dirty && renderedCollection === data.result.name ? snapshotDraft() : undefined;
    map = data.result;
    renderedCollection = map.name;
    if (page) {
      page.revision = map.revision;
    }
    mapEntryDirty = false;
    element("map-text").value = map.text;
    mapEntryCollection = undefined;
    element("save").disabled = true;
    status("Loaded user-owned map. Edit the input and preview its validation.");
    attempt(renderMapCollections);
    if (retained) {
      recoverForm(retained);
      map = data.result;
      element("review").textContent = "Current saved map for comparison:\n" + map.text;
      status("Current map loaded; draft text retained. Compare below, then preview again.");
    }
  } else if (data.type === "review") {
    element("review").textContent = JSON.stringify(data.result, null, 2);
    element("save").disabled = false;
    element("save").textContent = "Save reviewed change";
    status("Review the exact change, then save.");
  } else if (data.type === "saved") {
    dirty = false;
    vscode.setState(undefined);
    element("save").disabled = true;
    element("review").textContent = JSON.stringify(data.result, null, 2);
    status(data.result.status);
    if (data.result.revision) {
      page.revision = data.result.revision;
    }
    if (data.result.receipt?.changes) {
      for (const change of data.result.receipt.changes) {
        if (change.shard !== element("collection").value) {
          continue;
        }
        page.records = page.records.filter((entry) => entry.id !== change.id);
        if (change.after) {
          page.records.push(change.after);
        }
        if (selected?.id === change.id || !selected) {
          render(change.after);
        }
      }
      element("records").replaceChildren();
      for (const entry of page.records) {
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = `${entry.sourceName ?? entry.name ?? entry.classification ?? entry.kind ?? entry.id} · ${entry.id}${entry.suppressed ? " (name removed)" : ""}`;
        element("records").append(option);
      }
      element("records").value = selected?.id ?? "";
      const receipt = data.result.receipt;
      const option = document.createElement("option");
      option.value = receipt.id;
      option.textContent = `${receipt.sequence}: ${receipt.description}`;
      element("history").prepend(option);
    }
    if (data.result.sha256 && map) {
      map.sha256 = data.result.sha256;
      if (data.result.receipt?.after !== undefined) {
        map.name = data.result.receipt.name;
        element("collection").value = map.name;
        const empty =
          map.name === "ram-map.json"
            ? { format: "uttori-asm-snes-ram-map", schemaVersion: 1, variables: [] }
            : {
                format: "uttori-asm-snes-struct-map",
                schemaVersion: 1,
                structures: [],
                bindings: [],
                constants: [],
              };
        element("map-text").value = data.result.receipt.after ?? JSON.stringify(empty, null, 2);
        mapEntryDirty = false;
        renderMapCollections();
      }
    }
  } else if (data.type === "error") {
    element("save").disabled = true;
    status(data.text, true);
    element("save").disabled = !data.retry;
    element("save").textContent = data.retry ? "Reconcile save outcome" : "Save reviewed change";
  } else if (data.type === "drafts") {
    element("drafts").replaceChildren();
    for (const draft of data.drafts.filter((item) => !item.value.saved)) {
      const option = document.createElement("option");
      option.value = draft.id;
      option.textContent = `${draft.savedAt} · ${draft.value.form?.collection ?? "reviewed edit"}`;
      element("drafts").append(option);
    }
    if (element("drafts").options.length) {
      element("recovery").open = true;
    }
  } else if (data.type === "recovered-draft") {
    recoverForm(data.form);
    element("save").disabled = !data.reviewed;
    status(
      "Draft recovered with its original revision. Reload to compare current records, or retry the exact reviewed save to reconcile its outcome.",
    );
  } else if (data.type === "operation-history") {
    element("operation-outcomes").textContent = JSON.stringify(data.result, null, 2);
  } else if (data.type === "status") {
    status(data.text);
  } else if (data.type === "map-history") {
    element("map-receipts").replaceChildren();
    for (const receipt of data.result) {
      const option = document.createElement("option");
      option.value = receipt.id;
      option.textContent = `${receipt.createdAt}: ${receipt.name} (${receipt.status})`;
      element("map-receipts").append(option);
    }
  }
});

element("fields").addEventListener("submit", (event) => event.preventDefault());

// Entry editing changes only the retained JSON draft. The worker validates the complete map and
// its cross-file dependencies before any bytes are published.
const renderMapCollections = () => {
  const collection = element("map-collection");
  collection.replaceChildren();
  const names =
    map.name === "ram-map.json"
      ? ["variables"]
      : ["structures", "bindings", "constants", "instructionUses"];
  const document = JSON.parse(element("map-text").value);
  for (const name of names) {
    const option = window.document.createElement("option");
    option.value = name;
    option.textContent = name;
    collection.append(option);
    if (
      mapSymbol &&
      document[name]?.some((entry) =>
        [entry.name, entry.id].some(
          (name) => name && (mapSymbol === name || mapSymbol.startsWith(name + ".")),
        ),
      )
    ) {
      collection.value = name;
    }
  }
  renderMapEntries();
};
const renderMapEntries = () => {
  mapEntryCollection = element("map-collection").value;
  const entries = JSON.parse(element("map-text").value)[element("map-collection").value] ?? [];
  const select = element("map-entries");
  select.replaceChildren();
  for (const [index, entry] of entries.entries()) {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = entry.name ?? entry.id ?? `Entry ${index + 1}`;
    select.append(option);
    if (
      mapSymbol &&
      [entry.name, entry.id].some(
        (name) => name && (mapSymbol === name || mapSymbol.startsWith(name + ".")),
      )
    ) {
      select.value = String(index);
    }
  }
  mapSymbol = undefined;
  mapEntryIndex = entries.length ? Number(select.value) : -1;
  element("map-entry").value = JSON.stringify(entries[mapEntryIndex] ?? {}, null, 2);
  mapEntryDirty = false;
  renderMapFields();
};
element("map-collection").addEventListener("change", () =>
  attempt(() => {
    if (mapEntryDirty) {
      element("map-collection").value = mapEntryCollection;
      throw new Error("Apply this entry before changing collections.");
    }
    renderMapEntries();
  }),
);
element("map-entries").addEventListener("change", () =>
  attempt(() => {
    if (mapEntryDirty) {
      element("map-entries").value = String(mapEntryIndex);
      throw new Error("Apply this entry before changing selection.");
    }
    mapEntryIndex = Number(element("map-entries").value);
    element("map-entry").value = JSON.stringify(
      JSON.parse(element("map-text").value)[element("map-collection").value][mapEntryIndex],
      null,
      2,
    );
    renderMapFields();
  }),
);
element("map-entry").addEventListener("input", () => {
  try {
    renderMapFields();
  } catch {
    /* Preserve incomplete advanced JSON until it is valid. */
  }
  mapEntryDirty = true;
  invalidate();
});
element("map-new").addEventListener("click", () =>
  attempt(() => {
    if (mapEntryDirty) {
      throw new Error("Apply this entry before creating another.");
    }
    mapEntryIndex = -1;
    const templates = {
      variables: {
        name: "NewVariable",
        address: "$7E0000",
        size: 1,
        description: "Describe this variable",
      },
      structures: {
        id: "NewLayout",
        size: 1,
        fields: [{ name: "value", offset: 0, size: 1, description: "Describe this field" }],
      },
      bindings: { name: "NewBinding", structure: "ChooseLayout", address: 0x7e0000, count: 1 },
      constants: { name: "NewConstant", value: 0, description: "Describe the value and its units" },
      instructionUses: {
        address: 0xc00000,
        expectedBytes: [],
        expression: "Choose a validated expression",
      },
    };
    element("map-entry").value = JSON.stringify(
      templates[element("map-collection").value],
      null,
      2,
    );
    renderMapFields();
    mapEntryDirty = true;
    invalidate();
  }),
);
const updateMapEntry = (remove) => {
  const input = JSON.parse(element("map-text").value);
  const key = element("map-collection").value;
  const entries = input[key] ?? [];
  if (remove) {
    if (mapEntryIndex < 0) {
      throw new Error("Choose a saved map entry.");
    }
    entries.splice(mapEntryIndex, 1);
  } else {
    const entry = JSON.parse(element("map-entry").value);
    if (mapEntryIndex < 0) {
      entries.push(entry);
    } else {
      entries[mapEntryIndex] = entry;
    }
  }
  input[key] = entries;
  element("map-text").value = JSON.stringify(input, null, 2) + "\n";
  renderMapEntries();
  invalidate();
  status("Map draft changed. Preview to validate dependencies, names, and bounds.");
};
element("map-apply").addEventListener("click", () => attempt(() => updateMapEntry(false)));
element("map-remove").addEventListener("click", () => attempt(() => updateMapEntry(true)));
element("map-restore").addEventListener("click", () =>
  attempt(() => {
    const receiptId = element("map-receipts").value;
    if (!receiptId) {
      throw new Error("Choose a saved map receipt.");
    }
    send({ type: "map-restore-preview", receiptId });
  }),
);
element("split-at").addEventListener("input", invalidate);

vscode.postMessage({ type: "ready" });

element("recover-draft").addEventListener("click", () =>
  send({ type: "recover-draft", draftId: element("drafts").value }),
);
element("operation-history").addEventListener("click", () => send({ type: "operation-history" }));

/** Render common metadata declarations as fields, retaining unknown properties in the JSON draft. */
function renderMapFields() {
  const root = element("map-fields");
  root.replaceChildren();
  const value = JSON.parse(element("map-entry").value);
  const schemas = {
    variables: {
      name: "text",
      address: "number",
      size: "number",
      count: "number",
      stride: "number",
      description: "text",
    },
    structures: { id: "text", size: "number" },
    bindings: {
      name: "text",
      structure: "text",
      address: "number",
      fileOffset: "number",
      count: "number",
      firstIndex: "number",
    },
    constants: { name: "text", value: "number", description: "text" },
  };
  const schema = schemas[element("map-collection").value];
  if (!schema) {
    root.textContent =
      "Guarded instruction uses retain their explicit advanced JSON representation.";
    return;
  }
  const write = () => {
    element("map-entry").value = JSON.stringify(value, null, 2);
    mapEntryDirty = true;
    invalidate();
  };
  const fields = (parent, record, shape) => {
    for (const [name, type] of Object.entries(shape)) {
      const label = document.createElement("label");
      label.textContent = name;
      const input = document.createElement("input");
      input.value = record[name] ?? "";
      input.setAttribute("aria-label", name);
      input.placeholder = type === "number" ? "decimal or $hex" : "";
      input.addEventListener("input", () => {
        if (!input.value.trim()) delete record[name];
        else if (type === "number") {
          const n = Number(input.value.replace(/^\$/, "0x"));
          // Invalid intermediate text remains in the draft; backend preview supplies the precise error.
          record[name] = Number.isSafeInteger(n) ? n : input.value;
        } else record[name] = input.value;
        write();
      });
      label.append(input);
      parent.append(label);
    }
  };
  fields(root, value, schema);
  if (element("map-collection").value === "structures") {
    const legend = document.createElement("h3");
    legend.textContent = "Structure fields";
    root.append(legend);
    for (const [index, field] of (value.fields ?? []).entries()) {
      const row = document.createElement("fieldset");
      const title = document.createElement("legend");
      title.textContent = `Field ${index + 1}`;
      row.append(title);
      fields(row, field, {
        name: "text",
        offset: "number",
        size: "number",
        type: "text",
        description: "text",
      });
      const remove = document.createElement("button");
      remove.textContent = "Remove field";
      remove.onclick = () => {
        value.fields.splice(index, 1);
        write();
        renderMapFields();
      };
      row.append(remove);
      root.append(row);
    }
    const add = document.createElement("button");
    add.textContent = "Add field";
    add.onclick = () => {
      value.fields ??= [];
      value.fields.push({ name: "NewField", offset: 0, size: 1 });
      write();
      renderMapFields();
    };
    root.append(add);
  }
}
