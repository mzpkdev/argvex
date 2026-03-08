import { ErrorCode, ParseError } from "./ParseError"


export enum TokenType {
    OPERAND,
    LONG_FLAG,
    SHORT_FLAG,
    DELIMITER
}

export type Token = {
    type: TokenType
    raw: string
}

export const tokenize = (argv: string[]): Token[] => {
    const tokens: Token[] = []
    for (const arg of argv) {
        if (RESERVED_KEYWORDS.includes(arg)) {
            throw new ParseError(ErrorCode.RESERVED_KEYWORD, arg)
        }
        if (arg == "--") {
            tokens.push({ type: TokenType.DELIMITER, raw: arg })
            continue
        }
        if (arg.startsWith("--")) {
            tokens.push({ type: TokenType.LONG_FLAG, raw: arg })
            continue
        }
        if (arg.startsWith("-")) {
            tokens.push({ type: TokenType.SHORT_FLAG, raw: arg })
            continue
        }
        tokens.push({ type: TokenType.OPERAND, raw: arg })
    }
    return tokens
}

const RESERVED_KEYWORDS = [ "--_", "--__", "-_", "-__" ]
