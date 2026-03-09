import { RESERVED_KEYWORDS, VALID_FLAG_NAME_RE } from "./constants"
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
        const [prefix, symbol] = extract(arg)
        if (RESERVED_KEYWORDS.includes(symbol)) {
            throw new ParseError(ErrorCode.RESERVED_KEYWORD, arg)
        }
        if (arg == "--") {
            tokens.push({ type: TokenType.DELIMITER, raw: arg })
            continue
        }
        if (prefix == "--") {
            if (!VALID_FLAG_NAME_RE.test(symbol)) {
                throw new ParseError(ErrorCode.INVALID_INPUT, arg)
            }
            tokens.push({ type: TokenType.LONG_FLAG, raw: arg })
            continue
        }
        if (prefix == "-") {
            if (symbol == "") {
                throw new ParseError(ErrorCode.INVALID_INPUT, arg)
            }
            tokens.push({ type: TokenType.SHORT_FLAG, raw: arg })
            continue
        }
        tokens.push({ type: TokenType.OPERAND, raw: arg })
    }
    return tokens
}

export const extract = (raw: string): [string, string, string | null] => {
    const prefix = raw.startsWith("--") ? "--" : raw.startsWith("-") ? "-" : ""
    const [symbol, value, ...values] = raw.substring(prefix.length).split("=")
    return [prefix, symbol, value != null ? [value, ...values].join("=") : null]
}
