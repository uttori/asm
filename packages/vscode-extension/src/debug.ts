import * as fs from "node:fs";
import * as path from "node:path";

import type { DebugMap } from "@uttori/asm-core/debug-map";
import {
  DebugAdapterSession,
  ReplayDebugBackend,
  createDebugMapReplayScript,
  type DapProtocolMessage,
  type DapRequest,
  type ReplayScript,
} from "@uttori/asm-debug-adapter";
import {
  DebugAdapterInlineImplementation,
  EventEmitter,
  debug,
  type DebugAdapter,
  type DebugAdapterDescriptor,
  type DebugAdapterDescriptorFactory,
  type DebugAdapterExecutable,
  type DebugConfiguration,
  type DebugConfigurationProvider,
  type DebugSession,
  type Disposable,
  type Event,
  type ProviderResult,
  type WorkspaceFolder,
} from "vscode";

/** Debugger type contributed by the extension manifest. */
export const UTTORI_ASM_DEBUG_TYPE = "uttori-asm";

interface UttoriDebugConfiguration extends DebugConfiguration {
  readonly program: string;
  readonly debugMap: string;
  readonly sourceRoot?: string;
  readonly replay?: string;
}

const resolvedPath = (value: string, folder: WorkspaceFolder | undefined): string =>
  path.isAbsolute(value) ? value : path.resolve(folder?.uri.fsPath ?? process.cwd(), value);

const loadConfiguration = (
  session: DebugSession,
): {
  readonly backend: ReplayDebugBackend;
  readonly map: DebugMap;
  readonly output: Uint8Array;
  readonly sourceRoot: string;
} => {
  const configuration = session.configuration as UttoriDebugConfiguration;
  if (!configuration.program || !configuration.debugMap) {
    throw new Error("Uttori ASM debugging requires 'program' and 'debugMap'.");
  }
  const folder = session.workspaceFolder;
  const program = resolvedPath(configuration.program, folder);
  const mapFile = resolvedPath(configuration.debugMap, folder);
  const output = new Uint8Array(fs.readFileSync(program));
  const map = JSON.parse(fs.readFileSync(mapFile, "utf8")) as DebugMap;
  const script: ReplayScript = configuration.replay
    ? (JSON.parse(
        fs.readFileSync(resolvedPath(configuration.replay, folder), "utf8"),
      ) as ReplayScript)
    : createDebugMapReplayScript(map, output);
  return {
    backend: new ReplayDebugBackend(script),
    map,
    output,
    sourceRoot: resolvedPath(configuration.sourceRoot ?? ".", folder),
  };
};

class InlineDebugAdapter implements DebugAdapter {
  readonly #emitter = new EventEmitter<DapProtocolMessage>();
  readonly #session: DebugAdapterSession;
  readonly onDidSendMessage: Event<DapProtocolMessage> = this.#emitter.event;

  constructor(session: DebugSession) {
    const loaded = loadConfiguration(session);
    this.#session = new DebugAdapterSession({
      backend: loaded.backend,
      debugMap: loaded.map,
      output: loaded.output,
      sourceRoot: loaded.sourceRoot,
      onMessage: (message) => this.#emitter.fire(message),
    });
  }

  /** @param {DapRequest} message DAP request from VS Code. */
  handleMessage(message: DapRequest): void {
    void this.#session.dispatch(message);
  }

  /** Releases protocol and event resources. */
  dispose(): void {
    this.#session.dispose();
    this.#emitter.dispose();
  }
}

class UttoriDebugConfigurationProvider implements DebugConfigurationProvider {
  /**
   * Supplies a usable map-backed replay launch when `launch.json` is initially empty.
   * @param {WorkspaceFolder | undefined} folder Selected workspace folder.
   * @param {DebugConfiguration} configuration Partial configuration.
   * @returns {DebugConfiguration} Completed launch configuration.
   */
  resolveDebugConfiguration(
    folder: WorkspaceFolder | undefined,
    configuration: DebugConfiguration,
  ): DebugConfiguration {
    const root = folder?.uri.fsPath ?? "${workspaceFolder}";
    const configuredProgram =
      typeof configuration.program === "string" ? configuration.program : undefined;
    const configuredMap =
      typeof configuration.debugMap === "string" ? configuration.debugMap : undefined;
    const configuredSourceRoot =
      typeof configuration.sourceRoot === "string" ? configuration.sourceRoot : undefined;
    const program = configuredProgram ?? path.join(root, "build", "rebuilt-content.sfc");
    return {
      ...configuration,
      type: typeof configuration.type === "string" ? configuration.type : UTTORI_ASM_DEBUG_TYPE,
      request: typeof configuration.request === "string" ? configuration.request : "launch",
      name:
        typeof configuration.name === "string" ? configuration.name : "Debug Uttori ASM (Replay)",
      program,
      debugMap: configuredMap ?? `${program}.debug.json`,
      sourceRoot: configuredSourceRoot ?? root,
    };
  }
}

class UttoriDebugAdapterFactory implements DebugAdapterDescriptorFactory {
  /**
   * Hosts the adapter inside the extension process.
   * @param {DebugSession} session VS Code debug session.
   * @param {DebugAdapterExecutable | undefined} _executable Ignored external adapter descriptor.
   * @returns {ProviderResult<DebugAdapterDescriptor>} Inline adapter descriptor.
   */
  createDebugAdapterDescriptor(
    session: DebugSession,
    _executable: DebugAdapterExecutable | undefined,
  ): ProviderResult<DebugAdapterDescriptor> {
    return new DebugAdapterInlineImplementation(new InlineDebugAdapter(session));
  }
}

/**
 * Registers the Uttori ASM debug configuration and inline adapter factories.
 * @returns {readonly Disposable[]} Extension subscriptions.
 */
export const registerDebugging = (): readonly Disposable[] => [
  debug.registerDebugConfigurationProvider(
    UTTORI_ASM_DEBUG_TYPE,
    new UttoriDebugConfigurationProvider(),
  ),
  debug.registerDebugAdapterDescriptorFactory(
    UTTORI_ASM_DEBUG_TYPE,
    new UttoriDebugAdapterFactory(),
  ),
];
