export class ParseError extends Error {
    argument: string
    known: string[]

    constructor(argument: string, known: string[]) {
        super(`Argument "${argument}" is unrecognized or misplaced.`)
        this.argument = argument
        this.known = known
    }
}

export type Flag = { alias?: string; arity?: number }

export type ArgvexSchema = Record<string, Flag>

type InferArgvex<TSchema extends ArgvexSchema | undefined> =
    TSchema extends Record<infer K extends string, Flag>
        ? string extends K
            ? { _: string[]; [flag: string]: string[] }
            : { _: string[] } & { [P in K]: string[] }
        : { _: string[]; [flag: string]: string[] }

export type ArgvexOptions<
    TSchema extends ArgvexSchema | undefined = ArgvexSchema | undefined
> = {
    command?: string
    argv?: string[]
    schema?: TSchema
    strict?: boolean
    override?: boolean
}

type Definition = {
    name: string
    alias?: string
    arity: number
}

const longflag = (
    name: string,
    value?: string,
    definition?: Definition
): { definition: Definition; values: string[] } => {
    const values: string[] = []
    let arity = definition?.arity ?? Infinity
    if (value != null) {
        values.push(value)
        arity = 1
    }
    return { definition: { name, ...definition, arity }, values }
}

const shortflag = (
    alias: string,
    aliases: string,
    definition?: Definition
): { definition: Definition; values: string[] } => {
    const values: string[] = []
    let arity = definition?.arity ?? Infinity
    if (aliases.indexOf(alias) !== aliases.length - 1) {
        arity = 0
    }
    return { definition: { name: alias, ...definition, arity }, values }
}

const inlineflag = (
    index: number,
    aliases: string,
    definition?: Definition
) => {
    if (definition == null) {
        return null
    }
    if (definition.arity === 0) {
        return null
    }
    if (aliases[index + 1] == null) {
        return null
    }
    return { definition, values: [aliases.substring(index + 1)] }
}

const argvex = <TSchema extends ArgvexSchema | undefined = undefined>(
    options: ArgvexOptions<TSchema>
): InferArgvex<TSchema> => {
    const {
        command,
        argv = command?.split(" ").filter((arg) => !!arg) ??
            process.argv.slice(2),
        schema = {},
        strict = false,
        override = false
    } = options
    const known = Object.keys(schema)
    const definitions = new Map<string, Definition>()
    for (const [name, def] of Object.entries(schema)) {
        const definition = {
            name,
            alias: def.alias,
            arity: def.arity ?? Infinity
        }
        definitions.set(name, definition)
        if (def.alias != null) {
            definitions.set(def.alias, definition)
        }
    }
    let current: { definition: Definition; values: string[] } | null = null
    const _: string[] = []
    const flags: Record<string, string[]> = {}
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === "--") {
            _.push(...argv.slice(i + 1))
            break
        }
        if (arg.startsWith("--")) {
            const eq = arg.indexOf("=", 2)
            const name = eq === -1 ? arg.substring(2) : arg.substring(2, eq)
            const value = eq === -1 ? undefined : arg.substring(eq + 1)
            if (name.length === 0) {
                throw new ParseError(arg, known)
            }
            if (strict && !definitions.has(name)) {
                throw new ParseError(arg, known)
            }
            const { definition, values } = longflag(
                name,
                value,
                definitions.get(name)
            )
            definitions.set(name, definition)
            if (!override && flags[name] != null) {
                values.unshift(...flags[name])
            }
            current = { definition, values }
            flags[name] = values
            continue
        }
        if (arg.startsWith("-")) {
            const aliases = arg.substring(1)
            if (aliases.length === 0) {
                throw new ParseError(arg, known)
            }
            for (let j = 0; j < aliases.length; j++) {
                const alias = aliases[j]
                if (strict && !definitions.has(alias)) {
                    throw new ParseError(`-${alias}`, known)
                }
                const inliner = inlineflag(j, aliases, definitions.get(alias))
                if (inliner != null) {
                    const { definition, values } = inliner
                    definitions.set(alias, definition)
                    if (!override && flags[definition.name] != null) {
                        values.unshift(...flags[definition.name])
                    }
                    current = { definition, values }
                    flags[definition.name] = values
                    break
                }
                const { definition, values } = shortflag(
                    alias,
                    aliases,
                    definitions.get(alias)
                )
                definitions.set(alias, definition)
                if (!override && flags[definition.name] != null) {
                    values.unshift(...flags[definition.name])
                }
                current = { definition, values }
                flags[definition.name] = values
            }
            continue
        }
        if (
            current == null ||
            current.values.length >= current.definition.arity
        ) {
            _.push(arg)
            continue
        }
        current?.values.push(arg)
    }
    return { _, ...flags } as InferArgvex<TSchema>
}

export default argvex
