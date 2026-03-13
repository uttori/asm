import type { CommandPipelineService } from "./services/command-pipeline-service.js";
import type { DefineEngine } from "./services/define-engine.js";
import type { FrontEndCommandService } from "./services/front-end-command-service.js";
import type { MacroEngine } from "./services/macro-engine.js";
import type { PreDispatchPipelineService } from "./services/pre-dispatch-pipeline-service.js";
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
    commandPipelineService: CommandPipelineService;
    defineEngine: DefineEngine;
    frontEndCommandService: FrontEndCommandService;
    macroEngine: MacroEngine;
    preDispatchPipelineService: PreDispatchPipelineService;
    romWriter: RomWriterService;
    structEngine: StructEngine;
    symbolScope: SymbolScopeService;
};
//# sourceMappingURL=assembler-internals.d.ts.map