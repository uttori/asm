/** Stable ordering of built-in directive families registered by the core plugin. */
export const CORE_DIRECTIVE_GROUPS = Object.freeze([
  "data",
  "memory",
  "include",
  "layout",
  "namespace",
  "table",
  "struct",
  "control",
  "macro",
  "diagnostic",
] as const);

/** One registered directive family name drawn from the frozen core list. */
export type CoreDirectiveGroup = (typeof CORE_DIRECTIVE_GROUPS)[number];
