import { describe, expect, it } from "vitest"
import argvex, { ParseError, type ParseErrorCode } from "./index"

describe("argvex", () => {
    context("without schema", () => {
        context("operands", () => {
            it("returns empty result for empty argv", () => {
                expect(argvex({ argv: [] })).toStrictEqual({
                    _: [],
                    __: []
                })
            })

            it("collects all args as positionals when no flags are present", () => {
                const argv = "brewer make latte".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer", "make", "latte"],
                    __: []
                })
            })

            it("treats empty string in argv as positional", () => {
                const argv = [""]
                expect(argvex({ argv })).toStrictEqual({
                    _: [""],
                    __: []
                })
            })

            it("consumes interleaved arg as flag value", () => {
                const argv = "file1.txt --verbose file2.txt".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["file1.txt"],
                    __: [],
                    verbose: ["file2.txt"]
                })
            })

            it("defaults to process.argv.slice(2)", () => {
                const original = process.argv
                process.argv = ["node", "script.js", "--verbose", "hello"]
                try {
                    const result = argvex()
                    expect(result).toStrictEqual({
                        _: [],
                        __: [],
                        verbose: ["hello"]
                    })
                } finally {
                    process.argv = original
                }
            })
        })

        context("long flags", () => {
            it("parses operands and long flags", () => {
                const argv =
                    "brewer make latte --decaf --size xl --shots 2 --milk oat".split(
                        " "
                    )
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer", "make", "latte"],
                    __: [],
                    decaf: [],
                    size: ["xl"],
                    shots: ["2"],
                    milk: ["oat"]
                })
            })

            it("parses flags only", () => {
                const argv = "--decaf --size xl".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    decaf: [],
                    size: ["xl"]
                })
            })

            it("treats -N as a flag, not a number", () => {
                const argv = "--offset -5".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    offset: [],
                    5: []
                })
            })

            it("treats --value after a flag as another flag", () => {
                const argv = "--name --value".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    name: [],
                    value: []
                })
            })

            it("accumulates repeated flags", () => {
                const argv = "--flag val1 --flag val2".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    flag: ["val1", "val2"]
                })
            })
        })

        context("short flags", () => {
            it("parses operands and short flags", () => {
                const argv = "brewer make latte -d -s xl -h 2 -m oat".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer", "make", "latte"],
                    __: [],
                    d: [],
                    s: ["xl"],
                    h: ["2"],
                    m: ["oat"]
                })
            })
        })

        context("flag groups", () => {
            it("expands grouped short flags", () => {
                const argv = "brewer make latte -qvd".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer", "make", "latte"],
                    __: [],
                    q: [],
                    v: [],
                    d: []
                })
            })

            it("mixes long and short flags", () => {
                const argv = "brewer make latte -ds xl --shots=2 --milk oat".split(
                    " "
                )
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer", "make", "latte"],
                    __: [],
                    d: [],
                    s: ["xl"],
                    shots: ["2"],
                    milk: ["oat"]
                })
            })
        })

        context("= syntax", () => {
            it("assigns value with = on long flag", () => {
                const argv =
                    "brewer make --decaf --size=xl --shots=2 --milk=oat latte".split(
                        " "
                    )
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer", "make", "latte"],
                    __: [],
                    decaf: [],
                    size: ["xl"],
                    shots: ["2"],
                    milk: ["oat"]
                })
            })

            it("assigns value with = on short flag", () => {
                const argv = "brewer -s=xl".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer"],
                    __: [],
                    s: ["xl"]
                })
            })

            it("assigns = value on last flag in a group", () => {
                const argv = "brewer -ab=xl".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer"],
                    __: [],
                    a: [],
                    b: ["xl"]
                })
            })

            it("treats empty value after = as empty string", () => {
                const argv = "brewer -s=".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer"],
                    __: [],
                    s: [""]
                })
            })

            it("splits on first = only and preserves the rest", () => {
                const argv = "--size=2xl=big".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    size: ["2xl=big"]
                })
            })

            it("treats empty value after = on long flag as empty string", () => {
                const argv = "--size=".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    size: [""]
                })
            })
        })

        context("-- delimiter", () => {
            it("stops parsing flags after --", () => {
                const argv = "brewer make --milk oat -- latte --not-a-flag".split(
                    " "
                )
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer", "make", "latte", "--not-a-flag"],
                    __: [],
                    milk: ["oat"]
                })
            })
        })
    })

    context("with schema", () => {
        context("arity", () => {
            it("consumes N args matching the flag arity", () => {
                const schema = {
                    version: { alias: "v", arity: 0 },
                    decaf: { alias: "d", arity: 0 },
                    size: { alias: "s", arity: 1 },
                    shots: { alias: "h", arity: 1 },
                    milk: { alias: "m", arity: 3 },
                    name: { alias: "n", arity: 1 }
                }
                const argv =
                    "brewer make --decaf no --size xs --shots 0 --milk oat almond cow latte".split(
                        " "
                    )
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["brewer", "make", "no", "latte"],
                    __: [],
                    decaf: [],
                    size: ["xs"],
                    shots: ["0"],
                    milk: ["oat", "almond", "cow"]
                })
            })

            it("pushes next arg to positionals when flag has arity 0", () => {
                const schema = {
                    decaf: { alias: "d", arity: 0 },
                    size: { alias: "s", arity: 1 }
                }
                const argv = "--decaf oat".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["oat"],
                    __: [],
                    decaf: []
                })
            })

            it("resets arity budget on each flag occurrence (arity 1)", () => {
                const schema = { include: { arity: 1 } }
                const argv = "--include src --include lib --include test".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    include: ["src", "lib", "test"]
                })
            })

            it("resets arity budget on each flag occurrence (arity 3)", () => {
                const schema = { include: { arity: 3 } }
                const argv = "--include src lib test --include a b c".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    include: ["src", "lib", "test", "a", "b", "c"]
                })
            })

            it("sends excess args to positionals after arity is exhausted", () => {
                const schema = { milk: { alias: "m", arity: 1 } }
                const argv = "--milk steamed whole oat".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["whole", "oat"],
                    __: [],
                    milk: ["steamed"]
                })
            })

            it("stops consuming at next flag even with remaining budget", () => {
                const schema = { include: { arity: 2 } }
                const argv = "--include src --include lib --include test".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    include: ["src", "lib", "test"]
                })
            })

            it("stops consuming at a different flag", () => {
                const schema = { include: { arity: 3 }, exclude: { arity: 3 } }
                const argv = "--include src lib --exclude foo".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    include: ["src", "lib"],
                    exclude: ["foo"]
                })
            })

            it("returns empty values when flag with arity > 0 is last arg", () => {
                const schema = { size: { arity: 1 } }
                const argv = ["--size"]
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    size: []
                })
            })

            it("returns only positionals when argv is empty", () => {
                const schema = { verbose: { arity: 0 } }
                expect(argvex({ argv: [], schema })).toStrictEqual({
                    _: [],
                    __: []
                })
            })

            it("does not include unused schema flags in result", () => {
                const schema = { size: { arity: 1 }, verbose: { arity: 0 } }
                const argv = "--size xl".split(" ")
                const result = argvex({ argv, schema })
                expect(result).toStrictEqual({
                    _: [],
                    __: [],
                    size: ["xl"]
                })
                expect("verbose" in result).toBe(false)
            })

            it("interleaves positionals with arity-0 flags", () => {
                const schema = { verbose: { arity: 0 } }
                const argv = "file1.txt --verbose file2.txt".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["file1.txt", "file2.txt"],
                    __: [],
                    verbose: []
                })
            })

            it("routes -N to __ when schema is present", () => {
                const schema = { offset: { arity: 1 } }
                const argv = "--offset -5".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["-5"],
                    offset: []
                })
            })

            it("routes flag-like arg to __ when flag has remaining arity", () => {
                const schema = { name: { arity: 1 } }
                const argv = "--name --value".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["--value"],
                    name: []
                })
            })

            it("routes flag-like short arg to __ when flag has remaining arity", () => {
                const schema = { count: { alias: "n", arity: 1 } }
                const argv = "-n -5".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["-5"],
                    count: []
                })
            })
        })

        context("aliases", () => {
            it("resolves short flags to their canonical names", () => {
                const schema = {
                    version: { alias: "v", arity: 0 },
                    decaf: { alias: "d", arity: 0 },
                    size: { alias: "s", arity: 1 },
                    shots: { alias: "h", arity: 1 },
                    milk: { alias: "m", arity: 3 },
                    name: { alias: "n", arity: 1 }
                }
                const argv =
                    "brewer make -d no -s xs -h 0 -m oat almond cow latte".split(
                        " "
                    )
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["brewer", "make", "no", "latte"],
                    __: [],
                    decaf: [],
                    size: ["xs"],
                    shots: ["0"],
                    milk: ["oat", "almond", "cow"]
                })
            })

            it("resolves alias used as --long prefix", () => {
                const schema = {
                    decaf: { alias: "d", arity: 0 },
                    size: { alias: "s", arity: 1 }
                }
                const argv = "--d --s medium".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    decaf: [],
                    size: ["medium"]
                })
            })
        })

        context("flag groups", () => {
            it("parses inline value after zero-arity flags", () => {
                const schema = {
                    decaf: { alias: "d", arity: 0 },
                    size: { alias: "s", arity: 1 }
                }
                const argv = "-dsoat".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    decaf: [],
                    size: ["oat"]
                })
            })

            it("parses a single inline argument in a group", () => {
                const schema = {
                    version: { alias: "v", arity: 0 },
                    decaf: { alias: "d", arity: 0 },
                    size: { alias: "s", arity: 1 },
                    shots: { alias: "h", arity: 1 },
                    milk: { alias: "m", arity: 3 },
                    name: { alias: "n", arity: 1 }
                }
                const argv = "brewer make -vdnMatthew latte".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["brewer", "make", "latte"],
                    __: [],
                    version: [],
                    decaf: [],
                    name: ["Matthew"]
                })
            })

            it("consumes remaining group chars as inline value when middle flag has arity > 0", () => {
                const schema = {
                    a: { alias: "a", arity: 0 },
                    b: { alias: "b", arity: 1 },
                    c: { alias: "c", arity: 0 }
                }
                const argv = ["-abc"]
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    a: [],
                    b: ["c"]
                })
            })

            it("treats all leading flags as arity 0 when group ends with =", () => {
                const schema = { a: { arity: 1 }, b: { arity: 1 } }
                const argv = ["-ab=val"]
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    a: [],
                    b: ["val"]
                })
            })

            it("consumes first char as inline value when all chars have arity > 0", () => {
                const schema = { a: { arity: 1 }, b: { arity: 1 } }
                const argv = "-ab val".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["val"],
                    __: [],
                    a: ["b"]
                })
            })

            it("consumes remaining chars as inline value for duplicate chars with arity", () => {
                const schema = { v: { arity: 1 } }
                const argv = "-vvv nextval".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["nextval"],
                    __: [],
                    v: ["vv"]
                })
            })

            it("treats last duplicate char with arity 0 normally", () => {
                const schema = { v: { arity: 0 } }
                const argv = "-vvv nextval".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["nextval"],
                    __: [],
                    v: []
                })
            })
        })

        context("= syntax", () => {
            it("assigns = value with schema alias", () => {
                const schema = {
                    decaf: { alias: "d", arity: 0 },
                    size: { alias: "s", arity: 1 }
                }
                const argv = "-ds=medium".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    decaf: [],
                    size: ["medium"]
                })
            })

            it("accumulates values across long, =, short, and inline syntaxes", () => {
                const schema = {
                    decaf: { alias: "d", arity: 0 },
                    size: { alias: "s", arity: 1 }
                }
                const argv = "--size xl --size=md -sxs".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    size: ["xl", "md", "xs"]
                })
            })

            it("accumulates repeated flags by default", () => {
                const schema = {
                    version: { alias: "v", arity: 0 },
                    decaf: { alias: "d", arity: 0 },
                    size: { alias: "s", arity: 1 },
                    shots: { alias: "h", arity: 1 },
                    milk: { alias: "m", arity: 3 },
                    name: { alias: "n", arity: 1 }
                }
                const argv =
                    "brewer make latte --milk oat --milk=almond -mcow".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["brewer", "make", "latte"],
                    __: [],
                    milk: ["oat", "almond", "cow"]
                })
            })

            it("preserves arity budget when mixing = and space syntax", () => {
                const schema = { milk: { alias: "m", arity: 3 } }
                const argv = "--milk=oat --milk steamed whole".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    milk: ["oat", "steamed", "whole"]
                })
            })

            it("does not consume trailing positionals after = syntax", () => {
                const schema = { milk: { alias: "m", arity: 3 } }
                const argv = "--milk=oat latte".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["latte"],
                    __: [],
                    milk: ["oat"]
                })
            })

            it("preserves arity across repeated = syntax", () => {
                const schema = { milk: { alias: "m", arity: 3 } }
                const argv = "--milk=oat --milk=almond --milk=cow".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    milk: ["oat", "almond", "cow"]
                })
            })

            it("honors = assignment even when arity is 0", () => {
                const schema = { verbose: { arity: 0 } }
                const argv = "--verbose=true".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    verbose: ["true"]
                })
            })

            it("honors = assignment on short flag even when arity is 0", () => {
                const schema = { verbose: { alias: "v", arity: 0 } }
                const argv = ["-v=true"]
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    verbose: ["true"]
                })
            })
        })

        context("-- delimiter", () => {
            it("stops parsing flags after --", () => {
                const schema = { include: { arity: 1 }, exclude: { arity: 1 } }
                const argv = "--include src -- --exclude foo".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["--exclude", "foo"],
                    __: [],
                    include: ["src"]
                })
            })

            it("stops consuming when -- appears mid-arity", () => {
                const schema = { milk: { arity: 3 } }
                const argv = "--milk oat -- almond".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["almond"],
                    __: [],
                    milk: ["oat"]
                })
            })
        })

        context("unknown flags (__)", () => {
            it("routes unknown long flag to __", () => {
                const schema = { known: { arity: 2 } }
                expect(
                    argvex({ argv: "--known a b --unknown".split(" "), schema })
                ).toStrictEqual({
                    _: [],
                    __: ["--unknown"],
                    known: ["a", "b"]
                })

                expect(
                    argvex({ argv: "--unknown --known a b".split(" "), schema })
                ).toStrictEqual({
                    _: [],
                    __: ["--unknown"],
                    known: ["a", "b"]
                })
            })

            it("interrupts arity consumption at unknown flag", () => {
                const schema = { known: { arity: 2 } }
                const result = argvex({
                    argv: "--unknown x --known a --unknown b".split(" "),
                    schema
                })
                expect(result.known).toStrictEqual(["a"])
                expect(result.__).toStrictEqual(["--unknown", "--unknown"])
                expect(result._).toStrictEqual(["x", "b"])
            })

            it("pushes unknown long flag to __", () => {
                const result = argvex({
                    argv: ["--known", "--unknown"],
                    schema: { known: { arity: 0 } }
                })
                expect(result).toStrictEqual({
                    _: [],
                    __: ["--unknown"],
                    known: []
                })
            })

            it("pushes unknown long flag with = to __ verbatim", () => {
                const result = argvex({
                    argv: ["--unknown=foo"],
                    schema: {}
                })
                expect(result).toStrictEqual({
                    _: [],
                    __: ["--unknown=foo"]
                })
            })

            it("pushes unknown short flag to __", () => {
                const result = argvex({
                    argv: ["-x"],
                    schema: {}
                })
                expect(result).toStrictEqual({
                    _: [],
                    __: ["-x"]
                })
            })

            it("pushes unknown short flag with = to __ verbatim", () => {
                const result = argvex({
                    argv: ["-x=val"],
                    schema: {}
                })
                expect(result).toStrictEqual({
                    _: [],
                    __: ["-x=val"]
                })
            })

            it("splits known and unknown flags in a group", () => {
                const result = argvex({
                    argv: ["-dxe"],
                    schema: { d: { arity: 0 }, e: { arity: 0 } }
                })
                expect(result).toStrictEqual({
                    _: [],
                    __: ["-x"],
                    d: [],
                    e: []
                })
            })

            it("does not consume values for unknown flags", () => {
                const result = argvex({
                    argv: "--unknown val1 --known val2".split(" "),
                    schema: { known: { arity: 1 } }
                })
                expect(result).toStrictEqual({
                    _: ["val1"],
                    __: ["--unknown"],
                    known: ["val2"]
                })
            })

            it("does not consume values for unknown short flags", () => {
                const schema = { size: { arity: 1 } }
                const argv = "-u val --size xl".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["val"],
                    __: ["-u"],
                    size: ["xl"]
                })
            })

            it("routes multiple unknown flags to __", () => {
                const schema = { size: { arity: 1 } }
                const argv = "--unknown val1 val2 --size xl".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["val1", "val2"],
                    __: ["--unknown"],
                    size: ["xl"]
                })
            })

            it("returns empty __ when no unknowns exist", () => {
                const result = argvex({
                    argv: "--known val".split(" "),
                    schema: { known: { arity: 1 } }
                })
                expect(result).toStrictEqual({
                    _: [],
                    __: [],
                    known: ["val"]
                })
            })

            it("returns empty __ when no schema is provided", () => {
                const result = argvex({
                    argv: "--anything val".split(" ")
                })
                expect(result.__).toStrictEqual([])
            })

            it("collects multiple unknown flags", () => {
                const result = argvex({
                    argv: ["--a", "--b", "--c"],
                    schema: {}
                })
                expect(result).toStrictEqual({
                    _: [],
                    __: ["--a", "--b", "--c"]
                })
            })

            it("rejects --__ at parse time", () => {
                expect(() => argvex({ argv: ["--__"] })).toThrowError(
                    ParseError
                )
                try {
                    argvex({ argv: ["--__"] })
                } catch (error) {
                    expect((error as ParseError).code).toBe("RESERVED_NAME")
                    expect((error as ParseError).argument).toBe("--__")
                }
            })

            it("does not detect unknowns after stopEarly triggers", () => {
                const result = argvex({
                    argv: "--known val pos1 --unknown".split(" "),
                    schema: { known: { arity: 1 } },
                    stopEarly: true
                })
                expect(result).toStrictEqual({
                    _: ["pos1", "--unknown"],
                    __: [],
                    known: ["val"]
                })
            })

            it("types __ as string[]", () => {
                const schema = { flag: { arity: 0 } } as const
                const result = argvex({ argv: [], schema })
                const unknowns: string[] = result.__
                expect(unknowns).toStrictEqual([])
            })
        })
    })

    context("stopEarly", () => {
        it("collects everything as positional when first arg is positional", () => {
            const argv = "cmd --flag value".split(" ")
            expect(argvex({ argv, stopEarly: true })).toStrictEqual({
                _: ["cmd", "--flag", "value"],
                __: []
            })
        })

        it("parses flags that appear before the first positional", () => {
            const schema = { verbose: { arity: 0 }, size: { arity: 1 } }
            const argv = "--verbose --size xl cmd --other".split(" ")
            expect(argvex({ argv, schema, stopEarly: true })).toStrictEqual({
                _: ["cmd", "--other"],
                __: [],
                verbose: [],
                size: ["xl"]
            })
        })

        it("respects -- delimiter", () => {
            const schema = { flag: { arity: 0 } }
            const argv = "--flag -- cmd --other".split(" ")
            expect(argvex({ argv, schema, stopEarly: true })).toStrictEqual({
                _: ["cmd", "--other"],
                __: [],
                flag: []
            })
        })

        it("does not trigger on args consumed by arity", () => {
            const schema = { milk: { arity: 3 } }
            const argv = "--milk oat almond cow cmd --other".split(" ")
            expect(argvex({ argv, schema, stopEarly: true })).toStrictEqual({
                _: ["cmd", "--other"],
                __: [],
                milk: ["oat", "almond", "cow"]
            })
        })

        it("parses short flags before the first positional", () => {
            const schema = {
                verbose: { alias: "v", arity: 0 },
                size: { alias: "s", arity: 1 }
            }
            const argv = "-vs xl cmd --other".split(" ")
            expect(argvex({ argv, schema, stopEarly: true })).toStrictEqual({
                _: ["cmd", "--other"],
                __: [],
                verbose: [],
                size: ["xl"]
            })
        })

        it("does not stop early when stopEarly is not set", () => {
            const schema = { verbose: { arity: 0 } }
            const argv = "cmd --verbose other".split(" ")
            expect(argvex({ argv, schema })).toStrictEqual({
                _: ["cmd", "other"],
                __: [],
                verbose: []
            })
        })

        it("does not trigger on args consumed by schema-less infinite arity", () => {
            const argv = "--flag value cmd".split(" ")
            expect(argvex({ argv, stopEarly: true })).toStrictEqual({
                _: [],
                __: [],
                flag: ["value", "cmd"]
            })
        })

        it("returns empty result with empty argv", () => {
            expect(argvex({ argv: [], stopEarly: true })).toStrictEqual({
                _: [],
                __: []
            })
        })
    })

    context("edge cases", () => {
        context("malformed input", () => {
            it("throws INVALID_FORMAT for --= (missing name)", () => {
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

            it("throws INVALID_FORMAT for bare - (missing name)", () => {
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

            it("throws INVALID_FORMAT for -= (missing name)", () => {
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

            it("throws INVALID_FORMAT for triple dash", () => {
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

            it("throws RESERVED_NAME for --_", () => {
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
                }
            })
        })

        context("special values", () => {
            it("parses hyphenated flag names", () => {
                const argv = "--dry-run --output-dir ./dist".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    "dry-run": [],
                    "output-dir": ["./dist"]
                })
            })

            it("treats --no-verbose as a hyphenated name, not negation", () => {
                const argv = ["--no-verbose"]
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    "no-verbose": []
                })
            })

            it("parses single-char long flag as a regular flag", () => {
                const argv = ["--v"]
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    v: []
                })
            })

            it("parses unicode flag names without schema", () => {
                const argv = ["--café", "latte"]
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    café: ["latte"]
                })
            })

            it("parses unicode flag names with schema", () => {
                const schema = { café: { arity: 1 } }
                const argv = ["--café", "latte"]
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    café: ["latte"]
                })
            })

            it("parses unicode flag names with = syntax", () => {
                const argv = ["--café=latte"]
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    café: ["latte"]
                })
            })
        })

        context("delimiter behavior", () => {
            it("treats everything after -- as positional", () => {
                const argv = "-- --flag -s value".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["--flag", "-s", "value"],
                    __: []
                })
            })

            it("treats second -- as literal positional", () => {
                const argv = "-- foo -- bar".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["foo", "--", "bar"],
                    __: []
                })
            })

            it("handles -- with nothing after it", () => {
                const argv = ["--"]
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: []
                })
            })
        })

        context("prototype pollution", () => {
            it("parses constructor as flag name without crashing", () => {
                const argv = "--constructor val".split(" ")
                expect(argvex({ argv })).toEqual({
                    _: [],
                    __: [],
                    constructor: ["val"]
                })
            })

            it("parses toString as flag name without crashing", () => {
                const argv = "--toString val".split(" ")
                expect(argvex({ argv })).toEqual({
                    _: [],
                    __: [],
                    toString: ["val"]
                })
            })
        })

})

    context("schema validation", () => {
        context("alias rules", () => {
            it("throws INVALID_SCHEMA for multi-character alias", () => {
                const schema = { verbose: { alias: "verb" } }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
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

            it("throws INVALID_SCHEMA for empty string alias", () => {
                const schema = { verbose: { alias: "" } }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
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

            it("throws INVALID_SCHEMA for duplicate alias across entries", () => {
                const schema = {
                    verbose: { alias: "v" },
                    version: { alias: "v" }
                }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
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

            it("throws INVALID_SCHEMA when alias collides with another flag name", () => {
                const schema = { verbose: { alias: "v" }, v: {} }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_SCHEMA" satisfies ParseErrorCode
                    )
                }
            })

            it("accepts a single-character alias", () => {
                const schema = { verbose: { alias: "v" } }
                expect(() => argvex({ argv: [], schema })).not.toThrowError()
            })

            it("throws INVALID_SCHEMA for alias _", () => {
                const schema = { verbose: { alias: "_" } }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe("INVALID_SCHEMA")
                    expect((error as ParseError).argument).toBe("verbose")
                }
            })

            it("throws INVALID_SCHEMA for alias -", () => {
                const schema = { verbose: { alias: "-" } }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe("INVALID_SCHEMA")
                    expect((error as ParseError).argument).toBe("verbose")
                }
            })

            it("throws INVALID_SCHEMA for alias =", () => {
                const schema = { verbose: { alias: "=" } }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
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
        })

        context("arity rules", () => {
            it("throws INVALID_SCHEMA for negative arity", () => {
                const schema = { verbose: { arity: -1 } }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
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

            it("accepts zero arity", () => {
                const schema = { verbose: { arity: 0 } }
                expect(() => argvex({ argv: [], schema })).not.toThrowError()
            })

            it("throws INVALID_SCHEMA for arity NaN", () => {
                const schema = { flag: { arity: NaN } }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe("INVALID_SCHEMA")
                    expect((error as ParseError).argument).toBe("flag")
                }
            })

            it("throws INVALID_SCHEMA for fractional arity", () => {
                const schema = { flag: { arity: 1.5 } }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe("INVALID_SCHEMA")
                    expect((error as ParseError).argument).toBe("flag")
                }
            })

            it("throws INVALID_SCHEMA for Infinity arity", () => {
                const schema = { flag: { arity: Infinity } }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe("INVALID_SCHEMA")
                    expect((error as ParseError).argument).toBe("flag")
                }
            })
        })

        context("reserved names", () => {
            it("throws INVALID_SCHEMA for schema key _", () => {
                const schema = { _: { arity: 1 } }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe("INVALID_SCHEMA")
                    expect((error as ParseError).argument).toBe("_")
                }
            })

            it("throws INVALID_SCHEMA for schema key __", () => {
                const schema = { __: { arity: 0 } }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe("INVALID_SCHEMA")
                    expect((error as ParseError).argument).toBe("__")
                }
            })
        })

        context("invalid keys", () => {
            it("throws INVALID_SCHEMA for empty string key", () => {
                const schema = { "": { arity: 1 } }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_SCHEMA" satisfies ParseErrorCode
                    )
                    expect((error as ParseError).argument).toBe("")
                }
            })

            it("throws INVALID_SCHEMA for key containing =", () => {
                const schema = { "foo=bar": { arity: 1 } }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
                try {
                    argvex({ argv: [], schema })
                } catch (error) {
                    expect((error as ParseError).code).toBe(
                        "INVALID_SCHEMA" satisfies ParseErrorCode
                    )
                    expect((error as ParseError).argument).toBe("foo=bar")
                }
            })

            it("throws INVALID_SCHEMA for key starting with -", () => {
                const schema = { "-flag": {} }
                expect(() => argvex({ argv: [], schema })).toThrowError(
                    ParseError
                )
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
            it("accepts a schema with aliases and arity", () => {
                const schema = {
                    verbose: { alias: "v", arity: 0 },
                    output: { alias: "o", arity: 1 }
                }
                expect(() => argvex({ argv: [], schema })).not.toThrowError()
            })

            it("accepts a schema with no aliases or arity", () => {
                const schema = { verbose: {} }
                expect(() => argvex({ argv: [], schema })).not.toThrowError()
            })
        })
    })

    context("type inference", () => {
        it("has typed keys with literal schema", () => {
            const schema = {
                verbose: { arity: 0 },
                size: { arity: 1 }
            } as const
            const result = argvex({
                argv: "--verbose --size xl".split(" "),
                schema
            })
            const v: string[] | undefined = result.verbose
            const s: string[] | undefined = result.size
            const u: string[] = result.__
            expect(v).toStrictEqual([])
            expect(s).toStrictEqual(["xl"])
            expect(u).toStrictEqual([])
            // @ts-expect-error -- unknown keys should be a type error with literal schema
            result.anything
        })

        it("has index signature without schema", () => {
            const result = argvex({ argv: "--anything val".split(" ") })
            const val: string[] | undefined = result.anything
            expect(val).toStrictEqual(["val"])
        })
    })
})

describe("ParseError", () => {
    it("has name 'ParseError'", () => {
        try {
            argvex({ argv: ["--_"] })
        } catch (error) {
            expect(error).toBeInstanceOf(ParseError)
            expect((error as ParseError).name).toBe("ParseError")
        }
    })

    it("produces toString() starting with 'ParseError:'", () => {
        try {
            argvex({ argv: ["--_"] })
        } catch (error) {
            expect(error).toBeInstanceOf(ParseError)
            expect((error as Error).toString()).toMatch(/^ParseError:/)
        }
    })
})

function context(description: string, block: () => void): void {
    describe(description, block)
}
