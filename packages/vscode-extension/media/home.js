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

/** Resolve persistent template controls before registering host callbacks.
 * @param {string} id Required template element.
 * @returns {HTMLElement} Mounted element, or throws for an invalid package.
 */
function required(id) {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing Home control: ${id}`);
  }
  return node;
}
const root = required("root");
const actionStatus = required("actionStatus");

/**
 * @param {string} type Host action identifier, also used to deduplicate pending requests.
 * @param {Record<string, unknown>} [extra] Action-specific arguments serialized to the extension.
 */
function send(type, extra) {
  if (pending.has(type)) {
    return;
  }
  pending.add(type);
  actionStatus.classList.remove("error");
  actionStatus.textContent = "Updating…";
  vscode.postMessage({ type, ...extra });
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag Native element type.
 * @param {string} [className] Styling hooks.
 * @param {string} [text] Untrusted display text assigned without markup parsing.
 * @returns {HTMLElementTagNameMap[K]} A new typed element; text is never parsed as markup.
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
 * @param {HomeAction} action Authorized command and native editor arguments.
 * @param {string} appearance Button style variant.
 * @param {boolean} [full] Stretch the primary workflow control to the sidebar width.
 * @returns {HTMLButtonElement} Command button disabled for untrusted or pending state.
 */
function actionButton(action, appearance, full) {
  const button = el("button", `home-btn home-btn--${appearance}${full ? " home-btn--full" : ""}`);
  button.type = "button";
  button.dataset.focusKey = `command:${action.command}:${JSON.stringify(action.args ?? [])}`;
  button.textContent = action.title;
  button.disabled = !snapshot?.trusted || pending.size > 0;
  button.addEventListener("click", () => {
    send("command", { command: action.command, args: action.args ?? [] });
  });
  return button;
}

/** @param {HomeSnapshot} data Current project facts.
 * @returns {HTMLElement} Persistent project status section.
 */
function renderHeader(data) {
  const header = el("header", "home-header");
  const identity = el("div");
  identity.append(el("h1", "home-name", data.name));
  const meta = el("div", "home-meta");
  if (data.branch) {
    meta.append(el("span", undefined, data.branch));
  }
  let mode = "None";
  if (data.mode === "source") {
    mode = "Source";
  } else if (data.mode === "assembly") {
    mode = "Assembly";
  }
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
  overflow.setAttribute("aria-label", "Project actions");
  overflow.dataset.focusKey = "overflow";
  overflow.addEventListener("click", () => send("overflow"));
  header.append(identity, overflow);
  return header;
}

/** @param {HomeSnapshot} data Current project facts.
 * @returns {HTMLElement | undefined} Section when the current project exposes these controls.
 */
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

/** @param {HomeSnapshot} data Current project facts.
 * @returns {HTMLElement | undefined} Section when the current project exposes these controls.
 */
function renderCta(data) {
  const section = el("section", "home-section");
  if (data.mode === "source") {
    if (data.next && !data.recovery) {
      section.append(actionButton(data.next, "primary", true));
    } else if (!data.recovery) {
      section.append(
        actionButton({ command: "asm.source.refresh", title: "Refresh status" }, "secondary", true),
      );
    }
    if (data.steps?.length) {
      const stepper = el("ol", "home-stepper");
      stepper.setAttribute("aria-label", "Regeneration progress");
      data.steps.forEach((step) => {
        const item = el("li", `home-step home-step--${step.state}`, step.label);
        if (step.state === "current") {
          item.setAttribute("aria-current", "step");
        }
        if (step.state === "done") {
          item.append(el("span", "sr-only", " completed"));
        }
        stepper.append(item);
      });
      section.append(stepper);
    }
    const build = el("div", "home-actions");
    const buildLabel = data.build?.description
      ? `Build current source · ${data.build.description}`
      : "Build current source";
    build.append(actionButton({ command: "asm.source.build", title: buildLabel }, "secondary"));
    // Discard is a normal prepared-candidate action, not just a recovery exit.
    // Releasing it lets Next offer Analyze/Prepare again using current inputs.
    if (data.canDiscard && !data.recovery) {
      const discard = actionButton(
        { command: "asm.source.discard", title: "Discard candidate" },
        "secondary",
      );
      discard.title = "Clear the prepared generation and its preview; keep current source edits.";
      build.append(discard);
    }
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
    watch.dataset.focusKey = "watch";
    watch.setAttribute("aria-pressed", String(data.watch));
    watch.textContent = data.watch ? "Watch on" : "Watch off";
    watch.disabled = !data.trusted;
    watch.addEventListener("click", () => send("command", { command: "asm.toggleWatch" }));
    actions.append(watch);
    section.append(actions);
    return section;
  }
  return undefined;
}

/** All paths remain in the accessibility tree; only the visual list height is bounded.
 * @param {HomeSnapshot} data Current project facts.
 * @returns {HTMLElement | undefined} Complete review list when a generation exists.
 */
function renderIncoming(data) {
  if (!data.incoming) {
    return undefined;
  }
  const section = el("section", "home-section");
  const title = el("h2", "home-section-title", `Incoming · ${data.incoming.total} files`);
  title.id = "incoming-title";
  section.append(title);
  const help = el(
    "p",
    "home-card-meta",
    "Use ↑/↓ to move between files, Home/End for first/last, and Enter or Space to open a diff.",
  );
  help.id = "incoming-help";
  section.append(help);
  const list = el("ul", "home-incoming");
  list.id = "incoming-files";
  list.tabIndex = 0;
  list.setAttribute("aria-labelledby", title.id);
  list.setAttribute("aria-describedby", help.id);
  for (const file of data.incoming.files) {
    const item = el("li");
    const row = el("button", "home-file");
    row.type = "button";
    row.dataset.focusKey = `diff:${file.path}`;
    const status = file.conflict ? "C" : file.status.slice(0, 1);
    /** @type {Record<string, string>} */
    const statusNames = { A: "Added", M: "Modified", D: "Deleted", R: "Renamed", C: "Conflict" };
    const statusLabel = statusNames[status] ?? file.status;
    let label = `${file.path}, ${statusLabel}`;
    if (!file.conflict && (file.additions != null || file.deletions != null)) {
      label += `, ${file.additions ?? 0} lines added, ${file.deletions ?? 0} lines deleted`;
    }
    row.title = label;
    const statusIcon = el("span", `home-file-status ${status}`, status);
    statusIcon.setAttribute("aria-hidden", "true");
    row.append(statusIcon);
    row.append(el("span", "home-file-path", file.path));
    // Keep the visible path as the native button name and add spoken status details.
    // The single-letter badges and +/- counters are visual shorthand for this text.
    row.append(el("span", "sr-only", label.slice(file.path.length)));
    if (file.conflict) {
      row.append(el("span", "home-pill home-pill--warn", "conflict"));
    } else if (file.additions != null || file.deletions != null) {
      const stats = el(
        "span",
        "home-file-stats",
        `+${file.additions ?? 0} −${file.deletions ?? 0}`,
      );
      stats.setAttribute("aria-hidden", "true");
      row.append(stats);
    }
    row.addEventListener("click", () => {
      send("diff", { left: file.left, right: file.right, title: file.title });
    });
    item.append(row);
    list.append(item);
  }
  list.addEventListener("keydown", (event) => {
    // Leave Tab and modified shortcuts to the browser/assistive technology; these
    // optional navigation keys move actual button focus without trapping the user.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const rows = [...list.querySelectorAll("button")];
    const index = rows.findIndex((row) => row === document.activeElement);
    let next;
    if (event.key === "Home") {
      next = rows[0];
    } else if (event.key === "End") {
      next = rows.at(-1);
    } else if (event.key === "ArrowDown") {
      next = rows[Math.min(index + 1, rows.length - 1)];
    } else if (event.key === "ArrowUp") {
      next = rows[Math.max(0, index - 1)];
    }
    if (next) {
      event.preventDefault();
      next.focus();
      next.scrollIntoView({ block: "nearest" });
    }
  });
  if (!data.incoming.files.length) {
    section.append(el("p", "home-card-meta", "No incoming file changes."));
  }
  section.append(list);
  return section;
}

/** @param {HomeSnapshot} data Current project facts.
 * @returns {HTMLElement} Persistent project status section.
 */
function renderHealth(data) {
  const section = el("section", "home-section");
  section.append(el("h2", "home-section-title", "Health"));
  const card = el("div", "home-card home-card--info");
  const indexLabel = data.indexReady ? "Index ready" : "Index waiting";
  const indexRow = el("div", "home-health-row");
  indexRow.append(el("span", undefined, indexLabel));
  indexRow.append(
    el("span", "muted", `${data.health.index.files} files · ${data.health.index.symbols} symbols`),
  );
  card.append(indexRow);
  const errorRow = el("div", "home-health-row");
  const errors = el("button", undefined, `${data.health.index.errors} errors`);
  errors.type = "button";
  errors.dataset.focusKey = "problems";
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
    remaining.append(el("span", undefined, `${coverage.remainingPercent.toFixed(1)}% remaining`));
    remaining.append(el("span", "muted", coverage.freshness));
    card.append(remaining);
    const meter = el("div", "home-meter");
    const fill = el("span");
    fill.style.width = `${Math.min(100, coverage.convertedPercent)}%`;
    meter.setAttribute("role", "meter");
    meter.setAttribute("aria-label", "ROM conversion");
    meter.setAttribute("aria-valuemin", "0");
    meter.setAttribute("aria-valuemax", "100");
    meter.setAttribute(
      "aria-valuenow",
      String(Math.max(0, Math.min(100, coverage.convertedPercent))),
    );
    meter.setAttribute(
      "aria-valuetext",
      `${coverage.convertedPercent.toFixed(1)}% converted, ${coverage.remainingPercent.toFixed(1)}% remaining`,
    );
    meter.append(fill);
    card.append(meter);
    card.append(el("p", "home-card-meta", coverage.reason));
  } else if (data.health.outputPath) {
    card.append(el("p", "home-card-meta", `Output · ${data.health.outputPath}`));
  }
  section.append(card);
  return section;
}

/** @param {HomeSnapshot} data Current project facts.
 * @returns {HTMLElement | undefined} Section when the current project exposes these controls.
 */
function renderCapture(data) {
  if (!data.capture) {
    return undefined;
  }
  const section = el("section", "home-section");
  section.append(el("h2", "home-section-title", "Capture"));
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

/** @param {HomeSnapshot} data Current project facts.
 * @returns {HTMLElement | undefined} Section when the current project exposes these controls.
 */
function renderMore(data) {
  if (!data.more.length) {
    return undefined;
  }
  const section = el("section", "home-section");
  const title = el("h2", "home-section-title");
  title.append(el("span", undefined, "More"));
  const toggle = el("button", "home-btn home-btn--link", moreOpen ? "Hide" : "Show");
  toggle.type = "button";
  toggle.id = "more-toggle";
  toggle.setAttribute("aria-label", `${moreOpen ? "Hide" : "Show"} more project actions`);
  toggle.setAttribute("aria-expanded", String(moreOpen));
  toggle.setAttribute("aria-controls", "more-actions");
  toggle.addEventListener("click", () => {
    moreOpen = !moreOpen;
    render();
  });
  title.append(toggle);
  section.append(title);
  const list = el("div", "home-more");
  list.id = "more-actions";
  list.hidden = !moreOpen;
  if (moreOpen) {
    for (const action of data.more) {
      list.append(actionButton(action, "link"));
    }
  }
  section.append(list);
  return section;
}

/**
 * @param {string} id Stable control identifier.
 * @param {readonly string[]} items Configured paths, in workspace order.
 * @param {string} removeType Host operation for removing a selected path.
 * @returns {HTMLDivElement} Path list with individually named remove controls.
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
    remove.dataset.focusKey = `${removeType}:${item}`;
    remove.setAttribute(
      "aria-label",
      `Remove ${item} from ${id === "entryPoints" ? "entry points" : "include paths"}`,
    );
    remove.disabled = !snapshot?.trusted;
    remove.addEventListener("click", () => send(removeType, { value: item }));
    row.append(remove);
    node.append(row);
  }
  return node;
}

/**
 * @param {HTMLSelectElement} select Destination control.
 * @param {readonly CatalogEntry[]} entries Selectable toolchain contributions.
 * @param {string} selected Current ID, preserved even when its contribution is unavailable.
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

/** @param {HomeSnapshot} data Current project facts.
 * @returns {HTMLElement | undefined} Section when the current project exposes these controls.
 */
function renderSettings(data) {
  if (!data.assembly) {
    return undefined;
  }
  const section = el("section", "home-section");
  const title = el("h2", "home-section-title");
  title.append(el("span", undefined, "Project settings"));
  const toggle = el("button", "home-btn home-btn--link", settingsOpen ? "Hide" : "Show");
  toggle.type = "button";
  toggle.id = "settings-toggle";
  toggle.setAttribute("aria-label", `${settingsOpen ? "Hide" : "Show"} project settings`);
  toggle.setAttribute("aria-expanded", String(settingsOpen));
  toggle.setAttribute("aria-controls", "project-settings");
  toggle.addEventListener("click", () => {
    settingsOpen = !settingsOpen;
    render();
  });
  title.append(toggle);
  section.append(title);
  const form = el("div", "home-settings");
  form.id = "project-settings";
  form.hidden = !settingsOpen;
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
  addEntry.dataset.focusKey = "addEntryPoint";
  addEntry.disabled = !data.trusted;
  addEntry.addEventListener("click", () => send("addEntryPoint"));
  form.append(addEntry);
  form.append(el("span", "muted", "Include paths"));
  form.append(fillList("includePaths", [...data.assembly.includePaths], "removeIncludePath"));
  const addInclude = el("button", "home-btn home-btn--secondary", "Add folder…");
  addInclude.type = "button";
  addInclude.dataset.focusKey = "addIncludePath";
  addInclude.disabled = !data.trusted;
  addInclude.addEventListener("click", () => send("addIncludePath"));
  form.append(addInclude);
  section.append(form);
  return section;
}

/** @param {HomeSnapshot} data Current project facts.
 * @returns {HTMLElement | undefined} Section when the current project exposes these controls.
 */
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

/** Snapshot focus candidates include stable controls, not text/graphics elements.
 * @returns {HTMLElement[]} Controls in document order, including disabled entries for positional recovery.
 */
function focusableControls() {
  return [...root.querySelectorAll("button, input, select, [tabindex]")].filter(
    (node) => node instanceof HTMLElement,
  );
}

function render() {
  const data = snapshot;
  const active = document.activeElement;
  const hadFocus = active instanceof HTMLElement && root.contains(active);
  const focusKey = hadFocus ? active.dataset.focusKey : undefined;
  const focusId = hadFocus ? active.id : undefined;
  const oldControls = focusableControls();
  const focusIndex = oldControls.findIndex((node) => node === active);
  const scrollTop = document.getElementById("incoming-files")?.scrollTop ?? 0;
  const pageScroll = window.scrollY;
  // Host refreshes must not discard an unsubmitted field value or its caret.
  const draft = active instanceof HTMLInputElement ? active.value : undefined;
  const start = active instanceof HTMLInputElement ? active.selectionStart : null;
  const end = active instanceof HTMLInputElement ? active.selectionEnd : null;
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
  const list = document.getElementById("incoming-files");
  if (list) {
    list.scrollTop = scrollTop;
  }
  if (hadFocus) {
    const controls = focusableControls();
    let replacement = controls.find((node) =>
      focusKey ? node.dataset.focusKey === focusKey : Boolean(focusId && node.id === focusId),
    );
    // A removed action/path hands focus to its nearest surviving control.
    if (!replacement || replacement.matches(":disabled") || replacement.closest("[hidden]")) {
      const available = controls.filter(
        (node) => !node.matches(":disabled") && !node.closest("[hidden]"),
      );
      replacement = available[Math.min(Math.max(0, focusIndex), available.length - 1)] ?? root;
    }
    if (draft !== undefined && replacement instanceof HTMLInputElement) {
      replacement.value = draft;
      if (start !== null && end !== null) {
        replacement.setSelectionRange(start, end);
      }
    }
    replacement.focus({ preventScroll: true });
  }
  window.scrollTo(0, pageScroll);
}

/** @typedef {(HomeSnapshot & {type:"snapshot"}) | {type:"actionComplete",command:string,error?:string}} HomeMessage */
window.addEventListener("message", (/** @type {MessageEvent<HomeMessage>} */ event) => {
  const message = event.data;
  if (message.type === "snapshot") {
    // Identical filesystem/status refreshes must not reset a screen reader's browse position.
    const changed = JSON.stringify(snapshot) !== JSON.stringify(message);
    snapshot = message;
    pending.clear();
    actionStatus.textContent = "";
    if (changed) {
      render();
    }
    return;
  }
  pending.delete(message.command);
  actionStatus.classList.toggle("error", Boolean(message.error));
  if (message.error) {
    actionStatus.textContent = message.error;
  } else {
    actionStatus.textContent = "Updated.";
  }
  render();
});

vscode.postMessage({ type: "ready" });
