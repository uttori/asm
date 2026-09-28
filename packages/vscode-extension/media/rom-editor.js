/* global acquireVsCodeApi */
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const send = (type, rest = {}) => vscode.postMessage({ type, ...rest });
let project;
let manifestSha256;
let current;
let model;
let reviewed = false;
let busy = false;
let plan;
let undo = [];
let redo = [];
let page = 0;
let brush = 0;
const resolutions = {};
const clone = (value) => JSON.parse(JSON.stringify(value));
const el = (tag, text, parent) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  parent?.append(node);
  return node;
};
const button = (parent, text, action) => {
  const node = el("button", text, parent);
  node.type = "button";
  node.onclick = action;
  return node;
};
const number = (value) => {
  if (!String(value).trim()) throw new Error("Enter a number.");
  const parsed = Number(String(value).replace(/^\$/, "0x"));
  if (!Number.isSafeInteger(parsed)) throw new Error("Use a decimal or hexadecimal integer.");
  return parsed;
};
const hex = (value) => `0x${value.toString(16).toUpperCase()}`;
function status(text, error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", error);
}
/** Freeze editable content during host operations so a late saved response cannot overwrite newly typed text. */
function controls() {
  $("editor").inert = busy;
  $("placement").inert = busy;
  $("save").disabled = busy || !reviewed;
  $("preview").disabled = busy || !model;
  $("undo").disabled = busy || !undo.length;
  $("redo").disabled = busy || !redo.length;
}
/** Invalidate the previous preview before persisting the new draft; save authority remains in the host. */
function changed() {
  reviewed = false;
  plan = undefined;
  $("placement-save").disabled = true;
  send("changed");
  if (model) send("draft", { document: model });
  controls();
  vscode.setState({
    id: current?.entry.id,
    model,
    manifestSha256,
    inputSha256: current?.inputSha256,
  });
}
/** Bound local undo history; durable recovery is handled separately by the host. */
function checkpoint() {
  undo.push(clone(model));
  if (undo.length > 30) undo.shift();
  redo = [];
}
/** Keep numeric validation ahead of model mutation so typed arrays never wrap invalid values. */
function field(parent, label, value, min, max, change) {
  const wrapper = el("label", label, parent);
  const input = el("input", undefined, wrapper);
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.onchange = () => {
    try {
      const v = number(input.value);
      if (v < min || v > max) throw new Error(`${label}: enter ${min}–${max}.`);
      checkpoint();
      change(v);
      changed();
    } catch (error) {
      input.value = String(value);
      status(String(error), true);
    }
  };
  return input;
}
/** Bound table rendering to 64 rows while preserving the complete editable model. */
function paging(parent, count, draw) {
  const toolbar = el("div", undefined, parent);
  toolbar.className = "toolbar";
  button(toolbar, "Previous", () => {
    page = Math.max(0, page - 1);
    draw();
  });
  el("span", `${page * 64 + 1}–${Math.min((page + 1) * 64, count)} of ${count}`, toolbar);
  button(toolbar, "Next", () => {
    page = Math.min(Math.max(0, Math.ceil(count / 64) - 1), page + 1);
    draw();
  });
}
/** Dispatch by the host-resolved input kind; the view cannot change ownership or codec recipes. */
function renderEditor() {
  const root = $("editor");
  root.replaceChildren();
  if (!model) return;
  if (model.kind === "assembly") {
    const label = el("label", "Owned assembly", root);
    const text = el("textarea", undefined, label);
    text.value = model.text;
    text.spellcheck = false;
    text.oninput = () => {
      checkpoint();
      model.text = text.value;
      changed();
    };
  } else if (model.kind === "indexed") renderPixels(root);
  else if (model.kind === "bytes") renderBytes(root);
  else renderNative(root);
  controls();
}
/** Paint palette indexes without quantization; duplicate RGB colors remain distinct selectable slots. */
function renderPixels(root) {
  el(
    "p",
    `${model.width} × ${model.height} indexed pixels. Select a palette slot, then click pixels to paint.`,
    root,
  );
  const swatches = el("div", undefined, root);
  swatches.className = "swatches";
  model.palette.forEach((rgba, index) => {
    const b = button(swatches, `${index}`, () => {
      brush = index;
      renderEditor();
    });
    b.setAttribute("aria-pressed", String(brush === index));
    const swatch = el("canvas", undefined, b);
    swatch.width = 22;
    swatch.height = 22;
    const ctx = swatch.getContext("2d");
    ctx.fillStyle = `rgb(${rgba.slice(0, 3).join(",")})`;
    ctx.fillRect(0, 0, 22, 22);
    b.title = `Palette slot ${index}: ${rgba.join(", ")}`;
  });
  // A bounded viewport preserves large sheets without allocating an enormous zoomed canvas.
  const tileRows = Math.ceil(model.height / 64);
  page = Math.min(page, tileRows - 1);
  const startY = page * 64;
  const height = Math.min(64, model.height - startY);
  const scale = Math.max(1, Math.min(8, Math.floor(1000 / model.width)));
  const canvas = el("canvas", undefined, root);
  canvas.width = model.width * scale;
  canvas.height = height * scale;
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    "Indexed pixel canvas; numeric pixel fields below provide keyboard editing",
  );
  const ctx = canvas.getContext("2d");
  for (let y = 0; y < height; y++)
    for (let x = 0; x < model.width; x++) {
      const rgba = model.palette[model.values[(startY + y) * model.width + x]];
      ctx.fillStyle = `rgb(${rgba.slice(0, 3).join(",")})`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  canvas.onclick = (event) => {
    const bounds = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - bounds.left) * model.width) / bounds.width);
    const y = Math.floor(((event.clientY - bounds.top) * height) / bounds.height) + startY;
    if (x < 0 || x >= model.width || y >= model.height) return;
    checkpoint();
    model.values[y * model.width + x] = brush;
    changed();
    renderEditor();
  };
  const toolbar = el("div", undefined, root);
  button(toolbar, "Previous rows", () => {
    page = Math.max(0, page - 1);
    renderEditor();
  });
  el("span", ` Rows ${startY}–${startY + height - 1} `, toolbar);
  button(toolbar, "Next rows", () => {
    page = Math.min(tileRows - 1, page + 1);
    renderEditor();
  });
  let px = 0;
  let py = startY;
  let slot = brush;
  field(root, "Pixel X", px, 0, model.width - 1, (v) => {
    px = v;
  });
  field(root, "Pixel Y", py, 0, model.height - 1, (v) => {
    py = v;
  });
  field(root, "Slot", slot, 0, model.palette.length - 1, (v) => {
    slot = v;
  });
  button(root, "Set pixel", () => {
    checkpoint();
    model.values[py * model.width + px] = slot;
    changed();
    renderEditor();
  });
}
let wordWidth = 1;
/** Interpret an explicitly chosen little-endian width without inferring a schema or changing the allocation. */
function renderBytes(root) {
  const label = el("label", "Table encoding (little-endian)", root);
  const select = el("select", undefined, label);
  [1, 2, 3, 4].forEach((width) => {
    const option = el("option", `uint${width * 8}`, select);
    option.value = width;
  });
  select.value = wordWidth;
  select.onchange = () => {
    wordWidth = Number(select.value);
    page = 0;
    renderEditor();
  };
  el(
    "p",
    "Choose the field width explicitly. This changes the editor view, not the table schema.",
    root,
  );
  const count = Math.ceil(model.values.length / wordWidth);
  paging(root, count, renderEditor);
  const table = el("table", undefined, root);
  const header = el("tr", undefined, table);
  ["ROM offset", "Original", "Edited"].forEach((s) => el("th", s, header));
  const original = current.entry.expected.match(/../g).map((v) => parseInt(v, 16));
  for (let n = page * 64; n < Math.min(count, (page + 1) * 64); n++) {
    const offset = n * wordWidth;
    const width = Math.min(wordWidth, model.values.length - offset);
    const read = (values) =>
      values.slice(offset, offset + width).reduce((sum, v, i) => sum + v * 2 ** (8 * i), 0);
    const row = el("tr", undefined, table);
    el("td", hex(current.entry.offset + offset), row);
    el("td", String(read(original)), row);
    field(
      el("td", undefined, row),
      `uint${width * 8}`,
      read(model.values),
      0,
      2 ** (width * 8) - 1,
      (value) => {
        for (let i = 0; i < width; i++)
          model.values[offset + i] = Math.floor(value / 2 ** (8 * i)) & 255;
      },
    );
  }
}
/** Expose native palette and map fields; unsupported plugin models keep their external source workflow. */
function renderNative(root) {
  const native = model.value;
  const formats = {
    "snes-palette-bgr555": {
      key: "colors",
      fields: { red: 31, green: 31, blue: 31, unusedHighBit: 1 },
    },
    "snes-bg-tilemap": {
      key: "entries",
      fields: { tile: 1023, palette: 7, priority: 1, horizontalFlip: 1, verticalFlip: 1 },
    },
    "snes-mode7-tilemap": { key: "indexes", fields: { index: 255 } },
  };
  const format = formats[native.kind];
  if (!format) {
    el(
      "p",
      "This plugin model has no visual field schema. Use Open owned source or your external editor.",
      root,
    );
    return;
  }
  const rows = native[format.key];
  paging(root, rows.length, renderEditor);
  if (format.key === "entries" || format.key === "indexes") {
    el(
      "p",
      "Cells are in native storage order; no game-specific map layout is inferred. Select a cell below to edit its tile and attributes.",
      root,
    );
    const grid = el("div", undefined, root);
    grid.className = "swatches";
    rows
      .slice(page * 64, (page + 1) * 64)
      .forEach((entry, n) =>
        button(grid, String(entry.tile ?? entry), () =>
          document
            .getElementById(`native-row-${page * 64 + n}`)
            ?.scrollIntoView({ block: "center" }),
        ),
      );
  }
  const table = el("table", undefined, root);
  const header = el("tr", undefined, table);
  ["Index", ...Object.keys(format.fields)].forEach((s) => el("th", s, header));
  for (let i = page * 64; i < Math.min(rows.length, (page + 1) * 64); i++) {
    const row = el("tr", undefined, table);
    row.id = `native-row-${i}`;
    const name = el("td", String(i), row);
    if (format.key === "colors") {
      const swatch = el("canvas", undefined, name);
      swatch.width = 32;
      swatch.height = 20;
      const color = rows[i];
      const ctx = swatch.getContext("2d");
      ctx.fillStyle = `rgb(${(color.red * 255) / 31},${(color.green * 255) / 31},${(color.blue * 255) / 31})`;
      ctx.fillRect(0, 0, 32, 20);
    }
    for (const [key, max] of Object.entries(format.fields))
      field(
        el("td", undefined, row),
        key,
        key === "index" ? rows[i] : rows[i][key],
        0,
        max,
        (v) => {
          if (key === "index") rows[i] = v;
          else rows[i][key] = v;
          if (format.key === "colors") renderEditor();
        },
      );
  }
}
/** Show owned ranges without describing unowned ROM bytes as free space. */
function renderAllocation() {
  const select = $("allocation-owner");
  select.replaceChildren();
  project.replacements.forEach((entry) => {
    const option = el("option", entry.id, select);
    option.value = entry.id;
  });
  const canvas = $("allocation-map");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#64748b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const size = project.expansion?.size ?? project.baseline.rom.contentSize;
  const ranges = $("ranges");
  ranges.replaceChildren();
  for (const entry of project.replacements) {
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(
      (entry.offset / size) * canvas.width,
      10,
      Math.max(2, (entry.expected.length / 2 / size) * canvas.width),
      50,
    );
    button(ranges, `${entry.id}: ${hex(entry.offset)} + ${entry.expected.length / 2} bytes`, () => {
      select.value = entry.id;
      select.onchange();
    });
  }
  select.onchange = () => {
    const entry = project.replacements.find((item) => item.id === select.value);
    if (!entry) return;
    const form = $("placement");
    form.elements.offset.value = hex(entry.offset);
    form.elements.size.value = entry.expected.length / 2;
    form.elements.fill.value = entry.fill ?? "";
    form.elements["expansion-size"].value = project.expansion?.size ?? "";
    form.elements["expansion-fill"].value = project.expansion?.fill ?? 255;
    plan = undefined;
    $("placement-save").disabled = true;
  };
  select.onchange();
}
$("pointer-add").onclick = () => {
  const row = el("div", undefined, $("pointers"));
  row.className = "row";
  for (const name of ["id", "offset", "width", "bank", "addend"]) {
    const label = el("label", name, row);
    const input = el("input", undefined, label);
    input.name = name;
    if (name === "width") input.value = "3";
    if (name === "addend") input.value = "0";
  }
  button(row, "Remove", () => {
    row.remove();
    changed();
  });
  changed();
};
$("placement").oninput = () => {
  plan = undefined;
  $("placement-save").disabled = true;
};
$("placement").onsubmit = (event) => {
  event.preventDefault();
  try {
    const form = event.target.elements;
    plan = {
      manifestSha256,
      replacement: $("allocation-owner").value,
      offset: number(form.offset.value),
      size: number(form.size.value),
      pointers: [...$("pointers").children].map((row) => {
        const get = (key) => row.querySelector(`[name=${key}]`).value;
        const p = {
          id: get("id"),
          offset: number(get("offset")),
          width: number(get("width")),
          addend: number(get("addend")),
        };
        if (get("bank").trim()) p.bank = number(get("bank"));
        return p;
      }),
    };
    if (form.fill.value.trim()) plan.fill = number(form.fill.value);
    if (form["expansion-size"].value.trim())
      plan.expansion = {
        size: number(form["expansion-size"].value),
        fill: number(form["expansion-fill"].value),
      };
    $("placement-review").textContent =
      `${plan.replacement}: ${hex(plan.offset)}, ${plan.size} bytes\n${plan.pointers.length} explicit pointers\n${JSON.stringify(plan, null, 2)}`;
    $("placement-save").disabled = false;
  } catch (error) {
    status(String(error), true);
  }
};
$("placement-save").onclick = () => {
  if (plan) send("allocation", { plan });
};
/** Show baseline and candidate bytes from the verified full-ROM draft, not from unchecked UI values. */
function renderReview(review) {
  const root = $("byte-review");
  root.replaceChildren();
  el("h2", "Reviewed ROM bytes", root);
  el(
    "p",
    `${review.changedBytes} changed bytes across the complete candidate ROM. Showing the first 256 bytes of this allocation.`,
    root,
  );
  const table = el("table", undefined, root);
  const header = el("tr", undefined, table);
  ["Offset", "Baseline", "Candidate"].forEach((v) => el("th", v, header));
  for (let i = 0; i < Math.min(512, review.before.length); i += 32) {
    const row = el("tr", undefined, table);
    el("td", hex(current.entry.offset + i / 2), row);
    const before = review.before.slice(i, i + 32);
    const after = review.after.slice(i, i + 32);
    el("td", before.match(/../g).join(" "), row);
    const cell = el("td", after.match(/../g).join(" "), row);
    if (before !== after) cell.className = "changed";
  }
}
/** Require an explicit choice for every conflict and display all three byte versions. */
function renderRebase(review) {
  const root = $("conflicts");
  root.replaceChildren();
  for (const key of Object.keys(resolutions)) delete resolutions[key];
  Object.assign(resolutions, review.resolutions);
  el("p", review.buildError ?? `Candidate: ${review.candidateManifest}`, root);
  if (!review.conflicts.length)
    el("p", "No conflicting replacements. Acceptance still verifies the complete candidate.", root);
  for (const conflict of review.conflicts) {
    el("h3", `${conflict.id} — ${hex(conflict.offset)}`, root);
    el("p", conflict.reason, root);
    const table = el("table", undefined, root);
    const header = el("tr", undefined, table);
    ["Original baseline", "Incoming baseline", "Owned"].forEach((v) => el("th", v, header));
    const row = el("tr", undefined, table);
    [conflict.base, conflict.incoming, conflict.owned].forEach((v) =>
      el("pre", v, el("td", undefined, row)),
    );
    const label = el("label", "Resolution", root);
    const select = el("select", undefined, label);
    for (const [value, text] of [
      ["", "Choose explicitly"],
      ["keep-owned", "Keep my owned replacement"],
      ["take-baseline", "Take incoming baseline"],
    ]) {
      const o = el("option", text, select);
      o.value = value;
    }
    select.value = resolutions[conflict.id] ?? "";
    select.onchange = () => {
      if (select.value) resolutions[conflict.id] = select.value;
      else delete resolutions[conflict.id];
    };
  }
}
document.querySelectorAll("[data-tab]").forEach(
  (node) =>
    (node.onclick = () => {
      document.querySelectorAll(".tab").forEach((tab) => {
        tab.hidden = tab.id !== node.dataset.tab;
      });
    }),
);
for (const type of ["metadata", "reload", "source", "recover", "build", "rebase-open"])
  $(type).onclick = () => send(type);
for (const type of ["rebase-save", "rebase-refresh", "rebase-accept"])
  $(type).onclick = () => send(type, { resolutions });
$("select").onclick = () => send("select", { id: $("owners").value });
$("preview").onclick = () => {
  if (model) send("preview", { document: model });
};
$("save").onclick = () => send("save");
$("undo").onclick = () => {
  if (undo.length) {
    redo.push(clone(model));
    model = undo.pop();
    changed();
    renderEditor();
  }
};
$("redo").onclick = () => {
  if (redo.length) {
    undo.push(clone(model));
    model = redo.pop();
    changed();
    renderEditor();
  }
};
window.addEventListener("message", ({ data }) => {
  if (data.type === "navigate")
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.hidden = tab.id !== data.tab;
    });
  else if (data.type === "project") {
    project = data.project;
    manifestSha256 = data.manifestSha256;
    $("project-name").textContent = data.file;
    const selectedId = $("owners").value;
    $("owners").replaceChildren();
    project.replacements.forEach((entry) => {
      const o = el("option", `${entry.id} · ${entry.kind} · ${hex(entry.offset)}`, $("owners"));
      o.value = entry.id;
    });
    if (project.replacements.some((e) => e.id === selectedId)) $("owners").value = selectedId;
    renderAllocation();
  } else if (data.type === "document") {
    current = data;
    model = clone(data.document);
    undo = [];
    redo = [];
    page = 0;
    reviewed = false;
    $("owner-info").textContent =
      `${data.entry.id} · ROM ${hex(data.entry.offset)} · ${data.entry.expected.length / 2} allocated bytes`;
    $("byte-review").replaceChildren();
    renderEditor();
    status("Loaded saved input. Preview validates the entire modified ROM before Save.");
  } else if (data.type === "review") {
    reviewed = true;
    renderReview(data.review);
    status("Candidate ROM validated. Save publishes this reviewed input version.");
  } else if (data.type === "status" || data.type === "error")
    status(data.text, data.type === "error");
  else if (data.type === "busy") {
    busy = data.value;
  } else if (data.type === "retention") renderRetention(data.inventory);
  else if (data.type === "migration") renderMigration(data.review);
  else if (data.type === "rebase") renderRebase(data.review);
  controls();
});
send("ready");

// Relocations are explicit headerless byte ranges, not guesses from matching names.
const migrationRoot = $("migration-controls");
el(
  "p",
  "Target ROM must retain the baseline mapper and copier-header format. Add explicit relocation ranges when research moved; omitted ranges keep their offsets.",
  migrationRoot,
);
const relocationsRoot = el("div", undefined, migrationRoot);
button(migrationRoot, "Add relocation", () => {
  const row = el("div", undefined, relocationsRoot);
  row.className = "row";
  for (const name of ["from", "to", "size"]) {
    const label = el("label", name, row);
    const input = el("input", undefined, label);
    input.name = name;
  }
  button(row, "Remove", () => row.remove());
});
const prepareMigration = (operation) => {
  try {
    const relocations = [...relocationsRoot.children].map((row) =>
      Object.fromEntries(
        ["from", "to", "size"].map((key) => [
          key,
          number(row.querySelector(`[name=${key}]`).value),
        ]),
      ),
    );
    send(operation, { relocations });
  } catch (error) {
    status(String(error), true);
  }
};
button(migrationRoot, "Build modified ROM & review metadata", () =>
  prepareMigration("migration-current"),
);
button(migrationRoot, "Choose another target ROM & review", () =>
  prepareMigration("migration-review"),
);
const migrationItems = el("div", undefined, migrationRoot);
/** Start every research item unselected; blocked ranges cannot be approved through the view. */
function renderMigration(review) {
  migrationItems.replaceChildren();
  el(
    "p",
    `Source revision: ${review.sourceRevision}. All selections are explicit. Excluded: ${Object.entries(
      review.excluded,
    )
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")}. Runtime history stays with the original ROM.`,
    migrationItems,
  );
  const selected = new Set();
  const toolbar = el("div", undefined, migrationItems);
  toolbar.className = "toolbar";
  const label = el("label", "Find metadata", toolbar);
  const search = el("input", undefined, label);
  search.type = "search";
  const counter = el("span", undefined, toolbar);
  const choices = el("div", undefined, migrationItems);
  choices.className = "scroll";
  let offset = 0;
  const matches = () =>
    review.items.filter((item) =>
      `${item.label} ${item.kind} ${item.status}`
        .toLowerCase()
        .includes(search.value.toLowerCase()),
    );
  const renderPage = () => {
    choices.replaceChildren();
    const filtered = matches();
    counter.textContent = `${Math.min(offset + 1, filtered.length)}–${Math.min(offset + 100, filtered.length)} of ${filtered.length}; ${selected.size} selected`;
    for (const item of filtered.slice(offset, offset + 100)) {
      const container = el("details", undefined, choices);
      const summary = el("summary", undefined, container);
      const row = el("label", undefined, summary);
      const checkbox = el("input", undefined, row);
      checkbox.type = "checkbox";
      checkbox.disabled = item.status === "blocked";
      checkbox.checked = selected.has(item.id);
      el("span", `${item.label} — ${item.kind} — ${item.status}`, row);
      checkbox.onchange = () => {
        if (checkbox.checked) selected.add(item.id);
        else selected.delete(item.id);
        counter.textContent = `${filtered.length} matching; ${selected.size} selected`;
      };
      el("p", item.reason, container);
      // Large projects contain thousands of labels. Expand before/after JSON only when requested.
      let expanded = false;
      container.ontoggle = () => {
        if (!container.open || expanded) return;
        expanded = true;
        const table = el("table", undefined, container);
        const header = el("tr", undefined, table);
        el("th", "Original", header);
        el("th", "Proposed", header);
        const values = el("tr", undefined, table);
        el("pre", JSON.stringify(item.before, null, 2), el("td", undefined, values));
        el("pre", JSON.stringify(item.after, null, 2), el("td", undefined, values));
      };
    }
  };
  button(toolbar, "Previous 100", () => {
    offset = Math.max(0, offset - 100);
    renderPage();
  });
  button(toolbar, "Next 100", () => {
    if (offset + 100 < matches().length) offset += 100;
    renderPage();
  });
  search.oninput = () => {
    offset = 0;
    renderPage();
  };
  renderPage();

  button(migrationItems, "Create verified workspace with selected metadata", () =>
    send("migration-apply", { selected: [...selected] }),
  );
}

const retentionRoot = $("retention-controls");
el(
  "p",
  "Inspect saved history and recovery drafts before cleanup. Active baselines, the last successful build, unresolved work, and pins are protected. Inputs and capture archives are never cleanup candidates.",
  retentionRoot,
);
button(retentionRoot, "Inspect storage", () => send("retention-review"));
const retentionItems = el("div", undefined, retentionRoot);
/** Keep protected artifacts visibly unselectable and make each deletion choice explicit. */
function renderRetention(inventory) {
  retentionItems.replaceChildren();
  const selected = new Set();
  el(
    "p",
    `Dependency scope: ${inventory.scope}. Pin artifacts needed by projects outside this scope. ${(inventory.totalBytes / 1048576).toFixed(2)} MiB retained; ${(inventory.eligibleBytes / 1048576).toFixed(2)} MiB eligible.`,
    retentionItems,
  );
  const table = el("table", undefined, retentionItems);
  const header = el("tr", undefined, table);
  ["Remove", "Artifact", "Size", "Protection", "Pin"].forEach((text) => el("th", text, header));
  for (const item of inventory.items) {
    const row = el("tr", undefined, table);
    const checkbox = el("input", undefined, el("td", undefined, row));
    checkbox.type = "checkbox";
    checkbox.disabled = item.protected.length > 0;
    checkbox.setAttribute("aria-label", `Select ${item.path}`);
    checkbox.onchange = () => {
      if (checkbox.checked) selected.add(item.id);
      else selected.delete(item.id);
    };
    el("td", `${item.category}: ${item.path}`, row);
    el("td", `${(item.bytes / 1048576).toFixed(2)} MiB`, row);
    el("td", item.protected.join("; ") || "Eligible after explicit selection", row);
    button(el("td", undefined, row), item.pinned ? "Unpin" : "Pin", () =>
      send("retention-pin", { id: item.id, pinned: item.pinned }),
    );
  }
  button(retentionItems, "Review deletion of selected history", () =>
    send("retention-prune", { selected: [...selected] }),
  );
}
