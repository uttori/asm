/** The host owns persistence and receives structured-clone messages through this webview-scoped handle. */
interface WebviewApi<State> {
  getState(): State | undefined;
  setState(state: State): void;
  postMessage(message: unknown): void;
}
/** VS Code injects this function; a webview may acquire its handle only once. */
declare function acquireVsCodeApi<State>(): WebviewApi<State>;
