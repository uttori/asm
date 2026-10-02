import type { DecodedInstruction } from "@uttori/asm-core";
import type { SuperFxDecodeState } from "../architectures/superfx-decoder.js";
import { type SuperFxAltState } from "../architectures/superfx-spec.js";
export type SuperFxKnown<T extends number> = {
    readonly kind: "known";
    readonly value: T;
} | {
    readonly kind: "unknown";
} | {
    readonly kind: "conflict";
};
export interface SuperFxAbstractState {
    readonly alt: SuperFxKnown<SuperFxAltState>;
    readonly destinationRegister: SuperFxKnown<number>;
    readonly sourceRegister: SuperFxKnown<number>;
    readonly programBank: SuperFxKnown<number>;
}
export declare const initialSuperFxState: (programBank?: number) => SuperFxAbstractState;
export declare const joinSuperFxStates: (left: SuperFxAbstractState, right: SuperFxAbstractState) => SuperFxAbstractState;
export declare const superFxDecodeState: (state: SuperFxAbstractState) => SuperFxDecodeState;
export declare const enterSuperFxAddress: (state: SuperFxAbstractState, address: number) => SuperFxAbstractState;
export declare const transferSuperFxState: (instruction: Pick<DecodedInstruction, "effects">, state: SuperFxAbstractState) => SuperFxAbstractState;
export declare const superFxStateKey: (state: SuperFxAbstractState) => string;
//# sourceMappingURL=superfx-state.d.ts.map