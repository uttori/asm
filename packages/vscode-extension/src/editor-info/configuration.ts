import type { WorkspaceConfiguration } from "vscode";

import { compileTemplate, type InformationTemplate } from "./format.js";

/** Built-in editor information template bundles keyed by preset name. */
export const INFORMATION_PRESETS = {
  compact: {
    parts: ["${output_offsets}", "exec ${execution_counts}"],
    rows: [
      "Output Offsets: ${output_offsets}",
      "Execution Observations: ${execution_observations}",
    ],
  },
  authoring: {
    parts: ["${output_offsets}", "${output_bytes}", "operand=${operand_value}"],
    rows: [
      "Output Offsets: ${output_offsets}",
      "Output Bytes: ${output_bytes}",
      "Output Size: ${output_size}",
      "Resolved Operand: ${operand_value}",
    ],
  },
  disassembly: {
    parts: ["${output_offsets}", "exec ${execution_counts}"],
    rows: [
      "Output Offsets: ${output_offsets}",
      "Execution Observations: ${execution_observations}",
      "Resolved Operand: ${operand_value}",
    ],
  },
} as const;

const INFORMATION_PRESET_NAMES = [
  "compact",
  "authoring",
  "disassembly",
] as const satisfies readonly (keyof typeof INFORMATION_PRESETS)[];

/** Unknown preset names, including hand-edited settings, use the compact fields. */
function informationPreset(
  name: string,
): (typeof INFORMATION_PRESETS)[keyof typeof INFORMATION_PRESETS] {
  const preset = INFORMATION_PRESET_NAMES.find((candidate) => candidate === name);
  return preset === undefined ? INFORMATION_PRESETS.compact : INFORMATION_PRESETS[preset];
}

/** Resolved resource settings; templates are validated before entering the render path. */
export interface EditorInformationConfiguration {
  /** Whether inline after-line overlays are enabled. */
  readonly inlineEnabled: boolean;
  /** Whether hover detail rows are enabled. */
  readonly hoverEnabled: boolean;
  /** Compact inline template fragments rendered beside source lines. */
  readonly parts: readonly InformationTemplate[];
  /** Multiline hover templates rendered on demand. */
  readonly rows: readonly InformationTemplate[];
  /** Delimiter inserted between surviving inline fragments. */
  readonly separator: string;
  /** Total positive character budget for inline presentation. */
  readonly maximum: number;
  /** Zero-based column where aligned overlays anchor. */
  readonly column: number;
  /** Whether overlays follow the line or align to a fixed column. */
  readonly placement: "afterLine" | "aligned";
  /** Whole-overlay color: a hex literal or VS Code theme color identifier. */
  readonly color: string;
  /** Configuration validation issues blocking template compilation. */
  readonly issues: readonly string[];
}

/**
 * Ignore contributed defaults when detecting explicit legacy settings or preset overrides.
 * @param configuration Resource-scoped VS Code settings.
 * @param key Relative key under asm.
 * @returns Effective explicit value, preserving VS Code's language/scope precedence.
 */
// The caller selects VS Code's setting contract, matching inspect<T> and get<T>.
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const explicitSetting = <T>(
  configuration: WorkspaceConfiguration,
  key: string,
): T | undefined => {
  const inspected = configuration.inspect<T>(key);
  if (!inspected) {
    return undefined;
  }
  const values = [
    inspected.workspaceFolderLanguageValue,
    inspected.workspaceFolderValue,
    inspected.workspaceLanguageValue,
    inspected.workspaceValue,
    inspected.globalLanguageValue,
    inspected.globalValue,
  ];
  return values.some((value) => value !== undefined) ? configuration.get<T>(key) : undefined;
};

/**
 * Read display-only settings with preset defaults and compatibility for the original eye toggle.
 * @param configuration Resource-scoped settings under asm.
 * @returns Validated templates and non-fatal configuration issues.
 */
export const readEditorInformationConfiguration = (
  configuration: WorkspaceConfiguration,
): EditorInformationConfiguration => {
  const name = configuration.get<string>("editorInfo.preset", "compact");
  const preset = informationPreset(name);
  const issues: string[] = [];
  const templates = (
    key: string,
    fallback: readonly string[],
    limit: number,
  ): readonly InformationTemplate[] => {
    const value = explicitSetting<unknown>(configuration, key) ?? fallback;
    try {
      if (
        !Array.isArray(value) ||
        value.some((entry) => typeof entry !== "string") ||
        value.length > limit
      ) {
        throw new Error(`Expected at most ${limit} template strings.`);
      }
      return value.map(compileTemplate);
    } catch (error) {
      issues.push(`asm.${key}: ${error instanceof Error ? error.message : String(error)}`);
      return fallback.map(compileTemplate);
    }
  };
  const oldColumn = explicitSetting<number>(configuration, "analysis.annotationColumn");
  const column =
    explicitSetting<number>(configuration, "editorInfo.inline.column") ?? oldColumn ?? 80;
  const maximum = configuration.get<number>("editorInfo.inline.maxCharacters", 120);
  const placement = configuration.get<"afterLine" | "aligned">(
    "editorInfo.inline.placement",
    "aligned",
  );
  const configuredColor = configuration.get<unknown>(
    "editorInfo.inline.color",
    "editorCodeLens.foreground",
  );
  const candidate = typeof configuredColor === "string" ? configuredColor.trim() : "";
  const themeSegments = candidate.split(".");
  const isThemeColor =
    themeSegments.length > 1 &&
    /^[a-z]/i.test(candidate) &&
    themeSegments.every((segment) => /^[\w-]+$/.test(segment));
  let color = "editorCodeLens.foreground";
  // Validate settings read from JSON as well as the Settings UI. Theme identifiers remain live
  // ThemeColor references in the controller, so switching themes requires no decoration rebuild.
  if (isThemeColor || /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(candidate)) {
    color = candidate;
  } else {
    issues.push(
      "asm.editorInfo.inline.color: Expected a hex color such as #FFA65C or a VS Code theme color such as editorWarning.foreground.",
    );
  }
  return {
    inlineEnabled:
      explicitSetting<boolean>(configuration, "editorInfo.inline.enabled") ??
      configuration.get<boolean>("analysis.showAnnotations", true),
    hoverEnabled: configuration.get<boolean>("editorInfo.hover.enabled", true),
    parts: templates("editorInfo.inline.parts", preset.parts, 16),
    rows: templates("editorInfo.hover.rows", preset.rows, 8),
    separator: configuration.get<string>("editorInfo.inline.separator", " · ").slice(0, 32),
    maximum: Number.isSafeInteger(maximum) ? Math.max(24, Math.min(500, maximum)) : 120,
    column: Number.isSafeInteger(column) ? Math.max(0, column) : 80,
    placement,
    color,
    issues,
  };
};
