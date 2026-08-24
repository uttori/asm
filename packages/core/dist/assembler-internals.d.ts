import type { DefineEngine } from "./services/define-engine.js";
import type { DirectiveRuntimeService } from "./services/directive-runtime-service.js";
import type { AssemblyFrontEndService } from "./services/assembly-front-end-service.js";
import type { CommandLoweringService } from "./services/command-lowering-service.js";
import type { FrontEndCommandService } from "./services/front-end-command-service.js";
import type { AssemblyFileProvider } from "./file-provider.js";
import type { IncludeSourceService } from "./services/include-source-service.js";
import type { MacroEngine } from "./services/macro-engine.js";
import type { OutputWriterService } from "./services/output-writer-service.js";
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
    directiveRuntime: DirectiveRuntimeService;
    fileProvider?: AssemblyFileProvider;
    frontEnd?: AssemblyFrontEndService;
    frontEndCommandService: FrontEndCommandService;
    includeSource: IncludeSourceService;
    lowering?: CommandLoweringService;
    macroEngine: MacroEngine;
    outputWriter: OutputWriterService;
    structEngine: StructEngine;
    symbolScope: SymbolScopeService;
};
//# sourceMappingURL=assembler-internals.d.ts.map