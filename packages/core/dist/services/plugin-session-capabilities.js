/** Creates a closed capability surface. Every access checks the synchronous borrow, including nested methods. */
export function createPluginSessionCapabilities(session, assertBorrowed) {
    const moduleCapabilities = Object.freeze({
        apiVersion: 1,
        get id() {
            assertBorrowed();
            return session.moduleIdentity;
        },
        selectSection(options) {
            assertBorrowed();
            session.selectModuleSection(options);
        },
        declare(name, visibility) {
            assertBorrowed();
            session.declareModuleSymbol(name, visibility);
        },
        exportSymbol(name) {
            assertBorrowed();
            session.exportModuleSymbol(name);
        },
        compile(expression) {
            assertBorrowed();
            return session.compileLinkExpression(expression);
        },
        write(expression, width, endianness) {
            assertBorrowed();
            session.writeExpression(expression, width, endianness);
        },
        reserve(count, fill) {
            assertBorrowed();
            session.reserveModuleBytes(count, fill);
        },
        align(boundary, fill) {
            assertBorrowed();
            session.alignModule(boundary, fill);
        },
    });
    return Object.freeze({
        get module() {
            assertBorrowed();
            return session.moduleAssembly ? moduleCapabilities : undefined;
        },
        get targetOptions() {
            assertBorrowed();
            return session.targetOptions;
        },
        get arch() {
            assertBorrowed();
            return session.arch;
        },
        get currentLine() {
            assertBorrowed();
            return session.currentLine;
        },
        get canFinalize() {
            assertBorrowed();
            return session.canFinalize;
        },
        get isDefinitionCollectionStage() {
            assertBorrowed();
            return session.isDefinitionCollectionStage;
        },
        get currentNamespace() {
            assertBorrowed();
            return session.currentNamespace;
        },
        set currentNamespace(value) {
            assertBorrowed();
            session.currentNamespace = value;
        },
        get currentTargetAddress() {
            assertBorrowed();
            return session.currentTargetAddress;
        },
        set currentTargetAddress(value) {
            assertBorrowed();
            session.currentTargetAddress = value;
        },
        get currentTargetBaseAddress() {
            assertBorrowed();
            return session.currentTargetBaseAddress;
        },
        set currentTargetBaseAddress(value) {
            assertBorrowed();
            session.currentTargetBaseAddress = value;
        },
        get currentTargetStartAddress() {
            assertBorrowed();
            return session.currentTargetStartAddress;
        },
        set currentTargetStartAddress(value) {
            assertBorrowed();
            session.currentTargetStartAddress = value;
        },
        get currentTargetBaseStartAddress() {
            assertBorrowed();
            return session.currentTargetBaseStartAddress;
        },
        set currentTargetBaseStartAddress(value) {
            assertBorrowed();
            session.currentTargetBaseStartAddress = value;
        },
        get bytes() {
            assertBorrowed();
            return session.bytes;
        },
        set bytes(value) {
            assertBorrowed();
            session.bytes = value;
        },
        get outputFillByte() {
            assertBorrowed();
            return session.outputFillByte;
        },
        set outputFillByte(value) {
            assertBorrowed();
            session.outputFillByte = value;
        },
        get baseImage() {
            assertBorrowed();
            return session.baseImage.slice();
        },
        get outputBytes() {
            assertBorrowed();
            return session.outputBytes;
        },
        set outputBytes(value) {
            assertBorrowed();
            session.outputBytes = value.slice();
        },
        globalSymbols: Object.freeze({
            add(name) {
                assertBorrowed();
                session.globalSymbols.add(name);
            },
        }),
        labelTable: Object.freeze({
            get(name) {
                assertBorrowed();
                const value = session.labelTable.get(name);
                return value ? { ...value } : undefined;
            },
            set(name, value) {
                assertBorrowed();
                session.labelTable.set(name, { ...value });
            },
        }),
        resolveActiveArchitecture() {
            assertBorrowed();
            const active = session.resolveActiveArchitecture();
            return {
                name: active.name,
                ...(active.definition ? { definition: { encoder: active.definition.encoder } } : {}),
            };
        },
        selectArchitecture(...args) {
            assertBorrowed();
            return session.selectArchitecture(...args);
        },
        resolvedefines(...args) {
            assertBorrowed();
            return session.resolvedefines(...args);
        },
        evaluateAssertion(...args) {
            assertBorrowed();
            return session.evaluateAssertion(...args);
        },
        setWritePosition(...args) {
            assertBorrowed();
            return session.setWritePosition(...args);
        },
        step(...args) {
            assertBorrowed();
            return session.step(...args);
        },
        write1(...args) {
            assertBorrowed();
            return session.write1(...args);
        },
        write2(...args) {
            assertBorrowed();
            return session.write2(...args);
        },
        write3(...args) {
            assertBorrowed();
            return session.write3(...args);
        },
        writeOutputBytes(...args) {
            assertBorrowed();
            return session.writeOutputBytes(...args);
        },
        expandOutput(...args) {
            assertBorrowed();
            return session.expandOutput(...args);
        },
        operandResolver: Object.freeze({
            getnum(...args) {
                assertBorrowed();
                return session.operandResolver.getnum(...args);
            },
        }),
        outputWriter: Object.freeze({
            toOutputOffset(...args) {
                assertBorrowed();
                return session.outputWriter.toOutputOffset(...args);
            },
            fromOutputOffset(...args) {
                assertBorrowed();
                return session.outputWriter.fromOutputOffset(...args);
            },
        }),
        directiveRuntime: Object.freeze({
            executeDataStatement(statement) {
                assertBorrowed();
                session.directiveRuntime.executeDataStatement(statement);
            },
            handleDataDirective(...args) {
                assertBorrowed();
                return session.directiveRuntime.handleDataDirective(...args);
            },
        }),
        includeSource: Object.freeze({
            readFile(...args) {
                assertBorrowed();
                return session.includeSource.readFile(...args);
            },
        }),
        symbolScope: Object.freeze({
            getLabelValue(...args) {
                assertBorrowed();
                return session.symbolScope.getLabelValue(...args);
            },
            qualifySymbolName(...args) {
                assertBorrowed();
                return session.symbolScope.qualifySymbolName(...args);
            },
            setLabel(...args) {
                assertBorrowed();
                return session.symbolScope.setLabel(...args);
            },
        }),
    });
}
//# sourceMappingURL=plugin-session-capabilities.js.map