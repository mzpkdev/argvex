import { describe, expect, it } from "vitest"
import argvex, { ParseError, type ParseErrorCode } from "./index"

describe("argvex without schema", () => {
    it("should parse an empty command", () => {
        const command = ``
        expect(argvex({ command })).toStrictEqual({
            _: []
        })
    })

    it("should support end-of-options delimiter", () => {
        const command = `brewer make --milk oat -- latte --not-a-flag`
        expect(argvex({ command })).toStrictEqual({
            _: ["brewer", "make", "latte", "--not-a-flag"],
            milk: ["oat"]
        })
    })

    it("should parse operands and long flags", () => {
        const command = `brewer make latte --decaf --size xl --shots 2 --milk oat`
        expect(argvex({ command })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            decaf: [],
            size: ["xl"],
            shots: ["2"],
            milk: ["oat"]
        })
    })

    it('should parse operands and long flags using "=" for assigning a single value', () => {
        const command = `brewer make --decaf --size=xl --shots=2 --milk=oat latte`
        expect(argvex({ command })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            decaf: [],
            size: ["xl"],
            shots: ["2"],
            milk: ["oat"]
        })
    })

    it("should parse operands and short flags", () => {
        const command = `brewer make latte -d -s xl -h 2 -m oat`
        expect(argvex({ command })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            d: [],
            s: ["xl"],
            h: ["2"],
            m: ["oat"]
        })
    })

    it("should parse operands and flags grouping", () => {
        const command = `brewer make latte -qvd`
        expect(argvex({ command })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            q: [],
            v: [],
            d: []
        })
    })

    it("should parse operands and mix of long and short flags", () => {
        const command = `brewer make latte -ds xl --shots=2 --milk oat`
        expect(argvex({ command })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            d: [],
            s: ["xl"],
            shots: ["2"],
            milk: ["oat"]
        })
    })

    it("should parse flags only", () => {
        const command = `--decaf --size xl`
        expect(argvex({ command })).toStrictEqual({
            _: [],
            decaf: [],
            size: ["xl"]
        })
    })
})

describe("argvex with schema", () => {
    const schema = {
        version: { alias: "v", arity: 0 },
        decaf: { alias: "d", arity: 0 },
        size: { alias: "s", arity: 1 },
        shots: { alias: "h", arity: 1 },
        milk: { alias: "m", arity: 3 },
        name: { alias: "n", arity: 1 }
    }

    it("should assign that many values to flag as specified in schema", () => {
        const command = `brewer make --decaf no --size xs --shots 0 --milk oat almond cow latte`
        expect(argvex({ command, schema })).toStrictEqual({
            _: ["brewer", "make", "no", "latte"],
            decaf: [],
            size: ["xs"],
            shots: ["0"],
            milk: ["oat", "almond", "cow"]
        })
    })

    it("should parse short flags as aliases", () => {
        const command = `brewer make -d no -s xs -h 0 -m oat almond cow latte`
        expect(argvex({ command, schema })).toStrictEqual({
            _: ["brewer", "make", "no", "latte"],
            decaf: [],
            size: ["xs"],
            shots: ["0"],
            milk: ["oat", "almond", "cow"]
        })
    })

    it("should be able to parse a single inline argument", () => {
        const command = `brewer make -vdnMatthew latte`
        expect(argvex({ command, schema })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            version: [],
            decaf: [],
            name: ["Matthew"]
        })
    })

    it("should throw an error if a long flag is not present in the schema", () => {
        const command = `brewer make latte --decaf --size xs --shots 0 --milk almond --tea black`
        expect(() => argvex({ command, schema, strict: true })).toThrowError(
            ParseError
        )
        expect(() => argvex({ command, schema, strict: true })).toThrowError(
            `Argument "--tea" is unrecognized or misplaced.`
        )
        try {
            argvex({ command, schema, strict: true })
        } catch (error) {
            expect(error).toBeInstanceOf(ParseError)
            expect((error as ParseError).code).toBe(
                "UNKNOWN_FLAG" satisfies ParseErrorCode
            )
            expect((error as ParseError).argument).toBe("--tea")
            expect((error as ParseError).known).toStrictEqual([
                "version",
                "decaf",
                "size",
                "shots",
                "milk",
                "name"
            ])
        }
    })

    it("should throw an error if a short flag is not present in the schema", () => {
        const command = `brewer make latte -uds xs --shots 0 --milk almond`
        expect(() => argvex({ command, schema, strict: true })).toThrowError(
            ParseError
        )
        expect(() => argvex({ command, schema, strict: true })).toThrowError(
            `Argument "-u" is unrecognized or misplaced.`
        )
        try {
            argvex({ command, schema, strict: true })
        } catch (error) {
            expect(error).toBeInstanceOf(ParseError)
            expect((error as ParseError).code).toBe(
                "UNKNOWN_FLAG" satisfies ParseErrorCode
            )
            expect((error as ParseError).argument).toBe("-u")
            expect((error as ParseError).known).toStrictEqual([
                "version",
                "decaf",
                "size",
                "shots",
                "milk",
                "name"
            ])
        }
    })

    it("should not throw an error if all flags are present in the schema", () => {
        const command = `brewer make latte --decaf --size xs --shots 0 --milk almond`
        expect(() =>
            argvex({ command, schema, strict: true })
        ).not.toThrowError(ParseError)
    })

    it("should accumulate repeated flags by default", () => {
        const command = `brewer make latte --milk oat --milk=almond -mcow`
        expect(argvex({ command, schema })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            milk: ["oat", "almond", "cow"]
        })
    })

    it("should use last-write-wins when override is enabled", () => {
        const command = `brewer make latte --milk oat --milk=almond -mcow`
        expect(argvex({ command, schema, override: true })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            milk: ["cow"]
        })
    })
})

describe("argvex edge cases", () => {
    it("should throw INVALID_FORMAT when parsing long flag without a name", () => {
        const command = `brewer --=2xl`
        expect(() => argvex({ command })).toThrowError(ParseError)
        expect(() => argvex({ command })).toThrowError(
            `Argument "--=2xl" is unrecognized or misplaced.`
        )
        try {
            argvex({ command })
        } catch (error) {
            expect((error as ParseError).code).toBe(
                "INVALID_FORMAT" satisfies ParseErrorCode
            )
        }
    })

    it("should throw INVALID_FORMAT when parsing short flag without a name", () => {
        const command = `brewer -`
        expect(() => argvex({ command })).toThrowError(ParseError)
        expect(() => argvex({ command })).toThrowError(
            `Argument "-" is unrecognized or misplaced.`
        )
        try {
            argvex({ command })
        } catch (error) {
            expect((error as ParseError).code).toBe(
                "INVALID_FORMAT" satisfies ParseErrorCode
            )
        }
    })

    it("should have empty known array when no schema is provided", () => {
        try {
            argvex({ command: `brewer --=2xl` })
        } catch (error) {
            expect(error).toBeInstanceOf(ParseError)
            expect((error as ParseError).code).toBe(
                "INVALID_FORMAT" satisfies ParseErrorCode
            )
            expect((error as ParseError).known).toStrictEqual([])
        }
    })

    it("should have only names in known array, not aliases", () => {
        const schema = {
            decaf: { alias: "d", arity: 0 },
            size: { alias: "s", arity: 1 }
        }
        try {
            argvex({ command: `--unknown`, schema, strict: true })
        } catch (error) {
            expect(error).toBeInstanceOf(ParseError)
            expect((error as ParseError).code).toBe(
                "UNKNOWN_FLAG" satisfies ParseErrorCode
            )
            expect((error as ParseError).known).toStrictEqual(["decaf", "size"])
        }
    })

    it("should treat everything after -- as positional", () => {
        const command = `-- --flag -s value`
        expect(argvex({ command })).toStrictEqual({
            _: ["--flag", "-s", "value"]
        })
    })

    it("should split on first = only and preserve the rest", () => {
        const command = `--size=2xl=big`
        expect(argvex({ command })).toStrictEqual({
            _: [],
            size: ["2xl=big"]
        })
    })

    it("should treat empty value after = as an empty string", () => {
        const command = `--size=`
        expect(argvex({ command })).toStrictEqual({
            _: [],
            size: [""]
        })
    })

    it("should collect all args as positionals when no flags are present", () => {
        const command = `brewer make latte`
        expect(argvex({ command })).toStrictEqual({
            _: ["brewer", "make", "latte"]
        })
    })

    it("should use argv over command when both are provided", () => {
        expect(argvex({ command: `--flag`, argv: ["--other"] })).toStrictEqual({
            _: [],
            other: []
        })
    })
})

describe("argvex edge cases with schema", () => {
    const schema = {
        decaf: { alias: "d", arity: 0 },
        size: { alias: "s", arity: 1 }
    }

    it("should push next arg to positionals when flag has zero arity", () => {
        const command = `--decaf oat`
        expect(argvex({ command, schema })).toStrictEqual({
            _: ["oat"],
            decaf: []
        })
    })

    it("should parse inline value after zero-arity flags in a group", () => {
        const command = `-dsoat`
        expect(argvex({ command, schema })).toStrictEqual({
            _: [],
            decaf: [],
            size: ["oat"]
        })
    })

    it("should accumulate values across long, =, short, and inline syntaxes", () => {
        const command = `--size xl --size=md -sxs`
        expect(argvex({ command, schema })).toStrictEqual({
            _: [],
            size: ["xl", "md", "xs"]
        })
    })

    it("should keep only last value when override is enabled across mixed syntaxes", () => {
        const command = `--size xl --size=md -sxs`
        expect(argvex({ command, schema, override: true })).toStrictEqual({
            _: [],
            size: ["xs"]
        })
    })
})
