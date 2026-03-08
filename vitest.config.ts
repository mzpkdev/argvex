import * as path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
    resolve: {
        alias: {
            argvex: path.resolve(__dirname, "lib/index.ts")
        },
        extensions: [".ts", ".js", ".json"]
    },
    test: {
        globals: true,
        environment: "node",
        include: ["**/*.spec.ts", "**/*.test.ts"]
    }
})
