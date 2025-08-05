import { describe, it, expect } from "vitest"
import argvex, { ArgvexError } from "./index"


describe(`argvex without schema`, () => {
    it(`should parse an empty command`, () => {
        const command = ``
        expect(argvex({ command }))
            .toStrictEqual({
                _: []
            })
    })

    it(`should support end-of-options delimiter`, () => {
        const command = `brewer make --milk oat -- latte --not-a-flag`
        expect(argvex({ command }))
            .toStrictEqual({
                _: [ "brewer", "make", "latte", "--not-a-flag" ],
                milk: [ "oat" ]
            })
    })

    it(`should parse operands and long flags`, () => {
        const command = `brewer make latte --decaf --size xl --shots 2 --milk oat`
        expect(argvex({ command }))
            .toStrictEqual({
                _: [ "brewer", "make", "latte" ],
                decaf: [],
                size: [ "xl" ],
                shots: [ "2" ],
                milk: [ "oat" ]
            })
    })

    it(`should parse operands and long flags using "=" for assigning a single value`, () => {
        const command = `brewer make --decaf --size=xl --shots=2 --milk=oat latte`
        expect(argvex({ command }))
            .toStrictEqual({
                _: [ "brewer", "make", "latte" ],
                decaf: [],
                size: [ "xl" ],
                shots: [ "2" ],
                milk: [ "oat" ]
            })
    })

    it(`should parse operands and short flags`, () => {
        const command = `brewer make latte -d -s xl -h 2 -m oat`
        expect(argvex({ command }))
            .toStrictEqual({
                _: [ "brewer", "make", "latte" ],
                d: [],
                s: [ "xl" ],
                h: [ "2" ],
                m: [ "oat" ]
            })
    })

    it(`should parse operands and flags grouping`, () => {
        const command = `brewer make latte -qvd`
        expect(argvex({ command }))
            .toStrictEqual({
                _: [ "brewer", "make", "latte" ],
                q: [],
                v: [],
                d: []
            })
    })

    it(`should parse operands and mix of long and short flags`, () => {
        const command = `brewer make latte -ds xl --shots=2 --milk oat`
        expect(argvex({ command }))
            .toStrictEqual({
                _: [ "brewer", "make", "latte" ],
                d: [],
                s: [ "xl" ],
                shots: [ "2" ],
                milk: [ "oat" ]
            })
    })

    it(`should parse flags only`, () => {
        const command = `--decaf --size xl`
        expect(argvex({ command }))
            .toStrictEqual({
                _: [],
                decaf: [],
                size: [ "xl" ],
            })
    })
})

describe(`argvex with schema`, () => {
    const schema = [
        { name: "version", alias: "v", arity: 0 },
        { name: "decaf", alias: "d", arity: 0 },
        { name: "size", alias: "s", arity: 1 },
        { name: "shots", alias: "h", arity: 1 },
        { name: "milk", alias: "m", arity: 3 },
        { name: "name", alias: "n", arity: 1 }
    ]

    it(`should assign that many values to flag as specified in schema`, () => {
        const command = `brewer make --decaf no --size xs --shots 0 --milk oat almond cow latte`
        expect(argvex({ command, schema }))
            .toStrictEqual({
                _: [ "brewer", "make", "no", "latte" ],
                decaf: [],
                size: [ "xs" ],
                shots: [ "0" ],
                milk: [ "oat", "almond", "cow" ]
            })
    })

    it(`should parse short flags as aliases`, () => {
        const command = `brewer make -d no -s xs -h 0 -m oat almond cow latte`
        expect(argvex({ command, schema }))
            .toStrictEqual({
                _: [ "brewer", "make", "no", "latte" ],
                decaf: [],
                size: [ "xs" ],
                shots: [ "0" ],
                milk: [ "oat", "almond", "cow" ]
            })
    })

    it(`should be able to parse a single inline argument`, () => {
        const command = `brewer make -vdnMatthew latte`
        expect(argvex({ command, schema }))
            .toStrictEqual({
                _: [ "brewer", "make", "latte" ],
                version: [],
                decaf: [],
                name: [ "Matthew" ]
            })
    })

    it(`should throw an error if a long flag is not present in the schema`, () => {
        const command = `brewer make latte --decaf --size xs --shots 0 --milk almond --tea black`
        expect(() => argvex({ command, schema, strict: true }))
            .toThrowError(ArgvexError)
        expect(() => argvex({  command, schema, strict: true  }))
            .toThrowError(`Argument "--tea" is unrecognized or misplaced.`)
    })

    it(`should throw an error if a short flag is not present in the schema`, () => {
        const command = `brewer make latte -uds xs --shots 0 --milk almond`
        expect(() => argvex({ command, schema, strict: true }))
            .toThrowError(ArgvexError)
        expect(() => argvex({  command, schema, strict: true  }))
            .toThrowError(`Argument "-u" is unrecognized or misplaced.`)
    })

    it(`should not throw an error if all flags are present in the schema`, () => {
        const command = `brewer make latte --decaf --size xs --shots 0 --milk almond`
        expect(() => argvex({ command, schema, strict: true }))
            .not.toThrowError(ArgvexError)
    })

    it(`should support additive accumulation of flags`, () => {
        const command = `brewer make latte --milk oat --milk=almond -mcow`
        expect(argvex({ command, schema, additive: true }))
            .toStrictEqual({
                _: [ "brewer", "make", "latte" ],
                milk: [ "oat", "almond", "cow" ]
            })
    })
})

describe(`argvex edge cases`, () => {
    it(`should throw when parsing long flag without a name`, () => {
        const command = `brewer --=2xl`
        expect(() => argvex({ command }))
            .toThrowError(ArgvexError)
        expect(() => argvex({ command }))
            .toThrowError(`Argument "--=2xl" is unrecognized or misplaced.`)
    })

    it(`should throw when parsing short flag without a name`, () => {
        const command = `brewer -`
        expect(() => argvex({ command }))
            .toThrowError(ArgvexError)
        expect(() => argvex({ command }))
            .toThrowError(`Argument "-" is unrecognized or misplaced.`)
    })
})