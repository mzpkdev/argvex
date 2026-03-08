export enum ErrorCode {
    INVALID_SCHEMA,
    INVALID_INPUT,
    RESERVED_KEYWORD
}

export class ParseError extends Error {
    code: ErrorCode
    argument: string

    constructor(code: ErrorCode, argument: string, reason: string = "") {
        const message = (message: string) =>
            `${message}${reason && `: ${reason}`}.`
        switch (code) {
            case ErrorCode.INVALID_SCHEMA:
                super(message(`Schema definition for "${argument}" is invalid`))
                break
            case ErrorCode.INVALID_INPUT:
                super(message(`Argument "${argument}" is invalid`))
                break
            case ErrorCode.RESERVED_KEYWORD:
                super(message(`Argument "${argument}" is a reserved keyword`))
                break
            default:
                super()
        }
        this.name = "ParseError"
        Object.setPrototypeOf(this, ParseError.prototype)
        this.code = code
        this.argument = argument
    }
}
