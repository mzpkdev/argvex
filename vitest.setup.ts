globalThis.context = describe

declare global {
  const context: typeof describe
}
