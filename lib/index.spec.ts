import { describe, expect, it } from "vitest"
import argvex, { ParseError, type ParseErrorCode } from "./index"

describe("argvex without schema", () => {
    it("should parse an empty argv", () => {
        expect(argvex({ argv: [] })).toStrictEqual({
            _: []
        })
    })

    it("should support end-of-options delimiter", () => {
        const argv = "brewer make --milk oat -- latte --not-a-flag".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: ["brewer", "make", "latte", "--not-a-flag"],
            milk: ["oat"]
        })
    })

    it("should parse operands and long flags", () => {
        const argv =
            "brewer make latte --decaf --size xl --shots 2 --milk oat".split(
                " "
            )
        expect(argvex({ argv })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            decaf: [],
            size: ["xl"],
            shots: ["2"],
            milk: ["oat"]
        })
    })

    it('should parse operands and long flags using "=" for assigning a single value', () => {
        const argv =
            "brewer make --decaf --size=xl --shots=2 --milk=oat latte".split(
                " "
            )
        expect(argvex({ argv })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            decaf: [],
            size: ["xl"],
            shots: ["2"],
            milk: ["oat"]
        })
    })

    it("should parse operands and short flags", () => {
        const argv = "brewer make latte -d -s xl -h 2 -m oat".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            d: [],
            s: ["xl"],
            h: ["2"],
            m: ["oat"]
        })
    })

    it("should parse operands and flags grouping", () => {
        const argv = "brewer make latte -qvd".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            q: [],
            v: [],
            d: []
        })
    })

    it("should parse operands and mix of long and short flags", () => {
        const argv = "brewer make latte -ds xl --shots=2 --milk oat".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            d: [],
            s: ["xl"],
            shots: ["2"],
            milk: ["oat"]
        })
    })

    it("should parse flags only", () => {
        const argv = "--decaf --size xl".split(" ")
        expect(argvex({ argv })).toStrictEqual({
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
        const argv =
            "brewer make --decaf no --size xs --shots 0 --milk oat almond cow latte".split(
                " "
            )
        expect(argvex({ argv, schema })).toStrictEqual({
            _: ["brewer", "make", "no", "latte"],
            decaf: [],
            size: ["xs"],
            shots: ["0"],
            milk: ["oat", "almond", "cow"]
        })
    })

    it("should parse short flags as aliases", () => {
        const argv =
            "brewer make -d no -s xs -h 0 -m oat almond cow latte".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: ["brewer", "make", "no", "latte"],
            decaf: [],
            size: ["xs"],
            shots: ["0"],
            milk: ["oat", "almond", "cow"]
        })
    })

    it("should be able to parse a single inline argument", () => {
        const argv = "brewer make -vdnMatthew latte".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            version: [],
            decaf: [],
            name: ["Matthew"]
        })
    })

    it("should throw an error if a long flag is not present in the schema", () => {
        const argv =
            "brewer make latte --decaf --size xs --shots 0 --milk almond --tea black".split(
                " "
            )
        expect(() => argvex({ argv, schema, strict: true })).toThrowError(
            ParseError
        )
        expect(() => argvex({ argv, schema, strict: true })).toThrowError(
            `Flag "--tea" is not recognized.`
        )
        try {
            argvex({ argv, schema, strict: true })
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
        const argv = "brewer make latte -uds xs --shots 0 --milk almond".split(
            " "
        )
        expect(() => argvex({ argv, schema, strict: true })).toThrowError(
            ParseError
        )
        expect(() => argvex({ argv, schema, strict: true })).toThrowError(
            `Flag "-u" is not recognized.`
        )
        try {
            argvex({ argv, schema, strict: true })
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
        const argv =
            "brewer make latte --decaf --size xs --shots 0 --milk almond".split(
                " "
            )
        expect(() => argvex({ argv, schema, strict: true })).not.toThrowError(
            ParseError
        )
    })

    it("should accumulate repeated flags by default", () => {
        const argv = "brewer make latte --milk oat --milk=almond -mcow".split(
            " "
        )
        expect(argvex({ argv, schema })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            milk: ["oat", "almond", "cow"]
        })
    })

    it("should use last-write-wins when override is enabled", () => {
        const argv = "brewer make latte --milk oat --milk=almond -mcow".split(
            " "
        )
        expect(argvex({ argv, schema, override: true })).toStrictEqual({
            _: ["brewer", "make", "latte"],
            milk: ["cow"]
        })
    })
})

describe("argvex edge cases", () => {
    it("should throw INVALID_FORMAT when parsing long flag without a name", () => {
        const argv = "brewer --=2xl".split(" ")
        expect(() => argvex({ argv })).toThrowError(ParseError)
        expect(() => argvex({ argv })).toThrowError(
            `Argument "--=2xl" is malformed.`
        )
        try {
            argvex({ argv })
        } catch (error) {
            expect((error as ParseError).code).toBe(
                "INVALID_FORMAT" satisfies ParseErrorCode
            )
        }
    })

    it("should throw INVALID_FORMAT when parsing short flag without a name", () => {
        const argv = "brewer -".split(" ")
        expect(() => argvex({ argv })).toThrowError(ParseError)
        expect(() => argvex({ argv })).toThrowError(
            `Argument "-" is malformed.`
        )
        try {
            argvex({ argv })
        } catch (error) {
            expect((error as ParseError).code).toBe(
                "INVALID_FORMAT" satisfies ParseErrorCode
            )
        }
    })

    it("should have empty known array when no schema is provided", () => {
        try {
            argvex({ argv: "brewer --=2xl".split(" ") })
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
            argvex({ argv: "--unknown".split(" "), schema, strict: true })
        } catch (error) {
            expect(error).toBeInstanceOf(ParseError)
            expect((error as ParseError).code).toBe(
                "UNKNOWN_FLAG" satisfies ParseErrorCode
            )
            expect((error as ParseError).known).toStrictEqual(["decaf", "size"])
        }
    })

    it("should treat everything after -- as positional", () => {
        const argv = "-- --flag -s value".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: ["--flag", "-s", "value"]
        })
    })

    it("should split on first = only and preserve the rest", () => {
        const argv = "--size=2xl=big".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: [],
            size: ["2xl=big"]
        })
    })

    it("should treat empty value after = as an empty string", () => {
        const argv = "--size=".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: [],
            size: [""]
        })
    })

    it("should collect all args as positionals when no flags are present", () => {
        const argv = "brewer make latte".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: ["brewer", "make", "latte"]
        })
    })
})

describe("argvex edge cases with schema", () => {
    const schema = {
        decaf: { alias: "d", arity: 0 },
        size: { alias: "s", arity: 1 }
    }

    it("should push next arg to positionals when flag has zero arity", () => {
        const argv = "--decaf oat".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: ["oat"],
            decaf: []
        })
    })

    it("should parse inline value after zero-arity flags in a group", () => {
        const argv = "-dsoat".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            decaf: [],
            size: ["oat"]
        })
    })

    it("should accumulate values across long, =, short, and inline syntaxes", () => {
        const argv = "--size xl --size=md -sxs".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            size: ["xl", "md", "xs"]
        })
    })

    it("should keep only last value when override is enabled across mixed syntaxes", () => {
        const argv = "--size xl --size=md -sxs".split(" ")
        expect(argvex({ argv, schema, override: true })).toStrictEqual({
            _: [],
            size: ["xs"]
        })
    })

    it("should not corrupt arity when = syntax is followed by space syntax", () => {
        const schema = { milk: { alias: "m", arity: 3 } }
        const argv = "--milk=oat --milk steamed whole".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            milk: ["oat", "steamed", "whole"]
        })
    })

    it("should not consume trailing positionals after = syntax", () => {
        const schema = { milk: { alias: "m", arity: 3 } }
        const argv = "--milk=oat latte".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: ["latte"],
            milk: ["oat"]
        })
    })

    it("should preserve arity across repeated = syntax", () => {
        const schema = { milk: { alias: "m", arity: 3 } }
        const argv = "--milk=oat --milk=almond --milk=cow".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            milk: ["oat", "almond", "cow"]
        })
    })

    it("should give each invocation a fresh arity budget (arity 1, repeated)", () => {
        const schema = { include: { arity: 1 } }
        const argv = "--include src --include lib --include test".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            include: ["src", "lib", "test"]
        })
    })

    it("should give each invocation a fresh arity budget (arity 3, repeated)", () => {
        const schema = { include: { arity: 3 } }
        const argv = "--include src lib test --include a b c".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            include: ["src", "lib", "test", "a", "b", "c"]
        })
    })

    it("should send excess args to positionals after arity is exhausted", () => {
        const schema = { milk: { alias: "m", arity: 1 } }
        const argv = "--milk steamed whole oat".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: ["whole", "oat"],
            milk: ["steamed"]
        })
    })

    it("should stop consuming at next flag even with remaining arity budget", () => {
        const schema = { include: { arity: 2 } }
        const argv = "--include src --include lib --include test".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            include: ["src", "lib", "test"]
        })
    })

    it("should stop consuming at a different flag", () => {
        const schema = { include: { arity: 3 }, exclude: { arity: 3 } }
        const argv = "--include src lib --exclude foo".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            include: ["src", "lib"],
            exclude: ["foo"]
        })
    })

    it("should replace values when override is enabled with repeated flags", () => {
        const schema = { include: { arity: 1 } }
        const argv = "--include src --include lib --include test".split(" ")
        expect(argvex({ argv, schema, override: true })).toStrictEqual({
            _: [],
            include: ["test"]
        })
    })
})
