import { checkedDeclaration, parseDeclarationNode, structDeclarationGuard, } from "../ir/declaration-node.js";
/** Records and layouts use the same checked transport path as target directive overrides. */
export const registerStructBinaryDirectives = (registry, { session }) => {
    registry.registerTyped(["struct", "endstruct", "datastruct", "datastructs", "enddatastructs"], ({ text, words, declaration }) => {
        const node = checkedDeclaration(declaration ?? parseDeclarationNode(text, words));
        if (!structDeclarationGuard(node)) {
            throw new Error("Expected a struct declaration or record initializer.");
        }
        return node;
    }, structDeclarationGuard, (node) => {
        switch (node.kind) {
            case "struct":
                session.structEngine.executeStruct(node);
                break;
            case "endStruct":
                session.structEngine.executeEndStruct(node);
                break;
            case "dataStruct":
                session.structEngine.data.executeRecord(node);
                break;
            case "dataStructs":
                session.structEngine.data.executeBegin(node);
                break;
            case "endDataStructs":
                session.structEngine.data.executeEnd(node.argumentCount);
                break;
        }
    });
};
//# sourceMappingURL=struct-binary.js.map