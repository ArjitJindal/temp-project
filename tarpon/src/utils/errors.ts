import { HttpError } from 'http-errors'

export function assertUserError(error: any) {
  if (!(error instanceof Error)) {
    throw error
  }
  const statusCode = (error as HttpError)?.statusCode
  if (statusCode >= 400 && statusCode < 500) {
    return
  }
  throw error
}

export class WrappedError extends Error {
  constructor(message: string, error: unknown) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore cause not available in ES2020 typescript but is in the node runtime.
    super(message, { cause: error })
  }
}
