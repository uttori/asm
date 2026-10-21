import {
  type SourceMergePreview,
  type SourceMergeStatus,
  type SourceProjectConfiguration,
} from "@uttori/asm-disassembler/source-project";
import type { SnesSourceBuild } from "@uttori/asm-plugin-snes/disassembler";
import type { AssetImportReview } from "@uttori/asm-workflows/asset-interchange";
import { EventEmitter, languages, type Disposable } from "vscode";

import { type AssetEditorVersion } from "./asset-drafts.js";
import { type SavedBuildInput } from "./build-inputs.js";
import { SourceGitFiles } from "./git-files.js";
import { SourceProcessClient } from "./process-client.js";
import { SourceRow } from "./ui-contracts.js";
/** Selected-project identity, drafts and durable-operation state shared by all UI coordinators. */
export class SourceProjectSession {
  readonly changed = new EventEmitter<SourceRow | undefined>();

  readonly built = new EventEmitter<{ readonly root: string; readonly build: SnesSourceBuild }>();

  readonly researchChanged = new EventEmitter<void>();

  readonly savedInput = new EventEmitter<void>();

  readonly selected = new EventEmitter<void>();

  worker!: SourceProcessClient;

  readonly files = new SourceGitFiles();

  readonly diagnostics = languages.createDiagnosticCollection("uttori-source");

  root?: string;
  /** Advances for every selection request so delayed filesystem/worker replies cannot select an old project. */
  selectionRevision = 0;

  configuration?: SourceProjectConfiguration;

  status?: SourceMergeStatus & {
    dirty: boolean;
    unstaged?: boolean;
    analysisReady?: boolean;
    analysisReason?: string;
    catalogReady?: boolean;
    catalogReason?: string;
  };

  branch = "";

  candidate?: string;

  preview?: SourceMergePreview;

  incoming: SourceRow[] = [];

  build?: SnesSourceBuild;

  /** Controls plus consumed dependencies for checking delayed saved-file notifications. */
  buildInputs: readonly SavedBuildInput[] = [];

  buildStale = true;

  busy?: string;

  /** Watcher changes during coordinated publication are delivered once, including interrupted partial publication. */
  assetSavedInputPending = false;

  refreshTimer?: NodeJS.Timeout;

  assetContextTimer?: NodeJS.Timeout;

  assetContextAbort?: AbortController;

  assetContextVersion = 0;

  watcher?: Disposable;

  epoch = 0;

  /** Last authoring input notification, retained to explain conservative publication invalidation. */
  epochInput?: string;

  /** Notification origin distinguishes actual saved-file events from editor draft changes. */
  epochEvent?: "text" | "binary" | "opaque" | "saved";

  /** UI review state never owns native bytes; the worker's durable plan remains authoritative. */
  assetReview?: {
    readonly root: string;
    readonly manifest: string;
    readonly document: string;
    readonly summary: AssetImportReview;
    readonly epoch: number;
    readonly versions: readonly AssetEditorVersion[];
  };
}
