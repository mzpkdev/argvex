import {
    RESERVED_KEYWORDS,
    VALID_FLAG_ALIAS_RE,
    VALID_FLAG_NAME_RE
} from "./constants"
import { ErrorCode, ParseError } from "./ParseError"

export type Schema = {
    [flag: string]: {
        alias?: string
        arity?: number
    }
}

export const validate = (schema: Schema): void | never => {
    // Cases to cover:
    //
    // Key rules:
    //   - reject reserved keys: `_` and `__`
    //   - reject empty string key
    //   - reject key containing `=`
    //   - reject key starting with `-`
    //
    // Alias rules:
    //   - reject multi-character alias (alias.length > 1)
    //   - reject empty string alias
    //   - reject reserved alias characters: `_`, `-`, `=`
    //   - reject duplicate alias across entries
    //   - reject alias that collides with another flag name
    //
    // Arity rules:
    //   - reject negative arity
    //   - reject NaN arity
    //   - reject fractional arity (not an integer)
    //   - reject Infinity arity

    const symbols = new Set<string>()
    for (const flag of Object.keys(schema)) {
        const alias = schema[flag].alias
        const arity = schema[flag].arity
        if (!VALID_FLAG_NAME_RE.test(flag)) {
            throw new ParseError(ErrorCode.INVALID_SCHEMA, flag)
        }
        if (alias != null && !VALID_FLAG_ALIAS_RE.test(alias)) {
            throw new ParseError(ErrorCode.INVALID_SCHEMA, flag)
        }
        if (
            RESERVED_KEYWORDS.includes(flag) ||
            (alias != null && RESERVED_KEYWORDS.includes(alias))
        ) {
            throw new ParseError(ErrorCode.INVALID_SCHEMA, flag)
        }
        if (symbols.has(flag)) {
            throw new ParseError(ErrorCode.INVALID_SCHEMA, flag)
        }
        if (alias && symbols.has(alias)) {
            throw new ParseError(ErrorCode.INVALID_SCHEMA, flag)
        }
        if (
            arity != null &&
            arity != Infinity &&
            (!Number.isInteger(arity) || arity < 0)
        ) {
            throw new ParseError(ErrorCode.INVALID_SCHEMA, flag)
        }
        if (alias) {
            symbols.add(flag)
            symbols.add(alias)
        }
    }
}

export const parse = (
    schema?: Schema
): Map<string, { name: string } & Schema[string]> => {
    if (schema == null) {
        const proxy = new Map()
        proxy.get = (symbol: string) => {
            return { name: symbol, arity: Infinity }
        }
        return proxy
    }
    const definitions = new Map<string, { name: string } & Schema[string]>()
    for (const symbol of Object.keys(schema)) {
        const flag = { name: symbol, ...schema[symbol] }
        definitions.set(symbol, flag)
        if (flag.alias) {
            definitions.set(flag.alias, flag)
        }
    }
    return definitions
}
