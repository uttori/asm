/* This file is loaded unchanged by VS Code and can be debugged in Webview Developer Tools. */
/** @typedef {import('../src/project/panel.js').CatalogEntry} CatalogEntry */
/** @typedef {{type:'actionComplete',command:string,error?:string} | {type:'snapshot',trusted:boolean,status:import('../src/project/panel.js').ProjectStatus,metadata?:import('../src/project/panel.js').ProjectMetadata}} PanelMessage */
/** @type {WebviewApi<unknown>} */
const vscode = acquireVsCodeApi();
/** Resolve a template-owned control; missing IDs indicate a packaging error.
 * @param {string} id Template element identifier.
 * @returns {HTMLElement} Existing control.
 */
const $ = (id) => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing project panel control: ${id}`);
  }
  return element;
};
/** Resolve a value control without assuming every HTMLElement is an input.
 * @param {string} id Template element identifier.
 * @returns {HTMLInputElement | HTMLSelectElement} Existing value control.
 */
const valueControl = (id) => {
  const element = $(id);
  if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLSelectElement)) {
    throw new Error(`Invalid project panel value control: ${id}`);
  }
  return element;
};
/** @type {Set<string>} Commands remain disabled until the host acknowledges completion. */
const pending = new Set();
let trusted = false;

function updateDisabled() {
  for (const element of document.querySelectorAll("button, input, select")) {
    if (
      !(element instanceof HTMLButtonElement) &&
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLSelectElement)
    ) {
      throw new Error("Project panel contains an invalid form control.");
    }
    element.disabled =
      (element.hasAttribute("data-trusted") && !trusted) || pending.has(element.dataset.cmd ?? "");
  }
}

/** Keep one request per command in flight until the host returns actionComplete.
 * @param {string} type Host command identifier.
 * @param {string | undefined} value Optional command argument.
 * @returns {void} Updates controls and posts the request.
 */
function send(type, value) {
  if (pending.has(type)) {
    return;
  }
  pending.add(type);
  updateDisabled();
  $("actionStatus").hidden = false;
  $("actionStatus").classList.remove("error");
  const button = [...document.querySelectorAll("[data-cmd]")].find(
    (element) => element instanceof HTMLElement && element.dataset.cmd === type,
  );
  $("actionStatus").textContent = `${button?.textContent.trim() || "Updating project"}…`;
  vscode.postMessage({ type, value });
}

/** Rebuild a host-derived path list, associating removals with exact paths.
 * @param {string} id Container identifier.
 * @param {readonly string[]} items Configured paths.
 * @param {string} removeType Host removal command.
 * @returns {void} Replaces the displayed rows.
 */
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

/** Preserve focused selections and retain configured IDs absent from the catalog.
 * @param {string} id Selection control identifier.
 * @param {readonly CatalogEntry[]} options Host catalog entries.
 * @param {string} value Configured identifier; empty means no selection.
 * @returns {void} Replaces options only when the control is not focused.
 */
function fillSelect(id, options, value) {
  const select = $(id);
  if (document.activeElement === select) {
    return;
  }
  const seen = new Set();
  select.replaceChildren();
  for (const entry of [...options, { id: value }]) {
    if (!entry.id || seen.has(entry.id)) {
      continue;
    }
    seen.add(entry.id);
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.displayName || entry.id;
    option.selected = entry.id === value;
    select.append(option);
  }
}

// Host acknowledgments must release pending commands even when an action fails.
window.addEventListener(
  "message",
  (/** @type {MessageEvent<PanelMessage | undefined>} */ { data }) => {
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
    if (data?.type !== "snapshot") {
      return;
    }
    const { status, metadata } = data;
    trusted = data.trusted;
    $("trustNotice").hidden = trusted;
    fillList("entryPoints", status.entryPoints, "removeEntryPoint");
    fillList("includePaths", status.includePaths, "removeIncludePath");
    fillSelect("target", metadata?.targets ?? [], status.target || metadata?.activeTarget || "");
    fillSelect(
      "architecture",
      metadata?.architectures ?? [],
      status.architecture || metadata?.activeArchitecture || "",
    );
    if (document.activeElement !== $("buildOutput")) {
      valueControl("buildOutput").value = status.buildOutput ?? "";
    }
    updateDisabled();
  },
);

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  const button = event.target.closest("button[data-cmd]");
  if (button instanceof HTMLButtonElement && !button.disabled && button.dataset.cmd) {
    send(button.dataset.cmd, button.dataset.value);
  }
});
for (const [id, command] of [
  ["target", "setTarget"],
  ["architecture", "setArchitecture"],
  ["buildOutput", "setBuildOutput"],
]) {
  valueControl(id).addEventListener("change", () => send(command, valueControl(id).value));
}
updateDisabled();
vscode.postMessage({ type: "ready" });
