import {
  syntaxCodec,
  type DirectiveFactoryContext,
  type DirectiveSyntaxContribution,
} from "@uttori/asm-core/plugin";

import { SnesSpcRuntimeService } from "../services/spc-runtime.js";
import { snesSessionStateKey } from "../session-state.js";
import { getActiveArch65816, handlePopcpu, handlePushcpu } from "./ca65-compat.js";
import { allocateFreespace, emitProtectionRecord } from "./freespace.js";
import { applyMapperPayload, applyStartposPayload } from "./layout.js";
import { parseSnesDirective, snesDirectiveSchema } from "./syntax-parser.js";

/** Stage-sensitive operations receive parsed values; only this binding owns mutable SNES state. */
function execute(
  node: ReturnType<typeof parseSnesDirective>,
  { session, state }: DirectiveFactoryContext,
): void {
  const active = state.get(snesSessionStateKey);
  switch (node.operation) {
    case "noop":
      return;
    case "mapper":
      return applyMapperPayload(active, node);
    case "optimize":
      if (node.enabled !== undefined) {
        active.optimizeDirectPage = node.enabled;
      }
      return;
    case "width":
      if (node.register === "accumulator") {
        getActiveArch65816(session)?.setAccumulatorWidth(node.wide);
      } else {
        getActiveArch65816(session)?.setIndexWidth(node.wide);
      }
      return;
    case "smart":
      getActiveArch65816(session)?.setSmartMode(node.enabled);
      return;
    case "cpu":
      session.selectArchitecture(node.architecture, node.alias);
      return;
    case "pushcpu":
      return handlePushcpu(session, active);
    case "popcpu":
      return handlePopcpu(session, active);
    case "freespace":
      return allocateFreespace(session, active, node.keyword);
    case "freespacebyte":
      active.outputFillByte = session.operandResolver.getnum(node.expression) & 0xff;
      session.outputFillByte = active.outputFillByte;
      return;
    case "prot":
      return emitProtectionRecord(session, node.labels);
    case "spcblock":
      return new SnesSpcRuntimeService(session, active).executeSpcblock(node.block);
    case "endspcblock":
      return new SnesSpcRuntimeService(session, active).executeEndSpcblock(node.block);
    case "startpos":
      return applyStartposPayload(session, active, node);
  }
}

/** Every shipped SNES contribution uses the same checked payload path, including no-op directives. */
export function snesDirectiveSyntax(id: string): DirectiveSyntaxContribution {
  const codec = syntaxCodec("1", (input) => parseSnesDirective(id, input), snesDirectiveSchema);
  return {
    ...codec,
    bind: (context) => ({ execute: (payload) => execute(codec.read(payload), context) }),
  };
}
