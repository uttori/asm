/* The text document owns every edit; webview state retains only the current selection. */
/** @typedef {import('../src/assets/palette-model.js').PaletteView} PaletteView */
/** @typedef {{id:string,index:number,filter:string}} PaletteSelection */
/** @typedef {{type:'palette',version:number,palettes:PaletteView[]} | {type:'error',text:string}} PaletteMessage */
/** @type {WebviewApi<PaletteSelection>} */
const vscode = acquireVsCodeApi();
/** Resolve a template-owned control; missing IDs indicate a packaging error.
 * @param {string} id Template element identifier.
 * @returns {HTMLElement} Existing control.
 */
const el = (id) => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing palette editor control: ${id}`);
  }
  return element;
};
/** Inputs and selects share values, but only a matching DOM control can expose them safely.
 * @param {string} id Template element identifier.
 * @returns {HTMLInputElement | HTMLSelectElement} Existing value control.
 */
const valueControl = (id) => {
  const element = el(id);
  if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLSelectElement)) {
    throw new Error(`Invalid palette value control: ${id}`);
  }
  return element;
};
const applyControl = el("apply");
if (!(applyControl instanceof HTMLButtonElement)) {
  throw new Error("The palette apply control must be a button.");
}
const apply = applyControl;
/** @type {number | undefined} Last host document version; every edit must carry this version. */
let version;
/** Prevent duplicate edits while retaining focus on the Apply button. */
let pending = false;
/** @type {readonly PaletteView[]} Host-derived catalog; webview selections never grant edit authority. */
let palettes = [];
let selection = vscode.getState() ?? { id: "", index: 0, filter: "" };
valueControl("filter").value = selection.filter;

function remember() {
  vscode.setState(selection);
}

function renderColors() {
  const record = palettes.find((item) => item.id === selection.id);
  const active = document.activeElement;
  const focusedSlot =
    active instanceof HTMLElement && el("colors").contains(active)
      ? active.dataset.slot
      : undefined;
  el("colors").replaceChildren();
  valueControl("word").disabled = !record;
  apply.disabled = !record;
  apply.setAttribute("aria-disabled", String(pending || !record));
  if (!record) {
    el("slot").textContent = "";
    if (focusedSlot !== undefined) {
      el("palettes").focus();
    }
    return;
  }
  // A refreshed catalog may remove slots; keep the selection inside the record's native range.
  if (
    selection.index < record.firstIndex ||
    selection.index >= record.firstIndex + record.words.length
  ) {
    selection.index = record.firstIndex;
  }
  record.words.forEach((word, offset) => {
    const index = record.firstIndex + offset;
    const button = document.createElement("button");
    button.dataset.slot = String(index);
    button.type = "button";
    button.title = `Slot ${index}: $${word}`;
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(index === selection.index));
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = 32;
    canvas.height = 32;
    const value = parseInt(word, 16);
    const rgb = [value & 31, (value >> 5) & 31, (value >> 10) & 31].map(
      (channel) => (channel << 3) | (channel >> 2),
    );
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("A 2D canvas is required for palette swatches.");
    }
    context.fillStyle = `rgb(${rgb.join(",")})`;
    context.fillRect(0, 0, 32, 32);
    button.append(canvas, document.createTextNode(String(index)));
    button.addEventListener("click", () => {
      selection.index = index;
      renderColors();
      remember();
    });
    el("colors").append(button);
  });
  // Rebuilding swatches must preserve the keyboard user's place after selection or host updates.
  if (focusedSlot !== undefined) {
    const buttons = [...el("colors").querySelectorAll("button")];
    const next = buttons.find((button) => button.dataset.slot === focusedSlot) ?? buttons.at(0);
    next?.focus({ preventScroll: true });
  }
  valueControl("word").value = record.words[selection.index - record.firstIndex];
  el("slot").textContent = `· slot ${selection.index}`;
}

function render() {
  const search = selection.filter.toLowerCase();
  const records = palettes.filter((item) =>
    `${item.id} ${item.name}`.toLowerCase().includes(search),
  );
  if (!records.some((item) => item.id === selection.id)) {
    selection.id = records[0]?.id ?? "";
  }
  el("palettes").replaceChildren(
    ...records.map((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.id} ${item.name}`;
      option.selected = item.id === selection.id;
      return option;
    }),
  );
  renderColors();
  remember();
}

el("filter").addEventListener("input", () => {
  selection.filter = valueControl("filter").value;
  render();
});
el("palettes").addEventListener("change", () => {
  selection.id = valueControl("palettes").value;
  renderColors();
  remember();
});
el("text").addEventListener("click", () => vscode.postMessage({ type: "text" }));
el("edit").addEventListener("submit", (event) => {
  event.preventDefault();
  if (pending || version === undefined || apply.disabled) {
    return;
  }
  pending = true;
  apply.setAttribute("aria-disabled", "true");
  vscode.postMessage({
    type: "edit",
    version,
    id: selection.id,
    index: selection.index,
    word: valueControl("word").value,
  });
});
// Only the extension posts this contract; it validates edits before touching the text document.
window.addEventListener("message", (/** @type {MessageEvent<PaletteMessage>} */ { data }) => {
  if (data.type === "palette") {
    pending = false;
    version = data.version;
    palettes = data.palettes;
    el("error").textContent = "";
    render();
    // Ignore unknown host message kinds rather than disabling an unrelated edit.
    // oxlint-disable-next-line typescript/no-unnecessary-condition
  } else if (data.type === "error") {
    el("error").textContent = data.text;
    pending = false;
    apply.setAttribute("aria-disabled", String(apply.disabled));
  }
});
vscode.postMessage({ type: "ready" });
