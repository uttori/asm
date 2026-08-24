export const LEGACY_SNES_MAPPER_DIRECTIVE_SET = "legacy.snes-mapper-directives";
export const LEGACY_SNES_MEMORY_DIRECTIVE_SET = "legacy.snes-memory-directives";
export const LEGACY_SNES_POLICY_DIRECTIVE_SET = "legacy.snes-policy-directives";
export const LEGACY_SPC_DIRECTIVE_SET = "legacy.spc-directives";

export const ALL_LEGACY_TARGET_DIRECTIVE_SETS: ReadonlySet<string> = new Set([
  LEGACY_SNES_MAPPER_DIRECTIVE_SET,
  LEGACY_SNES_MEMORY_DIRECTIVE_SET,
  LEGACY_SNES_POLICY_DIRECTIVE_SET,
  LEGACY_SPC_DIRECTIVE_SET,
]);
