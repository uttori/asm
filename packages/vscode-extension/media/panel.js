/* This file is loaded unchanged by VS Code and can be debugged in Webview Developer Tools. */
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const pending = new Set();
let trusted = false;
const savedState = vscode.getState() || {};

for (const section of document.querySelectorAll("details")) {
  if (typeof savedState[section.id] === "boolean") section.open = savedState[section.id];
  section.addEventListener("toggle", () => {
    savedState[section.id] = section.open;
    vscode.setState(savedState);
  });
}

function updateDisabled() {
  for (const element of document.querySelectorAll("button, input, select")) {
    element.disabled =
      (element.hasAttribute("data-trusted") && !trusted) || pending.has(element.dataset.cmd);
  }
}

function send(type, value) {
  if (pending.has(type)) return;
  pending.add(type);
  updateDisabled();
  $("actionStatus").hidden = false;
  $("actionStatus").classList.remove("error");
  const button = [...document.querySelectorAll("[data-cmd]")].find(
    (element) => element.dataset.cmd === type,
  );
  $("actionStatus").textContent = `${button?.textContent.trim() || "Updating project"}…`;
  vscode.postMessage({ type, value });
}

function fillList(id, items, removeType) {
  const root = $(id);
  root.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("span");
    empty.className = "muted";
    empty.textContent = "None configured";
    root.append(empty);
  }
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "item";
    const label = document.createElement("span");
    label.textContent = item;
    const button = document.createElement("button");
    button.className = "icon";
    button.type = "button";
    button.textContent = "×";
    button.title = `Remove ${item}`;
    button.setAttribute("aria-label", button.title);
    button.setAttribute("data-trusted", "");
    button.dataset.cmd = removeType;
    button.dataset.value = item;
    row.append(label, button);
    root.append(row);
  }
}

function fillSelect(id, options, value) {
  const select = $(id);
  if (document.activeElement === select) return;
  const seen = new Set();
  select.replaceChildren();
  for (const entry of [...options, { id: value }]) {
    if (!entry?.id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.displayName || entry.id;
    option.selected = entry.id === value;
    select.append(option);
  }
}

window.addEventListener("message", ({ data }) => {
  if (data?.type === "actionComplete") {
    pending.delete(data.command);
    updateDisabled();
    $("actionStatus").hidden = !data.error && pending.size === 0;
    if (data.error) {
      $("actionStatus").classList.add("error");
      $("actionStatus").textContent = data.error;
    }
    return;
  }
  if (data?.type !== "snapshot") return;
  const { status, metadata } = data;
  trusted = data.trusted;
  $("trustNotice").hidden = trusted;
  $("projectName").textContent = data.projectName || "Assembly project";
  $("projectTarget").textContent = status.target || metadata?.activeTarget || "No target selected";
  $("configAction").textContent = status.configFile
    ? "Open project configuration"
    : "Initialize project configuration";
  $("configAction").dataset.cmd = status.configFile ? "openConfig" : "initConfig";
  $("summary").replaceChildren();
  const summary = data.indexReady
    ? [`${status.fileCount} files`, `${status.symbolCount} symbols`, `${status.errorCount} errors`]
    : ["Waiting for source index"];
  summary.forEach((text, index) => {
    const badge = document.createElement("span");
    badge.textContent = text;
    if (index === 2 && status.errorCount) badge.className = "errors";
    $("summary").append(badge);
  });
  $("status").replaceChildren();
  const rows = [
    ["Files", status.fileCount],
    ["Symbols", status.symbolCount],
    ["Errors", status.errorCount],
    [
      "Last reindex",
      status.lastReindexDurationMs == null ? "—" : `${status.lastReindexDurationMs} ms`,
    ],
    [
      "Roots",
      `${status.lastReindexRootCount} (${status.lastReindexCachedRoots} cached, ${status.lastReindexAnalyzedRoots} analyzed)`,
    ],
    ["Config", status.configFile || "Not configured"],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    row.className = "row";
    const term = document.createElement("dt");
    const definition = document.createElement("dd");
    term.textContent = label;
    definition.textContent = String(value);
    row.append(term, definition);
    $("status").append(row);
  }
  fillList("entryPoints", status.entryPoints || [], "removeEntryPoint");
  fillList("includePaths", status.includePaths || [], "removeIncludePath");
  fillSelect("target", metadata?.targets || [], status.target || metadata?.activeTarget || "");
  fillSelect(
    "architecture",
    metadata?.architectures || [],
    status.architecture || metadata?.activeArchitecture || "",
  );
  if (document.activeElement !== $("buildOutput"))
    $("buildOutput").value = status.buildOutput || "";
  updateDisabled();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-cmd]");
  if (button && !button.disabled) send(button.dataset.cmd, button.dataset.value);
});
for (const [id, command] of [
  ["target", "setTarget"],
  ["architecture", "setArchitecture"],
  ["buildOutput", "setBuildOutput"],
]) {
  $(id).addEventListener("change", (event) => send(command, event.target.value));
}
updateDisabled();
vscode.postMessage({ type: "ready" });
