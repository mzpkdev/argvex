# Claude Code Conventions

This document outlines the coding conventions for this project.

**Note:** This project uses IntelliJ IDEA's code style configuration. Please refer to `.idea/codeStyles/Project.xml` for the complete code style settings.

## General Style

- Use **double quotes** by default for strings
- **Omit semicolons** where possible
- Use **spaces between curly braces** for objects, imports, and array destructuring

```typescript
// Good
const obj = { key: "value" }
import { something } from "module"
const [ first, second ] = array

// Bad
const obj = {key: "value"};
import {something} from 'module'
const [first,second] = array;
```

## Imports

- Node.js built-in modules (path, fs, etc.) should use `* as <module>` pattern
- Third-party and local imports use named imports
- Default imports are acceptable for libraries that use them as their standard pattern (e.g., express, fastify)

```typescript
import * as path from "path"
import * as fs from "fs"
import { something } from "./local-module"
import express from "express"  // acceptable: standard pattern for express
```

## Control Flow

- **if/else statements must always use curly braces** for blocks
- **switch statements** are acceptable instead of multiple if/else chains

```typescript
// Good
if (condition) {
  doSomething()
} else {
  doOtherThing()
}

switch (value) {
  case "a":
    handleA()
    break
  case "b":
    handleB()
    break
  default:
    handleDefault()
}

// Bad
if (condition) doSomething()
else doOtherThing()
```

## Functions

- Prefer **arrow functions** over function declarations
- Use function declarations only when hoisting is needed or for constructor functions

```typescript
// Good
const fetchData = async () => {
  const result = await fetch(url)
  const data = await result.json()
  return data
}

const add = (a: number, b: number) => a + b

// Acceptable: when hoisting is needed
function main() {
  helper() // hoisted
}

function helper() {
  // ...
}

// Bad
async function fetchData() {
  const result = await fetch(url)
  const data = await result.json()
  return data
}
```

## Types

- Use **lowercase primitive types** (`string`, `number`, `boolean`, `symbol`, `bigint`) — never their boxed wrappers (`String`, `Number`, `Boolean`, etc.)
- Use **`T[]`** syntax over `Array<T>` for array types
- Use **`readonly T[]`** over `ReadonlyArray<T>`
- Use **inline object shapes** or `Record<K, V>` over `Object` or `object` when the shape is known
- Use **arrow signatures** `(arg: T) => R` over `Function`

```typescript
// Good
const names: string[] = []
const lookup: Record<string, number> = {}
const handler: (event: Event) => void = (e) => { }
const items: readonly string[] = ["a", "b"]

// Bad
const names: Array<string> = []
const lookup: Object = {}
const handler: Function = (e) => { }
const items: ReadonlyArray<string> = ["a", "b"]
```

## Async Code

- Prefer **async/await** over raw Promises
- Avoid Promise chaining; use await instead
