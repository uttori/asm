/** Native arithmetic binding powers. Equal precedence, including exponentiation, associates left. */
export const binaryPrecedence = {
    "||": 0,
    "&&": 1,
    "==": 2,
    "=": 2,
    "!=": 2,
    "<": 2,
    ">": 2,
    "<=": 2,
    ">=": 2,
    "|": 3,
    "^": 3,
    "&": 3,
    "<<": 3,
    ">>": 3,
    "+": 4,
    "-": 4,
    "*": 5,
    "/": 5,
    "%": 5,
    "**": 6,
};
//# sourceMappingURL=expression-operators.js.map