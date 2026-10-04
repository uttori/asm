import { EventEmitter } from "vscode";

/** Recorder setup and durable finalization are busy phases; neither permits another capture. */
export type RuntimeCapturePhase = "idle" | "starting" | "recording" | "finalizing";

let phase: RuntimeCapturePhase = "idle";
const changed = new EventEmitter<RuntimeCapturePhase>();

/** Updates the source tree and command availability without polling a recorder or the filesystem. */
export const onDidChangeRuntimeCapture = changed.event;

/** Global state follows the recorder lease, including captures started from the command palette. */
export const runtimeCapturePhase = (): RuntimeCapturePhase => phase;

/** The debug-session recorder owns transitions; UI consumers only observe this state. */
export function setRuntimeCapturePhase(next: RuntimeCapturePhase): void {
  if (next !== phase) {
    phase = next;
    changed.fire(next);
  }
}
