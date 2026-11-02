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
  /** Source tree refresh signal; `undefined` refreshes the whole tree and also reschedules asset-menu probes. */
  readonly changed = new EventEmitter<SourceRow | undefined>();

  /** Fires after a successful build of the selected project with the matching debug map. */
  readonly built = new EventEmitter<{ readonly root: string; readonly build: SnesSourceBuild }>();

  /** Fires when saved research, `.uttori/` or Git state may have changed cached names. */
  readonly researchChanged = new EventEmitter<void>();

  /** Fires once per saved authoring input change; deferred while an asset publication is busy. */
  readonly savedInput = new EventEmitter<void>();

  /** Fires before a different project root replaces the current selection. */
  readonly selected = new EventEmitter<void>();

  /** Source worker process client; assigned by the controller before any session use. */
  worker!: SourceProcessClient;

  /** Read-only `uttori-source` file system serving Git revisions of selected roots. */
  readonly files = new SourceGitFiles();

  /** Diagnostics reported by source builds and workflow actions. */
  readonly diagnostics = languages.createDiagnosticCollection("uttori-source");

  /** Absolute root of the selected source project; undefined when no project is selected. */
  root?: string;
  /** Advances for every selection request so delayed filesystem/worker replies cannot select an old project. */
  selectionRevision = 0;

  /** Parsed `.uttori/project.json` of the selected root, re-read on every refresh. */
  configuration?: SourceProjectConfiguration;

  /** Last worker status for the selected root plus working-tree and analysis readiness flags. */
  status?: SourceMergeStatus & {
    dirty: boolean;
    unstaged?: boolean;
    analysisReady?: boolean;
    analysisReason?: string;
    catalogReady?: boolean;
    catalogReason?: string;
  };

  /** Current branch name, `detached HEAD`, or empty before the first refresh. */
  branch = "";

  /** Prepared generation commit selected for review, persisted per root in workspace state. */
  candidate?: string;

  /** Merge preview of the candidate; cleared whenever authoring inputs change. */
  preview?: SourceMergePreview;

  /** Tree rows describing the candidate's incoming changes; empty without a candidate. */
  incoming: SourceRow[] = [];

  /** Most recent successful build of the selected root. */
  build?: SnesSourceBuild;

  /** Controls plus consumed dependencies for checking delayed saved-file notifications. */
  buildInputs: readonly SavedBuildInput[] = [];

  /** True when no build exists or an authoring input changed after the displayed build. */
  buildStale = true;

  /** Action ID of the running foreground operation; undefined when idle. Refreshes are skipped while set. */
  busy?: string;

  /** Watcher changes during coordinated publication are delivered once, including interrupted partial publication. */
  assetSavedInputPending = false;

  /** Debounce timer (400 ms) for the status refresh triggered by watcher events. */
  refreshTimer?: NodeJS.Timeout;

  /** Debounce timer for the asset-representation menu probe. */
  assetContextTimer?: NodeJS.Timeout;

  /** Cancels the in-flight asset-menu probe; aborted on reschedule and project change. */
  assetContextAbort?: AbortController;

  /** Advances on every asset-menu schedule so stale probe results are discarded. */
  assetContextVersion = 0;

  /** File-system watcher subscriptions for the selected root; replaced on selection. */
  watcher?: Disposable;

  /** Advances on every authoring input change (text, binary, opaque draft or saved file). */
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
