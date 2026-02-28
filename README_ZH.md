<div align="center">

[![license](https://img.shields.io/npm/l/argvex.svg)](https://github.com/mzpkdev/argvex/blob/master/LICENSE)
[![npm version](https://img.shields.io/npm/v/argvex.svg)](https://www.npmjs.com/package/argvex)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![bundle size](https://img.shields.io/bundlephobia/min/argvex)](https://bundlephobia.com/result?p=argvex)

</div>
<br>
<br>

<p align="center">
  <img src="./.github/assets/main-banner.gif" height="320" align="center" />
  <p align="center">
    <strong>argvex</strong> 是一个轻量级且无偏见的 CLI 参数解析器 <br>  
      — 仅是一个解析工具，而非框架
    <br />
    <br />
    <a href="#how-to-use"><strong>探索 API »</strong></a>
    <br />
    <br />
    <a href="https://github.com/mzpkdev/argvex/issues">报告错误</a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="https://github.com/mzpkdev/argvex/issues">请求功能</a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="./README.md">English</a>
  </p>
<br />
<br />

目录
------------------

* [概述](#overview)
  * [为什么选择 argvex？](#why-argvex)
  * [主要特性](#key-features)
* [开始使用](#getting-started)
  * [如何安装](#how-to-install)
  * [如何使用](#how-to-use)
  * [别名](#aliases)
  * [POSIX 风格](#posix-flavoured)
  * [重复标志](#repeating-flags)
  * [严格模式](#strict-mode)
* [常见模式示例](#examples-of-common-patters)
  * [必需标志的情况](#case-with-required-flags)
  * [默认值的情况](#case-with-default-values)
  * [值转换的情况](#case-with-value-coercion)
  * [错误处理的情况](#case-with-error-handling)

概述
---------

### 为什么选择 argvex？

你想要自己构建 CLI，但参数解析让人头疼？  
让 `argvex` 处理烦人的部分，仅此而已。  

`argvex` 是一个极简的参数解析器，几乎不提供 API，让你保持完全控制，
定义自己的规则，避免框架包袱。

### 主要特性

<div align="center">

<table>
  <tbody>
    <tr>
      <td>🚀 零依赖</td>
      <td>一个文件。快速。无树膨胀。</td>
    </tr>
    <tr>
      <td>🕹️️ 配置控制</td>
      <td>你定义行为、类型、默认值 — 全由你选择</td>
    </tr>
    <tr>
      <td>⚙️ 零假设</td>
      <td>一切都是显式的，无强制转换，无意外。</td>
    </tr>
    <tr>
      <td>🔌 可选模式</td>
      <td>开箱即用，仅在需要时添加约束。</td>
    </tr>
    <tr>
      <td>🐚 UNIX 哲学</td>
      <td>做好一件事，保持可组合性。</td>
    </tr>
    <tr>
      <td>💙 TypeScript</td>
      <td>开箱即用的类型定义。</td>
    </tr>
  </tbody>
</table>     

</div>

开始使用
----------------

`argvex` 为你提供命令行输入的结构化视图 — 标志、值和操作数 —
而不强制模式、强制转换或假设。

### 如何安装

```shell
npm install argvex
```

### 如何使用

你可以直接调用 `argvex()` 来获取结构化的 `process.argv` 输出。

```sh
brewer brew espresso --size medium --shots 3 --milk none --temperature 92 --crema thick
```
```typescript
import argvex from 'argvex'

const args = argvex()
// args -> { _: [ "brewer", "brew", "espresso" ], "size": [ "medium" ], shots: [ "3" ], milk: [ "none" ], temperature: [ "92" ], crema: [ "thick" ] }
```

使用 "=" 的 GNU 风格值分配也可以！

```sh
brewer brew cappuccino --size=large --shots=2 --milk=steamed --foam=thick
```
```typescript
import argvex from 'argvex'

const args = argvex()
// args -> { _: [ "brewer", "brew", "cappuccino" ], "size": [ "large" ], shots: [ "2" ], milk: [ "steamed" ], foam: [ "thick" ] }
```

对于布尔标志，只需检查它们的存在。

```typescript
import argvex from 'argvex'

const args = argvex()
if (!!args.decaf) {
    console.log("制作无咖啡因咖啡！")
}
```

你可以使用独立的短标志或将它们组合使用。

```sh
brewer brew americano -qs -m water -t 85
```
```typescript
import argvex from 'argvex'

const args = argvex()
// args -> { _: [ "brewer", "brew", "americano" ], "q": [], "s": [], m: [ "water" ], t: [ "85" ] }
```

使用 `--`（选项结束分隔符）来分隔标志和可能看起来像标志的操作数。

```sh
brewer brew --milk oat -- --not-a-flag latte
```
```typescript
import argvex from 'argvex'

const args = argvex()
// args -> { _: [ "brewer", "brew", "--not-a-flag", "latte" ], milk: [ "oat" ] }
```

### 别名

虽然你可以轻松编写自己的别名支持，
但如果你传递最小模式，`argvex` 可以开箱即用地处理这些。

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

### POSIX 风格

虽然 `argvex` 旨在成为一个极简工具，但如果你传递模式，它可以支持大部分 POSIX 风格的语法。

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

### 重复标志

默认情况下，重复标志会覆盖其先前的值。
如果你希望值累积，请启用加法模式。

```sh
brewer brew flat-white --milk steamed --milk foamed --milk microfoam
```
```typescript
import argvex from 'argvex'

const schema = [
  { name: "milk", arity: 3 },
]
const args = argvex({ schema, additive: true })
// args -> { _: [ "brewer", "brew", "flat-white" ], milk: [ "steamed", "foamed", "microfoam" ] }
```

### 严格模式

你可以强制 `argvex` 在传递意外标志或值时抛出错误。

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

### 常见模式示例

`argvex` 不会尝试做任何超出解析本身的事情，所以如何处理其余部分取决于你。 
以下是一些你可能觉得有用的常见模式。

#### 必需标志的情况

有时你需要确保提供了某些标志。
你可以检查它们的存在，如果缺失则抛出错误。

```typescript
import argvex from 'argvex'

const args = argvex()

if (!args.temperature) {
    throw new Error('你必须首先提供 "--temperature" 标志。')
}
```

#### 默认值的情况

当未提供可选标志时，你可以设置合理的默认值。

```typescript
import argvex from 'argvex'

const args = argvex()

if (!args.milk) {
    args.milk = [ "steamed" ]
}
```

#### 值转换的情况

由于 `argvex` 将所有值作为字符串返回，你经常想要将它们转换为适当的类型。

```typescript
import argvex from 'argvex'

const args = argvex()

if (args.temperature) {
    args.temperature = args.temperature.map(temperature => parseInt(temperature, 10))
}
```

#### 错误处理的情况

用 try-catch 包装 `argvex` 调用以优雅地处理解析错误。

```typescript
import argvex, { ParseError } from 'argvex'

try {
    const args = argvex({ strict: true })
    // todo: 在这里处理参数
} catch (error) {
    if (error instanceof ParseError) {
        console.error('无效的命令行参数')
        process.exit(1)
    }
    throw error
}
``` 