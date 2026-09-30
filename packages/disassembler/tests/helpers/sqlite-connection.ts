import { DatabaseSync as NativeDatabaseSync } from "node:sqlite";

import { registerRuntimeHistory } from "../../src/storage/sqlite-runtime-history.js";

/** Independent connections retain persisted-trigger tests while registering the history codec. */
export class DatabaseSync extends NativeDatabaseSync {
  constructor(...args: ConstructorParameters<typeof NativeDatabaseSync>) {
    super(...args);
    registerRuntimeHistory(this);
  }
}
