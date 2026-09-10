import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "../../ava-helper.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("VS Code contributes and activates the inline Uttori ASM debugger", (t) => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "packages/vscode-extension/package.json"), "utf8"),
  ) as {
    dependencies: Record<string, string>;
    contributes: {
      debuggers: Array<{
        type: string;
        initialConfigurations: Array<Record<string, unknown>>;
        configurationAttributes: {
          launch: {
            required: string[];
            properties: { backend: { enum: string[] } };
          };
        };
        configurationSnippets: Array<{ body: Record<string, unknown> }>;
      }>;
    };
  };
  const debuggerContribution = manifest.contributes.debuggers[0];
  t.is(debuggerContribution?.type, "uttori-asm");
  t.deepEqual(debuggerContribution?.configurationAttributes.launch.required, [
    "program",
    "debugMap",
  ]);
  t.is(debuggerContribution?.initialConfigurations[0]?.request, "launch");
  t.deepEqual(debuggerContribution?.configurationAttributes.launch.properties.backend.enum, [
    "replay",
    "ares",
    "mesence",
  ]);
  t.deepEqual(
    debuggerContribution?.configurationSnippets.map(({ body }) => body.backend),
    ["replay", "ares", "mesence"],
  );
  t.is(manifest.dependencies["@uttori/asm-debug-adapter"], "1.0.0");
  t.is(manifest.dependencies["@uttori/asm-debug-sidecar-ares"], "1.0.0");
  t.is(manifest.dependencies["@uttori/asm-debug-sidecar-mesence"], "1.0.0");

  const extension = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/extension.ts"),
    "utf8",
  );
  t.regex(extension, /registerDebugging\(context\.extensionPath, refreshAnalysisViews\)/);
});
