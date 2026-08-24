import type { SessionStateKey } from "@uttori/asm-core/plugin";

export const SNES_SESSION_STATE_ID = "snes.session-state";

export type SnesSpcBlockType = "nspc" | "custom";

export type SnesSpcBlockData = {
  destination: number;
  type: SnesSpcBlockType;
  sizeAddress: number;
  executeAddress: number | null;
  namespaceBackup: string;
};

export interface SnesSessionState {
  mapper: string;
  sa1Banks: number[];
  checksumEnabled: boolean;
  checksumMode: "asar" | "simple";
  bankCrossMode: "off" | "full" | "half";
  readFunctionsEnabled: boolean;
  optimizeDirectPage: boolean;
  asarSuperFxMoveShortAddress: boolean;
  outputFillByte: number;
  activeFreespaceStartOffset: number | null;
  activeFreespaceContentStartOffset: number | null;
  activeFreespaceEndOffset: number | null;
  inSpcBlock: boolean;
  spcBlock: SnesSpcBlockData | null;
  spcPreviousArchitecture: string | null;
  spcInlineCompatibility: boolean;
}

export const snesSessionStateKey = {
  id: SNES_SESSION_STATE_ID,
} as SessionStateKey<SnesSessionState>;

export function cloneSnesSessionState(value: SnesSessionState): SnesSessionState {
  return {
    ...value,
    sa1Banks: [...value.sa1Banks],
    spcBlock: value.spcBlock ? { ...value.spcBlock } : null,
  };
}
