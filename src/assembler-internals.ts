import type { DefineEngine } from "./services/define-engine.js";
import type { FrontEndCommandService } from "./services/front-end-command-service.js";
import type { MacroEngine } from "./services/macro-engine.js";
import type { RomWriterService } from "./services/rom-writer-service.js";
import type { StructEngine } from "./services/struct-engine.js";
import type { SymbolScopeService } from "./services/symbol-scope-service.js";

export type CursorAddressFacade = {
  recordCurrentAddress(): void;
  setWritePosition(address: number): void;
  syncWriteStarts(): void;
  incrementBytesWritten(num: number): void;
};

export type AssemblerServices = {
  defineEngine: DefineEngine;
  frontEndCommandService: FrontEndCommandService;
  macroEngine: MacroEngine;
  romWriter: RomWriterService;
  structEngine: StructEngine;
  symbolScope: SymbolScopeService;
};
