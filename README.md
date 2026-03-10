<div align="center">

[![license](https://img.shields.io/npm/l/argvex.svg)](https://github.com/mzpkdev/argvex/blob/master/LICENSE)
[![npm version](https://img.shields.io/npm/v/argvex.svg)](https://www.npmjs.com/package/argvex)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![bundle size](https://img.shields.io/bundlephobia/min/argvex)](https://bundlephobia.com/result?p=argvex)

</div>
<br>
<br>

<p align="center">
  <img src="./.github/assets/main-banner.gif" height="160" align="center" />
  <p align="center">
    <strong>argvex</strong> — a CLI argument parser with a predictable output shape
    <br />
    <br />
    <a href="#getting-started"><strong>Explore the API »</strong></a>
    <br />
    <br />
    <a href="https://github.com/mzpkdev/argvex/issues">Report a bug</a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="https://github.com/mzpkdev/argvex/issues">Request a feature</a>
  </p>
<br />
<br />

Table of Contents
------------------

* [Why argvex?](#why-argvex)
* [Core Principles](#core-principles)
* [Key Features](#key-features)
* [Getting Started](#getting-started)
  * [Install](#install)
  * [Basic Usage](#basic-usage)
  * [Short Flags & Groups](#short-flags--groups)
  * [Value Assignment with `=`](#value-assignment-with-)
  * [End-of-Options `--`](#end-of-options---)
  * [Custom argv](#custom-argv)
* [Schema](#schema)
  * [Aliases](#aliases)
  * [Arity](#arity)
  * [Unknown Flags (`__`)](#unknown-flags-__)
* [TypeScript](#typescript)
* [Common Patterns](#common-patterns)
  * [Boolean flags](#boolean-flags)
  * [Required flags](#required-flags)
  * [Default values](#default-values)
  * [Value coercion](#value-coercion)
  * [`--no-*` negation](#--no--negation)
  * [Error handling](#error-handling)

Why argvex?
------------

Most parsers guess your types for you.

```sh
app --verbose --count 5 -abc --no-ding --name hello
```

**minimist** / **mri** — type roulette:

```js
{
  _: [],
  verbose: true,       // boolean
  count: 5,            // number
  a: true, b: true, c: true,  // booleans
  ding: false,         // negated boolean
  name: "hello"        // string
}
// Return type: string | number | boolean — depends on the value
```

**arg** — schema required, throws on unknowns:

```js
// Must define every flag upfront with coercion functions
const args = arg({ "--verbose": Boolean, "--count": Number, "--name": String })
// Unknown flags throw: "Unknown or unexpected option: --no-ding"
// Return type: string | number | boolean — depends on the coercion function
```

**argvex** — every flag is `string[]`, always:

```js
{
  _: [],
  __: [],
  verbose: [],             // present, no value
  count: [ "5" ],          // string, your app decides if it's a number
  a: [], b: [], c: [],     // present, no value
  "no-ding": [],           // it's a flag called "no-ding", not magic
  name: [ "hello" ]        // string
}
// Return type: string[] — every flag, every time
```

No guessing. No coercion. No `typeof args.count === "number" || typeof args.count === "string"` defensive checks.
You get a consistent shape, and your application decides what it means.

Core Principles
----------------

- **Predictable output** — every flag is `string[]`, every time. No type guessing, no coercion, no surprises.
- **Parse, don't interpret** — argvex structures your argv. Your app decides what `--verbose` or `--count 5` means.
- **Schema when you need it** — works raw out of the box. Add a schema for aliases, arity control, and unknown-flag detection.

<div align="center">

Key Features
-------------

<table>
  <tbody>
    <tr>
      <td>🚀 Zero dependencies</td>
      <td>One file. Fast. No tree bloat.</td>
    </tr>
    <tr>
      <td>🔮 Predictable shape</td>
      <td>Every flag is <code>string[]</code>. Always.</td>
    </tr>
    <tr>
      <td>🔌 Schema-optional</td>
      <td>Works raw out of the box. Add constraints when you need them.</td>
    </tr>
    <tr>
      <td>🐚 UNIX philosophy</td>
      <td>Do one thing well. Stay composable.</td>
    </tr>
    <tr>
      <td>💙 TypeScript</td>
      <td>Full type inference from your schema.</td>
    </tr>
  </tbody>
</table>

</div>

Getting Started
----------------

### Install

```shell
npm install argvex
```

### Basic Usage

Call `argvex()` to get structured `process.argv` output.

```sh
brewer brew espresso --size medium --shots 3 --milk none
```
```typescript
import argvex from "argvex"

const args = argvex()
// args -> { _: [ "brewer", "brew", "espresso" ], __: [], size: [ "medium" ], shots: [ "3" ], milk: [ "none" ] }
```

`_` is the positionals array — commands, subcommands, file paths, bare words, and everything after `--`.

**Note:** Without a schema, every flag greedily consumes all following tokens until the next flag-like token (anything starting with `-`) or `--` is encountered. This means `--output file.txt input.txt` will assign both `file.txt` and `input.txt` to the `output` flag, not treat `input.txt` as a positional. To control this, use a schema with `arity` — see [Arity](#arity).

### Short Flags & Groups

Standalone short flags and groups.

```sh
brewer brew americano -qs -m water -t 85
```
```typescript
import argvex from "argvex"

const args = argvex()
// args -> { _: [ "brewer", "brew", "americano" ], __: [], q: [], s: [], m: [ "water" ], t: [ "85" ] }
```

### Value Assignment with `=`

Long flags and short flags both support `=` syntax.

```sh
brewer brew latte --size=large -m=oat
```
```typescript
import argvex from "argvex"

const args = argvex()
// args -> { _: [ "brewer", "brew", "latte" ], __: [], size: [ "large" ], m: [ "oat" ] }
```

This works with grouped flags too — the value is assigned to the last flag in the group.

```sh
brewer brew latte -ds=medium
```
```typescript
import argvex from "argvex"

const args = argvex()
// args -> { _: [ "brewer", "brew", "latte" ], __: [], d: [], s: [ "medium" ] }
```

### End-of-Options `--`

Use `--` to separate flags from operands that might look like flags.

```sh
brewer brew --milk oat -- --not-a-flag latte
```
```typescript
import argvex from "argvex"

const args = argvex()
// args -> { _: [ "brewer", "brew", "--not-a-flag", "latte" ], __: [], milk: [ "oat" ] }
```

### Custom argv

By default `argvex` reads from `process.argv.slice(2)`. Pass `argv` to parse any string array — useful for testing, subcommand delegation, or piping parsed chunks between handlers.

```typescript
import argvex from "argvex"

const args = argvex({ argv: ["--size", "large", "--shots", "2"] })
// args -> { _: [], __: [], size: [ "large" ], shots: [ "2" ] }
```

Schema
-------

Pass a schema to enable aliases, control arity, and detect unknown flags.

### Aliases

Map short flags to long flag names. Aliases accept exactly one character.

```sh
brewer brew mocha -d -m oat -c dark
```
```typescript
import argvex from "argvex"

const schema = {
  decaf: { alias: "d" },
  milk: { alias: "m" },
  chocolate: { alias: "c" }
}
const args = argvex({ schema })
// args -> { _: [ "brewer", "brew", "mocha" ], __: [], decaf: [], milk: [ "oat" ], chocolate: [ "dark" ] }
```

### Arity

`arity` controls how many values a flag consumes from the argument stream.

```sh
brewer brew -dsmedium -h2 macchiato
```
```typescript
import argvex from "argvex"

const schema = {
  decaf: { alias: "d", arity: 0 },
  size: { alias: "s", arity: 1 },
  shots: { alias: "h", arity: 1 },
}
const args = argvex({ schema })
// args -> { _: [ "brewer", "brew", "macchiato" ], __: [], decaf: [], size: [ "medium" ], shots: [ "2" ] }
```

Repeating a flag accumulates values — each invocation appends to the same key.

```sh
brewer brew flat-white --milk steamed --milk foamed --milk microfoam
```
```typescript
import argvex from "argvex"

const schema = {
  milk: { arity: 1 },
}
const args = argvex({ schema })
// args -> { _: [ "brewer", "brew", "flat-white" ], __: [], milk: [ "steamed", "foamed", "microfoam" ] }
```

A single flag with higher arity consumes multiple tokens in one shot:

```sh
brewer brew flat-white --milk steamed foamed microfoam
```
```typescript
import argvex from "argvex"

const schema = {
  milk: { arity: 3 },
}
const args = argvex({ schema })
// args -> { _: [ "brewer", "brew", "flat-white" ], __: [], milk: [ "steamed", "foamed", "microfoam" ] }
```

The `=` syntax (`--flag=value`) bypasses arity — the value is embedded in the token, not consumed from the stream. This means `--verbose=true` assigns `"true"` regardless of its arity setting — even `arity: 0`.

```sh
brewer brew espresso --verbose=true
```
```typescript
import argvex from "argvex"

const schema = {
  verbose: { arity: 0 },
}
const args = argvex({ schema })
// args -> { _: [ "brewer", "brew", "espresso" ], __: [], verbose: [ "true" ] }
```

### Unknown Flags (`__`)

When a schema is provided, any flag not defined in the schema is collected in `__` as raw strings — dashes, `=` values and all. The parser does not consume any following arguments for unknown flags.

Without a schema, `__` is always empty — every flag is accepted and parsed normally.

```sh
brewer brew espresso --verbose --output file.txt --format json -x
```
```typescript
import argvex from "argvex"

const schema = {
  verbose: { arity: 0 },
  output: { arity: 1 },
}
const args = argvex({ schema })
// args -> { _: [ "brewer", "brew", "espresso", "json" ], __: [ "--format", "-x" ], verbose: [], output: [ "file.txt" ] }
```

This gives you full control over how your CLI handles unknowns:

```typescript
// Warn and continue
if (args.__.length) {
    console.warn("Unknown flags:", args.__.join(", "))
}

// Fail hard
if (args.__.length) {
    console.error("Unknown flags:", args.__.join(", "))
    process.exit(1)
}

// Forward to another tool
if (args.__.length) {
    spawnSync("other-tool", args.__, { stdio: "inherit" })
}
```

Compare this to other parsers: minimist silently swallows unknowns into the result, mri terminates on them, and arg throws by default. argvex collects them separately so your app decides the policy.

TypeScript
-----------

argvex exports the following public types:

```typescript
import argvex, { Schema, Options, ArgvEx, ParseError, ErrorCode } from "argvex"
```

**`Schema`** — the shape of a schema definition. Use this to annotate a schema defined outside the `argvex()` call:

```typescript
import argvex, { Schema } from "argvex"

const schema: Schema = {
  size: { alias: "s", arity: 1 },
  shots: { alias: "h", arity: 1 },
  decaf: { alias: "d", arity: 0 },
}
const args = argvex({ schema })
```

**`Options`** — the input shape passed to `argvex()`:

```typescript
import argvex, { Options } from "argvex"

const options: Options = {
  argv: ["--size", "large"],
  schema: { size: { arity: 1 } },
}
const args = argvex(options)
```

**`ArgvEx`** — the return type of `argvex()`. Every flag is `string[]`, plus `_` for positionals and `__` for unknown flags:

```typescript
import argvex, { ArgvEx } from "argvex"

const args: ArgvEx = argvex()
```

**`ParseError`** and **`ErrorCode`** — see [Error handling](#error-handling).

Common Patterns
----------------

argvex gives you raw parsed data — defaults, coercion, and validation are yours to define.

#### Boolean flags

Flags without values are present as empty arrays. Check presence, not truthiness.

```typescript
const args = argvex()

const verbose = args.verbose !== undefined
const debug = !!args.debug
```

#### Required flags

```typescript
const args = argvex()

if (!args.output) {
    console.error("Missing required flag: --output")
    process.exit(1)
}
```

#### Default values

```typescript
const args = argvex()

const milk = args.milk?.[0] ?? "steamed"
const shots = Number(args.shots?.[0] ?? "2")
```

#### Value coercion

```typescript
const args = argvex()

const ports = args.port?.map(Number) ?? []
const tags = args.tag ?? []
```

#### `--no-*` negation

Define it as a regular flag. No magic, no implicit boolean flip.

```typescript
const schema = {
  color: { arity: 0 },
  "no-color": { arity: 0 },
}
const args = argvex({ schema })

const useColor = !args["no-color"]
```

#### Error handling

```typescript
import argvex, { ParseError } from "argvex"

try {
    const args = argvex()
    // process args
} catch (error) {
    if (error instanceof ParseError) {
        console.error(error.code, error.argument)
        process.exit(1)
    }
    throw error
}
```

`ParseError` exposes two structured properties alongside the human-readable `.message`:

| Property | Type | Description |
|---|---|---|
| `.code` | `ErrorCode` | Machine-readable error code (see below) |
| `.argument` | `string` | The raw token or schema key that caused the error |

**Error codes:**

| Code | Thrown when |
|---|---|
| `INVALID_INPUT` | A malformed argument is encountered (e.g. `---triple-dash`) |
| `INVALID_SCHEMA` | A schema definition is invalid (bad alias, reserved name, etc.) |
| `RESERVED_KEYWORD` | A flag named `_` or `__` is passed (conflicts with reserved keys) |
