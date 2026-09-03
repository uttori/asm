import type { AssetCodecContext, AssetDecodeContext, AssetExtractedFile, AssetValue } from "../asset-codec.js";
export type AssetObject = Readonly<Record<string, AssetValue>>;
export type ByteOrder = "big" | "little";
export declare const objectValue: (value: AssetValue | undefined, label: string) => AssetObject;
export declare const optionsFor: (context: AssetCodecContext) => AssetObject;
export declare const stringOption: (options: AssetObject, key: string, fallback?: string) => string | undefined;
export declare const booleanOption: (options: AssetObject, key: string, fallback?: boolean) => boolean;
export declare const integerOption: (options: AssetObject, key: string, settings?: {
    readonly minimum?: number;
    readonly maximum?: number;
    readonly fallback?: number;
}) => number | undefined;
export declare const byteOrderOption: (options: AssetObject) => ByteOrder;
export declare const readExactAssetBytes: (context: AssetDecodeContext, size?: number) => Uint8Array;
export declare const readAssetBytes: (context: AssetCodecContext, size: number) => Uint8Array;
export declare const resolveCountAndSize: (context: AssetCodecContext, unitSize: number, options?: Readonly<Record<string, AssetValue>>) => {
    readonly count: number;
    readonly size: number;
};
export declare const readInteger: (bytes: Uint8Array, offset: number, width: number, endian: ByteOrder, signed?: boolean) => number;
export declare const writeInteger: (bytes: Uint8Array, offset: number, width: number, endian: ByteOrder, value: number, signed?: boolean) => void;
export declare const decodedObject: (value: AssetValue, owner: string) => AssetObject;
export declare const numberArray: (value: AssetValue | undefined, label: string) => readonly number[];
export declare const byteArray: (value: AssetValue | undefined, label: string) => readonly number[];
export declare const defaultAssetPath: (assetId: string, extension: string) => string;
export declare const jsonFile: (path: string, value: AssetValue) => AssetExtractedFile;
//# sourceMappingURL=common.d.ts.map