export const handleRelativeLabel = ({ session }, _words, raw) => {
    session.symbolScope.handleRelativeLabel(raw);
};
export const registerFlowControlDirectives = (registry, context) => {
    registry.register(["+", "-"], context, handleRelativeLabel);
};
//# sourceMappingURL=flow-control.js.map