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
  el("palette").replaceChildren(
    ...state.palette.flatMap((rgba, index) => {
      if (index !== 0 && (index < paletteStart || index >= paletteStart + 16)) {
        return [];
      }
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-pressed", String(index === selected));
      button.setAttribute("aria-label", `Palette slot ${index}`);
      button.title = `Slot ${index}: RGBA ${rgba.join(", ")}`;
      const swatch = document.createElement("canvas");
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
/** Paint a single source pixel in the pending stroke; the host validates the complete patch again.
 * @param {PointerEvent} event Browser canvas coordinates.
 * @returns {void} Nothing; invalid presentation pixels remain unchanged.
 */
function point(event) {
  if (!state || !stroke) {
    return;
  }
  const bounds = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - bounds.left) / zoom);
  const y = Math.floor((event.clientY - bounds.top) / zoom);
  if (x < 0 || y < 0 || x >= state.width || y >= state.height || stroke.size >= 8192) {
    return;
  }
  const regions = at(x, y);
  if (state.regions && !regions.length) {
    el("error").textContent = "Paint inside an outlined source tile. This pixel is not encoded.";
    return;
  }
  if (
    selected !== 0 &&
    regions.some((region) => selected < region.paletteStart || selected >= region.paletteStart + 16)
  ) {
    el("error").textContent =
      "Choose a slot from this tile's palette group, or slot 0 for transparency.";
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
  canvas.focus({ preventScroll: true });
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
      // Ignore unknown host message kinds rather than treating them as failed edits.
      // oxlint-disable-next-line typescript/no-unnecessary-condition
    } else if (data.type === "error") {
      el("error").textContent = data.text;
      pending = false;
    }
  },
);
vscode.postMessage({ type: "ready" });
