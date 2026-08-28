import fs from "node:fs";
import path from "node:path";

import { test } from "./ava-helper.js";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(root, "editors/vscode/package.json");
const syntaxDirectory = path.join(root, "editors/vscode/syntaxes");

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
      viewsContainers: { activitybar: Array<{ id: string; title: string; icon: string }> };
      views: Record<string, Array<{ type: string; id: string; name: string }>>;
    };
    capabilities: {
      untrustedWorkspaces: { supported: string; restrictedConfigurations: string[] };
    };
  };

  t.deepEqual(
    manifest.contributes.commands.map((entry) => entry.command),
    ["asm.build", "asm.toggleWatch", "asm.initConfig", "asm.openPanel"],
  );
  t.true(manifest.contributes.commands.every((entry) => entry.category === "Assembly"));
  t.true(manifest.contributes.commands.some((entry) => entry.title === "Build Binary"));
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
  t.true(manifest.contributes.menus.commandPalette.every((entry) => entry.when === undefined));
  t.is(
    manifest.contributes.menus["editor/title/run"][0]?.when,
    "editorLangId == uttori-snes || editorLangId == uttori-65xx || resourceExtname == .asm || resourceExtname == .src || resourceExtname == .SRC || resourceExtname == .s || resourceExtname == .inc",
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
      "asm.baseImage",
      "asm.buildOutput",
      "asm.configFile",
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
});

test("VS Code client propagates trust and every project environment setting", (t) => {
  const source = fs.readFileSync(path.join(root, "editors/vscode/src/extension.ts"), "utf8");
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
  t.true(source.includes("resolveBuildEntryUri"));
  t.true(source.includes("outputChannel"));
  t.true(source.includes("Build Binary requested"));
});
