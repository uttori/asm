import { parseMacroArguments } from "./macro-arguments.js";
/** Public and physical-source entry points share this grammar; errors activate only on execution. */
export function parseCommandOperation(text, raw = text) {
    const command = text.trim();
    try {
        if (!command || command.startsWith(";")) {
            return { kind: "empty", seedBaseImage: raw.trim().startsWith(";`+") };
        }
        if (/^macro(?:\s|$)/i.test(command)) {
            const match = /^macro\s+(\w+)\((.*)\)$/i.exec(command);
            if (!match) {
                throw new Error(`Invalid macro header: ${command}`);
            }
            return {
                kind: "macroHeader",
                name: match[1].trim(),
                parameters: match[2].trim() ? match[2].split(",").map((value) => value.trim()) : [],
            };
        }
        if (command.startsWith("%")) {
            const invocation = command.slice(1);
            const match = /^(\w+)\((.*)\)$/.exec(invocation);
            return {
                kind: "macroCall",
                name: match ? match[1] : invocation,
                arguments: match
                    ? parseMacroArguments(match[2].trim()).map((argument) => argument.value)
                    : [],
                parenthesized: match !== null,
            };
        }
        if (/^undef(?:\s|$)/i.test(command)) {
            const match = /^undef\s+(.+)$/i.exec(command);
            if (!match) {
                throw new Error("undef requires exactly one identifier parameter");
            }
            const rawName = match[1].trim();
            const name = rawName.startsWith('"') && rawName.endsWith('"') ? rawName.slice(1, -1) : rawName;
            const identifier = name.startsWith("!") ? name.slice(1) : name;
            if (!identifier) {
                throw new Error("undef requires a non-empty identifier");
            }
            return { kind: "undef", name: identifier };
        }
        if (!command.startsWith("!")) {
            return undefined;
        }
        if (!command.includes("=")) {
            return { kind: "defineExpansion", name: command.slice(1), dynamic: command.startsWith("!{") };
        }
        const line = command.slice(1).trim();
        if (line.startsWith("{")) {
            let depth = 1;
            let end = 1;
            while (depth > 0 && end < line.length) {
                if (line[end] === "{") {
                    depth++;
                }
                if (line[end] === "}") {
                    depth--;
                }
                end++;
            }
            if (depth !== 0) {
                throw new Error(`Mismatched braces in define: ${text}`);
            }
            const match = /^(=|\+=|:=|#=|\?=)\s*(.*)$/.exec(line.slice(end).trim());
            if (!match) {
                throw new Error(`Invalid define syntax after braces: ${text}`);
            }
            return {
                kind: "defineAssignment",
                name: line.slice(1, end - 1),
                dynamic: true,
                operator: match[1],
                value: match[2].trim(),
            };
        }
        const match = /^(\w+)\s*(=|\+=|:=|#=|\?=)\s*(.*)$/.exec(line);
        if (!match) {
            throw new Error(`Invalid define syntax: ${text}`);
        }
        return {
            kind: "defineAssignment",
            name: match[1],
            dynamic: false,
            operator: match[2],
            value: match[3].trim(),
        };
    }
    catch (cause) {
        return { kind: "invalid", message: cause instanceof Error ? cause.message : String(cause) };
    }
}
//# sourceMappingURL=command-operation.js.map