import { definePlugin, ASAR_SYNTAX_PROFILE, NATIVE_SYNTAX_PROFILE, PLUGIN_API_VERSION, PluginManager, } from "@uttori/asm-core";
import { CA65_65XX_SESSION_STATE_ID, CA65_65XX_SYNTAX_PROFILE, ca65CpuPredicateByArchitecture, ca65CpuShorthands, ca65SessionStateKey, cloneCa65SessionState, createCa65SessionState, resetCa65StageState, } from "./ca65-profile.js";
import { Cpu6502Decoder, cpu6502Specifications } from "./decoder.js";
import { ca65DirectiveSyntax } from "./directives/ca65-syntax.js";
import { buildInstructionCatalog } from "./instructions/catalog.js";
import { nmos6502Cpu, nmos6502Forms, nmos6502xCpu, nmos6502xForms, ricoh2a03Cpu, } from "./instructions/opcodes.js";
import { variantCpus, variantFormsByCpuId } from "./instructions/variants.js";
import { ld65LinkRecipe } from "./linker-config.js";
import { nesAssetFormats } from "./nes/assets.js";
import { parse65xxOperands } from "./operands/syntax.js";
import { nes65xxSessionStateKey, NES_65XX_SESSION_STATE_ID, cloneNes65xxSessionState, resetNes65xxStageState, } from "./session-state.js";
import { createNesLinkTarget, createNesSourceLinkRecipe } from "./target/link-target.js";
import { NES_65XX_ADDRESS_SPACE_ID, NES_65XX_LIFECYCLE_ID, NES_65XX_OUTPUT_FORMAT_ID, NES_65XX_TARGET_ID, createInitialNesState, createNes65xxTargetOptions, createNesAddressSpace, createNesLifecycle, createNesOutputFormat, } from "./target/nes.js";
import { TypedArch65xx } from "./typed-architecture.js";
/** Flat 16-bit raw binary target (`65xx`, `6502-raw` aliases). */
export const RAW_65XX_TARGET_ID = "65xx.raw";
/** Identity map: logical address − origin = file offset. */
export const FLAT_65XX_ADDRESS_SPACE_ID = "65xx.flat16";
export const RAW_65XX_OUTPUT_FORMAT_ID = "65xx.raw-output";
/** Resets PC to `origin` at the start of each assembly stage. */
export const RAW_65XX_LIFECYCLE_ID = "65xx.raw-lifecycle";
/** Headerless raw target using the ca65 source profile. */
export const CA65_RAW_65XX_TARGET_ID = "65xx.ca65-raw";
/** ca65 directive set used by ca65-profile targets. */
export const CA65_65XX_DIRECTIVE_SET_ID = "65xx.ca65-directives";
export const CA65_65XX_EXPRESSION_SET_ID = "65xx.ca65-expressions";
export const CA65_65XX_LIFECYCLE_ID = "65xx.ca65-lifecycle";
/**
 * Validates target options. Unknown keys throw. Omitted object → `{ origin: 0 }`.
 *
 * @param {unknown} configured Plugin/target options object.
 * @returns {Raw65xxTargetOptions} Normalized options.
 */
export function createRaw65xxTargetOptions(configured) {
    if (configured === undefined) {
        return { origin: 0 };
    }
    if (typeof configured !== "object" || configured === null || Array.isArray(configured)) {
        throw new Error("65xx raw target options must be an object with an optional numeric 'origin'.");
    }
    const keys = Object.keys(configured);
    const unknown = keys.filter((key) => key !== "origin");
    if (unknown.length > 0) {
        throw new Error(`Unknown 65xx raw target option(s): ${unknown.join(", ")}.`);
    }
    const value = "origin" in configured ? configured.origin : 0;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 0xffff) {
        throw new Error("65xx raw target origin must be an integer from 0 through 65535.");
    }
    return { origin: value };
}
const descriptor = (keyword, summary, syntax, group) => ({ keyword, summary, syntax, group });
const ca65Tooling = [
    descriptor("setcpu", "Select a 65xx CPU.", '.setcpu "CPU"', "architecture"),
    descriptor("cpu", "Alias for .setcpu.", '.cpu "CPU"', "architecture"),
    descriptor("pushcpu", "Push the current CPU.", ".pushcpu", "architecture"),
    descriptor("popcpu", "Restore the pushed CPU.", ".popcpu", "architecture"),
    descriptor("segment", "Switch to an ld65 segment.", '.segment "NAME"', "layout"),
    descriptor("pushseg", "Push the current flat segment.", ".pushseg", "layout"),
    descriptor("popseg", "Restore the pushed flat segment.", ".popseg", "layout"),
    descriptor("export", "Export a symbol to other files.", ".export ident[, ident...]", "label"),
    descriptor("import", "Import a symbol defined in another file.", ".import ident[, ident...]", "label"),
    descriptor("byte", "Emit one or more bytes.", ".byte value[, value...]", "data"),
    descriptor("byt", "Alias for .byte.", ".byt value[, value...]", "data"),
    descriptor("addr", "Emit 16-bit little-endian addresses.", ".addr value[, value...]", "data"),
    descriptor("word", "Alias for .addr.", ".word value[, value...]", "data"),
    descriptor("lobytes", "Emit the low byte of each expression.", ".lobytes expr[, expr...]", "data"),
    descriptor("hibytes", "Emit the high byte of each expression.", ".hibytes expr[, expr...]", "data"),
    descriptor("dbyt", "Emit 16-bit big-endian words.", ".dbyt value[, value...]", "data"),
    descriptor("dword", "Emit 32-bit little-endian values.", ".dword value[, value...]", "data"),
    descriptor("faraddr", "Emit 24-bit little-endian addresses.", ".faraddr value[, value...]", "data"),
    descriptor("res", "Reserve bytes with an optional fill value.", ".res count[, fill]", "data"),
    descriptor("align", "Align the location counter.", ".align boundary[, fill]", "layout"),
    descriptor("incbin", "Include a binary range.", '.incbin "file"[, offset[, size]]', "include"),
    descriptor("assert", "Require an expression to be true.", '.assert expr[, error[, "message"]]', "diagnostic"),
    descriptor("scope", "Enter a lexical scope.", ".scope [name]", "label"),
    descriptor("endscope", "Leave a lexical scope.", ".endscope", "label"),
    descriptor("proc", "Define and enter a procedure scope.", ".proc name", "label"),
    descriptor("endproc", "Leave a procedure scope.", ".endproc", "label"),
];
const ca65ExpressionFunctions = [
    ["lobyte", "Low byte of a value.", (value) => value & 0xff],
    ["hibyte", "High byte of a value.", (value) => (value >>> 8) & 0xff],
    ["bankbyte", "Bank byte of a value.", (value) => (value >>> 16) & 0xff],
    ["loword", "Low word of a value.", (value) => value & 0xffff],
    ["hiword", "High word of a value.", (value) => (value >>> 16) & 0xffff],
];
/**
 * Registers a lowered-phase 65xx directive and attaches hover/completion copy.
 * @param {string} id The directive id.
 * @param {readonly string[]} keywords The directive keywords.
 * @returns {DirectiveContribution} The directive contribution.
 */
const directive = (id, keywords) => {
    const wanted = new Set(keywords);
    return {
        id,
        keywords,
        phase: "lowered",
        syntax: ca65DirectiveSyntax(id),
        tooling: ca65Tooling.filter((entry) => wanted.has(entry.keyword)),
    };
};
/**
 * Rejects addresses outside the unsigned 16-bit flat space.
 * @param {number} address Candidate CPU address.
 * @returns {number} The same address when it is in range.
 */
function validate(address) {
    if (!Number.isInteger(address) || address < 0 || address > 0xffff) {
        throw new Error(`Address $${address.toString(16).toUpperCase()} is outside flat16.`);
    }
    return address;
}
/**
 * 16-bit address space with no bank wrap. Writes below `origin` are rejected.
 * @param {TargetFactoryContext} options The target factory context.
 * @returns {TargetAddressSpace} The address space.
 */
function createFlat65xxAddressSpace({ options }) {
    const { origin } = createRaw65xxTargetOptions(options);
    return {
        addressWidth: 16,
        defaultOrigin: origin,
        normalizeForWrite: validate,
        advance(address, amount) {
            return validate(address + amount);
        },
        toOutputOffset(address) {
            return Number.isInteger(address) && address >= origin && address <= 0xffff
                ? address - origin
                : -1;
        },
        fromOutputOffset(offset) {
            const address = origin + offset;
            return Number.isInteger(offset) && offset >= 0 && address <= 0xffff ? address : -1;
        },
        validateWrite(address, width) {
            validate(address);
            validate(address + width - 1);
            if (address < origin) {
                throw new Error(`Address $${address.toString(16).toUpperCase()} precedes raw origin $${origin.toString(16).toUpperCase()}.`);
            }
        },
    };
}
/**
 * Sets ca65 CPU predicate symbols for the selected architecture.
 * @param {import("@uttori/asm-core/plugin").PluginSessionCapabilities} session Active assembler session.
 * @param {string} architecture Architecture id being selected.
 */
function updatePredicates(session, architecture) {
    // Several execution profiles share one ca65 predicate; assign each symbol exactly once.
    for (const symbol of new Set(Object.values(ca65CpuPredicateByArchitecture))) {
        session.globalSymbols.add(symbol);
        session.labelTable.set(symbol, {
            value: ca65CpuPredicateByArchitecture[architecture] === symbol ? 1 : 0,
            isStatic: true,
        });
    }
}
/**
 * Registers NMOS/CMOS/Commodore/MEGA65/Hudson/Mitsubishi architectures plus the flat raw target.
 * Used by the plugin `activate` hook and by tests that want contributions
 * without constructing a full plugin object.
 *
 * @param {PluginActivationContext} context Plugin activation context.
 */
export function register65xxContributions(context) {
    for (const format of nesAssetFormats) {
        context.registerAssetFormat(format);
    }
    for (const [cpu, forms] of [
        [nmos6502Cpu, nmos6502Forms],
        [nmos6502xCpu, nmos6502xForms],
        [ricoh2a03Cpu, nmos6502xForms],
        ...variantCpus.map((variantCpu) => [variantCpu, variantFormsByCpuId[variantCpu.id] ?? []]),
    ]) {
        const catalog = buildInstructionCatalog(forms);
        context.registerArchitecture({
            id: cpu.id,
            operandGrammar: { version: "2", parse: parse65xxOperands },
            aliases: cpu.aliases,
            displayName: cpu.displayName,
            unknownInstructionBehavior: "throw",
            // Same as 65816: `LDA $12,x` is one operand, not two.
            createTypedEncoder: () => new TypedArch65xx(cpu),
            // Vendor/CMOS tables have different semantics; expose the decoder only for NMOS/Ricoh profiles.
            createDecoder: cpu.features.has("nmos") && !cpu.features.has("dtv")
                ? () => new Cpu6502Decoder(cpu)
                : undefined,
            instructionSpecifications: cpu.features.has("nmos") && !cpu.features.has("dtv")
                ? cpu6502Specifications(cpu)
                : undefined,
            instructions: catalog,
        });
    }
    context.registerAddressSpace({
        id: FLAT_65XX_ADDRESS_SPACE_ID,
        create: createFlat65xxAddressSpace,
    });
    context.registerOutputFormat({
        id: RAW_65XX_OUTPUT_FORMAT_ID,
        // Emit the buffer as a headerless image, without checksum or padding.
        create: () => ({
            finalize: () => undefined,
            getOutput: ({ outputBytes }) => Uint8Array.from(outputBytes),
        }),
    });
    context.registerLifecycle({
        id: RAW_65XX_LIFECYCLE_ID,
        create: ({ options }) => {
            const { origin } = createRaw65xxTargetOptions(options);
            return {
                onStageStart: ({ session }) => {
                    session.setWritePosition(origin);
                    session.bytes = 0;
                },
            };
        },
    });
    context.registerTarget({
        id: RAW_65XX_TARGET_ID,
        aliases: ["65xx", "6502-raw"],
        displayName: "65xx flat 16-bit raw binary",
        defaultArchitecture: nmos6502Cpu.id,
        architectures: [
            nmos6502Cpu.id,
            nmos6502xCpu.id,
            ricoh2a03Cpu.id,
            ...variantCpus.map((cpu) => cpu.id),
        ],
        addressSpace: FLAT_65XX_ADDRESS_SPACE_ID,
        outputFormat: RAW_65XX_OUTPUT_FORMAT_ID,
        directiveSets: [],
        expressionSets: [],
        lifecycle: [RAW_65XX_LIFECYCLE_ID],
        syntaxProfile: NATIVE_SYNTAX_PROFILE,
        defaultOutputExtension: ".bin",
        createOptions: createRaw65xxTargetOptions,
    });
    context.registerSessionState({
        id: CA65_65XX_SESSION_STATE_ID,
        create: createCa65SessionState,
        clone: cloneCa65SessionState,
        resetForStage: resetCa65StageState,
    });
    context.registerExpressionSet({
        id: CA65_65XX_EXPRESSION_SET_ID,
        functions: ca65ExpressionFunctions.map(([name, summary, transform]) => ({
            name,
            signature: { parameters: ["value"], minimumArguments: 1, maximumArguments: 1 },
            summary,
            evaluate: (_expressionContext, args) => {
                const value = args[0];
                if (typeof value !== "number") {
                    throw new Error(`${name}() expects a numeric argument.`);
                }
                return transform(value);
            },
        })),
    });
    context.registerLifecycle({
        id: CA65_65XX_LIFECYCLE_ID,
        create: () => {
            return {
                onSessionCreated: ({ session, state }) => {
                    const profile = state.get(ca65SessionStateKey);
                    profile.defaultArchitecture = session.resolveActiveArchitecture().name;
                    profile.currentArchitecture = profile.defaultArchitecture;
                    updatePredicates(session, profile.defaultArchitecture);
                },
                onStageStart: ({ session, state }) => {
                    const profile = state.get(ca65SessionStateKey);
                    session.selectArchitecture(profile.defaultArchitecture, profile.defaultArchitecture);
                },
                onArchitectureSelected: ({ session, state, architecture }) => {
                    const profile = state.get(ca65SessionStateKey);
                    profile.currentArchitecture = architecture;
                    updatePredicates(session, architecture);
                },
            };
        },
    });
    context.registerTarget({
        id: CA65_RAW_65XX_TARGET_ID,
        aliases: ["ca65-raw"],
        displayName: "65xx ca65-compatible flat 16-bit raw binary",
        defaultArchitecture: nmos6502Cpu.id,
        architectures: [
            nmos6502Cpu.id,
            nmos6502xCpu.id,
            ricoh2a03Cpu.id,
            ...variantCpus.map((cpu) => cpu.id),
        ],
        addressSpace: FLAT_65XX_ADDRESS_SPACE_ID,
        outputFormat: RAW_65XX_OUTPUT_FORMAT_ID,
        directiveSets: [CA65_65XX_DIRECTIVE_SET_ID],
        expressionSets: [CA65_65XX_EXPRESSION_SET_ID],
        lifecycle: [RAW_65XX_LIFECYCLE_ID, CA65_65XX_LIFECYCLE_ID],
        syntaxProfile: CA65_65XX_SYNTAX_PROFILE,
        defaultOutputExtension: ".bin",
        createOptions: createRaw65xxTargetOptions,
    });
    context.registerSessionState({
        id: NES_65XX_SESSION_STATE_ID,
        create: createInitialNesState,
        clone: cloneNes65xxSessionState,
        resetForStage: resetNes65xxStageState,
    });
    context.registerAddressSpace({
        id: NES_65XX_ADDRESS_SPACE_ID,
        create: createNesAddressSpace,
    });
    context.registerOutputFormat({
        id: NES_65XX_OUTPUT_FORMAT_ID,
        create: createNesOutputFormat,
    });
    context.registerLifecycle({
        id: NES_65XX_LIFECYCLE_ID,
        create: createNesLifecycle,
    });
    context.registerDirectiveSet({
        id: CA65_65XX_DIRECTIVE_SET_ID,
        directives: [
            directive("65xx.directive.segment", ["segment"]),
            directive("65xx.directive.setcpu", ["setcpu", "cpu"]),
            directive("65xx.directive.pushcpu", ["pushcpu"]),
            directive("65xx.directive.popcpu", ["popcpu"]),
            directive("65xx.directive.cpu-shorthand", Object.keys(ca65CpuShorthands)),
            directive("65xx.directive.export", ["export"]),
            directive("65xx.directive.import", ["import"]),
            directive("65xx.directive.byte", ["byte", "byt"]),
            directive("65xx.directive.addr", ["addr", "word"]),
            directive("65xx.directive.lobytes", ["lobytes"]),
            directive("65xx.directive.hibytes", ["hibytes"]),
            directive("65xx.directive.dbyt", ["dbyt"]),
            directive("65xx.directive.dword", ["dword"]),
            directive("65xx.directive.faraddr", ["faraddr"]),
            directive("65xx.directive.res", ["res"]),
            directive("65xx.directive.align", ["align"]),
            directive("65xx.directive.incbin", ["incbin"]),
            directive("65xx.directive.assert", ["assert"]),
            directive("65xx.directive.scope", ["scope", "proc"]),
            directive("65xx.directive.endscope", ["endscope", "endproc"]),
            directive("65xx.directive.pushseg", ["pushseg"]),
            directive("65xx.directive.popseg", ["popseg"]),
            directive("65xx.directive.unsupported-object", [
                "autoimport",
                "constructor",
                "debuginfo",
                "destructor",
                "exportzp",
                "forceimport",
                "globalzp",
                "importzp",
                "interruptor",
                "reloc",
            ]),
            directive("65xx.directive.unsupported-macro", ["exitmacro", "local"]),
        ],
        tooling: ca65Tooling,
    });
    context.registerTarget({
        id: NES_65XX_TARGET_ID,
        aliases: ["nes", "ines", "6502-nes"],
        displayName: "NES iNES (Asar source or ca65 layout)",
        defaultArchitecture: nmos6502Cpu.id,
        architectures: [
            nmos6502Cpu.id,
            nmos6502xCpu.id,
            ricoh2a03Cpu.id,
            ...variantCpus.map((cpu) => cpu.id),
        ],
        addressSpace: NES_65XX_ADDRESS_SPACE_ID,
        outputFormat: NES_65XX_OUTPUT_FORMAT_ID,
        directiveSets: [CA65_65XX_DIRECTIVE_SET_ID],
        expressionSets: [CA65_65XX_EXPRESSION_SET_ID],
        lifecycle: [NES_65XX_LIFECYCLE_ID, CA65_65XX_LIFECYCLE_ID],
        syntaxProfile: CA65_65XX_SYNTAX_PROFILE,
        createSyntaxProfile: (options) => options.sourceStyle === "asar" ? ASAR_SYNTAX_PROFILE : CA65_65XX_SYNTAX_PROFILE,
        defaultOutputExtension: ".nes",
        createOptions: createNes65xxTargetOptions,
        createLinkTarget: createNesLinkTarget,
        createSourceLinkRecipe: createNesSourceLinkRecipe,
        createLinkRecipe: ({ state }) => {
            const nes = state.get(nes65xxSessionStateKey);
            const recipe = ld65LinkRecipe(nes.linker, NES_65XX_TARGET_ID);
            return {
                ...recipe,
                regions: [
                    {
                        name: "__ines_header",
                        start: 0,
                        size: nes.header.length,
                        outputOffset: 0,
                        initialBytes: [...nes.header],
                    },
                    // The flat NES lifecycle fills the complete cartridge with the target byte, including MEMORY gaps.
                    // Keep its established output here; ld65LinkRecipe remains available for explicit per-region policies.
                    ...recipe.regions.map((region) => ({
                        ...region,
                        ...(region.outputOffset !== undefined
                            ? {
                                outputOffset: region.outputOffset + nes.header.length,
                                fillByte: nes.fillByte,
                            }
                            : {}),
                    })),
                ],
            };
        },
    });
}
/** Activation accepts either target's configuration; the selected target validates it again per session. */
function validate65xxPluginOptions(configured) {
    if (configured &&
        typeof configured === "object" &&
        !Array.isArray(configured) &&
        ("header" in configured ||
            "linkerConfig" in configured ||
            "fillByte" in configured ||
            "sourceStyle" in configured)) {
        const unknown = Object.keys(configured).filter((key) => !["header", "linkerConfig", "fillByte", "sourceStyle"].includes(key));
        if (unknown.length) {
            throw new Error(`Unknown NES target option(s): ${unknown.join(", ")}.`);
        }
        createNes65xxTargetOptions(configured);
        return { ...configured };
    }
    return createRaw65xxTargetOptions(configured);
}
const plugin = definePlugin({
    manifest: {
        id: "uttori.asm-plugin-65xx",
        name: "Uttori ASM 65xx",
        version: "1.0.0",
        apiVersion: PLUGIN_API_VERSION,
        description: "65xx NMOS, CMOS, Commodore, MEGA65, Hudson, and Mitsubishi architectures with raw and NES iNES targets.",
    },
    validateOptions: validate65xxPluginOptions,
    activate: register65xxContributions,
});
/**
 * Activates this plugin and freezes a reusable host environment.
 *
 * @param {unknown} options Raw-target options (`origin`, ...).
 * @returns {Promise<AssemblerEnvironment>} Frozen assembler environment.
 */
export async function create65xxAssemblerEnvironment(options = {}) {
    const manager = new PluginManager();
    await manager.activatePlugins([{ plugin, options }]);
    return manager.freeze();
}
export default plugin;
export { Cpu6502Decoder, cpu6502Specifications, formatCpu6502Instruction } from "./decoder.js";
export { NesCartridge } from "./nes/cartridge.js";
export { NES_CHR_CODEC, NES_TEXT_CODEC, nesChrPng, encodeNesChrPng, nesTextMap, decodeNesText, nesAssetFormats, } from "./nes/assets.js";
export { initialNesMapperState, validateNesMapper, nesPrgOffset, writeNesMapper, nesExecutionContext, } from "./nes/mapper.js";
export { ricoh2a03Cpu } from "./instructions/opcodes.js";
export { Arch65xx, materializeOpcodeForm } from "./architecture.js";
export { buildInstructionCatalog } from "./instructions/catalog.js";
export { getCpuAssemblyForms, getOpcodeForm, getCpuDecodeTable, nmos6502Cpu, nmos6502DecodeTable, nmos6502Forms, nmos6502xCpu, nmos6502xForms, } from "./instructions/opcodes.js";
export { cmos65c02Cpu, cmos65c02Forms, cmos65sc02Cpu, cmos65sc02Forms, commodore4510Cpu, commodore4510Forms, csg65ce02Cpu, csg65ce02Forms, mega65Gs02Cpu, mega65Gs02Forms, hudsonHuC6280Cpu, hudsonHuC6280Forms, mitsubishiM740Cpu, mitsubishiM740Forms, mos6502DtvCpu, mos6502DtvForms, variantCpus, variantFormsByCpuId, wdc65c02Cpu, wdc65c02Forms, } from "./instructions/variants.js";
export { matchesFeatures } from "./instructions/schema.js";
export { NES_65XX_ADDRESS_SPACE_ID, NES_65XX_LIFECYCLE_ID, NES_65XX_OUTPUT_FORMAT_ID, NES_65XX_TARGET_ID, createNes65xxTargetOptions, } from "./target/nes.js";
export { NES_65XX_SESSION_STATE_ID, nes65xxSessionStateKey } from "./session-state.js";
export { parseLd65Config, defaultLd65ConfigText, ld65LinkRecipe } from "./linker-config.js";
export { CA65_65XX_SESSION_STATE_ID, CA65_65XX_SYNTAX_PROFILE, ca65CpuNames, ca65CpuShorthands, ca65SessionStateKey, resolve65xxCpuName, rewriteCa65Command, } from "./ca65-profile.js";
export { createNesLinkTarget } from "./target/link-target.js";
//# sourceMappingURL=index.js.map