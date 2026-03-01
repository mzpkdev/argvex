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

    it("should stop parsing flags after -- delimiter between flags", () => {
        const schema = { include: { arity: 1 }, exclude: { arity: 1 } }
        const argv = "--include src -- --exclude foo".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: ["--exclude", "foo"],
            include: ["src"]
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

    it("should parse short flag with = as value separator", () => {
        const argv = "brewer -s=xl".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: ["brewer"],
            s: ["xl"]
        })
    })

    it("should parse grouped short flags with = value on last flag", () => {
        const argv = "brewer -ab=xl".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: ["brewer"],
            a: [],
            b: ["xl"]
        })
    })

    it("should parse short flag with = and empty value", () => {
        const argv = "brewer -s=".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: ["brewer"],
            s: [""]
        })
    })

    it("should throw INVALID_FORMAT when short flag = has no name", () => {
        const argv = "brewer -=xl".split(" ")
        expect(() => argvex({ argv })).toThrowError(ParseError)
        expect(() => argvex({ argv })).toThrowError(
            `Argument "-=xl" is malformed.`
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

    it("should treat negative number as flag without schema", () => {
        const argv = "--offset -5".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: [],
            offset: [],
            5: []
        })
    })

    it("should treat flag-like arg as flag without schema", () => {
        const argv = "--name --value".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: [],
            name: [],
            value: []
        })
    })

    it("should consume interleaved positional as flag value in schema-less mode", () => {
        const argv = "file1.txt --verbose file2.txt".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: ["file1.txt"],
            verbose: ["file2.txt"]
        })
    })

    it("should treat second -- as literal positional", () => {
        const argv = "-- foo -- bar".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: ["foo", "--", "bar"]
        })
    })

    it("should handle single -- with nothing after", () => {
        const argv = ["--"]
        expect(argvex({ argv })).toStrictEqual({
            _: []
        })
    })

    it("should accumulate repeated flags without schema", () => {
        const argv = "--flag val1 --flag val2".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: [],
            flag: ["val1", "val2"]
        })
    })

    it("should parse hyphenated flag names", () => {
        const argv = "--dry-run --output-dir ./dist".split(" ")
        expect(argvex({ argv })).toStrictEqual({
            _: [],
            "dry-run": [],
            "output-dir": ["./dist"]
        })
    })

    it("should parse --no-verbose as a hyphenated flag name, not negation", () => {
        const argv = ["--no-verbose"]
        expect(argvex({ argv })).toStrictEqual({
            _: [],
            "no-verbose": []
        })
    })

    it("should reject --_ as a reserved flag name", () => {
        const argv = "--_ value pos1".split(" ")
        expect(() => argvex({ argv })).toThrowError(ParseError)
        expect(() => argvex({ argv })).toThrowError(
            `Argument "--_" is malformed.`
        )
    })

    it("should parse single-char long flag as a regular flag", () => {
        const argv = ["--v"]
        expect(argvex({ argv })).toStrictEqual({
            _: [],
            v: []
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

    it("should parse short flag = syntax with schema alias", () => {
        const argv = "-ds=medium".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            decaf: [],
            size: ["medium"]
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

    it("should honor = assignment even when arity is 0", () => {
        const schema = { verbose: { arity: 0 } }
        const argv = "--verbose=true".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            verbose: ["true"]
        })
    })

    it("should resolve alias when used as long flag prefix", () => {
        const schema = {
            decaf: { alias: "d", arity: 0 },
            size: { alias: "s", arity: 1 }
        }
        const argv = "--d --s medium".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            decaf: [],
            size: ["medium"]
        })
    })

    it("should replace entire array when override is enabled with arity > 1", () => {
        const schema = { milk: { arity: 2 } }
        const argv = "--milk oat almond --milk soy rice".split(" ")
        expect(argvex({ argv, schema, override: true })).toStrictEqual({
            _: [],
            milk: ["soy", "rice"]
        })
    })

    it("should consume remaining group chars as inline value when middle flag has arity > 0", () => {
        const schema = {
            a: { alias: "a", arity: 0 },
            b: { alias: "b", arity: 1 },
            c: { alias: "c", arity: 0 }
        }
        const argv = ["-abc"]
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            a: [],
            b: ["c"]
        })
    })

    it("should not include unused schema flags in result", () => {
        const schema = { size: { arity: 1 }, verbose: { arity: 0 } }
        const argv = "--size xl".split(" ")
        const result = argvex({ argv, schema })
        expect(result).toStrictEqual({
            _: [],
            size: ["xl"]
        })
        expect("verbose" in result).toBe(false)
    })

    it("should return only positionals when argv is empty with schema", () => {
        const schema = { verbose: { arity: 0 } }
        expect(argvex({ argv: [], schema })).toStrictEqual({
            _: []
        })
    })

    it("should not throw in strict mode when only positionals are given", () => {
        const schema = { verbose: { arity: 0 } }
        const argv = "file.txt output.txt".split(" ")
        expect(() => argvex({ argv, schema, strict: true })).not.toThrowError()
        expect(argvex({ argv, schema, strict: true })).toStrictEqual({
            _: ["file.txt", "output.txt"]
        })
    })

    it("should return empty values when flag with arity > 0 is last arg", () => {
        const schema = { size: { arity: 1 } }
        const argv = ["--size"]
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            size: []
        })
    })

    it("should let last schema entry win when aliases collide", () => {
        const schema = {
            verbose: { alias: "v", arity: 0 },
            version: { alias: "v", arity: 0 }
        }
        const argv = ["-v"]
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            version: []
        })
    })
})

describe("argvex arity consumption", () => {
    it("should consume negative number as value when flag has finite arity", () => {
        const schema = { offset: { arity: 1 } }
        const argv = "--offset -5".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            offset: ["-5"]
        })
    })

    it("should consume flag-like arg as value when flag has finite arity", () => {
        const schema = { name: { arity: 1 } }
        const argv = "--name --value".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            name: ["--value"]
        })
    })

    it("should consume negative number as value via short alias with arity", () => {
        const schema = { count: { alias: "n", arity: 1 } }
        const argv = "-n -5".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            count: ["-5"]
        })
    })

    it("should interleave positionals with arity-0 flags", () => {
        const schema = { verbose: { arity: 0 } }
        const argv = "file1.txt --verbose file2.txt".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: ["file1.txt", "file2.txt"],
            verbose: []
        })
    })

    it("should treat unknown flags as greedy alongside schema-constrained flags", () => {
        const schema = { size: { arity: 1 } }
        const argv = "--unknown val1 val2 --size xl".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            unknown: ["val1", "val2"],
            size: ["xl"]
        })
    })

    it("should treat unknown short flag as greedy alongside known flags", () => {
        const schema = { size: { arity: 1 } }
        const argv = "-u val --size xl".split(" ")
        expect(argvex({ argv, schema })).toStrictEqual({
            _: [],
            u: ["val"],
            size: ["xl"]
        })
    })
})

describe("argvex strict mode with arity", () => {
    it("should consume next arg as value when flag has finite arity in strict mode", () => {
        const schema = { output: { arity: 1 } }
        const argv = "--output file.txt".split(" ")
        expect(argvex({ argv, schema, strict: true })).toStrictEqual({
            _: [],
            output: ["file.txt"]
        })
    })

    it("should consume flag-like arg as value when flag has finite arity in strict mode", () => {
        const schema = { name: { arity: 1 } }
        const argv = "--name --value".split(" ")
        expect(argvex({ argv, schema, strict: true })).toStrictEqual({
            _: [],
            name: ["--value"]
        })
    })

    it("should consume negative number as value in strict mode", () => {
        const schema = { offset: { arity: 1 } }
        const argv = "--offset -5".split(" ")
        expect(argvex({ argv, schema, strict: true })).toStrictEqual({
            _: [],
            offset: ["-5"]
        })
    })

    it("should consume multiple args up to arity in strict mode", () => {
        const schema = { range: { arity: 2 } }
        const argv = "--range start end".split(" ")
        expect(argvex({ argv, schema, strict: true })).toStrictEqual({
            _: [],
            range: ["start", "end"]
        })
    })

    it("should send excess args to positionals after arity exhausted in strict mode", () => {
        const schema = { output: { arity: 1 } }
        const argv = "--output file.txt extra.txt".split(" ")
        expect(argvex({ argv, schema, strict: true })).toStrictEqual({
            _: ["extra.txt"],
            output: ["file.txt"]
        })
    })

    it("should stop consuming at next known flag even with remaining arity in strict mode", () => {
        const schema = { include: { arity: 3 }, exclude: { arity: 1 } }
        const argv = "--include src --exclude dist".split(" ")
        expect(argvex({ argv, schema, strict: true })).toStrictEqual({
            _: [],
            include: ["src"],
            exclude: ["dist"]
        })
    })

    it("should still throw UNKNOWN_FLAG for genuinely unknown flags in strict mode with arity", () => {
        const schema = { output: { arity: 1 } }
        const argv = "--output file.txt --unknown".split(" ")
        expect(() => argvex({ argv, schema, strict: true })).toThrowError(
            ParseError
        )
        expect(() => argvex({ argv, schema, strict: true })).toThrowError(
            `Flag "--unknown" is not recognized.`
        )
    })

    it("should give each invocation a fresh arity budget in strict mode", () => {
        const schema = { include: { arity: 1 } }
        const argv = "--include src --include lib --include test".split(" ")
        expect(argvex({ argv, schema, strict: true })).toStrictEqual({
            _: [],
            include: ["src", "lib", "test"]
        })
    })

    it("should interleave arity-0 flags with positionals in strict mode", () => {
        const schema = { verbose: { arity: 0 }, output: { arity: 1 } }
        const argv = "file.txt --verbose --output out.txt extra.txt".split(" ")
        expect(argvex({ argv, schema, strict: true })).toStrictEqual({
            _: ["file.txt", "extra.txt"],
            verbose: [],
            output: ["out.txt"]
        })
    })

    it("should consume short flag alias value in strict mode", () => {
        const schema = { output: { alias: "o", arity: 1 } }
        const argv = "-o file.txt".split(" ")
        expect(argvex({ argv, schema, strict: true })).toStrictEqual({
            _: [],
            output: ["file.txt"]
        })
    })

    it("should throw UNKNOWN_FLAG for unknown short flag in strict mode with arity schema", () => {
        const schema = { output: { alias: "o", arity: 1 } }
        const argv = "-o file.txt -x".split(" ")
        expect(() => argvex({ argv, schema, strict: true })).toThrowError(
            ParseError
        )
        expect(() => argvex({ argv, schema, strict: true })).toThrowError(
            `Flag "-x" is not recognized.`
        )
    })
})
