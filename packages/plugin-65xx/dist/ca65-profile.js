import { CA65_SYNTAX_PROFILE, } from "@uttori/asm-core";
export const CA65_65XX_SESSION_STATE_ID = "65xx.ca65-session-state";
/**
 * Attaches the compile-time session-state brand. The brand is not a runtime property;
 * a non-empty id is the only value `SessionStateStore` reads.
 * @param {{ readonly id: string }} value Key candidate.
 * @returns {boolean} True when the id can identify a session slot.
 */
function isSessionStateKey(value) {
    return value.id.length > 0;
}
/**
 * Builds the branded ca65 session slot key.
 * @param {string} id Plugin-owned slot id.
 * @returns {SessionStateKey<T>} Key for `SessionStateStore.get`.
 */
function createSessionStateKey(id) {
    const key = { id };
    if (!isSessionStateKey(key)) {
        throw new Error(`Invalid session state key '${id}'.`);
    }
    return key;
}
export const ca65SessionStateKey = createSessionStateKey(CA65_65XX_SESSION_STATE_ID);
export function createCa65SessionState() {
    return {
        defaultArchitecture: "65xx.6502",
        currentArchitecture: "65xx.6502",
        cpuStack: [],
        scopeStack: [],
        segmentStack: [],
        currentFlatSegment: "",
    };
}
export function cloneCa65SessionState(state) {
    return {
        ...state,
        cpuStack: [...state.cpuStack],
        scopeStack: [...state.scopeStack],
        segmentStack: [...state.segmentStack],
    };
}
export function resetCa65StageState(state) {
    state.currentArchitecture = state.defaultArchitecture;
    state.cpuStack = [];
    state.scopeStack = [];
    state.segmentStack = [];
    state.currentFlatSegment = "";
}
/** ca65 spelling → canonical 65xx architecture identity. */
export const ca65CpuNames = Object.freeze({
    "6502": "65xx.6502",
    "6502x": "65xx.6502x",
    "2a03": "65xx.2a03",
    "2a07": "65xx.2a03",
    "6502dtv": "65xx.6502dtv",
    "65sc02": "65xx.65sc02",
    "65c02": "65xx.65c02",
    w65c02: "65xx.w65c02",
    "65ce02": "65xx.65ce02",
    "4510": "65xx.4510",
    "45gs02": "65xx.45gs02",
    huc6280: "65xx.huc6280",
    m740: "65xx.m740",
});
export function resolve65xxCpuName(name) {
    return ca65CpuNames[name.trim().toLowerCase()];
}
/** ca65 CPU shorthand directives. */
export const ca65CpuShorthands = Object.freeze({
    p02: "6502",
    p02x: "6502x",
    pdtv: "6502dtv",
    psc02: "65sc02",
    pc02: "65c02",
    pwc02: "w65c02",
    pce02: "65ce02",
    p4510: "4510",
    p45gs02: "45gs02",
    p6280: "huc6280",
    pm740: "m740",
});
const cpuPredicateSymbols = Object.freeze({
    ifp02: "__CA65_CPU_6502__",
    ifp02x: "__CA65_CPU_6502X__",
    ifpdtv: "__CA65_CPU_6502DTV__",
    ifpsc02: "__CA65_CPU_65SC02__",
    ifpc02: "__CA65_CPU_65C02__",
    ifpwc02: "__CA65_CPU_W65C02__",
    ifpce02: "__CA65_CPU_65CE02__",
    ifp4510: "__CA65_CPU_4510__",
    ifp45gs02: "__CA65_CPU_45GS02__",
    ifp6280: "__CA65_CPU_HUC6280__",
    ifpm740: "__CA65_CPU_M740__",
});
export const ca65CpuPredicateByArchitecture = Object.freeze({
    "65xx.6502": "__CA65_CPU_6502__",
    "65xx.6502x": "__CA65_CPU_6502X__",
    "65xx.2a03": "__CA65_CPU_6502X__",
    "65xx.6502dtv": "__CA65_CPU_6502DTV__",
    "65xx.65sc02": "__CA65_CPU_65SC02__",
    "65xx.65c02": "__CA65_CPU_65C02__",
    "65xx.w65c02": "__CA65_CPU_W65C02__",
    "65xx.65ce02": "__CA65_CPU_65CE02__",
    "65xx.4510": "__CA65_CPU_4510__",
    "65xx.45gs02": "__CA65_CPU_45GS02__",
    "65xx.huc6280": "__CA65_CPU_HUC6280__",
    "65xx.m740": "__CA65_CPU_M740__",
});
function splitArguments(value) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < value.length; index++) {
        const character = value[index];
        if (character === "(") {
            depth++;
        }
        else if (character === ")") {
            depth--;
        }
        else if (character === "," && depth === 0) {
            parts.push(value.slice(start, index).trim());
            start = index + 1;
        }
    }
    parts.push(value.slice(start).trim());
    return parts.filter(Boolean);
}
function rewriteScopedNames(value) {
    let result = "";
    let quote = "";
    for (let index = 0; index < value.length; index++) {
        const character = value[index];
        if ((character === '"' || character === "'") && value[index - 1] !== "\\") {
            quote = quote === character ? "" : quote || character;
        }
        if (!quote && character === ":" && value[index + 1] === ":") {
            result += "_";
            index++;
        }
        else {
            result += character;
        }
    }
    return result;
}
/**
 * Rewrites structural ca65 syntax into target-neutral core forms.
 * @param {string} command The source command.
 * @param {SyntaxRewriteContext} context Source location metadata.
 * @returns {string} The target-neutral command.
 */
export function rewriteCa65Command(command, context) {
    let rewritten = rewriteScopedNames(command);
    rewritten = rewritten.replace(/\.(defined|lobyte|hibyte|bankbyte|loword|hiword)\s*\(/gi, "$1(");
    rewritten = rewritten.replace(/(^|[^\w@])@([0-7]+)\b/g, (_match, prefix, digits) => `${prefix}${Number.parseInt(digits, 8)}`);
    rewritten = rewritten.replace(/<>/g, "!=");
    const match = rewritten.match(/^(\s*)\.([\dA-Za-z]+)\b(.*)$/);
    if (!match) {
        return rewritten;
    }
    const [, indent, rawKeyword, rawRest] = match;
    const keyword = rawKeyword.toLowerCase();
    const rest = rawRest.trim();
    const predicate = cpuPredicateSymbols[keyword];
    if (predicate) {
        return `${indent}if ${predicate}`;
    }
    if (["if", "elseif", "else", "endif"].includes(keyword)) {
        return `${indent}${keyword}${rest ? ` ${rest}` : ""}`;
    }
    if (keyword === "ifdef") {
        return `${indent}if defined(${rest})`;
    }
    if (keyword === "ifndef") {
        return `${indent}if defined(${rest}) == 0`;
    }
    if (keyword === "macro") {
        const header = rest.match(/^([A-Z_a-z]\w*)\s*(.*)$/);
        if (!header) {
            return rewritten;
        }
        const params = splitArguments(header[2]).join(",");
        return `${indent}macro ${header[1]}(${params})`;
    }
    if (keyword === "endmacro") {
        return `${indent}endmacro`;
    }
    if (keyword === "repeat") {
        const [count = "0", variable = `__ca65_repeat_${context.sourceLine}`] = splitArguments(rest);
        return `${indent}for ${variable} = 0..(${count})`;
    }
    if (keyword === "endrepeat") {
        return `${indent}endfor`;
    }
    if (keyword === "undefine") {
        return `${indent}undef ${rest}`;
    }
    return rewritten;
}
/** 65xx-owned ca65 source profile layered on the neutral core contract. */
export const CA65_65XX_SYNTAX_PROFILE = Object.freeze({
    ...CA65_SYNTAX_PROFILE,
    id: "ca65-65xx",
    rewriteCommand: rewriteCa65Command,
    bareMacroInvocations: true,
    macroParameterPrefix: "\\",
});
//# sourceMappingURL=ca65-profile.js.map