export type ParseErrorCode =
    | "UNKNOWN_FLAG"
    | "INVALID_FORMAT"
    | "INVALID_SCHEMA"

export class ParseError extends Error {
    code: ParseErrorCode
    argument: string
    known: string[]

    constructor(
        code: ParseErrorCode,
        argument: string,
        known: string[],
        reason?: string
    ) {
        const suffix = reason ? `: ${reason}` : ""
        const knownList =
            known.length > 0
                ? ` Known flags: ${known.map((k) => `--${k}`).join(", ")}.`
                : ""
        const messages: Record<ParseErrorCode, string> = {
            UNKNOWN_FLAG: `Flag "${argument}" is not recognized.${knownList}`,
            INVALID_FORMAT: `Argument "${argument}" is malformed${suffix}.`,
            INVALID_SCHEMA: `Schema definition for "${argument}" is invalid${suffix}.`
        }
        super(messages[code])
        this.code = code
        this.argument = argument
        this.known = known
    }
}

export type Flag = { alias?: string; arity?: number }

export type ArgvexSchema = Record<string, Flag>

export type InferArgvex<TSchema extends ArgvexSchema | undefined> =
    TSchema extends Record<infer K extends string, Flag>
        ? string extends K
            ? { _: string[] } & { [flag: string]: string[] | undefined }
            : { _: string[] } & Partial<{ [P in K]: string[] }>
        : { _: string[] } & { [flag: string]: string[] | undefined }

export type ArgvexOptions<
    TSchema extends ArgvexSchema | undefined = ArgvexSchema | undefined
> = {
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
): { definition: Definition; values: string[]; arity: number } => {
    const values: string[] = []
    const arity = definition?.arity ?? Infinity
    if (value != null) {
        values.push(value)
        return { definition: definition ?? { name, arity }, values, arity: 1 }
    }
    return { definition: definition ?? { name, arity }, values, arity }
}

const shortflag = (
    alias: string,
    index: number,
    groupLength: number,
    definition?: Definition
): { definition: Definition; values: string[]; arity: number } => {
    const values: string[] = []
    const defArity = definition?.arity ?? Infinity
    const arity = index !== groupLength - 1 ? 0 : defArity
    return {
        definition: definition ?? { name: alias, arity: defArity },
        values,
        arity
    }
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
    options: ArgvexOptions<TSchema> = {}
): InferArgvex<TSchema> => {
    const {
        argv = process.argv.slice(2),
        schema = {},
        strict = false,
        override = false
    } = options
    const known = Object.keys(schema)
    const definitions = new Map<string, Definition>()
    for (const [name, def] of Object.entries(schema)) {
        if (name === "_") {
            throw new ParseError(
                "INVALID_SCHEMA",
                name,
                known,
                'key cannot be "_"'
            )
        }
        if (def.alias != null && def.alias.length !== 1) {
            throw new ParseError(
                "INVALID_SCHEMA",
                name,
                known,
                "alias must be a single character"
            )
        }
        if (def.alias === "_") {
            throw new ParseError(
                "INVALID_SCHEMA",
                name,
                known,
                'alias cannot be "_"'
            )
        }
        if (def.alias === "-") {
            throw new ParseError(
                "INVALID_SCHEMA",
                name,
                known,
                'alias cannot be "-"'
            )
        }
        if (def.arity != null && def.arity < 0) {
            throw new ParseError(
                "INVALID_SCHEMA",
                name,
                known,
                "arity cannot be negative"
            )
        }
        if (def.arity != null && !Number.isInteger(def.arity)) {
            throw new ParseError(
                "INVALID_SCHEMA",
                name,
                known,
                "arity must be a non-negative integer"
            )
        }
        if (definitions.has(name)) {
            throw new ParseError(
                "INVALID_SCHEMA",
                name,
                known,
                "name collides with an existing flag or alias"
            )
        }
        if (def.alias != null && definitions.has(def.alias)) {
            throw new ParseError(
                "INVALID_SCHEMA",
                name,
                known,
                "alias collides with an existing flag or alias"
            )
        }
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
    type Current = { arity: number; consumed: number; target: string[] } | null
    let current = null as Current
    const _: string[] = []
    const flags: Record<string, string[]> = Object.create(null)
    const setFlag = (name: string, values: string[], arity: number) => {
        if (!override && Object.hasOwn(flags, name)) {
            flags[name].push(...values)
        } else {
            flags[name] = values
        }
        current = { arity, consumed: values.length, target: flags[name] }
    }
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === "--") {
            _.push(...argv.slice(i + 1))
            break
        }
        if (
            current != null &&
            current.consumed < current.arity &&
            current.arity !== Infinity
        ) {
            let isKnownFlag = false
            if (arg.startsWith("--") && arg.length > 2) {
                const eq = arg.indexOf("=", 2)
                const name = eq === -1 ? arg.substring(2) : arg.substring(2, eq)
                isKnownFlag = definitions.has(name)
            } else if (
                arg.startsWith("-") &&
                arg.length > 1 &&
                arg[1] !== "="
            ) {
                isKnownFlag = definitions.has(arg[1])
            }
            if (!isKnownFlag) {
                current.target.push(arg)
                current.consumed++
                continue
            }
        }
        if (arg.startsWith("--")) {
            const eq = arg.indexOf("=", 2)
            const name = eq === -1 ? arg.substring(2) : arg.substring(2, eq)
            const value = eq === -1 ? undefined : arg.substring(eq + 1)
            if (name.length === 0) {
                throw new ParseError(
                    "INVALID_FORMAT",
                    arg,
                    known,
                    "flag name is missing"
                )
            }
            if (name.startsWith("-")) {
                throw new ParseError(
                    "INVALID_FORMAT",
                    arg,
                    known,
                    "triple dash is not valid"
                )
            }
            if (name === "_") {
                throw new ParseError(
                    "INVALID_FORMAT",
                    arg,
                    known,
                    'flag name cannot be "_"'
                )
            }
            if (strict && !definitions.has(name)) {
                throw new ParseError("UNKNOWN_FLAG", arg, known)
            }
            const { definition, values, arity } = longflag(
                name,
                value,
                definitions.get(name)
            )
            definitions.set(name, definition)
            setFlag(definition.name, values, arity)
            continue
        }
        if (arg.startsWith("-")) {
            const aliases = arg.substring(1)
            if (aliases.length === 0) {
                throw new ParseError(
                    "INVALID_FORMAT",
                    arg,
                    known,
                    "flag name is missing"
                )
            }
            const eq = aliases.indexOf("=")
            if (eq !== -1) {
                if (eq === 0) {
                    throw new ParseError(
                        "INVALID_FORMAT",
                        arg,
                        known,
                        "flag name is missing"
                    )
                }
                const flagChars = aliases.substring(0, eq)
                const value = aliases.substring(eq + 1)
                for (let j = 0; j < flagChars.length - 1; j++) {
                    const alias = flagChars[j]
                    if (strict && !definitions.has(alias)) {
                        throw new ParseError("UNKNOWN_FLAG", `-${alias}`, known)
                    }
                    const { definition, values, arity } = shortflag(
                        alias,
                        j,
                        flagChars.length,
                        definitions.get(alias)
                    )
                    definitions.set(alias, definition)
                    setFlag(definition.name, values, arity)
                }
                const alias = flagChars[flagChars.length - 1]
                if (strict && !definitions.has(alias)) {
                    throw new ParseError("UNKNOWN_FLAG", `-${alias}`, known)
                }
                const definition = definitions.get(alias) ?? {
                    name: alias,
                    arity: Infinity
                }
                definitions.set(alias, definition)
                setFlag(definition.name, [value], definition.arity)
                continue
            }
            for (let j = 0; j < aliases.length; j++) {
                const alias = aliases[j]
                if (strict && !definitions.has(alias)) {
                    throw new ParseError("UNKNOWN_FLAG", `-${alias}`, known)
                }
                const inliner = inlineflag(j, aliases, definitions.get(alias))
                if (inliner != null) {
                    const { definition, values } = inliner
                    definitions.set(alias, definition)
                    setFlag(definition.name, values, definition.arity)
                    break
                }
                const { definition, values, arity } = shortflag(
                    alias,
                    j,
                    aliases.length,
                    definitions.get(alias)
                )
                definitions.set(alias, definition)
                setFlag(definition.name, values, arity)
            }
            continue
        }
        if (current == null || current.consumed >= current.arity) {
            _.push(arg)
            continue
        }
        current.target.push(arg)
        current.consumed++
    }
    return { ...flags, _ } as InferArgvex<TSchema>
}

export default argvex
