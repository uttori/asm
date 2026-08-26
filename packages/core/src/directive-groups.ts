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

export type CoreDirectiveGroup = (typeof CORE_DIRECTIVE_GROUPS)[number];
