/** @typedef {import('../src/assets/png-guidance.js').PngEditRegion} EditRegion */
/** @typedef {{version:number,width:number,height:number,palette:number[][],indexes:Uint8Array,regions?:EditRegion[],diskIssue?:string}} IndexedCanvasState */
/** @typedef {Omit<IndexedCanvasState,'indexes'> & {type:'image',indexes:string}} ImageMessage */
/** @type {WebviewApi<{index?:number,zoom?:number}>} */
const vscode = acquireVsCodeApi();
/** Resolve a template-owned control; a missing element is a packaging error.
 * @param {string} id Template element identifier.
 * @returns {HTMLElement} Existing control.
 */
const el = (id) => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing PNG editor control: ${id}`);
  }
  return element;
};
const imageControl = el("image");
if (!(imageControl instanceof HTMLCanvasElement)) {
  throw new Error("The PNG editor image control must be a canvas.");
}
const canvas = imageControl;
const context = canvas.getContext("2d");
if (!context) {
  throw new Error("A 2D canvas is required for indexed PNG editing.");
}
/** @type {CanvasRenderingContext2D} */
const paintContext = context;
/** @type {IndexedCanvasState | undefined} */
let state;
let selected = vscode.getState()?.index ?? 0;
/** First slot of the visible 16-color group; global transparency remains available in every group. */
let paletteStart = Math.floor(selected / 16) * 16;
let zoom = vscode.getState()?.zoom ?? 4;
/** @type {Set<number> | undefined} */
let stroke;
let pending = false;
const zoomControl = el("zoom");
if (!(zoomControl instanceof HTMLSelectElement)) {
  throw new Error("The PNG editor zoom control must be a select.");
}
zoomControl.value = String(zoom);

function draw() {
  if (!state) {
    return;
  }
  // CSS zoom keeps the backing surface bounded to one megapixel even at 16×.
  canvas.width = state.width;
  canvas.height = state.height;
  canvas.style.width = `${state.width * zoom}px`;
  canvas.style.height = `${state.height * zoom}px`;
  const pixels = new ImageData(state.width, state.height);
  for (let pixel = 0; pixel < state.indexes.length; pixel++) {
    pixels.data.set(state.palette[state.indexes[pixel]], pixel * 4);
  }
  paintContext.putImageData(pixels, 0, 0);
  if (state.regions) {
    paintContext.strokeStyle = "rgba(100,180,255,0.8)";
    paintContext.lineWidth = 0.25;
    for (const region of state.regions) {
      paintContext.strokeRect(region.x, region.y, region.width, region.height);
    }
  }
}
/** Show one palette group without renumbering or collapsing duplicate color indexes. */
function slots() {
  if (!state) {
    return;
  }
  const active = document.activeElement;
  const focusedSlot =
    active instanceof HTMLElement && el("palette").contains(active)
      ? active.dataset.slot
      : undefined;
  el("palette").replaceChildren(
    ...state.palette.flatMap((rgba, index) => {
      if (index !== 0 && (index < paletteStart || index >= paletteStart + 16)) {
        return [];
      }
      const button = document.createElement("button");
      button.dataset.slot = String(index);
      button.type = "button";
      button.setAttribute("aria-pressed", String(index === selected));
      button.setAttribute("aria-label", `Palette slot ${index}, RGBA ${rgba.join(", ")}`);
      button.title = `Slot ${index}: RGBA ${rgba.join(", ")}`;
      const swatch = document.createElement("canvas");
      swatch.setAttribute("aria-hidden", "true");
      swatch.width = 24;
      swatch.height = 24;
      const paint = swatch.getContext("2d");
      if (!paint) {
        throw new Error("A 2D canvas is required for palette swatches.");
      }
      paint.fillStyle = `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3] / 255})`;
      paint.fillRect(0, 0, 24, 24);
      button.append(swatch, document.createTextNode(String(index)));
      button.addEventListener("click", () => {
        selected = index;
        slots();
        remember();
      });
      return button;
    }),
  );
  // Retain the selected swatch's focus rather than sending Tab back to the page start.
  if (focusedSlot !== undefined) {
    const buttons = [...el("palette").querySelectorAll("button")];
    const next = buttons.find((button) => button.dataset.slot === focusedSlot) ?? buttons.at(0);
    next?.focus({ preventScroll: true });
  }
  el("selection").textContent =
    `Palette slot ${selected} · paint a stroke, then save or undo normally.`;
}
/** Atlas recipes restrict usable groups; ordinary indexed images expose every group on demand. */
function paletteGroups() {
  if (!state) {
    return;
  }
  const starts = state.regions
    ? [...new Set(state.regions.map((region) => region.paletteStart))].toSorted((a, b) => a - b)
    : Array.from({ length: Math.ceil(state.palette.length / 16) }, (_, index) => index * 16);
  if (!starts.includes(paletteStart)) {
    paletteStart = starts[0] ?? 0;
    selected = 0;
  }
  const control = el("palette-group");
  if (!(control instanceof HTMLSelectElement)) {
    throw new Error("The PNG editor palette group control must be a select.");
  }
  const paletteLength = state.palette.length;
  control.replaceChildren(
    ...starts.map((start) => {
      const option = document.createElement("option");
      option.value = String(start);
      option.textContent = `${start}–${Math.min(start + 15, paletteLength - 1)}`;
      return option;
    }),
  );
  control.value = String(paletteStart);
  el("palette-group-label").hidden = starts.length < 2;
}
el("palette-group").addEventListener("change", () => {
  const control = el("palette-group");
  if (!(control instanceof HTMLSelectElement)) {
    throw new Error("The PNG editor palette group control must be a select.");
  }
  paletteStart = Number(control.value);
  // Keep transparency selected across groups; otherwise retain the local color slot.
  if (selected !== 0) {
    selected = Math.min(paletteStart + (selected % 16), (state?.palette.length ?? 1) - 1);
  }
  slots();
  remember();
});
function remember() {
  vscode.setState({ index: selected, zoom });
}
el("zoom").addEventListener("change", () => {
  zoom = Number(zoomControl.value);
  draw();
  remember();
});
/** Resolve the keyboard editor's coordinate fields; a missing/wrong input is a package error.
 * @param {string} id Coordinate field identifier.
 * @returns {HTMLInputElement} Number input with native range validation.
 */
function coordinateInput(id) {
  const input = el(id);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Invalid pixel coordinate control: ${id}`);
  }
  return input;
}

/** Read a bounded integer coordinate pair; invalid/empty fields must never select pixel zero.
 * @returns {{x:number,y:number} | undefined} Valid source coordinates, excluding empty or out-of-range fields.
 */
function coordinates() {
  const x = coordinateInput("pixel-x").valueAsNumber;
  const y = coordinateInput("pixel-y").valueAsNumber;
  if (
    !state ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= state.width ||
    y >= state.height
  ) {
    return undefined;
  }
  return { x, y };
}

/** Describe the source pixel and encoding ownership without requiring a visual preview. */
function inspectPixel() {
  const position = coordinates();
  el("paint-pixel").setAttribute("aria-disabled", String(pending || !position));
  if (!state || !position) {
    el("pixel-info").textContent = "Enter a column and row within the image bounds.";
    return;
  }
  const { x, y } = position;
  const index = state.indexes[y * state.width + x];
  const owners = at(x, y).map(
    (region) =>
      `${region.label}, slots ${region.paletteStart} through ${region.paletteStart + 15}, ${region.uses} pose uses`,
  );
  let ownership = "";
  if (state.regions) {
    ownership = owners.join("; ") || "Preview or padding; this pixel is not encoded.";
  }
  el("pixel-info").textContent =
    `Column ${x}, row ${y}: palette slot ${index}, RGBA ${state.palette[index].join(", ")}. ${ownership}`;
}

/** Configure the nonvisual editor after loading, including direct jumps to encoded tiles. */
function pixelControls() {
  if (!state) {
    return;
  }
  const control = el("region");
  if (!(control instanceof HTMLSelectElement)) {
    throw new Error("Invalid encoded tile selector.");
  }
  const previous = control.value;
  control.replaceChildren(
    ...(state.regions ?? []).map((region, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${region.label}: column ${region.x}, row ${region.y}, ${region.width} by ${region.height}, slots ${region.paletteStart}–${region.paletteStart + 15}`;
      return option;
    }),
  );
  control.value = previous || "0";
  el("region-label").hidden = !state.regions?.length;
  for (const [id, size] of [
    ["pixel-x", state.width],
    ["pixel-y", state.height],
  ]) {
    const input = coordinateInput(String(id));
    input.disabled = false;
    input.max = String(Number(size) - 1);
  }
  el("paint-pixel").removeAttribute("disabled");
  inspectPixel();
}

/** Validate encoding and palette ownership once for both pointer strokes and keyboard edits.
 * @param {number} x Unzoomed image column.
 * @param {number} y Unzoomed image row.
 * @returns {boolean} Whether the source pixel can use the selected slot.
 */
function canPaint(x, y) {
  if (!state || x < 0 || y < 0 || x >= state.width || y >= state.height) {
    return false;
  }
  const regions = at(x, y);
  if (state.regions && !regions.length) {
    el("error").textContent = "Paint inside an outlined source tile. This pixel is not encoded.";
    return false;
  }
  if (
    selected !== 0 &&
    regions.some((region) => selected < region.paletteStart || selected >= region.paletteStart + 16)
  ) {
    el("error").textContent =
      "Choose a slot from this tile's palette group, or slot 0 for transparency.";
    return false;
  }
  el("error").textContent = "";
  return true;
}

el("pixel-edit").addEventListener("submit", (event) => {
  event.preventDefault();
  const position = coordinates();
  if (!state || pending || !position || !canPaint(position.x, position.y)) {
    return;
  }
  pending = true;
  inspectPixel();
  vscode.postMessage({
    type: "paint",
    version: state.version,
    pixels: [position.y * state.width + position.x],
    index: selected,
  });
});
for (const id of ["pixel-x", "pixel-y"]) {
  el(id).addEventListener("input", inspectPixel);
}
el("region").addEventListener("change", () => {
  const control = el("region");
  if (!(control instanceof HTMLSelectElement)) {
    return;
  }
  const region = state?.regions?.[Number(control.value)];
  if (region) {
    coordinateInput("pixel-x").value = String(region.x);
    coordinateInput("pixel-y").value = String(region.y);
    inspectPixel();
  }
});

/** Paint a single source pixel in a bounded pending stroke.
 * @param {PointerEvent} event Browser canvas coordinates.
 */
function point(event) {
  if (!state || !stroke || stroke.size >= 8192) {
    return;
  }
  const bounds = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - bounds.left) / zoom);
  const y = Math.floor((event.clientY - bounds.top) / zoom);
  if (!canPaint(x, y)) {
    return;
  }
  stroke.add(y * state.width + x);
  const rgba = state.palette[selected];
  paintContext.clearRect(x, y, 1, 1);
  paintContext.fillStyle = `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3] / 255})`;
  paintContext.fillRect(x, y, 1, 1);
}
/** Only canonical recipe rectangles own pixels; composed occurrences can be flipped/shared.
 * @param {number} x Image column, before visual zoom.
 * @param {number} y Image row, before visual zoom.
 * @returns {Array<import('../src/assets/png-guidance.js').PngEditRegion>} Every tile consuming this pixel.
 */
function at(x, y) {
  return (
    state?.regions?.filter(
      (region) =>
        x >= region.x &&
        x < region.x + region.width &&
        y >= region.y &&
        y < region.y + region.height,
    ) ?? []
  );
}
canvas.addEventListener("pointerdown", (event) => {
  if (!state || pending || event.button !== 0) {
    return;
  }
  // Focusing a tall atlas must not scroll its canvas between the click and coordinate lookup.
  el("viewport").focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  stroke = new Set();
  point(event);
});
canvas.addEventListener("pointermove", (event) => {
  if (stroke) {
    point(event);
  }
  if (state?.regions) {
    const bounds = canvas.getBoundingClientRect();
    const regions = at(
      Math.floor((event.clientX - bounds.left) / zoom),
      Math.floor((event.clientY - bounds.top) / zoom),
    );
    el("tile").textContent =
      regions
        .map(
          (region) =>
            `${region.label} · slots ${region.paletteStart}–${region.paletteStart + 15} · ${region.uses} pose uses`,
        )
        .join("; ") || "Preview or padding · no encoded pixels here";
  }
});
canvas.addEventListener("pointerup", () => {
  if (!state || !stroke) {
    return;
  }
  const pixels = [...stroke];
  stroke = undefined;
  if (!pixels.length) {
    draw();
    return;
  }
  pending = true;
  inspectPixel();
  vscode.postMessage({ type: "paint", version: state.version, pixels, index: selected });
});
canvas.addEventListener("pointercancel", () => {
  stroke = undefined;
  draw();
});
window.addEventListener(
  "message",
  (/** @type {MessageEvent<ImageMessage | {type:'error',text:string}>} */ event) => {
    // Only the extension posts this contract. Stroke messages in the reverse direction remain untrusted.
    const data = event.data;
    if (data.type === "image") {
      state = {
        ...data,
        indexes: Uint8Array.from(atob(data.indexes), (character) => character.charCodeAt(0)),
      };
      selected = Math.min(selected, state.palette.length - 1);
      pending = false;
      stroke = undefined;
      el("size").textContent = `${state.width} × ${state.height}`;
      el("error").textContent = data.diskIssue ?? "";
      el("guidance").hidden = !data.regions;
      paletteGroups();
      slots();
      draw();
      pixelControls();
      // Ignore unknown host message kinds rather than treating them as failed edits.
      // oxlint-disable-next-line typescript/no-unnecessary-condition
    } else if (data.type === "error") {
      el("error").textContent = data.text;
      pending = false;
      inspectPixel();
    }
  },
);
vscode.postMessage({ type: "ready" });
