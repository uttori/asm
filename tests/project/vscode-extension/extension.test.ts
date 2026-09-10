import fs from "node:fs";
import path from "node:path";

import { test } from "../../ava-helper.js";

const root = path.resolve(import.meta.dirname, "../../..");
const manifestPath = path.join(root, "packages/vscode-extension/package.json");
const syntaxDirectory = path.join(root, "packages/vscode-extension/syntaxes");

type Grammar = {
  name: string;
  scopeName: string;
  patterns: Array<{ include?: string }>;
  repository?: Record<string, unknown>;
};

function readGrammar(fileName: string): { grammar: Grammar; source: string } {
  const grammarPath = path.join(syntaxDirectory, fileName);
  const source = fs.readFileSync(grammarPath, "utf8");
  return { grammar: JSON.parse(source) as Grammar, source };
}

test("VS Code manifest exposes 65xx and SNES language modes", (t) => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    contributes: {
      commands: Array<{ command: string; title: string; category: string; when?: string }>;
      languages: Array<{ id: string; extensions?: string[]; firstLine?: string }>;
      grammars: Array<{ language?: string; scopeName: string; path: string }>;
      menus: {
        commandPalette: Array<{ command: string; when?: string }>;
        "editor/title/run": Array<{ command: string; when?: string }>;
      };
      configuration: { properties: Record<string, Record<string, unknown>> };
      semanticTokenScopes: Array<{
        language: string;
        scopes: Record<string, string[]>;
      }>;
      viewsContainers: { activitybar: Array<{ id: string; title: string; icon: string }> };
      views: Record<string, Array<{ type: string; id: string; name: string }>>;
      viewsWelcome: Array<{ view: string; contents: string }>;
    };
    capabilities: {
      untrustedWorkspaces: { supported: string; restrictedConfigurations: string[] };
    };
  };

  t.deepEqual(
    manifest.contributes.commands.map((entry) => entry.command),
    [
      "asm.createDisassemblyProject",
      "asm.importDizProject",
      "asm.build",
      "asm.analysis.toggleAnnotations",
      "asm.toggleWatch",
      "asm.runEmulator",
      "asm.debugEmulator",
      "asm.runAndWatch",
      "asm.configureEmulatorRuntime",
      "asm.initConfig",
      "asm.openPanel",
      "asm.outline.refresh",
      "asm.coverage.refresh",
      "asm.analysisGraph.refresh",
      "asm.sources.refresh",
      "asm.sources.compare",
      "asm.sources.resetComparison",
      "asm.analysis.navigate",
      "asm.coverage.classifyRange",
      "asm.coverage.setStateEntryPoint",
      "asm.coverage.resolveTarget",
      "asm.coverage.renameLabel",
      "asm.disassembly.editAnnotation",
      "asm.coverage.explainEvidence",
      "asm.coverage.undo",
      "asm.coverage.redo",
      "asm.capture.idle",
      "asm.capture.guide",
      "asm.capture.demo",
      "asm.capture.behavior",
      "asm.capture.stop",
      "asm.capture.review",
      "asm.trace.start",
      "asm.trace.stop",
      "asm.trace.stopAnalyze",
      "asm.trace.importRegenerate",
      "asm.heuristics.configure",
      "asm.heuristics.preview",
      "asm.ramMap.open",
      "asm.disassembly.status",
      "asm.disassembly.regenerate",
    ],
  );
  t.true(manifest.contributes.commands.every((entry) => entry.category === "Assembly"));
  t.true(manifest.contributes.commands.some((entry) => entry.title === "Build Binary"));
  t.true(
    manifest.contributes.commands.some(
      (entry) => entry.title === "Create Disassembly Project from ROM",
    ),
  );
  t.true(
    manifest.contributes.commands.some((entry) => entry.title === "Import Diz Disassembly Project"),
  );
  t.deepEqual(
    manifest.contributes.languages.map((entry) => entry.id),
    ["uttori-snes", "uttori-65xx"],
  );
  t.deepEqual(manifest.contributes.languages[0]?.extensions, [
    ".asm",
    ".src",
    ".SRC",
    ".s",
    ".inc",
  ]);
  t.is(
    manifest.contributes.languages[0]?.firstLine,
    "(?i)^\\s*(lorom|hirom|exlorom|exhirom|sa1rom|sfxrom|norom|fullsa1rom)\\b",
  );
  t.is(manifest.contributes.languages[1]?.extensions, undefined);
  t.is(
    manifest.contributes.menus.commandPalette.find(
      ({ command }) => command === "asm.analysis.navigate",
    )?.when,
    "false",
  );
  t.true(
    manifest.contributes.menus.commandPalette
      .filter(({ command }) => command !== "asm.analysis.navigate")
      .every((entry) => entry.when === undefined),
  );
  t.is(
    manifest.contributes.menus["editor/title/run"][0]?.when,
    "editorLangId == uttori-snes || editorLangId == uttori-65xx || resourceExtname == .asm || resourceExtname == .src || resourceExtname == .SRC || resourceExtname == .s || resourceExtname == .inc",
  );
  t.true(Array.isArray(manifest.contributes.semanticTokenScopes));
  t.deepEqual(
    manifest.contributes.semanticTokenScopes.map((entry) => entry.language),
    ["uttori-snes", "uttori-65xx"],
  );
  t.true(
    manifest.contributes.semanticTokenScopes.every(
      (entry) =>
        Array.isArray(entry.scopes.label) &&
        entry.scopes.label.includes("entity.name.function.label.uttori-asm"),
    ),
  );
  t.deepEqual(manifest.contributes.grammars, [
    {
      scopeName: "source.uttori-asm.base",
      path: "./syntaxes/uttori-asm-base.tmLanguage.json",
    },
    {
      language: "uttori-65xx",
      scopeName: "source.uttori-65xx",
      path: "./syntaxes/uttori-65xx.tmLanguage.json",
    },
    {
      language: "uttori-snes",
      scopeName: "source.uttori-snes",
      path: "./syntaxes/uttori-snes.tmLanguage.json",
    },
  ]);

  const properties = manifest.contributes.configuration.properties;
  t.deepEqual(
    Object.keys(properties).sort(),
    [
      "asm.architecture",
      "asm.analysisProject",
      "asm.analysis.maxWorkItems",
      "asm.analysis.maxMemoryMiB",
      "asm.analysis.showAnnotations",
      "asm.analysis.annotationColumn",
      "asm.trace.maxImportSizeMiB",
      "asm.trace.indexMode",
      "asm.baseImage",
      "asm.buildOutput",
      "asm.configFile",
      "asm.debug.traceDetail",
      "asm.debug.traceMode",
      "asm.entryPoints",
      "asm.includePaths",
      "asm.plugins",
      "asm.target",
      "uttoriAsmLanguageServer.trace.server",
    ].sort(),
  );
  t.deepEqual(properties["uttoriAsmLanguageServer.trace.server"]?.enum, [
    "off",
    "messages",
    "verbose",
  ]);
  t.false("enum" in properties["asm.architecture"]);
  t.is(manifest.capabilities.untrustedWorkspaces.supported, "limited");
  t.deepEqual(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations, [
    "asm.configFile",
    "asm.plugins",
  ]);
  t.is(manifest.contributes.viewsContainers.activitybar[0]?.id, "uttori-asm");
  t.is(manifest.contributes.views["uttori-asm"]?.[0]?.id, "uttori-asm.projectPanel");
  t.is(manifest.contributes.views["uttori-asm"]?.[0]?.type, "webview");
  t.is(manifest.contributes.views["uttori-asm"]?.[1]?.id, "uttori-asm.projectOutline");
  t.is(manifest.contributes.views["uttori-asm"]?.[1]?.type, "tree");
  t.is(manifest.contributes.views["uttori-asm"]?.[2]?.id, "uttori-asm.analysisCoverage");
  t.is(manifest.contributes.views["uttori-asm"]?.[2]?.type, "tree");
  t.is(manifest.contributes.views["uttori-asm"]?.[3]?.id, "uttori-asm.analysisGraph");
  t.is(manifest.contributes.views["uttori-asm"]?.[3]?.type, "tree");
  t.is(manifest.contributes.viewsWelcome?.[0]?.view, "uttori-asm.projectOutline");
  t.is(manifest.contributes.viewsWelcome?.[1]?.view, "uttori-asm.analysisCoverage");
  t.is(manifest.contributes.viewsWelcome?.[2]?.view, "uttori-asm.analysisGraph");
});

test("65xx grammar covers CPU mnemonics and omits SNES coprocessors", (t) => {
  const { grammar, source } = readGrammar("uttori-65xx.tmLanguage.json");
  const base = readGrammar("uttori-asm-base.tmLanguage.json");

  t.is(grammar.name, "Uttori 65xx");
  t.is(grammar.scopeName, "source.uttori-65xx");
  t.deepEqual(grammar.patterns, [{ include: "source.uttori-asm.base" }]);
  t.deepEqual(
    base.grammar.patterns.map((pattern) => pattern.include),
    [
      "#comments",
      "#strings",
      "#labels",
      "#numbers",
      "#mnemonics",
      "#size-suffixes",
      "#macros",
      "#pseudo-ops",
      "#defines",
      "#struct-access",
      "#immediate-labels",
      "#local-label-refs",
      "#directives",
      "#functions",
      "#operators",
    ],
  );
  t.true(base.source.includes("(?![A-Za-z0-9_.:])"));
  t.true(/\bLDA\b/.test(base.source));
  t.true(/\bXCE\b/.test(base.source));
  t.true(base.source.includes("if|elseif|else|endif"));
  t.true(base.source.includes("entity.name.type.struct.uttori-asm"));
  t.true(base.source.includes("variable.other.member.uttori-asm"));
  t.true(base.source.includes("(?<=[\\\\w}\\\\]])\\\\."));
  t.true(base.source.includes("#([A-Za-z_][A-Za-z0-9_]*)"));
  t.true(base.source.includes("(?<![A-Za-z0-9_])"));
  t.true(base.source.includes("entity.name.namespace.uttori-asm"));
  t.true(base.source.includes("entity.name.label.local.uttori-asm"));
  t.true(base.source.includes("storage.modifier.size.uttori-asm"));
  t.true(base.source.includes("%[A-Za-z_]"));
  t.true(/\bwhile\b/.test(base.source));
  t.true(/\bpushns\b/.test(base.source));
  t.true(/\bsizeof\b/.test(base.source));
  t.true(base.source.includes("spc700-inline"));
  t.true(base.source.includes("keyword.directive.operand.uttori-asm"));
  t.true(base.source.includes("endstruct"));
  t.false(/\bADDW\b/.test(base.source));
  t.false(/\blorom\b/.test(base.source));
  t.false(/\bspc700\b/i.test(source));
  t.false(/\bsuperfx\b/i.test(source));
});

test("SNES grammar adds SPC700, SuperFX, and mapper directives on top of 65xx", (t) => {
  const { grammar, source } = readGrammar("uttori-snes.tmLanguage.json");

  t.is(grammar.name, "Uttori SNES");
  t.is(grammar.scopeName, "source.uttori-snes");
  t.deepEqual(grammar.patterns[0], { include: "source.uttori-asm.base#comments" });
  t.true(grammar.patterns.some((pattern) => pattern.include === "source.uttori-asm.base"));
  t.true("registers" in (grammar.repository ?? {}));
  t.true(/\bADDW\b/.test(source));
  t.true(/\bLMULT\b/.test(source));
  t.true(/\blorom\b/.test(source));
  t.true(/\bhirom\b/.test(source));
  t.true(/\bfreecode\b/.test(source));
  t.true(/\bspcblock\b/.test(source));
  t.true(source.includes("bankcross"));
  t.true(source.includes("keyword.directive.operand.uttori-snes"));
  t.true(source.includes("off|half|full|on"));
  t.true(source.includes("(title)"));
  t.true(source.includes("optimize"));
  t.true(source.includes("nspc"));
  t.true(source.includes("execute"));
  t.true(source.includes("push|pull|enable|disable"));
});

test("VS Code client propagates trust and every project environment setting", (t) => {
  const source = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/extension.ts"),
    "utf8",
  );
  for (const setting of [
    "configFile",
    "plugins",
    "target",
    "architecture",
    "entryPoints",
    "includePaths",
    "buildOutput",
    "baseImage",
  ]) {
    t.true(source.includes(`"${setting}"`));
  }
  t.true(source.includes("workspace.isTrusted"));
  t.true(source.includes("workspace.onDidGrantWorkspaceTrust"));
  t.true(source.includes('configurationSection: "asm"'));
  t.true(source.includes("uttori-snes"));
  t.true(source.includes("uttori-65xx"));
  t.true(source.includes("traceOutputChannel"));
  t.true(source.includes("uttori-asm.config.json"));
  t.true(source.includes("asm.initConfig"));
  t.true(source.includes("ProjectPanelProvider"));
  t.true(source.includes("ProjectOutlineProvider"));
  t.true(source.includes("AnalysisCoverageProvider"));
  t.true(source.includes("AnalysisGraphProvider"));
  t.true(source.includes("AnalysisProjectEditor"));
  t.true(source.includes("asm.coverage.refresh"));
  t.true(source.includes("asm.analysisGraph.refresh"));
  t.true(source.includes("asm.analysis.navigate"));
  t.true(source.includes("navigateToAnalysisLocation"));
  t.true(source.includes("asm.coverage.classifyRange"));
  t.true(source.includes("asm.coverage.setStateEntryPoint"));
  t.true(source.includes("asm.coverage.resolveTarget"));
  t.true(source.includes("asm.coverage.renameLabel"));
  t.true(source.includes("asm.coverage.explainEvidence"));
  t.true(source.includes("asm.coverage.undo"));
  t.true(source.includes("asm.coverage.redo"));
  t.true(source.includes("**/analysis.json"));
  t.true(source.includes("**/analysis/**/*.json"));
  t.true(source.includes("asm/indexUpdated"));
  t.true(source.includes("resolveBuildEntryUri"));
  t.true(source.includes("outputChannel"));
  t.true(source.includes("Build Binary requested"));
});

test("VS Code disassembly wizard probes, initializes, verifies, and opens an isolated project", (t) => {
  const extension = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/extension.ts"),
    "utf8",
  );
  const wizard = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/project-wizard.ts"),
    "utf8",
  );
  const bindings = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/snes-rom-bindings.ts"),
    "utf8",
  );
  t.true(extension.includes("registerProjectWizards"));
  t.true(wizard.includes("probeSnesProject"));
  t.true(wizard.includes("initializeSnesDisassemblyWorkspace"));
  t.true(wizard.includes("mapperSelectionRequired"));
  t.true(wizard.includes("the selected output directory must be empty"));
  t.true(wizard.includes('path: ".vscode/settings.json"'));
  t.true(wizard.includes('path: ".vscode/launch.json"'));
  t.true(wizard.includes('"asm.analysisProject": "analysis"'));
  t.true(wizard.includes("roundTrip.comparison.actualSha256"));
  t.true(wizard.includes('commands.executeCommand("vscode.openFolder"'));
  t.true(wizard.includes("rememberSnesRom"));
  t.true(bindings.includes("context.globalState.update"));
  t.false(wizard.includes('"asm.romPath"'));
});

test("VS Code disassembly maintenance makes trace-to-source changes explicit and measurable", (t) => {
  const source = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/disassembly-maintenance.ts"),
    "utf8",
  );
  const jobs = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/disassembly-maintenance-jobs.ts"),
    "utf8",
  );
  const panel = fs.readFileSync(
    path.join(root, "packages/vscode-extension/media/panel.html"),
    "utf8",
  );
  t.true(jobs.includes("importRuntimeTraceIntoProject"));
  t.true(jobs.includes("analyzeSnesProject"));
  t.true(jobs.includes("exportSnesProject"));
  t.true(jobs.includes("verifySnesProjectRoundTrip"));
  t.false(source.includes("loadAnalysisProjectSnapshot"));
  t.true(source.includes("DisassemblyMaintenanceClient"));
  t.true(source.includes("Source status:"));
  t.true(source.includes("Source emitted as code:"));
  t.true(source.includes("validateSourceExportInputs"));
  t.true(source.includes("RAM-map variables:"));
  t.true(source.includes("A positive code-byte delta"));
  t.true(panel.includes("RAM map"));
  t.true(panel.includes("Import saved trace"));
  t.true(panel.includes("Analyze and regenerate"));
  t.true(panel.includes("Stop and analyze"));
  t.true(jobs.includes("summarizeExecutionWindow"));
  t.true(source.includes("Executed routines (function candidates)"));
  t.true(source.includes("Routine attribution from the saved analysis"));
});

test("analysis graph preserves identity and navigates source-first", (t) => {
  const tree = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/analysis-graph-tree.ts"),
    "utf8",
  );
  const navigation = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/analysis-navigation.ts"),
    "utf8",
  );
  const maps = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/analysis-debug-maps.ts"),
    "utf8",
  );
  t.true(tree.includes('analysisWorker().request<GraphProjection>(directory, "graph")'));
  t.false(tree.includes("loadAnalysisProject"));
  t.true(tree.includes("loadChildren"));
  t.true(tree.includes("const PAGE_SIZE = 200"));
  t.true(tree.includes("romContentSha256"));
  t.true(tree.includes("addressSpace"));
  t.true(maps.includes("validateDebugMap"));
  t.true(maps.includes("map.output.sha256 === candidate.romContentSha256"));
  t.true(maps.includes("map.output.size === candidate.romContentSize"));
  t.true(maps.includes("analysisSourceSha256(file) === source.sha256"));
  t.true(navigation.includes('customRequest("disassemble"'));
  t.true(navigation.includes("Persisted analysis disassembly (read-only)"));
  t.true(navigation.includes("unknown operand bytes remain ??"));
});

test("analysis annotations remain hash-gated and presentation-only", (t) => {
  const extension = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/extension.ts"),
    "utf8",
  );
  const controller = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/analysis-annotation-controller.ts"),
    "utf8",
  );
  const debugAnnotations = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/debug-analysis-annotations.ts"),
    "utf8",
  );
  const debugging = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/debug.ts"),
    "utf8",
  );
  const navigation = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/analysis-navigation.ts"),
    "utf8",
  );

  t.true(extension.includes("AnalysisAnnotationController"));
  t.true(extension.includes("onDidChangeTextDocument"));
  t.true(extension.includes("onDidSaveTextDocument"));
  t.false(controller.includes("loadAnalysisProject"));
  t.true(controller.includes('"annotations"'));
  t.true(controller.includes("createTextEditorDecorationType"));
  t.true(controller.includes("currentAnalysisSourcePath"));
  t.true(controller.includes("editor.visibleRanges"));
  t.true(debugAnnotations.includes("manifest.target !== map.target"));
  t.true(debugAnnotations.includes("manifest.rom.contentSha256 !== map.output.sha256"));
  t.true(debugAnnotations.includes("manifest.rom.contentSize !== map.output.size"));
  t.true(debugAnnotations.includes("byAddress.get"));
  t.true(debugAnnotations.includes("byOutputOffset.get"));
  t.true(debugging.includes("createDebugInstructionAnnotation"));
  t.true(debugging.includes("must never prevent debugger startup"));
  t.true(navigation.includes("analysisWorker()"));
  const navigationData = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/analysis-navigation-data.ts"),
    "utf8",
  );
  t.true(navigationData.includes("buildInstructionAnalysisAnnotations"));
  t.true(navigationData.includes("formatInstructionAnnotationSummary"));
});

test("analysis coverage editing is trusted, transactional, and reversible", (t) => {
  const source = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/analysis-project-editor.ts"),
    "utf8",
  );
  t.true(source.includes("workspace.isTrusted"));
  t.true(source.includes("loadAnalysisProjectSnapshot"));
  t.true(source.includes("commitAnalysisProjectViewUpdate"));
  t.true(source.includes("applyRangeClassificationEdit"));
  t.true(source.includes("revertRangeClassificationEdit"));
  t.true(source.includes("applyStateEntryPointEdit"));
  t.true(source.includes("revertStateEntryPointEdit"));
  t.true(source.includes("applyTargetResolutionEdit"));
  t.true(source.includes("revertTargetResolutionEdit"));
  t.true(source.includes("applyLabelRenameEdit"));
  t.true(source.includes("revertLabelRenameEdit"));
  t.true(source.includes("explainProjectEvidence"));
  t.true(source.includes("asm.coverage.canUndo"));
  t.true(source.includes("asm.coverage.canRedo"));
});

test("project panel CSS uses VS Code workbench tokens", (t) => {
  const css = fs.readFileSync(path.join(root, "packages/vscode-extension/media/panel.css"), "utf8");
  const panel = fs.readFileSync(path.join(root, "packages/vscode-extension/src/panel.ts"), "utf8");
  t.true(css.includes("@media (max-width: 250px)"));
  t.true(css.includes("--vscode-dropdown-background"));
  t.true(css.includes("--vscode-focusBorder"));
  t.true(css.includes("--vscode-list-hoverBackground"));
  t.true(css.includes("--vscode-descriptionForeground"));
  t.true(css.includes("--vscode-button-hoverBackground"));
  t.true(panel.includes("displayName"));
  t.true(panel.includes("defaultArchitecture"));
  t.true(panel.includes("renderWebviewTemplate"));
});
