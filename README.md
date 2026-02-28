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
    <strong>argvex</strong> is a lightweight and unopinionated CLI argument parser <br>  
      — just a parsing tool, not a framework
    <br />
    <br />
    <a href="#how-to-use"><strong>Explore the API »</strong></a>
    <br />
    <br />
    <a href="https://github.com/mzpkdev/argvex/issues">Report a bug</a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="https://github.com/mzpkdev/argvex/issues">Request a feature</a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="./README_ZH.md">中文</a>
  </p>
<br />
<br />

Table of Contents
------------------

* [Overview](#overview)
  * [Why argvex?](#why-argvex)
  * [Key Features](#key-features)
* [Getting started](#getting-started)
  * [How to install](#how-to-install)
  * [How to use](#how-to-use)
  * [Aliases](#aliases)
  * [POSIX-flavoured](#posix-flavoured)
  * [Repeating flags](#repeating-flags)
  * [Strict Mode](#strict-mode)
* [Examples of common patters](#examples-of-common-patters)
  * [Case with required flags](#case-with-required-flags)
  * [Case with default values](#case-with-default-values)
  * [Case with value coercion](#case-with-value-coercion)
  * [Case with error handling](#case-with-error-handling)

Overview
---------

### Why argvex?

You want to roll-your-own CLI, but argument parsing is such a headache?  
Let `argvex` handle the annoying part, and nothing else.  

`argvex` is a minimalist argument parser that stays out of your way with little to no API, 
so you can keep full control, define your own rules, and avoid framework baggage.

### Key Features

<div align="center">

<table>
  <tbody>
    <tr>
      <td>🚀 Zero dependencies</td>
      <td>One file. Fast. No tree bloat.</td>
    </tr>
    <tr>
      <td>🕹️️ Control over configuration</td>
      <td>You define behavior, types, defaults — all your choice</td>
    </tr>
    <tr>
      <td>⚙️ Zero-assumptions</td>
      <td>Everything is explicit, no coercion, no surprises.</td>
    </tr>
    <tr>
      <td>🔌 Schema-optional</td>
      <td>Works raw out of the box, add constraints only when you need it.</td>
    </tr>
    <tr>
      <td>🐚 UNIX philosophy</td>
      <td>Do one thing well, stay composable.</td>
    </tr>
    <tr>
      <td>💙 TypeScript</td>
      <td>Type definitions right out of the box.</td>
    </tr>
  </tbody>
</table>     

</div>

Getting started
----------------

`argvex` gives you a structured view of your command-line input — flags, values, 
and operands — without forcing schemas, coercion, or assumptions.

### How to install

```shell
npm install argvex
```

### How to use

You can just call `argvex()` to get structured `process.argv` output.

```sh
brewer brew espresso --size medium --shots 3 --milk none --temperature 92 --crema thick
```
```typescript
import argvex from 'argvex'

const args = argvex()
// args -> { _: [ "brewer", "brew", "espresso" ], "size": [ "medium" ], shots: [ "3" ], milk: [ "none" ], temperature: [ "92" ], crema: [ "thick" ] }
```

A GNU-flavoured value assign using "=" works too!

```sh
brewer brew cappuccino --size=large --shots=2 --milk=steamed --foam=thick
```
```typescript
import argvex from 'argvex'

const args = argvex()
// args -> { _: [ "brewer", "brew", "cappuccino" ], "size": [ "large" ], shots: [ "2" ], milk: [ "steamed" ], foam: [ "thick" ] }
```

When it comes to boolean flags, just check for their presence.

```typescript
import argvex from 'argvex'

const args = argvex()
if (!!args.decaf) {
    console.log("Making a decaf coffee!")
}
```

You can use standalone short flags or use them in groups.

```sh
brewer brew americano -qs -m water -t 85
```
```typescript
import argvex from 'argvex'

const args = argvex()
// args -> { _: [ "brewer", "brew", "americano" ], "q": [], "s": [], m: [ "water" ], t: [ "85" ] }
```

Use `--` (end-of-options delimiter) to separate flags from operands that might look like flags.

```sh
brewer brew --milk oat -- --not-a-flag latte
```
```typescript
import argvex from 'argvex'

const args = argvex()
// args -> { _: [ "brewer", "brew", "--not-a-flag", "latte" ], milk: [ "oat" ] }
```

### Aliases

While you can code your own support for aliases easily, 
`argvex` can handle those out-of-the-box if you pass a minimal schema to it.

```sh
brewer brew mocha -d -m oat -c dark
```
```typescript
import argvex from 'argvex'

const schema = [
  { name: "decaf", alias: "d" },
  { name: "milk", alias: "m" },
  { name: "chocolate", alias: "c" }
]
const args = argvex({ schema })
// args -> { _: [ "brewer", "brew", "mocha" ], "decaf": [], milk: [ "oat" ], chocolate: [ "dark" ] }
```

### POSIX-flavoured

While `argvex` aims at being a minimalist tool, it can support most of the POSIX-flavoured syntax if you pass a schema to it.

```sh
brewer brew -dsmedium -h2 macchiato
```
```typescript
import argvex from 'argvex'

const schema = [
  { name: "decaf", alias: "d", arity: 0 },
  { name: "size", alias: "s", arity: 1 },
  { name: "shots", alias: "h", arity: 1 },
]
const args = argvex({ schema })
// args -> { _: [ "brewer", "brew", "macchiato" ], "decaf": [], size: [ "medium" ], shots: [ "2" ] }
```

### Repeating flags

By default, repeating a flag accumulates values into the array.

```sh
brewer brew flat-white --milk steamed --milk foamed --milk microfoam
```
```typescript
import argvex from 'argvex'

const schema = [
  { name: "milk", arity: 3 },
]
const args = argvex({ schema })
// args -> { _: [ "brewer", "brew", "flat-white" ], milk: [ "steamed", "foamed", "microfoam" ] }
```

If you want last-write-wins behavior instead, enable override mode.

```typescript
const args = argvex({ schema, override: true })
// args -> { _: [ "brewer", "brew", "flat-white" ], milk: [ "microfoam" ] }
```

### Strict Mode

You may force `argvex` to throw an error whenever unexpected flag or value gets passed.

```sh
brewer brew cortado --size small --shots 1 --no-pay
```
```typescript
import argvex from 'argvex'

const schema = [
  { name: "size", arity: 1 },
  { name: "shots", arity: 1 },
]
const args = argvex({ schema, strict: true })
// args -> ParseError
```

### Examples of common patters

`argvex` doesn't try to do anything more than parsing itself, so it's up to you how you want to handle the rest.   
Here are some common patterns you might find useful.

#### Case with required flags

Sometimes you need to ensure certain flags are provided. 
You can check for their presence and throw an error if they're missing.

```typescript
import argvex from 'argvex'

const args = argvex()

if (!args.temperature) {
    throw new Error('You must provide "--temperature" flag first.')
}
```

#### Case with default values

When optional flags aren't provided, you can set sensible defaults.

```typescript
import argvex from 'argvex'

const args = argvex()

if (!args.milk) {
    args.milk = [ "steamed" ]
}
```

#### Case with value coercion

Since `argvex` returns all values as strings, you'll often want to convert them to the appropriate types.

```typescript
import argvex from 'argvex'

const args = argvex()

if (args.temperature) {
    args.temperature = args.temperature.map(temperature => parseInt(temperature, 10))
}
```

#### Case with error handling

Wrap `argvex` calls in try-catch to handle parsing errors gracefully.

```typescript
import argvex, { ParseError } from 'argvex'

try {
    const args = argvex({ strict: true })
    // todo: process args here
} catch (error) {
    if (error instanceof ParseError) {
        console.error('Invalid command line arguments')
        process.exit(1)
    }
    throw error
}
```
