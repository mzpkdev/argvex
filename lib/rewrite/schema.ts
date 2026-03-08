export type Schema = {
    [flag: string]: {
        alias?: string
        arity?: number
    }
}

export const validate = (schema: Schema): void | never => {
    console.log(schema)
}

export const parse = (schema?: Schema): Map<string, { name: string } & Schema[string]> => {
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
