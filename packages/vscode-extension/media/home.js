/* This file is loaded unchanged by VS Code and can be debugged in Webview Developer Tools. */
/** @typedef {import('../src/project/home-model.js').HomeSnapshot} HomeSnapshot */
/** @typedef {import('../src/project/home-model.js').HomeAction} HomeAction */
/** @typedef {import('../src/project/home-model.js').CatalogEntry} CatalogEntry */
/** @type {WebviewApi<unknown>} */
const vscode = acquireVsCodeApi();
/** @type {Set<string>} */
const pending = new Set();
/** @type {HomeSnapshot | undefined} */
let snapshot;
let moreOpen = false;
let settingsOpen = false;

const root = document.getElementById("root");
const actionStatus = document.getElementById("actionStatus");
if (!root || !actionStatus) {
  throw new Error("Missing Home webview root.");
}

/**
 * @param {string} type
 * @param {Record<string, unknown>} [extra]
 */
function send(type, extra) {
  if (pending.has(type)) {
    return;
  }
  pending.add(type);
  actionStatus.hidden = false;
  actionStatus.classList.remove("error");
  actionStatus.textContent = "Updating…";
  vscode.postMessage({ type, ...extra });
}

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

/**
 * @param {HomeAction} action
 * @param {string} appearance
 * @param {boolean} [full]
 */
function actionButton(action, appearance, full) {
  const button = el("button", `home-btn home-btn--${appearance}${full ? " home-btn--full" : ""}`);
  button.type = "button";
  button.textContent = action.title;
  button.disabled = !snapshot?.trusted || pending.size > 0;
  button.addEventListener("click", () => {
    send("command", { command: action.command, args: action.args ?? [] });
  });
  return button;
}

function renderHeader(data) {
  const header = el("header", "home-header");
  const identity = el("div");
  identity.append(el("h2", "home-name", data.name));
  const meta = el("div", "home-meta");
  if (data.branch) {
    meta.append(el("span", undefined, data.branch));
  }
  const mode = data.mode === "source" ? "Source" : data.mode === "assembly" ? "Assembly" : "None";
  meta.append(el("span", "home-badge", mode));
  if (data.targetLabel) {
    meta.append(el("span", undefined, data.targetLabel));
  }
  if (data.dirty) {
    meta.append(el("span", undefined, "uncommitted"));
  }
  identity.append(meta);
  const overflow = el("button", "home-btn home-btn--toolbar", "⋯");
  overflow.type = "button";
  overflow.title = "Project actions";
  overflow.addEventListener("click", () => send("overflow"));
  header.append(identity, overflow);
  return header;
}

function renderRecovery(data) {
  if (!data.recovery) {
    return undefined;
  }
  const card = el("section", `home-card home-card--${data.recovery.stripe}`);
  card.append(el("p", "home-card-title", data.recovery.label));
  card.append(el("p", "home-card-meta", data.recovery.reason));
  const actions = el("div", "home-actions");
  if (data.recovery.primary) {
    actions.append(actionButton(data.recovery.primary, "primary"));
  }
  for (const action of data.recovery.secondary) {
    actions.append(actionButton(action, "secondary"));
  }
  card.append(actions);
  return card;
}

function renderCta(data) {
  const section = el("section", "home-section");
  if (data.mode === "source") {
    if (data.next && !data.recovery) {
      section.append(actionButton(data.next, "primary", true));
    } else if (!data.recovery) {
      section.append(actionButton({ command: "asm.source.refresh", title: "Refresh status" }, "secondary", true));
    }
    if (data.steps?.length) {
      const stepper = el("div", "home-stepper");
      data.steps.forEach((step, index) => {
        if (index > 0) {
          stepper.append(el("span", "home-step", "→"));
        }
        stepper.append(el("span", `home-step home-step--${step.state}`, step.label));
      });
      section.append(stepper);
    }
    const build = el("div", "home-actions");
    const buildLabel = data.build?.description
      ? `Build current source · ${data.build.description}`
      : "Build current source";
    build.append(actionButton({ command: "asm.source.build", title: buildLabel }, "secondary"));
    section.append(build);
    return section;
  }
  if (data.mode === "assembly") {
    const actions = el("div", "home-actions");
    actions.append(actionButton({ command: "asm.build", title: "Build" }, "primary"));
    actions.append(actionButton({ command: "asm.runEmulator", title: "Run" }, "secondary"));
    actions.append(actionButton({ command: "asm.debugEmulator", title: "Debug" }, "secondary"));
    const watch = el("button", "home-btn home-btn--toolbar");
    watch.type = "button";
    watch.textContent = data.watch ? "Watch on" : "Watch off";
    watch.disabled = !data.trusted;
    watch.addEventListener("click", () => send("command", { command: "asm.toggleWatch" }));
    actions.append(watch);
    section.append(actions);
    return section;
  }
  return undefined;
}

function renderIncoming(data) {
  if (!data.incoming) {
    return undefined;
  }
  const section = el("section", "home-section");
  const title = el("h3", "home-section-title");
  title.append(
    el(
      "span",
      undefined,
      data.incoming.previewed
        ? `Incoming · ${data.incoming.shown} of ${data.incoming.total}`
        : `Incoming · ${data.incoming.total} files`,
    ),
  );
  section.append(title);
  if (!data.incoming.previewed) {
    section.append(
      el("p", "home-card-meta", "Preview to review diffs. Full regenerations stay collapsed until then."),
    );
    return section;
  }
  const list = el("div");
  for (const file of data.incoming.files) {
    const row = el("button", "home-file");
    row.type = "button";
    const status = file.conflict ? "C" : file.status.slice(0, 1);
    row.append(el("span", `home-file-status ${status}`, status));
    row.append(el("span", "home-file-path", file.path));
    if (file.conflict) {
      row.append(el("span", "home-pill home-pill--warn", "conflict"));
    } else if (file.additions != null || file.deletions != null) {
      const added = file.additions ?? 0;
      const deleted = file.deletions ?? 0;
      row.append(el("span", "home-file-stats", `+${added} −${deleted}`));
    }
    row.addEventListener("click", () => {
      send("diff", { left: file.left, right: file.right, title: file.title });
    });
    list.append(row);
  }
  section.append(list);
  return section;
}

function renderHealth(data) {
  const section = el("section", "home-section");
  section.append(el("h3", "home-section-title", "Health"));
  const card = el("div", "home-card home-card--info");
  const indexLabel = data.indexReady ? "Index ready" : "Index waiting";
  const indexRow = el("div", "home-health-row");
  indexRow.append(el("span", undefined, indexLabel));
  indexRow.append(
    el(
      "span",
      "muted",
      `${data.health.index.files} files · ${data.health.index.symbols} symbols`,
    ),
  );
  card.append(indexRow);
  const errorRow = el("div", "home-health-row");
  const errors = el("button", undefined, `${data.health.index.errors} errors`);
  errors.type = "button";
  errors.addEventListener("click", () =>
    send("command", { command: "workbench.actions.view.problems" }),
  );
  errorRow.append(errors);
  if (data.health.index.lastIndexed) {
    errorRow.append(el("span", "muted", data.health.index.lastIndexed));
  }
  card.append(errorRow);
  if (data.health.coverage) {
    const coverage = data.health.coverage;
    const remaining = el("div", "home-health-row");
    remaining.append(
      el("span", undefined, `${coverage.remainingPercent.toFixed(1)}% remaining`),
    );
    remaining.append(el("span", "muted", coverage.freshness));
    card.append(remaining);
    const meter = el("div", "home-meter");
    const fill = el("span");
    fill.style.width = `${Math.min(100, coverage.convertedPercent)}%`;
    meter.append(fill);
    card.append(meter);
    card.append(el("p", "home-card-meta", coverage.reason));
  } else if (data.health.outputPath) {
    card.append(el("p", "home-card-meta", `Output · ${data.health.outputPath}`));
  }
  section.append(card);
  return section;
}

function renderCapture(data) {
  if (!data.capture) {
    return undefined;
  }
  const section = el("section", "home-section");
  section.append(el("h3", "home-section-title", "Capture"));
  const card = el("div", "home-card home-card--info");
  card.append(el("p", "home-card-title", data.capture.label));
  const actions = el("div", "home-actions");
  for (const action of data.capture.actions) {
    actions.append(actionButton(action, "secondary"));
  }
  card.append(actions);
  section.append(card);
  return section;
}

function renderMore(data) {
  if (!data.more.length) {
    return undefined;
  }
  const section = el("section", "home-section");
  const title = el("h3", "home-section-title");
  title.append(el("span", undefined, "More"));
  const toggle = el("button", "home-btn home-btn--link", moreOpen ? "Hide" : "Show");
  toggle.type = "button";
  toggle.addEventListener("click", () => {
    moreOpen = !moreOpen;
    render();
  });
  title.append(toggle);
  section.append(title);
  if (moreOpen) {
    const list = el("div", "home-more");
    for (const action of data.more) {
      list.append(actionButton(action, "link"));
    }
    section.append(list);
  }
  return section;
}

/**
 * @param {string} id
 * @param {readonly string[]} items
 * @param {string} removeType
 */
function fillList(id, items, removeType) {
  const node = el("div", "home-list");
  node.id = id;
  if (!items.length) {
    node.append(el("span", "muted", "None configured"));
    return node;
  }
  for (const item of items) {
    const row = el("div", "home-list-row");
    row.append(el("span", undefined, item));
    const remove = el("button", "home-btn home-btn--toolbar", "Remove");
    remove.type = "button";
    remove.disabled = !snapshot?.trusted;
    remove.addEventListener("click", () => send(removeType, { value: item }));
    row.append(remove);
    node.append(row);
  }
  return node;
}

/**
 * @param {HTMLSelectElement} select
 * @param {readonly CatalogEntry[]} entries
 * @param {string} selected
 */
function fillSelect(select, entries, selected) {
  select.replaceChildren();
  const ids = new Set(entries.map((entry) => entry.id));
  if (selected && !ids.has(selected)) {
    const option = el("option", undefined, selected);
    option.value = selected;
    select.append(option);
  }
  for (const entry of entries) {
    const option = el("option", undefined, entry.displayName || entry.id);
    option.value = entry.id;
    select.append(option);
  }
  select.value = selected;
}

function renderSettings(data) {
  if (!data.assembly) {
    return undefined;
  }
  const section = el("section", "home-section");
  const title = el("h3", "home-section-title");
  title.append(el("span", undefined, "Project settings"));
  const toggle = el("button", "home-btn home-btn--link", settingsOpen ? "Hide" : "Show");
  toggle.type = "button";
  toggle.addEventListener("click", () => {
    settingsOpen = !settingsOpen;
    render();
  });
  title.append(toggle);
  section.append(title);
  if (!settingsOpen) {
    return section;
  }
  const form = el("div", "home-settings");
  const targetLabel = el("label", undefined, "Target");
  const target = el("select");
  target.id = "target";
  fillSelect(target, data.assembly.targets, data.assembly.target);
  target.disabled = !data.trusted;
  target.addEventListener("change", () => send("setTarget", { value: target.value }));
  targetLabel.append(target);
  const architectureLabel = el("label", undefined, "Architecture");
  const architecture = el("select");
  architecture.id = "architecture";
  fillSelect(architecture, data.assembly.architectures, data.assembly.architecture);
  architecture.disabled = !data.trusted;
  architecture.addEventListener("change", () =>
    send("setArchitecture", { value: architecture.value }),
  );
  architectureLabel.append(architecture);
  const outputLabel = el("label", undefined, "Build output");
  const output = el("input");
  output.id = "buildOutput";
  output.value = data.assembly.output;
  output.placeholder = "game.sfc";
  output.disabled = !data.trusted;
  output.addEventListener("change", () => send("setBuildOutput", { value: output.value }));
  outputLabel.append(output);
  form.append(targetLabel, architectureLabel, outputLabel);
  form.append(el("span", "muted", "Entry points"));
  form.append(fillList("entryPoints", [...data.assembly.entryPoints], "removeEntryPoint"));
  const addEntry = el("button", "home-btn home-btn--secondary", "Add file…");
  addEntry.type = "button";
  addEntry.disabled = !data.trusted;
  addEntry.addEventListener("click", () => send("addEntryPoint"));
  form.append(addEntry);
  form.append(el("span", "muted", "Include paths"));
  form.append(fillList("includePaths", [...data.assembly.includePaths], "removeIncludePath"));
  const addInclude = el("button", "home-btn home-btn--secondary", "Add folder…");
  addInclude.type = "button";
  addInclude.disabled = !data.trusted;
  addInclude.addEventListener("click", () => send("addIncludePath"));
  form.append(addInclude);
  section.append(form);
  return section;
}

function renderWelcome(data) {
  if (!data.welcome) {
    return undefined;
  }
  const card = el("section", "home-card home-card--active");
  card.append(el("p", "home-card-title", data.welcome.title));
  card.append(el("p", "home-card-meta", data.welcome.detail));
  const actions = el("div", "home-actions");
  data.welcome.actions.forEach((action, index) => {
    actions.append(actionButton(action, index === 0 ? "primary" : "secondary", true));
  });
  card.append(actions);
  return card;
}

function render() {
  const data = snapshot;
  root.replaceChildren();
  if (!data) {
    return;
  }
  root.append(renderHeader(data));
  const welcome = renderWelcome(data);
  if (welcome) {
    root.append(welcome);
  }
  const recovery = renderRecovery(data);
  if (recovery) {
    root.append(recovery);
  }
  const cta = renderCta(data);
  if (cta) {
    root.append(cta);
  }
  const incoming = renderIncoming(data);
  if (incoming) {
    root.append(incoming);
  }
  if (data.mode !== "none") {
    root.append(renderHealth(data));
  }
  const capture = renderCapture(data);
  if (capture) {
    root.append(capture);
  }
  const settings = renderSettings(data);
  if (settings) {
    root.append(settings);
  }
  const more = renderMore(data);
  if (more) {
    root.append(more);
  }
}

window.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") {
    return;
  }
  if (message.type === "snapshot") {
    snapshot = message;
    pending.clear();
    actionStatus.hidden = true;
    actionStatus.textContent = "";
    render();
    return;
  }
  if (message.type === "actionComplete") {
    pending.delete(message.command);
    if (message.error) {
      actionStatus.hidden = false;
      actionStatus.classList.add("error");
      actionStatus.textContent = message.error;
    } else {
      actionStatus.hidden = true;
      actionStatus.textContent = "";
    }
    render();
  }
});

vscode.postMessage({ type: "ready" });
