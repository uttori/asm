import { PluginError } from "./diagnostics.js";
import type { OwnedContribution } from "./environment.js";
import type {
  AssemblyStageName,
  SessionCreationContext,
  SessionStateContribution,
  SessionStateKey,
  SessionStateStore,
} from "./contracts.js";

export type PluginStateSnapshot = Map<string, unknown>;

/** Owns the mutable plugin state for exactly one assembler session. */
export class PluginSessionStateStore implements SessionStateStore {
  readonly #contributions: readonly OwnedContribution<SessionStateContribution<unknown>>[];
  #values: PluginStateSnapshot;
  #disposed = false;

  constructor(
    contributions: readonly OwnedContribution<SessionStateContribution<unknown>>[],
    context: SessionCreationContext,
  ) {
    this.#contributions = contributions;
    this.#values = new Map();
    for (const record of contributions) {
      try {
        this.#values.set(record.contributionId, record.value.create(context));
      } catch (cause) {
        throw new PluginError(
          `Session state factory '${record.contributionId}' from '${record.pluginId}' failed.`,
          {
            code: "PLUGIN_ACTIVATION_FAILED",
            pluginId: record.pluginId,
            contributionId: record.contributionId,
            targetId: context.targetId,
            cause,
          },
        );
      }
    }
  }

  get<T>(slot: SessionStateKey<T>): T {
    if (!this.#values.has(slot.id)) {
      throw new PluginError(`Session state slot '${slot.id}' is not active.`, {
        code: "PLUGIN_CONFIGURATION_INVALID",
        contributionId: slot.id,
      });
    }
    return this.#values.get(slot.id) as T;
  }

  cloneSnapshot(source: ReadonlyMap<string, unknown> = this.#values): PluginStateSnapshot {
    const snapshot = new Map<string, unknown>();
    for (const record of this.#contributions) {
      if (!source.has(record.contributionId)) {
        throw new PluginError(`Session state snapshot is missing '${record.contributionId}'.`, {
          code: "PLUGIN_CONFIGURATION_INVALID",
          pluginId: record.pluginId,
          contributionId: record.contributionId,
        });
      }
      try {
        snapshot.set(record.contributionId, record.value.clone(source.get(record.contributionId)));
      } catch (cause) {
        throw new PluginError(`Session state clone '${record.contributionId}' failed.`, {
          code: "PLUGIN_HOOK_FAILED",
          pluginId: record.pluginId,
          contributionId: record.contributionId,
          cause,
        });
      }
    }
    return snapshot;
  }

  restore(snapshot: PluginStateSnapshot): void {
    this.#values = snapshot;
  }

  resetForStage(stage: AssemblyStageName): void {
    for (const record of this.#contributions) {
      const reset = record.value.resetForStage;
      if (!reset) continue;
      try {
        reset(this.#values.get(record.contributionId), stage);
      } catch (cause) {
        throw new PluginError(`Session state reset '${record.contributionId}' failed.`, {
          code: "PLUGIN_HOOK_FAILED",
          pluginId: record.pluginId,
          contributionId: record.contributionId,
          cause,
        });
      }
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    const errors: unknown[] = [];
    for (const record of [...this.#contributions].reverse()) {
      try {
        record.value.dispose?.(this.#values.get(record.contributionId));
      } catch (error) {
        errors.push(error);
      }
    }
    this.#values.clear();
    if (errors.length > 0) {
      throw new AggregateError(errors, "One or more plugin session-state slots failed to dispose.");
    }
  }
}
