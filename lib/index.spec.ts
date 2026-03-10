import { expectTypeOf } from "vitest"
import argvex from "./index"
import { ErrorCode, ParseError } from "./ParseError"

const expectParseError = (
    fn: () => unknown,
    code: ErrorCode,
    argument?: string
) => {
    try {
        fn()
        expect.unreachable("expected ParseError to be thrown")
    } catch (error) {
        expect(error).toBeInstanceOf(ParseError)
        const parseError = error as ParseError
        expect(parseError.code).toBe(code)
        if (argument != null) {
            expect(parseError.argument).toBe(argument)
        }
    }
}

describe("argvex", () => {
    context("with no input", () => {
        it("returns empty positionals and rest", () => {
            expect(argvex({ argv: [] })).toStrictEqual({
                _: [],
                __: []
            })
        })
    })

    context("with positional arguments", () => {
        it("collects them as positionals", () => {
            const argv = "brewer make latte".split(" ")
            expect(argvex({ argv })).toStrictEqual({
                _: ["brewer", "make", "latte"],
                __: []
            })
        })

        it("treats an empty string as a positional", () => {
            const argv = [""]
            expect(argvex({ argv })).toStrictEqual({
                _: [""],
                __: []
            })
        })
    })

    context("with flags", () => {
        context("that are long", () => {
            it("separates positionals from flags", () => {
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

            it("consumes the next token as the flag's value", () => {
                const argv = "latte --decaf espresso".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["latte"],
                    __: [],
                    decaf: ["espresso"]
                })
            })

            it("treats a standalone flag as boolean-like", () => {
                const argv = "--decaf --size xl".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    decaf: [],
                    size: ["xl"]
                })
            })

            it("accumulates values when a flag repeats", () => {
                const argv = "--milk oat --milk almond".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    milk: ["oat", "almond"]
                })
            })

            it("starts a new flag when the next token looks like a flag", () => {
                const argv = "--name --blend".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    name: [],
                    blend: []
                })
            })

            it("treats `-N` after a long flag as a short flag, not a value", () => {
                const argv = "--shots -5".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    shots: [],
                    5: []
                })
            })
        })

        context("that are short", () => {
            it("separates positionals from short flags", () => {
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

        context("in groups", () => {
            it("expands each character into its own flag", () => {
                const argv = "brewer make latte -qvd".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer", "make", "latte"],
                    __: [],
                    q: [],
                    v: [],
                    d: []
                })
            })

            it("mixes short flag groups with long flags", () => {
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
    })

    context("with = syntax", () => {
        context("on a long flag", () => {
            it("assigns the value after =", () => {
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

            it("splits on the first = only", () => {
                const argv = "--size=2xl=big".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    size: ["2xl=big"]
                })
            })

            it("treats an empty right-hand side as the value", () => {
                const argv = "--size=".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    size: [""]
                })
            })
        })

        context("on a short flag", () => {
            it("assigns the value after =", () => {
                const argv = "brewer -s=xl".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer"],
                    __: [],
                    s: ["xl"]
                })
            })

            it("assigns the = value to the last flag in a group", () => {
                const argv = "brewer -ab=xl".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer"],
                    __: [],
                    a: [],
                    b: ["xl"]
                })
            })

            it("treats an empty right-hand side as the value", () => {
                const argv = "brewer -s=".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: ["brewer"],
                    __: [],
                    s: [""]
                })
            })
        })
    })

    context("with the -- delimiter", () => {
        it("sends everything after `--` to positionals", () => {
            const argv = "brewer make --milk oat -- latte --not-a-flag".split(
                " "
            )
            expect(argvex({ argv })).toStrictEqual({
                _: ["brewer", "make", "latte", "--not-a-flag"],
                __: [],
                milk: ["oat"]
            })
        })

        it("disables all flag parsing when `--` leads", () => {
            const argv = "-- --decaf -s xl".split(" ")
            expect(argvex({ argv })).toStrictEqual({
                _: ["--decaf", "-s", "xl"],
                __: []
            })
        })

        it("treats a second `--` as a literal positional", () => {
            const argv = "-- latte -- espresso".split(" ")
            expect(argvex({ argv })).toStrictEqual({
                _: ["latte", "--", "espresso"],
                __: []
            })
        })

        it("returns empty result when `--` is the only token", () => {
            const argv = "--".split(" ")
            expect(argvex({ argv })).toStrictEqual({
                _: [],
                __: []
            })
        })
    })

    context("with flag name edge cases", () => {
        context("hyphenated and single-character names", () => {
            it("parses hyphenated flag names", () => {
                const argv = "--dry-roast --grind-size fine".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    "dry-roast": [],
                    "grind-size": ["fine"]
                })
            })

            it("parses a single-character long flag", () => {
                const argv = "--d".split(" ")
                expect(argvex({ argv })).toStrictEqual({
                    _: [],
                    __: [],
                    d: []
                })
            })
        })

        context("prototype-inherited names", () => {
            it.each([
                "constructor",
                "toString",
                "__proto__",
                "valueOf",
                "hasOwnProperty"
            ])("safely parses `%s` without pollution", (name) => {
                const argv = [`--${name}`, "val"]
                expect(argvex({ argv })).toEqual({
                    _: [],
                    __: [],
                    [name]: ["val"]
                })
            })
        })
    })

    context("with a schema", () => {
        context("and arity 0", () => {
            it("does not consume the next token as a value", () => {
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

            it("lets positionals flow around it freely", () => {
                const schema = { decaf: { arity: 0 } }
                const argv = "latte --decaf espresso".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["latte", "espresso"],
                    __: [],
                    decaf: []
                })
            })
        })

        context("and finite arity", () => {
            it("consumes exactly N values per occurrence", () => {
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

            it.each([
                [
                    1,
                    { roast: { arity: 1 } },
                    "--roast light --roast medium --roast dark",
                    { roast: ["light", "medium", "dark"] }
                ],
                [
                    3,
                    { milk: { arity: 3 } },
                    "--milk oat almond cow --milk steamed whole skim",
                    {
                        milk: [
                            "oat",
                            "almond",
                            "cow",
                            "steamed",
                            "whole",
                            "skim"
                        ]
                    }
                ]
            ])("restarts consumption on each repeated occurrence (arity %i)", (_, schema, input, flags) => {
                expect(
                    argvex({ argv: input.split(" "), schema })
                ).toStrictEqual({
                    _: [],
                    __: [],
                    ...flags
                })
            })

            it("interrupts consumption when the same flag reappears", () => {
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

            it("interrupts consumption when a different flag appears", () => {
                const schema = { milk: { arity: 3 }, sugar: { arity: 3 } }
                const argv = "--milk oat almond --sugar none".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    milk: ["oat", "almond"],
                    sugar: ["none"]
                })
            })

            it("sends leftover values to positionals after the limit", () => {
                const schema = { milk: { arity: 1 } }
                const argv = "--milk steamed whole oat".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["whole", "oat"],
                    __: [],
                    milk: ["steamed"]
                })
            })

            it("collects nothing when the flag is the last token", () => {
                const schema = { size: { arity: 1 } }
                const argv = "--size".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    size: []
                })
            })

            it("omits flags that never appeared from the result", () => {
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
        })

        context("and infinite arity", () => {
            it("consumes all remaining non-flag tokens", () => {
                const schema = { milk: { arity: Infinity } }
                const argv = "--milk oat almond cow".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    milk: ["oat", "almond", "cow"]
                })
            })

            it("stops at a known flag", () => {
                const schema = {
                    milk: { arity: Infinity },
                    size: { arity: 1 }
                }
                const argv = "--milk oat --size xl".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    milk: ["oat"],
                    size: ["xl"]
                })
            })
        })

        context("and alias resolution", () => {
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

        context("and short flag groups", () => {
            it("consumes the remainder as inline value after arity-0 flags", () => {
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

            it("extracts a single inline value from a mixed group", () => {
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

            it("consumes the remainder as value for a mid-group arity flag", () => {
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

            it("gives the `=` value to the last flag when a group ends with `=`", () => {
                const schema = { d: { arity: 1 }, s: { arity: 1 } }
                const argv = "-ds=oat".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    d: [],
                    s: ["oat"]
                })
            })

            it("uses the leading character as the inline value when the first flag has arity", () => {
                const schema = { d: { arity: 1 }, s: { arity: 1 } }
                const argv = "-ds medium".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["medium"],
                    __: [],
                    d: ["s"]
                })
            })

            it("uses remaining characters as value for a repeated flag", () => {
                const schema = { s: { arity: 1 } }
                const argv = "-sss medium".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["medium"],
                    __: [],
                    s: ["ss"]
                })
            })

            it("collapses a repeated arity-0 flag in a group into a single entry", () => {
                const schema = { d: { arity: 0 } }
                const argv = "-ddd latte".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["latte"],
                    __: [],
                    d: []
                })
            })

            it("resolves alias and assigns the = value", () => {
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
        })

        context("where = interacts with arity", () => {
            it("accumulates values across positional, `=`, and inline syntaxes", () => {
                const schema = { size: { alias: "s", arity: 1 } }
                const argv = "--size xl --size=md -sxs".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    size: ["xl", "md", "xs"]
                })
            })

            it("resets arity when `=` is used", () => {
                const schema = { milk: { arity: 3 } }
                const argv = "--milk=oat --milk steamed whole".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    milk: ["oat", "steamed", "whole"]
                })
            })

            it("does not consume trailing tokens after `=` assignment", () => {
                const schema = { milk: { arity: 3 } }
                const argv = "--milk=oat latte".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["latte"],
                    __: [],
                    milk: ["oat"]
                })
            })

            it("preserves arity across repeated `=` assignments", () => {
                const schema = { milk: { arity: 3 } }
                const argv = "--milk=oat --milk=almond --milk=cow".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    milk: ["oat", "almond", "cow"]
                })
            })

            it("forces a value on a long flag even when arity is `0`", () => {
                const schema = { decaf: { arity: 0 } }
                const argv = "--decaf=true".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    decaf: ["true"]
                })
            })

            it("forces a value on a short flag even when arity is `0`", () => {
                const schema = { decaf: { alias: "d", arity: 0 } }
                const argv = "-d=true".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: [],
                    decaf: ["true"]
                })
            })
        })

        context("and the -- delimiter", () => {
            it("sends everything after `--` to positionals", () => {
                const schema = { add: { arity: 1 }, roast: { arity: 1 } }
                const argv = "--add oat -- --roast dark".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["--roast", "dark"],
                    __: [],
                    add: ["oat"]
                })
            })

            it("cuts off arity consumption at `--`", () => {
                const schema = { milk: { arity: 3 } }
                const argv = "--milk oat -- almond".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["almond"],
                    __: [],
                    milk: ["oat"]
                })
            })

            it("stops at the `--` delimiter", () => {
                const schema = { milk: { arity: Infinity } }
                const argv = "--milk oat -- rest".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["rest"],
                    __: [],
                    milk: ["oat"]
                })
            })
        })

        context("and unknown flags", () => {
            it("sends an unknown long flag to `__`", () => {
                const schema = { size: { arity: 2 } }
                const argv = "--size xl xs --unknown".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["--unknown"],
                    size: ["xl", "xs"]
                })
            })

            it("routes to `__` regardless of position in argv", () => {
                const schema = { size: { arity: 2 } }
                const argv = "--unknown --size xl xs".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["--unknown"],
                    size: ["xl", "xs"]
                })
            })

            it("sends an unknown short flag to `__`", () => {
                const schema = {}
                const argv = "-x".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["-x"]
                })
            })

            it("sends an unknown long flag with `=` verbatim to `__`", () => {
                const schema = {}
                const argv = "--unknown=foo".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["--unknown=foo"]
                })
            })

            it("sends an unknown short flag with `=` verbatim to `__`", () => {
                const schema = {}
                const argv = "-x=val".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["-x=val"]
                })
            })

            it("splits known and unknown flags within a group", () => {
                const schema = { d: { arity: 0 }, m: { arity: 0 } }
                const argv = "-dxm".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["-x"],
                    d: [],
                    m: []
                })
            })

            it("does not consume values for an unknown long flag", () => {
                const schema = { roast: { arity: 1 } }
                const argv = "--unknown oat --roast dark".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["oat"],
                    __: ["--unknown"],
                    roast: ["dark"]
                })
            })

            it("does not consume values for an unknown short flag", () => {
                const schema = { size: { arity: 1 } }
                const argv = "-u oat --size xl".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["oat"],
                    __: ["-u"],
                    size: ["xl"]
                })
            })

            it("collects all unrecognized flags into `__`", () => {
                const schema = {}
                const argv = "--a --b --c".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["--a", "--b", "--c"]
                })
            })

            it("interrupts arity consumption at an unknown flag", () => {
                const schema = { size: { arity: 2 } }
                const argv = "--unknown oat --size xl --unknown medium".split(
                    " "
                )
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: ["oat", "medium"],
                    __: ["--unknown", "--unknown"],
                    size: ["xl"]
                })
            })

            it("stops at an unknown flag", () => {
                const schema = { milk: { arity: Infinity } }
                const argv = "--milk oat --unknown".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["--unknown"],
                    milk: ["oat"]
                })
            })

            it("sends `-N` to `__` instead of treating it as a value", () => {
                const schema = { shots: { arity: 1 } }
                const argv = "--shots -5".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["-5"],
                    shots: []
                })
            })

            it("sends an unknown long flag to `__` despite remaining arity", () => {
                const schema = { name: { arity: 1 } }
                const argv = "--name --unknown".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["--unknown"],
                    name: []
                })
            })

            it("sends an unknown short flag to `__` despite remaining arity", () => {
                const schema = { shots: { alias: "h", arity: 1 } }
                const argv = "-h -5".split(" ")
                expect(argvex({ argv, schema })).toStrictEqual({
                    _: [],
                    __: ["-5"],
                    shots: []
                })
            })
        })
    })

    context("given malformed argv tokens", () => {
        it.each([
            ["--=2xl", "brewer --=2xl"],
            ["-", "brewer -"],
            ["-=xl", "brewer -=xl"],
            ["---flag", "---flag"],
            ["----deep", "----deep"],
            ["--=", "--="]
        ])("throws `INVALID_INPUT` for `%s`", (token, input) => {
            expectParseError(
                () => argvex({ argv: input.split(" ") }),
                ErrorCode.INVALID_INPUT,
                token
            )
        })

        it("throws `RESERVED_KEYWORD` for `--_`", () => {
            const argv = "--_ value pos1".split(" ")
            expectParseError(
                () => argvex({ argv }),
                ErrorCode.RESERVED_KEYWORD,
                "--_"
            )
        })

        it("throws `RESERVED_KEYWORD` for `--__`", () => {
            const argv = "--__".split(" ")
            expectParseError(
                () => argvex({ argv }),
                ErrorCode.RESERVED_KEYWORD,
                "--__"
            )
        })
    })

    context("given an invalid schema", () => {
        context("when a key is invalid", () => {
            it.each([
                ["reserved key _", { _: { arity: 1 } }, "_"],
                ["reserved key __", { __: { arity: 0 } }, "__"],
                ["empty string key", { "": { arity: 1 } }, ""],
                ["key containing =", { "foo=bar": { arity: 1 } }, "foo=bar"],
                ["key starting with -", { "-flag": { arity: 1 } }, "-flag"],
                [
                    "key starting with --",
                    { "--double": { arity: 1 } },
                    "--double"
                ]
            ])("rejects %s", (_, schema, argument) => {
                expectParseError(
                    () => argvex({ argv: [], schema }),
                    ErrorCode.INVALID_SCHEMA,
                    argument
                )
            })
        })

        context("when an alias is invalid", () => {
            it.each([
                ["multi-character", { verbose: { alias: "verb" } }],
                ["empty string", { verbose: { alias: "" } }],
                ["underscore", { verbose: { alias: "_" } }],
                ["hyphen", { verbose: { alias: "-" } }],
                ["equals sign", { verbose: { alias: "=" } }],
                ["space", { verbose: { alias: " " } }]
            ])("rejects %s alias", (_, schema) => {
                expectParseError(
                    () => argvex({ argv: [], schema }),
                    ErrorCode.INVALID_SCHEMA,
                    "verbose"
                )
            })

            it("rejects duplicate alias across entries", () => {
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

            it("rejects alias that collides with another flag name", () => {
                expectParseError(
                    () =>
                        argvex({
                            argv: [],
                            schema: { verbose: { alias: "v" }, v: {} }
                        }),
                    ErrorCode.INVALID_SCHEMA
                )
            })
        })

        context("when arity is invalid", () => {
            it.each([
                ["negative", -1],
                ["NaN", NaN],
                ["fractional", 1.5],
                ["-Infinity", -Infinity]
            ])("rejects %s arity", (_, arity) => {
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
        })
    })

    context("given a valid schema", () => {
        it.each([
            [
                "aliases and arity",
                {
                    verbose: { alias: "v", arity: 0 },
                    output: { alias: "o", arity: 1 }
                }
            ],
            ["no aliases or arity", { verbose: {} }],
            ["zero arity", { verbose: { arity: 0 } }],
            ["Infinity arity", { flag: { arity: Infinity } }],
            ["single-character alias", { verbose: { alias: "v" } }]
        ])("accepts %s", (_, schema) => {
            expect(() => argvex({ argv: [], schema })).not.toThrowError()
        })
    })

    context("error formatting", () => {
        it("formats as `ParseError: ...` in `toString()`", () => {
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

    context("type inference", () => {
        it("exposes schema keys as typed properties", () => {
            const schema = {
                decaf: { arity: 0 },
                size: { arity: 1 }
            } as const
            const argv = "--decaf --size xl".split(" ")
            const result = argvex({ argv, schema })

            expectTypeOf(result.decaf).toEqualTypeOf<string[]>()
            expectTypeOf(result.size).toEqualTypeOf<string[]>()
            expectTypeOf(result.__).toEqualTypeOf<string[]>()
            expectTypeOf(result._).toEqualTypeOf<string[]>()

            expect(result.decaf).toStrictEqual([])
            expect(result.size).toStrictEqual(["xl"])
            expect(result.__).toStrictEqual([])
        })

        it("allows any flag key when no schema is provided", () => {
            const argv = "--roast dark".split(" ")
            const result = argvex({ argv })

            expectTypeOf(result.roast).toEqualTypeOf<string[]>()
            expect(result.roast).toStrictEqual(["dark"])
        })

        it("types `__` as `string[]`", () => {
            const schema = { decaf: { arity: 0 } } as const
            const result = argvex({ argv: [], schema })

            expectTypeOf(result.__).toEqualTypeOf<string[]>()
            expect(result.__).toStrictEqual([])
        })
    })
})
