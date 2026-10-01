/* The text document owns every edit; webview state retains only the current selection. */
const vscode = acquireVsCodeApi();
const el = (id) => document.getElementById(id);
let version;
let palettes = [];
let selection = vscode.getState() ?? { id: "", index: 0, filter: "" };
el("filter").value = selection.filter;

function remember() {
  vscode.setState(selection);
}

function renderColors() {
  const record = palettes.find((item) => item.id === selection.id);
  el("colors").replaceChildren();
  el("word").disabled = !record;
  el("apply").disabled = !record;
  if (!record) {
    el("slot").textContent = "";
    return;
  }
  if (
    selection.index < record.firstIndex ||
    selection.index >= record.firstIndex + record.words.length
  ) {
    selection.index = record.firstIndex;
  }
  record.words.forEach((word, offset) => {
    const index = record.firstIndex + offset;
    const button = document.createElement("button");
    button.type = "button";
    button.title = `Slot ${index}: $${word}`;
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(index === selection.index));
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const value = parseInt(word, 16);
    const rgb = [value & 31, (value >> 5) & 31, (value >> 10) & 31].map(
      (channel) => (channel << 3) | (channel >> 2),
    );
    const context = canvas.getContext("2d");
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
  el("word").value = record.words[selection.index - record.firstIndex];
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
  selection.filter = el("filter").value;
  render();
});
el("palettes").addEventListener("change", () => {
  selection.id = el("palettes").value;
  renderColors();
  remember();
});
el("text").addEventListener("click", () => vscode.postMessage({ type: "text" }));
el("edit").addEventListener("submit", (event) => {
  event.preventDefault();
  el("apply").disabled = true;
  vscode.postMessage({
    type: "edit",
    version,
    id: selection.id,
    index: selection.index,
    word: el("word").value,
  });
});
window.addEventListener("message", ({ data }) => {
  if (data.type === "palette") {
    version = data.version;
    palettes = data.palettes;
    el("error").textContent = "";
    render();
  } else if (data.type === "error") {
    el("error").textContent = data.text;
    el("apply").disabled = true;
  }
});
vscode.postMessage({ type: "ready" });
