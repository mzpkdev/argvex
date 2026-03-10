export { ErrorCode, ParseError } from "./ParseError"
export type { Schema } from "./schema"
import { parse, type Schema, validate } from "./schema"
import { extract, TokenType, tokenize } from "./token"

export type Options = {
    argv?: string[]
    schema?: Schema
}

export type ArgvEx = {
    _: string[]
    __: string[]
    [flag: string]: string[]
}

export default function argvex({
    argv = process.argv.slice(2),
    schema
}: Options = {}): ArgvEx | never {
    const schemaless = schema == null
    if (!schemaless) {
        validate(schema)
    }
    const definitions = parse(schema)
    let current: string[] | null = null
    let remaining = 0
    const argvex = Object.create(null) as ArgvEx
    argvex._ = []
    argvex.__ = []
    const tokens = tokenize(argv)
    loop: for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]
        if (remaining == 0) {
            current = null
        }
        switch (token.type) {
            case TokenType.OPERAND:
                if (current == null) {
                    argvex._.push(token.raw)
                    break
                }
                current.push(token.raw)
                remaining--
                break
            case TokenType.LONG_FLAG: {
                const [, symbol, value] = extract(token.raw)
                const flag = definitions.get(symbol)
                if (flag == null) {
                    argvex.__.push(token.raw)
                    current = null
                    remaining = 0
                    break
                }
                current = argvex[flag.name] ?? []
                remaining = flag.arity ?? Infinity
                if (value != null) {
                    current.push(value)
                    remaining = 0
                }
                argvex[flag.name] = current
                break
            }
            case TokenType.SHORT_FLAG: {
                const [, group, value] = extract(token.raw)
                for (let j = 0; j < group.length; j++) {
                    const symbol = group[j]
                    const flag = definitions.get(symbol)
                    if (flag == null) {
                        const assignment =
                            j == group.length - 1 && value != null
                                ? `=${value}`
                                : ""
                        argvex.__.push(`-${symbol}${assignment}`)
                        continue
                    }
                    current = argvex[flag.name] ?? []
                    remaining = flag.arity ?? Infinity
                    if (value != null && j == group.length - 1) {
                        current.push(value)
                        argvex[flag.name] = current
                        break
                    }
                    if (value == null && !schemaless && (flag.arity ?? 0) > 0) {
                        const value = group.substring(j + 1)
                        if (value) {
                            current.push(value)
                            remaining = 0
                        }
                        argvex[flag.name] = current
                        break
                    }
                    argvex[flag.name] = current
                }
                break
            }
            case TokenType.DELIMITER:
                argvex._.push(...tokens.slice(i + 1).map((token) => token.raw))
                break loop
        }
    }
    return { ...argvex }
}
