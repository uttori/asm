/* Runs directly in the webview: no template-string escaping or build step. */
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const fieldIds = ["name", "comment", "inlineComment", "instructionComment"];
let hasInstruction = false;
let initialized = false;

function fields() {
  return Object.fromEntries(fieldIds.map((id) => [id, $(id).value]));
}

function preview() {
  const value = fields();
  const singleLine = (text) => text.replace(/\r?\n/g, " ");
  const lines = value.comment ? value.comment.split(/\r?\n/).map((line) => `; ${line}`) : [];
  if (value.name)
    lines.push(
      `${value.name}:${value.inlineComment ? ` ; ${singleLine(value.inlineComment)}` : ""}`,
    );
  if (value.instructionComment)
    lines.push(`  <instruction> ; ${singleLine(value.instructionComment)}`);
  $("preview").textContent = lines.join("\n") || "; Add a name or comment to preview the source.";
}

function setBusy(busy) {
  $("fields").disabled = busy;
  $("save").disabled = busy;
  $("regenerate").disabled = busy;
  // A transaction cannot be cancelled after publication begins.
  $("cancel").disabled = busy;
  $("annotation").setAttribute("aria-busy", String(busy));
  $("instructionComment").disabled = !hasInstruction;
}

function submit(regenerate) {
  if (!initialized) return;
  setBusy(true);
  $("error").hidden = true;
  $("status").hidden = false;
  $("status").textContent = "Saving annotation…";
  vscode.postMessage({ type: "save", fields: fields(), regenerate });
}

fieldIds.forEach((id) => $(id).addEventListener("input", preview));
$("annotation").addEventListener("submit", (event) => {
  event.preventDefault();
  submit(false);
});
$("regenerate").addEventListener("click", () => submit(true));
$("cancel").addEventListener("click", () => vscode.postMessage({ type: "cancel" }));
window.addEventListener("message", ({ data }) => {
  if (data?.type === "initialize" && !initialized) {
    initialized = true;
    hasInstruction = data.hasInstruction;
    $("location").textContent = data.location;
    fieldIds.forEach((id) => {
      $(id).value = data.fields[id];
    });
    $("annotation").hidden = false;
    $("status").hidden = true;
    $("instructionHelp").hidden = hasInstruction;
    setBusy(false);
    preview();
    $("name").focus();
  } else if (data?.type === "error") {
    $("error").textContent = data.message;
    $("error").hidden = false;
    $("status").hidden = true;
    if (initialized) setBusy(false);
  }
});
vscode.postMessage({ type: "ready" });
