import fs from "node:fs";
import path from "node:path";

import { test } from "./ava-helper.js";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(root, "editors/vscode/package.json");
const grammarPath = path.join(
  root,
  "editors/vscode/syntaxes/uttori-asm.tmLanguage.json",
);

test("VS Code manifest exposes the generic plugin-aware Assembly surface", (t) => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    contributes: {
      commands: Array<{ command: string; title: string; category: string }>;
      languages: Array<{ id: string }>;
      grammars: Array<{ language: string; scopeName: string; path: string }>;
      configuration: { properties: Record<string, Record<string, unknown>> };
    };
    capabilities: {
      untrustedWorkspaces: { supported: string; restrictedConfigurations: string[] };
    };
  };

  t.deepEqual(
    manifest.contributes.commands.map((entry) => entry.command),
    ["asm.build", "asm.toggleWatch"],
  );
  t.true(manifest.contributes.commands.every((entry) => entry.category === "Assembly"));
  t.true(manifest.contributes.commands.some((entry) => entry.title === "Build Binary"));
  t.deepEqual(manifest.contributes.languages.map((entry) => entry.id), ["uttori-asm"]);
  t.deepEqual(manifest.contributes.grammars, [
    {
      language: "uttori-asm",
      scopeName: "source.uttori-asm",
      path: "./syntaxes/uttori-asm.tmLanguage.json",
    },
  ]);

  const properties = manifest.contributes.configuration.properties;
  t.deepEqual(Object.keys(properties).sort(),
    [
      "asm.architecture",
      "asm.baseImage",
      "asm.buildOutput",
      "asm.configFile",
      "asm.entryPoints",
      "asm.includePaths",
      "asm.plugins",
      "asm.target",
    ].sort(),
  );
  t.false("enum" in properties["asm.architecture"]);
  t.is(manifest.capabilities.untrustedWorkspaces.supported, "limited");
  t.deepEqual(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations, [
    "asm.configFile",
    "asm.plugins",
  ]);
});

test("VS Code grammar is target-neutral and delegates mnemonics to semantic tokens", (t) => {
  const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf8")) as {
    name: string;
    scopeName: string;
    repository: Record<string, unknown>;
  };
  const source = fs.readFileSync(grammarPath, "utf8");

  t.is(grammar.name, "Uttori Assembly");
  t.is(grammar.scopeName, "source.uttori-asm");
  t.false("instructions" in grammar.repository);
  t.false("registers" in grammar.repository);
  t.false(/\b(?:LDA|SPC700|SuperFX)\b/.test(source));
  for (const key of ["comments", "strings", "directives", "numbers", "labels"]) {
    t.true(key in grammar.repository);
  }
});

test("VS Code client propagates trust and every project environment setting", (t) => {
  const source = fs.readFileSync(
    path.join(root, "editors/vscode/src/extension.ts"),
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
    t.true(source.includes(`\"${setting}\"`));
  }
  t.true(source.includes("workspace.isTrusted"));
  t.true(source.includes("workspace.onDidGrantWorkspaceTrust"));
  t.true(source.includes('configurationSection: "asm"'));
  t.false(source.includes("snesAsm."));
  t.false(source.includes('language: "snes-asm"'));
});
