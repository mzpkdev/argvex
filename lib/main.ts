import argv from "./index"

export async function main(...varargs: string[]): Promise<number> {
    try {
        console.log(argv({ argv: varargs }))
        return 0
    } catch (error) {
        console.error(error)
        return 1
    }
}

const run = async () => {
    try {
        const code = await main(...process.argv.slice(2))
        process.exit(code)
    } catch (error) {
        console.error(error)
    }
}

run()
