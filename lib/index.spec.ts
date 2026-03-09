import { describe, expect, it } from "vitest"
import argvex from "./rewrite/index"
import { ErrorCode, ParseError } from "./rewrite/ParseError"

describe("argvex", () => {
    context("without schema", () => {
        context("operands", () => {
            it("returns empty result for empty argv", () => {
                expect(argvex({ argv: [] })).toStrictEqual({
                    _: [],
                    __: []
                })
            })

            it("collects all arguments as positionals when no flags are present", () => {
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

            it("consumes interleaved argument as flag value", () => {
                const argv = "latte --decaf espresso".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["latte"],
                    __: [],
                    decaf: ["espresso"]
                })
            })

            it("defaults to process.argv.slice(2)", () => {
                const original = process.argv
                process.argv = ["node", "brew.js", "--decaf", "oat"]
                try {
                    const result = argvex()
                    expect(result).toStrictEqual({
                        _: [],
                        __: [],
                        decaf: ["oat"]
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

            it("treats `-N` as a flag, not a number", () => {
                const argv = "--shots -5".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    shots: [],
                    5: []
                })
            })

            it("treats `--value` after a flag as another flag", () => {
                const argv = "--name --blend".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    name: [],
                    blend: []
                })
            })

            it("accumulates repeated flags", () => {
                const argv = "--milk oat --milk almond".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    milk: ["oat", "almond"]
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
                const argv =
                    "brewer make latte -ds xl --shots=2 --milk oat".split(" ")
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
            it("assigns value with `=` on long flag", () => {
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

            it("assigns value with `=` on short flag", () => {
                const argv = "brewer -s=xl".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer"],
                    __: [],
                    s: ["xl"]
                })
            })

            it("assigns `=` value on last flag in a group", () => {
                const argv = "brewer -ab=xl".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer"],
                    __: [],
                    a: [],
                    b: ["xl"]
                })
            })

            it("treats empty value after `=` as empty string", () => {
                const argv = "brewer -s=".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer"],
                    __: [],
                    s: [""]
                })
            })

            it("splits on first `=` only and preserves the rest", () => {
                const argv = "--size=2xl=big".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    size: ["2xl=big"]
                })
            })

            it("treats empty value after `=` on long flag as empty string", () => {
                const argv = "--size=".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    size: [""]
                })
            })
        })

        context("-- delimiter", () => {
            it("stops parsing flags after `--`", () => {
                const argv =
                    "brewer make --milk oat -- latte --not-a-flag".split(" ")
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
            it("consumes N arguments matching the flag arity", () => {
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

            it("pushes next argument to positionals when flag has arity 0", () => {
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
                const schema = { roast: { arity: 1 } }
                const argv = "--roast light --roast medium --roast dark".split(
                    " "
                )
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    roast: ["light", "medium", "dark"]
                })
            })

            it("resets arity budget on each flag occurrence (arity 3)", () => {
                const schema = { milk: { arity: 3 } }
                const argv =
                    "--milk oat almond cow --milk steamed whole skim".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    milk: ["oat", "almond", "cow", "steamed", "whole", "skim"]
                })
            })

            it("sends excess arguments to positionals after arity is exhausted", () => {
                const schema = { milk: { arity: 1 } }
                const argv = "--milk steamed whole oat".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["whole", "oat"],
                    __: [],
                    milk: ["steamed"]
                })
            })

            it("stops consuming at next flag even with remaining budget", () => {
                const schema = { roast: { arity: 2 } }
                const argv = "--roast light --roast medium --roast dark".split(
                    " "
                )
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    roast: ["light", "medium", "dark"]
                })
            })

            it("stops consuming at a different flag", () => {
                const schema = { milk: { arity: 3 }, sugar: { arity: 3 } }
                const argv = "--milk oat almond --sugar none".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    milk: ["oat", "almond"],
                    sugar: ["none"]
                })
            })

            it("returns empty values when flag with arity > 0 is last argument", () => {
                const schema = { size: { arity: 1 } }
                const argv = "--size".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    size: []
                })
            })

            it("does not include unused schema flags in result", () => {
                const schema = { size: { arity: 1 }, decaf: { arity: 0 } }
                const argv = "--size xl".split(" ")
                const result = argvex({ argv, schema })
                expect(result).toStrictEqual({
                    _: [],
                    __: [],
                    size: ["xl"]
                })
                expect("decaf" in result).toBe(false)
            })

            it("interleaves positionals with arity-0 flags", () => {
                const schema = { decaf: { arity: 0 } }
                const argv = "latte --decaf espresso".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["latte", "espresso"],
                    __: [],
                    decaf: []
                })
            })

            it("routes `-N` to `__` when schema is present", () => {
                const schema = { shots: { arity: 1 } }
                const argv = "--shots -5".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["-5"],
                    shots: []
                })
            })

            it("routes flag-like argument to `__` when flag has remaining arity", () => {
                const schema = { name: { arity: 1 } }
                const argv = "--name --unknown".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["--unknown"],
                    name: []
                })
            })

            it("routes flag-like short argument to `__` when flag has remaining arity", () => {
                const schema = { shots: { alias: "h", arity: 1 } }
                const argv = "-h -5".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["-5"],
                    shots: []
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
        })

        context("flag groups", () => {
            it("parses inline value after arity-0 flags", () => {
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

            it("consumes remaining group characters as inline value when middle flag has arity > 0", () => {
                const schema = {
                    d: { arity: 0 },
                    s: { arity: 1 },
                    m: { arity: 0 }
                }
                const argv = "-dsm".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    d: [],
                    s: ["m"]
                })
            })

            it("treats all leading flags as arity 0 when group ends with `=`", () => {
                const schema = { d: { arity: 1 }, s: { arity: 1 } }
                const argv = "-ds=oat".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    d: [],
                    s: ["oat"]
                })
            })

            it("consumes first character as inline value when all characters have arity > 0", () => {
                const schema = { d: { arity: 1 }, s: { arity: 1 } }
                const argv = "-ds medium".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["medium"],
                    __: [],
                    d: ["s"]
                })
            })

            it("consumes remaining characters as inline value for duplicate characters with arity", () => {
                const schema = { s: { arity: 1 } }
                const argv = "-sss medium".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["medium"],
                    __: [],
                    s: ["ss"]
                })
            })

            it("treats last duplicate character with arity 0 normally", () => {
                const schema = { d: { arity: 0 } }
                const argv = "-ddd latte".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["latte"],
                    __: [],
                    d: []
                })
            })
        })

        context("= syntax", () => {
            it("assigns `=` value with schema alias", () => {
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

            it("accumulates values across long, `=`, short, and inline syntaxes", () => {
                const schema = { size: { alias: "s", arity: 1 } }
                const argv = "--size xl --size=md -sxs".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    size: ["xl", "md", "xs"]
                })
            })

            it("preserves arity budget when mixing `=` and space syntax", () => {
                const schema = { milk: { arity: 3 } }
                const argv = "--milk=oat --milk steamed whole".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    milk: ["oat", "steamed", "whole"]
                })
            })

            it("does not consume trailing positionals after `=` syntax", () => {
                const schema = { milk: { arity: 3 } }
                const argv = "--milk=oat latte".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["latte"],
                    __: [],
                    milk: ["oat"]
                })
            })

            it("preserves arity across repeated `=` syntax", () => {
                const schema = { milk: { arity: 3 } }
                const argv = "--milk=oat --milk=almond --milk=cow".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    milk: ["oat", "almond", "cow"]
                })
            })

            it("honors `=` assignment even when arity is 0", () => {
                const schema = { decaf: { arity: 0 } }
                const argv = "--decaf=true".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    decaf: ["true"]
                })
            })

            it("honors `=` assignment on short flag even when arity is 0", () => {
                const schema = { decaf: { alias: "d", arity: 0 } }
                const argv = "-d=true".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    decaf: ["true"]
                })
            })
        })

        context("-- delimiter", () => {
            it("stops parsing flags after `--`", () => {
                const schema = { add: { arity: 1 }, roast: { arity: 1 } }
                const argv = "--add oat -- --roast dark".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["--roast", "dark"],
                    __: [],
                    add: ["oat"]
                })
            })

            it("stops consuming when `--` appears mid-arity", () => {
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
            it("routes unknown long flag to `__`", () => {
                const schema = { size: { arity: 2 } }
                const argv1 = "--size xl xs --unknown".split(" ")
                expect(argvex({ argv: argv1, schema })).toStrictEqual({
                    _: [],
                    __: ["--unknown"],
                    size: ["xl", "xs"]
                })

                const argv2 = "--unknown --size xl xs".split(" ")
                expect(argvex({ argv: argv2, schema })).toStrictEqual({
                    _: [],
                    __: ["--unknown"],
                    size: ["xl", "xs"]
                })
            })

            it("interrupts arity consumption at unknown flag", () => {
                const schema = { size: { arity: 2 } }
                const argv = "--unknown oat --size xl --unknown medium".split(
                    " "
                )
                const result = argvex({ argv, schema })
                expect(result.size).toStrictEqual(["xl"])
                expect(result.__).toStrictEqual(["--unknown", "--unknown"])
                expect(result._).toStrictEqual(["oat", "medium"])
            })

            it("pushes unknown long flag to `__`", () => {
                const schema = { decaf: { arity: 0 } }
                const argv = "--decaf --unknown".split(" ")
                const result = argvex({ argv, schema })
                expect(result).toStrictEqual({
                    _: [],
                    __: ["--unknown"],
                    decaf: []
                })
            })

            it("pushes unknown long flag with `=` to `__` verbatim", () => {
                const schema = {}
                const argv = "--unknown=foo".split(" ")
                const result = argvex({ argv, schema })
                expect(result).toStrictEqual({
                    _: [],
                    __: ["--unknown=foo"]
                })
            })

            it("pushes unknown short flag to `__`", () => {
                const schema = {}
                const argv = "-x".split(" ")
                const result = argvex({ argv, schema })
                expect(result).toStrictEqual({
                    _: [],
                    __: ["-x"]
                })
            })

            it("pushes unknown short flag with `=` to `__` verbatim", () => {
                const schema = {}
                const argv = "-x=val".split(" ")
                const result = argvex({ argv, schema })
                expect(result).toStrictEqual({
                    _: [],
                    __: ["-x=val"]
                })
            })

            it("splits known and unknown flags in a group", () => {
                const schema = { d: { arity: 0 }, m: { arity: 0 } }
                const argv = "-dxm".split(" ")
                const result = argvex({ argv, schema })
                expect(result).toStrictEqual({
                    _: [],
                    __: ["-x"],
                    d: [],
                    m: []
                })
            })

            it("does not consume values for unknown flags", () => {
                const schema = { roast: { arity: 1 } }
                const argv = "--unknown oat --roast dark".split(" ")
                const result = argvex({ argv, schema })
                expect(result).toStrictEqual({
                    _: ["oat"],
                    __: ["--unknown"],
                    roast: ["dark"]
                })
            })

            it("does not consume values for unknown short flags", () => {
                const schema = { size: { arity: 1 } }
                const argv = "-u oat --size xl".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["oat"],
                    __: ["-u"],
                    size: ["xl"]
                })
            })

            it("routes multiple unknown flags to __", () => {
                const schema = { size: { arity: 1 } }
                const argv = "--unknown oat latte --size xl".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["oat", "latte"],
                    __: ["--unknown"],
                    size: ["xl"]
                })
            })

            it("collects multiple unknown flags into `__`", () => {
                const schema = {}
                const argv = "--a --b --c".split(" ")
                const result = argvex({ argv, schema })
                expect(result).toStrictEqual({
                    _: [],
                    __: ["--a", "--b", "--c"]
                })
            })

            it("rejects `--__` at parse time", () => {
                const argv = "--__".split(" ")
                expectParseError(
                    () => argvex({ argv }),
                    ErrorCode.RESERVED_KEYWORD,
                    "--__"
                )
            })

            it("types `__` as `string[]`", () => {
                const schema = { decaf: { arity: 0 } } as const
                const result = argvex({ argv: [], schema })
                const unknowns: string[] = result.__
                expect(unknowns).toStrictEqual([])
            })
        })
    })

    context("edge cases", () => {
        context("malformed input", () => {
            it.each([
                ["--=2xl", "brewer --=2xl"],
                ["-", "brewer -"],
                ["-=xl", "brewer -=xl"],
                ["---flag", "---flag"],
                ["----deep", "----deep"],
                ["--=", "--="]
            ])("throws INVALID_INPUT for `%s`", (token, input) => {
                expectParseError(
                    () => argvex({ argv: input.split(" ") }),
                    ErrorCode.INVALID_INPUT,
                    token
                )
            })

            it("throws `RESERVED_NAME` for `--_`", () => {
                const argv = "--_ value pos1".split(" ")
                expectParseError(
                    () => argvex({ argv }),
                    ErrorCode.RESERVED_KEYWORD,
                    "--_"
                )
            })
        })

        context("special values", () => {
            it("parses hyphenated flag names", () => {
                const argv = "--dry-roast --grind-size fine".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    "dry-roast": [],
                    "grind-size": ["fine"]
                })
            })

            it("parses single-character long flag as a regular flag", () => {
                const argv = "--d".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    d: []
                })
            })
        })

        context("delimiter behavior", () => {
            it("treats everything after `--` as positional", () => {
                const argv = "-- --decaf -s xl".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["--decaf", "-s", "xl"],
                    __: []
                })
            })

            it("treats second `--` as literal positional", () => {
                const argv = "-- latte -- espresso".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["latte", "--", "espresso"],
                    __: []
                })
            })

            it("handles `--` with nothing after it", () => {
                const argv = "--".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: []
                })
            })
        })

        context("prototype pollution", () => {
            it.each([
                "constructor",
                "toString",
                "__proto__",
                "valueOf",
                "hasOwnProperty"
            ])("parses `%s` as flag name without crashing", (name) => {
                const argv = [`--${name}`, "val"]
                expect(argvex({ argv })).toEqual({
                    _: [],
                    __: [],
                    [name]: ["val"]
                })
            })
        })
    })

    context("schema validation", () => {
        context("alias rules", () => {
            it("throws `INVALID_SCHEMA` for multi-character alias", () => {
                expectParseError(
                    () =>
                        argvex({
                            argv: [],
                            schema: { verbose: { alias: "verb" } }
                        }),
                    ErrorCode.INVALID_SCHEMA,
                    "verbose"
                )
            })

            it("throws `INVALID_SCHEMA` for empty string alias", () => {
                expectParseError(
                    () =>
                        argvex({
                            argv: [],
                            schema: { verbose: { alias: "" } }
                        }),
                    ErrorCode.INVALID_SCHEMA,
                    "verbose"
                )
            })

            it("throws `INVALID_SCHEMA` for duplicate alias across entries", () => {
                expectParseError(
                    () =>
                        argvex({
                            argv: [],
                            schema: {
                                verbose: { alias: "v" },
                                version: { alias: "v" }
                            }
                        }),
                    ErrorCode.INVALID_SCHEMA,
                    "version"
                )
            })

            it("throws `INVALID_SCHEMA` when alias collides with another flag name", () => {
                expectParseError(
                    () =>
                        argvex({
                            argv: [],
                            schema: { verbose: { alias: "v" }, v: {} }
                        }),
                    ErrorCode.INVALID_SCHEMA
                )
            })

            it("accepts a single-character alias", () => {
                expect(() =>
                    argvex({ argv: [], schema: { verbose: { alias: "v" } } })
                ).not.toThrowError()
            })

            it.each([
                "_",
                "-",
                "=",
                " "
            ])("throws INVALID_SCHEMA for alias `%s`", (alias) => {
                expectParseError(
                    () =>
                        argvex({
                            argv: [],
                            schema: { verbose: { alias } }
                        }),
                    ErrorCode.INVALID_SCHEMA,
                    "verbose"
                )
            })
        })

        context("arity rules", () => {
            it.each([
                ["negative", -1],
                ["NaN", NaN],
                ["fractional", 1.5],
                ["-Infinity", -Infinity]
            ])("throws INVALID_SCHEMA for %s arity", (_label, arity) => {
                expectParseError(
                    () =>
                        argvex({
                            argv: [],
                            schema: { flag: { arity } }
                        }),
                    ErrorCode.INVALID_SCHEMA,
                    "flag"
                )
            })

            it("accepts zero arity", () => {
                expect(() =>
                    argvex({ argv: [], schema: { verbose: { arity: 0 } } })
                ).not.toThrowError()
            })
        })

        context("reserved names", () => {
            it("throws `INVALID_SCHEMA` for schema key `_`", () => {
                expectParseError(
                    () => argvex({ argv: [], schema: { _: { arity: 1 } } }),
                    ErrorCode.INVALID_SCHEMA,
                    "_"
                )
            })

            it("throws `INVALID_SCHEMA` for schema key `__`", () => {
                expectParseError(
                    () => argvex({ argv: [], schema: { __: { arity: 0 } } }),
                    ErrorCode.INVALID_SCHEMA,
                    "__"
                )
            })
        })

        context("invalid keys", () => {
            it.each([
                ["empty string", ""],
                ["containing =", "foo=bar"],
                ["starting with -", "-flag"],
                ["starting with --", "--double"]
            ])("throws INVALID_SCHEMA for key %s", (_label, key) => {
                expectParseError(
                    () =>
                        argvex({
                            argv: [],
                            schema: { [key]: { arity: 1 } }
                        }),
                    ErrorCode.INVALID_SCHEMA,
                    key
                )
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
        it("has typed keys with `as const` schema", () => {
            const schema = {
                decaf: { arity: 0 },
                size: { arity: 1 }
            } as const
            const argv = "--decaf --size xl".split(" ")
            const result = argvex({ argv, schema })
            const v: string[] | undefined = result.decaf
            const s: string[] | undefined = result.size
            const u: string[] = result.__
            expect(v).toStrictEqual([])
            expect(s).toStrictEqual(["xl"])
            expect(u).toStrictEqual([])
            // @ts-expect-error -- unknown keys should be a type error with literal schema
            result.anything
        })

        it("has index signature when no schema is provided", () => {
            const argv = "--roast dark".split(" ")
            const result = argvex({ argv })
            const val: string[] | undefined = result.roast
            expect(val).toStrictEqual(["dark"])
        })
    })
})

describe("ParseError", () => {
    it("has `name` 'ParseError' and `toString` starts with it", () => {
        const argv = "--_".split(" ")
        try {
            argvex({ argv })
            expect.unreachable("should have thrown")
        } catch (error) {
            expect(error).toBeInstanceOf(ParseError)
            expect((error as ParseError).name).toBe("ParseError")
            expect((error as Error).toString()).toMatch(/^ParseError:/)
        }
    })
})

function context(description: string, block: () => void): void {
    describe(description, block)
}

const expectParseError = (
    fn: () => unknown,
    code: ErrorCode,
    argument?: string
) => {
    try {
        fn()
        expect.unreachable("should have thrown")
    } catch (error) {
        expect(error).toBeInstanceOf(ParseError)
        expect((error as ParseError).code).toBe(code)
        if (argument != null) {
            expect((error as ParseError).argument).toBe(argument)
        }
    }
}
