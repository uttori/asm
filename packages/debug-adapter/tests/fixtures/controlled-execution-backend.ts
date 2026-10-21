import { ReplayDebugBackend, type DebugAddress, type DebugBackendEvent, type DebugBreakpoint, type DebugStepKind, type DebugStopReason, type DebugSubscription } from "../../src/index.js";
import { debugConformanceScript } from "./debug-conformance-fixture.js";

/**
 * Stopped-only breakpoint backend with explicit event barriers. Tests can reproduce
 * sidecar response/event splits without relying on process timing or sleeps.
 */
export class ControlledExecutionBackend extends ReplayDebugBackend {
  readonly actions: string[] = [];
  readonly tables: number[][] = [];
  stopped = true;
  /** Hold continued events until releaseContinued() or the next pause. */
  delayContinued = false;
  /** Optional barriers/failures invoked after the corresponding operation starts. */
  onResume?: () => Promise<void>;
  onPause?: () => Promise<void>;
  onSet?: (addresses: readonly DebugAddress[]) => Promise<void>;
  /** Reject before execution changes, without emitting a continued event. */
  resumeFailure?: Error;
  readonly #listeners = new Set<(event: DebugBackendEvent) => void>();
  #pendingContinued = 0;
  readonly #breakpointIds = new Map<string, number>();

  constructor() {
    super(debugConformanceScript);
  }

  override async connect(): Promise<void> {
    await super.connect();
    this.stop("entry");
  }

  override async disconnect(): Promise<void> {
    this.actions.push("disconnect");
    this.emit({ type: "terminated", restart: false });
  }

  override onEvent(listener: (event: DebugBackendEvent) => void): DebugSubscription {
    this.#listeners.add(listener);
    return { dispose: () => this.#listeners.delete(listener) };
  }

  emit(event: DebugBackendEvent): void {
    for (const listener of this.#listeners) {
      listener(event);
    }
  }

  /** Preserve native ordering: an execution stop always follows its continued event. */
  stop(reason: DebugStopReason): void {
    this.releaseContinued();
    this.stopped = true;
    this.emit({ type: "stopped", reason, threadId: 1 });
  }

  releaseContinued(): void {
    while (this.#pendingContinued > 0) {
      this.#pendingContinued--;
      this.emit({ type: "continued", threadId: 1, allThreads: true });
    }
  }

  override async continue(): Promise<void> {
    await this.#resume("continue");
  }

  override async step(_threadId: number, kind: DebugStepKind): Promise<void> {
    await this.#resume(`step:${kind}`);
  }

  async #resume(action: string): Promise<void> {
    if (!this.stopped) {
      throw new Error("Test backend is already running.");
    }
    this.actions.push(action);
    if (this.resumeFailure) {
      throw this.resumeFailure;
    }
    this.stopped = false;
    this.#pendingContinued++;
    if (!this.delayContinued) {
      this.releaseContinued();
    }
    await this.onResume?.();
  }

  override async pause(): Promise<void> {
    this.actions.push("pause");
    this.releaseContinued();
    if (this.onPause) {
      await this.onPause();
    } else {
      this.stop("pause");
    }
  }

  override async setBreakpoints(
    addresses: readonly DebugAddress[],
  ): Promise<readonly DebugBreakpoint[]> {
    if (!this.stopped) {
      throw new Error("Test backend must be stopped to change breakpoints.");
    }
    this.actions.push(`set:${addresses.length}`);
    this.tables.push(addresses.map(({ address }) => address));
    await this.onSet?.(addresses);
    return addresses.map((address) => {
      const key = `${address.architecture}|${address.addressSpace}|${address.address}`;
      const id = this.#breakpointIds.get(key) ?? this.#breakpointIds.size + 1;
      this.#breakpointIds.set(key, id);
      return { id, address, verified: true };
    });
  }
}
