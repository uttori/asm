import type { AssetByteSource, AssetCodecContext, AssetExtractedFile, AssetValue } from "@uttori/asm-disassembler";
export type SnesAssetObject = Readonly<Record<string, AssetValue>>;
export declare const objectValue: (value: AssetValue | undefined, label: string) => SnesAssetObject;
export declare const optionsFor: (context: AssetCodecContext) => SnesAssetObject;
export declare const integerOption: (options: SnesAssetObject, key: string, bounds?: {
    readonly minimum?: number;
    readonly maximum?: number;
    readonly fallback?: number;
}) => number | undefined;
export declare const stringOption: (options: SnesAssetObject, key: string, fallback: string) => string;
export declare const readBytes: (source: AssetByteSource, offset: number, size: number, owner: string) => Uint8Array;
export declare const resolveCount: (context: AssetCodecContext, unitSize: number, options?: Readonly<Record<string, AssetValue>>) => {
    readonly count: number;
    readonly size: number;
};
export declare const resolveGrid: (context: AssetCodecContext, unitSize: number) => {
    readonly count: number;
    readonly size: number;
    readonly width?: number;
    readonly height?: number;
};
export declare const decodedObject: (value: AssetValue, owner: string) => SnesAssetObject;
export declare const arrayValue: (value: AssetValue | undefined, label: string) => readonly AssetValue[];
export declare const integerValue: (value: AssetValue | undefined, label: string, minimum: number, maximum: number) => number;
export declare const defaultPath: (assetId: string, suffix: string) => string;
export declare const jsonFile: (path: string, value: AssetValue) => AssetExtractedFile;
//# sourceMappingURL=common.d.ts.map