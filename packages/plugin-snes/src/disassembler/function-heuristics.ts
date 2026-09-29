import { createHash } from "node:crypto";

import { canonicalJson, canonicalJsonCompact } from "@uttori/asm-core/canonical-json";
import {
  type AnalysisControlFlowNodeRecord as Node,
  type AnalysisControlFlowEdgeRecord as Edge,
  type AnalysisProjectShards,
  type EvidenceRecord,
  type ProjectComment,
} from "@uttori/asm-disassembler";

import { identifySnesHardwareRegister } from "./hardware-registers.js";

const isArray = (value: unknown): boolean => Array.isArray(value);

export type SnesRoleConfidence = "high" | "medium" | "low";
export interface SnesRegisterRoleRule {
  readonly id: string;
  readonly role: string;
  readonly addresses: readonly number[];
  readonly access: "read" | "write";
  readonly confidence: SnesRoleConfidence;
}
/** Declarative rules only: no executable expressions from project configuration. */
export interface SnesHeuristicConfiguration {
  readonly enabled?: boolean;
  readonly minimumConfidence?: SnesRoleConfidence;
  readonly maxWindowInstructions?: number;
  readonly disabledRules?: readonly string[];
  readonly registerRules?: readonly SnesRegisterRoleRule[];
}
export interface SnesFunctionRole {
  readonly id: string;
  readonly rule: string;
  readonly role: string;
  readonly addressSpace: string;
  readonly address: number;
  readonly confidence: SnesRoleConfidence;
  readonly relationship: "direct" | "delegated";
  readonly instructions: readonly number[];
  readonly explanation: string;
  readonly evidence: readonly string[];
}
export interface SnesHeuristicResult {
  readonly roles: readonly SnesFunctionRole[];
  readonly comments: readonly ProjectComment[];
  readonly evidence: readonly EvidenceRecord[];
}

const rank = { low: 0, medium: 1, high: 2 };
const writes = new Set(["STA", "STX", "STY", "STZ"]);
const reads = new Set([
  "LDA",
  "LDX",
  "LDY",
  "CMP",
  "CPX",
  "CPY",
  "BIT",
  "AND",
  "ORA",
  "EOR",
  "ADC",
  "SBC",
]);
const builtins: readonly SnesRegisterRoleRule[] = [
  {
    id: "apu-io",
    role: "audio.communication",
    addresses: [0x2140, 0x2141, 0x2142, 0x2143],
    access: "write",
    confidence: "medium",
  },
  {
    id: "vram-write",
    role: "graphics.vram-write",
    addresses: [0x2118, 0x2119],
    access: "write",
    confidence: "high",
  },
  {
    id: "palette-write",
    role: "graphics.palette-write",
    addresses: [0x2122],
    access: "write",
    confidence: "high",
  },
  {
    id: "oam-write",
    role: "graphics.oam-write",
    addresses: [0x2104],
    access: "write",
    confidence: "high",
  },
  {
    id: "controller-read",
    role: "input.controller-read",
    addresses: [0x4016, 0x4017, 0x4218, 0x4219, 0x421a, 0x421b, 0x421c, 0x421d, 0x421e, 0x421f],
    access: "read",
    confidence: "high",
  },
  {
    id: "math-result",
    role: "math.hardware-result",
    addresses: [0x4214, 0x4215, 0x4216, 0x4217, 0x2134, 0x2135, 0x2136],
    access: "read",
    confidence: "high",
  },
];
export const SNES_HEURISTIC_RULE_IDS = [
  ...builtins.map((rule) => rule.id),
  "observed-access",
  "apu-handshake",
  "apu-upload",
  "vblank-wait",
  "dma-destination",
  "display-fade",
  "mode7-setup",
  "block-copy",
  "wrapper",
] as const;

/**
 * Reject malformed configuration before changing any project files.
 * @param {unknown} value Untrusted configuration.
 * @returns {SnesHeuristicConfiguration} Validated configuration.
 */
export const validateSnesHeuristicConfiguration = (value: unknown): SnesHeuristicConfiguration => {
  if (!value || typeof value !== "object" || isArray(value)) {
    throw new Error("SNES heuristics must be an object.");
  }
  const config = value as SnesHeuristicConfiguration;
  const allowed = new Set([
    "enabled",
    "minimumConfidence",
    "maxWindowInstructions",
    "disabledRules",
    "registerRules",
  ]);
  for (const key of Object.keys(config)) {
    if (!allowed.has(key)) {
      throw new Error(`Unknown SNES heuristic option '${key}'.`);
    }
  }
  if (config.enabled !== undefined && typeof config.enabled !== "boolean") {
    throw new Error("Heuristic enabled must be boolean.");
  }
  if (config.minimumConfidence !== undefined && !Object.hasOwn(rank, config.minimumConfidence)) {
    throw new Error("Invalid heuristic confidence.");
  }
  if (
    config.maxWindowInstructions !== undefined &&
    (!Number.isInteger(config.maxWindowInstructions) ||
      config.maxWindowInstructions < 2 ||
      config.maxWindowInstructions > 256)
  ) {
    throw new Error("Heuristic window must be between 2 and 256 instructions.");
  }
  if (
    config.registerRules !== undefined &&
    (!isArray(config.registerRules) || config.registerRules.length > 128)
  ) {
    throw new Error("At most 128 register rules are allowed.");
  }
  const ids = new Set<string>(SNES_HEURISTIC_RULE_IDS);
  for (const rule of config.registerRules ?? []) {
    if (
      !rule ||
      typeof rule.id !== "string" ||
      !/^[a-z][\d.a-z-]*$/.test(rule.id) ||
      ids.has(rule.id) ||
      typeof rule.role !== "string" ||
      !/^[a-z][\d.a-z-]*$/.test(rule.role) ||
      !["read", "write"].includes(rule.access) ||
      !Object.hasOwn(rank, rule.confidence) ||
      !isArray(rule.addresses) ||
      !rule.addresses.length ||
      rule.addresses.length > 256 ||
      rule.addresses.some(
        (address: number) => !Number.isInteger(address) || !identifySnesHardwareRegister(address),
      )
    ) {
      throw new Error("Invalid or duplicate SNES register role rule.");
    }
    ids.add(rule.id);
  }
  if (
    config.disabledRules !== undefined &&
    (!isArray(config.disabledRules) || config.disabledRules.some((id) => !ids.has(id)))
  ) {
    throw new Error("Unknown disabled heuristic rule.");
  }
  return config;
};

const width = (node: Node, register: "a" | "x" | "y" = "a"): number | undefined => {
  const flag = node.incomingState[register === "a" ? "m" : "x"] as
    | { kind?: string; value?: number }
    | undefined;
  if (flag?.kind !== "known") {
    return undefined;
  }
  if (flag.value === 1) {
    return 1;
  }
  return flag.value === 0 ? 2 : undefined;
};
const addresses = (node: Node): number[] =>
  node.effectiveAddresses.flatMap((effect) => {
    if (typeof effect.address !== "number") {
      return [];
    }
    const hardware = identifySnesHardwareRegister(effect.address);
    return hardware ? [hardware.address] : [];
  });
const immediate = (node: Node): number | undefined =>
  node.mode.startsWith("immediate") && node.bytes?.length
    ? node.bytes.slice(1).reduce((sum, byte, index) => sum + byte * 2 ** (8 * index), 0)
    : undefined;

/**
 * Bounded structural matching. Never renames symbols or changes code/data classifications.
 * @param {AnalysisProjectShards} shards Persisted analysis and observations.
 * @param {SnesHeuristicConfiguration} options Declarative rule configuration.
 * @param {Iterable} [runtime] Optional streamed runtime observations.
 * @returns {SnesHeuristicResult} Findings and their comments/evidence.
 */
export const analyzeSnesFunctionRoles = (
  shards: AnalysisProjectShards,
  options: SnesHeuristicConfiguration = {},
  runtime: Iterable<AnalysisProjectShards["runtime"][number]> = shards.runtime,
): SnesHeuristicResult => {
  const config = validateSnesHeuristicConfiguration(options);
  if (config.enabled === false) {
    return { roles: [], comments: [], evidence: [] };
  }
  const disabled = new Set(config.disabledRules);
  const limit = config.maxWindowInstructions ?? 48;
  const nodes = new Map(
    shards.analysis
      .filter(
        (record): record is Node =>
          record.kind === "cfg-node" &&
          record.addressSpace === "snes.cpu" &&
          record.specificationId.startsWith("snes.65816."),
      )
      .map((node) => [node.id, node]),
  );
  const edges = shards.analysis.filter(
    (record): record is Edge => record.kind === "cfg-edge" && record.addressSpace === "snes.cpu",
  );
  const incoming = new Map<string, Edge[]>();
  for (const edge of edges) {
    if (edge.to) {
      const list = incoming.get(edge.to) ?? [];
      list.push(edge);
      incoming.set(edge.to, list);
    }
  }
  const window = (end: Node): Node[] => {
    const result = [end];
    const seen = new Set([end.id]);
    while (result.length < limit) {
      const links = (incoming.get(result[0].id) ?? []).filter((edge) => edge.edgeKind !== "call");
      if (links.length !== 1 || links[0].edgeKind !== "fallthrough") {
        break;
      }
      const previous = nodes.get(links[0].from);
      if (!previous || seen.has(previous.id)) {
        break;
      }
      seen.add(previous.id);
      result.unshift(previous);
    }
    return result;
  };
  const found = new Map<string, SnesFunctionRole>();
  const emit = (
    node: Node,
    rule: string,
    role: string,
    confidence: SnesRoleConfidence,
    evidenceNodes: readonly Node[],
    explanation: string,
    relationship: "direct" | "delegated" = "direct",
  ): void => {
    if (disabled.has(rule) || rank[confidence] < rank[config.minimumConfidence ?? "medium"]) {
      return;
    }
    const key = `${node.addressSpace}:${node.address}:${rule}:${role}:${relationship}`;
    const prior = found.get(key);
    found.set(key, {
      id: `heuristic:snes:${createHash("sha256").update(key).digest("hex").slice(0, 24)}`,
      rule,
      role,
      addressSpace: node.addressSpace,
      address: node.address,
      confidence,
      relationship,
      instructions: [
        ...new Set([
          ...(prior?.instructions ?? []),
          ...evidenceNodes.map((entry) => entry.address),
        ]),
      ].sort((a, b) => a - b),
      explanation,
      evidence: [
        ...new Set([
          ...(prior?.evidence ?? []),
          ...evidenceNodes.flatMap((entry) => entry.evidence),
        ]),
      ].sort(),
    });
  };
  for (const node of nodes.values()) {
    const ports = addresses(node);
    for (const rule of [...builtins, ...(config.registerRules ?? [])]) {
      if (
        (rule.access === "write" ? writes : reads).has(node.mnemonic) &&
        ports.some((address) =>
          rule.addresses.some(
            (candidate) => identifySnesHardwareRegister(candidate)?.address === address,
          ),
        )
      ) {
        emit(
          node,
          rule.id,
          rule.role,
          rule.confidence,
          [node],
          `Resolved ${rule.access} of ${ports.map((address) => `$${address.toString(16)}`).join(", ")}.`,
        );
      }
    }
    if (["MVN", "MVP"].includes(node.mnemonic)) {
      emit(
        node,
        "block-copy",
        "memory.block-copy",
        "high",
        [node],
        "Block move instruction. Payload purpose requires destination provenance.",
      );
    }
    const trail = window(node);
    if (node.mnemonic === "STA" && ports.includes(0x420b)) {
      const values = new Map<number, number>();
      const registers = new Map<string, { value: number; size: number }>();
      for (const step of trail) {
        const imm = immediate(step);
        if (["LDA", "LDX", "LDY"].includes(step.mnemonic)) {
          if (imm === undefined) {
            registers.delete(step.mnemonic[2]);
          } else {
            registers.set(step.mnemonic[2], { value: imm, size: step.bytes!.length - 1 });
          }
        } else if (writes.has(step.mnemonic)) {
          let register: "a" | "x" | "y" = "a";
          if (step.mnemonic === "STX") {
            register = "x";
          }
          if (step.mnemonic === "STY") {
            register = "y";
          }
          const size = width(step, register);
          const source = registers.get(step.mnemonic[2]);
          let value: number | undefined;
          if (source && size !== undefined && source.size >= size) {
            value = source.value;
          }
          if (step.mnemonic === "STZ") {
            value = 0;
          }
          if (
            !step.effectiveAddresses.length ||
            step.effectiveAddresses.some((effect) => effect.address === undefined)
          ) {
            values.clear();
          }
          for (const port of addresses(step)) {
            for (let i = 0; i < (size ?? 2); i++) {
              if (value === undefined || size === undefined) {
                values.delete(port + i);
              } else {
                values.set(port + i, (value >> (8 * i)) & 255);
              }
            }
          }
        } else if (!["REP", "SEP", "NOP"].includes(step.mnemonic)) {
          registers.clear();
          if (["JSR", "JSL", "JMP", "JML", "MVN", "MVP"].includes(step.mnemonic)) {
            values.clear();
          }
        }
      }
      const mask = values.get(0x420b);
      if (mask !== undefined) {
        for (let channel = 0; channel < 8; channel++) {
          if (mask & (1 << channel)) {
            const mode = values.get(0x4300 + channel * 16);
            const target = values.get(0x4301 + channel * 16);
            if (mode === undefined || target === undefined || mode & 0x80) {
              continue;
            }
            let role: string | undefined;
            if (target === 0x18 && (mode & 7) === 1) {
              role = "graphics.vram-dma";
            }
            if (target === 0x22 && (mode & 7) === 0) {
              role = "graphics.palette-dma";
            }
            if (target === 4 && (mode & 7) === 0) {
              role = "graphics.oam-dma";
            }
            if (role) {
              emit(
                node,
                "dma-destination",
                role,
                "high",
                trail,
                `Channel ${channel} starts A-to-B DMA, mode ${mode & 7}, B-bus target $21${target.toString(16).padStart(2, "0")}. Source/length may remain unresolved.`,
              );
            }
          }
        }
      }
    }
    if (
      node.mnemonic === "STA" &&
      ports.includes(0x2105) &&
      trail.some((step) => immediate(step) === 7) &&
      trail.filter(
        (step) =>
          writes.has(step.mnemonic) &&
          addresses(step).some((address) => address >= 0x211b && address <= 0x2120),
      ).length >= 4
    ) {
      emit(
        node,
        "mode7-setup",
        "graphics.mode7-setup",
        "medium",
        trail,
        "Matrix/center writes and a nearby mode-7 constant. Confirm the value reaching BGMODE.",
      );
    }
  }
  for (const edge of edges) {
    if (
      edge.edgeKind !== "branch" ||
      edge.toAddress === undefined ||
      edge.toAddress > edge.fromAddress
    ) {
      continue;
    }
    const end = nodes.get(edge.from);
    if (!end) {
      continue;
    }
    const trail = window(end);
    const startIndex = trail.findIndex((node) => node.address === edge.toAddress);
    if (startIndex < 0) {
      continue;
    }
    const loop = trail.slice(startIndex);
    const start = loop[0];
    const has = (set: Set<string>, port: number) =>
      loop.some((node) => set.has(node.mnemonic) && addresses(node).includes(port));
    if (
      ["BNE", "BEQ"].includes(end.mnemonic) &&
      loop
        .slice(-3, -1)
        .some(
          (node) =>
            ["CMP", "CPX", "CPY", "LDA"].includes(node.mnemonic) &&
            addresses(node).includes(0x2140),
        )
    ) {
      emit(
        start,
        "apu-handshake",
        "audio.handshake-wait",
        "high",
        loop,
        "Backward conditional loop polls the resolved APU acknowledgement port.",
      );
    }
    if (
      has(reads, 0x4212) &&
      loop.some((node) => ["AND", "BIT"].includes(node.mnemonic) && immediate(node) === 0x80)
    ) {
      emit(
        start,
        "vblank-wait",
        "timing.vblank-wait",
        "high",
        loop,
        "Backward loop tests HVBJOY bit 7.",
      );
    }
    if (has(writes, 0x2100) && loop.some((node) => ["INC", "DEC"].includes(node.mnemonic))) {
      emit(
        start,
        "display-fade",
        "graphics.brightness-ramp",
        "medium",
        loop,
        "Repeated brightness writes with an increment/decrement. Frame synchronization needs caller/trace evidence.",
      );
    }
  }
  const contextNodes = new Map<string, Map<number, Node[]>>();
  for (const node of nodes.values()) {
    const key = canonicalJsonCompact(node.context);
    const indexed = contextNodes.get(key) ?? new Map<number, Node[]>();
    const choices = indexed.get(node.address) ?? [];
    choices.push(node);
    indexed.set(node.address, choices);
    contextNodes.set(key, indexed);
  }
  // Uploads contain nested acknowledgement loops. Traverse only explicit local edges within a bounded interval.
  const handshakeAddresses = new Set(
    [...found.values()].filter((role) => role.rule === "apu-handshake").map((role) => role.address),
  );
  for (const edge of edges) {
    if (
      edge.edgeKind !== "branch" ||
      edge.toAddress === undefined ||
      edge.toAddress >= edge.fromAddress
    ) {
      continue;
    }
    const end = nodes.get(edge.from);
    const start = edge.to ? nodes.get(edge.to) : undefined;
    if (!end || !start) {
      continue;
    }
    const indexed = contextNodes.get(canonicalJsonCompact(start.context))!;
    const loop: Node[] = [];
    let cursor = start.address;
    while (cursor <= end.address && loop.length < limit) {
      const choices = indexed.get(cursor);
      if (choices?.length !== 1) {
        break;
      }
      const node = choices[0];
      loop.push(node);
      cursor += node.size;
    }
    if (loop.length < 4 || loop.at(-1)?.id !== end.id) {
      continue;
    }
    const payload = loop.some((node) => node.mnemonic === "LDA" && node.mode.includes("Indirect"));
    const ports = new Set(loop.filter((node) => writes.has(node.mnemonic)).flatMap(addresses));
    const ack = loop.some(
      (node) => ["CMP", "CPX", "CPY"].includes(node.mnemonic) && addresses(node).includes(0x2140),
    );
    const handshake = loop.some((node) => handshakeAddresses.has(node.address));
    if (
      payload &&
      ack &&
      handshake &&
      ports.has(0x2140) &&
      [0x2141, 0x2142, 0x2143].some((port) => ports.has(port)) &&
      loop.some((node) => ["INY", "INX", "DEX", "DEY"].includes(node.mnemonic))
    ) {
      emit(
        start,
        "apu-upload",
        "audio.bulk-upload",
        "high",
        loop,
        "Advancing indirect source feeds APU payload ports with a token/acknowledgement cycle inside a counted loop.",
      );
    }
  }
  const atAddress = new Map<number, Node[]>();
  for (const node of nodes.values()) {
    const list = atAddress.get(node.address) ?? [];
    list.push(node);
    atAddress.set(node.address, list);
  }
  for (const access of runtime) {
    if (
      access.kind !== "runtime-memory-access" ||
      access.architecture !== "snes.65816" ||
      access.instructionAddressSpace !== "snes.cpu" ||
      access.accessedAddressSpace !== "snes.cpu"
    ) {
      continue;
    }
    const port = identifySnesHardwareRegister(access.accessedAddress)?.address;
    if (port === undefined) {
      continue;
    }
    for (const node of atAddress.get(access.instructionAddress) ?? []) {
      const observedNode = { ...node, evidence: [...node.evidence, ...access.evidence] };
      if (access.actor === "dma" || access.actor === "hdma") {
        if (access.access !== "write") {
          continue;
        }
        let role: string | undefined;
        if ([0x2118, 0x2119].includes(port)) {
          role = "graphics.vram-transfer";
        }
        if (port === 0x2122) {
          role = "graphics.palette-transfer";
        }
        if (port === 0x2104) {
          role = "graphics.oam-transfer";
        }
        if (role) {
          emit(
            node,
            "observed-access",
            role,
            "high",
            [observedNode],
            `Observed ${access.actor.toUpperCase()} channel ${access.channel ?? "unknown"} write to $${port.toString(16)} during this instruction. The DMA engine performs the bus operation.`,
          );
        }
      } else {
        for (const rule of [...builtins, ...(config.registerRules ?? [])]) {
          if (
            !disabled.has(rule.id) &&
            access.access === rule.access &&
            rule.addresses.some(
              (address) => identifySnesHardwareRegister(address)?.address === port,
            )
          ) {
            emit(
              node,
              "observed-access",
              rule.role,
              rule.confidence,
              [observedNode],
              `Observed CPU ${access.access} at $${port.toString(16)} resolves the executed operand, including indexed/indirect access.`,
            );
          }
        }
      }
    }
  }
  // Attribute a finding to the innermost known function on its evidence path and call context.
  const functionAddresses = new Set(
    shards.analysis.flatMap((record) =>
      record.kind === "function" && record.addressSpace === "snes.cpu" ? [record.address] : [],
    ),
  );
  for (const role of [...found.values()]) {
    for (const node of atAddress.get(role.address) ?? []) {
      const owner = [...node.evidencePath]
        .reverse()
        .map((id) => nodes.get(id))
        .find(
          (candidate) =>
            candidate &&
            functionAddresses.has(candidate.address) &&
            canonicalJsonCompact(candidate.context) === canonicalJsonCompact(node.context),
        );
      if (owner && owner.address !== node.address) {
        emit(
          owner,
          role.rule,
          role.role,
          role.confidence,
          [node, owner],
          `Function contains ${role.role} evidence at $${node.address.toString(16)}. ${role.explanation}`,
        );
      }
    }
  }
  const directByAddress = new Map<number, SnesFunctionRole[]>();
  for (const role of found.values()) {
    const list = directByAddress.get(role.address) ?? [];
    list.push(role);
    directByAddress.set(role.address, list);
  }
  for (const edge of edges) {
    if (edge.edgeKind === "call" && edge.toAddress !== undefined) {
      const caller = nodes.get(edge.from);
      if (!caller) {
        continue;
      }
      for (const role of directByAddress.get(edge.toAddress) ?? []) {
        emit(
          caller,
          "wrapper",
          role.role,
          "medium",
          [{ ...caller, evidence: [...caller.evidence, ...role.evidence] }],
          `Calls $${edge.toAddress.toString(16)} with ${role.role} evidence. Caller may have other roles.`,
          "delegated",
        );
      }
    }
  }
  const roles = [...found.values()].sort(
    (a, b) => a.address - b.address || a.id.localeCompare(b.id),
  );
  const signature = createHash("sha256").update(canonicalJson(config)).digest("hex").slice(0, 16);
  const evidence: EvidenceRecord[] = roles.map((role) => ({
    id: `${role.id}:evidence`,
    source: "detector",
    sourceId: "snes.function-roles.v1",
    confidence: role.confidence,
    detail: `${role.rule}. Configuration ${signature}. ${role.explanation}. Instructions ${role.instructions.map((address) => `$${address.toString(16)}`).join(", ")}`,
  }));
  return {
    roles,
    evidence,
    comments: roles.map((role) => ({
      id: role.id,
      addressSpace: role.addressSpace,
      address: role.address,
      text: `[${role.confidence} heuristic: ${role.role}${role.relationship === "delegated" ? " via call" : ""}] ${role.explanation}`,
      evidence: [...role.evidence, `${role.id}:evidence`],
    })),
  };
};
