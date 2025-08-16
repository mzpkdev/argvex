export class ArgvexError extends Error {
    constructor(argument: string) {
        super(`Argument "${argument}" is unrecognized or misplaced.`)
    }
}

export type ArgvexSchema = (
    { name: string, alias?: string, arity?: number }
)[]

export type ArgvexOptions = {
    command?: string
    argv?: string[]
    schema?: ArgvexSchema
    strict?: boolean
    additive?: boolean
}

export type argvex = {
    _: string[]
    [flag: string]: string[]
}

type Definition = {
    name: string
    alias?: string
    arity: number
}

const longflag = (name: string, value?: string, definition?: Definition): { definition: Definition, values: string[] } => {
    const values: string[] = []
    let arity = definition?.arity ?? Infinity
    if (value != null) {
        values.push(value)
        arity = 1
    }
    return { definition: { name, ...definition, arity }, values }
}

const shortflag = (alias: string, aliases: string, definition?: Definition): { definition: Definition, values: string[] } => {
    const values: string[] = []
    let arity = definition?.arity ?? Infinity
    if (aliases.indexOf(alias) != aliases.length - 1) {
        arity = 0
    }
    return { definition: { name: alias, ...definition, arity }, values }
}

const inlineflag = (index: number, aliases: string, definition?: Definition) => {
    if (definition == null) {
        return null
    }
    if (definition.arity == 0) {
        return null
    }
    if (aliases[index + 1] == null) {
        return null
    }
    return { definition, values: [ aliases.substring(index + 1) ] }
}

const argvex = (options: ArgvexOptions): argvex => {
    const {
        command,
        argv = command?.split(" ").filter(arg => !!arg) ?? process.argv.slice(2),
        schema = [],
        strict = false,
        additive = false
    } = options
    const definitions = new Map<string, Definition>()
    for (const { name, alias, arity = Infinity } of schema) {
        const definition = { name, alias, arity }
        definitions.set(name, definition)
        if (alias != null) {
            definitions.set(alias, definition)
        }
    }
    let current: { definition: Definition, values: string[] } | null = null
    const _: string[] = []
    const flags: Record<string, string[]> = {}
    for (let i = 0; i < argv.length; i++){
        const arg = argv[i]
        if (arg == "--") {
            _.push(...argv.slice(i + 1))
            break
        }
        if (arg.startsWith('--')) {
            const [ name, value ] = arg.substring(2).split("=")
            if (name.length == 0) {
                throw new ArgvexError(arg)
            }
            if (strict && !definitions.has(name)) {
                throw new ArgvexError(arg)
            }
            const { definition, values } = longflag(name, value, definitions.get(name))
            definitions.set(name, definition)
            if (additive && flags[name] != null) {
                values.unshift(...flags[name])
            }
            current = { definition, values }
            flags[name] = values
            continue
        }
        if (arg.startsWith('-')) {
            const aliases = arg.substring(1)
            if (aliases.length == 0) {
                throw new ArgvexError(arg)
            }
            for (let j = 0; j < aliases.length; j++) {
                const alias = aliases[j]
                if (strict && !definitions.has(alias)) {
                    throw new ArgvexError(`-${alias}`)
                }
                const inliner = inlineflag(j, aliases, definitions.get(alias))
                if (inliner != null) {
                    const { definition, values } = inliner
                    definitions.set(alias, definition)
                    if (additive && flags[definition.name] != null) {
                        values.unshift(...flags[definition.name])
                    }
                    current = { definition, values }
                    flags[definition.name] = values
                    break
                }
                const { definition, values } = shortflag(alias, aliases, definitions.get(alias))
                definitions.set(alias, definition)
                if (additive && flags[definition.name] != null) {
                    values.unshift(...flags[definition.name])
                }
                current = { definition, values }
                flags[definition.name] = values
            }
            continue
        }
        if (current == null || current.values.length >= current.definition.arity) {
            _.push(arg)
            continue
        }
        current?.values.push(arg)
    }
    return { _, ...flags }
}


export default argvex
