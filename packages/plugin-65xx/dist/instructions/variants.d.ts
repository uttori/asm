import { type CpuDefinition, type InstructionForm } from "./schema.js";
/** Canonical assemblable forms for the C64DTV 6502. */
export declare const mos6502DtvForms: readonly InstructionForm[];
/** Canonical assemblable forms for the 65SC02. */
export declare const cmos65sc02Forms: readonly InstructionForm[];
/** Canonical assemblable forms for the Rockwell 65C02. */
export declare const cmos65c02Forms: readonly InstructionForm[];
/** Canonical assemblable forms for the WDC W65C02. */
export declare const wdc65c02Forms: readonly InstructionForm[];
/** Canonical assemblable forms for the CSG 65CE02. */
export declare const csg65ce02Forms: readonly InstructionForm[];
/** Canonical assemblable forms for the Commodore 4510. */
export declare const commodore4510Forms: readonly InstructionForm[];
/** Canonical assemblable forms for the MEGA65 45GS02, including prefixed encodings. */
export declare const mega65Gs02Forms: readonly InstructionForm[];
/** Canonical assemblable forms for the Hudson HuC6280. */
export declare const hudsonHuC6280Forms: readonly InstructionForm[];
/** Canonical assemblable forms for the Mitsubishi M740. */
export declare const mitsubishiM740Forms: readonly InstructionForm[];
/** C64DTV 6502: NMOS encodings with unofficial opcodes and DTV extensions. */
export declare const mos6502DtvCpu: CpuDefinition;
/** 65SC02: CMOS base set without Rockwell bit instructions. */
export declare const cmos65sc02Cpu: CpuDefinition;
/** Rockwell 65C02 with bit manipulation and bit-branch instructions. */
export declare const cmos65c02Cpu: CpuDefinition;
/** WDC W65C02: Rockwell set plus `WAI` and `STP`. */
export declare const wdc65c02Cpu: CpuDefinition;
/** CSG 65CE02: Rockwell set plus Z register, base page, and 16-bit branches. */
export declare const csg65ce02Cpu: CpuDefinition;
/** Commodore 4510: 65CE02 set plus `MAP`/`EOM`. */
export declare const commodore4510Cpu: CpuDefinition;
/** MEGA65 45GS02: 4510 set plus 32-bit quad and flat-memory prefixed forms. */
export declare const mega65Gs02Cpu: CpuDefinition;
/** Hudson HuC6280: Rockwell set plus PC Engine block transfer and MPR instructions. */
export declare const hudsonHuC6280Cpu: CpuDefinition;
/** Mitsubishi M740: independent CMOS-derived set with special-page and bit instructions. */
export declare const mitsubishiM740Cpu: CpuDefinition;
/** Every ca65-derived variant CPU, in table order. */
export declare const variantCpus: readonly CpuDefinition[];
/** Canonical assemblable forms keyed by variant architecture id. */
export declare const variantFormsByCpuId: Readonly<Record<string, readonly InstructionForm[]>>;
//# sourceMappingURL=variants.d.ts.map