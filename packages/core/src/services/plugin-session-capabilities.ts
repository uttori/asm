import type { Assembler } from "../assembler.js";
import type { PluginSessionCapabilities } from "../plugin/session-capabilities.js";

/** Creates a closed capability surface. Every access checks the synchronous borrow, including nested methods. */
export function createPluginSessionCapabilities(
  session: Assembler,
  assertBorrowed: () => void,
): PluginSessionCapabilities {
  return Object.freeze({
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
    set currentNamespace(value: string) {
      assertBorrowed();
      session.currentNamespace = value;
    },
    get currentTargetAddress() {
      assertBorrowed();
      return session.currentTargetAddress;
    },
    set currentTargetAddress(value: number) {
      assertBorrowed();
      session.currentTargetAddress = value;
    },
    get currentTargetBaseAddress() {
      assertBorrowed();
      return session.currentTargetBaseAddress;
    },
    set currentTargetBaseAddress(value: number) {
      assertBorrowed();
      session.currentTargetBaseAddress = value;
    },
    get currentTargetStartAddress() {
      assertBorrowed();
      return session.currentTargetStartAddress;
    },
    set currentTargetStartAddress(value: number) {
      assertBorrowed();
      session.currentTargetStartAddress = value;
    },
    get currentTargetBaseStartAddress() {
      assertBorrowed();
      return session.currentTargetBaseStartAddress;
    },
    set currentTargetBaseStartAddress(value: number) {
      assertBorrowed();
      session.currentTargetBaseStartAddress = value;
    },
    get bytes() {
      assertBorrowed();
      return session.bytes;
    },
    set bytes(value: number) {
      assertBorrowed();
      session.bytes = value;
    },
    get outputFillByte() {
      assertBorrowed();
      return session.outputFillByte;
    },
    set outputFillByte(value: number) {
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
    set outputBytes(value: number[] | Uint8Array) {
      assertBorrowed();
      session.outputBytes = value.slice();
    },
    globalSymbols: Object.freeze({
      add(name: string) {
        assertBorrowed();
        session.globalSymbols.add(name);
      },
    }),
    labelTable: Object.freeze({
      get(name: string) {
        assertBorrowed();
        const value = session.labelTable.get(name);
        return value ? { ...value } : undefined;
      },
      set(name: string, value: Parameters<PluginSessionCapabilities["labelTable"]["set"]>[1]) {
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
    selectArchitecture(...args: Parameters<PluginSessionCapabilities["selectArchitecture"]>) {
      assertBorrowed();
      return session.selectArchitecture(...args);
    },
    resolvedefines(...args: Parameters<PluginSessionCapabilities["resolvedefines"]>) {
      assertBorrowed();
      return session.resolvedefines(...args);
    },
    evaluateAssertion(...args: Parameters<PluginSessionCapabilities["evaluateAssertion"]>) {
      assertBorrowed();
      return session.evaluateAssertion(...args);
    },
    setWritePosition(...args: Parameters<PluginSessionCapabilities["setWritePosition"]>) {
      assertBorrowed();
      return session.setWritePosition(...args);
    },
    step(...args: Parameters<PluginSessionCapabilities["step"]>) {
      assertBorrowed();
      return session.step(...args);
    },
    write1(...args: Parameters<PluginSessionCapabilities["write1"]>) {
      assertBorrowed();
      return session.write1(...args);
    },
    write2(...args: Parameters<PluginSessionCapabilities["write2"]>) {
      assertBorrowed();
      return session.write2(...args);
    },
    write3(...args: Parameters<PluginSessionCapabilities["write3"]>) {
      assertBorrowed();
      return session.write3(...args);
    },
    writeOutputBytes(...args: Parameters<PluginSessionCapabilities["writeOutputBytes"]>) {
      assertBorrowed();
      return session.writeOutputBytes(...args);
    },
    expandOutput(...args: Parameters<PluginSessionCapabilities["expandOutput"]>) {
      assertBorrowed();
      return session.expandOutput(...args);
    },
    operandResolver: Object.freeze({
      getnum(...args: Parameters<PluginSessionCapabilities["operandResolver"]["getnum"]>) {
        assertBorrowed();
        return session.operandResolver.getnum(...args);
      },
    }),
    outputWriter: Object.freeze({
      toOutputOffset(
        ...args: Parameters<PluginSessionCapabilities["outputWriter"]["toOutputOffset"]>
      ) {
        assertBorrowed();
        return session.outputWriter.toOutputOffset(...args);
      },
      fromOutputOffset(
        ...args: Parameters<PluginSessionCapabilities["outputWriter"]["fromOutputOffset"]>
      ) {
        assertBorrowed();
        return session.outputWriter.fromOutputOffset(...args);
      },
    }),
    directiveRuntime: Object.freeze({
      executeDataStatement(statement: import("../ir/statement-node.js").NumericDataStatement) {
        assertBorrowed();
        session.directiveRuntime.executeDataStatement(statement);
      },
      handleDataDirective(
        ...args: Parameters<PluginSessionCapabilities["directiveRuntime"]["handleDataDirective"]>
      ) {
        assertBorrowed();
        return session.directiveRuntime.handleDataDirective(...args);
      },
    }),
    includeSource: Object.freeze({
      readFile(...args: Parameters<PluginSessionCapabilities["includeSource"]["readFile"]>) {
        assertBorrowed();
        return session.includeSource.readFile(...args);
      },
    }),
    symbolScope: Object.freeze({
      getLabelValue(
        ...args: Parameters<PluginSessionCapabilities["symbolScope"]["getLabelValue"]>
      ) {
        assertBorrowed();
        return session.symbolScope.getLabelValue(...args);
      },
      qualifySymbolName(
        ...args: Parameters<PluginSessionCapabilities["symbolScope"]["qualifySymbolName"]>
      ) {
        assertBorrowed();
        return session.symbolScope.qualifySymbolName(...args);
      },
      setLabel(...args: Parameters<PluginSessionCapabilities["symbolScope"]["setLabel"]>) {
        assertBorrowed();
        return session.symbolScope.setLabel(...args);
      },
    }),
  });
}
