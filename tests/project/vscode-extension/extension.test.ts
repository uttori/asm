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

type ExtensionManifest = {
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isStringArrayRecord = (value: unknown): value is Record<string, string[]> =>
  isRecord(value) && Object.values(value).every((entry) => isStringArray(entry));

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isGrammar(value: unknown): value is Grammar {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.scopeName !== "string") {
    return false;
  }
  if (!Array.isArray(value.patterns)) {
    return false;
  }
  if (
    !value.patterns.every(
      (pattern) =>
        isRecord(pattern) && (pattern.include === undefined || typeof pattern.include === "string"),
    )
  ) {
    return false;
  }
  return value.repository === undefined || isRecord(value.repository);
}

function isMenuEntries(value: unknown): value is Array<{ command: string; when?: string }> {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) && typeof entry.command === "string" && isOptionalString(entry.when),
    )
  );
}

function isExtensionManifest(value: unknown): value is ExtensionManifest {
  if (!isRecord(value) || !isRecord(value.contributes) || !isRecord(value.capabilities)) {
    return false;
  }
  const contributes = value.contributes;
  if (
    !Array.isArray(contributes.commands) ||
    !contributes.commands.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.command === "string" &&
        typeof entry.title === "string" &&
        typeof entry.category === "string" &&
        isOptionalString(entry.when),
    )
  ) {
    return false;
  }
  if (
    !Array.isArray(contributes.languages) ||
    !contributes.languages.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.id === "string" &&
        (entry.extensions === undefined || isStringArray(entry.extensions)) &&
        isOptionalString(entry.firstLine),
    )
  ) {
    return false;
  }
  if (
    !Array.isArray(contributes.grammars) ||
    !contributes.grammars.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.scopeName === "string" &&
        typeof entry.path === "string" &&
        isOptionalString(entry.language),
    )
  ) {
    return false;
  }
  if (!isRecord(contributes.menus) || !isMenuEntries(contributes.menus.commandPalette)) {
    return false;
  }
  if (!isMenuEntries(contributes.menus["editor/title/run"])) {
    return false;
  }
  if (!isRecord(contributes.configuration) || !isRecord(contributes.configuration.properties)) {
    return false;
  }
  if (!Object.values(contributes.configuration.properties).every((entry) => isRecord(entry))) {
    return false;
  }
  if (
    !Array.isArray(contributes.semanticTokenScopes) ||
    !contributes.semanticTokenScopes.every(
      (entry) =>
        isRecord(entry) && typeof entry.language === "string" && isStringArrayRecord(entry.scopes),
    )
  ) {
    return false;
  }
  if (
    !isRecord(contributes.viewsContainers) ||
    !Array.isArray(contributes.viewsContainers.activitybar)
  ) {
    return false;
  }
  if (
    !contributes.viewsContainers.activitybar.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.id === "string" &&
        typeof entry.title === "string" &&
        typeof entry.icon === "string",
    )
  ) {
    return false;
  }
  if (!isRecord(contributes.views)) {
    return false;
  }
  if (
    !Object.values(contributes.views).every(
      (views) =>
        Array.isArray(views) &&
        views.every(
          (entry) =>
            isRecord(entry) &&
            typeof entry.type === "string" &&
            typeof entry.id === "string" &&
            typeof entry.name === "string",
        ),
    )
  ) {
    return false;
  }
  if (
    !Array.isArray(contributes.viewsWelcome) ||
    !contributes.viewsWelcome.every(
      (entry) =>
        isRecord(entry) && typeof entry.view === "string" && typeof entry.contents === "string",
    )
  ) {
    return false;
  }
  if (!isRecord(value.capabilities.untrustedWorkspaces)) {
    return false;
  }
  const untrusted = value.capabilities.untrustedWorkspaces;
  return (
    typeof untrusted.supported === "string" && isStringArray(untrusted.restrictedConfigurations)
  );
}

function readGrammar(fileName: string): { grammar: Grammar; source: string } {
  const grammarPath = path.join(syntaxDirectory, fileName);
  const source = fs.readFileSync(grammarPath, "utf8");
  const parsed: unknown = JSON.parse(source);
  if (!isGrammar(parsed)) {
    throw new Error(`${fileName} is not a TextMate grammar.`);
  }
  return { grammar: parsed, source };
}

test("VS Code manifest exposes 65xx and SNES language modes", (t) => {
  const parsed: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!isExtensionManifest(parsed)) {
    throw new Error("VS Code manifest is missing the Uttori language contribution.");
  }
  const manifest = parsed;

  const commands = new Set(manifest.contributes.commands.map((entry) => entry.command));
  for (const command of [
    "asm.source.init",
    "asm.source.initDiz",
    "asm.source.prepare",
    "asm.source.preview",
    "asm.source.apply",
    "asm.source.finish",
    "asm.source.abort",
    "asm.source.editResearch",
    "asm.source.editAnalysis",
  ]) {
    t.true(commands.has(command), command);
  }
  for (const command of commands) {
    t.notRegex(
      command,
      /^asm\.(?:disassembly|modification|rebase|retention|metadata|allocation)\./,
    );
  }
  t.true(manifest.contributes.commands.some((entry) => entry.title === "Build Binary"));
  t.true(
    manifest.contributes.commands.some((entry) => entry.title === "Create Git Source Project"),
  );
  t.true(
    manifest.contributes.commands.some(
      (entry) => entry.title === "Create Git Source Project from Diz Research",
    ),
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
    Object.keys(properties).toSorted(),
    [
      "asm.architecture",
      "asm.analysisProject",
      "asm.analysis.maxWorkItems",
      "asm.analysis.maxMemoryMiB",
      "asm.analysis.cacheMaxMiB",
      "asm.analysis.storageMaxMiB",
      "asm.analysis.showAnnotations",
      "asm.analysis.annotationColumn",
      "asm.trace.maxImportSizeMiB",
      "asm.trace.indexMode",
      "asm.baseImage",
      "asm.buildOutput",
      "asm.configFile",
      "asm.debug.captureContext",
      "asm.debug.traceDetail",
      "asm.debug.traceMode",
      "asm.debug.captureSink",
      "asm.debug.liveBusAnalysis",
      "asm.debug.liveBusMaxLagMiB",
      "asm.editorInfo.preset",
      "asm.editorInfo.inline.enabled",
      "asm.editorInfo.inline.parts",
      "asm.editorInfo.inline.separator",
      "asm.editorInfo.inline.placement",
      "asm.editorInfo.inline.column",
      "asm.editorInfo.inline.color",
      "asm.editorInfo.inline.maxCharacters",
      "asm.editorInfo.hover.enabled",
      "asm.editorInfo.hover.rows",
      "asm.entryPoints",
      "asm.includePaths",
      "asm.plugins",
      "asm.target",
      "uttoriAsmLanguageServer.trace.server",
    ].toSorted(),
  );
  t.deepEqual(properties["uttoriAsmLanguageServer.trace.server"]?.enum, [
    "off",
    "messages",
    "verbose",
  ]);
  t.deepEqual(properties["asm.debug.captureSink"]?.enum, ["stream", "native-file"]);
  t.is(properties["asm.debug.captureSink"]?.default, "stream");
  t.deepEqual(properties["asm.debug.traceMode"]?.enum, [
    "live",
    "lossless-instructions",
    "lossless-bus",
    "lossless-bus-transfers",
    "lossless-bus-ppu",
  ]);
  t.false("enum" in properties["asm.architecture"]);
  t.is(manifest.capabilities.untrustedWorkspaces.supported, "limited");
  t.deepEqual(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations, [
    "asm.configFile",
    "asm.plugins",
  ]);
  t.true(manifest.contributes.viewsContainers.activitybar.some(({ id }) => id === "uttori-asm"));
  const views = manifest.contributes.views["uttori-asm"] ?? [];
  t.deepEqual(Object.fromEntries(views.map(({ id, type }) => [id, type])), {
    "uttori-asm.projectPanel": "webview",
    "uttori-asm.indexDetails": "tree",
    "uttori-asm.projectOutline": "tree",
    "uttori-asm.sourceProject": "tree",
    "uttori-asm.sources": "tree",
    "uttori-asm.analysisCoverage": "tree",
  });
  t.deepEqual(manifest.contributes.viewsWelcome.map(({ view }) => view).toSorted(), [
    "uttori-asm.analysisCoverage",
    "uttori-asm.projectOutline",
    "uttori-asm.sources",
  ]);
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
  t.true(source.includes("initializationOptions: serverInitializationOptions()"));
  t.false(source.includes("configurationSection"));
  t.true(source.includes("uttori-snes"));
  t.true(source.includes("uttori-65xx"));
  t.true(source.includes("traceOutputChannel"));
  t.true(source.includes("uttori-asm.config.json"));
  t.true(source.includes("asm.initConfig"));
  t.true(source.includes("ProjectPanelProvider"));
  t.true(source.includes("ProjectOutlineProvider"));
  t.true(source.includes("AnalysisCoverageProvider"));
  t.false(source.includes("AnalysisGraphProvider"));
  t.true(source.includes("AnalysisEvidenceInspector"));
  t.true(source.includes("asm.coverage.refresh"));
  t.true(source.includes("asm.analysis.navigate"));
  t.true(source.includes("navigateToAnalysisLocation"));
  t.true(source.includes("asm.coverage.classifyRange"));
  t.true(source.includes("asm.coverage.setStateEntryPoint"));
  t.true(source.includes("asm.coverage.resolveTarget"));
  t.true(source.includes("asm.coverage.renameLabel"));
  t.true(source.includes("asm.coverage.explainEvidence"));
  t.false(source.includes("asm.coverage.undo"));
  t.false(source.includes("asm.coverage.redo"));
  t.true(source.includes("**/analysis.json"));
  t.true(source.includes("**/analysis/**/*.json"));
  t.true(source.includes("asm/indexUpdated"));
  t.true(source.includes("resolveBuildEntryUri"));
  t.true(source.includes("outputChannel"));
  t.true(source.includes("Build Binary requested"));
});

test("analysis navigation preserves identity and navigates source-first", (t) => {
  const tree = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/analysis/navigation-target.ts"),
    "utf8",
  );
  const navigation = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/analysis/navigation.ts"),
    "utf8",
  );
  const maps = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/analysis/debug-maps.ts"),
    "utf8",
  );
  t.true(tree.includes("romContentSha256"));
  t.true(tree.includes("addressSpace"));
  t.true(maps.includes("validateDebugMap"));
  t.true(maps.includes("parsed.output.sha256 === candidate.romContentSha256"));
  t.true(maps.includes("parsed.output.size === candidate.romContentSize"));
  t.true(maps.includes("analysisSourceSha256(file) === source.sha256"));
  t.true(navigation.includes('customRequest("disassemble"'));
  t.true(navigation.includes("Persisted analysis disassembly (read-only)"));
  t.true(navigation.includes("Unknown operand bytes remain ??"));
});

test("analysis annotations remain hash-gated and presentation-only", (t) => {
  const extension = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/extension.ts"),
    "utf8",
  );
  const controller = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/analysis/annotation-controller.ts"),
    "utf8",
  );
  const format = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/editor-info/format.ts"),
    "utf8",
  );
  const debugAnnotations = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/debug/analysis-annotations.ts"),
    "utf8",
  );
  const debugging = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/debug/session.ts"),
    "utf8",
  );
  const navigation = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/analysis/navigation.ts"),
    "utf8",
  );

  t.true(extension.includes("AnalysisAnnotationController"));
  t.true(extension.includes("onDidChangeTextDocument"));
  t.true(extension.includes("onDidSaveTextDocument"));
  t.false(controller.includes("loadAnalysisProject"));
  t.true(format.includes("info.annotations ?? []"));
  t.true(controller.includes("createTextEditorDecorationType"));
  t.true(controller.includes("this.provider.invalidate()"));
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
    path.join(root, "packages/vscode-extension/src/analysis/navigation-data.ts"),
    "utf8",
  );
  t.true(navigationData.includes("buildInstructionAnalysisAnnotations"));
  t.true(navigationData.includes("formatInstructionAnnotationSummary"));
});

test("project panel CSS uses VS Code workbench tokens", (t) => {
  const css = fs.readFileSync(path.join(root, "packages/vscode-extension/media/panel.css"), "utf8");
  const panel = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/project/panel.ts"),
    "utf8",
  );
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
