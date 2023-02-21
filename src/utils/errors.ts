import * as createError from 'http-errors'

export function assertUserError(error: any) {
  if (!(error instanceof Error)) {
    throw error
  }
  const statusCode = (error as createError.HttpError)?.statusCode
  if (statusCode >= 400 && statusCode < 500) {
    return
  }
  throw error
}
