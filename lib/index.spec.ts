import { describe, expect, it } from "vitest"
import argvex, { ParseError, type ParseErrorCode } from "./index"

describe("argvex", () => {
    context("without schema", () => {
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

        it('should parse long flags using "=" for assigning a single value', () => {
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

        it("should parse short flag grouping", () => {
            const argv = "brewer make latte -qvd".split(" ")
            expect(argvex({ argv })).toStrictEqual({
                _: ["brewer", "make", "latte"],
                q: [],
                v: [],
                d: []
            })
        })

        it("should parse a mix of long and short flags", () => {
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

        it("should collect all args as positionals when no flags are present", () => {
            const argv = "brewer make latte".split(" ")
            expect(argvex({ argv })).toStrictEqual({
                _: ["brewer", "make", "latte"]
            })
        })

        it("should treat negative number as flag", () => {
            const argv = "--offset -5".split(" ")
            expect(argvex({ argv })).toStrictEqual({
                _: [],
                offset: [],
                5: []
            })
        })

        it("should treat flag-like arg as flag", () => {
            const argv = "--name --value".split(" ")
            expect(argvex({ argv })).toStrictEqual({
                _: [],
                name: [],
                value: []
            })
        })

        it("should consume interleaved positional as flag value", () => {
            const argv = "file1.txt --verbose file2.txt".split(" ")
            expect(argvex({ argv })).toStrictEqual({
                _: ["file1.txt"],
                verbose: ["file2.txt"]
            })
        })

        it("should accumulate repeated flags", () => {
            const argv = "--flag val1 --flag val2".split(" ")
            expect(argvex({ argv })).toStrictEqual({
                _: [],
                flag: ["val1", "val2"]
            })
        })

        it("should treat empty string in argv as positional", () => {
            const argv = [""]
            expect(argvex({ argv })).toStrictEqual({
                _: [""]
            })
        })

        it("should default to process.argv.slice(2) when no argv option is provided", () => {
            const original = process.argv
            process.argv = ["node", "script.js", "--verbose", "hello"]
            try {
                const result = argvex()
                expect(result).toStrictEqual({
                    _: [],
                    verbose: ["hello"]
                })
            } finally {
                process.argv = original
            }
        })

        context("with override", () => {
            it("should use last-write-wins for single-value flags", () => {
                const argv = "--flag val1 --flag val2".split(" ")
                expect(argvex({ argv, override: true })).toStrictEqual({
                    _: [],
                    flag: ["val2"]
                })
            })

            it("should replace all consumed values on repeated flags", () => {
                const argv = "--flag a b c --flag x y".split(" ")
                expect(argvex({ argv, override: true })).toStrictEqual({
                    _: [],
                    flag: ["x", "y"]
                })
            })

            it("should replace accumulated values across multiple flags", () => {
                const argv =
                    "--items one two three --other stuff --items four five".split(" ")
                expect(argvex({ argv, override: true })).toStrictEqual({
                    _: [],
                    items: ["four", "five"],
                    other: ["stuff"]
                })
            })
        })
    })

    context("with schema", () => {
        const schema = {
            version: { alias: "v", arity: 0 },
            decaf: { alias: "d", arity: 0 },
            size: { alias: "s", arity: 1 },
            shots: { alias: "h", arity: 1 },
            milk: { alias: "m", arity: 3 },
            name: { alias: "n", arity: 1 }
        }

        it("should assign that many values to flag as specified by arity", () => {
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

        it("should parse a single inline argument", () => {
            const argv = "brewer make -vdnMatthew latte".split(" ")
            expect(argvex({ argv, schema })).toStrictEqual({
                _: ["brewer", "make", "latte"],
                version: [],
                decaf: [],
                name: ["Matthew"]
            })
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

        it("should stop parsing flags after -- delimiter", () => {
            const schema = { include: { arity: 1 }, exclude: { arity: 1 } }
            const argv = "--include src -- --exclude foo".split(" ")
            expect(argvex({ argv, schema })).toStrictEqual({
                _: ["--exclude", "foo"],
                include: ["src"]
            })
        })

        it("should push next arg to positionals when flag has zero arity", () => {
            const schema = { decaf: { alias: "d", arity: 0 }, size: { alias: "s", arity: 1 } }
            const argv = "--decaf oat".split(" ")
            expect(argvex({ argv, schema })).toStrictEqual({
                _: ["oat"],
                decaf: []
            })
        })

        it("should parse inline value after zero-arity flags in a group", () => {
            const schema = { decaf: { alias: "d", arity: 0 }, size: { alias: "s", arity: 1 } }
            const argv = "-dsoat".split(" ")
            expect(argvex({ argv, schema })).toStrictEqual({
                _: [],
                decaf: [],
                size: ["oat"]
            })
        })

        it("should parse short flag = syntax with schema alias", () => {
            const schema = { decaf: { alias: "d", arity: 0 }, size: { alias: "s", arity: 1 } }
            const argv = "-ds=medium".split(" ")
            expect(argvex({ argv, schema })).toStrictEqual({
                _: [],
                decaf: [],
                size: ["medium"]
            })
        })

        it("should accumulate values across long, =, short, and inline syntaxes", () => {
            const schema = { decaf: { alias: "d", arity: 0 }, size: { alias: "s", arity: 1 } }
            const argv = "--size xl --size=md -sxs".split(" ")
            expect(argvex({ argv, schema })).toStrictEqual({
                _: [],
                size: ["xl", "md", "xs"]
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

        it("should give each invocation a fresh arity budget (arity 1)", () => {
            const schema = { include: { arity: 1 } }
            const argv = "--include src --include lib --include test".split(" ")
            expect(argvex({ argv, schema })).toStrictEqual({
                _: [],
                include: ["src", "lib", "test"]
            })
        })

        it("should give each invocation a fresh arity budget (arity 3)", () => {
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

        it("should honor = assignment even when arity is 0", () => {
            const schema = { verbose: { arity: 0 } }
            const argv = "--verbose=true".split(" ")
            expect(argvex({ argv, schema })).toStrictEqual({
                _: [],
                verbose: ["true"]
            })
        })

        it("should honor = assignment on short flag even when arity is 0", () => {
            const schema = { verbose: { alias: "v", arity: 0 } }
            const argv = ["-v=true"]
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

        it("should force leading flags to arity 0 in group with = even when schema says otherwise", () => {
            const schema = { a: { arity: 1 }, b: { arity: 1 } }
            const argv = ["-ab=val"]
            expect(argvex({ argv, schema })).toStrictEqual({
                _: [],
                a: [],
                b: ["val"]
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

        it("should return only positionals when argv is empty", () => {
            const schema = { verbose: { arity: 0 } }
            expect(argvex({ argv: [], schema })).toStrictEqual({
                _: []
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

        it("should handle grouped flags where all chars have arity > 0", () => {
            const schema = { a: { arity: 1 }, b: { arity: 1 } }
            const argv = "-ab val".split(" ")
            expect(argvex({ argv, schema })).toStrictEqual({
                _: ["val"],
                a: ["b"]
            })
        })

        it("should handle duplicate chars in flag group with arity", () => {
            const schema = { v: { arity: 1 } }
            const argv = "-vvv nextval".split(" ")
            expect(argvex({ argv, schema })).toStrictEqual({
                _: ["nextval"],
                v: ["vv"]
            })
        })

        it("should let last duplicate char in group consume from stream", () => {
            const schema = { v: { arity: 0 } }
            const argv = "-vvv nextval".split(" ")
            expect(argvex({ argv, schema })).toStrictEqual({
                _: ["nextval"],
                v: []
            })
        })

        it("should produce order-independent results with partial schema and unknown flags", () => {
            const schema = { known: { arity: 2 } }

            expect(
                argvex({ argv: "--known a b --unknown".split(" "), schema })
            ).toStrictEqual({
                _: [],
                known: ["a", "b"],
                unknown: []
            })

            expect(
                argvex({ argv: "--unknown --known a b".split(" "), schema })
            ).toStrictEqual({
                _: [],
                unknown: [],
                known: ["a", "b"]
            })
        })

        it("should not let a previously-seen unknown flag interrupt finite-arity consumption", () => {
            const schema = { known: { arity: 2 } }
            const result = argvex({
                argv: "--unknown x --known a --unknown b".split(" "),
                schema
            })
            expect(result.known).toStrictEqual(["a", "--unknown"])
            expect(result._).toStrictEqual(["b"])
        })

        context("with strict mode", () => {
            it("should throw an error for unknown long flag", () => {
                const argv = "brewer make latte --decaf --tea black".split(" ")
                expect(() => argvex({ argv, schema, strict: true })).toThrowError(
                    ParseError
                )
                expect(() => argvex({ argv, schema, strict: true })).toThrowError(
                    `Flag "--tea" is not recognized. Known flags: --version, --decaf, --size, --shots, --milk, --name.`
                )
                try {
                    argvex({ argv, schema, strict: true })
                } catch (error) {
                    expect(error).toBeInstanceOf(ParseError)
                    expect((error as ParseError).code).toBe(
                        "UNKNOWN_FLAG" satisfies ParseErrorCode
                    )
                    expect((error as ParseError).argument).toBe("tea")
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

            it("should throw an error for unknown short flag", () => {
                const argv = "brewer make latte -uds xs --shots 0 --milk almond".split(
                    " "
                )
                expect(() => argvex({ argv, schema, strict: true })).toThrowError(
                    ParseError
                )
                expect(() => argvex({ argv, schema, strict: true })).toThrowError(
                    `Flag "-u" is not recognized. Known flags: --version, --decaf, --size, --shots, --milk, --name.`
                )
                try {
                    argvex({ argv, schema, strict: true })
                } catch (error) {
                    expect(error).toBeInstanceOf(ParseError)
                    expect((error as ParseError).code).toBe(
                        "UNKNOWN_FLAG" satisfies ParseErrorCode
                    )
                    expect((error as ParseError).argument).toBe("u")
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

            it("should not throw when all flags are present in the schema", () => {
                const argv =
                    "brewer make latte --decaf --size xs --shots 0 --milk almond".split(
                        " "
                    )
                expect(() => argvex({ argv, schema, strict: true })).not.toThrowError(
                    ParseError
                )
            })

            it("should not throw when only positionals are given", () => {
                const schema = { verbose: { arity: 0 } }
                const argv = "file.txt output.txt".split(" ")
                expect(() => argvex({ argv, schema, strict: true })).not.toThrowError()
                expect(argvex({ argv, schema, strict: true })).toStrictEqual({
                    _: ["file.txt", "output.txt"]
                })
            })

            it("should throw UNKNOWN_FLAG with empty schema", () => {
                const argv = ["--anything"]
                expect(() => argvex({ argv, schema: {}, strict: true })).toThrowError(
                    ParseError
                )
                expect(() => argvex({ argv, schema: {}, strict: true })).toThrowError(
                    `Flag "--anything" is not recognized.`
                )
            })

            context("with arity", () => {
                it("should consume next arg as value", () => {
                    const schema = { output: { arity: 1 } }
                    const argv = "--output file.txt".split(" ")
                    expect(argvex({ argv, schema, strict: true })).toStrictEqual({
                        _: [],
                        output: ["file.txt"]
                    })
                })

                it("should consume flag-like arg as value", () => {
                    const schema = { name: { arity: 1 } }
                    const argv = "--name --value".split(" ")
                    expect(argvex({ argv, schema, strict: true })).toStrictEqual({
                        _: [],
                        name: ["--value"]
                    })
                })

                it("should consume negative number as value", () => {
                    const schema = { offset: { arity: 1 } }
                    const argv = "--offset -5".split(" ")
                    expect(argvex({ argv, schema, strict: true })).toStrictEqual({
                        _: [],
                        offset: ["-5"]
                    })
                })

                it("should consume multiple args up to arity", () => {
                    const schema = { range: { arity: 2 } }
                    const argv = "--range start end".split(" ")
                    expect(argvex({ argv, schema, strict: true })).toStrictEqual({
                        _: [],
                        range: ["start", "end"]
                    })
                })

                it("should send excess args to positionals after arity exhausted", () => {
                    const schema = { output: { arity: 1 } }
                    const argv = "--output file.txt extra.txt".split(" ")
                    expect(argvex({ argv, schema, strict: true })).toStrictEqual({
                        _: ["extra.txt"],
                        output: ["file.txt"]
                    })
                })

                it("should stop consuming at next known flag even with remaining arity", () => {
                    const schema = { include: { arity: 3 }, exclude: { arity: 1 } }
                    const argv = "--include src --exclude dist".split(" ")
                    expect(argvex({ argv, schema, strict: true })).toStrictEqual({
                        _: [],
                        include: ["src"],
                        exclude: ["dist"]
                    })
                })

                it("should still throw UNKNOWN_FLAG for genuinely unknown flags", () => {
                    const schema = { output: { arity: 1 } }
                    const argv = "--output file.txt --unknown".split(" ")
                    expect(() => argvex({ argv, schema, strict: true })).toThrowError(
                        ParseError
                    )
                    expect(() => argvex({ argv, schema, strict: true })).toThrowError(
                        `Flag "--unknown" is not recognized. Known flags: --output.`
                    )
                })

                it("should give each invocation a fresh arity budget", () => {
                    const schema = { include: { arity: 1 } }
                    const argv = "--include src --include lib --include test".split(" ")
                    expect(argvex({ argv, schema, strict: true })).toStrictEqual({
                        _: [],
                        include: ["src", "lib", "test"]
                    })
                })

                it("should interleave arity-0 flags with positionals", () => {
                    const schema = { verbose: { arity: 0 }, output: { arity: 1 } }
                    const argv = "file.txt --verbose --output out.txt extra.txt".split(" ")
                    expect(argvex({ argv, schema, strict: true })).toStrictEqual({
                        _: ["file.txt", "extra.txt"],
                        verbose: [],
                        output: ["out.txt"]
                    })
                })

                it("should consume short flag alias value", () => {
                    const schema = { output: { alias: "o", arity: 1 } }
                    const argv = "-o file.txt".split(" ")
                    expect(argvex({ argv, schema, strict: true })).toStrictEqual({
                        _: [],
                        output: ["file.txt"]
                    })
                })

                it("should throw UNKNOWN_FLAG for unknown short flag", () => {
                    const schema = { output: { alias: "o", arity: 1 } }
                    const argv = "-o file.txt -x".split(" ")
                    expect(() => argvex({ argv, schema, strict: true })).toThrowError(
                        ParseError
                    )
                    expect(() => argvex({ argv, schema, strict: true })).toThrowError(
                        `Flag "-x" is not recognized. Known flags: --output.`
                    )
                })
            })
        })

        context("with override", () => {
            it("should use last-write-wins for repeated flags", () => {
                const argv = "brewer make latte --milk oat --milk=almond -mcow".split(
                    " "
                )
                expect(argvex({ argv, schema, override: true })).toStrictEqual({
                    _: ["brewer", "make", "latte"],
                    milk: ["cow"]
                })
            })

            it("should keep only last value across mixed syntaxes", () => {
                const schema = { decaf: { alias: "d", arity: 0 }, size: { alias: "s", arity: 1 } }
                const argv = "--size xl --size=md -sxs".split(" ")
                expect(argvex({ argv, schema: schema, override: true })).toStrictEqual({
                    _: [],
                    size: ["xs"]
                })
            })

            it("should replace values with repeated flags", () => {
                const schema = { include: { arity: 1 } }
                const argv = "--include src --include lib --include test".split(" ")
                expect(argvex({ argv, schema, override: true })).toStrictEqual({
                    _: [],
                    include: ["test"]
                })
            })

            it("should replace entire array when arity > 1", () => {
                const schema = { milk: { arity: 2 } }
                const argv = "--milk oat almond --milk soy rice".split(" ")
                expect(argvex({ argv, schema, override: true })).toStrictEqual({
                    _: [],
                    milk: ["soy", "rice"]
                })
            })
        })

        context("with permissive mode", () => {
            it("should push unknown long flag to positionals", () => {
                const result = argvex({
                    argv: ["--known", "--unknown"],
                    schema: { known: { arity: 0 } },
                    strict: true,
                    permissive: true
                })
                expect(result._).toStrictEqual(["--unknown"])
                expect(result.known).toStrictEqual([])
            })

            it("should push unknown long flag with = value to positionals verbatim", () => {
                const result = argvex({
                    argv: ["--unknown=foo"],
                    schema: {},
                    strict: true,
                    permissive: true
                })
                expect(result._).toStrictEqual(["--unknown=foo"])
            })

            it("should push unknown short flag to positionals", () => {
                const result = argvex({
                    argv: ["-x"],
                    schema: {},
                    strict: true,
                    permissive: true
                })
                expect(result._).toStrictEqual(["-x"])
            })

            it("should push unknown short flag with = value to positionals verbatim", () => {
                const result = argvex({
                    argv: ["-x=val"],
                    schema: {},
                    strict: true,
                    permissive: true
                })
                expect(result._).toStrictEqual(["-x=val"])
            })

            it("should parse known flags normally alongside unknown flags", () => {
                const result = argvex({
                    argv: "--name val --unknown --also-unknown=foo".split(" "),
                    schema: { name: { arity: 1 } },
                    strict: true,
                    permissive: true
                })
                expect(result.name).toStrictEqual(["val"])
                expect(result._).toStrictEqual(["--unknown", "--also-unknown=foo"])
            })

            it("should collect multiple unknown flags in positionals", () => {
                const result = argvex({
                    argv: ["--a", "--b", "--c"],
                    schema: {},
                    strict: true,
                    permissive: true
                })
                expect(result._).toStrictEqual(["--a", "--b", "--c"])
            })

            it("should mix positionals and unknown flags in _", () => {
                const result = argvex({
                    argv: ["pos1", "--unknown", "pos2"],
                    schema: {},
                    strict: true,
                    permissive: true
                })
                expect(result._).toStrictEqual(["pos1", "--unknown", "pos2"])
            })

            it("should handle grouped short flags with mixed known and unknown", () => {
                const result = argvex({
                    argv: ["-dxe"],
                    schema: { d: { arity: 0 }, e: { arity: 0 } },
                    strict: true,
                    permissive: true
                })
                expect(result.d).toStrictEqual([])
                expect(result.e).toStrictEqual([])
                expect(result._).toStrictEqual(["-x"])
            })

            it("should be a no-op without strict mode", () => {
                const result = argvex({
                    argv: ["--unknown"],
                    schema: {},
                    strict: false,
                    permissive: true
                })
                expect(result._).toStrictEqual([])
                expect(result.unknown).toStrictEqual([])
            })

            it("should work with stopEarly", () => {
                const result = argvex({
                    argv: "--unknown pos1 --known pos2".split(" "),
                    schema: { known: { arity: 0 } },
                    strict: true,
                    permissive: true,
                    stopEarly: true
                })
                expect(result._).toStrictEqual(["--unknown", "pos1", "--known", "pos2"])
            })

            it("should have tight types in strict + permissive mode", () => {
                const schema = { verbose: { arity: 0 }, size: { arity: 1 } } as const
                const result = argvex({
                    argv: "--verbose --unknown".split(" "),
                    schema,
                    strict: true,
                    permissive: true
                })
                const v: string[] | undefined = result.verbose
                const s: string[] | undefined = result.size
                expect(v).toStrictEqual([])
                expect(s).toBeUndefined()
                // @ts-expect-error -- unknown keys should still be a type error
                result.anything
            })
        })
    })

    context("with stopEarly", () => {
        it("should collect everything as positional when first arg is positional", () => {
            const argv = "cmd --flag value".split(" ")
            expect(argvex({ argv, stopEarly: true })).toStrictEqual({
                _: ["cmd", "--flag", "value"]
            })
        })

        it("should parse flags that appear before the first positional", () => {
            const schema = { verbose: { arity: 0 }, size: { arity: 1 } }
            const argv = "--verbose --size xl cmd --other".split(" ")
            expect(argvex({ argv, schema, stopEarly: true })).toStrictEqual({
                _: ["cmd", "--other"],
                verbose: [],
                size: ["xl"]
            })
        })

        it("should still respect -- delimiter", () => {
            const schema = { flag: { arity: 0 } }
            const argv = "--flag -- cmd --other".split(" ")
            expect(argvex({ argv, schema, stopEarly: true })).toStrictEqual({
                _: ["cmd", "--other"],
                flag: []
            })
        })

        it("should not trigger on args consumed by arity", () => {
            const schema = { milk: { arity: 3 } }
            const argv = "--milk oat almond cow cmd --other".split(" ")
            expect(argvex({ argv, schema, stopEarly: true })).toStrictEqual({
                _: ["cmd", "--other"],
                milk: ["oat", "almond", "cow"]
            })
        })

        it("should parse short flags before the first positional", () => {
            const schema = {
                verbose: { alias: "v", arity: 0 },
                size: { alias: "s", arity: 1 }
            }
            const argv = "-vs xl cmd --other".split(" ")
            expect(argvex({ argv, schema, stopEarly: true })).toStrictEqual({
                _: ["cmd", "--other"],
                verbose: [],
                size: ["xl"]
            })
        })

        it("should not stop early when stopEarly is not set", () => {
            const schema = { verbose: { arity: 0 } }
            const argv = "cmd --verbose other".split(" ")
            expect(argvex({ argv, schema })).toStrictEqual({
                _: ["cmd", "other"],
                verbose: []
            })
        })

        it("should not trigger on args consumed by schema-less infinite arity", () => {
            const argv = "--flag value cmd".split(" ")
            expect(argvex({ argv, stopEarly: true })).toStrictEqual({
                _: [],
                flag: ["value", "cmd"]
            })
        })

        it("should return empty result with empty argv", () => {
            expect(argvex({ argv: [], stopEarly: true })).toStrictEqual({
                _: []
            })
        })

        it("should work with strict mode", () => {
            const schema = { output: { alias: "o", arity: 1 } }
            const argv = "-o file.txt cmd --unknown".split(" ")
            expect(
                argvex({ argv, schema, strict: true, stopEarly: true })
            ).toStrictEqual({
                _: ["cmd", "--unknown"],
                output: ["file.txt"]
            })
        })
    })

    context("arity consumption", () => {
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

        it("should consume negative number as value via short alias", () => {
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

        it("should stop consuming when -- appears mid-arity", () => {
            const schema = { milk: { arity: 3 } }
            const argv = "--milk oat -- almond".split(" ")
            expect(argvex({ argv, schema })).toStrictEqual({
                _: ["almond"],
                milk: ["oat"]
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

    context("edge cases", () => {
        context("malformed input", () => {
            it("should throw INVALID_FORMAT for long flag without a name", () => {
                const argv = "brewer --=2xl".split(" ")
                expect(() => argvex({ argv })).toThrowError(ParseError)
                expect(() => argvex({ argv })).toThrowError(
                    `Argument "--=2xl" is malformed: flag name is missing.`
                )
                try {
                    argvex({ argv })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_FORMAT" satisfies ParseErrorCode
                    )
                }
            })

            it("should throw INVALID_FORMAT for short flag without a name", () => {
                const argv = "brewer -".split(" ")
                expect(() => argvex({ argv })).toThrowError(ParseError)
                expect(() => argvex({ argv })).toThrowError(
                    `Argument "-" is malformed: flag name is missing.`
                )
                try {
                    argvex({ argv })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_FORMAT" satisfies ParseErrorCode
                    )
                }
            })

            it("should throw INVALID_FORMAT for short flag = with no name", () => {
                const argv = "brewer -=xl".split(" ")
                expect(() => argvex({ argv })).toThrowError(ParseError)
                expect(() => argvex({ argv })).toThrowError(
                    `Argument "-=xl" is malformed: flag name is missing.`
                )
                try {
                    argvex({ argv })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_FORMAT" satisfies ParseErrorCode
                    )
                }
            })

            it("should reject triple dash as invalid format", () => {
                const argv = ["---flag"]
                expect(() => argvex({ argv })).toThrowError(ParseError)
                expect(() => argvex({ argv })).toThrowError(
                    `Argument "---flag" is malformed: triple dash is not valid.`
                )
                try {
                    argvex({ argv })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_FORMAT" satisfies ParseErrorCode
                    )
                    expect((error as ParseError).argument).toBe("---flag")
                }
            })

            it("should reject --_ as a reserved flag name", () => {
                const argv = "--_ value pos1".split(" ")
                expect(() => argvex({ argv })).toThrowError(ParseError)
                expect(() => argvex({ argv })).toThrowError(
                    `Flag name "--_" is reserved: "_" is used for positional arguments.`
                )
                try {
                    argvex({ argv })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "RESERVED_NAME" satisfies ParseErrorCode
                    )
                    expect((error as ParseError).argument).toBe("--_")
                    expect((error as ParseError).known).toStrictEqual([])
                }
            })
        })

        context("special values", () => {
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

            it("should parse single-char long flag as a regular flag", () => {
                const argv = ["--v"]
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    v: []
                })
            })

            it("should parse unicode flag names without schema", () => {
                const argv = ["--café", "latte"]
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    "café": ["latte"]
                })
            })

            it("should parse unicode flag names with schema", () => {
                const schema = { "café": { arity: 1 } }
                const argv = ["--café", "latte"]
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    "café": ["latte"]
                })
            })

            it("should parse unicode flag names with = syntax", () => {
                const argv = ["--café=latte"]
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    "café": ["latte"]
                })
            })
        })

        context("delimiter behavior", () => {
            it("should treat everything after -- as positional", () => {
                const argv = "-- --flag -s value".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["--flag", "-s", "value"]
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
        })

        context("prototype pollution", () => {
            it("should parse constructor as flag name without crashing", () => {
                const argv = "--constructor val".split(" ")
                expect(argvex({ argv })).toEqual({
                    _: [],
                    constructor: ["val"]
                })
            })

            it("should parse toString as flag name without crashing", () => {
                const argv = "--toString val".split(" ")
                expect(argvex({ argv })).toEqual({
                    _: [],
                    toString: ["val"]
                })
            })
        })

        context("error metadata", () => {
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
        })
    })

    context("schema validation", () => {
        context("alias rules", () => {
            it("should throw INVALID_SCHEMA for multi-character alias", () => {
                const schema = { verbose: { alias: "verb" } }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    `Schema definition for "verbose" is invalid: alias must be a single character.`
                )
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_SCHEMA" satisfies ParseErrorCode
                    )
                    expect((error as ParseError).argument).toBe("verbose")
                }
            })

            it("should throw INVALID_SCHEMA for empty string alias", () => {
                const schema = { verbose: { alias: "" } }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    `Schema definition for "verbose" is invalid: alias must be a single character.`
                )
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_SCHEMA" satisfies ParseErrorCode
                    )
                    expect((error as ParseError).argument).toBe("verbose")
                }
            })

            it("should throw INVALID_SCHEMA for duplicate alias across entries", () => {
                const schema = { verbose: { alias: "v" }, version: { alias: "v" } }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    `Schema definition for "version" is invalid: alias collides with an existing flag or alias.`
                )
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_SCHEMA" satisfies ParseErrorCode
                    )
                    expect((error as ParseError).argument).toBe("version")
                }
            })

            it("should throw INVALID_SCHEMA when alias collides with another flag name", () => {
                const schema = { verbose: { alias: "v" }, v: {} }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_SCHEMA" satisfies ParseErrorCode
                    )
                }
            })

            it("should accept a single-character alias", () => {
                const schema = { verbose: { alias: "v" } }
                expect(() => argvex({ argv: [], schema })).not.toThrowError()
            })

            it("should throw INVALID_SCHEMA for alias _", () => {
                const schema = { verbose: { alias: "_" } }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe("INVALID_SCHEMA")
                    expect((error as ParseError).argument).toBe("verbose")
                }
            })

            it("should throw INVALID_SCHEMA for alias -", () => {
                const schema = { verbose: { alias: "-" } }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe("INVALID_SCHEMA")
                    expect((error as ParseError).argument).toBe("verbose")
                }
            })

            it("should throw INVALID_SCHEMA for alias =", () => {
                const schema = { verbose: { alias: "=" } }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_SCHEMA" satisfies ParseErrorCode
                    )
                    expect((error as ParseError).argument).toBe("verbose")
                }
            })
        })

        context("arity rules", () => {
            it("should throw INVALID_SCHEMA for negative arity", () => {
                const schema = { verbose: { arity: -1 } }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    `Schema definition for "verbose" is invalid: arity cannot be negative.`
                )
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_SCHEMA" satisfies ParseErrorCode
                    )
                    expect((error as ParseError).argument).toBe("verbose")
                }
            })

            it("should accept zero arity", () => {
                const schema = { verbose: { arity: 0 } }
                expect(() => argvex({ argv: [], schema })).not.toThrowError()
            })

            it("should throw INVALID_SCHEMA for arity NaN", () => {
                const schema = { flag: { arity: NaN } }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe("INVALID_SCHEMA")
                    expect((error as ParseError).argument).toBe("flag")
                }
            })

            it("should throw INVALID_SCHEMA for fractional arity", () => {
                const schema = { flag: { arity: 1.5 } }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe("INVALID_SCHEMA")
                    expect((error as ParseError).argument).toBe("flag")
                }
            })

            it("should throw INVALID_SCHEMA for Infinity arity", () => {
                const schema = { flag: { arity: Infinity } }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe("INVALID_SCHEMA")
                    expect((error as ParseError).argument).toBe("flag")
                }
            })
        })

        context("reserved names", () => {
            it("should throw INVALID_SCHEMA for schema key _", () => {
                const schema = { _: { arity: 1 } }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe("INVALID_SCHEMA")
                    expect((error as ParseError).argument).toBe("_")
                }
            })
        })

        context("invalid keys", () => {
            it("should throw INVALID_SCHEMA for empty string key", () => {
                const schema = { "": { arity: 1 } }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_SCHEMA" satisfies ParseErrorCode
                    )
                    expect((error as ParseError).argument).toBe("")
                }
            })

            it("should throw INVALID_SCHEMA for key containing =", () => {
                const schema = { "foo=bar": { arity: 1 } }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_SCHEMA" satisfies ParseErrorCode
                    )
                    expect((error as ParseError).argument).toBe("foo=bar")
                }
            })

            it("should throw INVALID_SCHEMA for key starting with -", () => {
                const schema = { "-flag": {} }
                expect(() => argvex({ argv: [], schema })).toThrowError(ParseError)
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_SCHEMA" satisfies ParseErrorCode
                    )
                    expect((error as ParseError).argument).toBe("-flag")
                }
            })
        })

        context("valid schemas", () => {
            it("should accept a schema with aliases and arity", () => {
                const schema = {
                    verbose: { alias: "v", arity: 0 },
                    output: { alias: "o", arity: 1 }
                }
                expect(() => argvex({ argv: [], schema })).not.toThrowError()
            })

            it("should accept a schema with no aliases or arity", () => {
                const schema = { verbose: {} }
                expect(() => argvex({ argv: [], schema })).not.toThrowError()
            })
        })
    })

    context("type inference", () => {
        it("should allow accessing unknown flags in non-strict mode with schema", () => {
            const schema = { verbose: { arity: 0 }, size: { arity: 1 } } as const
            const result = argvex({
                argv: "--verbose --unknown val".split(" "),
                schema
            })
            expect(result.verbose).toStrictEqual([])
            const unknownVal: string[] | undefined = result.unknown
            expect(unknownVal).toStrictEqual(["val"])
        })

        it("should have typed keys in strict mode with schema", () => {
            const schema = { verbose: { arity: 0 }, size: { arity: 1 } } as const
            const result = argvex({
                argv: "--verbose --size xl".split(" "),
                schema,
                strict: true
            })
            const v: string[] | undefined = result.verbose
            const s: string[] | undefined = result.size
            expect(v).toStrictEqual([])
            expect(s).toStrictEqual(["xl"])
            // @ts-expect-error -- unknown keys should be a type error in strict mode
            result.anything
        })

        it("should have index signature without schema", () => {
            const result = argvex({ argv: "--anything val".split(" ") })
            const val: string[] | undefined = result.anything
            expect(val).toStrictEqual(["val"])
        })
    })
})

describe("ParseError", () => {
    it("should have name 'ParseError'", () => {
        try {
            argvex({ argv: ["--_"] })
        } catch (error) {
            expect(error).toBeInstanceOf(ParseError)
            expect((error as ParseError).name).toBe("ParseError")
        }
    })

    it("should produce toString() starting with 'ParseError:'", () => {
        try {
            argvex({ argv: ["--_"] })
        } catch (error) {
            expect(error).toBeInstanceOf(ParseError)
            expect((error as Error).toString()).toMatch(/^ParseError:/)
        }
    })

    context("known array", () => {
        it("should be empty for INVALID_FORMAT errors", () => {
            try {
                argvex({ argv: ["---flag"] })
            } catch (error) {
                expect((error as ParseError).code).toBe(
                    "INVALID_FORMAT" satisfies ParseErrorCode
                )
                expect((error as ParseError).known).toStrictEqual([])
            }
        })

        it("should be empty for INVALID_FORMAT even with schema", () => {
            const schema = { verbose: { alias: "v", arity: 0 } }
            try {
                argvex({ argv: ["---flag"], schema })
            } catch (error) {
                expect((error as ParseError).code).toBe(
                    "INVALID_FORMAT" satisfies ParseErrorCode
                )
                expect((error as ParseError).known).toStrictEqual([])
            }
        })

        it("should be empty for INVALID_SCHEMA errors", () => {
            const schema = { verbose: { alias: "verb" } }
            try {
                argvex({ argv: [], schema })
            } catch (error) {
                expect((error as ParseError).code).toBe(
                    "INVALID_SCHEMA" satisfies ParseErrorCode
                )
                expect((error as ParseError).known).toStrictEqual([])
            }
        })

        it("should be empty for RESERVED_NAME errors", () => {
            try {
                argvex({ argv: ["--_"] })
            } catch (error) {
                expect((error as ParseError).code).toBe(
                    "RESERVED_NAME" satisfies ParseErrorCode
                )
                expect((error as ParseError).known).toStrictEqual([])
            }
        })

        it("should populate for UNKNOWN_FLAG errors", () => {
            const schema = { verbose: { alias: "v", arity: 0 } }
            try {
                argvex({ argv: ["--unknown"], schema, strict: true })
            } catch (error) {
                expect((error as ParseError).code).toBe(
                    "UNKNOWN_FLAG" satisfies ParseErrorCode
                )
                expect((error as ParseError).known).toStrictEqual(["verbose"])
            }
        })
    })
})
