import { type AsepriteDocument } from "./aseprite-document.js";
import type { IndexedPixels } from "./indexed-edit.js";
/**
 * Render one indexed frame with explicit clipping to its canvas. The parser preserves
 * diagonal flags independently of console policy; rectangular diagonal rendering rejects
 * until a proven rectangle transform is supplied. Input buffers are never modified.
 */
export declare function renderAsepriteFrame(document: AsepriteDocument, frameIndex: number, signal?: AbortSignal): IndexedPixels;
//# sourceMappingURL=aseprite-render.d.ts.map