# Comparison of CLI argument parsers

A comprehensive comparison of popular command-line argument parsing libraries for JavaScript and TypeScript.

## Overview

This document compares the most widely-used CLI argument parsing libraries in the JavaScript/TypeScript ecosystem.  
Each library has different design philosophies, feature sets, and trade-offs that make them suitable for different use cases.

## Library Comparison

| Library | Language | Philosophy | Dependencies | Bundle Size | TypeScript | Schema Required |
|---------|----------|------------|--------------|-------------|-------------|-----------------|
| **argvex** | TypeScript/JS | Minimalist, unopinionated | Zero | ~1.5KB      | ✅ Native | ❌ Optional |
| arg | TypeScript/JS | Simple, type-safe | Zero | ~2.5KB      | ✅ Native | ✅ Required |
| commander | JavaScript | Feature-rich, batteries-included | Zero | ~40KB       | ❌ | ✅ Required |
| meow | JavaScript | Simple, opinionated | 3 | ~?KB        | ❌ | ❌ |
| minimist | JavaScript | Minimal, unopinionated | Zero | ~3.5KB      | ❌ | ❌ |
| oclif | TypeScript/JS | Enterprise CLI framework | 10+ | ~?KB        | ✅ Native | ✅ Required |
| optionator | JavaScript | TypeScript-focused | 2 | ~?KB        | ✅ | ✅ Required |
| yargs | JavaScript | Feature-rich, batteries-included | 4 | ~?KB        | ❌ | ❌ |

## Quick Reference

| Library | Philosophy | Size | TS | Schema | Help | Subcommands | Best For |
|---------|------------|------|-----|--------|------|-------------|----------|
| **argvex** | Minimalist, unopinionated | ~2KB | ✅ | Optional | ❌ | ❌ | Full control, true POSIX syntax |
| arg | Simple, type-safe | ~1KB | ✅ | Required | ❌ | ❌ | Type-safe parsing |
| commander | Batteries-included | ~200KB | ❌ | Required | ✅ | ✅ | Feature-rich CLIs |
| meow | Simple, opinionated | ~50KB | ❌ | ❌ | ✅ | ❌ | Quick utilities |
| minimist | Bare minimum | ~2KB | ❌ | ❌ | ❌ | ❌ | Simple JS tools |
| oclif | Enterprise framework | ~500KB | ✅ | Required | ✅ | ✅ | Large CLI platforms |
| optionator | TypeScript-focused | ~30KB | ✅ | Required | ❌ | ❌ | Strong typing |
| yargs | Feature-rich | ~300KB | ❌ | ❌ | ✅ | ✅ | Complex CLIs |

## Examples

**argvex** (schema-optional):
```typescript
import argvex from 'argvex'
const args = argvex()
if (args.verbose) console.log('Verbose mode enabled')
```

**arg** (type-safe):
```typescript
import { arg } from 'arg'
const args = arg({ '--port': Number, '--help': Boolean })
```

**commander** (feature-rich):
```javascript
const { Command } = require('commander')
const program = new Command()
program.option('-d, --debug', 'debug mode').parse()
```

**minimist** (minimal):
```javascript
const parseArgs = require('minimist')
const argv = parseArgs(process.argv.slice(2))
```

## Feature Comparison

| Feature | argvex | arg | commander | meow | minimist | oclif | optionator | yargs |
|---------|--------|-----|-----------|------|----------|--------|------------|-------|
| **Zero Dependencies** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **TypeScript Native** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Schema Optional** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **POSIX Compatible** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Built-in Help** | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Subcommands** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Type Conversion** | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Validation** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Additive Mode** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Strict Mode** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |

## Bundle Size Comparison

| Library | Size   | Dependencies |
|---------|--------|--------------|
| **argvex** | ~1.5KB | 0 |
| arg | ~2.5KB | 0 |
| minimist | ~3.5KB | 0 |
| meow | ~?KB   | 3 |
| optionator | ~?KB   | 2 |
| commander | ~?KB   | 0 |
| yargs | ~?KB   | 4 |
| oclif | ~?KB   | 10+ |

## When to Choose Each Library

**argvex**: Full control, true POSIX syntax, TypeScript support, schema-optional
**arg**: Type-safe parsing, minimal dependencies, schema required, no POSIX syntax
**commander**: Feature-rich CLIs, built-in help, subcommands, no POSIX syntax
**yargs**: Complex CLIs, middleware, extensive customization, no POSIX syntax
**minimist**: Smallest size, maximum performance, simple JS tools, no POSIX syntax
**meow**: Quick utilities, opinionated, built-in help, no POSIX syntax
**oclif**: Enterprise CLIs, comprehensive framework, plugins, no POSIX syntax
**optionator**: Strong TypeScript integration, validation, no POSIX syntax

## Performance

**Fastest**: argvex, arg  
**Medium**: minimist, meow  
**Slower**: commander, yargs, oclif

## Summary

- **Minimal**: argvex, arg (small bundles, simple APIs)
- **Feature-rich**: commander, yargs, oclif (comprehensive tooling)
- **TypeScript**: argvex, arg, oclif, optionator (better DX)

Choose based on bundle size, features, and TypeScript support needs.
