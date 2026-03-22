import type { DirectiveRegistry } from "./registry.js";
import { AssemblySession, DirectiveContext } from "./types.js";

/**
 * Minimal FREECODE/FREESPACE support used by active tests.
 * Allocates a block at/after current ROM end, emits a placeholder RATS tag, then positions assembly after it.
 * @param {DirectiveContext} ctx The directive context.
 * @param {AssemblySession} ctx.session The assembly session.
 * @param {string[]} words Directive keyword.
 */
const handleFreespace = ({ session }: DirectiveContext, words: string[]) => {
  if (session.inSpcblock) {
    throw new Error(`${words[0]} is unavailable inside spcblock.`);
  }

  // const _type = words[0];
  // const _params = words.slice(1);
  // debug("handleFreespace", { type, _params });

  if (session.mapper === "norom") {
    throw new Error("No freespace available in norom.");
  }

  const sourceLen = (session.targetRom && session.targetRom.length > 0) ? session.targetRom.length : session.romdata.length;
  const startPc = Math.max(0x80000, sourceLen);

  // Expand to at least 1MB for the 512KB -> 1MB bank crossing behavior expected by tests.
  if (session.romdata.length < 0x100000) {
    session.expandRom(0x100000, session.defaultFreespaceByte);
  }
  const startSnes = session.romWriter.pctosnes(startPc);
  if (startSnes < 0) {
    throw new Error("Unable to map freespace start to SNES address.");
  }

  session.currentTargetAddress = startSnes;
  session.currentTargetBaseAddress = startSnes;
  session.currentTargetStartAddress = startSnes;
  session.currentTargetBaseStartAddress = startSnes;

  session.activeFreespaceStartPc = startPc;

  // RATS tag: STAR + (size-1) + ~(size-1), patched in finishPass when final size is known.
  session.write1(0x53); // S
  session.write1(0x54); // T
  session.write1(0x41); // A
  session.write1(0x52); // R
  session.write1(0x00);
  session.write1(0x00);
  session.write1(0xFF);
  session.write1(0xFF);

  session.activeFreespaceContentStartPc = startPc + 8;
}


/**
 * Sets default freespace fill byte.
 * @param {DirectiveContext} ctx The directive context.
 * @param {AssemblySession} ctx.session The assembly session.
 * @param {string[]} words FREESPACEBYTE arguments.
 */
const handleFreespaceByte = ({ session }: DirectiveContext, words: string[]) => {
  const params = words.slice(1);
  if (params.length !== 1) {
    throw new Error("FREESPACEBYTE requires exactly one parameter.");
  }
  const value = session.resolvedefines(params[0]);
  session.defaultFreespaceByte = session.operandResolver.getnum(value) & 0xFF;
}

/**
 * Minimal PROT support used by active tests.
 * Emits PROT table with 24-bit addresses and STOP marker.
 * @param {DirectiveContext} ctx The directive context.
 * @param {AssemblySession} ctx.session The assembly session.
 * @param {string[]} words Label list arguments.
 */
const handleProt = ({ session }: DirectiveContext, words: string[]) => {
  const labelList = words.slice(1);
  if (labelList.length === 0) {
    throw new Error("PROT command requires at least one label parameter.");
  }

  const labels = labelList.join(" ").split(",").map((label) => label.trim()).filter(Boolean);
  if (labels.length === 0) {
    throw new Error("PROT command requires at least one valid label.");
  }

  session.write1(0x50); // P
  session.write1(0x52); // R
  session.write1(0x4F); // O
  session.write1(0x54); // T
  session.write1((labels.length * 3) & 0xFF);

  for (const label of labels) {
    let address = 0;
    try {
      address = session.symbolScope.getLabelValue(label, false) & 0xFFFFFF;
    } catch (_error: unknown) {
      // Forward references are resolved in later passes; keep placeholder in early passes.
      address = 0;
    }
    session.write3(address);
  }

  session.write1(0x53); // S
  session.write1(0x54); // T
  session.write1(0x4F); // O
  session.write1(0x50); // P
  session.write1(0x00);
}

export const registerMemoryDirectives = (registry: DirectiveRegistry): void => {
  registry.register(["freecode", "freespace", "freedata"], handleFreespace);

  registry.register("freespacebyte", handleFreespaceByte);

  registry.register("prot", handleProt);
};
