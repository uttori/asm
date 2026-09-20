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

/** Combines workspace trust and in-flight actions so snapshots cannot re-enable a busy button. */
function updateDisabled() {
  for (const button of document.querySelectorAll("button")) {
    button.disabled =
      (button.hasAttribute("data-trusted") && !trusted) || pending.has(button.dataset.cmd);
  }
}

/** Marks an action pending until the extension reports success or an actionable error. */
function send(button) {
  const type = button.dataset.cmd;
  if (pending.has(type)) return;
  pending.add(type);
  updateDisabled();
  $("actionStatus").hidden = false;
  $("actionStatus").classList.remove("error");
  $("actionStatus").textContent = `${button.textContent.trim()}…`;
  vscode.postMessage({ type });
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
  trusted = data.trusted;
  $("trustNotice").hidden = trusted;
  updateDisabled();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-cmd]");
  if (button && !button.disabled) send(button);
});
updateDisabled();
vscode.postMessage({ type: "ready" });
