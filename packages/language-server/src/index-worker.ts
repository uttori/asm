import { parentPort } from "node:worker_threads";

import { bundledProjectOptions } from "./bundled-plugins.js";
import {
  ProjectEnvironmentController,
  type ProjectEnvironmentSettings,
} from "./project-environment.js";

if (!parentPort) {
  throw new Error("Index worker requires a parent port.");
}
/** Each worker owns one immutable request and is terminated after publication or cancellation. */
async function indexRequest(request: {
  readonly id: number;
  readonly settings: ProjectEnvironmentSettings;
  readonly overlays: readonly (readonly [string, string])[];
}): Promise<void> {
  const controller = new ProjectEnvironmentController(bundledProjectOptions);
  try {
    const state = await controller.replace(request.settings, new Map(request.overlays));
    parentPort!.postMessage({ id: request.id, snapshot: state.index.snapshot() });
  } catch (error) {
    parentPort!.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await controller.dispose();
    parentPort!.close();
  }
}
parentPort.once("message", (request: Parameters<typeof indexRequest>[0]) => {
  void indexRequest(request);
});
