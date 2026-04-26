import type { DefineEngine } from "./services/define-engine.js";
import type { AssemblyFrontEndService } from "./services/assembly-front-end-service.js";
import type { CommandLoweringService } from "./services/command-lowering-service.js";
import type { FrontEndCommandService } from "./services/front-end-command-service.js";
import type { AssemblyFileProvider } from "./file-provider.js";
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
    fileProvider?: AssemblyFileProvider;
    frontEnd?: AssemblyFrontEndService;
    frontEndCommandService: FrontEndCommandService;
    lowering?: CommandLoweringService;
    macroEngine: MacroEngine;
    romWriter: RomWriterService;
    structEngine: StructEngine;
    symbolScope: SymbolScopeService;
};
//# sourceMappingURL=assembler-internals.d.ts.map