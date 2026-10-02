import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "../../ava-helper.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Returns the indexed element, or undefined when the index is past the end. */
const elementAt = <T>(items: readonly T[], index: number): T | undefined =>
  index >= 0 && index < items.length ? items[index] : undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

type DebuggerManifest = {
  dependencies: Record<string, string>;
  contributes: {
    debuggers: Array<{
      type: string;
      initialConfigurations: Array<Record<string, unknown>>;
      configurationAttributes: {
        launch: {
          required?: string[];
          properties: { backend: { enum: string[] }; sourceProject: { type: string } };
        };
      };
      configurationSnippets: Array<{ body: Record<string, unknown> }>;
    }>;
  };
};

function isDebuggerManifest(value: unknown): value is DebuggerManifest {
  if (!isRecord(value) || !isRecord(value.dependencies) || !isRecord(value.contributes)) {
    return false;
  }
  if (!Object.values(value.dependencies).every((entry) => typeof entry === "string")) {
    return false;
  }
  if (!Array.isArray(value.contributes.debuggers)) {
    return false;
  }
  return value.contributes.debuggers.every((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.type !== "string" ||
      !Array.isArray(entry.initialConfigurations)
    ) {
      return false;
    }
    if (!entry.initialConfigurations.every((configuration) => isRecord(configuration))) {
      return false;
    }
    if (
      !isRecord(entry.configurationAttributes) ||
      !isRecord(entry.configurationAttributes.launch)
    ) {
      return false;
    }
    const launch = entry.configurationAttributes.launch;
    if (launch.required !== undefined && !isStringArray(launch.required)) {
      return false;
    }
    if (
      !isRecord(launch.properties) ||
      !isRecord(launch.properties.backend) ||
      !isStringArray(launch.properties.backend.enum) ||
      !isRecord(launch.properties.sourceProject) ||
      typeof launch.properties.sourceProject.type !== "string"
    ) {
      return false;
    }
    return (
      Array.isArray(entry.configurationSnippets) &&
      entry.configurationSnippets.every((snippet) => isRecord(snippet) && isRecord(snippet.body))
    );
  });
}

test("VS Code contributes and activates the inline Uttori ASM debugger", (t) => {
  const parsed: unknown = JSON.parse(
    fs.readFileSync(path.join(root, "packages/vscode-extension/package.json"), "utf8"),
  );
  if (!isDebuggerManifest(parsed)) {
    throw new Error("VS Code manifest is missing the Uttori debugger contribution.");
  }
  const manifest = parsed;
  const debuggerContribution = elementAt(manifest.contributes.debuggers, 0);
  t.is(debuggerContribution?.type, "uttori-asm");
  // Git source launches obtain both paths from the successful build instead of static launch JSON.
  t.is(debuggerContribution?.configurationAttributes.launch.required, undefined);
  t.is(
    debuggerContribution?.configurationAttributes.launch.properties.sourceProject.type,
    "boolean",
  );
  t.is(debuggerContribution?.initialConfigurations[0]?.request, "launch");
  t.deepEqual(debuggerContribution?.configurationAttributes.launch.properties.backend.enum, [
    "replay",
    "ares",
  ]);
  t.deepEqual(
    debuggerContribution?.configurationSnippets.map(({ body }) => body.backend),
    ["replay", "ares"],
  );
  t.is(manifest.dependencies["@uttori/asm-debug-adapter"], "1.0.0");
  t.is(manifest.dependencies["@uttori/asm-debug-sidecar-ares"], "1.0.0");

  const extension = fs.readFileSync(
    path.join(root, "packages/vscode-extension/src/extension.ts"),
    "utf8",
  );
  t.regex(extension, /registerDebugging\(context\.extensionPath\)/);
});
